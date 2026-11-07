import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createMailer } from "./auth/mailer.js";
import { expirePendingBookings } from "./bookings/expiration.js";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

async function start() {
  const config = loadConfig();
  console.log(`Cloudinary image storage: ${config.cloudinary ? "configured" : "not configured"}`);
  await mongoose.connect(config.mongoUri);
  await mongoose.connection.collection("users").createIndex({ email: 1 }, { unique: true });
  await expirePendingBookings();
  const bookingExpiryTimer = setInterval(() => {
    expirePendingBookings().catch(() => {
      console.error("Pending booking expiry could not be processed.");
    });
  }, 15_000);
  bookingExpiryTimer.unref();

  const app = createApp({ config, mailer: createMailer(config) });
  app.listen(config.port, () => {
    console.log(`E-Ticketing API listening on port ${config.port}`);
  });
}

start().catch(() => {
  console.error("E-Ticketing API could not start. Check required configuration and database availability.");
  process.exitCode = 1;
});
