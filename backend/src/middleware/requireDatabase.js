import mongoose from "mongoose";

export default function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "The database is unavailable. Registered-user and academic-data services require MongoDB.",
    });
  }
  next();
}
