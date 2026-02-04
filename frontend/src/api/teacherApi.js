// src/api/teacherApi.js
import api from './api';

const teacherAPI = {
    // Get all teachers
    getAll: () => api.get('/teachers'),
    
    // Get teacher by ID
    getById: (teacher_id) => api.get(`/teachers/${teacher_id}`),
};

export default teacherAPI;