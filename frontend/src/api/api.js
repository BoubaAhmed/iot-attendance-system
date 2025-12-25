import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Intercepteurs
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Étudiants
export const studentAPI = {
  getAll: () => api.get('/students'),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  getByRFID: (rfid) => api.get(`/students/rfid/${rfid}`),
};

// API Salles
export const roomAPI = {
  getAll: () => api.get('/rooms'),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  updateStatus: (id, active) => api.put(`/rooms/${id}/status`, { active }),
  getByESP32: (esp32Id) => api.get(`/rooms/esp32/${esp32Id}`),
};

// API Groupes
export const groupAPI = {
  getAll: () => api.get('/groups'),
  getById: (id) => api.get(`/groups/${id}`),
  getStudents: (id) => api.get(`/groups/${id}/students`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
};

// API Matières
export const subjectAPI = {
  getAll: () => api.get('/subjects'),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
};

// API Emploi du temps
export const scheduleAPI = {
  getAll: () => api.get('/schedule'),
  getRoomSchedule: (roomId, day = null) => {
    const params = {};
    if (day) params.day = day;
    const query = new URLSearchParams(params).toString();
    return api.get(`/schedule/room/${roomId}${query ? `?${query}` : ''}`);
  },
  addEntry: (data) => api.post('/schedule/entry', data),
  deleteEntry: (data) => api.delete('/schedule/entry', { data }),
  getTodaySchedule: (roomId) => api.get(`/schedule/today/${roomId}`),
};

// API Sessions (démarrées par ESP32)
export const sessionAPI = {
  // Vérifier si une session est prévue pour l'ESP32
  checkForSession: (esp32Id) => api.get(`/sessions/check?esp32_id=${esp32Id}`),
  // Démarrer une session pour l'ESP32
  start: (esp32Id) => api.post(`/sessions/start?esp32_id=${esp32Id}`),
  // Arrêter une session pour l'ESP32
  stop: (esp32Id) => api.post(`/sessions/stop?esp32_id=${esp32Id}`),
  // Récupérer toutes les sessions
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/sessions${query ? `?${query}` : ''}`);
  },
  getById: (id) => api.get(`/sessions/${id}`),
  // Fermer manuellement une session
  close: (id) => api.post(`/sessions/${id}/close`),
  // Fermer automatiquement les sessions terminées
  autoClose: () => api.post('/sessions/auto-close'),
  // Récupérer les sessions actives
  getActive: (date = null) => {
    const params = date ? { date, status: 'ACTIVE' } : { status: 'ACTIVE' };
    const query = new URLSearchParams(params).toString();
    return api.get(`/sessions${query ? `?${query}` : ''}`);
  },
  // Générer les sessions programmées pour une date (pour le planning)
  generateScheduled: (date) => api.post(`/sessions/generate?date=${date}`),
};

// API Présences
export const attendanceAPI = {
  // Enregistrer une présence (pour ESP32)
  record: (data) => api.post('/attendance', data),
  // Récupérer toutes les présences
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/attendance${query ? `?${query}` : ''}`);
  },
  // Récupérer les statistiques quotidiennes
  getDailyStats: (date) => api.get(`/attendance/stats/daily?date=${date}`),
  // Récupérer les présences d'une session
  getBySession: (sessionId) => api.get(`/attendance/session/${sessionId}`),
  // Marquer les absences pour une session
  markAbsences: (sessionId) => api.post(`/attendance/${sessionId}/mark-absences`),
};

// API Logs
export const logAPI = {
  getRoomLogs: (roomId, limit = 50) => api.get(`/logs/room/${roomId}?limit=${limit}`),
  addLog: (roomId, data) => api.post(`/logs/room/${roomId}`, data),
};

// API Utilitaires
export const utilAPI = {
  healthCheck: () => api.get('/health'),
  systemInfo: () => api.get('/system/info'),
  initDatabase: () => api.post('/init'),
  // API pour ESP32
  esp32Health: () => api.get('/esp32/health'),
  esp32Status: (esp32Id) => api.get(`/esp32/status?esp32_id=${esp32Id}`),
};

export default api;