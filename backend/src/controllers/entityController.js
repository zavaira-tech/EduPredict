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

async function scopedFilter(req, modelName) {
  const user = req.user;
  if (user.role === "admin" || user.role === "analyst") return {};

  if (user.role === "student") {
    const profile = await Student.findOne({ user: user._id }).select("_id");
    const studentId = profile?._id;
    if (modelName === "students") return studentId ? { _id: studentId } : { _id: null };
    if (modelName === "courses") return studentId ? { enrolledStudents: studentId } : { _id: null };
    if (["attendance", "performance", "predictions", "alerts"].includes(modelName)) {
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

async function validateEntityReferences(modelName, fields, recordId) {
  if (["students", "teachers"].includes(modelName) && fields.user) {
    if (!isValidId(fields.user)) return "A valid user account ID is required.";
    const expectedRole = modelName === "students" ? "student" : "teacher";
    const [user, existingProfile] = await Promise.all([
      User.findOne({ _id: fields.user, role: expectedRole }).select("_id"),
      models[modelName].exists({
        user: fields.user,
        ...(recordId ? { _id: { $ne: recordId } } : {}),
      }),
    ]);
    if (!user) return `The linked user account must have the ${expectedRole} role.`;
    if (existingProfile) return "This user account is already linked to a profile.";
  }
  if (modelName === "courses" && fields.teacher) {
    if (!isValidId(fields.teacher) || !(await Teacher.exists({ _id: fields.teacher }))) {
      return "The selected teacher record does not exist.";
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
    const record = await query;
    if (!record) return res.status(404).json({ success: false, message: "Record not found." });
    res.json({ success: true, data: record });
  });
}

export function createEntity(modelName) {
  return asyncHandler(async (req, res) => {
    const body = { ...req.body };
    const referenceError = await validateEntityReferences(modelName, body);
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
    if (modelName === "support") {
      body.user = req.user._id;
      body.status = "open";
    }
    const record = await models[modelName].create(body);
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
    delete changes.uploadedBy;
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
    );
    if (referenceError) {
      return res.status(400).json({ success: false, message: referenceError });
    }
    Object.assign(record, changes);
    await record.save();
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
    const record = await models[modelName].findByIdAndDelete(req.params.id);
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
