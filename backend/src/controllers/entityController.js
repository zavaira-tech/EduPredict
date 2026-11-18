import mongoose from "mongoose";
import Alert from "../models/Alert.js";
import Attendance from "../models/Attendance.js";
import Course from "../models/Course.js";
import Dataset from "../models/Dataset.js";
import Enrollment from "../models/Enrollment.js";
import Performance from "../models/Performance.js";
import Prediction from "../models/Prediction.js";
import Student from "../models/Student.js";
import SupportTicket from "../models/SupportTicket.js";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

const models = {
  students: Student,
  teachers: Teacher,
  courses: Course,
  attendance: Attendance,
  performance: Performance,
  predictions: Prediction,
  datasets: Dataset,
  alerts: Alert,
  support: SupportTicket,
};

export async function scopedFilter(req, modelName) {
  const user = req.user;
  if (user.role === "admin") return {};
  if (user.role === "analyst") {
    return modelName === "datasets" ? { uploadedBy: user._id } : {};
  }

  if (user.role === "student") {
    const profile = await Student.findOne({ user: user._id }).select("_id");
    const studentId = profile?._id;
    if (modelName === "students") return studentId ? { _id: studentId } : { _id: null };
    if (modelName === "courses") return studentId ? { enrolledStudents: studentId } : { _id: null };
    if (modelName === "predictions") {
      return studentId
        ? { student: studentId, predictionType: { $ne: "courseDemand" } }
        : { _id: null };
    }
    if (["attendance", "performance", "alerts"].includes(modelName)) {
      return studentId ? { student: studentId } : { _id: null };
    }
    if (modelName === "support") return { user: user._id };
    return { _id: null };
  }

  if (user.role === "teacher") {
    const profile = await Teacher.findOne({ user: user._id }).select("_id");
    if (modelName === "teachers") return profile ? { _id: profile._id } : { _id: null };
    if (modelName === "courses") return profile ? { teacher: profile._id } : { _id: null };
    if (["students", "attendance", "performance", "predictions"].includes(modelName)) {
      if (!profile) return { _id: null };
      const courses = await Course.find({ teacher: profile._id }).select("_id enrolledStudents");
      const courseIds = courses.map((course) => course._id);
      const studentIds = [...new Set(courses.flatMap((course) => course.enrolledStudents.map(String)))];
      if (modelName === "students") {
        return { _id: { $in: studentIds } };
      }
      if (modelName === "predictions") {
        return studentIds.length ? { student: { $in: studentIds } } : { _id: null };
      }
      return {
        course: { $in: courseIds },
        student: { $in: studentIds },
      };
    }
    if (modelName === "alerts") {
      const courses = profile ? await Course.find({ teacher: profile._id }).select("enrolledStudents") : [];
      const studentIds = [...new Set(courses.flatMap((course) => course.enrolledStudents.map(String)))];
      return studentIds.length ? { student: { $in: studentIds } } : { _id: null };
    }
    if (modelName === "support") return {};
  }
  return { _id: null };
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

async function validateEntityReferences(modelName, fields, recordId, { requireActiveTeacher = false } = {}) {
  if (["attendance", "performance"].includes(modelName)) {
    if (
      fields.academicYear !== undefined &&
      (typeof fields.academicYear !== "string" || fields.academicYear.trim().length > 20)
    ) {
      return "Academic year must be a string of at most 20 characters.";
    }
    if (
      fields.semester !== undefined &&
      (!Number.isInteger(Number(fields.semester)) || Number(fields.semester) < 1)
    ) {
      return "Semester must be a positive whole number.";
    }
  }
  if (["students", "teachers"].includes(modelName) && fields.user) {
    if (!isValidId(fields.user)) return "A valid user account ID is required.";
    const expectedRole = modelName === "students" ? "student" : "teacher";
    const [user, existingProfile] = await Promise.all([
      User.findOne({ _id: fields.user, role: expectedRole }).select("_id isActive"),
      models[modelName].exists({
        user: fields.user,
        ...(recordId ? { _id: { $ne: recordId } } : {}),
      }),
    ]);
    if (!user) return `The linked user account must have the ${expectedRole} role.`;
    if (!recordId && user.isActive === false) return "The linked user account must be active.";
    if (existingProfile) return "This user account is already linked to a profile.";
  }
  if (modelName === "courses") {
    if (typeof fields.courseCode !== "string" || !fields.courseCode.trim()) {
      return "Course code is required.";
    }
    if (
      fields.courseCode !== undefined &&
      await Course.exists({
        courseCode: fields.courseCode.trim(),
        ...(recordId ? { _id: { $ne: recordId } } : {}),
      })
    ) {
      return "Course code already exists.";
    }
    if (![1, 2, 3, 4, 5, 6].includes(Number(fields.credits)) || !Number.isInteger(Number(fields.credits))) {
      return "Credits must be a whole number from 1 to 6.";
    }
    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(Number(fields.semester)) || !Number.isInteger(Number(fields.semester))) {
      return "Semester must be a whole number from 1 to 8.";
    }
  }
  if (modelName === "courses" && fields.teacher) {
    if (!isValidId(fields.teacher)) {
      return "The selected teacher record does not exist.";
    }
    const teacher = await Teacher.findById(fields.teacher)
      .populate("user", "role isActive")
      .select("_id user");
    if (!teacher || teacher.user?.role !== "teacher") {
      return "The selected teacher record does not have a valid Teacher profile.";
    }
    if (requireActiveTeacher && teacher.user.isActive === false) {
      return "The selected teacher is inactive.";
    }
  }
  if (["attendance", "performance"].includes(modelName)) {
    if (!isValidId(fields.student) || !isValidId(fields.course)) {
      return "A valid student and course are required.";
    }
    const [student, course] = await Promise.all([
      Student.exists({ _id: fields.student }),
      Course.exists({ _id: fields.course }),
    ]);
    if (!student || !course) return "The selected student or course record does not exist.";
  }
  return null;
}

async function inferAcademicPeriod(modelName, fields) {
  if (!["attendance", "performance"].includes(modelName)) return;
  if (fields.academicYear && fields.semester) return;
  const enrollmentQuery = {
    student: fields.student,
    course: fields.course,
    ...(fields.academicYear ? { academicYear: fields.academicYear.trim() } : {}),
    ...(fields.semester ? { semester: Number(fields.semester) } : {}),
  };
  let enrollment = await Enrollment.findOne({ ...enrollmentQuery, status: "active" })
    .sort({ enrolledAt: -1 })
    .select("academicYear semester");
  if (!enrollment) {
    enrollment = await Enrollment.findOne(enrollmentQuery)
      .sort({ enrolledAt: -1 })
      .select("academicYear semester");
  }
  if (!enrollment) return;
  if (!fields.academicYear) fields.academicYear = enrollment.academicYear;
  if (!fields.semester) fields.semester = enrollment.semester;
}

export const getAvailableTeacherUsers = asyncHandler(async (req, res) => {
  const assignedUserIds = await Teacher.distinct("user", { user: { $ne: null } });
  const filter = {
    role: "teacher",
    isActive: { $ne: false },
    _id: { $nin: assignedUserIds },
  };

  const includeUserId = req.query.includeUserId;
  if (includeUserId && isValidId(includeUserId)) {
    filter.$or = [
      { role: "teacher", isActive: { $ne: false }, _id: { $nin: assignedUserIds } },
      { _id: includeUserId, role: "teacher", isActive: { $ne: false } },
    ];
    delete filter._id;
  }

  const users = await User.find(filter)
    .select("_id name email role")
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: users });
});

const lookupRoles = {
  users: ["admin"],
  students: ["admin", "teacher", "student"],
  teachers: ["admin"],
  courses: ["admin", "teacher", "student", "analyst"],
  departments: ["admin", "teacher", "student", "analyst"],
  programs: ["admin"],
  academicYears: ["admin", "teacher", "student", "analyst"],
  alertTypes: ["admin"],
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageResult(records, page, limit) {
  const start = (page - 1) * limit;
  const data = records.slice(start, start + limit);
  return {
    data,
    pagination: { page, limit, total: records.length, pages: Math.ceil(records.length / limit) },
  };
}

export const listLookupOptions = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!Object.prototype.hasOwnProperty.call(lookupRoles, type)) {
    return res.status(404).json({ success: false, message: "Lookup type not found." });
  }
  if (!lookupRoles[type].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You cannot access these lookup options." });
  }

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (
    !Number.isInteger(page) || page < 1 ||
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    search.length > 100
  ) {
    return res.status(400).json({ success: false, message: "Invalid lookup pagination or search query." });
  }
  for (const key of ["role", "department", "semester", "studentId", "courseId", "teacherId", "requireEnrollment", "unassigned"]) {
    if (req.query[key] !== undefined && typeof req.query[key] !== "string") {
      return res.status(400).json({ success: false, message: `Invalid ${key} lookup filter.` });
    }
  }
  if (typeof req.query.department === "string" && req.query.department.trim().length > 100) {
    return res.status(400).json({ success: false, message: "Department filter is too long." });
  }

  const regex = search ? new RegExp(escapeRegex(search), "i") : null;
  const includeId = req.query.includeId;
  if (includeId && ["users", "students", "teachers", "courses"].includes(type) && !isValidId(includeId)) {
    return res.status(400).json({ success: false, message: "Invalid included record ID." });
  }
  let records = [];
  let total = 0;

  if (type === "departments" || type === "programs" || type === "academicYears" || type === "alertTypes") {
    let values;
    if (type === "departments") {
      const [studentDepartments, teacherDepartments, courseDepartments] = await Promise.all([
        Student.distinct("department"),
        Teacher.distinct("department"),
        Course.distinct("department"),
      ]);
      values = [...new Set([...studentDepartments, ...teacherDepartments, ...courseDepartments]
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim()))];
    } else if (type === "programs") {
      values = await Student.distinct("program", {
        ...(typeof req.query.department === "string" && req.query.department.trim()
          ? { department: req.query.department.trim() }
          : {}),
      });
    } else if (type === "academicYears") {
      let studentId;
      let courseId;
      if (req.query.studentId || req.query.courseId) {
        studentId = req.query.studentId;
        courseId = req.query.courseId;
        if ((studentId && !isValidId(studentId)) || (courseId && !isValidId(courseId))) {
          return res.status(400).json({ success: false, message: "Invalid student or course ID." });
        }
        if (studentId) {
          const studentFilter = await scopedFilter(req, "students");
          const student = await Student.findOne({ $and: [{ _id: studentId }, studentFilter] }).select("_id");
          if (!student) return res.status(404).json({ success: false, message: "Student not found." });
        }
        if (courseId) {
          const courseFilter = await scopedFilter(req, "courses");
          const course = await Course.findOne({ $and: [{ _id: courseId }, courseFilter] }).select("_id");
          if (!course) return res.status(404).json({ success: false, message: "Course not found." });
        }
        const enrollmentFilter = {
          ...(studentId ? { student: studentId } : {}),
          ...(courseId ? { course: courseId } : {}),
        };
        if (
          studentId &&
          courseId &&
          !(await Enrollment.exists({ student: studentId, course: courseId }))
        ) {
          return res.status(400).json({ success: false, message: "The student is not enrolled in that course." });
        }
        const [enrollmentYears, attendanceYears, performanceYears] = await Promise.all([
          Enrollment.distinct("academicYear", enrollmentFilter),
          Attendance.distinct("academicYear", enrollmentFilter),
          Performance.distinct("academicYear", enrollmentFilter),
        ]);
        values = [...enrollmentYears, ...attendanceYears, ...performanceYears];
      } else {
        const [enrollmentYears, attendanceYears, performanceYears] = await Promise.all([
          Enrollment.distinct("academicYear"),
          Attendance.distinct("academicYear"),
          Performance.distinct("academicYear"),
        ]);
        values = [...enrollmentYears, ...attendanceYears, ...performanceYears];
      }
    } else {
      values = await Alert.distinct("type");
    }

    records = [...new Set((values || [])
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim()))]
      .filter((value) => !regex || regex.test(value))
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));
    if (
      includeId &&
      !records.some((record) => record.value === includeId) &&
      values?.some((value) => typeof value === "string" && value.trim() === includeId)
    ) {
      records.unshift({ value: includeId, label: includeId });
    }
    total = records.length;
    const result = pageResult(records, page, limit);
    return res.json({ success: true, data: result.data, pagination: result.pagination });
  }

  if (type === "users") {
    const userRole = req.query.role;
    if (!["student", "teacher"].includes(userRole)) {
      return res.status(400).json({ success: false, message: "A student or teacher role is required." });
    }
    const filter = { role: userRole, isActive: { $ne: false } };
    if (req.query.unassigned === "true") {
      const assignedIds = userRole === "teacher"
        ? await Teacher.distinct("user", { user: { $ne: null } })
        : await Student.distinct("user", { user: { $ne: null } });
      filter._id = { $nin: assignedIds };
    }
    if (includeId) {
      if (!isValidId(includeId)) {
        return res.status(400).json({ success: false, message: "Invalid included user ID." });
      }
      const baseFilter = { ...filter };
      delete baseFilter._id;
      filter.$and = [
        baseFilter,
        { $or: [{ _id: filter._id || { $exists: true } }, { _id: includeId }] },
      ];
      delete filter.role;
      delete filter.isActive;
      delete filter._id;
    }
    const safeFilter = regex
      ? { $and: [filter, { $or: [{ name: regex }, { email: regex }] }] }
      : filter;
    total = await User.countDocuments(safeFilter);
    records = await User.find(safeFilter)
      .select("_id name email role isActive")
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  } else {
    let Model;
    let filter;
    if (type === "students") {
      Model = Student;
      filter = await scopedFilter(req, "students");
      if (req.query.courseId) {
        if (!isValidId(req.query.courseId)) {
          return res.status(400).json({ success: false, message: "Invalid course ID." });
        }
        const courseFilter = await scopedFilter(req, "courses");
        const course = await Course.findOne({ $and: [{ _id: req.query.courseId }, courseFilter] }).select("_id");
        if (!course) return res.status(404).json({ success: false, message: "Course not found." });
        const enrolledStudents = await Enrollment.distinct("student", {
          course: course._id,
          status: { $ne: "dropped" },
        });
        filter = { $and: [filter, { _id: { $in: enrolledStudents } }] };
      }
    } else if (type === "teachers") {
      Model = Teacher;
      const activeUserIds = await User.distinct("_id", {
        role: "teacher",
        isActive: { $ne: false },
      });
      filter = { user: { $in: activeUserIds } };
      if (typeof req.query.department === "string" && req.query.department.trim()) {
        filter.department = req.query.department.trim();
      }
    } else {
      Model = Course;
      filter = await scopedFilter(req, "courses");
      if (typeof req.query.department === "string" && req.query.department.trim()) {
        filter.department = req.query.department.trim();
      }
      if (req.query.semester !== undefined && req.query.semester !== "") {
        const semester = Number(req.query.semester);
        if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
          return res.status(400).json({ success: false, message: "Semester must be from 1 to 8." });
        }
        filter.semester = semester;
      }
      if (req.query.teacherId) {
        if (!isValidId(req.query.teacherId)) {
          return res.status(400).json({ success: false, message: "Invalid teacher ID." });
        }
        const selectedTeacher = await Teacher.findById(req.query.teacherId).select("user");
        const activeTeacherUser = selectedTeacher && await User.exists({
          _id: selectedTeacher.user,
          role: "teacher",
          isActive: { $ne: false },
        });
        if (!selectedTeacher || !activeTeacherUser) {
          return res.status(404).json({ success: false, message: "Teacher not found." });
        }
        filter.teacher = req.query.teacherId;
      }
      if (req.query.studentId) {
        if (!isValidId(req.query.studentId)) {
          return res.status(400).json({ success: false, message: "Invalid student ID." });
        }
        const studentFilter = await scopedFilter(req, "students");
        const student = await Student.findOne({ $and: [{ _id: req.query.studentId }, studentFilter] })
          .select("_id department semester");
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });
        if (req.query.requireEnrollment === "true") {
          const enrolledCourses = await Enrollment.distinct("course", {
            student: student._id,
            status: { $ne: "dropped" },
          });
          filter._id = { $in: enrolledCourses };
        } else {
          filter.department = student.department;
          filter.semester = student.semester;
        }
      }
    }

    if (type === "courses" && req.query.requireEnrollment === "true" && !req.query.studentId) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
      });
    }

    if (regex) {
      const searchableFields = type === "students"
        ? ["name", "studentId", "department", "program"]
        : type === "teachers"
          ? ["name", "teacherId", "department"]
          : ["courseCode", "courseName", "department"];
      const searchFilter = { $or: searchableFields.map((field) => ({ [field]: regex })) };
      filter = { $and: [filter, searchFilter] };
    }

    total = await Model.countDocuments(filter);
    let query = Model.find(filter)
      .sort(type === "students" ? { name: 1, _id: 1 } : type === "teachers" ? { name: 1, _id: 1 } : { courseCode: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    if (type === "students") query = query.select("_id studentId name department program semester user");
    if (type === "teachers") query = query.select("_id teacherId name department user");
    if (type === "courses") query = query.select("_id courseCode courseName department credits semester teacher");
    if (type === "teachers") query = query.populate("user", "_id isActive");
    if (type === "courses") query = query.populate("teacher", "_id teacherId name");
    records = await query.lean();

    if (includeId && isValidId(includeId) && !records.some((record) => String(record._id) === String(includeId))) {
      let selectedQuery = Model.findOne({ $and: [{ _id: includeId }, filter] })
        .select(type === "students"
          ? "_id studentId name department program semester user"
          : type === "teachers"
            ? "_id teacherId name department user"
            : "_id courseCode courseName department credits semester teacher");
      if (type === "teachers") selectedQuery = selectedQuery.populate("user", "_id isActive");
      if (type === "courses") selectedQuery = selectedQuery.populate("teacher", "_id teacherId name");
      const selectedRecord = await selectedQuery.lean();
      if (selectedRecord) records.unshift(selectedRecord);
    }
  }

  res.json({
    success: true,
    data: records,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export function listEntities(modelName) {
  return asyncHandler(async (req, res) => {
    const Model = models[modelName];
    let filter = await scopedFilter(req, modelName);
    if (modelName === "predictions" && req.params.studentId) {
      if (!isValidId(req.params.studentId)) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
      }
      filter = { $and: [filter, { student: req.params.studentId }] };
    }
    let query = Model.find(filter).sort({ createdAt: -1 }).limit(200);
    if (req.user.role === "student" && modelName === "courses") {
      query = query.select("-enrolledStudents");
    }
    if (modelName === "teachers") {
      query = query.populate("user", "name email role isActive");
    }
    if (modelName === "courses") {
      query = query.populate("teacher", "teacherId name");
    }
    if (modelName === "students") {
      query = query.populate("user", "name email role isActive");
    }
    if (["attendance", "performance", "predictions"].includes(modelName)) {
      query = query
        .populate("student", "studentId name department program semester")
        .populate("course", "courseCode courseName department semester teacher");
    }
    if (modelName === "alerts") {
      query = query.populate("student", "studentId name");
    }
    const records = await query;
    res.json({ success: true, data: records });
  });
}

export function getEntity(modelName) {
  return asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid record ID." });
    }
    const filter = await scopedFilter(req, modelName);
    let query = models[modelName].findOne({ $and: [{ _id: req.params.id }, filter] });
    if (req.user.role === "student" && modelName === "courses") {
      query = query.select("-enrolledStudents");
    }
    if (modelName === "teachers") {
      query = query.populate("user", "name email role isActive");
    }
    if (modelName === "courses") {
      query = query.populate("teacher", "teacherId name");
    }
    if (modelName === "students") {
      query = query.populate("user", "name email role isActive");
    }
    if (["attendance", "performance", "predictions"].includes(modelName)) {
      query = query
        .populate("student", "studentId name department program semester")
        .populate("course", "courseCode courseName department semester teacher");
    }
    if (modelName === "alerts") {
      query = query.populate("student", "studentId name");
    }
    const record = await query;
    if (!record) return res.status(404).json({ success: false, message: "Record not found." });
    res.json({ success: true, data: record });
  });
}

export function createEntity(modelName) {
  return asyncHandler(async (req, res) => {
    const body = { ...req.body };

    if (modelName === "teachers") {
      const selectedUserId = body.user || body.userId;
      if (!selectedUserId || !isValidId(selectedUserId)) {
        return res.status(400).json({ success: false, message: "A valid teacher user account is required." });
      }
      body.user = selectedUserId;
      body.userId = selectedUserId;

      const user = await User.findById(selectedUserId).select("name email role isActive");
      if (!user) {
        return res.status(404).json({ success: false, message: "The selected user account does not exist." });
      }
      if (user.role !== "teacher") {
        return res.status(400).json({ success: false, message: "The selected user account must have the teacher role." });
      }
      if (user.isActive === false) {
        return res.status(400).json({ success: false, message: "The selected teacher user account is inactive." });
      }

      const existingProfile = await Teacher.findOne({ user: selectedUserId });
      if (existingProfile) {
        return res.status(400).json({ success: false, message: "This user account is already linked to a teacher profile." });
      }

      if (!body.department || typeof body.department !== "string" || !body.department.trim()) {
        return res.status(400).json({ success: false, message: "Department is required." });
      }

      body.name = user.name;
      body.email = user.email;
      body.department = body.department.trim();
      body.specialization = body.specialization ? String(body.specialization).trim() : "";

      // Ensure server securely generates Teacher ID, preventing manual tampering
      delete body.teacherId;
      body.teacherId = await Teacher.generateNextTeacherId();

      try {
        const record = await Teacher.create(body);
        return res.status(201).json({ success: true, data: record });
      } catch (err) {
        if (err?.code === 11000) {
          if (err.keyPattern?.user || err.message?.includes("user")) {
            return res.status(400).json({ success: false, message: "This user account already has a teacher profile." });
          }
          if (err.keyPattern?.teacherId || err.message?.includes("teacherId")) {
            body.teacherId = await Teacher.generateNextTeacherId();
            const retryRecord = await Teacher.create(body);
            return res.status(201).json({ success: true, data: retryRecord });
          }
        }
        throw err;
      }
    }

    const referenceError = await validateEntityReferences(modelName, body, undefined, {
      requireActiveTeacher: modelName === "courses" && Boolean(body.teacher),
    });
    if (referenceError) {
      return res.status(400).json({ success: false, message: referenceError });
    }
    if (req.user.role === "teacher" && ["attendance", "performance"].includes(modelName)) {
      const teacher = await Teacher.findOne({ user: req.user._id }).select("_id");
      const course = teacher && isValidId(body.course)
        ? await Course.findOne({ _id: body.course, teacher: teacher._id }).select("enrolledStudents")
        : null;
      if (!course || !course.enrolledStudents.some((studentId) => studentId.equals(body.student))) {
        return res.status(403).json({
          success: false,
          message: "You can only record academic data for students enrolled in your assigned courses.",
        });
      }
    }
    if (modelName === "datasets") body.uploadedBy = req.user._id;
    if (modelName === "courses") delete body.enrolledStudents;
    await inferAcademicPeriod(modelName, body);
    if (modelName === "support") {
      body.user = req.user._id;
      body.status = "open";
    }
    let record;
    try {
      record = await models[modelName].create(body);
    } catch (error) {
      if (modelName === "courses" && error?.code === 11000 && error.keyPattern?.courseCode) {
        return res.status(409).json({ success: false, message: "Course code already exists." });
      }
      throw error;
    }
    res.status(201).json({ success: true, data: record });
  });
}

export function updateEntity(modelName) {
  return asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid record ID." });
    }
    const filter = await scopedFilter(req, modelName);
    const record = await models[modelName].findOne({ $and: [{ _id: req.params.id }, filter] });
    if (!record) return res.status(404).json({ success: false, message: "Record not found." });
    const changes = { ...req.body };
    delete changes._id;
    delete changes.__v;
    delete changes.user;
    delete changes.userId;
    delete changes.uploadedBy;
    if (modelName === "teachers") {
      delete changes.teacherId;
      delete changes.name;
      delete changes.email;
      if (changes.department !== undefined && (!changes.department || typeof changes.department !== "string" || !changes.department.trim())) {
        return res.status(400).json({ success: false, message: "Department is required." });
      }
      if (changes.department) changes.department = changes.department.trim();
      if (changes.specialization !== undefined) changes.specialization = String(changes.specialization).trim();
    }
    if (modelName === "courses") delete changes.enrolledStudents;
    if (req.user.role === "teacher") {
      delete changes.student;
      delete changes.course;
    }
    if (modelName === "support" && !["admin", "teacher"].includes(req.user.role)) {
      delete changes.status;
      delete changes.priority;
    }
    const referenceError = await validateEntityReferences(
      modelName,
      { ...record.toObject(), ...changes },
      record._id,
      {
        requireActiveTeacher:
          modelName === "courses" &&
          changes.teacher !== undefined &&
          String(changes.teacher || "") !== String(record.teacher || ""),
      },
    );
    if (referenceError) {
      return res.status(400).json({ success: false, message: referenceError });
    }
    const updatedPeriod = { ...record.toObject(), ...changes };
    await inferAcademicPeriod(modelName, updatedPeriod);
    for (const key of ["academicYear", "semester"]) {
      if (updatedPeriod[key] !== record[key]) changes[key] = updatedPeriod[key];
    }
    Object.assign(record, changes);
    try {
      await record.save();
    } catch (error) {
      if (modelName === "courses" && error?.code === 11000 && error.keyPattern?.courseCode) {
        return res.status(409).json({ success: false, message: "Course code already exists." });
      }
      throw error;
    }
    res.json({ success: true, data: record });
  });
}

export function deleteEntity(modelName) {
  return asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid record ID." });
    }
    if (["students", "teachers", "courses"].includes(modelName)) {
      const dependencies = {
        students: [
          Enrollment.exists({ student: req.params.id }),
          Attendance.exists({ student: req.params.id }),
          Performance.exists({ student: req.params.id }),
          Prediction.exists({ student: req.params.id }),
        ],
        teachers: [Course.exists({ teacher: req.params.id })],
        courses: [
          Enrollment.exists({ course: req.params.id }),
          Attendance.exists({ course: req.params.id }),
          Performance.exists({ course: req.params.id }),
        ],
      };
      if ((await Promise.all(dependencies[modelName])).some(Boolean)) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete this ${modelName.slice(0, -1)} while related academic records exist. Remove those records first.`,
        });
      }
    }
    const filter = await scopedFilter(req, modelName);
    const record = await models[modelName].findOneAndDelete({
      $and: [{ _id: req.params.id }, filter],
    });
    if (!record) return res.status(404).json({ success: false, message: "Record not found." });
    res.json({ success: true, message: "Record deleted." });
  });
}

export const markAlertRead = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid alert ID." });
  }
  const filter = await scopedFilter(req, "alerts");
  const alert = await Alert.findOneAndUpdate(
    { $and: [{ _id: req.params.id }, filter] },
    { isRead: true },
    { new: true, runValidators: true },
  );
  if (!alert) return res.status(404).json({ success: false, message: "Alert not found." });
  res.json({ success: true, data: alert });
});
