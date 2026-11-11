import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import asyncHandler from "./asyncHandler.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveIdentity(req, res) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return null;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, message: "Authentication is not configured." });
    return null;
  }
  try {
    const payload = jwt.verify(authorization.slice(7), secret);
    if (
      payload &&
      typeof payload !== "string" &&
      payload.role === "guest" &&
      payload.sessionType === "guest" &&
      typeof payload.guestId === "string" &&
      uuidPattern.test(payload.guestId) &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.exp > payload.iat &&
      payload.exp - payload.iat <= 60 * 60 &&
      payload.userId === undefined
    ) {
      return {
        id: payload.guestId,
        name: "Guest visitor",
        role: "guest",
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      };
    }
    if (
      !payload ||
      typeof payload === "string" ||
      typeof payload.userId !== "string" ||
      !/^[a-f\d]{24}$/i.test(payload.userId) ||
      typeof payload.tokenVersion !== "number"
    ) {
      res.status(401).json({ success: false, message: "Invalid authentication token." });
      return null;
    }
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        success: false,
        message: "The database is unavailable. Registered-user authentication requires MongoDB.",
      });
      return null;
    }
    const user = await User.findById(payload.userId).select("_id name email role +tokenVersion");
    if (!user) {
      res.status(401).json({ success: false, message: "User account no longer exists." });
      return null;
    }
    if (payload.tokenVersion !== (user.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: "Invalid or expired token." });
      return null;
    }
    return user;
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      res.status(401).json({ success: false, message: "Invalid or expired token." });
      return null;
    }
    throw error;
  }
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const identity = await resolveIdentity(req, res);
  if (!identity) return;
  req.user = identity;
  next();
});

export const authenticateRegistered = asyncHandler(async (req, res, next) => {
  const identity = await resolveIdentity(req, res);
  if (!identity) return;
  if (identity.role === "guest") {
    return res.status(403).json({ success: false, message: "Guest sessions cannot access this endpoint." });
  }
  req.user = identity;
  next();
});

export const authenticateGuest = asyncHandler(async (req, res, next) => {
  const identity = await resolveIdentity(req, res);
  if (!identity) return;
  if (identity.role !== "guest") {
    return res.status(403).json({ success: false, message: "A guest session is required." });
  }
  req.user = identity;
  next();
});
