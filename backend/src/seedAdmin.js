import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import connectDB from "./config/db.js";
import User from "./models/User.js";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

function getSeedAdmin() {
  const name = (process.env.ADMIN_SEED_NAME || "EduPredict Admin").trim();
  const email = (process.env.ADMIN_SEED_EMAIL || "admin@edupredict.com").trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!name || name.length > 100) {
    throw new Error("ADMIN_SEED_NAME must be between 1 and 100 characters.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_SEED_EMAIL must be a valid email address.");
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new Error("Set ADMIN_SEED_PASSWORD to a password of 8 to 72 UTF-8 bytes.");
  }

  return { name, email, password };
}

async function seedAdmin() {
  const admin = getSeedAdmin();

  await connectDB();
  await User.init();

  const existingUser = await User.findOne({ email: admin.email }).select("_id role");
  if (existingUser) {
    console.log(
      existingUser.role === "admin"
        ? `Admin account ${admin.email} already exists. No changes made.`
        : `Account ${admin.email} already exists with role "${existingUser.role}". No changes made.`,
    );
    return;
  }

  const user = await User.create({
    name: admin.name,
    email: admin.email,
    password: admin.password,
    role: "admin",
  });
  console.log(`Created admin account ${user.email} (${user._id}).`);
}

try {
  await seedAdmin();
} catch (error) {
  if (error?.code === 11000) {
    console.log("An account with the configured admin email already exists. No duplicate was created.");
  } else {
    console.error(`Admin seed failed: ${error instanceof Error ? error.message : "Unknown error."}`);
    process.exitCode = 1;
  }
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
