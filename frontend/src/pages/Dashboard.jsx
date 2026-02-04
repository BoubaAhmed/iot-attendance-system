import React, { useState, useEffect } from "react";
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
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import dashboardAPI from "../api/dashboardApi";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  FiUsers,
  FiHome,
  FiCalendar,
  FiTrendingUp,
  FiActivity,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiBarChart2,
  FiPieChart,
  FiClock,
  FiZap,
  FiCpu,
} from "react-icons/fi";
import { MdDateRange, MdSchool, MdMeetingRoom } from "react-icons/md";

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
  Filler,
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
      today_attendance: 0,
    },
    analytics: {
      daily_attendance: [],
      room_utilization: [],
      group_attendance: [],
      summary: {
        total_present: 0,
        total_absent: 0,
        total_attendance: 0,
        overall_rate: 0,
      },
      period: {
        start_date: "",
        end_date: "",
        days: 7,
      },
    },
  });
  const [error, setError] = useState(null);
  const [autoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [initialLoading, setInitialLoading] = useState(true);

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDashboardData(true);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedPeriod]);

  const fetchDashboardData = async (background = false) => {
    if (!background) {
      setInitialLoading(true);
    }

    try {
      const [statsRes, analyticsRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getAnalytics({ days: selectedPeriod }),
      ]);

      if (statsRes.data.success && analyticsRes.data.success) {
        const stats = statsRes.data.stats;
        const analytics = analyticsRes.data;

        setDashboardData({
          stats: {
            ...stats,
            today_attendance_rate: stats.today_attendance,
          },
          analytics: {
            daily_attendance: analytics.daily_attendance,
            room_utilization: analytics.room_utilization,
            group_attendance: analytics.group_attendance,
            summary: analytics.summary,
            period: analytics.period,
          },
        });
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (error) {
      setError(`Impossible de charger les données du tableau de bord: ${error?.message}`);
    } finally {
      setInitialLoading(false);
    }
  };

  // Chart data with cold color palette
  const trendChartData = {
    labels: dashboardData.analytics.daily_attendance.map((day) =>
      new Date(day.date).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
      }),
    ),
    datasets: [
      {
        label: "Présence",
        data: dashboardData.analytics.daily_attendance.map(
          (day) => day.present,
        ),
        borderColor: "#1e40af",
        backgroundColor: "rgba(30, 64, 175, 0.1)",
        tension: 0.3,
        fill: true,
        pointBackgroundColor: "#1e40af",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 3,
        borderWidth: 2,
      },
      {
        label: "Absence",
        data: dashboardData.analytics.daily_attendance.map((day) => day.absent),
        borderColor: "#475569",
        backgroundColor: "rgba(71, 85, 105, 0.1)",
        tension: 0.3,
        fill: true,
        pointBackgroundColor: "#475569",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 3,
        borderWidth: 2,
      },
    ],
  };

  const groupChartData = {
    labels: dashboardData.analytics.group_attendance.map((g) => g.group_name),
    datasets: [
      {
        label: "Taux de présence (%)",
        data: dashboardData.analytics.group_attendance.map(
          (g) => g.attendance_rate,
        ),
        backgroundColor: [
          "rgba(30, 64, 175, 0.8)",
          "rgba(37, 99, 235, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(96, 165, 250, 0.8)",
          "rgba(6, 182, 212, 0.8)",
          "rgba(8, 145, 178, 0.8)",
        ],
        borderColor: [
          "#1e40af",
          "#2563eb",
          "#3b82f6",
          "#60a5fa",
          "#06b6d4",
          "#0891b2",
        ],
        borderWidth: 1,
      },
    ],
  };

  const roomChartData = {
    labels: dashboardData.analytics.room_utilization.map((r) => r.room_name),
    datasets: [
      {
        label: "Utilisation (%)",
        data: dashboardData.analytics.room_utilization.map(
          (r) => r.utilization,
        ),
        backgroundColor: "rgba(14, 165, 233, 0.8)",
        borderColor: "#0ea5e9",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const attendanceDoughnutData = {
    labels: ["Présents", "Absents"],
    datasets: [
      {
        data: [
          dashboardData.analytics.summary.total_present,
          dashboardData.analytics.summary.total_absent,
        ],
        backgroundColor: ["rgba(30, 64, 175, 0.8)", "rgba(71, 85, 105, 0.8)"],
        borderColor: ["#1e40af", "#475569"],
        borderWidth: 2,
      },
    ],
  };

  if (initialLoading) {
    return (
      <LoadingSpinner
        message={"Chargement du tableau de bord..."}
        sub={"Synchronisation avec Firebase"}
        className="min-h-screen"
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto text-center pt-20">
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
            <p className="text-gray-600 mb-6">
              Vérifiez la connexion au serveur et réessayez
            </p>
            <button
              onClick={fetchDashboardData}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              Réessayer la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-2">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FiCpu className="w-7 h-7 text-blue-600" />
              Tableau de Bord IoT
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <FiCalendar className="text-blue-600" />
              {currentDate}
              {lastUpdated && (
                <span className="text-sm text-gray-500 ml-4">
                  <FiClock className="inline mr-1" />
                  Dernière mise à jour: {lastUpdated.toLocaleTimeString("fr-FR")}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
              <FiClock className="text-gray-400 mr-2" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                className="bg-transparent border-none text-gray-700 font-medium focus:outline-none focus:ring-0 text-sm"
              >
                <option value={7}>7 jours</option>
                <option value={14}>14 jours</option>
                <option value={30}>30 jours</option>
              </select>
            </div>
            <button
              onClick={() => fetchDashboardData()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        </div>

        {/* System Status Banner */}
        <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-md mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FiZap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  Système IoT - Surveillance en Temps Réel
                </h2>
                <p className="text-blue-100 text-sm">
                  {dashboardData.stats.active_rooms} salles actives sur{" "}
                  {dashboardData.stats.rooms} •{" "}
                  {dashboardData.stats.active_sessions} sessions en cours
                </p>
              </div>
            </div>
            <div className="mt-3 md:mt-0 flex items-center gap-4">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
                <span className="text-sm">Connecté à Firebase</span>
              </div>
              <div className="text-sm text-blue-100">
                {new Date().toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Students Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiUsers className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              ÉTUDIANTS
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {dashboardData.stats.students}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Inscrits au système</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {dashboardData.stats.groups}
              </div>
              <div>Groupes</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {dashboardData.stats.subjects}
              </div>
              <div>Matières</div>
            </div>
          </div>
        </div>

        {/* Rooms Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <MdMeetingRoom className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">
              SALLES
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {dashboardData.stats.active_rooms}
            <span className="text-sm font-normal text-gray-500 ml-1">
              / {dashboardData.stats.rooms}
            </span>
          </h3>
          <p className="text-gray-500 text-sm mb-3">Connectées</p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Taux de connexion</span>
              <span className="text-sm font-semibold text-teal-600">
                {dashboardData.stats.rooms > 0
                  ? Math.round(
                      (dashboardData.stats.active_rooms /
                        dashboardData.stats.rooms) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Sessions Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FiCalendar className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              SESSIONS
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {dashboardData.stats.today_sessions}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Aujourd'hui</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-green-600">
                {dashboardData.stats.active_sessions}
              </div>
              <div>Actives</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-600">
                {dashboardData.stats.today_attendance}
              </div>
              <div>Présences</div>
            </div>
          </div>
        </div>

        {/* Attendance Rate Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <FiTrendingUp className="h-5 w-5 text-cyan-600" />
            </div>
            <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded">
              PRÉSENCE
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {dashboardData.analytics.summary.overall_rate}%
          </h3>
          <p className="text-gray-500 text-sm mb-3">
            Sur {dashboardData.analytics.period.days} jours
          </p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-blue-600" />
                <span className="text-xs text-gray-500">Présents</span>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {dashboardData.analytics.summary.total_present}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Daily Attendance Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiActivity className="text-blue-600" />
                Tendance Quotidienne
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {dashboardData.analytics.period.start_date} -{" "}
                {dashboardData.analytics.period.end_date}
              </p>
            </div>
          </div>
          <div className="h-64">
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                    labels: {
                      color: "#374151",
                      font: { size: 12 },
                      padding: 20,
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(0, 0, 0, 0.05)" },
                    ticks: { color: "#6b7280" },
                  },
                  x: {
                    grid: { color: "rgba(0, 0, 0, 0.05)" },
                    ticks: { color: "#6b7280" },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Attendance Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiPieChart className="text-indigo-600" />
                Distribution
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Total: {dashboardData.analytics.summary.total_attendance}
              </p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            <div className="w-48 h-48">
              <Doughnut
                data={attendanceDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "70%",
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        color: "#374151",
                        font: { size: 12 },
                        padding: 20,
                      },
                    },
                  },
                }}
              />
            </div>
            <div className="ml-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {dashboardData.analytics.summary.total_present}
                  </div>
                  <div className="text-sm text-gray-500">Présents</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {dashboardData.analytics.summary.total_absent}
                  </div>
                  <div className="text-sm text-gray-500">Absents</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Group Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MdSchool className="text-teal-600" />
                Performance par Groupe
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Taux de présence moyen
              </p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={groupChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: "rgba(0, 0, 0, 0.05)" },
                    ticks: {
                      color: "#6b7280",
                      callback: (value) => `${value}%`,
                    },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: "#6b7280" },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Room Utilization */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiBarChart2 className="text-cyan-600" />
                Utilisation des Salles
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Pourcentage d'utilisation
              </p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={roomChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: "rgba(0, 0, 0, 0.05)" },
                    ticks: {
                      color: "#6b7280",
                      callback: (value) => `${value}%`,
                    },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: "#6b7280" },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Data Tables */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Rooms Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FiHome className="text-blue-600" />
              Salles IoT
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Salle
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Utilisation
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Sessions
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboardData.analytics.room_utilization.map((room, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">
                        {room.room_name}
                      </div>
                      <div className="text-xs text-gray-500">{room.room_id}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-full rounded-full ${
                              room.utilization > 70
                                ? "bg-blue-600"
                                : room.utilization > 40
                                  ? "bg-cyan-500"
                                  : "bg-gray-400"
                            }`}
                            style={{ width: `${room.utilization}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {room.utilization}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-gray-900 font-medium">
                        {room.sessions_count}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          room.utilization > 70
                            ? "bg-green-100 text-green-800"
                            : room.utilization > 40
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {room.utilization > 70
                          ? "Élevée"
                          : room.utilization > 40
                            ? "Moyenne"
                            : "Basse"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Groups Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MdSchool className="text-teal-600" />
              Groupes d'Étudiants
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Groupe
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Présence
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Étudiants
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboardData.analytics.group_attendance.map((group, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">
                        {group.group_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {group.level || "N/A"}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-lg font-bold text-gray-900">
                        {group.attendance_rate}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {group.present} présent(s)
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">
                        {group.total_students}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          group.attendance_rate > 80
                            ? "bg-green-100 text-green-800"
                            : group.attendance_rate > 60
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {group.attendance_rate > 80
                          ? "Excellent"
                          : group.attendance_rate > 60
                            ? "Bon"
                            : "À améliorer"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Système IoT Opérationnel</span>
            </div>
            <p>ESP32 • Firebase • Dashboard</p>
          </div>
          <div className="text-sm text-gray-500 mt-2 md:mt-0">
            <p>
              Dernière mise à jour:{" "}
              {new Date().toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;