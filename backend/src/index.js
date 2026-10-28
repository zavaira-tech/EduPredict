import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectToDatabase } from "./config/database.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";

dotenv.config();

const { MONGO_URI, CORS_ORIGIN } = process.env;
const port = Number(process.env.PORT || 5000);

if (!MONGO_URI) {
  throw new Error("MONGO_URI is required. Create backend/.env from .env.example.");
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

if (!CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN is required. Create backend/.env from .env.example.");
}

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRouter);
app.use(notFoundHandler);
app.use(errorHandler);

try {
  await connectToDatabase(MONGO_URI);
  app.listen(port, () => {
    console.log(`EduPredict API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Unable to start EduPredict API:", error);
  process.exitCode = 1;
}
