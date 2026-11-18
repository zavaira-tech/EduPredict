import { Router } from "express";
import multer from "multer";
import {
  createAdminUser,
  deleteAdminDataset,
  deleteAdminUser,
  downloadAdminDataset,
  getAdminStudent,
  getAdminUser,
  getDashboardCharts,
  getDashboardStats,
  listAdminActivity,
  listAdminAnalysts,
  listAdminDatasets,
  listAdminNotifications,
  listAdminStudents,
  listAdminTeachers,
  listAdminUsers,
  setAdminUserStatus,
  updateAdminNotification,
  updateAdminUser,
  uploadAdminDataset,
} from "../controllers/adminController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { getAvailableTeacherUsers } from "../controllers/entityController.js";

const router = Router();
const allowedExtensions = new Set([".csv", ".tsv", ".json", ".xls", ".xlsx"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      callback(new Error("Unsupported dataset file type. Upload CSV, TSV, JSON, XLS, or XLSX."));
      return;
    }
    callback(null, true);
  },
});

function receiveDatasetFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
    if (error.message.startsWith("Unsupported dataset file type.")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  });
}

router.use(authorizeRoles("admin"));

router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/charts", getDashboardCharts);

router.get("/users", listAdminUsers);
router.get("/users/:id", getAdminUser);
router.post("/users", createAdminUser);
router.put("/users/:id", updateAdminUser);
router.patch("/users/:id/status", setAdminUserStatus);
router.delete("/users/:id", deleteAdminUser);

router.get("/teachers/available-users", getAvailableTeacherUsers);
router.get("/teachers", listAdminTeachers);
router.get("/analysts", listAdminAnalysts);
router.get("/students", listAdminStudents);
router.get("/students/:id", getAdminStudent);

router.get("/datasets", listAdminDatasets);
router.post("/datasets", receiveDatasetFile, uploadAdminDataset);
router.get("/datasets/:id/download", downloadAdminDataset);
router.delete("/datasets/:id", deleteAdminDataset);

router.get("/notifications", listAdminNotifications);
router.put("/notifications/:source/:id", updateAdminNotification);
router.get("/activity-logs", listAdminActivity);

export default router;
