import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    department: { type: String, required: true, trim: true },
    program: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1 },
    gender: { type: String, trim: true },
    age: { type: Number, min: 1, max: 120 },
    attendancePercentage: { type: Number, min: 0, max: 100, default: 0 },
    gpa: { type: Number, min: 0, max: 4, default: 0 },
    academicStatus: { type: String, trim: true, default: "Active" },
    enrollmentDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("Student", studentSchema);
