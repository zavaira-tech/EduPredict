import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

const GUEST_SESSION_TTL_SECONDS = 60 * 60;

export default function generateGuestToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace_with_") || secret === "your_secure_jwt_secret") {
    throw new Error("JWT_SECRET must be configured before issuing tokens.");
  }

  const guestId = randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    guestId,
    id: "guest-session",
    token: jwt.sign(
      { id: "guest-session", guestId, role: "guest", sessionType: "guest", iat: issuedAt },
      secret,
      { expiresIn: GUEST_SESSION_TTL_SECONDS },
    ),
    expiresAt: new Date((issuedAt + GUEST_SESSION_TTL_SECONDS) * 1000).toISOString(),
  };
}
