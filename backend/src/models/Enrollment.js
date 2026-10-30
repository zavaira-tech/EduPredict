import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    academicYear: { type: String, required: true, trim: true, maxlength: 20 },
    semester: { type: Number, required: true, min: 1 },
    enrolledAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["active", "completed", "dropped"],
      default: "active",
    },
  },
  { timestamps: true },
);

enrollmentSchema.index(
  { student: 1, course: 1, academicYear: 1, semester: 1 },
  { unique: true },
);

export default mongoose.model("Enrollment", enrollmentSchema);
