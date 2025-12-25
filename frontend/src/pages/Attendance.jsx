import React, { useState, useEffect, useCallback } from 'react';
import { attendanceAPI, sessionAPI, roomAPI, studentAPI } from '../api/api';
import { listenToSessions, listenToAttendance } from '../firebase/firebase';
import { 
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiHome,
  FiUsers,
  FiDownload,
  FiFilter,
  FiRadio,
  FiUserCheck,
  FiTrendingUp,
  FiPieChart,
  FiList,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiFileText,
  FiPercent,
  FiActivity,
  FiPlayCircle,
  FiStopCircle,
  FiEye,
  FiEyeOff,
  FiBook,
  FiUserPlus
} from 'react-icons/fi';

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState({});
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [methodFilter, setMethodFilter] = useState('all');
  const [expandedSessions, setExpandedSessions] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [studentsMap, setStudentsMap] = useState({});
  const [groupsMap, setGroupsMap] = useState({});

  // Fonction pour générer les sessions pour la date sélectionnée
  const generateSessions = useCallback(async () => {
    try {
      await sessionAPI.generate(selectedDate);
    } catch (error) {
      console.error('Erreur génération sessions:', error);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
    setupRealtimeListeners();
    
    // Générer automatiquement les sessions pour aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today) {
      generateSessions();
    }
  }, [selectedDate, selectedRoom, statusFilter, generateSessions]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Récupérer les salles
      const roomsResponse = await roomAPI.getAll();
      if (roomsResponse.data.success) {
        const roomsData = roomsResponse.data.data || {};
        const roomsArray = Object.values(roomsData).map(room => ({
          id: room.id || room._id,
          name: room.name
        }));
        setRooms(roomsArray);
      }

      // Récupérer les étudiants
      const studentsResponse = await studentAPI.getAll();
      if (studentsResponse.data.success) {
        setStudentsMap(studentsResponse.data.data || {});
      }

      // Récupérer les groupes
      const groupsResponse = await studentAPI.getAll(); // Note: devrait être groupAPI.getAll()
      if (groupsResponse.data.success) {
        const groups = {};
        Object.values(studentsResponse.data.data || {}).forEach(student => {
          if (student.group) {
            groups[student.group] = groups[student.group] || [];
            groups[student.group].push(student);
          }
        });
        setGroupsMap(groups);
      }

      // Récupérer les sessions pour la date sélectionnée
      const sessionsParams = { date: selectedDate };
      if (selectedRoom) sessionsParams.room = selectedRoom;
      if (statusFilter !== 'all') sessionsParams.status = statusFilter;
      
      const sessionsResponse = await sessionAPI.getAll(sessionsParams);
      
      if (sessionsResponse.data.success) {
        const sessionsData = sessionsResponse.data.data;
        let sessionsArray = [];
        
        if (Array.isArray(sessionsData)) {
          sessionsArray = sessionsData;
        } else if (sessionsData) {
          sessionsArray = Object.entries(sessionsData).map(([id, data]) => ({
            id,
            ...data
          }));
        }
        
        setSessions(sessionsArray);
        
        // Récupérer les présences pour ces sessions
        const attendanceParams = { date: selectedDate };
        if (selectedRoom) attendanceParams.room = selectedRoom;
        
        const attendanceResponse = await attendanceAPI.getAll(attendanceParams);
        
        if (attendanceResponse.data.success) {
          const attendanceData = attendanceResponse.data.data || {};
          
          // S'assurer que chaque session a des données d'attendance même vides
          sessionsArray.forEach(session => {
            if (!attendanceData[session.id]) {
              attendanceData[session.id] = {};
            }
          });
          
          setAttendanceData(attendanceData);
          calculateStats(sessionsArray, attendanceData);
        }
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setAttendanceData({});
      setSessions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListeners = () => {
    // Écouter les sessions en temps réel
    const unsubscribeSessions = listenToSessions(selectedDate, selectedRoom, (sessionsData) => {
      setSessions(sessionsData);
    });

    // Écouter les présences en temps réel
    const unsubscribeAttendance = listenToAttendance(selectedDate, null, (newAttendanceData) => {
      setAttendanceData(prev => ({ ...prev, ...newAttendanceData }));
      calculateStats(sessions, { ...attendanceData, ...newAttendanceData });
    });

    return () => {
      unsubscribeSessions();
      unsubscribeAttendance();
    };
  };

  const calculateStats = (sessionsList, attendance) => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let byRoom = {};
    let byMethod = { RFID: 0, FINGERPRINT: 0 };
    let byStatus = { OPEN: 0, CLOSED: 0 };
    let bySubject = {};
    
    // Calculer les statistiques par session
    sessionsList.forEach(session => {
      const sessionId = session.id;
      const roomName = session.room_name || session.room;
      const subject = session.subject || 'Non spécifié';
      const sessionAttendance = attendance[sessionId] || {};
      
      // Statistiques par statut de session
      const status = session.status || 'OPEN';
      byStatus[status] = (byStatus[status] || 0) + 1;
      
      // Statistiques par salle
      if (!byRoom[roomName]) {
        byRoom[roomName] = { present: 0, absent: 0, total: 0 };
      }
      
      // Statistiques par matière
      if (!bySubject[subject]) {
        bySubject[subject] = { present: 0, absent: 0, total: 0 };
      }
      
      // Compter les présences et absences dans cette session
      Object.values(sessionAttendance).forEach(studentAttendance => {
        if (studentAttendance.status === 'PRESENT') {
          totalPresent++;
          byRoom[roomName].present++;
          bySubject[subject].present++;
          
          // Méthode d'authentification
          const method = studentAttendance.method;
          if (method === 'RFID') {
            byMethod.RFID++;
          } else if (method === 'FINGERPRINT') {
            byMethod.FINGERPRINT++;
          }
        } else if (studentAttendance.status === 'ABSENT') {
          totalAbsent++;
          byRoom[roomName].absent++;
          bySubject[subject].absent++;
        }
      });
      
      byRoom[roomName].total = byRoom[roomName].present + byRoom[roomName].absent;
      bySubject[subject].total = bySubject[subject].present + bySubject[subject].absent;
    });
    
    const totalStudents = totalPresent + totalAbsent;
    const attendanceRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;
    
    setStats({
      totalPresent,
      totalAbsent,
      totalStudents,
      attendanceRate: attendanceRate.toFixed(1),
      byRoom,
      byMethod,
      byStatus,
      bySubject,
      openSessions: byStatus.OPEN || 0,
      closedSessions: byStatus.CLOSED || 0
    });
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleRoomChange = (e) => {
    setSelectedRoom(e.target.value);
  };

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(attendanceData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `presences_${selectedDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    let csvContent = "ID Session,Salle,Groupe,Matière,Début,Fin,ID Étudiant,Nom,Statut,Méthode,Heure\n";
    
    sessions.forEach(session => {
      const sessionAttendance = attendanceData[session.id] || {};
      const roomName = session.room_name || session.room;
      
      Object.entries(sessionAttendance).forEach(([studentId, attendance]) => {
        const studentInfo = studentsMap[studentId] || {};
        csvContent += `"${session.id}","${roomName}","${session.group || ''}","${session.subject || ''}","${session.start || ''}","${session.end || ''}","${studentId}","${studentInfo.name || 'Inconnu'}","${attendance.status || 'N/A'}","${attendance.method || 'N/A'}","${attendance.time || ''}"\n`;
      });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `presences_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseSession = async (sessionId) => {
    try {
      await sessionAPI.close(sessionId);
      fetchData();
    } catch (error) {
      console.error('Erreur fermeture session:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatSessionTime = (start, end) => {
    return `${start} - ${end}`;
  };

  const getStudentName = (studentId) => {
    const student = studentsMap[studentId];
    return student ? student.name : studentId;
  };

  const getStudentGroup = (studentId) => {
    const student = studentsMap[studentId];
    return student ? student.group : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des présences...</p>
        </div>
      </div>
    );
  }

  const totalPresent = stats?.totalPresent || 0;
  const totalAbsent = stats?.totalAbsent || 0;
  const totalStudents = stats?.totalStudents || 0;
  const attendanceRate = stats?.attendanceRate || '0';
  const rfidCount = stats?.byMethod?.RFID || 0;
  const fingerprintCount = stats?.byMethod?.FINGERPRINT || 0;
  const openSessions = stats?.openSessions || 0;
  const closedSessions = stats?.closedSessions || 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion des présences</h1>
            <p className="text-gray-600 mt-1">Système automatisé basé sur l'emploi du temps</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={generateSessions}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiRefreshCw className="h-4 w-4" />
              Générer sessions
            </button>
            <button
              onClick={fetchData}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FiDownload className="h-5 w-5" />
              Exporter CSV
            </button>
          </div>
        </div>

        {/* Date Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center">
              <FiCalendar className="h-5 w-5 text-blue-600 mr-3" />
              <div>
                <h3 className="font-medium text-blue-900">Données du {formatDate(selectedDate)}</h3>
                <p className="text-sm text-blue-700">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''} • {totalPresent} présent{totalPresent !== 1 ? 's' : ''} • {totalAbsent} absent{totalAbsent !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="text-sm text-blue-600 bg-white px-3 py-1 rounded-lg">
              <FiClock className="inline mr-1" />
              Mise à jour: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center">
            <FiFilter className="h-5 w-5 text-gray-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Filtres et sélection</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="relative">
                <FiHome className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={selectedRoom}
                  onChange={handleRoomChange}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Toutes les salles</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="relative">
                <FiActivity className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="OPEN">Sessions ouvertes</option>
                  <option value="CLOSED">Sessions fermées</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="relative">
                <FiRadio className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Toutes méthodes</option>
                  <option value="RFID">RFID seulement</option>
                  <option value="FINGERPRINT">Empreinte seulement</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Taux de présence</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceRate}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPresent}/{totalStudents} étudiant{totalStudents !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiPercent className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sessions ouvertes</p>
              <p className="text-2xl font-bold text-green-600">{openSessions}</p>
              <p className="text-xs text-gray-500 mt-1">
                {closedSessions} fermée{closedSessions !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <FiPlayCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Par RFID</p>
              <p className="text-2xl font-bold text-blue-600">{rfidCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPresent > 0 ? Math.round((rfidCount / totalPresent) * 100) : 0}% des présences
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiRadio className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Par empreinte</p>
              <p className="text-2xl font-bold text-purple-600">{fingerprintCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPresent > 0 ? Math.round((fingerprintCount / totalPresent) * 100) : 0}% des présences
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <FiUserCheck className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Étudiants absents</p>
              <p className="text-2xl font-bold text-gray-900">{totalAbsent}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalStudents > 0 ? Math.round((totalAbsent / totalStudents) * 100) : 0}% du total
              </p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <FiUsers className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Présences par salle */}
      {stats?.byRoom && Object.keys(stats.byRoom).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <FiTrendingUp className="mr-2 text-blue-600" />
              Présences par salle
            </h2>
            <div className="text-sm text-gray-500">
              Distribution des présences
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats.byRoom).map(([room, roomStats]) => {
              const total = roomStats.total || 1;
              const presentPercentage = Math.round((roomStats.present / total) * 100);
              const absentPercentage = Math.round((roomStats.absent / total) * 100);
              
              return (
                <div key={room} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{room}</h3>
                      <p className="text-sm text-gray-600">
                        {roomStats.present} présent{roomStats.present !== 1 ? 's' : ''} • {roomStats.absent} absent{roomStats.absent !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {presentPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${presentPercentage}%` }}
                    ></div>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-500">
                    <span>Présents: {presentPercentage}%</span>
                    <span>Absents: {absentPercentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des sessions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FiList className="mr-2 text-gray-600" />
                Sessions et présences
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Données pour le {formatDate(selectedDate)} • {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <FiFileText className="h-4 w-4" />
                Exporter JSON
              </button>
              <button
                onClick={() => sessionAPI.autoClose()}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <FiStopCircle className="h-4 w-4" />
                Fermer sessions finies
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {sessions.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {sessions.map(session => {
                const sessionAttendance = attendanceData[session.id] || {};
                const isExpanded = expandedSessions[session.id];
                const roomName = session.room_name || session.room;
                
                // Filtrer les étudiants par méthode
                const filteredAttendance = Object.entries(sessionAttendance).filter(([attendance]) => {
                  if (methodFilter === 'all') return true;
                  return attendance.method === methodFilter;
                });
                
                const presentCount = Object.values(sessionAttendance).filter(a => a.status === 'PRESENT').length;
                const absentCount = Object.values(sessionAttendance).filter(a => a.status === 'ABSENT').length;
                const totalCount = presentCount + absentCount;
                
                return (
                  <div key={session.id} className="p-5">
                    {/* En-tête de session */}
                    <div 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                      onClick={() => toggleSession(session.id)}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`p-2 rounded-lg ${session.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {session.status === 'OPEN' ? <FiPlayCircle className="h-5 w-5" /> : <FiStopCircle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{roomName}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {formatSessionTime(session.start, session.end)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              session.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {session.status === 'OPEN' ? 'OUVERTE' : 'FERMÉE'}
                            </span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                              <FiBook className="inline mr-1" size={10} />
                              {session.subject || 'N/A'}
                            </span>
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                              <FiUsers className="inline mr-1" size={10} />
                              {session.group || 'N/A'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center space-x-4">
                              <span className="text-green-600">
                                <FiUserCheck className="inline mr-1" size={14} />
                                {presentCount} présent{presentCount !== 1 ? 's' : ''}
                              </span>
                              <span className="text-red-600">
                                <FiUsers className="inline mr-1" size={14} />
                                {absentCount} absent{absentCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {session.id}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0}%
                          </div>
                          <div className="text-sm text-gray-500">Taux présence</div>
                        </div>
                        {session.status === 'OPEN' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseSession(session.id);
                            }}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                          >
                            Fermer
                          </button>
                        )}
                        {isExpanded ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
                      </div>
                    </div>
                    
                    {/* Détails de la session (dépliés) */}
                    {isExpanded && (
                      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <FiUsers className="mr-2" size={16} />
                            Liste des étudiants ({filteredAttendance.length})
                          </h4>
                          <div className="text-sm text-gray-500">
                            Groupe: {session.group} • {presentCount}/{totalCount} présent
                          </div>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Étudiant
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Groupe
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Statut
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Méthode
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Heure
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {filteredAttendance.length > 0 ? (
                              filteredAttendance.map(([studentId, attendance]) => {
                                const studentName = getStudentName(studentId);
                                const studentGroup = getStudentGroup(studentId);
                                return (
                                  <tr key={studentId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center">
                                        <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                          <FiUsers className="h-4 w-4 text-gray-600" />
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            {studentName}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            ID: {studentId}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                                        {studentGroup}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                                        attendance.status === 'PRESENT' 
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {attendance.status === 'PRESENT' ? 'PRÉSENT' : 'ABSENT'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {attendance.method && (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                                          attendance.method === 'RFID' 
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-purple-100 text-purple-800'
                                        }`}>
                                          {attendance.method === 'RFID' ? (
                                            <>
                                              <FiRadio className="mr-1 h-3 w-3" />
                                              RFID
                                            </>
                                          ) : (
                                            <>
                                              <FiUserCheck className="mr-1 h-3 w-3" />
                                              EMPREINTE
                                            </>
                                          )}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center text-sm text-gray-500">
                                        <FiClock className="h-4 w-4 mr-2" />
                                        {attendance.time || '—'}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                  <FiUserPlus className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                                  <p>Aucune donnée de présence pour cette session</p>
                                  {methodFilter !== 'all' && (
                                    <p className="text-sm mt-1">Essayez de changer le filtre de méthode</p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FiBarChart2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune session disponible
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Aucune session n'a été générée pour cette date et ces filtres.
                <br />
                Vérifiez l'emploi du temps ou cliquez sur "Générer sessions".
              </p>
              <button
                onClick={generateSessions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Générer les sessions pour {selectedDate}
              </button>
            </div>
          )}
        </div>
        
        {/* Footer Summary */}
        {sessions.length > 0 && (
          <div className="p-5 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-gray-600">
              <div className="mb-2 sm:mb-0">
                Total: <span className="font-semibold">{sessions.length}</span> session{sessions.length !== 1 ? 's' : ''} •{' '}
                <span className="font-semibold">{totalPresent}</span> présent{totalPresent !== 1 ? 's' : ''} •{' '}
                <span className="font-semibold">{totalAbsent}</span> absent{totalAbsent !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <FiPlayCircle className="h-4 w-4 text-green-500 mr-1" />
                  <span>{openSessions} ouverte{openSessions !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center">
                  <FiStopCircle className="h-4 w-4 text-gray-500 mr-1" />
                  <span>{closedSessions} fermée{closedSessions !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;