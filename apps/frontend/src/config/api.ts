import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status || 'UNKNOWN';
      const data = error.response?.data || error.message;
      console.error(`[API Error ${status}]:`, data);
      return Promise.reject(error);
    }
  );