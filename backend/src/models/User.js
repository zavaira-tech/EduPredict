import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ["admin", "teacher", "student", "analyst"],
      default: "student",
    },
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.methods.toJSON = function removePassword() {
  const user = this.toObject();
  delete user.password;
  delete user.tokenVersion;
  return user;
};

export default mongoose.model("User", userSchema);
