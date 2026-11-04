import mongoose from "mongoose";

const anomalySchema = new mongoose.Schema(
  {
    anomalyId: { type: String, required: true, unique: true, trim: true },
    eventKey: { type: String, required: true, unique: true, trim: true },
    anomalyType: {
      type: String,
      required: true,
      enum: ["attendance", "performance", "course", "data-quality"],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ["student", "course", "attendance", "performance", "enrollment"],
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    severity: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High", "Critical"],
      index: true,
    },
    detectionMethod: { type: String, required: true, trim: true },
    measuredValue: { type: mongoose.Schema.Types.Mixed, required: true },
    expectedRange: { type: mongoose.Schema.Types.Mixed, default: null },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["New", "Reviewed", "Resolved", "Dismissed"],
      default: "New",
      index: true,
    },
    detectedAt: { type: Date, required: true, default: Date.now, index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

anomalySchema.index({ status: 1, severity: 1, detectedAt: -1 });
anomalySchema.index({ anomalyType: 1, entityType: 1, detectedAt: -1 });

export default mongoose.model("Anomaly", anomalySchema);
