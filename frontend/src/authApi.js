const apiBaseUrl = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export async function apiRequest(path, { method = "GET", body, headers } = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api${path}`, {
      method,
      credentials: "include",
      headers: body instanceof FormData ? headers : body ? { "Content-Type": "application/json", ...headers } : headers,
      body: body instanceof FormData || body instanceof Blob ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error("Unable to reach the authentication service.");
    error.networkError = true;
    throw error;
  }
  const result = await response.json().catch(() => ({
    success: false,
    message: "The server returned an invalid response.",
  }));
  if (!response.ok || !result.success) {
    const error = new Error(result.message || "The request could not be completed.");
    error.status = response.status;
    error.code = result.code;
    error.errors = result.errors || {};
    error.data = result.data;
    throw error;
  }
  return result;
}

export function authRequest(path, options) {
  return apiRequest(`/auth${path}`, options);
}

export function getAuthErrorMessage(error) {
  if (error?.networkError || error?.status >= 500) {
    return "Something went wrong. Please try again.";
  }
  if (error?.code === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email before signing in.";
  }
  if (error?.status === 429) {
    return error.message || "Too many attempts. Please try again later.";
  }
  return error?.message || "Something went wrong. Please try again.";
}
