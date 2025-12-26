// src/api/attendanceApi.js
import api from './api';

const attendanceAPI = {
    // Record attendance (ESP32 - Fingerprint only)
    record: (data) => api.post('/attendance', data),
    
    // Get attendance with filters
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/attendance${query ? `?${query}` : ''}`);
    },
    
    // Get attendance by date and group
    getByDateGroup: (date, group_id) => api.get(`/attendance/${date}/${group_id}`),
    
    // Get attendance by student
    getByStudent: (fingerprint_id, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/attendance/student/${fingerprint_id}${query ? `?${query}` : ''}`);
    },
    
    // Manual attendance update
    manual: (data) => api.post('/attendance/manual', data),
};

export default attendanceAPI;