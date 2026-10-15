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
  request: async (method, url, body) => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },
  delete: async (url) => {
    const res = await fetch(url, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
  // multipart upload with progress. fetch() cannot report upload progress,
  // so this one uses XMLHttpRequest.
  upload: (url, formData, { onProgress } = {}) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.responseType = 'json';
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status === 401 && unauthorizedCallback) {
          unauthorizedCallback();
        }
        const data = xhr.response;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.error || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
      xhr.send(formData);
    }),
};
