import mongoose from "mongoose";

const datasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, trim: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    fileSize: { type: Number, min: 0, default: 0 },
    mimeType: { type: String, trim: true },
    records: { type: Number, min: 0, default: 0 },
    status: { type: String, default: "uploaded", trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

datasetSchema.index({ uploadedBy: 1, createdAt: -1 });

export default mongoose.model("Dataset", datasetSchema);
