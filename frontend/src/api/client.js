let unauthorizedCallback = null;

export const registerUnauthorizedCallback = (callback) => {
  unauthorizedCallback = callback;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const handleResponse = async (res) => {
  if (res.status === 401 && unauthorizedCallback) {
    unauthorizedCallback();
  }

  // Not every response is JSON: a proxy error page from the host, for one.
  // Parsing those used to surface as "Unexpected token '<'".
  let data = null;
  try {
    data = await res.json();
  } catch {
    // fall through with data = null
  }

  if (!res.ok) {
    const fallback =
      res.status >= 500 ? "The server is having trouble. Please try again." : "Something went wrong";
    throw new ApiError(data?.error || fallback, res.status);
  }
  return data;
};

const request = async (method, url, body) => {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }
  return handleResponse(res);
};

export const apiClient = {
  get: (url) => request("GET", url),
  post: (url, body) => request("POST", url, body),
  put: (url, body) => request("PUT", url, body),
  delete: (url) => request("DELETE", url),
};
