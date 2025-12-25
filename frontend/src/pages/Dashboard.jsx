import React, { useState, useEffect, useCallback } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import { sessionAPI, attendanceAPI, roomAPI, studentAPI, groupAPI, subjectAPI } from '../api/api';
import StatsCard from '../components/StatsCard';
// import SessionCard from '../components/SessionCard';
// import RoomStatusCard from '../components/RoomStatusCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  FiUsers,
  FiHome,
  FiClock,
  FiCheckCircle,
  FiWifi,
  FiAlertTriangle,
  FiBarChart2,
  FiPieChart,
  FiMapPin,
  FiRadio,
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiBook,
  FiUserCheck,
  FiRefreshCw,
  FiPlayCircle,
  FiPauseCircle,
  FiStopCircle,
  FiDroplet,
  FiCpu,
  FiBookOpen,
  FiList,
  FiGrid,
  FiEye,
  FiArchive,
  FiUserX,
  FiPercent,
  FiAward,
  FiThermometer,
  FiBell,
  FiActivity as FiAct,
  FiZap,
  FiTarget,
  FiCheckSquare,
  FiXCircle,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
  FiExternalLink
} from 'react-icons/fi';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalStudents: 0,
      totalRooms: 0,
      totalGroups: 0,
      totalSubjects: 0,
      todaySessions: 0,
      activeSessions: 0,
      closedSessions: 0,
      scheduledSessions: 0,
      totalPresent: 0,
      totalAbsent: 0,
      attendanceRate: 0,
      onlineRooms: 0
    },
    attendance: {
      byRoom: {},
      byMethod: { RFID: 0, FINGERPRINT: 0, MANUAL: 0 },
      byGroup: {},
      bySubject: {},
      dailyTrend: []
    },
    sessions: [],
    rooms: [],
    students: [],
    groups: [],
    subjects: [],
    recentAttendance: [],
    systemStatus: {
      health: 'healthy',
      lastUpdate: null,
      apiStatus: 'online',
      firebaseStatus: 'connected'
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('today');
  const [viewMode, setViewMode] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [
        studentsRes,
        roomsRes,
        groupsRes,
        subjectsRes,
        sessionsRes,
        attendanceRes,
        dailyStatsRes
      ] = await Promise.all([
        studentAPI.getAll(),
        roomAPI.getAll(),
        groupAPI.getAll(),
        subjectAPI.getAll(),
        sessionAPI.getAll({ date: new Date().toISOString().split('T')[0] }),
        attendanceAPI.getAll({ date: new Date().toISOString().split('T')[0] }),
        attendanceAPI.getDailyStats()
      ]);

      // Process data
      const students = studentsRes.data.success ? Object.values(studentsRes.data.data || {}).filter(s => s.active !== false) : [];
      const rooms = roomsRes.data.success ? Object.values(roomsRes.data.data || {}).filter(r => r.active !== false) : [];
      const groups = groupsRes.data.success ? Object.values(groupsRes.data.data || {}) : [];
      const subjects = subjectsRes.data.success ? Object.values(subjectsRes.data.data || {}) : [];
      const sessions = sessionsRes.data.success ? Object.values(sessionsRes.data.data || {}) : [];
      const attendance = attendanceRes.data.success ? attendanceRes.data.data || {} : {};
      const dailyStats = dailyStatsRes.data.success ? dailyStatsRes.data.stats || {} : {};

      // Calculate statistics
      const totalStudents = students.length;
      const totalRooms = rooms.length;
      const totalGroups = groups.length;
      const totalSubjects = subjects.length;

      const todaySessions = sessions.length;
      const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length;
      const closedSessions = sessions.filter(s => s.status === 'CLOSED').length;
      const scheduledSessions = sessions.filter(s => s.status === 'SCHEDULED').length;

      // Calculate attendance
      let totalPresent = 0;
      let totalAbsent = 0;
      const byRoom = {};
      const byMethod = { RFID: 0, FINGERPRINT: 0, MANUAL: 0 };
      const byGroup = {};
      const bySubject = {};
      const recentAttendance = [];

      // Process attendance data
      Object.entries(attendance).forEach(([sessionId, sessionAttendance]) => {
        const session = sessions.find(s => s.id === sessionId) || {};
        
        Object.entries(sessionAttendance).forEach(([studentId, record]) => {
          const student = students.find(s => s.id === studentId);
          
          if (record.status === 'PRESENT') {
            totalPresent++;
            
            // Count by method
            if (record.method) {
              byMethod[record.method] = (byMethod[record.method] || 0) + 1;
            }
            
            // Count by room
            if (session.room) {
              byRoom[session.room] = {
                present: (byRoom[session.room]?.present || 0) + 1,
                absent: byRoom[session.room]?.absent || 0,
                total: (byRoom[session.room]?.total || 0) + 1
              };
            }
            
            // Count by group
            if (student?.group) {
              byGroup[student.group] = {
                present: (byGroup[student.group]?.present || 0) + 1,
                absent: byGroup[student.group]?.absent || 0,
                total: (byGroup[student.group]?.total || 0) + 1
              };
            }
            
            // Count by subject
            if (session.subject) {
              bySubject[session.subject] = {
                present: (bySubject[session.subject]?.present || 0) + 1,
                absent: bySubject[session.subject]?.absent || 0,
                total: (bySubject[session.subject]?.total || 0) + 1
              };
            }
            
            // Add to recent attendance
            recentAttendance.push({
              id: `${sessionId}_${studentId}`,
              studentName: student?.name || 'Unknown',
              studentId,
              sessionId,
              room: session.room_name || session.room,
              subject: session.subject_name || session.subject,
              method: record.method,
              time: record.time,
              timestamp: record.recorded_at
            });
          } else if (record.status === 'ABSENT') {
            totalAbsent++;
            
            // Count by room
            if (session.room) {
              byRoom[session.room] = {
                present: byRoom[session.room]?.present || 0,
                absent: (byRoom[session.room]?.absent || 0) + 1,
                total: (byRoom[session.room]?.total || 0) + 1
              };
            }
            
            // Count by group
            if (student?.group) {
              byGroup[student.group] = {
                present: byGroup[student.group]?.present || 0,
                absent: (byGroup[student.group]?.absent || 0) + 1,
                total: (byGroup[student.group]?.total || 0) + 1
              };
            }
            
            // Count by subject
            if (session.subject) {
              bySubject[session.subject] = {
                present: bySubject[session.subject]?.present || 0,
                absent: (bySubject[session.subject]?.absent || 0) + 1,
                total: (bySubject[session.subject]?.total || 0) + 1
              };
            }
          }
        });
      });

      // Calculate attendance rate
      const totalAttendance = totalPresent + totalAbsent;
      const attendanceRate = totalAttendance > 0 ? (totalPresent / totalAttendance) * 100 : 0;

      // Calculate online rooms
      const onlineRooms = rooms.filter(room => {
        if (!room.last_seen) return false;
        const lastSeen = new Date(room.last_seen);
        const now = new Date();
        const diffMinutes = (now - lastSeen) / (1000 * 60);
        return diffMinutes < 5;
      }).length;

      // Get daily trend from API
      const dailyTrend = dailyStatsRes.data.success ? 
        (dailyStatsRes.data.dailyTrend || []) : 
        [];

      // Check for notifications
      const newNotifications = [];
      if (activeSessions === 0 && scheduledSessions > 0) {
        newNotifications.push({
          id: 'no_active_sessions',
          type: 'warning',
          message: `${scheduledSessions} sessions programmées non démarrées`,
          timestamp: new Date().toISOString()
        });
      }

      if (onlineRooms < totalRooms) {
        newNotifications.push({
          id: 'rooms_offline',
          type: 'error',
          message: `${totalRooms - onlineRooms} salles hors ligne`,
          timestamp: new Date().toISOString()
        });
      }

      setDashboardData({
        stats: {
          totalStudents,
          totalRooms,
          totalGroups,
          totalSubjects,
          todaySessions,
          activeSessions,
          closedSessions,
          scheduledSessions,
          totalPresent,
          totalAbsent,
          attendanceRate: parseFloat(attendanceRate.toFixed(1)),
          onlineRooms
        },
        attendance: {
          byRoom,
          byMethod,
          byGroup,
          bySubject,
          dailyTrend
        },
        sessions: sessions.slice(0, 10), // Last 10 sessions
        rooms: rooms.slice(0, 5), // Last 5 rooms
        students: students.slice(0, 5), // Last 5 students
        groups: groups.slice(0, 5), // Last 5 groups
        subjects: subjects.slice(0, 5), // Last 5 subjects
        recentAttendance: recentAttendance.slice(0, 10).sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        ),
        systemStatus: {
          health: 'healthy',
          lastUpdate: new Date().toISOString(),
          apiStatus: 'online',
          firebaseStatus: 'connected'
        }
      });

      setNotifications(newNotifications);
      setError(null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Impossible de charger les données du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSessions = async () => {
    try {
      await sessionAPI.generate(new Date().toISOString().split('T')[0]);
      fetchDashboardData();
    } catch (error) {
      console.error('Error generating sessions:', error);
    }
  };

  const handleAutoClose = async () => {
    try {
      await sessionAPI.autoClose();
      fetchDashboardData();
    } catch (error) {
      console.error('Error auto-closing sessions:', error);
    }
  };

  const handleStartSession = async (sessionId) => {
    try {
      await sessionAPI.updateStatus(sessionId, 'ACTIVE');
      fetchDashboardData();
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleCloseSession = async (sessionId) => {
    try {
      await sessionAPI.close(sessionId);
      fetchDashboardData();
    } catch (error) {
      console.error('Error closing session:', error);
    }
  };

  // Chart data
  const roomChartData = {
    labels: Object.keys(dashboardData.attendance.byRoom).slice(0, 6),
    datasets: [
      {
        label: 'Présences',
        data: Object.keys(dashboardData.attendance.byRoom).slice(0, 6).map(room => 
          dashboardData.attendance.byRoom[room]?.present || 0
        ),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false,
      },
      {
        label: 'Absences',
        data: Object.keys(dashboardData.attendance.byRoom).slice(0, 6).map(room => 
          dashboardData.attendance.byRoom[room]?.absent || 0
        ),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false,
      }
    ]
  };

  const methodChartData = {
    labels: ['RFID', 'Empreinte digitale', 'Manuel'],
    datasets: [{
      data: [
        dashboardData.attendance.byMethod.RFID || 0,
        dashboardData.attendance.byMethod.FINGERPRINT || 0,
        dashboardData.attendance.byMethod.MANUAL || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(249, 115, 22, 0.8)'
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(59, 130, 246, 1)',
        'rgba(249, 115, 22, 1)'
      ],
      borderWidth: 1,
      cutout: '70%',
      borderRadius: 8,
    }]
  };

  const trendChartData = {
    labels: dashboardData.attendance.dailyTrend.map(day => day.day),
    datasets: [
      {
        label: 'Taux de présence',
        data: dashboardData.attendance.dailyTrend.map(day => day.rate),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const sessionStatusData = {
    labels: ['Programmées', 'Actives', 'Fermées'],
    datasets: [{
      data: [
        dashboardData.stats.scheduledSessions,
        dashboardData.stats.activeSessions,
        dashboardData.stats.closedSessions
      ],
      backgroundColor: [
        'rgba(156, 163, 175, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)'
      ],
      borderColor: [
        'rgba(156, 163, 175, 1)',
        'rgba(34, 197, 94, 1)',
        'rgba(59, 130, 246, 1)'
      ],
      borderWidth: 1,
    }]
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Tableau de bord IoT
            </h1>
            <p className="text-gray-600 mt-2">
              Système de présence automatisé basé sur ESP32 • {currentDate}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchDashboardData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <button
              onClick={handleGenerateSessions}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow"
            >
              <FiPlayCircle className="h-4 w-4" />
              Générer sessions
            </button>
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-gray-600">Système actif</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FiBell className="h-5 w-5 text-yellow-500" />
                  Notifications ({notifications.length})
                </h3>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {showNotifications ? 'Masquer' : 'Voir'}
                </button>
              </div>
              {showNotifications && (
                <div className="space-y-2">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        notification.type === 'error'
                          ? 'border-red-500 bg-red-50'
                          : 'border-yellow-500 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.message}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <StatsCard
          title="Sessions aujourd'hui"
          value={dashboardData.stats.todaySessions}
          icon={FiCalendar}
          color="blue"
          change={`${dashboardData.stats.activeSessions} actives`}
          trend="up"
          detail="Basé sur l'emploi du temps"
        />
        <StatsCard
          title="Taux de présence"
          value={`${dashboardData.stats.attendanceRate}%`}
          icon={FiPercent}
          color="green"
          change={`${dashboardData.stats.totalPresent} sur ${dashboardData.stats.totalPresent + dashboardData.stats.totalAbsent}`}
          trend={dashboardData.stats.attendanceRate > 80 ? "up" : "down"}
          detail="Global aujourd'hui"
        />
        <StatsCard
          title="Salles connectées"
          value={dashboardData.stats.onlineRooms}
          icon={FiWifi}
          color="purple"
          change={`${dashboardData.stats.totalRooms} au total`}
          trend={dashboardData.stats.onlineRooms === dashboardData.stats.totalRooms ? "up" : "down"}
          detail="Dernière activité < 5min"
        />
        <StatsCard
          title="Étudiants"
          value={dashboardData.stats.totalStudents}
          icon={FiUsers}
          color="orange"
          change={`${dashboardData.stats.totalGroups} groupes`}
          trend="stable"
          detail="Actifs dans le système"
        />
      </div>

      {/* Detailed Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <FiCheckSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Présences</p>
              <p className="text-xl font-bold text-gray-900">{dashboardData.stats.totalPresent}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <FiXCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Absences</p>
              <p className="text-xl font-bold text-gray-900">{dashboardData.stats.totalAbsent}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <FiBookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Matières</p>
              <p className="text-xl font-bold text-gray-900">{dashboardData.stats.totalSubjects}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg mr-3">
              <FiTarget className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Session en cours</p>
              <p className="text-xl font-bold text-gray-900">{dashboardData.stats.activeSessions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Room Attendance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiHome className="text-blue-600" />
                Présences par salle
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Distribution des présences/absences dans chaque salle
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-xs text-gray-600">Présences</span>
              </div>
              <div className="flex items-center ml-3">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <span className="text-xs text-gray-600">Absences</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <Bar 
              data={roomChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'top',
                    labels: {
                      boxWidth: 12,
                      padding: 20,
                      usePointStyle: true,
                    }
                  },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#111827',
                    bodyColor: '#374151',
                    borderColor: '#E5E7EB',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: function(context) {
                        return `${context.dataset.label}: ${context.raw}`;
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)',
                      drawBorder: false
                    },
                    ticks: {
                      padding: 10
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    },
                    ticks: {
                      maxRotation: 45
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Authentication Methods */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiUserCheck className="text-green-600" />
                Méthodes d'authentification
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Répartition des méthodes utilisées pour les présences
              </p>
            </div>
            <div className="text-sm px-3 py-1 bg-gray-100 rounded-full text-gray-600">
              Total: {dashboardData.stats.totalPresent}
            </div>
          </div>
          <div className="h-64 flex items-center">
            <div className="w-1/2">
              <Doughnut 
                data={methodChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const total = dashboardData.stats.totalPresent;
                          const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                          return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <div className="w-1/2 pl-6">
              <div className="space-y-4">
                {[
                  { label: 'RFID', value: dashboardData.attendance.byMethod.RFID, color: 'bg-green-500' },
                  { label: 'Empreinte digitale', value: dashboardData.attendance.byMethod.FINGERPRINT, color: 'bg-blue-500' },
                  { label: 'Manuel', value: dashboardData.attendance.byMethod.MANUAL, color: 'bg-orange-500' }
                ].map((item, index) => {
                  const percentage = dashboardData.stats.totalPresent > 0 ? 
                    Math.round((item.value / dashboardData.stats.totalPresent) * 100) : 0;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <span className="text-sm font-bold text-gray-900">{item.value}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${item.color} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 text-right">{percentage}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiTrendingUp className="text-purple-600" />
                Tendance des présences (7 jours)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Évolution du taux de présence sur la semaine
              </p>
            </div>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>
          <div className="h-64">
            <Line 
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                      label: function(context) {
                        return `Taux: ${context.raw}%`;
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      callback: function(value) {
                        return value + '%';
                      },
                      padding: 10
                    },
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)',
                      drawBorder: false
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    },
                    ticks: {
                      padding: 10
                    }
                  }
                },
                interaction: {
                  intersect: false,
                  mode: 'index'
                }
              }}
            />
          </div>
        </div>

        {/* Session Status */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiClock className="text-blue-600" />
                Statut des sessions
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Répartition des sessions aujourd'hui
              </p>
            </div>
          </div>
          <div className="h-64 flex items-center">
            <div className="w-1/2">
              <Pie 
                data={sessionStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const total = dashboardData.stats.todaySessions;
                          const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                          return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <div className="w-1/2 pl-6">
              <div className="space-y-4">
                {[
                  { label: 'Programmées', value: dashboardData.stats.scheduledSessions, color: 'bg-gray-400' },
                  { label: 'Actives', value: dashboardData.stats.activeSessions, color: 'bg-green-500' },
                  { label: 'Fermées', value: dashboardData.stats.closedSessions, color: 'bg-blue-500' }
                ].map((item, index) => {
                  const percentage = dashboardData.stats.todaySessions > 0 ? 
                    Math.round((item.value / dashboardData.stats.todaySessions) * 100) : 0;
                  return (
                    <div key={index} className="p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-center mb-2">
                        <div className={`w-3 h-3 rounded-full ${item.color} mr-2`}></div>
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-gray-900">{item.value}</span>
                        <span className="text-sm text-gray-500">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Rooms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiActivity className="text-orange-600" />
                Activité récente
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Dernières présences enregistrées
              </p>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              Voir tout
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {dashboardData.recentAttendance.length > 0 ? (
              dashboardData.recentAttendance.map((item) => (
                <div key={item.id} className="flex items-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-lg mr-3 ${
                    item.method === 'RFID' ? 'bg-green-100 text-green-600' :
                    item.method === 'FINGERPRINT' ? 'bg-blue-100 text-blue-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {item.method === 'RFID' ? <FiRadio className="h-4 w-4" /> :
                     item.method === 'FINGERPRINT' ? <FiUserCheck className="h-4 w-4" /> :
                     <FiCheckSquare className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.studentName}</p>
                    <p className="text-sm text-gray-500">
                      {item.subject} • {item.room} • {item.time}
                    </p>
                  </div>
                  <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    Présent
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FiClock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucune activité récente</p>
              </div>
            )}
          </div>
        </div>

        {/* Rooms Status */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiWifi className="text-purple-600" />
                Statut des salles
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Connectivité des ESP32 en temps réel
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                <span className="text-xs text-gray-600">En ligne</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-gray-300 mr-2"></div>
                <span className="text-xs text-gray-600">Hors ligne</span>
              </div>
            </div>
          </div>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {dashboardData.rooms.length > 0 ? (
              dashboardData.rooms.map((room) => {
                const isOnline = room.last_seen && 
                  (new Date() - new Date(room.last_seen)) / (1000 * 60) < 5;
                const roomStats = dashboardData.attendance.byRoom[room.name] || { present: 0, total: 0 };
                const presenceRate = roomStats.total > 0 ? Math.round((roomStats.present / roomStats.total) * 100) : 0;
                
                return (
                  <div key={room.id} className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="font-semibold text-gray-900">{room.name}</h3>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                            isOnline 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isOnline ? '● Connectée' : '○ Déconnectée'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <FiMapPin className="mr-1 h-4 w-4" />
                          {room.location || 'Localisation non définie'}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <FiCpu className="mr-1 h-4 w-4" />
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {room.esp32_id || 'ESP32_ID'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Taux de présence</span>
                        <span className="font-bold text-blue-600">{presenceRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            presenceRate > 80 ? 'bg-green-500' :
                            presenceRate > 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${presenceRate}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{roomStats.present} présences</span>
                        <span>{roomStats.total} étudiants</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <FiHome className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucune salle configurée</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Actions rapides</h3>
            <p className="text-sm text-gray-600">Gestion du système IoT</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Actualisation automatique
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={handleGenerateSessions}
            className="bg-white border border-gray-300 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
          >
            <div className="p-2 bg-blue-100 rounded-lg inline-block mb-3 group-hover:bg-blue-200">
              <FiPlayCircle className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-medium text-gray-900">Générer sessions</p>
            <p className="text-xs text-gray-500 mt-1">Créer pour aujourd'hui</p>
          </button>
          <button
            onClick={handleAutoClose}
            className="bg-white border border-gray-300 rounded-xl p-4 text-center hover:border-green-300 hover:bg-green-50 transition-all duration-200 group"
          >
            <div className="p-2 bg-green-100 rounded-lg inline-block mb-3 group-hover:bg-green-200">
              <FiStopCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-medium text-gray-900">Fermer sessions</p>
            <p className="text-xs text-gray-500 mt-1">Terminées automatiquement</p>
          </button>
          <button
            onClick={() => setViewMode('reports')}
            className="bg-white border border-gray-300 rounded-xl p-4 text-center hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
          >
            <div className="p-2 bg-purple-100 rounded-lg inline-block mb-3 group-hover:bg-purple-200">
              <FiBarChart2 className="h-6 w-6 text-purple-600" />
            </div>
            <p className="font-medium text-gray-900">Rapports</p>
            <p className="text-xs text-gray-500 mt-1">Analyses détaillées</p>
          </button>
          <button
            onClick={() => setViewMode('settings')}
            className="bg-white border border-gray-300 rounded-xl p-4 text-center hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
          >
            <div className="p-2 bg-orange-100 rounded-lg inline-block mb-3 group-hover:bg-orange-200">
              <FiZap className="h-6 w-6 text-orange-600" />
            </div>
            <p className="font-medium text-gray-900">Paramètres</p>
            <p className="text-xs text-gray-500 mt-1">Configuration système</p>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
              <span>Système opérationnel</span>
            </div>
            <div>
              Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
            </div>
          </div>
          <div className="mt-2 md:mt-0">
            Système IoT • Version 3.0.0 • Powered by ESP32
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;