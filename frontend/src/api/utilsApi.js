// src/api/utilsApi.js
import api from './api';

const utilsAPI = {
    // Health check
    health: () => api.get('/health'),
    
    // Home endpoint
    home: () => api.get('/'),
};

export default utilsAPI;