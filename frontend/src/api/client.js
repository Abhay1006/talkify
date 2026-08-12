let unauthorizedCallback = null;

export const registerUnauthorizedCallback = (callback) => {
  unauthorizedCallback = callback;
};

const handleResponse = async (res) => {
  if (res.status === 401) {
    if (unauthorizedCallback) {
      unauthorizedCallback();
    }
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
};

export const apiClient = {
  get: async (url) => {
    const res = await fetch(url);
    return handleResponse(res);
  },
  post: async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
  put: async (url, body) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
  delete: async (url) => {
    const res = await fetch(url, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
};
