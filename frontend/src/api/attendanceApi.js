// src/api/attendanceApi.js
import api from './api';

const attendanceAPI = {
  // Record attendance (ESP32 - Fingerprint only)
  record: (data) => api.post('/attendance', data),

  // Get attendance with filters
  // params: { date, room, group, student_id }
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/attendance${query ? `?${query}` : ''}`);
  },

  // Get attendance for specific group and date
  getByGroupDate: (group_id, date) =>
    api.get(`/attendance/${group_id}/${date}`),

  // Get attendance by student
  // params: { start_date, end_date }
  getByStudent: (student_id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(
      `/attendance/student/${student_id}${query ? `?${query}` : ''}`
    );
  },

  // Check today's attendance for a student
  getTodayByStudent: (student_id) =>
    api.get(`/attendance/student/${student_id}/today`),

  // Manually mark student as absent
  markAbsent: (data) => api.post('/attendance/mark-absent', data),

  // Get attendance statistics
  // params: { date, group_id }
  getStats: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/attendance/stats${query ? `?${query}` : ''}`);
  },

  // Get today's attendance for a specific room
  getTodayByRoom: (room_id) =>
    api.get(`/attendance/room/${room_id}/today`),
};

export default attendanceAPI;
