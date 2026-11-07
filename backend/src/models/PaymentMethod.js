import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    accountType: { type: String, enum: ["personal", "merchant", "agent", "bank"], default: "personal", required: true },
    accountNumber: { type: String, required: true, trim: true, minlength: 4, maxlength: 40 },
    instructions: { type: String, default: "", trim: true, maxlength: 300 },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  },
  { timestamps: true, strict: "throw" },
);

paymentMethodSchema.index({ status: 1, name: 1 });

const PaymentMethod = mongoose.models.PaymentMethod || mongoose.model("PaymentMethod", paymentMethodSchema);

export default PaymentMethod;
