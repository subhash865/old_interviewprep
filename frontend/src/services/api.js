import axios from 'axios';

const API = axios.create({
  // Using '/api' dynamically uses your current domain (both locally and on Vercel)
  baseURL: '/api', 
});

// Automatically inject JWT token into requests if present
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default API;