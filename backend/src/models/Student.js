import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    department: { type: String, trim: true, default: "Not assigned" },
    program: { type: String, trim: true, default: "Not assigned" },
    semester: { type: Number, min: 1, default: 1 },
    gender: { type: String, trim: true, default: null },
    age: { type: Number, min: 1, max: 120, default: null },
    attendancePercentage: { type: Number, min: 0, max: 100, default: 0 },
    gpa: { type: Number, min: 0, max: 4, default: null },
    academicStatus: { type: String, trim: true, default: "Active" },
    enrollmentDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

studentSchema.index({ department: 1, semester: 1 });
studentSchema.index({ user: 1 }, { unique: true, sparse: true });

// Static method to generate next sequential unique Student ID: STU-YYYY-0001
studentSchema.statics.generateNextStudentId = async function (targetYear) {
  const year = targetYear || new Date().getUTCFullYear();
  const prefix = `STU-${year}-`;
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  const students = await this.find({ studentId: regex }, { studentId: 1 }).lean();
  let maxNum = 0;
  for (const s of students) {
    const match = s.studentId?.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
};

// Auto-generate studentId pre-validation if not provided
studentSchema.pre("validate", async function (next) {
  if (this.isNew && !this.studentId) {
    this.studentId = await this.constructor.generateNextStudentId();
  }
  next();
});

export default mongoose.model("Student", studentSchema);
