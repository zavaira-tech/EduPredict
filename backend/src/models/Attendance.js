import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["Present", "Absent", "Late"], required: true },
    percentage: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true },
);

export default mongoose.model("Attendance", attendanceSchema);
