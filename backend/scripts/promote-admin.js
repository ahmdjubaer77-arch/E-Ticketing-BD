import "dotenv/config";
import mongoose from "mongoose";
import { isValidEmail, normalizeEmail } from "../src/auth/security.js";
import { loadConfig } from "../src/config.js";
import User from "../src/models/User.js";

async function promoteAdmin() {
  const email = normalizeEmail(process.argv[2]);
  if (!isValidEmail(email)) {
    throw new Error("Usage: npm run admin:promote -- <existing-account-email>");
  }

  const config = loadConfig();
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });

  const user = await User.findOne({ email }).select("role isActive isEmailVerified");
  if (!user) throw new Error("No account exists with that email.");
  if (user.role === "admin") {
    console.log("This account already has the admin role.");
    return;
  }
  if (!user.isActive || !user.isEmailVerified) {
    throw new Error("Only an active, email-verified account can be promoted. No account was changed.");
  }

  const result = await User.updateOne(
    { _id: user._id, role: "user", isActive: true, isEmailVerified: true },
    { $set: { role: "admin" }, $inc: { tokenVersion: 1 } },
  );
  if (result.modifiedCount !== 1) {
    throw new Error("The account changed during promotion. No further changes were made; check its current role.");
  }

  console.log(`Admin role granted to ${email}. Existing login sessions were revoked.`);
}

try {
  await promoteAdmin();
} catch (error) {
  console.error(`Admin role was not changed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
