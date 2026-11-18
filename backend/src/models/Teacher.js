import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    teacherId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      alias: "userId",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
      default: "",
    },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Unique index to prevent duplicate teacherId
teacherSchema.index({ teacherId: 1 }, { unique: true });

// Unique constraint to prevent multiple teacher profiles for one user account
teacherSchema.index({ user: 1 }, { unique: true, sparse: true });

// Static method to generate next sequential unique Teacher ID: TCH-YYYY-0001
teacherSchema.statics.generateNextTeacherId = async function (targetYear) {
  const year = targetYear || new Date().getUTCFullYear();
  const prefix = `TCH-${year}-`;
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  const teachers = await this.find({ teacherId: regex }, { teacherId: 1 }).lean();
  let maxNum = 0;
  for (const t of teachers) {
    const match = t.teacherId?.match(regex);
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

// Auto-generate teacherId pre-validation if not provided
teacherSchema.pre("validate", async function (next) {
  if (this.isNew && !this.teacherId) {
    this.teacherId = await this.constructor.generateNextTeacherId();
  }
  next();
});

export default mongoose.model("Teacher", teacherSchema);
