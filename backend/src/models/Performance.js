import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    assignmentScore: { type: Number, min: 0, max: 100, default: 0 },
    quizScore: { type: Number, min: 0, max: 100, default: 0 },
    midtermScore: { type: Number, min: 0, max: 100, default: 0 },
    finalScore: { type: Number, min: 0, max: 100, default: 0 },
    totalScore: { type: Number, min: 0, max: 100, default: 0 },
    grade: { type: String, trim: true },
    gpa: { type: Number, min: 0, max: 4 },
    semester: { type: Number, min: 1 },
  },
  { timestamps: true },
);

export default mongoose.model("Performance", performanceSchema);
