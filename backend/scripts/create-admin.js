import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { isValidEmail, normalizeEmail } from "../src/auth/security.js";
import { loadConfig } from "../src/config.js";
import User from "../src/models/User.js";

async function createAdmin() {
  const email = normalizeEmail(process.argv[2]);
  if (!isValidEmail(email)) {
    throw new Error("Usage: npm run admin:create -- <admin-email>");
  }

  const config = loadConfig();
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });

  const existingUser = await User.findOne({ email }).select("_id role");
  if (existingUser) {
    throw new Error("That email already belongs to an account. No account was changed.");
  }

  const temporaryPassword = randomBytes(24).toString("base64url");
  const user = await User.create({
    fullName: email.slice(0, email.indexOf("@")).slice(0, 100),
    email,
    password: await bcrypt.hash(temporaryPassword, 12),
    role: "admin",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  });

  console.log("Admin account created successfully.");
  console.log(`Email: ${user.email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("Save this password now. It is not stored in plaintext and cannot be shown again.");
}

try {
  await createAdmin();
} catch (error) {
  console.error(`Admin account was not created: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
