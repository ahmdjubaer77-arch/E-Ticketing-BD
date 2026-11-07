import { Router } from "express";
import PaymentMethod from "../models/PaymentMethod.js";

function publicPaymentMethodResponse(method) {
  return {
    id: method._id.toString(),
    name: method.name,
    accountType: method.accountType,
    accountNumber: method.accountNumber,
    instructions: method.instructions,
  };
}

export function createPublicPaymentMethodsRouter() {
  const router = Router();
  router.get("/", async (_request, response, next) => {
    try {
      const methods = await PaymentMethod.find({ status: "active" }).sort({ name: 1, _id: 1 }).lean();
      return response.json({
        success: true,
        message: "Available payment methods retrieved.",
        data: { paymentMethods: methods.map(publicPaymentMethodResponse) },
      });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
