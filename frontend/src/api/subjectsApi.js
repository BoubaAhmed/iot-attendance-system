// src/api/subjectsApi.js
import api from './api';

const subjectAPI = {
    // Get all subjects
    getAll: () => api.get('/subjects'),

    // Get subject by ID
    getById: (subject_id) => api.get(`/subjects/${subject_id}`),

    // Create new subject
    create: (data) => api.post('/subjects', data),

    // Update subject
    update: (subject_id, data) =>
        api.put(`/subjects/${subject_id}`, data),

    // Delete subject
    delete: (subject_id) =>
        api.delete(`/subjects/${subject_id}`),

    // Get subjects by teacher ID
    getByTeacher: (teacher_id) =>
        api.get(`/subjects/by-teacher/${teacher_id}`),

    // Get subjects by level
    getByLevel: (level) =>
        api.get(`/subjects/level/${level}`),

    // Get subjects statistics
    getStats: () => api.get('/subjects/stats'),
};

export default subjectAPI;
