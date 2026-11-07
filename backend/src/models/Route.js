import mongoose from "mongoose";

function normalizeLocation(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

const routeSchema = new mongoose.Schema(
  {
    departure: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    destination: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    departureKey: { type: String, required: true, select: false },
    destinationKey: { type: String, required: true, select: false },
    distanceKm: { type: Number, required: true, min: 0.1, max: 50_000 },
    estimatedDurationMinutes: { type: Number, required: true, min: 1, max: 10_080, validate: Number.isInteger },
    transport: { type: String, enum: ["Bus", "Train", "Launch", "Event"], required: true },
    startingFare: { type: Number, required: true, min: 0, max: 100_000_000 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);

routeSchema.pre("validate", function setLocationKeys() {
  if (this.departure) this.departureKey = normalizeLocation(this.departure);
  if (this.destination) this.destinationKey = normalizeLocation(this.destination);
});

routeSchema.index(
  { departureKey: 1, destinationKey: 1, transport: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
routeSchema.index({ status: 1, transport: 1, createdAt: -1 });
routeSchema.index({ departure: 1, destination: 1 });

const Route = mongoose.models.Route || mongoose.model("Route", routeSchema);

export default Route;
