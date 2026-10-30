import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    courseCode: { type: String, required: true, unique: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 1, max: 30 },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
    semester: { type: Number, required: true, min: 1 },
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  },
  { timestamps: true },
);

export default mongoose.model("Course", courseSchema);
