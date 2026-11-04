import mongoose from "mongoose";
import Anomaly from "../models/Anomaly.js";
import Attendance from "../models/Attendance.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Performance from "../models/Performance.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { classifyRisk, csvEscape, pearsonCorrelation, quantile } from "../utils/analytics.js";
import { getPythonCorrelation } from "../services/pythonAnalyticsClient.js";

const objectIdPattern = /^[a-f\d]{24}$/i;
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseFilters(query) {
  const filters = {};
  for (const key of ["course", "student"]) {
    if (query[key] !== undefined) {
      if (!objectIdPattern.test(query[key])) throw httpError(400, `Invalid ${key} ID.`);
      filters[key] = new mongoose.Types.ObjectId(query[key]);
    }
  }
  if (query.semester !== undefined) {
    const semester = Number(query.semester);
    if (!Number.isInteger(semester) || semester < 1) throw httpError(400, "Invalid semester.");
    filters.semester = semester;
  }
  if (query.academicYear !== undefined) {
    if (typeof query.academicYear !== "string" || query.academicYear.length > 20) {
      throw httpError(400, "Invalid academic year.");
    }
    filters.academicYear = query.academicYear;
  }
  if (query.department !== undefined) {
    if (typeof query.department !== "string" || query.department.trim().length > 100) {
      throw httpError(400, "Invalid department.");
    }
    filters.department = query.department.trim();
  }
  for (const [key, boundary] of [["from", "$gte"], ["to", "$lte"]]) {
    if (query[key] !== undefined) {
      const date = new Date(query[key]);
      if (Number.isNaN(date.getTime())) throw httpError(400, `Invalid ${key} date.`);
      filters.date ??= {};
      filters.date[boundary] = date;
    }
  }
  if (filters.date?.$gte && filters.date?.$lte && filters.date.$gte > filters.date.$lte) {
    throw httpError(400, "The start date must be before the end date.");
  }
  return filters;
}

async function getScope(user, filters) {
  let studentIds = null;
  let courseIds = null;

  if (user.role === "student") {
    const student = await Student.findOne({ user: user._id }).select("_id");
    studentIds = student ? [student._id] : [];
    courseIds = student
      ? await Enrollment.distinct("course", { student: student._id })
      : [];
  } else if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: user._id }).select("_id courses");
    if (!teacher) return { studentIds: [], courseIds: [] };
    const assigned = await Course.find({
      $or: [{ teacher: teacher._id }, { _id: { $in: teacher.courses } }],
    }).distinct("_id");
    courseIds = assigned;
    studentIds = assigned.length
      ? await Enrollment.distinct("student", { course: { $in: assigned } })
      : [];
  }

  if (filters.course) {
    const course = await Course.findById(filters.course).select("_id teacher");
    if (!course) throw httpError(400, "Course not found.");
    if (courseIds && !courseIds.some((id) => id.equals(course._id))) {
      throw httpError(403, "You do not have access to this course.");
    }
    courseIds = [course._id];
    if (user.role === "teacher") {
      studentIds = await Enrollment.distinct("student", { course: course._id });
    }
  }
  if (filters.department) {
    const departmentStudents = await Student.distinct("_id", { department: filters.department });
    studentIds = studentIds === null
      ? departmentStudents
      : studentIds.filter((id) => departmentStudents.some((match) => match.equals(id)));
  }
  if (filters.student) {
    if (studentIds && !studentIds.some((id) => id.equals(filters.student))) {
      throw httpError(403, "You do not have access to this student.");
    }
    const studentExists = await Student.exists({ _id: filters.student });
    if (!studentExists) throw httpError(400, "Student not found.");
    studentIds = [filters.student];
  }
  if (filters.academicYear || filters.semester) {
    const enrollmentFilters = {
      ...matchByIds("student", studentIds),
      ...matchByIds("course", courseIds),
      ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
      ...(filters.semester ? { semester: filters.semester } : {}),
    };
    const [enrolledStudents, enrolledCourses] = await Promise.all([
      Enrollment.distinct("student", enrollmentFilters),
      Enrollment.distinct("course", enrollmentFilters),
    ]);
    studentIds = studentIds === null
      ? enrolledStudents
      : studentIds.filter((id) => enrolledStudents.some((match) => match.equals(id)));
    courseIds = courseIds === null
      ? enrolledCourses
      : courseIds.filter((id) => enrolledCourses.some((match) => match.equals(id)));
  }
  return { studentIds, courseIds };
}

function matchByIds(field, ids) {
  return ids === null ? {} : { [field]: { $in: ids } };
}

function attendanceMatch(scope, filters) {
  return {
    ...matchByIds("student", scope.studentIds),
    ...matchByIds("course", scope.courseIds),
    ...(filters.date ? { date: filters.date } : {}),
    ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
    ...(filters.semester ? { semester: filters.semester } : {}),
  };
}

function performanceMatch(scope, filters) {
  return {
    ...matchByIds("student", scope.studentIds),
    ...matchByIds("course", scope.courseIds),
    ...(filters.semester ? { semester: filters.semester } : {}),
    ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
    ...(filters.date ? { createdAt: filters.date } : {}),
  };
}

function enrollmentMatch(scope, filters) {
  return {
    ...matchByIds("student", scope.studentIds),
    ...matchByIds("course", scope.courseIds),
    ...(filters.semester ? { semester: filters.semester } : {}),
    ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
    ...(filters.date ? { enrolledAt: filters.date } : {}),
  };
}

function performanceFilterStages(scope, filters, extraMatch = {}) {
  return [{ $match: { ...performanceMatch(scope, filters), ...extraMatch } }];
}

function attendanceFilterStages(scope, filters, extraMatch = {}) {
  return [{ $match: { ...attendanceMatch(scope, filters), ...extraMatch } }];
}

function studentPipeline(scope, filters) {
  const hasAcademicFilters = Boolean(filters.course || filters.semester || filters.date);
  const studentMatch = {
    ...matchByIds("_id", scope.studentIds),
    ...(filters.department ? { department: filters.department } : {}),
  };
  const perfExpr = [{ $eq: ["$student", "$$studentId"] }];
  const attendanceExpr = [{ $eq: ["$student", "$$studentId"] }];
  if (scope.courseIds !== null) {
    perfExpr.push({ $in: ["$course", scope.courseIds] });
    attendanceExpr.push({ $in: ["$course", scope.courseIds] });
  }
  if (filters.course) {
    perfExpr.push({ $eq: ["$course", filters.course] });
    attendanceExpr.push({ $eq: ["$course", filters.course] });
  }
  if (filters.semester) perfExpr.push({ $eq: ["$semester", filters.semester] });
  if (filters.academicYear) perfExpr.push({ $eq: ["$academicYear", filters.academicYear] });
  if (filters.semester) attendanceExpr.push({ $eq: ["$semester", filters.semester] });
  if (filters.academicYear) attendanceExpr.push({ $eq: ["$academicYear", filters.academicYear] });
  if (filters.date) {
    perfExpr.push({ $gte: ["$createdAt", filters.date.$gte || new Date(0)] });
    perfExpr.push({ $lte: ["$createdAt", filters.date.$lte || new Date("9999-12-31")] });
    attendanceExpr.push({ $gte: ["$date", filters.date.$gte || new Date(0)] });
    attendanceExpr.push({ $lte: ["$date", filters.date.$lte || new Date("9999-12-31")] });
  }
  return [
    { $match: studentMatch },
    {
      $lookup: {
        from: Performance.collection.name,
        let: { studentId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: perfExpr } } },
          {
            $group: {
              _id: null,
              averageGpa: { $avg: "$gpa" },
              averageScore: { $avg: "$totalScore" },
              finalScore: { $avg: "$finalScore" },
              failedCourses: { $addToSet: { $cond: [{ $lt: ["$totalScore", 50] }, "$course", null] } },
              records: { $sum: 1 },
            },
          },
          { $project: { averageGpa: 1, averageScore: 1, finalScore: 1, records: 1, failedCourses: { $size: { $setDifference: ["$failedCourses", [null]] } } } },
        ],
        as: "performanceSummary",
      },
    },
    {
      $lookup: {
        from: Performance.collection.name,
        let: { studentId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: perfExpr } } },
          { $sort: { createdAt: -1 } },
          { $limit: 6 },
          { $project: { _id: 0, score: "$totalScore", createdAt: 1 } },
        ],
        as: "recentScores",
      },
    },
    {
      $lookup: {
        from: Attendance.collection.name,
        let: { studentId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: attendanceExpr } } },
          {
            $group: {
              _id: null,
              records: { $sum: 1 },
              present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
              absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
            },
          },
        ],
        as: "attendanceSummary",
      },
    },
    {
      $addFields: {
        performanceSummary: { $arrayElemAt: ["$performanceSummary", 0] },
        attendanceSummary: { $arrayElemAt: ["$attendanceSummary", 0] },
      },
    },
    {
      $project: {
        studentId: "$_id",
        recordId: "$studentId",
        name: 1,
        department: 1,
        program: 1,
        semester: 1,
        enrollmentDate: 1,
        gpa: {
          $cond: [
            { $gt: [{ $ifNull: ["$performanceSummary.records", 0] }, 0] },
            "$performanceSummary.averageGpa",
            hasAcademicFilters ? null : { $cond: [{ $gt: ["$gpa", 0] }, "$gpa", null] },
          ],
        },
        averageScore: "$performanceSummary.averageScore",
        finalScore: "$performanceSummary.finalScore",
        failedCourses: { $ifNull: ["$performanceSummary.failedCourses", 0] },
        performanceRecords: { $ifNull: ["$performanceSummary.records", 0] },
        attendance: {
          $cond: [
            { $gt: [{ $ifNull: ["$attendanceSummary.records", 0] }, 0] },
            {
              $multiply: [
                { $divide: ["$attendanceSummary.present", "$attendanceSummary.records"] },
                100,
              ],
            },
            hasAcademicFilters
              ? null
              : { $cond: [{ $gt: ["$attendancePercentage", 0] }, "$attendancePercentage", null] },
          ],
        },
        attendanceRecords: { $ifNull: ["$attendanceSummary.records", 0] },
        absentRecords: { $ifNull: ["$attendanceSummary.absent", 0] },
        recentScores: 1,
      },
    },
  ];
}

function getPage(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw httpError(400, "Page must be positive and limit must be between 1 and 100.");
  }
  return { page, limit };
}

function riskFromRow(row) {
  const recent = row.recentScores || [];
  const midpoint = Math.ceil(recent.length / 2);
  const recentMean = recent.length > 1
    ? recent.slice(0, midpoint).reduce((sum, item) => sum + item.score, 0) / midpoint
    : null;
  const previous = recent.length > 1
    ? recent.slice(midpoint).reduce((sum, item) => sum + item.score, 0) / (recent.length - midpoint)
    : null;
  const risk = classifyRisk({
    attendance: row.attendance,
    gpa: row.gpa,
    failedCourses: row.failedCourses,
    declining: recentMean !== null && previous !== null && recentMean < previous,
  });
  return { ...risk, declining: recentMean !== null && previous !== null && recentMean < previous };
}

function riskScoreStage() {
  return {
    $addFields: {
      riskScore: {
        $add: [
          { $cond: [{ $and: [{ $ne: ["$attendance", null] }, { $lt: ["$attendance", 75] }] }, 2, 0] },
          { $cond: [{ $and: [{ $ne: ["$gpa", null] }, { $lt: ["$gpa", 2] }] }, 2, 0] },
          { $min: [2, { $ifNull: ["$failedCourses", 0] }] },
          {
            $let: {
              vars: {
                scores: {
                  $map: { input: { $ifNull: ["$recentScores", []] }, as: "record", in: "$$record.score" },
                },
              },
              in: {
                $cond: [
                  {
                    $and: [
                      { $gte: [{ $size: "$$scores" }, 4] },
                      { $lt: [{ $avg: { $slice: ["$$scores", 0, 3] } }, { $avg: { $slice: ["$$scores", 3, 3] } }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        ],
      },
    },
  };
}

function rounded(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function csvResponse(res, filename, headers, rows) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\uFEFF${content}`);
}

export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const [students, performance, attendance, courses, riskResult] = await Promise.all([
    Student.countDocuments({
      ...matchByIds("_id", scope.studentIds),
      ...(filters.department ? { department: filters.department } : {}),
    }),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $group: { _id: null, averageGpa: { $avg: "$gpa" }, averageScore: { $avg: "$totalScore" }, pass: { $sum: { $cond: [{ $gte: ["$totalScore", 50] }, 1, 0] } }, fail: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } }, records: { $sum: 1 } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      {
        $group: {
          _id: null,
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
    ]),
    Course.countDocuments({
      ...matchByIds("_id", scope.courseIds),
      ...(filters.department ? { department: filters.department } : {}),
    }),
    Student.aggregate([
      ...studentPipeline(scope, filters),
      {
        $facet: {
          risk: [
            riskScoreStage(),
            { $match: { riskScore: { $gte: 2 } } },
            { $count: "count" },
          ],
          studentSummary: [
            { $group: { _id: null, averageGpa: { $avg: "$gpa" }, averageAttendance: { $avg: "$attendance" } } },
          ],
        },
      },
    ]),
  ]);
  const performanceStats = performance[0] || {};
  const attendanceStats = attendance[0] || {};
  const studentSummary = riskResult[0]?.studentSummary?.[0] || {};
  const passTotal = performanceStats.pass + performanceStats.fail || 0;
  const hasPeriodFilter = Boolean(filters.date || filters.course || filters.semester || filters.academicYear);
  res.json({
    success: true,
    data: {
      totalStudents: students,
      averageGpa: rounded(
        performanceStats.averageGpa ?? (hasPeriodFilter ? null : studentSummary.averageGpa),
        2,
      ),
      averageAttendance: attendanceStats.records
        ? rounded((attendanceStats.present / attendanceStats.records) * 100)
        : rounded(hasPeriodFilter ? null : studentSummary.averageAttendance),
      passPercentage: passTotal ? rounded((performanceStats.pass / passTotal) * 100) : null,
      failPercentage: passTotal ? rounded((performanceStats.fail / passTotal) * 100) : null,
      atRiskStudents: riskResult[0]?.risk?.[0]?.count || 0,
      totalCourses: courses,
      academicPerformanceScore: rounded(performanceStats.averageScore),
      recordCounts: {
        performance: performanceStats.records || 0,
        attendance: attendanceStats.records || 0,
      },
    },
  });
});

export const getStudentAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const { page, limit } = getPage(req.query);
  const pipeline = studentPipeline(scope, filters);
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    pipeline.push({ $match: { $or: [{ name: { $regex: escaped, $options: "i" } }, { recordId: { $regex: escaped, $options: "i" } }, { department: { $regex: escaped, $options: "i" } }] } });
  }
  const [result] = await Student.aggregate([
    ...pipeline,
    { $sort: { name: 1 } },
    { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], metadata: [{ $count: "total" }] } },
  ]);
  const total = result.metadata[0]?.total || 0;
  res.json({
    success: true,
    data: {
      students: result.data.map((row) => ({ ...row, risk: riskFromRow(row) })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

export const getAtRiskStudents = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const { page, limit } = getPage(req.query);
  const [result] = await Student.aggregate([
    ...studentPipeline(scope, filters),
    riskScoreStage(),
    { $match: { riskScore: { $gte: 2 } } },
    { $sort: { riskScore: -1, failedCourses: -1, name: 1 } },
    { $facet: {
      students: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      metadata: [{ $count: "total" }],
    } },
  ]);
  const students = result.students.map((row) => ({ ...row, risk: riskFromRow(row) }));
  const total = result.metadata[0]?.total || 0;
  res.json({
    success: true,
    data: {
      students,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      methodology: "Preliminary rule-based indicator: attendance below 75%, GPA below 2.00, failed course scores below 50%, and recent score decline. It is not a validated prediction and must not be used to penalize students.",
    },
  });
});

export const getPerformanceAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const [summary, grades, semesterTrend, coursePerformance, departmentPerformance] = await Promise.all([
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $group: { _id: null, assignment: { $avg: "$assignmentScore" }, quiz: { $avg: "$quizScore" }, midterm: { $avg: "$midtermScore" }, final: { $avg: "$finalScore" }, overall: { $avg: "$totalScore" }, gpa: { $avg: "$gpa" }, pass: { $sum: { $cond: [{ $gte: ["$totalScore", 50] }, 1, 0] } }, fail: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } }, records: { $sum: 1 } } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $group: { _id: { $ifNull: ["$grade", "Ungraded"] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, grade: "$_id", count: 1 } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $group: { _id: "$semester", averageGpa: { $avg: "$gpa" }, averageScore: { $avg: "$totalScore" }, count: { $sum: 1 }, pass: { $sum: { $cond: [{ $gte: ["$totalScore", 50] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, semester: "$_id", averageGpa: { $round: ["$averageGpa", 2] }, averageScore: { $round: ["$averageScore", 1] }, records: "$count", passPercentage: { $round: [{ $multiply: [{ $divide: ["$pass", "$count"] }, 100] }, 1] } } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $lookup: { from: Course.collection.name, localField: "course", foreignField: "_id", as: "course" } },
      { $unwind: "$course" },
      { $group: { _id: "$course._id", courseCode: { $first: "$course.courseCode" }, courseName: { $first: "$course.courseName" }, averageScore: { $avg: "$totalScore" }, averageGpa: { $avg: "$gpa" }, records: { $sum: 1 }, failed: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } } } },
      { $sort: { averageScore: 1 } },
      { $project: { _id: 0, courseId: "$_id", courseCode: 1, courseName: 1, averageScore: { $round: ["$averageScore", 1] }, averageGpa: { $round: ["$averageGpa", 2] }, records: 1, failPercentage: { $round: [{ $multiply: [{ $divide: ["$failed", "$records"] }, 100] }, 1] } } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      { $group: { _id: "$student.department", averageScore: { $avg: "$totalScore" }, averageGpa: { $avg: "$gpa" }, records: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, department: "$_id", averageScore: { $round: ["$averageScore", 1] }, averageGpa: { $round: ["$averageGpa", 2] }, records: 1 } },
    ]),
  ]);
  const stats = summary[0] || {};
  const graded = stats.pass + stats.fail || 0;
  res.json({
    success: true,
    data: {
      summary: {
        assignmentScore: rounded(stats.assignment),
        quizScore: rounded(stats.quiz),
        midtermScore: rounded(stats.midterm),
        finalScore: rounded(stats.final),
        overallScore: rounded(stats.overall),
        averageGpa: rounded(stats.gpa, 2),
        passPercentage: graded ? rounded((stats.pass / graded) * 100) : null,
        failPercentage: graded ? rounded((stats.fail / graded) * 100) : null,
        records: stats.records || 0,
      },
      gradeDistribution: grades,
      semesterTrend,
      coursePerformance,
      departmentPerformance,
    },
  });
});

export const getAttendanceAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const [summary, daily, weekly, monthly, courseAttendance, departmentAttendance, students] = await Promise.all([
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      {
        $group: {
          _id: null,
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
        },
      },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "UTC" } },
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", records: 1, attendance: { $round: [{ $multiply: [{ $divide: ["$present", "$records"] }, 100] }, 1] } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      {
        $group: {
          _id: { $dateToString: { format: "%G-W%V", date: "$date", timezone: "UTC" } },
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, week: "$_id", records: 1, attendance: { $round: [{ $multiply: [{ $divide: ["$present", "$records"] }, 100] }, 1] } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } },
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: "$_id", records: 1, attendance: { $round: [{ $multiply: [{ $divide: ["$present", "$records"] }, 100] }, 1] } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      {
        $group: {
          _id: "$course",
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
      { $lookup: { from: Course.collection.name, localField: "_id", foreignField: "_id", as: "course" } },
      { $unwind: "$course" },
      { $sort: { records: 1 } },
      { $project: { _id: 0, courseId: "$_id", courseCode: "$course.courseCode", courseName: "$course.courseName", records: 1, attendance: { $round: [{ $multiply: [{ $divide: ["$present", "$records"] }, 100] }, 1] } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      {
        $group: {
          _id: "$student.department",
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, department: "$_id", records: 1, attendance: { $round: [{ $multiply: [{ $divide: ["$present", "$records"] }, 100] }, 1] } } },
    ]),
    Student.aggregate([
      ...studentPipeline(scope, filters),
      { $project: { recordId: 1, name: 1, department: 1, attendance: 1, attendanceRecords: 1, absentRecords: 1 } },
      { $sort: { attendance: 1 } },
    ]),
  ]);
  const stats = summary[0] || {};
  res.json({
    success: true,
    data: {
      summary: {
        records: stats.records || 0,
        attendance: stats.records ? rounded((stats.present / stats.records) * 100) : null,
        absent: stats.absent || 0,
      },
      daily,
      weekly,
      monthly,
      courseAttendance,
      departmentAttendance,
      students: students.map((student) => ({
        ...student,
        atRisk: Number.isFinite(student.attendance) && student.attendance < 75,
      })),
    },
  });
});

export const getCourseAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const courseMatch = {
    ...matchByIds("_id", scope.courseIds),
    ...(filters.department ? { department: filters.department } : {}),
  };
  const personalStudentFilter = req.user.role === "student"
    ? [{ $in: ["$student", scope.studentIds] }]
    : [];
  const courses = await Course.aggregate([
    { $match: courseMatch },
    {
      $lookup: {
        from: Enrollment.collection.name,
        let: { courseId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$course", "$$courseId"] },
                  ...personalStudentFilter,
                  ...(filters.academicYear ? [{ $eq: ["$academicYear", filters.academicYear] }] : []),
                  ...(filters.semester ? [{ $eq: ["$semester", filters.semester] }] : []),
                  ...(filters.date?.$gte ? [{ $gte: ["$enrolledAt", filters.date.$gte] }] : []),
                  ...(filters.date?.$lte ? [{ $lte: ["$enrolledAt", filters.date.$lte] }] : []),
                ],
              },
            },
          },
          { $group: { _id: null, enrollments: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
        ],
        as: "enrollmentStats",
      },
    },
    {
      $lookup: {
        from: Performance.collection.name,
        let: { courseId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$course", "$$courseId"] },
                  ...personalStudentFilter,
                  ...(filters.semester ? [{ $eq: ["$semester", filters.semester] }] : []),
                  ...(filters.academicYear ? [{ $eq: ["$academicYear", filters.academicYear] }] : []),
                  ...(filters.date?.$gte ? [{ $gte: ["$createdAt", filters.date.$gte] }] : []),
                  ...(filters.date?.$lte ? [{ $lte: ["$createdAt", filters.date.$lte] }] : []),
                ],
              },
            },
          },
          { $group: { _id: null, records: { $sum: 1 }, averageGpa: { $avg: "$gpa" }, failed: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } } } },
        ],
        as: "performanceStats",
      },
    },
    {
      $lookup: {
        from: Attendance.collection.name,
        let: { courseId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$course", "$$courseId"] },
                  ...personalStudentFilter,
                  ...(filters.semester ? [{ $eq: ["$semester", filters.semester] }] : []),
                  ...(filters.academicYear ? [{ $eq: ["$academicYear", filters.academicYear] }] : []),
                  ...(filters.date?.$gte ? [{ $gte: ["$date", filters.date.$gte] }] : []),
                  ...(filters.date?.$lte ? [{ $lte: ["$date", filters.date.$lte] }] : []),
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              records: { $sum: 1 },
              present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
            },
          },
        ],
        as: "attendanceStats",
      },
    },
    { $addFields: { enrollmentStats: { $arrayElemAt: ["$enrollmentStats", 0] }, performanceStats: { $arrayElemAt: ["$performanceStats", 0] }, attendanceStats: { $arrayElemAt: ["$attendanceStats", 0] } } },
    {
      $project: {
        _id: 0,
        courseId: "$_id",
        courseCode: 1,
        courseName: 1,
        department: 1,
        semester: 1,
        enrollments: { $ifNull: ["$enrollmentStats.enrollments", 0] },
        activeEnrollments: { $ifNull: ["$enrollmentStats.active", 0] },
        completions: { $ifNull: ["$enrollmentStats.completed", 0] },
        completionRate: {
          $cond: [
            { $gt: [{ $ifNull: ["$enrollmentStats.enrollments", 0] }, 0] },
            { $round: [{ $multiply: [{ $divide: ["$enrollmentStats.completed", "$enrollmentStats.enrollments"] }, 100] }, 1] },
            null,
          ],
        },
        averageGpa: { $round: ["$performanceStats.averageGpa", 2] },
        averageAttendance: {
          $cond: [
            { $gt: [{ $ifNull: ["$attendanceStats.records", 0] }, 0] },
            { $round: [{ $multiply: [{ $divide: ["$attendanceStats.present", "$attendanceStats.records"] }, 100] }, 1] },
            null,
          ],
        },
        failPercentage: {
          $cond: [
            { $gt: [{ $ifNull: ["$performanceStats.records", 0] }, 0] },
            { $round: [{ $multiply: [{ $divide: ["$performanceStats.failed", "$performanceStats.records"] }, 100] }, 1] },
            null,
          ],
        },
      },
    },
    { $sort: { enrollments: -1 } },
  ]);
  res.json({ success: true, data: courses });
});

export const getDepartmentAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const [studentStats, performanceStats, attendanceStats] = await Promise.all([
    Student.aggregate([
      { $match: { ...matchByIds("_id", scope.studentIds), ...(filters.department ? { department: filters.department } : {}) } },
      { $group: { _id: "$department", students: { $sum: 1 }, storedGpa: { $avg: "$gpa" }, storedAttendance: { $avg: "$attendancePercentage" } } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      ...(filters.department ? [{ $match: { "student.department": filters.department } }] : []),
      { $group: { _id: "$student.department", gpa: { $avg: "$gpa" }, pass: { $sum: { $cond: [{ $gte: ["$totalScore", 50] }, 1, 0] } }, fail: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      ...(filters.department ? [{ $match: { "student.department": filters.department } }] : []),
      {
        $group: {
          _id: "$student.department",
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const performanceByDepartment = new Map(performanceStats.map((item) => [item._id, item]));
  const attendanceByDepartment = new Map(attendanceStats.map((item) => [item._id, item]));
  const departments = studentStats.map((student) => {
    const performance = performanceByDepartment.get(student._id) || {};
    const attendance = attendanceByDepartment.get(student._id) || {};
    const graded = (performance.pass || 0) + (performance.fail || 0);
    return {
      department: student._id,
      students: student.students,
      averageGpa: rounded(
        performance.gpa ?? (
          filters.academicYear || filters.semester || filters.date || filters.course
            ? null
            : student.storedGpa
        ),
        2,
      ),
      averageAttendance: attendance.records
        ? rounded((attendance.present / attendance.records) * 100)
        : rounded(
          filters.academicYear || filters.semester || filters.date || filters.course
            ? null
            : student.storedAttendance,
        ),
      passPercentage: graded ? rounded((performance.pass / graded) * 100) : null,
      failPercentage: graded ? rounded((performance.fail / graded) * 100) : null,
    };
  });
  res.json({
    success: true,
    data: departments,
  });
});

export const getSemesterAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const [semesters, enrollments, attendance] = await Promise.all([
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $group: { _id: "$semester", averageGpa: { $avg: "$gpa" }, averageScore: { $avg: "$totalScore" }, records: { $sum: 1 }, pass: { $sum: { $cond: [{ $gte: ["$totalScore", 50] }, 1, 0] } }, fail: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    Enrollment.aggregate([
      { $match: enrollmentMatch(scope, filters) },
      { $group: { _id: "$semester", enrollment: { $sum: 1 } } },
    ]),
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      { $match: { semester: { $type: "number" } } },
      { $group: { _id: "$semester", records: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } } },
    ]),
  ]);
  const enrollmentBySemester = new Map(enrollments.map((entry) => [entry._id, entry.enrollment]));
  const attendanceBySemester = new Map(attendance.map((entry) => [entry._id, entry]));
  const semesterNumbers = [...new Set([
    ...semesters.map((item) => item._id),
    ...enrollments.map((item) => item._id),
    ...attendance.map((item) => item._id),
  ])].filter(Number.isFinite).sort((left, right) => left - right);
  const performanceBySemester = new Map(semesters.map((item) => [item._id, item]));
  res.json({
    success: true,
    data: semesterNumbers.map((semester) => {
      const performance = performanceBySemester.get(semester) || {};
      const attendanceStats = attendanceBySemester.get(semester);
      const graded = (performance.pass || 0) + (performance.fail || 0);
      return {
        semester,
        averageGpa: rounded(performance.averageGpa, 2),
        averageScore: rounded(performance.averageScore),
        averageAttendance: attendanceStats?.records
          ? rounded((attendanceStats.present / attendanceStats.records) * 100)
          : null,
        enrollment: enrollmentBySemester.get(semester) || 0,
        performanceRecords: performance.records || 0,
        attendanceRecords: attendanceStats?.records || 0,
        passPercentage: graded ? rounded((performance.pass / graded) * 100) : null,
        failPercentage: graded ? rounded((performance.fail / graded) * 100) : null,
      };
    }),
  });
});

export const getCorrelationAnalytics = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const [rows, scorePairs] = await Promise.all([
    Student.aggregate([
      ...studentPipeline(scope, filters),
      { $project: { attendance: 1, gpa: 1, finalScore: 1 } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $project: { _id: 0, assignmentScore: 1, quizScore: 1, finalScore: 1 } },
    ]),
  ]);
  const validRows = rows.filter((row) => Number.isFinite(row.attendance));
  const attendanceGpa = validRows.filter((row) => Number.isFinite(row.gpa));
  const attendanceFinal = validRows.filter((row) => Number.isFinite(row.finalScore));
  const pairedAssignmentFinal = scorePairs.filter(
    (row) => Number.isFinite(row.assignmentScore) && Number.isFinite(row.finalScore),
  );
  const pairedQuizFinal = scorePairs.filter(
    (row) => Number.isFinite(row.quizScore) && Number.isFinite(row.finalScore),
  );
  const [pythonGpa, pythonFinal, pythonAssignment, pythonQuiz] = await Promise.all([
    getPythonCorrelation(
      attendanceGpa.map((row) => row.attendance),
      attendanceGpa.map((row) => row.gpa),
    ),
    getPythonCorrelation(
      attendanceFinal.map((row) => row.attendance),
      attendanceFinal.map((row) => row.finalScore),
    ),
    getPythonCorrelation(
      pairedAssignmentFinal.map((row) => row.assignmentScore),
      pairedAssignmentFinal.map((row) => row.finalScore),
    ),
    getPythonCorrelation(
      pairedQuizFinal.map((row) => row.quizScore),
      pairedQuizFinal.map((row) => row.finalScore),
    ),
  ]);
  const explain = "Correlation describes association, not causation. It does not show that one measure causes another.";
  res.json({
    success: true,
    data: {
      sampleSize: rows.length,
      method: "Pearson correlation",
      explanation: explain,
      relationships: [
        { x: "Attendance (%)", y: "GPA", sampleSize: pythonGpa?.sampleSize ?? attendanceGpa.length, coefficient: pythonGpa?.coefficient ?? pearsonCorrelation(attendanceGpa.map((row) => [row.attendance, row.gpa])) },
        { x: "Attendance (%)", y: "Final score", sampleSize: pythonFinal?.sampleSize ?? attendanceFinal.length, coefficient: pythonFinal?.coefficient ?? pearsonCorrelation(attendanceFinal.map((row) => [row.attendance, row.finalScore])) },
        { x: "Assignment score", y: "Final score", sampleSize: pythonAssignment?.sampleSize ?? pairedAssignmentFinal.length, coefficient: pythonAssignment?.coefficient ?? pearsonCorrelation(pairedAssignmentFinal.map((row) => [row.assignmentScore, row.finalScore])) },
        { x: "Quiz score", y: "Final score", sampleSize: pythonQuiz?.sampleSize ?? pairedQuizFinal.length, coefficient: pythonQuiz?.coefficient ?? pearsonCorrelation(pairedQuizFinal.map((row) => [row.quizScore, row.finalScore])) },
      ],
      points: attendanceGpa.map((row) => ({ attendance: rounded(row.attendance), gpa: rounded(row.gpa, 2), finalScore: rounded(row.finalScore) })),
      unavailable: ["Course workload is not available in the current schema; course credits are not assumed to be a workload measure."],
    },
  });
});

export const getAnalyticsTrends = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5, 1);
  sixMonthsAgo.setUTCHours(0, 0, 0, 0);
  const dateRange = filters.date || { $gte: sixMonthsAgo };
  const [attendance, performance, enrollment] = await Promise.all([
    Attendance.aggregate([
      ...attendanceFilterStages(scope, filters, { date: dateRange }),
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } },
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters, { createdAt: dateRange }),
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } }, averageScore: { $avg: "$totalScore" }, averageGpa: { $avg: "$gpa" }, records: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Enrollment.aggregate([
      { $match: { ...enrollmentMatch(scope, filters), enrolledAt: dateRange } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$enrolledAt", timezone: "UTC" } }, enrollments: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const monthKeys = new Set([...attendance, ...performance, ...enrollment].map((item) => item._id));
  const keyList = [...monthKeys].sort();
  res.json({
    success: true,
    data: keyList.map((key) => {
      const a = attendance.find((entry) => entry._id === key);
      const p = performance.find((entry) => entry._id === key);
      const e = enrollment.find((entry) => entry._id === key);
      return {
        month: key,
        attendance: a?.records ? rounded((a.present / a.records) * 100) : null,
        averageScore: rounded(p?.averageScore),
        averageGpa: rounded(p?.averageGpa, 2),
        attendanceRecords: a?.records || 0,
        performanceRecords: p?.records || 0,
        newEnrollments: e?.enrollments || 0,
      };
    }),
  });
});

function severityFor(value, lowerFence, mean, standardDeviation) {
  const z = standardDeviation ? Math.abs((value - mean) / standardDeviation) : 0;
  return z >= 3 ? "High" : z >= 2 ? "Medium" : value < lowerFence ? "Medium" : "Low";
}

export const detectAnalyticsAnomalies = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query || {});
  const scope = await getScope(req.user, filters);
  const [students, courses, courseFailures] = await Promise.all([
    Student.aggregate([
      ...studentPipeline(scope, filters),
      { $project: { studentId: 1, name: 1, attendance: 1, gpa: 1, averageScore: 1, attendanceRecords: 1, absentRecords: 1, performanceRecords: 1, recentScores: 1 } },
    ]),
    Course.aggregate([
      { $match: { ...matchByIds("_id", scope.courseIds), ...(filters.department ? { department: filters.department } : {}) } },
      { $lookup: { from: Enrollment.collection.name, let: { courseId: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$course", "$$courseId"] }, { $eq: ["$status", "active"] }] } } }, { $count: "count" }], as: "enrollments" } },
      { $addFields: { enrollmentCount: { $ifNull: [{ $arrayElemAt: ["$enrollments.count", 0] }, 0] } } },
      { $project: { _id: 1, courseCode: 1, courseName: 1, enrollmentCount: 1 } },
    ]),
    Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      {
        $group: {
          _id: "$course",
          records: { $sum: 1 },
          failed: { $sum: { $cond: [{ $lt: ["$totalScore", 50] }, 1, 0] } },
        },
      },
      { $project: { _id: 1, records: 1, failPercentage: { $multiply: [{ $divide: ["$failed", "$records"] }, 100] } } },
    ]),
  ]);

  const attendanceValues = students.map((student) => student.attendance).filter(Number.isFinite).sort((a, b) => a - b);
  const scoreValues = students.map((student) => student.averageScore).filter(Number.isFinite).sort((a, b) => a - b);
  const enrollmentValues = courses.map((course) => course.enrollmentCount).sort((a, b) => a - b);
  const candidates = [];
  const detectedAt = new Date();
  const dayKey = detectedAt.toISOString().slice(0, 10);
  const attendanceQ1 = quantile(attendanceValues, 0.25);
  const attendanceQ3 = quantile(attendanceValues, 0.75);
  const attendanceLowerFence = attendanceQ1 === null
    ? null
    : attendanceQ1 - 1.5 * (attendanceQ3 - attendanceQ1);

  for (const student of students) {
    if (!student.performanceRecords) {
      candidates.push({
        anomalyType: "data-quality",
        entityType: "student",
        entityId: student.studentId,
        description: `${student.name} has no saved academic performance records in the selected scope.`,
        severity: "Low",
        detectionMethod: "Completeness rule (missing performance records)",
        measuredValue: 0,
        expectedRange: { minimum: 1, maximum: null },
        evidence: { studentId: student.recordId },
        metric: "missing-performance-records",
      });
    }
    if (!student.attendanceRecords) {
      candidates.push({
        anomalyType: "data-quality",
        entityType: "student",
        entityId: student.studentId,
        description: `${student.name} has no saved attendance records in the selected scope.`,
        severity: "Low",
        detectionMethod: "Completeness rule (missing attendance records)",
        measuredValue: 0,
        expectedRange: { minimum: 1, maximum: null },
        evidence: { studentId: student.recordId },
        metric: "missing-attendance-records",
      });
    }
    if (Number.isFinite(student.attendance) && student.attendance < 75) {
      candidates.push({
        anomalyType: "attendance",
        entityType: "student",
        entityId: student.studentId,
        description: `${student.name} has attendance below the 75% support threshold.`,
        severity: student.attendance < 50 ? "High" : "Medium",
        detectionMethod: "Rule-based threshold (<75% attendance)",
        measuredValue: student.attendance,
        expectedRange: { minimum: 75, maximum: 100 },
        evidence: { studentId: student.recordId, attendanceRecords: student.attendanceRecords },
        metric: "attendance-below-threshold",
      });
    }
    if (student.absentRecords >= 3 && Number.isFinite(student.attendance) && student.attendance < 75) {
      candidates.push({
        anomalyType: "attendance",
        entityType: "student",
        entityId: student.studentId,
        description: `${student.name} has repeated absences and attendance below 75%.`,
        severity: student.absentRecords >= 5 ? "High" : "Medium",
        detectionMethod: "Repeated-absence rule (at least 3 absences and attendance below 75%)",
        measuredValue: { absentRecords: student.absentRecords, attendance: rounded(student.attendance) },
        expectedRange: { maximumAbsences: 2, minimumAttendance: 75 },
        evidence: { studentId: student.recordId, attendanceRecords: student.attendanceRecords },
        metric: "repeated-absence-pattern",
      });
    }
    if (
      Number.isFinite(student.attendance) &&
      attendanceLowerFence !== null &&
      attendanceValues.length >= 4 &&
      student.attendance < attendanceLowerFence
    ) {
      candidates.push({
        anomalyType: "attendance",
        entityType: "student",
        entityId: student.studentId,
        description: `${student.name} has an attendance rate below the selected group's IQR lower fence.`,
        severity: "Medium",
        detectionMethod: "IQR lower fence",
        measuredValue: rounded(student.attendance),
        expectedRange: { minimum: rounded(attendanceLowerFence), maximum: 100 },
        evidence: { populationSize: attendanceValues.length, q1: rounded(attendanceQ1), q3: rounded(attendanceQ3) },
        metric: "attendance-iqr-outlier",
      });
    }
    const recentScores = student.recentScores || [];
    if (recentScores.length >= 6) {
      const recentAverage = recentScores.slice(0, 3).reduce((sum, item) => sum + item.score, 0) / 3;
      const previousAverage = recentScores.slice(3, 6).reduce((sum, item) => sum + item.score, 0) / 3;
      if (recentAverage <= previousAverage - 15) {
        candidates.push({
          anomalyType: "performance",
          entityType: "student",
          entityId: student.studentId,
          description: `${student.name} has a 15-point or greater decline between recent and preceding three-record moving averages.`,
          severity: recentAverage <= previousAverage - 25 ? "High" : "Medium",
          detectionMethod: "Moving average (3 most recent versus preceding 3 records)",
          measuredValue: { recentAverage: rounded(recentAverage), previousAverage: rounded(previousAverage) },
          expectedRange: { minimum: rounded(previousAverage - 14.9), maximum: 100 },
          evidence: { performanceRecords: student.performanceRecords },
          metric: "sudden-performance-drop",
        });
      }
    }
    if (Number.isFinite(student.averageScore) && scoreValues.length >= 4) {
      const q1 = quantile(scoreValues, 0.25);
      const q3 = quantile(scoreValues, 0.75);
      const lowerFence = q1 - 1.5 * (q3 - q1);
      const mean = scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length;
      const standardDeviation = Math.sqrt(scoreValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / scoreValues.length);
      if (student.averageScore < lowerFence || (standardDeviation > 0 && (student.averageScore - mean) / standardDeviation < -2)) {
        candidates.push({
          anomalyType: "performance",
          entityType: "student",
          entityId: student.studentId,
          description: `${student.name} has unusually low average performance compared with the filtered student group.`,
          severity: severityFor(student.averageScore, lowerFence, mean, standardDeviation),
          detectionMethod: "IQR lower fence and z-score (< -2)",
          measuredValue: rounded(student.averageScore),
          expectedRange: { minimum: rounded(lowerFence), maximum: 100 },
          evidence: { populationMean: rounded(mean), standardDeviation: rounded(standardDeviation, 2), performanceRecords: student.performanceRecords },
          metric: "low-average-score",
        });
      }
    }
  }
  if (courses.length >= 4) {
    const q1 = quantile(enrollmentValues, 0.25);
    const q3 = quantile(enrollmentValues, 0.75);
    const lowerFence = Math.max(0, q1 - 1.5 * (q3 - q1));
    const mean = enrollmentValues.reduce((sum, value) => sum + value, 0) / enrollmentValues.length;
    const standardDeviation = Math.sqrt(enrollmentValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / enrollmentValues.length);
    for (const course of courses) {
      if (course.enrollmentCount < lowerFence) {
        candidates.push({
          anomalyType: "course",
          entityType: "course",
          entityId: course._id,
          description: `${course.courseCode} has unusually low active enrollment compared with other courses in the selected scope.`,
          severity: "Low",
          detectionMethod: "IQR lower fence",
          measuredValue: course.enrollmentCount,
          expectedRange: { minimum: Math.ceil(lowerFence), maximum: null },
          evidence: { courseName: course.courseName, populationMean: rounded(mean), standardDeviation: rounded(standardDeviation, 2) },
          metric: "low-enrollment",
        });
      }
    }
  }
  const courseFailureById = new Map(courseFailures.map((item) => [item._id.toString(), item]));
  for (const course of courses) {
    const failure = courseFailureById.get(course._id.toString());
    if (failure?.records >= 4 && failure.failPercentage >= 50) {
      candidates.push({
        anomalyType: "course",
        entityType: "course",
        entityId: course._id,
        description: `${course.courseCode} has a failure rate of at least 50% across four or more performance records.`,
        severity: failure.failPercentage >= 75 ? "High" : "Medium",
        detectionMethod: "Rule-based course failure-rate threshold (>=50%, minimum 4 records)",
        measuredValue: rounded(failure.failPercentage),
        expectedRange: { maximum: 49.9 },
        evidence: { courseName: course.courseName, performanceRecords: failure.records },
        metric: "high-course-failure-rate",
      });
    }
  }

  for (const candidate of candidates) {
    const eventKey = [candidate.anomalyType, candidate.entityType, candidate.entityId.toString(), candidate.metric, dayKey].join(":");
    candidate.eventKey = eventKey;
    candidate.anomalyId = eventKey;
    candidate.detectedAt = detectedAt;
  }
  const eventKeys = candidates.map((candidate) => candidate.eventKey);
  const existing = eventKeys.length
    ? await Anomaly.find({ eventKey: { $in: eventKeys } }).select("eventKey status").lean()
    : [];
  const existingByKey = new Map(existing.map((anomaly) => [anomaly.eventKey, anomaly.status]));
  const activeCandidates = candidates.filter(
    (candidate) => !["Resolved", "Dismissed"].includes(existingByKey.get(candidate.eventKey)),
  );
  if (activeCandidates.length) {
    await Anomaly.bulkWrite(activeCandidates.map((anomaly) => ({
      updateOne: {
        filter: { eventKey: anomaly.eventKey },
        update: { $setOnInsert: anomaly },
        upsert: true,
      },
    })));
  }
  res.json({ success: true, data: { candidates: candidates.length, savedOrAlreadyActive: activeCandidates.length, checkedAt: detectedAt } });
});

export const listAnalyticsAnomalies = asyncHandler(async (req, res) => {
  const { page, limit } = getPage(req.query);
  const filter = {};
  if (req.query.severity !== undefined) {
    if (!["Low", "Medium", "High", "Critical"].includes(req.query.severity)) throw httpError(400, "Invalid severity.");
    filter.severity = req.query.severity;
  }
  if (req.query.status !== undefined) {
    if (!["New", "Reviewed", "Resolved", "Dismissed"].includes(req.query.status)) throw httpError(400, "Invalid status.");
    filter.status = req.query.status;
  }
  if (req.query.type !== undefined) {
    if (!["attendance", "performance", "course", "data-quality"].includes(req.query.type)) throw httpError(400, "Invalid anomaly type.");
    filter.anomalyType = req.query.type;
  }
  if (req.query.from || req.query.to) {
    filter.detectedAt = {};
    for (const [key, boundary] of [["from", "$gte"], ["to", "$lte"]]) {
      if (req.query[key]) {
        const date = new Date(req.query[key]);
        if (Number.isNaN(date.getTime())) throw httpError(400, `Invalid ${key} date.`);
        filter.detectedAt[boundary] = date;
      }
    }
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ description: { $regex: escaped, $options: "i" } }, { anomalyId: { $regex: escaped, $options: "i" } }];
  }
  const [anomalies, total] = await Promise.all([
    Anomaly.find(filter).populate("reviewedBy", "name email").sort({ detectedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Anomaly.countDocuments(filter),
  ]);
  res.json({ success: true, data: { anomalies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

export const getAnalyticsAnomaly = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid anomaly ID.");
  const anomaly = await Anomaly.findById(req.params.id).populate("reviewedBy", "name email");
  if (!anomaly) throw httpError(404, "Anomaly not found.");
  res.json({ success: true, data: anomaly });
});

export const updateAnalyticsAnomalyStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid anomaly ID.");
  const { status } = req.body || {};
  if (!["Reviewed", "Resolved", "Dismissed"].includes(status)) {
    throw httpError(400, "Status must be Reviewed, Resolved, or Dismissed.");
  }
  const anomaly = await Anomaly.findById(req.params.id);
  if (!anomaly) throw httpError(404, "Anomaly not found.");
  anomaly.status = status;
  anomaly.reviewedBy = req.user._id;
  anomaly.resolvedAt = ["Resolved", "Dismissed"].includes(status) ? new Date() : null;
  await anomaly.save();
  res.json({ success: true, data: anomaly });
});

export const exportAnalyticsCsv = asyncHandler(async (req, res) => {
  const type = req.params.type;
  if (type === "anomalies") {
    if (!["admin", "analyst"].includes(req.user.role)) {
      throw httpError(403, "You do not have permission to export anomaly records.");
    }
    const rows = await Anomaly.find({}).sort({ detectedAt: -1 }).limit(10000).lean();
    return csvResponse(res, "anomaly-report.csv",
      ["Anomaly ID", "Type", "Entity type", "Entity ID", "Severity", "Status", "Description", "Method", "Measured value", "Detected at"],
      rows.map((row) => [row.anomalyId, row.anomalyType, row.entityType, row.entityId, row.severity, row.status, row.description, row.detectionMethod, JSON.stringify(row.measuredValue), row.detectedAt?.toISOString()]),
    );
  }
  if (type === "at-risk-students") {
    const filters = parseFilters(req.query);
    const scope = await getScope(req.user, filters);
    const rows = await Student.aggregate([
      ...studentPipeline(scope, filters),
      riskScoreStage(),
      { $match: { riskScore: { $gte: 2 } } },
      { $sort: { riskScore: -1, name: 1 } },
      { $limit: 10000 },
    ]);
    const atRisk = rows.map((row) => ({ row, risk: riskFromRow(row) }));
    return csvResponse(res, "at-risk-students.csv",
      ["Student ID", "Name", "Department", "GPA", "Attendance", "Risk", "Risk score", "Factors"],
      atRisk.map(({ row, risk }) => [row.recordId, row.name, row.department, row.gpa, row.attendance, risk.level, risk.score, risk.factors.join("; ")]),
    );
  }
  const filters = parseFilters(req.query);
  const scope = await getScope(req.user, filters);
  if (type === "performance") {
    const rows = await Performance.aggregate([
      ...performanceFilterStages(scope, filters),
      { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      { $lookup: { from: Course.collection.name, localField: "course", foreignField: "_id", as: "course" } },
      { $unwind: "$course" },
      { $sort: { createdAt: -1 } },
      { $limit: 10000 },
      { $project: { _id: 0, studentId: "$student.studentId", student: "$student.name", department: "$student.department", courseCode: "$course.courseCode", course: "$course.courseName", semester: 1, assignmentScore: 1, quizScore: 1, midtermScore: 1, finalScore: 1, totalScore: 1, grade: 1, gpa: 1, createdAt: 1 } },
    ]);
    return csvResponse(res, "performance-report.csv",
      ["Student ID", "Student", "Department", "Course code", "Course", "Semester", "Assignment", "Quiz", "Midterm", "Final", "Total", "Grade", "GPA", "Recorded at"],
      rows.map((row) => [row.studentId, row.student, row.department, row.courseCode, row.course, row.semester, row.assignmentScore, row.quizScore, row.midtermScore, row.finalScore, row.totalScore, row.grade, row.gpa, row.createdAt?.toISOString()]),
    );
  }
  if (type === "attendance") {
    const rows = await Attendance.aggregate([
      ...attendanceFilterStages(scope, filters),
      { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      { $lookup: { from: Course.collection.name, localField: "course", foreignField: "_id", as: "course" } },
      { $unwind: "$course" },
      { $sort: { date: -1 } },
      { $limit: 10000 },
      { $project: { _id: 0, studentId: "$student.studentId", student: "$student.name", department: "$student.department", courseCode: "$course.courseCode", course: "$course.courseName", date: 1, status: 1 } },
    ]);
    return csvResponse(res, "attendance-report.csv",
      ["Student ID", "Student", "Department", "Course code", "Course", "Date", "Status"],
      rows.map((row) => [row.studentId, row.student, row.department, row.courseCode, row.course, row.date?.toISOString(), row.status]),
    );
  }
  if (type === "courses") {
    const projection = {
      _id: 0,
      courseCode: 1,
      courseName: 1,
      department: 1,
      credits: 1,
      semester: 1,
    };
    if (req.user.role !== "student") {
      projection.activeRosterCount = { $size: { $ifNull: ["$enrolledStudents", []] } };
    }
    const rows = await Course.aggregate([
      { $match: { ...matchByIds("_id", scope.courseIds), ...(filters.department ? { department: filters.department } : {}) } },
      { $sort: { courseCode: 1 } },
      { $limit: 10000 },
      { $project: projection },
    ]);
    const headers = ["Course code", "Course", "Department", "Credits", "Semester"];
    if (req.user.role !== "student") headers.push("Active roster count");
    return csvResponse(res, "course-report.csv",
      headers,
      rows.map((row) => [
        row.courseCode, row.courseName, row.department, row.credits, row.semester,
        ...(req.user.role !== "student" ? [row.activeRosterCount] : []),
      ]),
    );
  }
  if (type === "departments") {
    const rows = await Student.aggregate([
      ...studentPipeline(scope, filters),
      { $group: { _id: "$department", students: { $sum: 1 }, averageGpa: { $avg: "$gpa" }, averageAttendance: { $avg: "$attendance" } } },
      { $sort: { _id: 1 } },
      { $limit: 10000 },
    ]);
    return csvResponse(res, "department-report.csv",
      ["Department", "Students", "Average GPA", "Average attendance"],
      rows.map((row) => [row._id, row.students, rounded(row.averageGpa, 2), rounded(row.averageAttendance)]),
    );
  }
  throw httpError(400, "Supported CSV reports are anomalies, at-risk-students, performance, attendance, courses, and departments.");
});
