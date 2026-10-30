import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import asyncHandler from "../middleware/asyncHandler.js";

const invalidId = (id) => !mongoose.isValidObjectId(id);

async function enrollmentScope(user) {
  if (user.role === "admin" || user.role === "analyst") return {};
  if (user.role === "student") {
    const student = await Student.findOne({ user: user._id }).select("_id");
    return student ? { student: student._id } : { _id: null };
  }
  if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: user._id }).select("_id");
    if (!teacher) return { _id: null };
    const courses = await Course.find({ teacher: teacher._id }).distinct("_id");
    return courses.length ? { course: { $in: courses } } : { _id: null };
  }
  return { _id: null };
}

async function validateReferences(studentId, courseId) {
  if (invalidId(studentId) || invalidId(courseId)) return null;
  const [student, course] = await Promise.all([
    Student.findById(studentId).select("_id"),
    Course.findById(courseId).select("_id enrolledStudents"),
  ]);
  return student && course ? { student, course } : null;
}

async function syncCourseRoster(courseId, studentId) {
  const hasActiveEnrollment = await Enrollment.exists({
    course: courseId,
    student: studentId,
    status: "active",
  });
  if (hasActiveEnrollment) {
    await Course.updateOne({ _id: courseId }, { $addToSet: { enrolledStudents: studentId } });
  } else {
    await Course.updateOne({ _id: courseId }, { $pull: { enrolledStudents: studentId } });
  }
}

export const listEnrollments = asyncHandler(async (req, res) => {
  const filter = await enrollmentScope(req.user);
  const records = await Enrollment.find(filter)
    .populate("student", "studentId name email department program")
    .populate("course", "courseCode courseName department credits semester teacher")
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ success: true, data: records });
});

export const getEnrollment = asyncHandler(async (req, res) => {
  if (invalidId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid enrollment ID." });
  }
  const scope = await enrollmentScope(req.user);
  const record = await Enrollment.findOne({ $and: [{ _id: req.params.id }, scope] })
    .populate("student", "studentId name email department program")
    .populate("course", "courseCode courseName department credits semester teacher");
  if (!record) return res.status(404).json({ success: false, message: "Enrollment not found." });
  res.json({ success: true, data: record });
});

export const createEnrollment = asyncHandler(async (req, res) => {
  const { student: studentId, course: courseId, academicYear, semester, enrolledAt, status } = req.body || {};
  const references = await validateReferences(studentId, courseId);
  if (!references) {
    return res.status(400).json({ success: false, message: "A valid student and course are required." });
  }
  if (typeof academicYear !== "string" || !academicYear.trim() || !Number.isInteger(Number(semester))) {
    return res.status(400).json({ success: false, message: "Academic year and semester are required." });
  }
  const record = await Enrollment.create({
    student: studentId,
    course: courseId,
    academicYear: academicYear.trim(),
    semester: Number(semester),
    enrolledAt,
    status,
  });
  if (record.status === "active") {
    await Course.updateOne(
      { _id: courseId },
      { $addToSet: { enrolledStudents: studentId } },
    );
  }
  await record.populate([
    { path: "student", select: "studentId name email department program" },
    { path: "course", select: "courseCode courseName department credits semester teacher" },
  ]);
  res.status(201).json({ success: true, data: record });
});

export const updateEnrollment = asyncHandler(async (req, res) => {
  if (invalidId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid enrollment ID." });
  }
  const scope = await enrollmentScope(req.user);
  const record = await Enrollment.findOne({ $and: [{ _id: req.params.id }, scope] });
  if (!record) return res.status(404).json({ success: false, message: "Enrollment not found." });

  const updates = req.body || {};
  const previousStudent = record.student;
  const previousCourse = record.course;
  const nextStudent = updates.student ?? record.student;
  const nextCourse = updates.course ?? record.course;
  if (updates.student !== undefined || updates.course !== undefined) {
    const references = await validateReferences(nextStudent, nextCourse);
    if (!references) {
      return res.status(400).json({ success: false, message: "A valid student and course are required." });
    }
  }
  for (const key of ["academicYear", "semester", "enrolledAt", "status"]) {
    if (updates[key] !== undefined) record[key] = updates[key];
  }
  if (updates.student !== undefined) record.student = nextStudent;
  if (updates.course !== undefined) record.course = nextCourse;
  await record.save();
  const rosterSyncs = [syncCourseRoster(record.course, record.student)];
  if (!previousCourse.equals(record.course) || !previousStudent.equals(record.student)) {
    rosterSyncs.push(syncCourseRoster(previousCourse, previousStudent));
  }
  await Promise.all(rosterSyncs);
  await record.populate([
    { path: "student", select: "studentId name email department program" },
    { path: "course", select: "courseCode courseName department credits semester teacher" },
  ]);
  res.json({ success: true, data: record });
});

export const deleteEnrollment = asyncHandler(async (req, res) => {
  if (invalidId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid enrollment ID." });
  }
  const record = await Enrollment.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: "Enrollment not found." });
  await syncCourseRoster(record.course, record.student);
  res.json({ success: true, message: "Enrollment deleted." });
});
