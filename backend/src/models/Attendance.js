import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["Present", "Absent", "Late"], required: true },
    percentage: { type: Number, min: 0, max: 100 },
    academicYear: { type: String, trim: true, maxlength: 20 },
    semester: { type: Number, min: 1 },
  },
  { timestamps: true },
);

attendanceSchema.index({ student: 1, course: 1, date: -1 });
attendanceSchema.index({ course: 1, academicYear: 1, semester: 1 });

export default mongoose.model("Attendance", attendanceSchema);
