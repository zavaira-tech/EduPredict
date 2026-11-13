import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose, { connectToDatabase } from "./config/db.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/authRoutes.js";
import guestRouter from "./routes/guestRoutes.js";
import apiRouter from "./routes/apiRoutes.js";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const configuredOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith(".vercel.app") || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return true;
    }
  } catch {
    // Ignore invalid origin URL format
  }
  if (process.env.VERCEL === "1") return true;
  return false;
};

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const port = Number(process.env.PORT || 5000);
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.startsWith("replace_with_") ||
  process.env.JWT_SECRET === "your_secure_jwt_secret"
) {
  throw new Error("JWT_SECRET must contain at least 32 random characters in backend/.env.");
}
process.env.JWT_EXPIRES_IN ||= "7d";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const hasMongoUri =
  typeof mongoUri === "string" &&
  mongoUri.length > 0 &&
  !mongoUri.includes("<URL_ENCODED_PASSWORD>") &&
  !mongoUri.includes("<DB_PASSWORD>");

if (hasMongoUri) {
  try {
    await connectToDatabase(mongoUri);
    console.log(`MongoDB connected successfully (database: ${mongoose.connection.name}).`);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UnknownError";
    console.error(
      `Unable to connect to MongoDB (${reason}). Guest sessions remain available; registered-user and academic-data APIs require a working MongoDB connection. Credentials are not shown.`,
    );
    try {
      await mongoose.disconnect();
    } catch (cleanupError) {
      const cleanupReason =
        cleanupError instanceof Error ? cleanupError.name : "UnknownError";
      console.error(`MongoDB cleanup failed (${cleanupReason}).`);
    }
  }
} else {
  console.warn(
    "MONGODB_URI is missing or still contains a template password. Guest sessions remain available; registered-user and academic-data APIs require MongoDB.",
  );
}

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`EduPredict API listening on http://localhost:${port}`);
  });
}

export default app;
