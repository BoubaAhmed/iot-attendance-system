// src/api/dashboardApi.js
import api from './api';

const dashboardAPI = {

    // Main dashboard statistics (cards / KPIs)
    getStats: () => api.get('/dashboard/stats'),

    // Attendance analytics
    // params: { days: number }
    getAnalytics: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/dashboard/analytics${query ? `?${query}` : ''}`);
    },

    // Recent attendance activity
    // params: { limit: number }
    getRecentActivity: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/dashboard/recent-activity${query ? `?${query}` : ''}`);
    },

    // Live room status (IDLE / ACTIVE / UPCOMING / COMPLETED)
    getRoomStatus: () => api.get('/dashboard/room-status'),
};

export default dashboardAPI;
