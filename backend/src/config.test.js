import test from "node:test";
import assert from "node:assert/strict";
import { durationToMilliseconds, loadConfig } from "./config.js";

const validEnvironment = {
  MONGODB_URI: "mongodb://localhost:27017/e-ticketing",
  JWT_SECRET: "test-secret-with-at-least-32-characters",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "sender@example.com",
  SMTP_PASS: "test-password",
  SMTP_FROM_EMAIL: "sender@example.com",
};

test("loads configured JWT durations and secure production origin", () => {
  const config = loadConfig({
    ...validEnvironment,
    JWT_EXPIRES_IN: "30m",
    JWT_REMEMBER_ME_EXPIRES_IN: "14d",
    CLIENT_URL: "https://tickets.example.com",
    NODE_ENV: "production",
  });
  assert.equal(config.jwtMaxAge, 30 * 60 * 1000);
  assert.equal(config.jwtRememberMeMaxAge, 14 * 24 * 60 * 60 * 1000);
  assert.equal(config.clientUrl, "https://tickets.example.com");
});

test("rejects malformed or non-positive JWT expirations", () => {
  assert.throws(() => durationToMilliseconds("1 week"), /seconds, minutes, hours, or days/);
  assert.throws(() => durationToMilliseconds("0h"), /positive safe integers/);
  assert.throws(() => durationToMilliseconds("999999999999999999d"), /positive safe integers/);
});

test("requires HTTPS client origin in production", () => {
  assert.throws(
    () => loadConfig({ ...validEnvironment, NODE_ENV: "production", CLIENT_URL: "http://localhost:5173" }),
    /must use HTTPS/,
  );
});

test("supports a separately configured admin origin and optional Cloudinary credentials", () => {
  const config = loadConfig({
    ...validEnvironment,
    CLIENT_URL: "http://localhost:5173",
    ADMIN_CLIENT_URL: "http://localhost:5174",
    CLOUDINARY_CLOUD_NAME: "demo_cloud",
    CLOUDINARY_API_KEY: "123456",
    CLOUDINARY_API_SECRET: "test-cloudinary-secret",
  });
  assert.equal(config.adminClientUrl, "http://localhost:5174");
  assert.equal(config.cloudinary.cloudName, "demo_cloud");
});

test("requires complete Cloudinary configuration and secure admin origin in production", () => {
  assert.throws(() => loadConfig({
    ...validEnvironment,
    CLOUDINARY_CLOUD_NAME: "demo_cloud",
  }), /must all be configured together/);
  assert.throws(() => loadConfig({
    ...validEnvironment,
    NODE_ENV: "production",
    CLIENT_URL: "https://tickets.example.com",
    ADMIN_CLIENT_URL: "http://admin.example.com",
  }), /ADMIN_CLIENT_URL must use HTTPS/);
});
