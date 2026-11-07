import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { validatePaymentMethodInput } from "./payment-methods.js";

const validMethod = {
  name: "bKash",
  accountType: "personal",
  accountNumber: "01712345678",
  instructions: "Send the exact fare and enter the TrxID.",
  status: "active",
};

test("validates and normalizes admin-managed payment methods", () => {
  const { errors, values } = validatePaymentMethodInput({ ...validMethod, name: "  bKash  " }, { creating: true });
  assert.deepEqual(errors, {});
  assert.equal(values.name, "bKash");
  assert.equal(values.accountNumber, "01712345678");
});

test("rejects invalid payment methods and unsupported fields", () => {
  const { errors } = validatePaymentMethodInput({
    ...validMethod,
    accountNumber: "1",
    accountType: "unknown",
    status: "deleted",
    secret: "not allowed",
  }, { creating: true });
  assert.ok(errors.accountNumber);
  assert.ok(errors.accountType);
  assert.ok(errors.status);
  assert.match(errors.body, /Unsupported fields/);
});

test("validates partial payment method updates", () => {
  const { errors, values } = validatePaymentMethodInput({ accountNumber: "01987654321" });
  assert.deepEqual(errors, {});
  assert.deepEqual(values, { accountNumber: "01987654321" });
  assert.ok(validatePaymentMethodInput({}).errors.body);
  assert.equal(mongoose.isValidObjectId(new mongoose.Types.ObjectId().toString()), true);
});
