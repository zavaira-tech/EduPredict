import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Performance from "../models/Performance.js";
import Prediction from "../models/Prediction.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { callMlService, isModelType } from "../services/mlService.js";

const objectIdPattern = /^[a-f\d]{24}$/i;
const MAX_TRAINING_RECORDS = 100_000;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function requireId(value, label) {
  if (typeof value !== "string" || !objectIdPattern.test(value)) {
    throw badRequest(`A valid ${label} ID is required.`);
  }
  return new mongoose.Types.ObjectId(value);
}

function requireFeatures(modelType, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Prediction features are required.");
  }
  const ranges = {
    performance: {
      previousGpa: [0, 4], attendancePercentage: [0, 100], assignmentAverage: [0, 100],
      quizAverage: [0, 100], midtermScore: [0, 100], previousSemesterPerformance: [0, 100],
      courseEnrollment: [0, 100000], semester: [1, 20],
    },
    dropout: {
      attendancePercentage: [0, 100], gpa: [0, 4], failedCourses: [0, 1000],
      previousPerformance: [0, 100], semesterProgression: [1, 20],
      enrollmentHistory: [0, 1000], courseCompletionHistory: [0, 100],
    },
    "course-demand": {
      semester: [1, 20], academicYearIndex: [19000, 220000],
      previousEnrollment: [0, 100000], priorPreviousEnrollment: [0, 100000],
      demandTrend: [-100000, 100000], courseCompletionRate: [0, 100],
      coursePopularity: [0, 100000],
    },
  };
  const categorical = ["department"];
  const allowed = new Set([...Object.keys(ranges[modelType]), ...categorical]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw badRequest("Prediction features contain unsupported fields.");
  }
  for (const [field, [minimum, maximum]] of Object.entries(ranges[modelType])) {
    const item = value[field];
    if (
      typeof item !== "number" ||
      !Number.isFinite(item) ||
      item < minimum ||
      item > maximum
    ) {
      throw badRequest(`Feature '${field}' must be a finite number between ${minimum} and ${maximum}.`);
    }
  }
  for (const field of categorical) {
    if (
      typeof value[field] !== "string" ||
      !value[field].trim() ||
      value[field].trim().length > 100
    ) {
      throw badRequest(`Feature '${field}' must be a non-empty string of at most 100 characters.`);
    }
  }
  return Object.fromEntries([...allowed].map((field) => [field, value[field]]));
}

async function assertStudentScope(user, studentId, courseId = null) {
  const student = await Student.findById(studentId).select("_id");
  if (!student) {
    const error = new Error("Student not found.");
    error.status = 404;
    throw error;
  }
  if (user.role === "admin" || user.role === "analyst") return student;

  if (user.role === "student") {
    const ownStudent = await Student.exists({ _id: studentId, user: user._id });
    if (!ownStudent) {
      const error = new Error("You can only generate predictions for your own academic record.");
      error.status = 403;
      throw error;
    }
    if (courseId && !(await Enrollment.exists({ student: studentId, course: courseId }))) {
      const error = new Error("You can only predict demand for a course in your enrollment history.");
      error.status = 403;
      throw error;
    }
    return student;
  }

  if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: user._id }).select("_id courses");
    const assignedCourseIds = teacher
      ? await Course.find({
          $or: [{ teacher: teacher._id }, { _id: { $in: teacher.courses } }],
        }).distinct("_id")
      : [];
    const enrollmentQuery = {
      student: studentId,
      ...(courseId ? { course: courseId } : { course: { $in: assignedCourseIds } }),
    };
    if (
      (courseId && !assignedCourseIds.some((id) => id.equals(courseId))) ||
      !(await Enrollment.exists(enrollmentQuery))
    ) {
      const error = new Error("You can only generate predictions for students in your assigned courses.");
      error.status = 403;
      throw error;
    }
    return student;
  }

  const error = new Error("Access denied.");
  error.status = 403;
  throw error;
}

async function assertCourseScope(user, courseId) {
  const course = await Course.findById(courseId).select("_id");
  if (!course) {
    const error = new Error("Course not found.");
    error.status = 404;
    throw error;
  }
  if (user.role === "admin" || user.role === "analyst") return;
  if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: user._id }).select("_id courses");
    const assigned = teacher && (
      course._id.equals(teacher.courses.find((id) => id.equals(course._id))) ||
      await Course.exists({ _id: course._id, teacher: teacher._id })
    );
    if (!assigned) {
      const error = new Error("You can only forecast demand for your assigned courses.");
      error.status = 403;
      throw error;
    }
  } else if (user.role === "student" && !(await Enrollment.exists({ course: course._id, student: await Student.findOne({ user: user._id }).select("_id") }))) {
    const error = new Error("You can only forecast demand for a course in your enrollment history.");
    error.status = 403;
    throw error;
  }
}

function enrollmentPeriodKey(record) {
  return `${record.course?.courseCode || ""}|${record.academicYear || ""}|${record.semester || ""}`;
}

function attendanceSummary(records, timestamp) {
  const prior = records.filter((record) => record.createdAt && record.createdAt < timestamp);
  if (!prior.length) return null;
  const values = prior.map((record) => {
    if (typeof record.percentage === "number") return record.percentage / 100;
    return record.status === "Present" ? 1 : record.status === "Late" ? 0.5 : 0;
  });
  return values.reduce((total, value) => total + value, 0) / values.length * 100;
}

function average(records, field) {
  const values = records.map((record) => record[field]).filter(Number.isFinite);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

async function loadPerformanceTrainingRecords() {
  const [performances, attendances, enrollments] = await Promise.all([
    Performance.find({ finalScore: { $gt: 0 } })
      .select("student course assignmentScore quizScore midtermScore finalScore semester academicYear createdAt")
      .populate("student", "department")
      .populate("course", "department")
      .sort({ createdAt: 1 })
      .limit(MAX_TRAINING_RECORDS)
      .lean(),
    Attendance.find()
      .select("student status percentage createdAt")
      .sort({ createdAt: 1 })
      .limit(MAX_TRAINING_RECORDS)
      .lean(),
    Enrollment.find()
      .select("student course academicYear semester createdAt")
      .populate("course", "courseCode")
      .sort({ createdAt: 1 })
      .limit(MAX_TRAINING_RECORDS)
      .lean(),
  ]);
  const attendanceByStudent = new Map();
  for (const record of attendances) {
    const key = String(record.student);
    if (!attendanceByStudent.has(key)) attendanceByStudent.set(key, []);
    attendanceByStudent.get(key).push(record);
  }
  const performanceByStudent = new Map();
  for (const record of performances) {
    const key = String(record.student?._id || record.student);
    if (!performanceByStudent.has(key)) performanceByStudent.set(key, []);
    performanceByStudent.get(key).push(record);
  }
  const enrollmentByPeriod = new Map();
  for (const record of enrollments) {
    const key = enrollmentPeriodKey(record);
    if (!enrollmentByPeriod.has(key)) enrollmentByPeriod.set(key, []);
    enrollmentByPeriod.get(key).push(record);
  }

  return performances.map((record) => {
    const timestamp = record.createdAt || new Date(0);
    const studentKey = String(record.student?._id || record.student);
    const priorPerformance = (performanceByStudent.get(studentKey) || []).filter(
      (item) => item.createdAt && item.createdAt < timestamp,
    );
    const periodKey = `${record.course?.courseCode || ""}|${record.academicYear || ""}|${record.semester || ""}`;
    const courseEnrollment = (enrollmentByPeriod.get(periodKey) || []).filter(
      (item) => item.createdAt && item.createdAt < timestamp,
    ).length;
    return {
      previousGpa: average(priorPerformance, "gpa"),
      attendancePercentage: attendanceSummary(attendanceByStudent.get(studentKey) || [], timestamp),
      assignmentAverage: Number.isFinite(record.assignmentScore) ? record.assignmentScore : null,
      quizAverage: Number.isFinite(record.quizScore) ? record.quizScore : null,
      midtermScore: Number.isFinite(record.midtermScore) ? record.midtermScore : null,
      previousSemesterPerformance: average(priorPerformance, "finalScore"),
      courseEnrollment,
      department: record.course?.department || record.student?.department || null,
      semester: record.semester || null,
      finalScore: record.finalScore,
    };
  });
}

async function loadDropoutTrainingRecords() {
  const [enrollments, performances, attendances, students] = await Promise.all([
    Enrollment.find({ status: { $in: ["completed", "dropped"] } })
      .select("student course status semester createdAt")
      .populate("course", "department")
      .sort({ createdAt: 1 })
      .limit(MAX_TRAINING_RECORDS)
      .lean(),
    Performance.find({ finalScore: { $gt: 0 } })
      .select("student gpa totalScore finalScore createdAt")
      .sort({ createdAt: 1 })
      .limit(MAX_TRAINING_RECORDS)
      .lean(),
    Attendance.find()
      .select("student status percentage createdAt")
      .sort({ createdAt: 1 })
      .limit(MAX_TRAINING_RECORDS)
      .lean(),
    Student.find().select("_id department").lean(),
  ]);
  const studentById = new Map(students.map((item) => [String(item._id), item]));
  const enrollmentByStudent = new Map();
  const performanceByStudent = new Map();
  const attendanceByStudent = new Map();
  for (const record of enrollments) {
    const key = String(record.student);
    if (!enrollmentByStudent.has(key)) enrollmentByStudent.set(key, []);
    enrollmentByStudent.get(key).push(record);
  }
  for (const record of performances) {
    const key = String(record.student);
    if (!performanceByStudent.has(key)) performanceByStudent.set(key, []);
    performanceByStudent.get(key).push(record);
  }
  for (const record of attendances) {
    const key = String(record.student);
    if (!attendanceByStudent.has(key)) attendanceByStudent.set(key, []);
    attendanceByStudent.get(key).push(record);
  }

  return enrollments.map((record) => {
    const studentKey = String(record.student);
    const timestamp = record.createdAt || new Date(0);
    const priorEnrollments = (enrollmentByStudent.get(studentKey) || []).filter(
      (item) => item.createdAt && item.createdAt < timestamp,
    );
    const priorPerformance = (performanceByStudent.get(studentKey) || []).filter(
      (item) => item.createdAt && item.createdAt < timestamp,
    );
    const completed = priorEnrollments.filter((item) => item.status === "completed").length;
    const priorAttendance = attendanceSummary(attendanceByStudent.get(studentKey) || [], timestamp);
    return {
      attendancePercentage: priorAttendance,
      gpa: average(priorPerformance, "gpa"),
      failedCourses: priorPerformance.filter(
        (item) => (Number.isFinite(item.gpa) && item.gpa < 2) ||
          (Number.isFinite(item.totalScore) && item.totalScore < 60),
      ).length,
      previousPerformance: average(priorPerformance, "finalScore"),
      semesterProgression: record.semester,
      enrollmentHistory: priorEnrollments.length,
      courseCompletionHistory: priorEnrollments.length
        ? completed / priorEnrollments.length * 100
        : null,
      department: record.course?.department || studentById.get(studentKey)?.department || null,
      dropped: record.status === "dropped" ? 1 : 0,
    };
  });
}

async function loadCourseDemandTrainingRecords() {
  const enrollments = await Enrollment.find()
    .select("course academicYear semester")
    .populate("course", "courseCode department")
    .limit(MAX_TRAINING_RECORDS)
    .lean();
  const totals = new Map();
  for (const record of enrollments) {
    if (!record.course?.courseCode || !record.academicYear || !record.semester) continue;
    const key = `${record.course.courseCode}|${record.academicYear}|${record.semester}`;
    const total = totals.get(key) || {
      courseCode: record.course.courseCode,
      department: record.course.department,
      academicYear: record.academicYear,
      semester: record.semester,
      enrollment: 0,
    };
    total.enrollment += 1;
    totals.set(key, total);
  }
  return [...totals.values()];
}

async function loadTrainingRecords(modelType) {
  if (modelType === "performance") return loadPerformanceTrainingRecords();
  if (modelType === "dropout") return loadDropoutTrainingRecords();
  if (modelType === "course-demand") return loadCourseDemandTrainingRecords();
  const error = badRequest("Unsupported model type.");
  throw error;
}

export const trainModel = asyncHandler(async (req, res) => {
  const { modelType } = req.params;
  if (!isModelType(modelType)) throw badRequest("Unsupported model type.");
  const records = await loadTrainingRecords(modelType);
  const result = await callMlService(`/api/ml/train/${modelType}`, {
    method: "POST",
    body: { records },
  });
  res.json({ success: true, data: result });
});

export const predict = asyncHandler(async (req, res) => {
  const { modelType } = req.params;
  if (!isModelType(modelType)) throw badRequest("Unsupported model type.");
  const features = requireFeatures(modelType, req.body?.features);
  let student = null;
  let course = null;

  if (modelType === "course-demand") {
    course = requireId(req.body?.courseId, "course");
    await assertCourseScope(req.user, course);
  } else {
    student = requireId(req.body?.studentId, "student");
    course = req.body?.courseId ? requireId(req.body.courseId, "course") : null;
    await assertStudentScope(req.user, student, modelType === "performance" ? course : null);
    if (modelType === "performance" && !course) {
      throw badRequest("A course ID is required for a performance prediction.");
    }
    if (course && !(await Course.exists({ _id: course }))) throw badRequest("Course not found.");
  }

  const predictionResult = await callMlService(`/api/ml/predict/${modelType}`, {
    method: "POST",
    body: { features },
  });
  const prediction = await Prediction.create({
    ...(student ? { student } : {}),
    ...(course ? { course } : {}),
    predictionType: modelType === "course-demand" ? "courseDemand" : modelType,
    prediction: modelType === "performance"
      ? `${predictionResult.predictedFinalScore} (${predictionResult.predictedGrade})`
      : modelType === "dropout"
        ? predictionResult.riskLevel
        : String(predictionResult.predictedEnrollment),
    predictedValue: modelType === "performance"
      ? predictionResult.predictedFinalScore
      : modelType === "dropout"
        ? predictionResult.riskLevel
        : predictionResult.predictedEnrollment,
    predictedGrade: predictionResult.predictedGrade,
    riskLevel: predictionResult.riskLevel,
    probability: predictionResult.riskProbability,
    confidence: predictionResult.confidence,
    modelVersion: predictionResult.modelVersion,
    modelName: predictionResult.modelName,
    featuresUsed: predictionResult.featuresUsed,
    recommendations: predictionResult.recommendations || [],
    recommendation: predictionResult.recommendations?.join(" ") || "",
    explanation: predictionResult.mainContributingFactors || [],
    details: predictionResult,
  });
  res.status(201).json({ success: true, data: { ...predictionResult, predictionId: prediction._id } });
});

export const listModels = asyncHandler(async (_req, res) => {
  const data = await callMlService("/api/ml/models");
  res.json({ success: true, data });
});

export const getModel = asyncHandler(async (req, res) => {
  const data = await callMlService(`/api/ml/models/${encodeURIComponent(req.params.modelId)}`);
  res.json({ success: true, data });
});

export const getEvaluation = asyncHandler(async (_req, res) => {
  const data = await callMlService("/api/ml/evaluation");
  res.json({ success: true, data });
});

export const listPredictionHistory = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id }).select("_id");
    filter.student = student?._id || null;
  } else if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id }).select("_id courses");
    if (!teacher) {
      filter._id = null;
    } else {
      const courseIds = await Course.find({
        $or: [{ teacher: teacher._id }, { _id: { $in: teacher.courses } }],
      }).distinct("_id");
      const studentIds = courseIds.length
        ? await Enrollment.distinct("student", { course: { $in: courseIds } })
        : [];
      filter.$or = [
        { student: { $in: studentIds } },
        { predictionType: "courseDemand", course: { $in: courseIds } },
      ];
    }
  }
  if (req.query.studentId !== undefined) {
    const studentId = requireId(req.query.studentId, "student");
    if (req.user.role === "student" && !studentId.equals(filter.student)) {
      const error = new Error("You can only view your own predictions.");
      error.status = 403;
      throw error;
    }
    filter.student = studentId;
  }
  const records = await Prediction.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("student", "studentId name")
    .populate("course", "courseCode courseName department");
  res.json({ success: true, data: records });
});

