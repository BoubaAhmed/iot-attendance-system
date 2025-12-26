// src/api/roomsApi.js
import api from './api';

const roomAPI = {
    // Get all rooms
    getAll: () => api.get('/rooms'),
    
    // Get room by ID
    getById: (room_id) => api.get(`/rooms/${room_id}`),
    
    // Create new room
    create: (data) => api.post('/rooms', data),
    
    // Update room
    update: (room_id, data) => api.put(`/rooms/${room_id}`, data),
    
    // Update room status (activate/deactivate)
    updateStatus: (room_id, active) => api.put(`/rooms/${room_id}/status`, { active }),
    
    // Get room by ESP32 ID
    getByESP32: (esp32_id) => api.get(`/rooms/esp32/${esp32_id}`),
    
    // Delete room
    delete: (room_id) => api.delete(`/rooms/${room_id}`),
};

export default roomAPI;