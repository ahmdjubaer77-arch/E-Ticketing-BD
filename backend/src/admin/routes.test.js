import test from "node:test";
import assert from "node:assert/strict";
import { createAuthMiddleware } from "../auth/middleware.js";

const config = {
  clientUrl: "http://localhost:5173",
  jwtSecret: "test-secret-with-at-least-32-characters",
  nodeEnv: "test",
};

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("admin authentication middleware rejects requests without a session cookie", async () => {
  const { requireAuth } = createAuthMiddleware(config);
  const response = mockResponse();

  await requireAuth({ cookies: {} }, response, (error) => {
    if (error) assert.fail(error);
    assert.fail("Unauthenticated requests must not reach protected admin handlers.");
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, "Authentication required.");
});

test("admin role middleware rejects non-administrators", () => {
  const { requireRole } = createAuthMiddleware(config);
  const response = mockResponse();

  requireRole("admin")({ user: { role: "user" } }, response, () => {
    assert.fail("Non-admin users must not reach protected admin handlers.");
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
});

test("admin role middleware allows administrators", () => {
  const { requireRole } = createAuthMiddleware(config);
  const response = mockResponse();
  let allowed = false;

  requireRole("admin")({ user: { role: "admin" } }, response, () => {
    allowed = true;
  });

  assert.equal(allowed, true);
});
