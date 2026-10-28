import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose, { connectToDatabase } from "./config/db.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const { CORS_ORIGIN } = process.env;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const port = Number(process.env.PORT || 5000);

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Create backend/.env from .env.example.");
}

if (mongoUri.includes("<URL_ENCODED_PASSWORD>")) {
  throw new Error(
    "Replace the password placeholder in backend/.env with your URL-encoded database password.",
  );
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const app = express();

if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN }));
}
app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRouter);
app.use(notFoundHandler);
app.use(errorHandler);

try {
  await connectToDatabase(mongoUri);
  console.log(`MongoDB connected successfully (database: ${mongoose.connection.name}).`);
} catch (error) {
  const reason = error instanceof Error ? error.name : "UnknownError";
  console.error(
    `Unable to connect to MongoDB (${reason}). Check the Atlas URI, database user, Network Access IP list, and cluster status. Credentials are not shown.`,
  );
  try {
    await mongoose.disconnect();
  } catch (cleanupError) {
    const cleanupReason =
      cleanupError instanceof Error ? cleanupError.name : "UnknownError";
    console.error(`MongoDB cleanup failed (${cleanupReason}).`);
  }
  throw new Error("MongoDB connection failed; check the server environment configuration.");
}

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`EduPredict API listening on http://localhost:${port}`);
  });
}

export default app;
