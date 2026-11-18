import ActivityLog from "../models/ActivityLog.js";
import Alert from "../models/Alert.js";
import Attendance from "../models/Attendance.js";
import Course from "../models/Course.js";
import Dataset from "../models/Dataset.js";
import Enrollment from "../models/Enrollment.js";
import Notification from "../models/Notification.js";
import Performance from "../models/Performance.js";
import Prediction from "../models/Prediction.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { createNotification, recordActivity } from "../services/adminAudit.js";

const registeredRoles = ["admin", "teacher", "student", "analyst"];
const managedRoles = ["teacher", "analyst"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const objectIdPattern = /^[a-f\d]{24}$/i;
const pageSizeMaximum = 100;

function parsePage(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLimit(value, fallback = 20) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, pageSizeMaximum) : fallback;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validPassword(password) {
  return typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72;
}

function validName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 100;
}

function activeAdminFilter() {
  return { role: "admin", isActive: { $ne: false } };
}

export const getDashboardStats = asyncHandler(async (_req, res) => {
  const [
    byRole,
    totalUsers,
    activeUsers,
    totalDatasets,
    totalDatasetBytes,
    attendanceRecords,
    performanceRecords,
    enrollmentRecords,
  ] = await Promise.all([
    User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    User.countDocuments(),
    User.countDocuments({ isActive: { $ne: false } }),
    Dataset.countDocuments(),
    Dataset.aggregate([{ $group: { _id: null, bytes: { $sum: "$fileSize" } } }]),
    Attendance.countDocuments(),
    Performance.countDocuments(),
    Enrollment.countDocuments(),
  ]);
  const roleCounts = Object.fromEntries(byRole.map(({ _id, count }) => [_id, count]));

  res.json({
    success: true,
    data: {
      totalStudents: roleCounts.student || 0,
      totalTeachers: roleCounts.teacher || 0,
      totalAnalysts: roleCounts.analyst || 0,
      totalAdmins: roleCounts.admin || 0,
      totalUsers,
      activeUsers,
      totalDatasets,
      totalDatasetBytes: totalDatasetBytes[0]?.bytes || 0,
      totalAcademicRecords: attendanceRecords + performanceRecords + enrollmentRecords,
    },
  });
});

export const getDashboardCharts = asyncHandler(async (req, res) => {
  const daily = req.query.period === "daily";
  const now = new Date();
  const from = new Date(now);
  if (daily) from.setUTCDate(from.getUTCDate() - 29);
  else from.setUTCMonth(from.getUTCMonth() - 11, 1);
  from.setUTCHours(0, 0, 0, 0);
  const dateFormat = daily ? "%Y-%m-%d" : "%Y-%m";
  const groupByPeriod = (field) => ({
    $dateToString: { format: dateFormat, date: field, timezone: "UTC" },
  });

  const [
    studentRegistrations,
    userDistribution,
    performanceOverview,
    attendanceStatistics,
    dropoutRiskDistribution,
    academicPerformanceTrends,
    datasetUploadStatistics,
  ] = await Promise.all([
    User.aggregate([
      { $match: { role: "student", createdAt: { $gte: from } } },
      { $group: { _id: groupByPeriod("$createdAt"), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: "$_id", count: 1 } },
    ]),
    User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, role: "$_id", count: 1 } },
    ]),
    Performance.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$grade", "Ungraded"] },
          averageScore: { $avg: "$totalScore" },
          averageGpa: { $avg: "$gpa" },
          records: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, grade: "$_id", averageScore: 1, averageGpa: 1, records: 1 } },
    ]),
    Attendance.aggregate([
      {
        $group: {
          _id: "$status",
          records: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, status: "$_id", records: 1, averagePercentage: 1 } },
    ]),
    Prediction.aggregate([
      { $match: { predictionType: "dropout" } },
      {
        $group: {
          _id: { $ifNull: ["$riskLevel", "Unknown"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, riskLevel: "$_id", count: 1 } },
    ]),
    Performance.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: groupByPeriod("$createdAt"),
          averageScore: { $avg: "$totalScore" },
          averageGpa: { $avg: "$gpa" },
          records: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: "$_id", averageScore: 1, averageGpa: 1, records: 1 } },
    ]),
    Dataset.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: groupByPeriod("$createdAt"), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: "$_id", count: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      studentRegistrations,
      userDistribution,
      performanceOverview,
      attendanceStatistics,
      dropoutRiskDistribution,
      academicPerformanceTrends,
      datasetUploadStatistics,
      period: daily ? "daily" : "monthly",
    },
  });
});

export const listAdminUsers = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const query = {};
  const role = req.query.role;
  const status = req.query.status;
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";

  if (role && registeredRoles.includes(role)) query.role = role;
  if (status === "active") query.isActive = { $ne: false };
  if (status === "inactive") query.isActive = false;
  if (search) {
    const matcher = new RegExp(escapeRegex(search), "i");
    query.$or = [{ name: matcher }, { email: matcher }];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select("_id name email role isActive createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);
  res.json({
    success: true,
    data: users.map((user) => ({ ...user, isActive: user.isActive !== false })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getAdminUser = asyncHandler(async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid user ID." });
  }
  const user = await User.findById(req.params.id)
    .select("_id name email role isActive createdAt updatedAt")
    .lean();
  if (!user) return res.status(404).json({ success: false, message: "User not found." });

  const [student, teacher, activity] = await Promise.all([
    Student.findOne({ user: user._id }).select("_id studentId department program semester").lean(),
    Teacher.findOne({ user: user._id }).select("_id teacherId department specialization").lean(),
    ActivityLog.find({ actor: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  res.json({
    success: true,
    data: {
      ...user,
      isActive: user.isActive !== false,
      academicProfile: student || teacher || null,
      recentActivity: activity,
    },
  });
});

export const createAdminUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (
    !validName(name) ||
    typeof email !== "string" ||
    !emailPattern.test(email.trim()) ||
    !validPassword(password) ||
    !managedRoles.includes(role)
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid name, email, password, and teacher or analyst role are required.",
    });
  }

  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role,
  });
  await Promise.all([
    recordActivity({ actor: req.user, action: "user.created", entityType: "User", entityId: user._id, details: { role } }),
    createNotification({
      title: "User account created",
      message: `${user.name} was added as a ${role}.`,
      type: "user",
      entityType: "User",
      entityId: user._id,
      actor: req.user,
    }),
  ]);
  res.status(201).json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });
});

export const updateAdminUser = asyncHandler(async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid user ID." });
  }
  const { name, email, password, role } = req.body || {};
  if (
    (name !== undefined && !validName(name)) ||
    (email !== undefined && (typeof email !== "string" || !emailPattern.test(email.trim()))) ||
    (password !== undefined && !validPassword(password)) ||
    (role !== undefined && !registeredRoles.includes(role))
  ) {
    return res.status(400).json({ success: false, message: "Enter valid user details and role." });
  }
  if (name === undefined && email === undefined && password === undefined && role === undefined) {
    return res.status(400).json({ success: false, message: "Provide at least one field to update." });
  }

  const user = await User.findById(req.params.id).select("+tokenVersion");
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  if (user._id.equals(req.user._id) && role !== undefined && role !== "admin") {
    return res.status(400).json({ success: false, message: "You cannot remove your own administrator role." });
  }
  if (
    user.role === "admin" &&
    user.isActive !== false &&
    role !== undefined &&
    role !== "admin" &&
    await User.countDocuments(activeAdminFilter()) <= 1
  ) {
    return res.status(400).json({ success: false, message: "The last active administrator cannot be demoted." });
  }

  const changes = {};
  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) user.email = email.trim().toLowerCase();
  if (role !== undefined && role !== user.role) {
    user.role = role;
    changes.role = role;
  }
  if (password !== undefined) {
    user.password = password;
    changes.passwordReset = true;
  }
  if (role !== undefined || password !== undefined) {
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  }
  await user.save();
  await recordActivity({
    actor: req.user,
    action: "user.updated",
    entityType: "User",
    entityId: user._id,
    details: changes,
  });
  res.json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });
});

export const setAdminUserStatus = asyncHandler(async (req, res) => {
  if (!objectIdPattern.test(req.params.id) || typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({ success: false, message: "A valid user ID and isActive boolean are required." });
  }
  const user = await User.findById(req.params.id).select("+tokenVersion");
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  if (user._id.equals(req.user._id) && !req.body.isActive) {
    return res.status(400).json({ success: false, message: "You cannot deactivate your own administrator account." });
  }
  if (user.isActive === req.body.isActive) {
    return res.json({ success: true, data: { id: user._id, isActive: user.isActive } });
  }
  if (
    user.role === "admin" &&
    user.isActive !== false &&
    !req.body.isActive &&
    await User.countDocuments(activeAdminFilter()) <= 1
  ) {
    return res.status(400).json({ success: false, message: "The last active administrator cannot be deactivated." });
  }
  user.isActive = req.body.isActive;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await recordActivity({
    actor: req.user,
    action: req.body.isActive ? "user.activated" : "user.deactivated",
    entityType: "User",
    entityId: user._id,
    details: { role: user.role },
  });
  res.json({ success: true, data: { id: user._id, isActive: user.isActive } });
});

export const deleteAdminUser = asyncHandler(async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid user ID." });
  }
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: "You cannot delete your own account." });
  }
  const user = await User.findById(req.params.id).select("name role isActive");
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  if (
    user.role === "admin" &&
    user.isActive !== false &&
    await User.countDocuments(activeAdminFilter()) <= 1
  ) {
    return res.status(400).json({ success: false, message: "The last active administrator cannot be deleted." });
  }
  await recordActivity({
    actor: req.user,
    action: "user.deleted",
    entityType: "User",
    entityId: user._id,
    details: { name: user.name, role: user.role },
  });
  await user.deleteOne();
  await createNotification({
    title: "User account deleted",
    message: `${user.name}'s ${user.role} account was deleted.`,
    type: "user",
    entityType: "User",
    entityId: user._id,
    actor: req.user,
  });
  res.json({ success: true, message: "User deleted." });
});

export const listAdminTeachers = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const filter = {};
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const matcher = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), "i");
    filter.$or = [{ name: matcher }, { email: matcher }, { teacherId: matcher }, { department: matcher }];
  }
  const [teachers, total] = await Promise.all([
    Teacher.find(filter)
      .populate("user", "name email role isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Teacher.countDocuments(filter),
  ]);
  res.json({ success: true, data: teachers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const listAdminAnalysts = asyncHandler(async (req, res) => {
  req.query.role = "analyst";
  return listAdminUsers(req, res);
});

export const listAdminStudents = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const filter = {};
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  if (search) {
    const matcher = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: matcher }, { email: matcher }, { studentId: matcher }, { department: matcher }, { program: matcher }];
  }
  if (typeof req.query.department === "string" && req.query.department.trim()) {
    filter.department = req.query.department.trim().slice(0, 100);
  }
  if (req.query.performance === "low") filter.gpa = { $lt: 2.5 };
  if (req.query.performance === "high") filter.gpa = { $gte: 3 };
  if (req.query.performance === "medium") filter.gpa = { $gte: 2.5, $lt: 3 };
  if (req.query.course !== undefined) {
    if (!objectIdPattern.test(req.query.course)) {
      return res.status(400).json({ success: false, message: "Invalid course ID." });
    }
    const studentIds = await Enrollment.distinct("student", { course: req.query.course });
    filter._id = { $in: studentIds };
  }
  const [students, total] = await Promise.all([
    Student.find(filter)
      .populate("user", "name email role isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);
  res.json({ success: true, data: students, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getAdminStudent = asyncHandler(async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid student ID." });
  }
  const student = await Student.findById(req.params.id).populate("user", "name email role isActive");
  if (!student) return res.status(404).json({ success: false, message: "Student not found." });
  const [performance, attendance, predictions] = await Promise.all([
    Performance.find({ student: student._id }).populate("course", "courseCode courseName").sort({ createdAt: -1 }).limit(100).lean(),
    Attendance.find({ student: student._id }).populate("course", "courseCode courseName").sort({ date: -1 }).limit(100).lean(),
    Prediction.find({ student: student._id }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  res.json({ success: true, data: { student, performance, attendance, predictions } });
});

function getGridFsBucket() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error("MongoDB must be connected to access dataset files.");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "datasetFiles" });
}

function storeGridFsFile(bucket, file, userId) {
  const safeName = file.originalname.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "dataset";
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(safeName, {
      contentType: file.mimetype || "application/octet-stream",
      metadata: { uploadedBy: userId },
    });
    stream.once("error", reject);
    stream.once("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });
}

export const listAdminDatasets = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const filter = search
    ? { $or: [{ name: new RegExp(escapeRegex(search), "i") }, { fileName: new RegExp(escapeRegex(search), "i") }] }
    : {};
  const [datasets, total, storage] = await Promise.all([
    Dataset.find(filter)
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Dataset.countDocuments(filter),
    Dataset.aggregate([{ $group: { _id: null, bytes: { $sum: "$fileSize" } } }]),
  ]);
  res.json({
    success: true,
    data: datasets,
    storageBytes: storage[0]?.bytes || 0,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const uploadAdminDataset = asyncHandler(async (req, res) => {
  const { name, description = "" } = req.body || {};
  const file = req.file;
  if (!validName(name) || !file) {
    return res.status(400).json({ success: false, message: "A dataset name and file are required." });
  }
  if (name.trim().length > 120 || typeof description !== "string" || description.length > 1000) {
    return res.status(400).json({ success: false, message: "Enter a valid dataset name and description." });
  }

  const bucket = getGridFsBucket();
  const fileId = await storeGridFsFile(bucket, file, req.user._id);
  let dataset;
  try {
    dataset = await Dataset.create({
      name: name.trim(),
      description: description.trim(),
      fileName: file.originalname.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "dataset",
      fileType: file.originalname.split(".").pop().toLowerCase().slice(0, 20),
      fileId,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user._id,
    });
  } catch (error) {
    try {
      await bucket.delete(fileId);
    } catch (cleanupError) {
      console.error(`Unable to remove incomplete GridFS upload (${cleanupError instanceof Error ? cleanupError.name : "UnknownError"}).`);
    }
    throw error;
  }
  await Promise.all([
    recordActivity({
      actor: req.user,
      action: "dataset.uploaded",
      entityType: "Dataset",
      entityId: dataset._id,
      details: { fileName: dataset.fileName, fileSize: dataset.fileSize },
    }),
    createNotification({
      title: "Dataset uploaded",
      message: `${dataset.name} was uploaded by ${req.user.name}.`,
      type: "dataset",
      entityType: "Dataset",
      entityId: dataset._id,
      actor: req.user,
    }),
  ]);
  res.status(201).json({ success: true, data: dataset });
});

export const downloadAdminDataset = asyncHandler(async (req, res, next) => {
  if (!objectIdPattern.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid dataset ID." });
  }
  const dataset = await Dataset.findById(req.params.id).select("name fileName fileId mimeType");
  if (!dataset) return res.status(404).json({ success: false, message: "Dataset not found." });
  if (!dataset.fileId) {
    return res.status(404).json({ success: false, message: "This legacy dataset has no stored file." });
  }
  const bucket = getGridFsBucket();
  const file = await bucket.find({ _id: dataset.fileId }).next();
  if (!file) return res.status(404).json({ success: false, message: "Stored dataset file not found." });
  const encodedName = encodeURIComponent(dataset.fileName);
  res.setHeader("Content-Type", dataset.mimeType || file.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
  const stream = bucket.openDownloadStream(dataset.fileId);
  stream.once("error", next);
  stream.pipe(res);
});

export const deleteAdminDataset = asyncHandler(async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid dataset ID." });
  }
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: "Dataset not found." });
  await recordActivity({
    actor: req.user,
    action: "dataset.deleted",
    entityType: "Dataset",
    entityId: dataset._id,
    details: { name: dataset.name, fileName: dataset.fileName },
  });
  if (dataset.fileId) await getGridFsBucket().delete(dataset.fileId);
  await dataset.deleteOne();
  await createNotification({
    title: "Dataset deleted",
    message: `${dataset.name} was deleted by ${req.user.name}.`,
    type: "dataset",
    entityType: "Dataset",
    entityId: dataset._id,
    actor: req.user,
  });
  res.json({ success: true, message: "Dataset and stored file deleted." });
});

export const listAdminNotifications = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const [notifications, alerts, notificationCount, alertCount] = await Promise.all([
    Notification.find().populate("actor", "name email").sort({ createdAt: -1 }).limit(200).lean(),
    Alert.find().populate("student", "studentId name").sort({ createdAt: -1 }).limit(200).lean(),
    Notification.countDocuments(),
    Alert.countDocuments(),
  ]);
  const combined = [
    ...notifications.map((item) => ({ ...item, source: "notification" })),
    ...alerts.map((item) => ({ ...item, source: "alert", type: "risk" })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (page - 1) * limit;
  res.json({
    success: true,
    data: combined.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total: notificationCount + alertCount,
      pages: Math.ceil((notificationCount + alertCount) / limit),
    },
  });
});

export const updateAdminNotification = asyncHandler(async (req, res) => {
  const { source } = req.params;
  const { isRead } = req.body || {};
  if (!objectIdPattern.test(req.params.id) || typeof isRead !== "boolean" || !["alert", "notification"].includes(source)) {
    return res.status(400).json({ success: false, message: "A valid source, notification ID, and isRead value are required." });
  }
  const Model = source === "alert" ? Alert : Notification;
  const notification = await Model.findByIdAndUpdate(
    req.params.id,
    { isRead },
    { new: true, runValidators: true },
  );
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
  res.json({ success: true, data: notification });
});

export const listAdminActivity = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const [activity, total] = await Promise.all([
    ActivityLog.find()
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(),
  ]);
  res.json({ success: true, data: activity, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

