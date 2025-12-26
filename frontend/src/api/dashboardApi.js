// src/api/dashboardApi.js
import api from './api';

const dashboardAPI = {
    // Get dashboard statistics
    getStats: () => api.get('/dashboard/stats'),
    
    // Get analytics data
    getAnalytics: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/dashboard/analytics${query ? `?${query}` : ''}`);
    },
};

export default dashboardAPI;