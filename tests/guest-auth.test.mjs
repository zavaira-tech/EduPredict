import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import test from "node:test";
import jwt from "jsonwebtoken";
import apiRouter from "../backend/src/routes/apiRoutes.js";
import authRouter from "../backend/src/routes/authRoutes.js";
import generateGuestToken from "../backend/src/utils/generateGuestToken.js";
import {
  authenticate,
  authenticateRegistered,
} from "../backend/src/middleware/authMiddleware.js";
import { authorizeRoles } from "../backend/src/middleware/roleMiddleware.js";

const originalSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "guest-auth-test-secret-that-is-long-enough";

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("guest sessions use an expiring guest-only JWT without a database user", async () => {
  const { guestId, token, expiresAt } = generateGuestToken();
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.role, "guest");
  assert.equal(payload.sessionType, "guest");
  assert.equal(payload.guestId, guestId);
  assert.ok(payload.exp - payload.iat <= 60 * 60);
  assert.equal(new Date(expiresAt).toISOString(), expiresAt);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, guestId);
  assert.equal(req.user.name, "Guest visitor");
  assert.equal(req.user.role, "guest");
  assert.ok(req.user.expiresAt);
});

test("guest tokens are rejected by registered-user APIs", async () => {
  const { token } = generateGuestToken();
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;
  await authenticateRegistered(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("expired and malformed guest tokens receive 401", async () => {
  const expiredToken = jwt.sign(
    {
      guestId: "51d16c41-8406-472d-9fef-83e05fdb1dd7",
      role: "guest",
      sessionType: "guest",
      expiresIn: -1,
    },
    process.env.JWT_SECRET,
    { expiresIn: -1 },
  );
  const expiredResponse = createResponse();
  await authenticate(
    { headers: { authorization: `Bearer ${expiredToken}` } },
    expiredResponse,
    () => assert.fail("Expired token must not authenticate"),
  );
  assert.equal(expiredResponse.statusCode, 401);

  const malformedToken = jwt.sign(
    { guestId: "not-a-uuid", role: "guest", sessionType: "guest" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  const malformedResponse = createResponse();
  await authenticate(
    { headers: { authorization: `Bearer ${malformedToken}` } },
    malformedResponse,
    () => assert.fail("Malformed guest identity must not authenticate"),
  );
  assert.equal(malformedResponse.statusCode, 401);
});

test("guest role is not admitted by any registered-user role allowlist", () => {
  for (const role of ["admin", "teacher", "student", "analyst"]) {
    const req = { user: { role: "guest" } };
    const res = createResponse();
    let nextCalled = false;
    authorizeRoles(role)(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }
});

test("the guest API flow works while protected data APIs reject guest tokens", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use("/api", apiRouter);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const createResponse = await fetch(`${baseUrl}/auth/guest`, { method: "POST" });
  assert.equal(createResponse.status, 201);
  const session = await createResponse.json();
  assert.equal(session.message, "Guest session started successfully.");
  assert.equal(session.user.role, "guest");
  assert.equal(session.user.email, undefined);
  assert.ok(session.expiresAt);

  for (const [path, body] of [
    ["/auth/login", { email: "student@example.test", password: "example-password" }],
    ["/auth/register", { name: "Student", email: "new@example.test", password: "example-password" }],
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 503, `${path} requires a connected database`);
  }

  const authorization = { Authorization: `Bearer ${session.token}` };
  const identityResponse = await fetch(`${baseUrl}/auth/me`, { headers: authorization });
  assert.equal(identityResponse.status, 200);
  const identity = await identityResponse.json();
  assert.equal(identity.user.role, "guest");
  assert.ok(identity.expiresAt);

  for (const path of [
    "/dashboard/summary",
    "/students",
    "/datasets",
    "/ml/status",
    "/analytics/anomalies",
  ]) {
    const response = await fetch(`${baseUrl}${path}`, { headers: authorization });
    assert.equal(response.status, 403, `${path} should reject a guest session`);
  }

  const logoutResponse = await fetch(`${baseUrl}/auth/guest/logout`, {
    method: "POST",
    headers: authorization,
  });
  assert.equal(logoutResponse.status, 200);
});

test("the four registered roles remain admissible by their matching role checks", () => {
  for (const role of ["admin", "teacher", "student", "analyst"]) {
    const req = { user: { role } };
    const res = createResponse();
    let nextCalled = false;
    authorizeRoles(role)(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, `${role} should retain its existing role access`);
  }
});

test.after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});
