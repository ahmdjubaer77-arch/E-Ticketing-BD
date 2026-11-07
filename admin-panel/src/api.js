const apiBaseUrl = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status, code, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

function notifyUnauthorized(path, response) {
  if (response.status !== 401 || !path.startsWith("/admin/")) return;
  window.dispatchEvent(new CustomEvent("admin:unauthorized"));
}

export async function apiRequest(path, { body, method = "GET", signal } = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    method,
    credentials: "include",
    headers: body === undefined || isFormData ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    notifyUnauthorized(path, response);
    throw new ApiError(payload?.message || "The request could not be completed.", response.status, payload?.code, payload?.errors);
  }
  return payload?.data;
}

export async function uploadImage(path, file) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    notifyUnauthorized(path, response);
    throw new ApiError(payload?.message || "The image could not be uploaded.", response.status, payload?.code, payload?.errors);
  }
  return payload?.data;
}
