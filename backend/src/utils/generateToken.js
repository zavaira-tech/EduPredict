import jwt from "jsonwebtoken";

export default function generateToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace_with_") || secret === "your_secure_jwt_secret") {
    throw new Error("JWT_SECRET must be configured before issuing tokens.");
  }
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion ?? 0 },
    secret,
    {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
}
