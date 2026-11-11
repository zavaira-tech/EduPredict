import { Router } from "express";
import {
  changePassword,
  createGuestSession,
  login,
  logoutGuest,
  logout,
  me,
  register,
  updateProfile,
} from "../controllers/authController.js";
import { authenticate, authenticateGuest, authenticateRegistered } from "../middleware/authMiddleware.js";
import requireDatabase from "../middleware/requireDatabase.js";

const router = Router();

router.post("/register", requireDatabase, register);
router.post("/login", requireDatabase, login);
router.post("/guest", createGuestSession);
router.post("/guest/logout", authenticateGuest, logoutGuest);
router.get("/me", authenticate, me);
router.post("/logout", authenticateRegistered, logout);
router.put("/profile", authenticateRegistered, updateProfile);
router.put("/change-password", authenticateRegistered, changePassword);

export default router;
