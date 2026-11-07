import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "./app.js";

const developmentConfig = {
  clientUrl: "http://localhost:5173",
  adminClientUrl: "http://localhost:5174",
  nodeEnv: "development",
};

test("allows local development origins regardless of the Vite port", () => {
  for (const origin of [
    "http://localhost:5176",
    "http://127.0.0.1:8080",
    "http://[::1]:5174",
  ]) {
    assert.equal(isAllowedOrigin(origin, developmentConfig), true);
  }
  assert.equal(isAllowedOrigin(undefined, developmentConfig), true);
});

test("allows only configured origins in production", () => {
  const productionConfig = {
    clientUrl: "https://tickets.example.com",
    adminClientUrl: "https://admin.example.com",
    nodeEnv: "production",
  };
  assert.equal(isAllowedOrigin("https://tickets.example.com", productionConfig), true);
  assert.equal(isAllowedOrigin("https://admin.example.com", productionConfig), true);
  assert.equal(isAllowedOrigin("http://localhost:5176", productionConfig), false);
  assert.equal(isAllowedOrigin("https://other.example.com", productionConfig), false);
});

test("rejects malformed, non-loopback, and non-HTTP development origins", () => {
  for (const origin of [
    "not-an-origin",
    "http://localhost.evil.example:5176",
    "https://localhost:5176",
    "http://localhost:5176/path",
  ]) {
    assert.equal(isAllowedOrigin(origin, developmentConfig), false);
  }
});
