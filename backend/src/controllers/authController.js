import bcrypt from "bcryptjs";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import generateToken from "../utils/generateToken.js";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});
const roles = ["admin", "teacher", "student", "analyst"];

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = "student" } = req.body || {};
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    typeof role !== "string" ||
    !roles.includes(role.toLowerCase())
  ) {
    return res.status(400).json({
      success: false,
      message: "Name, valid email, a password of 8 to 72 UTF-8 bytes, and a valid role are required.",
    });
  }
  if (role.toLowerCase() !== "student") {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  const user = await User.create({ name, email, password, role: "student" });
  return res.status(201).json({
    success: true,
    token: generateToken(user),
    user: publicUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password +tokenVersion");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }
  return res.json({ success: true, token: generateToken(user), user: publicUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

export const logout = asyncHandler(async (req, res) => {
  req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
  await req.user.save();
  res.json({ success: true, message: "Logged out successfully." });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body || {};
  if (name === undefined && email === undefined) {
    return res.status(400).json({ success: false, message: "Provide a name or email to update." });
  }
  if (
    (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 100)) ||
    (email !== undefined &&
      (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))
  ) {
    return res.status(400).json({ success: false, message: "Enter a valid name and email address." });
  }
  if (name !== undefined) req.user.name = name.trim();
  if (email !== undefined) req.user.email = email.trim().toLowerCase();
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 8 ||
    Buffer.byteLength(newPassword, "utf8") > 72
  ) {
    return res.status(400).json({
      success: false,
      message: "Current password and a new password of 8 to 72 UTF-8 bytes are required.",
    });
  }
  const user = await User.findById(req.user._id).select("+password +tokenVersion");
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ success: false, message: "Current password is incorrect." });
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return res.status(400).json({ success: false, message: "Choose a password different from your current password." });
  }
  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  res.json({ success: true, token: generateToken(user), user: publicUser(user) });
});
