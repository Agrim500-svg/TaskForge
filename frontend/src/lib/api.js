const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
let refreshInFlight = null;

function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = api("/auth/refresh-token", { method: "POST" }, false)
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function api(path, options = {}, canRefresh = true) {
  const headers = new Headers(options.headers || {});
  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const refreshExempt = ["/auth/login", "/auth/register", "/auth/refresh-token", "/auth/forgot-password", "/auth/reset-password"];
  if (response.status === 401 && canRefresh && !refreshExempt.some((prefix) => path.startsWith(prefix))) {
    // Share one rotating refresh token across simultaneous 401 responses.
    const refreshed = await refreshSession();
    if (refreshed) return api(path, options, false);
    window.dispatchEvent(new CustomEvent("taskforge:session-expired"));
  }

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(result?.message || "Something went wrong. Please try again.");
    error.status = response.status;
    error.errors = result?.errors;
    throw error;
  }
  return result?.data;
}

export const json = (method, data) => ({ method, body: JSON.stringify(data) });
