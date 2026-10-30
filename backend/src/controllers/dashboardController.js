import Alert from "../models/Alert.js";
import Attendance from "../models/Attendance.js";
import Performance from "../models/Performance.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Course from "../models/Course.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const getSummary = asyncHandler(async (req, res) => {
  if (req.user.role === "student") {
    const profile = await Student.findOne({ user: req.user._id }).select("_id");
    const studentId = profile?._id;
    const [courses, attendance, gpa, atRiskStudents, activeAlerts] = await Promise.all([
      studentId ? Course.countDocuments({ enrolledStudents: studentId }) : 0,
      studentId ? Attendance.countDocuments({ student: studentId }) : 0,
      studentId
        ? Performance.aggregate([
            { $match: { student: studentId } },
            { $group: { _id: null, average: { $avg: "$gpa" } } },
          ])
        : [],
      studentId ? Student.countDocuments({ _id: studentId, $or: [{ gpa: { $lt: 2.5 } }, { attendancePercentage: { $lt: 75 } }] }) : 0,
      studentId ? Alert.countDocuments({ student: studentId, isRead: false }) : 0,
    ]);
    return res.json({
      success: true,
      data: {
        students: Number(Boolean(studentId)),
        teachers: 0,
        courses,
        attendance,
        averageGPA: Number((gpa[0]?.average || 0).toFixed(2)),
        atRiskStudents,
        activeAlerts,
      },
    });
  }

  if (req.user.role === "teacher") {
    const profile = await Teacher.findOne({ user: req.user._id }).select("_id");
    const courses = profile ? await Course.find({ teacher: profile._id }).select("_id enrolledStudents") : [];
    const courseIds = courses.map((course) => course._id);
    const studentIds = [...new Set(courses.flatMap((course) => course.enrolledStudents.map(String)))];
    const [attendance, gpa, atRiskStudents, activeAlerts] = await Promise.all([
      Attendance.countDocuments({ course: { $in: courseIds }, student: { $in: studentIds } }),
      Performance.aggregate([
        { $match: { course: { $in: courseIds }, student: { $in: studentIds } } },
        { $group: { _id: null, average: { $avg: "$gpa" } } },
      ]),
      Student.countDocuments({
        _id: { $in: studentIds },
        $or: [{ gpa: { $lt: 2.5 } }, { attendancePercentage: { $lt: 75 } }],
      }),
      Alert.countDocuments({ student: { $in: studentIds }, isRead: false }),
    ]);
    return res.json({
      success: true,
      data: {
        students: studentIds.length,
        teachers: Number(Boolean(profile)),
        courses: courses.length,
        attendance,
        averageGPA: Number((gpa[0]?.average || 0).toFixed(2)),
        atRiskStudents,
        activeAlerts,
      },
    });
  }

  const [students, teachers, courses, attendance, gpa, atRiskStudents, activeAlerts] =
    await Promise.all([
      Student.countDocuments(),
      Teacher.countDocuments(),
      Course.countDocuments(),
      Attendance.countDocuments(),
      Performance.aggregate([{ $group: { _id: null, average: { $avg: "$gpa" } } }]),
      Student.countDocuments({
        $or: [{ gpa: { $lt: 2.5 } }, { attendancePercentage: { $lt: 75 } }],
      }),
      Alert.countDocuments({ isRead: false }),
    ]);

  res.json({
    success: true,
    data: {
      students,
      teachers,
      courses,
      attendance,
      averageGPA: Number((gpa[0]?.average || 0).toFixed(2)),
      atRiskStudents,
      activeAlerts,
    },
  });
});
