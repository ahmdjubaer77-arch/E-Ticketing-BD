export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { body, method = "GET", signal } = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body === undefined || isFormData ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || "The request could not be completed.", response.status, payload?.code);
  }
  return payload?.data;
}

export async function uploadImage(path, file) {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || "The image could not be uploaded.", response.status, payload?.code);
  }
  return payload?.data;
}
