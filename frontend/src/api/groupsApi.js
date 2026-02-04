// src/api/groupsApi.js
import api from './api';

const groupAPI = {
    // Get all groups
    getAll: () => api.get('/groups'),

    // Get group by ID
    getById: (group_id) => api.get(`/groups/${group_id}`),

    // Create new group
    create: (data) => api.post('/groups', data),

    // Update group
    update: (group_id, data) =>
        api.put(`/groups/${group_id}`, data),

    // Delete group
    delete: (group_id) =>
        api.delete(`/groups/${group_id}`),

    // Get students in a group
    getStudents: (group_id) =>
        api.get(`/groups/${group_id}/students`),
};

export default groupAPI;
