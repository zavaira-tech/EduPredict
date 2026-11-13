import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  DEMO_DATA_LABEL,
  guestAcademicOverview,
  guestAttendanceDemo,
  guestCourseDemandDemo,
  guestGradeDistribution,
  guestPerformanceDemo,
  guestPredictiveAnalyticsDemo,
  guestAnomalyDetectionDemo,
  guestPublicReports,
} from "../data/guestDemoData.js";

const router = Router();

// Guest routes allow public or authenticated guest and registered sessions
router.use(authenticate);

/**
 * GET /api/guest/dashboard
 * Returns the complete read-only guest demonstration dataset.
 * Guaranteed to operate statelessly without MongoDB queries or connections.
 */
router.get("/dashboard", (req, res) => {
  res.json({
    success: true,
    label: DEMO_DATA_LABEL,
    disclaimer: "Everything in this response is illustrative demo data. No real institutional or student records are queried.",
    data: {
      overview: guestAcademicOverview,
      performance: guestPerformanceDemo,
      gradeDistribution: guestGradeDistribution,
      attendance: guestAttendanceDemo,
      courseDemand: guestCourseDemandDemo,
      predictiveAnalytics: guestPredictiveAnalyticsDemo,
      anomalies: guestAnomalyDetectionDemo,
    },
  });
});

/**
 * GET /api/guest/reports
 * Returns public demonstration reports.
 */
router.get("/reports", (req, res) => {
  res.json({
    success: true,
    label: DEMO_DATA_LABEL,
    data: guestPublicReports,
  });
});

/**
 * GET /api/guest/reports/:id
 * Returns a specific demonstration report by ID.
 */
router.get("/reports/:id", (req, res) => {
  const report = guestPublicReports.find((item) => item.id === req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Demonstration report not found.",
    });
  }
  res.json({
    success: true,
    label: DEMO_DATA_LABEL,
    data: report,
  });
});

// Explicitly reject modifications to prevent accidental mutations
const rejectModification = (req, res) => {
  res.status(403).json({
    success: false,
    message: "Guest mode is strictly read-only. Modifications are not allowed.",
  });
};

router.post("*", rejectModification);
router.put("*", rejectModification);
router.delete("*", rejectModification);

export default router;
