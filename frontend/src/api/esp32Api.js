// src/api/esp32Api.js
import api from './api';

const esp32API = {
    // ESP32 health check
    health: () => api.get('/esp32/health'),
    
    // ESP32 status
    status: (esp32_id) => api.get(`/esp32/status?esp32_id=${esp32_id}`),
    
    // ESP32 ping
    ping: (data) => api.post('/esp32/ping', data),
};

export default esp32API;