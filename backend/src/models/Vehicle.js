import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    registrationNumber: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 20, unique: true },
    transport: { type: String, enum: ["Bus", "Train", "Launch"], required: true },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: "Operator", required: true, index: true },
    image: { type: String, default: "", maxlength: 2048 },
    imagePublicId: { type: String, default: "", maxlength: 200, select: false },
    seatCapacity: { type: Number, required: true, min: 1, max: 1000, validate: Number.isInteger },
    status: { type: String, enum: ["active", "inactive", "maintenance"], default: "active", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);

vehicleSchema.index({ status: 1, transport: 1, createdAt: -1 });
vehicleSchema.index({ name: 1 });

const Vehicle = mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
