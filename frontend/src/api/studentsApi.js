// src/api/studentsApi.js
import api from './api';

const studentAPI = {
    // Get all students
    getAll: () => api.get('/students'),
    
    // Get student by fingerprint ID
    getByFingerprint: (fingerprint_id) => api.get(`/students/${fingerprint_id}`),
    
    // Create new student
    create: (data) => api.post('/students', data),
    
    // Update student
    update: (fingerprint_id, data) => api.put(`/students/${fingerprint_id}`, data),
    
    // Delete student
    delete: (fingerprint_id) => api.delete(`/students/${fingerprint_id}`),
    
    // Search students with filters
    search: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/students/search${query ? `?${query}` : ''}`);
    },
    
    // Get student by fingerprint ID (ESP32 endpoint)
    getByFingerprintESP32: (fingerprint_id) => api.get(`/students/fingerprint/${fingerprint_id}`),
};

export default studentAPI;