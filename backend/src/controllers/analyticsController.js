import Attendance from "../models/Attendance.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Performance from "../models/Performance.js";
import asyncHandler from "../middleware/asyncHandler.js";

function getRecentMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count + index + 1, 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleString("en", { month: "short", timeZone: "UTC" }),
    };
  });
}

export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const months = getRecentMonths();
  const startDate = new Date(`${months[0].key}-01T00:00:00.000Z`);
  const [attendance, performance, courses] = await Promise.all([
    Attendance.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } },
          records: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] },
          },
        },
      },
    ]),
    Performance.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
          averageScore: { $avg: "$totalScore" },
          averageGPA: { $avg: "$gpa" },
          records: { $sum: 1 },
        },
      },
    ]),
    Enrollment.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$course", enrollments: { $sum: 1 } } },
      { $sort: { enrollments: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: Course.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $project: {
          _id: 0,
          courseCode: "$course.courseCode",
          courseName: "$course.courseName",
          enrollments: 1,
        },
      },
    ]),
  ]);
  const attendanceByMonth = new Map(attendance.map((item) => [item._id, item]));
  const performanceByMonth = new Map(performance.map((item) => [item._id, item]));

  res.json({
    success: true,
    data: {
      attendanceTrend: months.map(({ key, label }) => {
        const month = attendanceByMonth.get(key);
        return {
          month: label,
          records: month?.records || 0,
          attendanceRate: month?.records
            ? Number(((month.present / month.records) * 100).toFixed(1))
            : 0,
        };
      }),
      performanceTrend: months.map(({ key, label }) => {
        const month = performanceByMonth.get(key);
        return {
          month: label,
          averageScore: Number((month?.averageScore || 0).toFixed(1)),
          averageGPA: Number((month?.averageGPA || 0).toFixed(2)),
          records: month?.records || 0,
        };
      }),
      courseEnrollment: courses,
    },
  });
});
