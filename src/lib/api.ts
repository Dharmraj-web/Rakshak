const API_BASE = '/api';

export async function apiRequest(endpoint: string, options: any = {}) {
  const token = localStorage.getItem('rakshak_token');
  const headers = {
    ...options.headers,
    'Authorization': token ? `Bearer ${token}` : '',
  };

  if (!(options.body instanceof FormData) && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('rakshak_token');
      localStorage.removeItem('rakshak_user');
      // Use window.location as we are not in a React context here
      if (window.location.pathname !== '/') window.location.href = '/';
    }
    let errorMessage = 'Request failed';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // Not JSON, use status text
      errorMessage = response.statusText || `Error ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
