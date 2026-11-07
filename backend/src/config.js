const durationPattern = /^(\d+)(s|m|h|d)$/;

export function durationToMilliseconds(value) {
  const match = durationPattern.exec(value);
  if (!match) throw new Error("JWT expiry values must use seconds, minutes, hours, or days (for example 1h).");
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const duration = Number(match[1]) * units[match[2]];
  if (!Number.isSafeInteger(duration) || duration <= 0) {
    throw new Error("JWT expiry durations must be positive safe integers.");
  }
  return duration;
}

export function loadConfig(env = process.env) {
  const required = ["MONGODB_URI", "JWT_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  if (env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters.");

  const jwtExpiresIn = env.JWT_EXPIRES_IN || "1h";
  const jwtMaxAge = durationToMilliseconds(jwtExpiresIn);
  const jwtRememberMeExpiresIn = env.JWT_REMEMBER_ME_EXPIRES_IN || "7d";
  const jwtRememberMeMaxAge = durationToMilliseconds(jwtRememberMeExpiresIn);
  const smtpPort = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }
  const clientUrl = env.CLIENT_URL || "http://localhost:5173";
  const parseClientOrigin = (value, name) => {
    try {
      const parsed = new URL(value);
      if (parsed.origin === "null") throw new Error();
      if (env.NODE_ENV === "production" && parsed.protocol !== "https:") {
        throw new Error(`${name} must use HTTPS in production.`);
      }
      return parsed.origin;
    } catch (error) {
      if (error.message?.includes("must use HTTPS")) throw error;
      throw new Error(`${name} must be a valid absolute URL.`);
    }
  };
  const parsedClientUrl = parseClientOrigin(clientUrl, "CLIENT_URL");
  const adminClientUrl = env.ADMIN_CLIENT_URL?.trim()
    ? parseClientOrigin(env.ADMIN_CLIENT_URL.trim(), "ADMIN_CLIENT_URL")
    : null;
  const cloudinaryValues = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
  const cloudinaryConfigured = cloudinaryValues.some((value) => value?.trim());
  if (cloudinaryConfigured && cloudinaryValues.some((value) => !value?.trim())) {
    throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be configured together.");
  }
  if (env.CLOUDINARY_CLOUD_NAME && !/^[a-zA-Z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME)) {
    throw new Error("CLOUDINARY_CLOUD_NAME contains invalid characters.");
  }

  return {
    port: Number(env.PORT) || 3001,
    mongoUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn,
    jwtMaxAge,
    jwtRememberMeExpiresIn,
    jwtRememberMeMaxAge,
    smtpHost: env.SMTP_HOST,
    smtpPort,
    smtpSecure: env.SMTP_SECURE === "true",
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    smtpFromEmail: env.SMTP_FROM_EMAIL,
    smtpFromName: env.SMTP_FROM_NAME || "E-Ticketing",
    clientUrl: parsedClientUrl,
    adminClientUrl,
    cloudinary: cloudinaryConfigured
      ? {
          cloudName: env.CLOUDINARY_CLOUD_NAME.trim(),
          apiKey: env.CLOUDINARY_API_KEY.trim(),
          apiSecret: env.CLOUDINARY_API_SECRET.trim(),
        }
      : null,
    nodeEnv: env.NODE_ENV || "development",
  };
}
