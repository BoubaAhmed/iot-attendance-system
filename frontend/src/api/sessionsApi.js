// src/api/sessionsApi.js
import api from './api';

const sessionAPI = {
    // Get sessions with optional filters
    // params: { date, room, status }
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/sessions${query ? `?${query}` : ''}`);
    },

    // Get today's sessions
    getToday: () => api.get('/sessions/today'),

    // Check for scheduled/active session (ESP32)
    check: (esp32_id) =>
        api.get(`/sessions/check?esp32_id=${esp32_id}`),

    // Start session (ESP32)
    start: (esp32_id) =>
        api.post(`/sessions/start?esp32_id=${esp32_id}`),

    // Stop session (ESP32)
    stop: (esp32_id) =>
        api.post(`/sessions/stop?esp32_id=${esp32_id}`),

    // Manually generate sessions (admin)
    // date format: YYYY-MM-DD
    generate: (date) =>
        api.post(`/sessions/generate${date ? `?date=${date}` : ''}`),

    // Get scheduler status
    getSchedulerStatus: () =>
        api.get('/scheduler/status'),

    // Trigger daily session generation immediately
    triggerSchedulerNow: () =>
        api.post('/scheduler/trigger-now'),

    // Test scheduler (debug)
    testScheduler: () =>
        api.get('/scheduler/test'),
};

export default sessionAPI;
