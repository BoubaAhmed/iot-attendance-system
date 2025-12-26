import React, { useState, useEffect } from 'react';
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
  LineElement,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import dashboardAPI from '../api/dashboardApi';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  FiUsers,
  FiHome,
  FiCalendar,
  FiTrendingUp,
  FiActivity,
  FiRefreshCw,
  FiPlayCircle,
  FiStopCircle,
  FiBell,
  FiCheckCircle,
  FiXCircle,
  FiBarChart2,
  FiPieChart,
  FiDatabase
} from 'react-icons/fi';
import { MdDateRange, MdSchool } from 'react-icons/md';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    stats: {
      students: 0,
      rooms: 0,
      active_rooms: 0,
      groups: 0,
      subjects: 0,
      today_sessions: 0,
      active_sessions: 0,
      today_attendance: 0
    },
    analytics: {
      daily_attendance: [],
      room_utilization: [],
      group_attendance: [],
      summary: {
        total_present: 0,
        total_absent: 0,
        total_attendance: 0,
        overall_rate: 0
      },
      period: {
        start_date: '',
        end_date: '',
        days: 7
      }
    }
  });
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    fetchDashboardData(false); // initial load

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData(true); // background refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedPeriod]);


  const fetchDashboardData = async (isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setRefreshing(true);   // subtle refresh
    } else {
      setInitialLoading(true); // first load only
    }

    try {
      const [statsRes, analyticsRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getAnalytics({ days: selectedPeriod })
      ]);

      if (statsRes.data.success && analyticsRes.data.success) {
        const stats = statsRes.data.stats;
        const analytics = analyticsRes.data;

        const today = analytics.daily_attendance.find(
          d => d.date === new Date().toISOString().split('T')[0]
        ) || { present: 0, absent: 0, total: 0 };

        const todayAttendanceRate =
          today.total > 0 ? (today.present / today.total * 100).toFixed(1) : 0;

        setDashboardData({
          stats: {
            ...stats,
            today_attendance_rate: parseFloat(todayAttendanceRate)
          },
          analytics: {
            daily_attendance: analytics.daily_attendance,
            room_utilization: analytics.room_utilization,
            group_attendance: analytics.group_attendance,
            summary: analytics.summary,
            period: analytics.period
          }
        });

        setError(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Impossible de charger les données du tableau de bord');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };


  const handleGenerateSessions = async () => {
    try {
      // Implementation for generating sessions
      fetchDashboardData();
    } catch (error) {
      console.error('Error generating sessions:', error);
    }
  };

  const handleAutoClose = async () => {
    try {
      // Implementation for auto-closing sessions
      fetchDashboardData();
    } catch (error) {
      console.error('Error auto-closing sessions:', error);
    }
  };

  // Chart data with light theme colors
  const trendChartData = {
    labels: dashboardData.analytics.daily_attendance.map(day => 
      new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    ),
    datasets: [{
      label: 'Présence',
      data: dashboardData.analytics.daily_attendance.map(day => day.present),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#4f46e5',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
    }, {
      label: 'Absence',
      data: dashboardData.analytics.daily_attendance.map(day => day.absent),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#ef4444',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
    }]
  };

  const groupChartData = {
    labels: dashboardData.analytics.group_attendance.map(g => g.group_name),
    datasets: [{
      label: 'Taux de présence (%)',
      data: dashboardData.analytics.group_attendance.map(g => g.attendance_rate),
      backgroundColor: [
        'rgba(79, 70, 229, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(14, 165, 233, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(234, 179, 8, 0.8)',
        'rgba(249, 115, 22, 0.8)'
      ],
      borderColor: [
        '#4f46e5',
        '#3b82f6',
        '#0ea5e9',
        '#22c55e',
        '#eab308',
        '#f97316'
      ],
      borderWidth: 1,
    }]
  };

  const roomChartData = {
    labels: dashboardData.analytics.room_utilization.map(r => r.room_name),
    datasets: [{
      label: 'Utilisation (%)',
      data: dashboardData.analytics.room_utilization.map(r => r.utilization),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  const attendanceDoughnutData = {
    labels: ['Présents', 'Absents'],
    datasets: [{
      data: [
        dashboardData.analytics.summary.total_present,
        dashboardData.analytics.summary.total_absent
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ],
      borderColor: [
        '#22c55e',
        '#ef4444'
      ],
      borderWidth: 2,
    }]
  };

  if (initialLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
        <div className="max-w-4xl mx-auto text-center pt-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
            <p className="text-gray-600 mb-6">Veuillez vérifier votre connexion au serveur</p>
            <button
              onClick={fetchDashboardData}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-800">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Tableau de bord IoT - Présence Automatisée
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <FiCalendar className="text-blue-600" />
              {currentDate}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-2">
              <span className="text-sm text-gray-600 mr-2">Période:</span>
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                className="bg-transparent border-none text-gray-800 font-medium focus:outline-none focus:ring-0"
              >
                <option value={7}>7 jours</option>
                <option value={14}>14 jours</option>
                <option value={30}>30 jours</option>
              </select>
            </div>
            <button
              onClick={fetchDashboardData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow text-gray-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">Système IoT - Présence Automatique</h2>
              <p className="text-blue-100">
                {dashboardData.stats.active_rooms} sur {dashboardData.stats.rooms} salles connectées • 
                {dashboardData.stats.active_sessions} sessions actives
              </p>
            </div>
            <div className="flex items-center mt-4 md:mt-0">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-400 mr-2 animate-pulse"></div>
                <span className="font-medium">Système opérationnel</span>
              </div>
              <div className="ml-6 text-sm text-blue-100">
                Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Students Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FiUsers className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              Total
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {dashboardData.stats.students}
          </h3>
          <p className="text-gray-600 mb-4">Étudiants</p>
          <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-gray-500">Groupes</p>
                <p className="font-semibold text-gray-900">{dashboardData.stats.groups}</p>
              </div>
              <div>
                <p className="text-gray-500">Matières</p>
                <p className="font-semibold text-gray-900">{dashboardData.stats.subjects}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <FiCalendar className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
              Aujourd'hui
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {dashboardData.stats.today_sessions}
          </h3>
          <p className="text-gray-600 mb-4">Sessions</p>
          <div className="pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Sessions actives</span>
                <span className="font-semibold text-green-600">{dashboardData.stats.active_sessions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Présences enregistrées</span>
                <span className="font-semibold text-blue-600">{dashboardData.stats.today_attendance}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rooms Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <FiHome className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium text-green-600">
                {dashboardData.stats.active_rooms}/{dashboardData.stats.rooms}
              </span>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {dashboardData.stats.active_rooms}
          </h3>
          <p className="text-gray-600 mb-4">Salles connectées</p>
          <div className="pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total salles</span>
                <span className="font-semibold text-gray-900">{dashboardData.stats.rooms}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Taux de connexion</span>
                <span className="font-semibold text-purple-600">
                  {dashboardData.stats.rooms > 0 
                    ? Math.round((dashboardData.stats.active_rooms / dashboardData.stats.rooms) * 100) 
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Summary Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <FiTrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex items-center">
              <MdDateRange className="h-5 w-5 text-orange-500 mr-1" />
              <span className="text-xs font-medium text-orange-600">
                {dashboardData.analytics.period.days} jours
              </span>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {dashboardData.analytics.summary.overall_rate}%
          </h3>
          <p className="text-gray-600 mb-4">Taux de présence global</p>
          <div className="pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Présents</span>
                <span className="font-semibold text-green-600">{dashboardData.analytics.summary.total_present}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Absents</span>
                <span className="font-semibold text-red-600">{dashboardData.analytics.summary.total_absent}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Attendance Trend */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiActivity className="text-blue-600" />
                Tendance de présence quotidienne
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {dashboardData.analytics.period.start_date} au {dashboardData.analytics.period.end_date}
              </p>
            </div>
          </div>
          <div className="h-72">
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      color: '#374151',
                      font: {
                        size: 12
                      }
                    }
                  },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#111827',
                    bodyColor: '#374151',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                      color: '#6b7280'
                    }
                  },
                  x: {
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                      color: '#6b7280'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Attendance Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiPieChart className="text-green-600" />
                Distribution de présence
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Total: {dashboardData.analytics.summary.total_attendance} enregistrements
              </p>
            </div>
          </div>
          <div className="h-72 flex flex-col items-center justify-center">
            <div className="w-48 h-48 mb-4">
              <Doughnut
                data={attendanceDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: '#374151',
                        font: {
                          size: 12
                        }
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      titleColor: '#111827',
                      bodyColor: '#374151',
                      borderColor: '#e5e7eb',
                      borderWidth: 1,
                      padding: 12,
                      cornerRadius: 8
                    }
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <FiCheckCircle className="text-green-600" />
                  <span className="font-bold text-green-700">Présents</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.analytics.summary.total_present}</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <FiXCircle className="text-red-600" />
                  <span className="font-bold text-red-700">Absents</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.analytics.summary.total_absent}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Group Performance */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MdSchool className="text-indigo-600" />
                Performance par groupe
              </h2>
              <p className="text-sm text-gray-600 mt-1">Taux de présence moyen</p>
            </div>
          </div>
          <div className="h-72">
            <Bar
              data={groupChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#111827',
                    bodyColor: '#374151',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: function(context) {
                        const group = dashboardData.analytics.group_attendance[context.dataIndex];
                        return [
                          `Taux: ${context.parsed.y}%`,
                          `Étudiants: ${group.total_students}`,
                          `Niveau: ${group.level || 'Non spécifié'}`
                        ];
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                      color: '#6b7280',
                      callback: (value) => `${value}%`
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    },
                    ticks: {
                      color: '#6b7280'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Room Utilization */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiBarChart2 className="text-purple-600" />
                Utilisation des salles
              </h2>
              <p className="text-sm text-gray-600 mt-1">Pourcentage d'utilisation sur la période</p>
            </div>
          </div>
          <div className="h-72">
            <Bar
              data={roomChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#111827',
                    bodyColor: '#374151',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: function(context) {
                        const room = dashboardData.analytics.room_utilization[context.dataIndex];
                        return [
                          `Utilisation: ${context.parsed.y}%`,
                          `Sessions: ${room.sessions_count}`
                        ];
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                      color: '#6b7280',
                      callback: (value) => `${value}%`
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    },
                    ticks: {
                      color: '#6b7280'
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Data Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Room Details */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiHome className="text-purple-600" />
            Détails des salles
          </h3>
          <div className="space-y-3">
            {dashboardData.analytics.room_utilization.map((room, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-900">{room.room_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    room.utilization > 80 ? 'bg-green-100 text-green-800' :
                    room.utilization > 50 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {room.utilization}%
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Sessions: {room.sessions_count}</span>
                  <span>ID: {room.room_id}</span>
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        room.utilization > 80 ? 'bg-green-500' :
                        room.utilization > 50 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(room.utilization, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Group Details */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MdSchool className="text-indigo-600" />
            Détails des groupes
          </h3>
          <div className="space-y-3">
            {dashboardData.analytics.group_attendance.map((group, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-900">{group.group_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    group.attendance_rate > 80 ? 'bg-green-100 text-green-800' :
                    group.attendance_rate > 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {group.attendance_rate}%
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Étudiants: {group.total_students}</span>
                  <span>Niveau: {group.level || 'N/A'}</span>
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        group.attendance_rate > 80 ? 'bg-green-500' :
                        group.attendance_rate > 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(group.attendance_rate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiDatabase className="text-blue-600" />
            Actions système
          </h3>
          <div className="space-y-4">
            <button
              onClick={handleGenerateSessions}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 border border-blue-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FiPlayCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Générer sessions</p>
                  <p className="text-sm text-gray-600">Pour aujourd'hui</p>
                </div>
              </div>
              <span className="text-blue-600 font-medium">Exécuter</span>
            </button>
            
            <button
              onClick={handleAutoClose}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all duration-200 border border-green-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FiStopCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Fermer sessions</p>
                  <p className="text-sm text-gray-600">Auto-terminer</p>
                </div>
              </div>
              <span className="text-green-600 font-medium">Exécuter</span>
            </button>

            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">Actualisation automatique</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600">
                {autoRefresh 
                  ? 'Actualisation automatique toutes les 30 secondes' 
                  : 'Actualisation manuelle uniquement'}
              </p>
            </div>

            <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Période analysée</h4>
              <p className="text-sm text-gray-600">
                {dashboardData.analytics.period.start_date} au {dashboardData.analytics.period.end_date}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {dashboardData.analytics.period.days} jours • {dashboardData.analytics.summary.total_attendance} enregistrements
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">Système IoT opérationnel</span>
            </div>
            <p className="text-sm text-gray-600">
              ESP32 & Firebase • Version 1.0 • Dashboard mis à jour à {new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <p>Données en temps réel • {dashboardData.stats.students} étudiants • {dashboardData.stats.rooms} salles</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;