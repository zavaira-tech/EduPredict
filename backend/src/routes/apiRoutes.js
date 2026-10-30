import { Router } from "express";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  markAlertRead,
  updateEntity,
} from "../controllers/entityController.js";
import { getSummary } from "../controllers/dashboardController.js";
import { getAnalyticsOverview } from "../controllers/analyticsController.js";
import {
  createEnrollment,
  deleteEnrollment,
  getEnrollment,
  listEnrollments,
  updateEnrollment,
} from "../controllers/enrollmentController.js";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles as allowRoles } from "../middleware/roleMiddleware.js";

const router = Router();
router.use(authenticate);
router.get("/dashboard/summary", allowRoles("admin", "analyst", "teacher", "student"), getSummary);
router.get("/analytics/overview", allowRoles("admin", "analyst"), getAnalyticsOverview);

const defineResource = (path, model, { read, create, update = create, remove, detail = true }) => {
  const route = Router();
  route.get("/", allowRoles(...read), listEntities(model));
  if (detail) route.get("/:id", allowRoles(...read), getEntity(model));
  if (create?.length) route.post("/", allowRoles(...create), createEntity(model));
  if (update?.length) route.put("/:id", allowRoles(...update), updateEntity(model));
  if (remove?.length) route.delete("/:id", allowRoles(...remove), deleteEntity(model));
  router.use(`/${path}`, route);
};

defineResource("students", "students", {
  read: ["admin", "teacher", "student"],
  create: ["admin"],
  update: ["admin"],
  remove: ["admin"],
});
defineResource("teachers", "teachers", {
  read: ["admin", "teacher"],
  create: ["admin"],
  update: ["admin"],
  remove: ["admin"],
});
defineResource("courses", "courses", {
  read: ["admin", "teacher", "student"],
  create: ["admin"],
  update: ["admin"],
  remove: ["admin"],
});
defineResource("attendance", "attendance", {
  read: ["admin", "teacher", "student", "analyst"],
  create: ["admin", "teacher"],
  update: ["admin", "teacher"],
  remove: ["admin"],
});
defineResource("performance", "performance", {
  read: ["admin", "teacher", "student", "analyst"],
  create: ["admin", "teacher"],
  update: ["admin", "teacher"],
  remove: ["admin"],
});

router.get(
  "/enrollments",
  allowRoles("admin", "teacher", "student", "analyst"),
  listEnrollments,
);
router.get(
  "/enrollments/:id",
  allowRoles("admin", "teacher", "student", "analyst"),
  getEnrollment,
);
router.post("/enrollments", allowRoles("admin"), createEnrollment);
router.put("/enrollments/:id", allowRoles("admin"), updateEnrollment);
router.delete("/enrollments/:id", allowRoles("admin"), deleteEnrollment);

const predictionRoutes = Router();
predictionRoutes.get("/", allowRoles("admin", "analyst", "teacher", "student"), listEntities("predictions"));
predictionRoutes.get("/:studentId", allowRoles("admin", "analyst", "teacher", "student"), listEntities("predictions"));
predictionRoutes.post("/", allowRoles("admin"), createEntity("predictions"));
router.use("/predictions", predictionRoutes);

defineResource("datasets", "datasets", {
  read: ["admin", "analyst"],
  create: ["admin"],
  update: [],
  remove: ["admin"],
  detail: false,
});
defineResource("alerts", "alerts", {
  read: ["admin", "teacher", "student", "analyst"],
  create: ["admin"],
  update: [],
  remove: ["admin"],
  detail: false,
});
router.put("/alerts/:id/read", allowRoles("admin", "teacher", "student"), markAlertRead);
defineResource("support", "support", {
  read: ["admin", "teacher", "student"],
  create: ["admin", "teacher", "student"],
  update: ["admin", "teacher", "student"],
  remove: [],
  detail: false,
});

router.get(
  "/users",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const users = await User.find().select("_id name email role createdAt").sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: users });
  }),
);
router.post(
  "/users",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      !["admin", "teacher", "student", "analyst"].includes(role)
    ) {
      return res.status(400).json({ success: false, message: "Name, valid email, password, and role are required." });
    }
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password, role });
    res.status(201).json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  }),
);
router.put(
  "/users/:id/role",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const roles = ["admin", "teacher", "student", "analyst"];
    if (!/^[a-f\d]{24}$/i.test(req.params.id) || !roles.includes(req.body?.role)) {
      return res.status(400).json({ success: false, message: "A valid user ID and role are required." });
    }
    const user = await User.findById(req.params.id).select("+tokenVersion");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user._id.equals(req.user._id) && req.body.role !== "admin") {
      return res.status(400).json({ success: false, message: "You cannot remove your own administrator role." });
    }
    if (user.role === "admin" && req.body.role !== "admin") {
      const admins = await User.countDocuments({ role: "admin" });
      if (admins <= 1) {
        return res.status(400).json({ success: false, message: "The last administrator cannot be demoted." });
      }
    }
    user.role = req.body.role;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    res.json({ success: true, data: user });
  }),
);
router.delete(
  "/users/:id",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }
    const user = await User.findById(req.params.id).select("role");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
      return res.status(400).json({ success: false, message: "The last administrator cannot be deleted." });
    }
    await user.deleteOne();
    res.json({ success: true, message: "User deleted." });
  }),
);

export default router;
