import mongoose from "mongoose";

const operatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    logo: { type: String, default: "", maxlength: 2048 },
    logoPublicId: { type: String, default: "", maxlength: 200, select: false },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 24 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    transport: { type: String, enum: ["Bus", "Train", "Launch", "Event"], required: true },
    status: { type: String, enum: ["active", "inactive", "pending"], default: "pending", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);

operatorSchema.index({ status: 1, transport: 1, createdAt: -1 });
operatorSchema.index({ name: 1 });

const Operator = mongoose.models.Operator || mongoose.model("Operator", operatorSchema);

export default Operator;
