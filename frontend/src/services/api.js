import axios from 'axios';

// When deployed on Vercel, a relative path '/api' will automatically hit the same domain.
// Locally, it will fall back to your local development backend server.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default api;