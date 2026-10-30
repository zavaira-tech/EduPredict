import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model("Alert", alertSchema);
