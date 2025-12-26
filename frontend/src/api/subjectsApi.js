// src/api/subjectsApi.js
import api from './api';

const subjectAPI = {
    // Get all subjects
    getAll: () => api.get('/subjects'),
    
    // Get subject by ID
    getById: (subject_id) => api.get(`/subjects/${subject_id}`),
};

export default subjectAPI;