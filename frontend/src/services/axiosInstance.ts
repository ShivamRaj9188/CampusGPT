import axios from 'axios';

/**
 * Axios instance pre-configured for the CampusGPT backend.
 * - Base URL set to /api (proxied by Vite in dev)
 * - Request interceptor automatically adds the JWT Bearer token
 * - Response interceptor redirects to /login on 401 Unauthorized
 */
const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,   // 30 seconds for regular endpoints
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ─────────────────────────────────────────────────────
// Attach JWT token to every request automatically
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('campusgpt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ────────────────────────────────────────────────────
// Handle 401 Unauthorized by clearing session and redirecting to login
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('campusgpt_token');
      localStorage.removeItem('campusgpt_username');
      localStorage.removeItem('campusgpt_email');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
