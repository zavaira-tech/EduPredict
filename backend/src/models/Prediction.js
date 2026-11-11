import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: function studentRequired() {
        return this.predictionType !== "courseDemand";
      },
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: function courseRequired() {
        return this.predictionType === "courseDemand";
      },
    },
    predictionType: {
      type: String,
      enum: ["performance", "dropout", "courseDemand"],
      required: true,
    },
    prediction: { type: String, required: true, trim: true },
    predictedValue: { type: mongoose.Schema.Types.Mixed },
    predictedGrade: { type: String, trim: true },
    probability: { type: Number, min: 0, max: 1 },
    confidence: { type: Number, min: 0, max: 1 },
    riskLevel: { type: String, trim: true },
    recommendation: { type: String, trim: true },
    recommendations: [{ type: String, trim: true }],
    modelVersion: { type: String, trim: true },
    modelName: { type: String, trim: true },
    featuresUsed: [{ type: String, trim: true }],
    explanation: [{ type: mongoose.Schema.Types.Mixed }],
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model("Prediction", predictionSchema);
