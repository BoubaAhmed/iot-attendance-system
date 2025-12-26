// src/api/scheduleApi.js
import api from './api';

const scheduleAPI = {
    // Get all schedule
    getAll: () => api.get('/schedule'),
    
    // Get room schedule
    getRoomSchedule: (room_id, day = null) => {
        const params = {};
        if (day) params.day = day;
        const query = new URLSearchParams(params).toString();
        return api.get(`/schedule/room/${room_id}${query ? `?${query}` : ''}`);
    },
    
    // Get today's schedule for a room
    getTodaySchedule: (room_id) => api.get(`/schedule/today/${room_id}`),
    
    // Add schedule entry
    addEntry: (data) => api.post('/schedule/entry', data),
    
    // Delete schedule entry
    deleteEntry: (data) => api.delete('/schedule/entry', { data }),
};

export default scheduleAPI;