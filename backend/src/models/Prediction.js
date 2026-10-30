import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    predictionType: {
      type: String,
      enum: ["performance", "dropout", "courseDemand"],
      required: true,
    },
    prediction: { type: String, required: true, trim: true },
    probability: { type: Number, min: 0, max: 1, required: true },
    riskLevel: { type: String, trim: true },
    recommendation: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model("Prediction", predictionSchema);
