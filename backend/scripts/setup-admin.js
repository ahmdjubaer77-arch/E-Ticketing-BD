import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { isValidEmail, normalizeEmail } from "../src/auth/security.js";
import { loadConfig } from "../src/config.js";
import User from "../src/models/User.js";

async function setupAdmin() {
  const email = normalizeEmail(process.argv[2]);
  if (!isValidEmail(email)) {
    throw new Error("Usage: npm run admin:setup -- <existing-account-email>");
  }

  const config = loadConfig();
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });

  const user = await User.findOne({ email }).select("_id role isActive isEmailVerified");
  if (!user) throw new Error("No account exists with that email.");
  if (!user.isActive || !user.isEmailVerified) {
    throw new Error("Only an active, email-verified account can be set up as admin. No account was changed.");
  }

  const temporaryPassword = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const result = await User.updateOne(
    { _id: user._id, role: user.role, isActive: true, isEmailVerified: true },
    { $set: { role: "admin", password: passwordHash }, $inc: { tokenVersion: 1 } },
  );
  if (result.modifiedCount !== 1) {
    throw new Error("The account changed during setup. No credentials were issued; check its current state.");
  }

  console.log("Admin account setup completed.");
  console.log(`Email: ${email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("Save this password now. It is not stored in plaintext and cannot be shown again.");
  console.log("Existing login sessions were revoked.");
}

try {
  await setupAdmin();
} catch (error) {
  console.error(`Admin account was not set up: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
