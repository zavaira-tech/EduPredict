import { Router } from "express";
import {
  changePassword,
  login,
  logout,
  me,
  register,
  updateProfile,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, me);
router.post("/logout", authenticate, logout);
router.put("/profile", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);

export default router;
