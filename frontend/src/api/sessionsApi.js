// src/api/sessionsApi.js
import api from './api';

const sessionAPI = {
    // Get sessions with filters
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/sessions${query ? `?${query}` : ''}`);
    },
    
    // Get today's sessions
    getTodaySessions: () => api.get('/sessions/today'),
    
    // Check for scheduled session (ESP32)
    checkForSession: (esp32_id) => api.get(`/sessions/check?esp32_id=${esp32_id}`),
    
    // Start session (ESP32)
    start: (esp32_id) => api.post(`/sessions/start?esp32_id=${esp32_id}`),
    
    // Stop session (ESP32)
    stop: (esp32_id) => api.post(`/sessions/stop?esp32_id=${esp32_id}`),
    
    // Generate scheduled sessions for a date
    generateScheduled: (date) => api.post(`/sessions/generate?date=${date}`),
    
    // Manually close session
    closeManual: (date, room_id) => api.post(`/sessions/${date}/${room_id}/close`),
};

export default sessionAPI;