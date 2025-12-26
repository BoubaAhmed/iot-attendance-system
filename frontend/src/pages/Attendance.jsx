import React, { useState, useEffect } from 'react';
import sessionAPI from '../api/sessionsApi';
import roomAPI from '../api/roomsApi';
import studentAPI from '../api/studentsApi';
import attendanceAPI from '../api/attendanceApi';
import LoadingSpinner from '../components/LoadingSpinner';
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
  FiUserPlus,
  FiCheckCircle,
  FiXCircle,
  FiTarget,
  FiZap,
  FiSearch
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [expandedSessions, setExpandedSessions] = useState({});
  const [viewMode, setViewMode] = useState('sessions'); // 'sessions' or 'attendance'

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedRoom, selectedGroup, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch rooms
      const roomsRes = await roomAPI.getAll();
      if (roomsRes.data.success) {
        const roomsArray = Object.entries(roomsRes.data.data || {}).map(([id, data]) => ({
          id,
          ...data
        })).filter(room => room.active !== false);
        setRooms(roomsArray);
      }

      // Fetch students
      const studentsRes = await studentAPI.getAll();
      if (studentsRes.data.success) {
        const studentsArray = Object.entries(studentsRes.data.data || {}).map(([id, data]) => ({
          id,
          ...data
        }));
        setStudents(studentsArray);
        
        // Extract unique groups from students
        const uniqueGroups = [...new Set(studentsArray.map(student => student.group).filter(Boolean))];
        setGroups(uniqueGroups);
      }

      // Fetch sessions for the selected date
      const sessionsParams = { date: selectedDate };
      const sessionsRes = await sessionAPI.getAll(sessionsParams);
      
      if (sessionsRes.data.success) {
        const sessionsData = sessionsRes.data.data || {};
        let sessionsArray = [];
        
        if (Array.isArray(sessionsData)) {
          sessionsArray = sessionsData;
        } else {
          sessionsArray = Object.entries(sessionsData).map(([id, data]) => ({
            id,
            ...data
          }));
        }

        // Filter by room if selected
        let filteredSessions = sessionsArray;
        if (selectedRoom !== 'all') {
          filteredSessions = sessionsArray.filter(session => session.room === selectedRoom);
        }

        setSessions(filteredSessions);

        // Fetch attendance data
        const attendanceRes = await attendanceAPI.getAll({ date: selectedDate });
        
        if (attendanceRes.data.success) {
          let attendanceArray = attendanceRes.data.data || [];
          
          // Filter by group if selected
          if (selectedGroup !== 'all') {
            attendanceArray = attendanceArray.filter(record => record.group === selectedGroup);
          }

          setAttendanceData(attendanceArray);
          calculateStats(filteredSessions, attendanceArray);
        }
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Impossible de charger les données');
      setAttendanceData([]);
      setSessions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (sessionsList, attendanceRecords) => {
    // Count presents and absents
    const totalPresent = attendanceRecords.filter(record => record.status === 'PRESENT').length;
    const totalAbsent = attendanceRecords.filter(record => record.status === 'ABSENT').length;
    const totalStudents = totalPresent + totalAbsent;
    const attendanceRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

    // Count by room
    const byRoom = {};
    attendanceRecords.forEach(record => {
      const roomName = record.room || 'Inconnue';
      if (!byRoom[roomName]) {
        byRoom[roomName] = { present: 0, absent: 0 };
      }
      if (record.status === 'PRESENT') {
        byRoom[roomName].present++;
      } else {
        byRoom[roomName].absent++;
      }
    });

    // Count by group
    const byGroup = {};
    attendanceRecords.forEach(record => {
      const groupName = record.group_name || record.group || 'Inconnu';
      if (!byGroup[groupName]) {
        byGroup[groupName] = { present: 0, absent: 0 };
      }
      if (record.status === 'PRESENT') {
        byGroup[groupName].present++;
      } else {
        byGroup[groupName].absent++;
      }
    });

    // Sessions status
    const openSessions = sessionsList.filter(session => session.status === 'OPEN').length;
    const closedSessions = sessionsList.filter(session => session.status === 'CLOSED').length;

    setStats({
      totalPresent,
      totalAbsent,
      totalStudents,
      attendanceRate: attendanceRate.toFixed(1),
      byRoom,
      byGroup,
      openSessions,
      closedSessions,
      totalSessions: sessionsList.length
    });
  };

  const handleGenerateSessions = async () => {
    try {
      await sessionAPI.generate(selectedDate);
      toast.success('Sessions générées avec succès');
      fetchData();
    } catch (error) {
      console.error('Erreur génération sessions:', error);
      toast.error('Erreur lors de la génération des sessions');
    }
  };

  const handleCloseSession = async (sessionId) => {
    try {
      await sessionAPI.close(sessionId);
      toast.success('Session fermée avec succès');
      fetchData();
    } catch (error) {
      console.error('Erreur fermeture session:', error);
      toast.error('Erreur lors de la fermeture de la session');
    }
  };

  const handleAutoClose = async () => {
    try {
      await sessionAPI.autoClose();
      toast.success('Sessions terminées fermées avec succès');
      fetchData();
    } catch (error) {
      console.error('Erreur fermeture automatique:', error);
      toast.error('Erreur lors de la fermeture automatique');
    }
  };

  const handleExportCSV = () => {
    let csvContent = "Date,Heure,Salle,Groupe,Étudiant,Statut,Méthode\n";
    
    attendanceData.forEach(record => {
      csvContent += `"${record.date}","${record.created_at?.split('T')[1]?.substring(0, 8) || ''}","${record.room || ''}","${record.group_name || record.group || ''}","${record.student_name || ''}","${record.status}","${record.method || 'FINGERPRINT'}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `presences_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export CSV réussi');
  };

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
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

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(timeString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-800">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Gestion des présences
            </h1>
            <p className="text-gray-600">
              Suivi en temps réel des présences via empreintes digitales
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow text-gray-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <button
              onClick={handleGenerateSessions}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlayCircle className="h-4 w-4" />
              Générer sessions
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiDownload className="h-4 w-4" />
              Exporter CSV
            </button>
          </div>
        </div>

        {/* Date Display */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FiCalendar className="h-6 w-6 text-blue-200" />
                <h2 className="text-xl font-bold">Données des présences</h2>
              </div>
              <p className="text-blue-100">
                {formatDate(selectedDate)} • {attendanceData.length} enregistrements
              </p>
            </div>
            
            <div className="mt-4 lg:mt-0">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <FiUserCheck className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
                Présents
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.totalPresent || 0}
            </h3>
            <p className="text-gray-600 mb-4">Étudiants présents</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total étudiants</span>
                  <span className="font-semibold text-gray-900">{stats?.totalStudents || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <FiXCircle className="h-6 w-6 text-red-600" />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-red-100 text-red-700 rounded-full">
                Absents
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.totalAbsent || 0}
            </h3>
            <p className="text-gray-600 mb-4">Étudiants absents</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Taux d'absence</span>
                  <span className="font-semibold text-red-600">
                    {stats?.totalStudents > 0 
                      ? Math.round((stats.totalAbsent / stats.totalStudents) * 100) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiPercent className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex items-center">
                <FiTrendingUp className="h-5 w-5 text-blue-500 mr-1" />
                <span className="text-xs font-medium text-blue-600">
                  {stats?.attendanceRate || 0}%
                </span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.attendanceRate || 0}%
            </h3>
            <p className="text-gray-600 mb-4">Taux de présence</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Session</span>
                  <span className="font-semibold text-blue-600">
                    {stats?.totalSessions || 0} sessions
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FiRadio className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                ESP32
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.openSessions || 0}
            </h3>
            <p className="text-gray-600 mb-4">Sessions ouvertes</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Sessions fermées</span>
                  <span className="font-semibold text-purple-600">{stats?.closedSessions || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setViewMode('sessions')}
              className={`flex-1 py-4 px-6 text-center font-medium text-lg transition-colors ${
                viewMode === 'sessions'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FiCalendar className="h-5 w-5" />
                Sessions
              </div>
            </button>
            <button
              onClick={() => setViewMode('attendance')}
              className={`flex-1 py-4 px-6 text-center font-medium text-lg transition-colors ${
                viewMode === 'attendance'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FiUsers className="h-5 w-5" />
                Présences
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un étudiant..."
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  onChange={(e) => {
                    // Implement search functionality
                  }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FiFilter className="h-5 w-5 text-gray-500" />
                <select 
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-[180px]"
                >
                  <option value="all">Toutes les salles</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <FiUsers className="h-5 w-5 text-gray-500" />
                <select 
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-[180px]"
                >
                  <option value="all">Tous les groupes</option>
                  {groups.map((group, index) => (
                    <option key={index} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions View */}
      {viewMode === 'sessions' && (
        <div className="max-w-7xl mx-auto">
          {/* Sessions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {sessions.map(session => {
              const isExpanded = expandedSessions[session.id];
              const room = rooms.find(r => r.id === session.room);
              const attendanceForSession = attendanceData.filter(record => 
                record.group === session.group && record.date === selectedDate
              );
              
              const presentCount = attendanceForSession.filter(a => a.status === 'PRESENT').length;
              const absentCount = attendanceForSession.filter(a => a.status === 'ABSENT').length;
              const totalCount = presentCount + absentCount;
              const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
              
              return (
                <div key={session.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                  {/* Session Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-bold text-gray-900 text-xl">{session.subject || 'Session'}</h3>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                            session.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {session.status === 'OPEN' ? 'Ouverte' : 'Fermée'}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600 mb-1">
                          <FiHome className="h-4 w-4 mr-2" />
                          <span className="font-medium">{room?.name || session.room}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <FiUsers className="h-4 w-4 mr-2" />
                          <span>Groupe: {session.group}</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600 mb-1">{attendanceRate}%</div>
                        <div className="text-sm text-gray-500">Taux présence</div>
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <div className="text-sm text-gray-500 mb-1">Horaires</div>
                        <div className="font-medium">
                          {session.start} - {session.end}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <div className="text-sm text-gray-500 mb-1">Présences</div>
                        <div className="font-medium">
                          {presentCount} présent{presentCount !== 1 ? 's' : ''} • {absentCount} absent{absentCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Session Actions & Details */}
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center">
                          <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-sm text-gray-600">Présents</span>
                        </div>
                        <div className="flex items-center">
                          <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                          <span className="text-sm text-gray-600">Absents</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        {session.status === 'OPEN' && (
                          <button
                            onClick={() => handleCloseSession(session.id)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                          >
                            <FiStopCircle className="h-4 w-4" />
                            Fermer
                          </button>
                        )}
                        <button
                          onClick={() => toggleSession(session.id)}
                          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          {isExpanded ? 'Masquer' : 'Voir'} détails
                          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Session Details */}
                    {isExpanded && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="font-bold text-gray-900">Liste des présences</h4>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {attendanceForSession.length > 0 ? (
                            attendanceForSession.map((record, index) => {
                              const student = students.find(s => s.id === record.student_id);
                              
                              return (
                                <div key={index} className="p-4 hover:bg-gray-50">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                        record.status === 'PRESENT' ? 'bg-green-100' : 'bg-red-100'
                                      }`}>
                                        {record.status === 'PRESENT' ? (
                                          <FiCheckCircle className="h-5 w-5 text-green-600" />
                                        ) : (
                                          <FiXCircle className="h-5 w-5 text-red-600" />
                                        )}
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900">
                                          {student?.name || `Étudiant ${record.student_id}`}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          ID: {record.student_id} • Groupe: {record.group}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                        record.status === 'PRESENT' 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {record.status === 'PRESENT' ? 'PRÉSENT' : 'ABSENT'}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {formatTime(record.created_at)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-8 text-center">
                              <FiUserPlus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-gray-500">Aucune présence enregistrée pour cette session</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* No Sessions */}
          {sessions.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <FiCalendar className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Aucune session disponible</h3>
              <p className="text-gray-600 max-w-md mx-auto mb-8">
                Aucune session n'a été générée pour cette date. Générez les sessions à partir de l'emploi du temps.
              </p>
              <button
                onClick={handleGenerateSessions}
                className="inline-flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <FiPlayCircle className="h-5 w-5" />
                Générer les sessions
              </button>
            </div>
          )}
        </div>
      )}

      {/* Attendance View */}
      {viewMode === 'attendance' && (
        <div className="max-w-7xl mx-auto">
          {/* Attendance Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Liste des présences</h2>
                  <p className="text-gray-600">
                    {attendanceData.length} enregistrement{attendanceData.length !== 1 ? 's' : ''} pour le {formatDate(selectedDate)}
                  </p>
                </div>
                <div className="mt-3 lg:mt-0">
                  <button
                    onClick={handleAutoClose}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:from-red-700 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <FiStopCircle className="h-4 w-4" />
                    Fermer toutes les sessions
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Étudiant</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Groupe</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Salle</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Méthode</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Heure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendanceData.length > 0 ? (
                    attendanceData.map((record, index) => {
                      const student = students.find(s => s.id === record.student_id);
                      const room = rooms.find(r => r.name === record.room);
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                record.status === 'PRESENT' ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                {record.status === 'PRESENT' ? (
                                  <FiCheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <FiXCircle className="h-5 w-5 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {student?.name || `Étudiant ${record.student_id}`}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {record.student_id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {record.group_name || record.group}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <FiHome className="h-4 w-4 text-gray-400" />
                              <span>{record.room || '—'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                              record.status === 'PRESENT' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {record.status === 'PRESENT' ? 'PRÉSENT' : 'ABSENT'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <FiRadio className="h-4 w-4 text-purple-500" />
                              <span className="text-sm text-gray-700">Empreinte digitale</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <FiClock className="h-4 w-4" />
                              {formatTime(record.created_at)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <FiUsers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune présence enregistrée</h3>
                        <p className="text-gray-500">Aucune donnée de présence pour cette date et ces filtres.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Récapitulatif des statistiques</h2>
              <p className="text-gray-600">Synthèse des présences pour la journée</p>
            </div>
            <div className="mt-4 lg:mt-0">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats?.attendanceRate || 0}%</div>
                  <div className="text-sm text-gray-500">Taux global</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats?.totalPresent || 0}</div>
                  <div className="text-sm text-gray-500">Présents</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats?.totalAbsent || 0}</div>
                  <div className="text-sm text-gray-500">Absents</div>
                </div>
              </div>
            </div>
          </div>

          {/* Room Statistics */}
          {stats?.byRoom && Object.keys(stats.byRoom).length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiHome className="h-5 w-5 text-blue-600" />
                Présences par salle
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byRoom).map(([roomName, roomStats]) => {
                  const total = roomStats.present + roomStats.absent;
                  const rate = total > 0 ? Math.round((roomStats.present / total) * 100) : 0;
                  
                  return (
                    <div key={roomName} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">{roomName}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          rate >= 80 ? 'bg-green-100 text-green-800' :
                          rate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {rate}%
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Présents</span>
                          <span className="font-medium text-green-600">{roomStats.present}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Absents</span>
                          <span className="font-medium text-red-600">{roomStats.absent}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              rate >= 80 ? 'bg-green-500' :
                              rate >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Group Statistics */}
          {stats?.byGroup && Object.keys(stats.byGroup).length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiUsers className="h-5 w-5 text-purple-600" />
                Présences par groupe
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byGroup).map(([groupName, groupStats]) => {
                  const total = groupStats.present + groupStats.absent;
                  const rate = total > 0 ? Math.round((groupStats.present / total) * 100) : 0;
                  
                  return (
                    <div key={groupName} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">{groupName}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          rate >= 80 ? 'bg-green-100 text-green-800' :
                          rate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {rate}%
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Présents</span>
                          <span className="font-medium text-green-600">{groupStats.present}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Absents</span>
                          <span className="font-medium text-red-600">{groupStats.absent}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              rate >= 80 ? 'bg-green-500' :
                              rate >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">Système de présence actif</span>
            </div>
            <p className="text-sm text-gray-600">
              {attendanceData.length} présences • {sessions.length} sessions • {rooms.length} salles
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <p>Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;