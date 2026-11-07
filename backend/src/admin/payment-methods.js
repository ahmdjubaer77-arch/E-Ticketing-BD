import { Router } from "express";
import mongoose from "mongoose";
import { sanitizeText } from "../auth/security.js";
import PaymentMethod from "../models/PaymentMethod.js";

const fields = new Set(["name", "accountType", "accountNumber", "instructions", "status"]);
const accountTypes = new Set(["personal", "merchant", "agent", "bank"]);
const statuses = new Set(["active", "inactive"]);

export function validatePaymentMethodInput(body, { creating = false } = {}) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const unsupported = Object.keys(body).filter((key) => !fields.has(key));
  if (unsupported.length) errors.body = `Unsupported fields: ${unsupported.join(", ")}.`;

  const values = {};
  for (const field of ["name", "accountType", "accountNumber", "instructions", "status"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    if (field === "name") {
      values.name = sanitizeText(body.name).trim().replace(/\s+/g, " ");
      if (values.name.length < 2 || values.name.length > 80) errors.name = "Method name must be between 2 and 80 characters.";
    } else if (field === "accountType") {
      values.accountType = body.accountType;
      if (!accountTypes.has(values.accountType)) errors.accountType = "Choose Personal, Merchant, Agent, or Bank.";
    } else if (field === "accountNumber") {
      values.accountNumber = sanitizeText(body.accountNumber).trim();
      if (values.accountNumber.length < 4 || values.accountNumber.length > 40) {
        errors.accountNumber = "Account number must be between 4 and 40 characters.";
      }
    } else if (field === "instructions") {
      values.instructions = sanitizeText(body.instructions ?? "").trim();
      if (values.instructions.length > 300) errors.instructions = "Instructions must be 300 characters or fewer.";
    } else {
      values.status = body.status;
      if (!statuses.has(values.status)) errors.status = "Status must be active or inactive.";
    }
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one payment method field to update.";
  return { errors, values };
}

function paymentMethodResponse(method) {
  return {
    id: method._id.toString(),
    name: method.name,
    accountType: method.accountType,
    accountNumber: method.accountNumber,
    instructions: method.instructions,
    status: method.status,
    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  };
}

export function createAdminPaymentMethodsRouter() {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      const methods = await PaymentMethod.find().sort({ status: 1, name: 1, _id: 1 }).lean();
      return response.json({
        success: true,
        message: "Payment methods retrieved.",
        data: { paymentMethods: methods.map(paymentMethodResponse) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validatePaymentMethodInput(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the payment method details.", errors });
      }
      const method = await PaymentMethod.create(values);
      return response.status(201).json({
        success: true,
        message: "Payment method created.",
        data: { paymentMethod: paymentMethodResponse(method) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id", async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Payment method ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validatePaymentMethodInput(request.body);
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the payment method details.", errors });
      }
      const method = await PaymentMethod.findByIdAndUpdate(
        request.params.id,
        { $set: values },
        { new: true, runValidators: true },
      );
      if (!method) return response.status(404).json({ success: false, message: "Payment method not found." });
      return response.json({
        success: true,
        message: "Payment method updated.",
        data: { paymentMethod: paymentMethodResponse(method) },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
