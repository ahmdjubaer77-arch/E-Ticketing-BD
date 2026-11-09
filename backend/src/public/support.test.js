import test from "node:test";
import assert from "node:assert/strict";
import { parseSupportRequest } from "./support.js";

const validRequest = {
  name: "  Ayesha  Rahman ",
  email: "AYESHA@example.com",
  bookingReference: "ET123456",
  topic: "Payment issue",
  message: "My payment is still pending. Please check the booking.",
};

test("support request input is normalized before sending", () => {
  const { errors, values } = parseSupportRequest(validRequest);
  assert.deepEqual(errors, {});
  assert.equal(values.name, "Ayesha Rahman");
  assert.equal(values.email, "ayesha@example.com");
});

test("support requests reject invalid email, topic, short message, and unexpected fields", () => {
  const { errors } = parseSupportRequest({ ...validRequest, email: "nope", topic: "Admin", message: "Short", isAdmin: true });
  assert.ok(errors.email);
  assert.ok(errors.topic);
  assert.ok(errors.message);
  assert.ok(errors.body);
});

test("support requests reject control characters in contact details", () => {
  const { errors } = parseSupportRequest({ ...validRequest, name: "Ayesha\nAdmin", bookingReference: "ET\u0000-1" });
  assert.ok(errors.name);
  assert.ok(errors.bookingReference);
});
