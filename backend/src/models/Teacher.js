import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    teacherId: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    department: { type: String, required: true, trim: true },
    specialization: { type: String, trim: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true },
);

export default mongoose.model("Teacher", teacherSchema);
