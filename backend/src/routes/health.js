import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    status: databaseConnected ? "healthy" : "degraded",
    server: "running",
    database: databaseConnected ? "connected" : "disconnected",
    guestAuth: "available",
    services: {
      guestMode: "available",
      guestDashboard: "available",
      publicDemoReports: "available",
      registeredAuth: databaseConnected ? "available" : "unavailable",
      academicData: databaseConnected ? "available" : "unavailable",
    },
  });
});

export default router;
