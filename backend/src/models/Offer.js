import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    operator: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    from: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    to: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    transport: { type: String, enum: ["Bus", "Train", "Launch", "Event"], required: true },
    originalPrice: { type: Number, required: true, min: 0, max: 100_000_000 },
    discountedPrice: { type: Number, required: true, min: 0, max: 100_000_000 },
    discountLabel: { type: String, default: "", trim: true, maxlength: 40 },
    validity: { type: String, default: "", trim: true, maxlength: 120 },
    validUntil: { type: Date, default: null },
    image: { type: String, default: "", maxlength: 2048 },
    imageAlt: { type: String, default: "", trim: true, maxlength: 200 },
    imagePublicId: { type: String, default: "", maxlength: 200, select: false },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);

offerSchema.pre("validate", function validateDiscount() {
  if (Number.isFinite(this.originalPrice) && Number.isFinite(this.discountedPrice)
    && this.discountedPrice >= this.originalPrice) {
    this.invalidate("discountedPrice", "Discounted price must be lower than the original price.");
  }
});

offerSchema.index({ status:  1, validUntil: 1, createdAt: -1 });
offerSchema.index({ deletedAt: 1, createdAt: -1 });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

export default Offer;
