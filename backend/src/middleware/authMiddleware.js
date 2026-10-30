import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "./asyncHandler.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "Authentication is not configured." });
  }
  try {
    const payload = jwt.verify(authorization.slice(7), secret);
    if (
      !payload ||
      typeof payload === "string" ||
      typeof payload.userId !== "string" ||
      !/^[a-f\d]{24}$/i.test(payload.userId) ||
      typeof payload.tokenVersion !== "number"
    ) {
      return res.status(401).json({ success: false, message: "Invalid authentication token." });
    }
    const user = await User.findById(payload.userId).select("_id name email role +tokenVersion");
    if (!user) {
      return res.status(401).json({ success: false, message: "User account no longer exists." });
    }
    if (payload.tokenVersion !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
    throw error;
  }
});
