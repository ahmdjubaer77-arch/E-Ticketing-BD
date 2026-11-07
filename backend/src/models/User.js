import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 24, default: "" },
    profileImage: { type: String, default: "", maxlength: 550_000 },
    profileImagePublicId: { type: String, default: "", maxlength: 200, select: false },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    isEmailVerified: { type: Boolean, default: false, required: true },
    isActive: { type: Boolean, default: true, required: true },
    emailVerifiedAt: { type: Date, default: null },
    pendingEmail: { type: String, lowercase: true, trim: true, maxlength: 254, default: null, select: false },
    pendingEmailOtpHash: { type: String, default: null, select: false },
    pendingEmailOtpExpiresAt: { type: Date, default: null, select: false },
    pendingEmailOtpLastSentAt: { type: Date, default: null, select: false },
    emailOtpHash: { type: String, select: false, default: null },
    emailOtpExpiresAt: { type: Date, select: false, default: null },
    emailOtpLastSentAt: { type: Date, select: false, default: null },
    resetOtpHash: { type: String, select: false, default: null },
    resetOtpExpiresAt: { type: Date, select: false, default: null },
    resetOtpLastSentAt: { type: Date, select: false, default: null },
    resetTokenHash: { type: String, select: false, default: null },
    resetTokenExpiresAt: { type: Date, select: false, default: null },
    tokenVersion: { type: Number, default: 0, required: true },
  },
  { timestamps: true, strict: "throw" },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
