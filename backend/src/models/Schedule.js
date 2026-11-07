import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: "Operator", required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    transport: { type: String, enum: ["Bus", "Train", "Launch"], required: true },
    departureAt: { type: Date, required: true },
    arrivalAt: { type: Date, required: true },
    totalSeats: { type: Number, required: true, min: 1, max: 1000, validate: Number.isInteger },
    availableSeats: { type: Number, required: true, min: 0, max: 1000, validate: Number.isInteger },
    fare: { type: Number, required: true, min: 0, max: 100_000_000 },
    status: { type: String, enum: ["scheduled", "active", "completed", "cancelled"], default: "scheduled", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);

scheduleSchema.index({ vehicleId: 1, departureAt: 1, arrivalAt: 1, status: 1 });
scheduleSchema.index({ departureAt: 1, status: 1 });
scheduleSchema.index({ operatorId: 1, departureAt: -1 });
scheduleSchema.index({ routeId: 1, departureAt: -1 });

scheduleSchema.pre("validate", function validateScheduleTimes() {
  if (this.departureAt && this.arrivalAt && this.departureAt >= this.arrivalAt) {
    this.invalidate("arrivalAt", "Arrival time must be after departure time.");
  }
  if (Number.isInteger(this.availableSeats) && Number.isInteger(this.totalSeats) && this.availableSeats > this.totalSeats) {
    this.invalidate("availableSeats", "Available seats cannot exceed total seats.");
  }
});

const Schedule = mongoose.models.Schedule || mongoose.model("Schedule", scheduleSchema);

export default Schedule;
