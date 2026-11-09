import mongoose from "mongoose";

const paymentProofSchema = new mongoose.Schema(
  {
    paymentMethodId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod", required: true },
    paymentMethodName: { type: String, required: true, trim: true, maxlength: 80 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 40 },
    transactionId: { type: String, required: true, trim: true, maxlength: 100 },
    submittedAt: { type: Date, required: true },
    reviewStatus: { type: String, enum: ["submitted", "approved", "rejected"], default: "submitted", required: true },
    imageData: { type: Buffer, default: null, select: false },
    imageContentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp", null], default: null },
  },
  { _id: false, strict: "throw" },
);

const bookingSchema = new mongoose.Schema(
  {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Schedule", required: true, index: true },
    customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    customerEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    customerPhone: { type: String, trim: true, maxlength: 24, default: "" },
    operatorName: { type: String, required: true, trim: true, maxlength: 120 },
    departure: { type: String, required: true, trim: true, maxlength: 120 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    transport: { type: String, enum: ["Bus", "Train", "Launch"], required: true },
    departureAt: { type: Date, required: true },
    arrivalAt: { type: Date, required: true },
    farePerSeat: { type: Number, required: true, min: 0 },
    seatNumbers: { type: [String], required: true, validate: (seats) => seats.length > 0 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "completed", "expired"], default: "confirmed", required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending", required: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, default: null, index: true },
    publicAccessTokenHash: { type: String, default: null, select: false },
    paymentProof: { type: paymentProofSchema, default: null },
    ticketCode: { type: String, required: true, unique: true },
    tickets: {
      type: [{
        seatNumber: { type: String, required: true },
        passengerName: { type: String, trim: true, maxlength: 100, default: "" },
        ticketCode: { type: String, required: true },
        qrCode: { type: String, default: "", maxlength: 20_000 },
        status: { type: String, enum: ["active", "used"], default: "active", required: true },
      }],
      default: [],
    },
  },
  { timestamps: true, strict: "throw" },
);

bookingSchema.index(
  { scheduleId: 1, seatNumbers: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "confirmed"] } } },
);
bookingSchema.index({ bookedBy: 1, createdAt: -1 });
bookingSchema.index({ customerEmail: 1, createdAt: -1 });
bookingSchema.index({ "tickets.ticketCode": 1 }, { unique: true, sparse: true });

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
