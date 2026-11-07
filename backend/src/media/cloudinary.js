import { createHash } from "node:crypto";

export class MediaServiceError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "MediaServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = message;
  }
}

export function detectImageContentType(buffer, declaredType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  const signatures = [
    { type: "image/jpeg", valid: buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    { type: "image/png", valid: buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    { type: "image/webp", valid: buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" },
  ];
  return signatures.find(({ type, valid }) => type === declaredType && valid)?.type ?? null;
}

export function signCloudinaryParameters(parameters, apiSecret) {
  const canonical = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex");
}

function requireCredentials(config) {
  if (!config?.cloudinary?.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
    throw new MediaServiceError(503, "MEDIA_STORAGE_NOT_CONFIGURED", "Image storage is not configured on the server.");
  }
  return config.cloudinary;
}

async function cloudinaryRequest(url, options, failureMessage) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new MediaServiceError(502, "MEDIA_STORAGE_UNAVAILABLE", failureMessage);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    throw new MediaServiceError(502, "MEDIA_STORAGE_FAILED", failureMessage);
  }
  return payload;
}

export async function uploadCloudinaryImage(config, { buffer, contentType, publicId }) {
  const credentials = requireCredentials(config);
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = { invalidate: "true", overwrite: "true", public_id: publicId, timestamp: String(timestamp) };
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), "upload");
  form.append("api_key", credentials.apiKey);
  for (const [key, value] of Object.entries(parameters)) form.append(key, value);
  form.append("signature", signCloudinaryParameters(parameters, credentials.apiSecret));

  const result = await cloudinaryRequest(
    `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`,
    { method: "POST", body: form },
    "Image upload failed. Please try again.",
  );
  if (typeof result.secure_url !== "string" || !result.secure_url.startsWith("https://res.cloudinary.com/") || result.public_id !== publicId) {
    throw new MediaServiceError(502, "MEDIA_STORAGE_INVALID_RESPONSE", "Image storage returned an invalid response.");
  }
  return { secureUrl: result.secure_url, publicId: result.public_id };
}

export async function deleteCloudinaryImage(config, publicId) {
  const credentials = requireCredentials(config);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = { invalidate: "true", public_id: publicId, timestamp };
  const form = new URLSearchParams({
    api_key: credentials.apiKey,
    ...parameters,
    signature: signCloudinaryParameters(parameters, credentials.apiSecret),
  });
  const result = await cloudinaryRequest(
    `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/destroy`,
    { method: "POST", body: form },
    "Image removal failed. Please try again.",
  );
  if (!["ok", "not found"].includes(result.result)) {
    throw new MediaServiceError(502, "MEDIA_STORAGE_DELETE_FAILED", "Image removal failed. Please try again.");
  }
}
