// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  off,
  query,
  orderByChild,
  limitToLast,
  get,
  set,
  update,
  remove,
  orderByKey,
  startAt,
  endAt
} from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCiQkuIHnCFbAxfhxMpdVfk0PymoYkY66g",
  authDomain: "iot-attendance-systeme.firebaseapp.com",
  databaseURL: "https://iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "iot-attendance-systeme",
  storageBucket: "iot-attendance-systeme.firebasestorage.app",
  messagingSenderId: "724045005299",
  appId: "1:724045005299:web:f1765911139a6336431286",
  measurementId: "G-NS80RQNWKT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Références principales
export const roomsRef = ref(database, 'rooms');
export const studentsRef = ref(database, 'students');
export const scheduleRef = ref(database, 'schedule');
export const sessionsRef = ref(database, 'sessions');
export const attendanceRef = ref(database, 'attendance');
export const logsRef = ref(database, 'logs');
export const groupsRef = ref(database, 'groups');
export const subjectsRef = ref(database, 'subjects');

// Fonctions utilitaires Firebase - Écoute
export const listenToRooms = (callback) => {
  const unsubscribe = onValue(roomsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToRoom = (roomId, callback) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToSchedule = (callback) => {
  const unsubscribe = onValue(scheduleRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToSessions = (date = null, roomId = null, status = null, callback) => {
  let sessionsQuery = sessionsRef;
  
  const unsubscribe = onValue(sessionsQuery, (snapshot) => {
    const sessions = [];
    snapshot.forEach((childSnapshot) => {
      const session = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };
      
      // Filtrer par date si spécifiée
      if (date && session.date !== date) {
        return;
      }
      
      // Filtrer par salle si spécifiée
      if (roomId && session.room !== roomId) {
        return;
      }
      
      // Filtrer par statut si spécifié
      if (status && session.status !== status) {
        return;
      }
      
      sessions.push(session);
    });
    
    // Trier par heure de début
    sessions.sort((a, b) => {
      const timeA = a.start || '00:00';
      const timeB = b.start || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    callback(sessions);
  });
  
  return unsubscribe;
};

export const listenToStudents = (callback) => {
  const unsubscribe = onValue(studentsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToStudent = (studentId, callback) => {
  const studentRef = ref(database, `students/${studentId}`);
  const unsubscribe = onValue(studentRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToAttendance = (date = null, sessionId = null, callback) => {
  let attendanceQuery = attendanceRef;
  
  const unsubscribe = onValue(attendanceQuery, (snapshot) => {
    const attendanceData = {};
    
    snapshot.forEach((childSnapshot) => {
      const currentSessionId = childSnapshot.key;
      
      // Si un sessionId spécifique est fourni, ne retourner que cette session
      if (sessionId && currentSessionId !== sessionId) {
        return;
      }
      
      // Filtrer par date si spécifiée
      if (date && !currentSessionId.includes(date)) {
        return;
      }
      
      attendanceData[currentSessionId] = childSnapshot.val();
    });
    
    callback(attendanceData);
  });
  
  return unsubscribe;
};

export const listenToSessionAttendance = (sessionId, callback) => {
  const sessionRef = ref(database, `attendance/${sessionId}`);
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToGroups = (callback) => {
  const unsubscribe = onValue(groupsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToSubjects = (callback) => {
  const unsubscribe = onValue(subjectsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
};

export const listenToRoomLogs = (roomId, limit = 50, callback) => {
  const logsRef = ref(database, `logs/${roomId}`);
  const logsQuery = query(
    logsRef,
    orderByChild('timestamp'),
    limitToLast(limit)
  );
  
  const unsubscribe = onValue(logsQuery, (snapshot) => {
    const logs = [];
    snapshot.forEach((childSnapshot) => {
      logs.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    callback(logs.reverse()); // Plus récent en premier
  });
  
  return unsubscribe;
};

// Fonctions utilitaires Firebase - Lecture (get)
export const getRooms = async () => {
  const snapshot = await get(roomsRef);
  return snapshot.val();
};

export const getRoomByEsp32Id = async (esp32Id) => {
  const rooms = await getRooms();
  if (!rooms) return null;
  
  return Object.entries(rooms).find(([id, room]) => 
    room.esp32_id === esp32Id
  )?.[1] || null;
};

export const getStudents = async () => {
  const snapshot = await get(studentsRef);
  return snapshot.val();
};

export const getStudentById = async (studentId) => {
  const studentRef = ref(database, `students/${studentId}`);
  const snapshot = await get(studentRef);
  return snapshot.val();
};

export const getStudentByRFID = async (rfid) => {
  const students = await getStudents();
  if (!students) return null;
  
  return Object.entries(students).find(([id, student]) => 
    student.rfid === rfid
  )?.[1] || null;
};

export const getSessions = async (date = null, roomId = null, status = null) => {
  const snapshot = await get(sessionsRef);
  const sessionsData = snapshot.val();
  
  if (!sessionsData) return [];
  
  const sessions = Object.entries(sessionsData).map(([id, data]) => ({
    id,
    ...data
  }));
  
  // Filtrer par date si spécifiée
  let filteredSessions = sessions;
  if (date) {
    filteredSessions = filteredSessions.filter(session => session.date === date);
  }
  
  // Filtrer par salle si spécifiée
  if (roomId) {
    filteredSessions = filteredSessions.filter(session => session.room === roomId);
  }
  
  // Filtrer par statut si spécifié
  if (status) {
    filteredSessions = filteredSessions.filter(session => session.status === status);
  }
  
  // Trier par heure de début
  return filteredSessions.sort((a, b) => {
    const timeA = a.start || '00:00';
    const timeB = b.start || '00:00';
    return timeA.localeCompare(timeB);
  });
};

export const getSessionById = async (sessionId) => {
  const sessionRef = ref(database, `sessions/${sessionId}`);
  const snapshot = await get(sessionRef);
  return snapshot.val();
};

export const getTodaysSessionsForRoom = async (roomId) => {
  const today = new Date().toISOString().split('T')[0];
  return getSessions(today, roomId);
};

export const getActiveSessionForRoom = async (roomId) => {
  const today = new Date().toISOString().split('T')[0];
  const sessions = await getSessions(today, roomId, 'ACTIVE');
  return sessions.length > 0 ? sessions[0] : null;
};

export const getAttendance = async (date = null, sessionId = null) => {
  const snapshot = await get(attendanceRef);
  const attendanceData = snapshot.val();
  
  if (!attendanceData) return {};
  
  // Si un sessionId spécifique est fourni, ne retourner que cette session
  if (sessionId) {
    return attendanceData[sessionId] || {};
  }
  
  // Filtrer par date si spécifiée
  if (date) {
    const filtered = {};
    Object.entries(attendanceData).forEach(([sessionId, attendance]) => {
      if (sessionId.includes(date)) {
        filtered[sessionId] = attendance;
      }
    });
    return filtered;
  }
  
  return attendanceData;
};

export const getSessionAttendance = async (sessionId) => {
  const sessionRef = ref(database, `attendance/${sessionId}`);
  const snapshot = await get(sessionRef);
  return snapshot.val();
};

export const getSchedule = async () => {
  const snapshot = await get(scheduleRef);
  return snapshot.val();
};

export const getRoomSchedule = async (roomId, day = null) => {
  const schedule = await getSchedule();
  if (!schedule) return {};
  
  const roomSchedule = schedule[roomId];
  if (!roomSchedule) return {};
  
  if (day) {
    return roomSchedule[day] || {};
  }
  
  return roomSchedule;
};

export const getTodayScheduleForRoom = async (roomId) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayIndex = new Date().getDay();
  // JavaScript: 0=Sunday, 1=Monday, etc.
  const todayDay = todayIndex === 0 ? 'sunday' : days[todayIndex - 1];
  
  return getRoomSchedule(roomId, todayDay);
};

// Fonctions utilitaires Firebase - Écriture (set/update)
export const recordAttendance = async (sessionId, studentId, data) => {
  const attendanceRef = ref(database, `attendance/${sessionId}/${studentId}`);
  await set(attendanceRef, {
    ...data,
    timestamp: Date.now()
  });
  return true;
};

export const updateStudent = async (studentId, data) => {
  const studentRef = ref(database, `students/${studentId}`);
  await update(studentRef, data);
  return true;
};

export const updateRoom = async (roomId, data) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, data);
  return true;
};

export const updateRoomStatus = async (roomId, active) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, {
    active,
    last_status_update: new Date().toISOString()
  });
  return true;
};

export const updateSession = async (sessionId, data) => {
  const sessionRef = ref(database, `sessions/${sessionId}`);
  await update(sessionRef, data);
  return true;
};

export const createSession = async (sessionData) => {
  const sessionId = sessionData.id;
  const sessionRef = ref(database, `sessions/${sessionId}`);
  await set(sessionRef, {
    ...sessionData,
    created_at: new Date().toISOString()
  });
  return sessionId;
};

export const startSession = async (sessionId) => {
  const sessionRef = ref(database, `sessions/${sessionId}`);
  await update(sessionRef, {
    status: 'ACTIVE',
    started_at: new Date().toISOString()
  });
  return true;
};

export const closeSession = async (sessionId) => {
  const sessionRef = ref(database, `sessions/${sessionId}`);
  await update(sessionRef, {
    status: 'CLOSED',
    closed_at: new Date().toISOString()
  });
  return true;
};

export const addLog = async (roomId, logData) => {
  const logRef = ref(database, `logs/${roomId}`);
  const newLogRef = ref(logRef, Date.now().toString());
  await set(newLogRef, {
    ...logData,
    timestamp: Date.now()
  });
  return true;
};

export const updateRoomLastSeen = async (roomId) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, {
    last_seen: new Date().toISOString(),
    status: 'online'
  });
  return true;
};

export const markRoomOffline = async (roomId) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, {
    status: 'offline',
    last_seen: new Date().toISOString()
  });
  return true;
};

// Fonctions utilitaires Firebase - Suppression
export const deleteStudent = async (studentId) => {
  const studentRef = ref(database, `students/${studentId}`);
  await remove(studentRef);
  return true;
};

export const deleteRoom = async (roomId) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await remove(roomRef);
  return true;
};

export const deleteSession = async (sessionId) => {
  const sessionRef = ref(database, `sessions/${sessionId}`);
  await remove(sessionRef);
  return true;
};

// Fonctions pour ESP32/IoT
export const checkForScheduledSession = async (esp32Id) => {
  try {
    // Trouver la salle par ESP32 ID
    const room = await getRoomByEsp32Id(esp32Id);
    if (!room || !room.active) {
      return {
        success: false,
        message: 'Salle non trouvée ou inactive'
      };
    }
    
    const roomId = Object.keys(await getRooms()).find(async key => (await getRooms())[key].esp32_id === esp32Id);
    
    // Vérifier les sessions prévues pour aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const todaysSchedule = await getTodayScheduleForRoom(roomId);
    
    if (!todaysSchedule || Object.keys(todaysSchedule).length === 0) {
      return {
        success: false,
        message: 'Aucun cours prévu aujourd\'hui'
      };
    }
    
    const currentTime = new Date();
    const currentHours = currentTime.getHours().toString().padStart(2, '0');
    const currentMinutes = currentTime.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    
    // Trouver le prochain créneau
    for (const [timeSlot, scheduleData] of Object.entries(todaysSchedule)) {
      const [startTime, endTime] = timeSlot.split('-');
      
      // Si nous sommes dans le créneau horaire
      if (currentTimeStr >= startTime && currentTimeStr <= endTime) {
        // Vérifier si la session existe déjà
        const sessionId = `${today}_${roomId}_${startTime.replace(':', '')}`;
        let session = await getSessionById(sessionId);
        
        if (!session) {
          // Créer la session
          session = {
            id: sessionId,
            date: today,
            room: roomId,
            room_name: room.name,
            start: startTime,
            end: endTime,
            group: scheduleData.group,
            subject: scheduleData.subject,
            status: 'SCHEDULED',
            created_at: new Date().toISOString()
          };
          
          await createSession(session);
        }
        
        return {
          success: true,
          sessionId,
          session,
          message: 'Session trouvée'
        };
      }
      
      // Si le créneau commence dans les 15 prochaines minutes
      const startTimeDate = new Date(`${today}T${startTime}`);
      const timeDiff = (startTimeDate - currentTime) / (1000 * 60); // Différence en minutes
      
      if (timeDiff > 0 && timeDiff <= 15) {
        // Créer la session en avance
        const sessionId = `${today}_${roomId}_${startTime.replace(':', '')}`;
        let session = await getSessionById(sessionId);
        
        if (!session) {
          session = {
            id: sessionId,
            date: today,
            room: roomId,
            room_name: room.name,
            start: startTime,
            end: endTime,
            group: scheduleData.group,
            subject: scheduleData.subject,
            status: 'SCHEDULED',
            created_at: new Date().toISOString()
          };
          
          await createSession(session);
        }
        
        return {
          success: true,
          sessionId,
          session,
          message: 'Session programmée trouvée (dans moins de 15 minutes)',
          startsIn: Math.round(timeDiff)
        };
      }
    }
    
    return {
      success: false,
      message: 'Aucun cours en ce moment'
    };
  } catch (error) {
    console.error('Erreur vérification session:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const startSessionForESP32 = async (esp32Id) => {
  try {
    // Vérifier d'abord s'il y a une session programmée
    const checkResult = await checkForScheduledSession(esp32Id);
    
    if (!checkResult.success) {
      return checkResult;
    }
    
    const { sessionId, session } = checkResult;
    
    // Démarrer la session
    await startSession(sessionId);
    
    // Mettre à jour le statut de la salle
    const roomId = session.room;
    await updateRoomLastSeen(roomId);
    
    // Ajouter un log
    await addLog(roomId, {
      type: 'SESSION_STARTED',
      sessionId,
      message: `Session démarrée: ${session.group} - ${session.subject}`,
      details: session
    });
    
    return {
      success: true,
      sessionId,
      session: {
        ...session,
        status: 'ACTIVE'
      },
      message: 'Session démarrée avec succès'
    };
  } catch (error) {
    console.error('Erreur démarrage session ESP32:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const recordESP32Attendance = async (esp32Id, studentRFID, method = 'RFID') => {
  try {
    // Trouver la salle par ESP32 ID
    const room = await getRoomByEsp32Id(esp32Id);
    if (!room || !room.active) {
      throw new Error(`Salle non trouvée ou inactive pour ESP32: ${esp32Id}`);
    }
    
    const roomId = Object.keys(await getRooms()).find(async key => (await getRooms())[key].esp32_id === esp32Id);
    
    // Trouver l'étudiant par RFID
    const student = await getStudentByRFID(studentRFID);
    if (!student) {
      throw new Error(`Étudiant non trouvé avec RFID: ${studentRFID}`);
    }
    
    // Trouver la session active pour cette salle
    const activeSession = await getActiveSessionForRoom(roomId);
    if (!activeSession) {
      throw new Error(`Aucune session active pour la salle: ${room.name}`);
    }
    
    // Vérifier que l'étudiant appartient au groupe de la session
    if (student.group !== activeSession.group) {
      throw new Error(`L'étudiant ${student.name} n'appartient pas au groupe ${activeSession.group}`);
    }
    
    // Enregistrer la présence
    const now = new Date();
    await recordAttendance(activeSession.id, student.id, {
      status: 'PRESENT',
      method,
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      studentName: student.name,
      studentGroup: student.group,
      recorded_at: now.toISOString()
    });
    
    // Mettre à jour le dernier accès de la salle
    await updateRoomLastSeen(roomId);
    
    // Ajouter un log
    await addLog(roomId, {
      type: 'ATTENDANCE_RECORDED',
      studentId: student.id,
      studentName: student.name,
      sessionId: activeSession.id,
      method,
      message: `${student.name} présent via ${method}`
    });
    
    return {
      success: true,
      studentName: student.name,
      session: activeSession,
      time: now.toLocaleTimeString(),
      message: 'Présence enregistrée avec succès'
    };
  } catch (error) {
    console.error('Erreur enregistrement présence ESP32:', error);
    throw error;
  }
};

export const stopSessionForESP32 = async (esp32Id) => {
  try {
    // Trouver la salle par ESP32 ID
    const room = await getRoomByEsp32Id(esp32Id);
    if (!room) {
      return {
        success: false,
        message: 'Salle non trouvée'
      };
    }
    
    const roomId = Object.keys(await getRooms()).find(async key => (await getRooms())[key].esp32_id === esp32Id);
    
    // Trouver la session active pour cette salle
    const activeSession = await getActiveSessionForRoom(roomId);
    if (!activeSession) {
      return {
        success: false,
        message: 'Aucune session active'
      };
    }
    
    // Fermer la session
    await closeSession(activeSession.id);
    
    // Ajouter un log
    await addLog(roomId, {
      type: 'SESSION_CLOSED',
      sessionId: activeSession.id,
      message: `Session fermée: ${activeSession.group} - ${activeSession.subject}`
    });
    
    return {
      success: true,
      sessionId: activeSession.id,
      message: 'Session fermée avec succès'
    };
  } catch (error) {
    console.error('Erreur arrêt session ESP32:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Fonctions de recherche
export const searchStudents = async (searchTerm) => {
  const students = await getStudents();
  if (!students) return [];
  
  return Object.entries(students)
    .filter(([id, student]) => {
      const term = searchTerm.toLowerCase();
      return (
        student.name?.toLowerCase().includes(term) ||
        student.id?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        student.group?.toLowerCase().includes(term)
      );
    })
    .map(([id, student]) => ({ id, ...student }));
};

export const getTodaysSessions = async () => {
  const today = new Date().toISOString().split('T')[0];
  return getSessions(today);
};

export const getActiveSessions = async (date = null) => {
  const sessions = await getSessions(date, null, 'ACTIVE');
  return sessions;
};

export const getScheduledSessions = async (date = null) => {
  const sessions = await getSessions(date, null, 'SCHEDULED');
  return sessions;
};

export const getClosedSessions = async (date = null) => {
  const sessions = await getSessions(date, null, 'CLOSED');
  return sessions;
};

// Fonctions de statistiques
export const getAttendanceStats = async (date = null) => {
  const sessions = await getSessions(date);
  const attendance = await getAttendance(date);
  
  let totalPresent = 0;
  let totalAbsent = 0;
  let byRoom = {};
  let byMethod = { RFID: 0, FINGERPRINT: 0 };
  let byStatus = { ACTIVE: 0, SCHEDULED: 0, CLOSED: 0 };
  
  sessions.forEach(session => {
    const roomName = session.room_name || session.room;
    const sessionAttendance = attendance[session.id] || {};
    
    // Statistiques par statut
    const status = session.status || 'SCHEDULED';
    byStatus[status] = (byStatus[status] || 0) + 1;
    
    if (!byRoom[roomName]) {
      byRoom[roomName] = { present: 0, absent: 0, total: 0 };
    }
    
    Object.values(sessionAttendance).forEach(record => {
      if (record.status === 'PRESENT') {
        totalPresent++;
        byRoom[roomName].present++;
        
        if (record.method === 'RFID') {
          byMethod.RFID++;
        } else if (record.method === 'FINGERPRINT') {
          byMethod.FINGERPRINT++;
        }
      } else if (record.status === 'ABSENT') {
        totalAbsent++;
        byRoom[roomName].absent++;
      }
    });
    
    byRoom[roomName].total = byRoom[roomName].present + byRoom[roomName].absent;
  });
  
  const totalStudents = totalPresent + totalAbsent;
  const attendanceRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;
  
  return {
    totalPresent,
    totalAbsent,
    totalStudents,
    attendanceRate: parseFloat(attendanceRate.toFixed(1)),
    byRoom,
    byMethod,
    byStatus
  };
};

// Utilitaires
export const stopListening = (ref, callback) => {
  off(ref, 'value', callback);
};

export const generateSessionId = (date, roomId, startTime) => {
  return `${date}_${roomId}_${startTime.replace(':', '')}`;
};

export default database;