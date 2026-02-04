import React, { useState, useEffect, useMemo } from "react";
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
import { Bar, Doughnut } from "react-chartjs-2";
import sessionAPI from "../api/sessionsApi";
import roomAPI from "../api/roomsApi";
import studentAPI from "../api/studentsApi";
import attendanceAPI from "../api/attendanceApi";
import groupAPI from "../api/groupsApi";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  FiCalendar,
  FiClock,
  FiHome,
  FiUsers,
  FiDownload,
  FiFilter,
  FiUserCheck,
  FiTrendingUp,
  FiList,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiPercent,
  FiActivity,
  FiPlayCircle,
  FiStopCircle,
  FiEye,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiBarChart2,
  FiPieChart,
  FiZap,
  FiUserX,
  FiUser,
  FiEyeOff,
  FiPrinter,
  FiFileText,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiBook,
  FiBookOpen,
  FiMessageSquare,
} from "react-icons/fi";

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

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [expandedSessions, setExpandedSessions] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedRoom, selectedGroup]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Local arrays to avoid relying on stale state during this async function
      let roomsArray = [];
      let groupsArray = [];
      let studentsArray = [];
      // Fetch rooms
      const roomsRes = await roomAPI.getAll();
      if (roomsRes.data.success) {
        const roomsData = roomsRes.data.data || {};
        roomsArray = Object.entries(roomsData).map(([id, data]) => ({
          id,
          ...data,
        }));
        setRooms(roomsArray);
      }

      // Fetch groups
      const groupsRes = await groupAPI.getAll();
      if (groupsRes.data.success) {
        const groupsData = groupsRes.data.data || {};
        groupsArray = Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data,
        }));
        setGroups(groupsArray);
      }

      // Fetch students
      const studentsRes = await studentAPI.getAll();
      if (studentsRes.data.success) {
        const studentsData = studentsRes.data.data || {};
        studentsArray = Object.entries(studentsData).map(([id, data]) => ({
          id,
          ...data,
        }));
        setStudents(studentsArray);
      }

      // Fetch attendance data
      const params = {
        date: selectedDate,
      };

      // Add room filter if not "all"
      if (selectedRoom !== "all") {
        // Find room name from room id
        const roomObj =
          roomsArray.find((r) => r.id === selectedRoom) ||
          rooms.find((r) => r.id === selectedRoom);
        if (roomObj) {
          params.room = roomObj.name; // Use room name for filtering as per backend API
        }
      }

      // Add group filter if not "all"
      if (selectedGroup !== "all") {
        params.group = selectedGroup;
      }

      const attendanceRes = await attendanceAPI.getAll(params);
      let attendanceArray = [];

      if (attendanceRes.data.success) {
        attendanceArray = attendanceRes.data.data || [];
        setAttendanceData(attendanceArray);
      }

      // Fetch today's sessions
      let todaySessions = [];
      try {
        const sessionsRes = await sessionAPI.getToday();
        if (sessionsRes.data.success) {
          const sessionsData = sessionsRes.data.data || {};

          // Convert sessions data to array
          todaySessions = [];
          for (const date in sessionsData) {
            for (const roomId in sessionsData[date]) {
              const roomSessions = sessionsData[date][roomId];
              for (const sessionId in roomSessions) {
                todaySessions.push({
                  id: sessionId,
                  room: roomId,
                  date: date,
                  ...roomSessions[sessionId],
                });
              }
            }
          }

          // Filter by room if selected
          if (selectedRoom !== "all") {
            todaySessions = todaySessions.filter(
              (session) => session.room === selectedRoom,
            );
          }
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }

      setSessions(todaySessions);
      calculateStats(todaySessions, attendanceArray, studentsArray);
    } catch (error) {
      console.error("Error loading data:", error);
      setAttendanceData([]);
      setSessions([]);
      setStats(null);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  const calculateStats = (
    sessionsList,
    attendanceRecords,
    allStudents = [],
  ) => {
    const totalPresent = attendanceRecords.filter(
      (record) => record.status === "PRESENT",
    ).length;
    const totalAbsent = attendanceRecords.filter(
      (record) => record.status === "ABSENT",
    ).length;
    const totalStudents = totalPresent + totalAbsent;
    const attendanceRate =
      totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

    // Count by room
    const byRoom = {};
    attendanceRecords.forEach((record) => {
      const roomName = record.room || "Unknown";
      if (!byRoom[roomName]) {
        byRoom[roomName] = { present: 0, absent: 0 };
      }
      if (record.status === "PRESENT") {
        byRoom[roomName].present++;
      } else {
        byRoom[roomName].absent++;
      }
    });

    // Count by group
    const byGroup = {};
    attendanceRecords.forEach((record) => {
      const groupName = record.group_name || record.group_id || "Unknown";
      if (!byGroup[groupName]) {
        byGroup[groupName] = { present: 0, absent: 0 };
      }
      if (record.status === "PRESENT") {
        byGroup[groupName].present++;
      } else {
        byGroup[groupName].absent++;
      }
    });

    // Sessions status
    const activeSessions = sessionsList.filter((session) => {
      // Determine if session is active based on current time
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (session.date !== today) return false;

      const [startHour, startMinute] = session.start.split(":").map(Number);
      const [endHour, endMinute] = session.end.split(":").map(Number);

      const sessionStart = new Date();
      sessionStart.setHours(startHour, startMinute, 0, 0);

      const sessionEnd = new Date();
      sessionEnd.setHours(endHour, endMinute, 0, 0);

      return now >= sessionStart && now <= sessionEnd;
    }).length;

    const closedSessions = sessionsList.filter((session) => {
      // Determine if session is closed (past end time)
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (session.date !== today) return true;

      const [endHour, endMinute] = session.end.split(":").map(Number);
      const sessionEnd = new Date();
      sessionEnd.setHours(endHour, endMinute, 0, 0);

      return now > sessionEnd;
    }).length;

    const scheduledSessions = sessionsList.length;

    // Calculate attendance by time of day
    const attendanceByHour = {};
    attendanceRecords
      .filter((record) => record.time && record.status === "PRESENT")
      .forEach((record) => {
        const hour = record.time.split(":")[0];
        if (!attendanceByHour[hour]) {
          attendanceByHour[hour] = 0;
        }
        attendanceByHour[hour]++;
      });

    // Calculate average attendance time
    const presentRecords = attendanceRecords.filter(
      (record) => record.time && record.status === "PRESENT",
    );
    const totalMinutes = presentRecords.reduce((sum, record) => {
      const [hours, minutes] = record.time.split(":").map(Number);
      return sum + (hours * 60 + minutes);
    }, 0);
    const averageTime =
      presentRecords.length > 0
        ? new Date((totalMinutes / presentRecords.length) * 60000)
            .toISOString()
            .substr(11, 5)
        : null;

    setStats({
      totalPresent,
      totalAbsent,
      totalStudents,
      attendanceRate: Number(attendanceRate.toFixed(1)),
      byRoom,
      byGroup,
      activeSessions,
      closedSessions,
      scheduledSessions,
      totalSessions: sessionsList.length,
      attendanceByHour,
      averageTime,
      totalStudentsInSystem: allStudents.length,
    });
  };

  const handleGenerateSessions = async () => {
    try {
      await sessionAPI.generate({ date: selectedDate });
      fetchData();
    } catch (error) {
      console.error("Error generating sessions:", error);
      alert("Erreur lors de la génération des sessions: " + error.message);
    }
  };

  const handleCloseSession = async (sessionId) => {
    try {
      await sessionAPI.stop(sessionId);
      fetchData();
    } catch (error) {
      console.error("Error closing session:", error);
      alert("Erreur lors de la fermeture de la session: " + error.message);
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    await fetchData();
  };

  const handleExportCSV = () => {
    let csvContent =
      "Date,Time,Room,Group,Student,Status,Method,Fingerprint ID\n";

    attendanceData.forEach((record) => {
      csvContent += `"${record.date}","${record.time || ""}","${record.room || ""}","${record.group_name || record.group_id || ""}","${record.student_name || ""}","${record.status}","${record.method || "FINGERPRINT"}","${record.fingerprint_id || ""}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${selectedDate.replace(/-/g, "")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSession = (sessionId) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  // Filter attendance data by search term and status
  const filteredAttendance = useMemo(() => {
    let filtered = attendanceData;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.student_name?.toLowerCase().includes(searchLower) ||
          record.room?.toLowerCase().includes(searchLower) ||
          record.group_name?.toLowerCase().includes(searchLower) ||
          record.group_id?.toLowerCase().includes(searchLower),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (record) => record.status.toLowerCase() === statusFilter.toLowerCase(),
      );
    }

    return filtered;
  }, [attendanceData, searchTerm, statusFilter]);

  // Pagination for attendance data
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAttendance = filteredAttendance.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Chart data for attendance statistics
  const attendanceChartData = {
    labels: ["Présent", "Absent"],
    datasets: [
      {
        data: [stats?.totalPresent || 0, stats?.totalAbsent || 0],
        backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(239, 68, 68, 0.8)"],
        borderColor: ["#22c55e", "#ef4444"],
        borderWidth: 2,
      },
    ],
  };

  const roomDistributionChartData = {
    labels: stats?.byRoom ? Object.keys(stats.byRoom) : [],
    datasets: [
      {
        label: "Taux de présence",
        data: stats?.byRoom
          ? Object.values(stats.byRoom).map((room) =>
              room.present + room.absent > 0
                ? Math.round(
                    (room.present / (room.present + room.absent)) * 100,
                  )
                : 0,
            )
          : [],
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "#3b82f6",
        borderWidth: 1,
      },
    ],
  };

  const hourlyAttendanceChartData = {
    labels: stats?.attendanceByHour
      ? Object.keys(stats.attendanceByHour)
          .sort()
          .map((hour) => `${hour}:00`)
      : [],
    datasets: [
      {
        label: "Présences",
        data: stats?.attendanceByHour
          ? Object.entries(stats.attendanceByHour)
              .sort(([a], [b]) => a - b)
              .map(([, count]) => count)
          : [],
        backgroundColor: "rgba(139, 92, 246, 0.8)",
        borderColor: "#8b5cf6",
        borderWidth: 1,
      },
    ],
  };

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <LoadingSpinner
        message={"Chargement des présences..."}
        sub={"Récupération des données depuis Firebase"}
        className="min-h-screen"
      />
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-2">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 inline-flex items-center gap-2">
              <FiUserCheck className="w-6 h-6 text-blue-600" />
              Gestion des Présences
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <FiCalendar className="text-blue-600" />
              {currentDate}
              {lastUpdated && (
                <span className="text-sm text-gray-500 ml-4">
                  <FiClock className="inline mr-1" />
                  Dernière mise à jour:{" "}
                  {lastUpdated.toLocaleTimeString("fr-FR")}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
              <FiClock className="text-gray-400 mr-2" />
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <div
                    className={`block w-10 h-6 rounded-full ${autoRefresh ? "bg-blue-600" : "bg-gray-300"}`}
                  ></div>
                  <div
                    className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoRefresh ? "transform translate-x-4" : ""}`}
                  ></div>
                </div>
                <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
              </label>
            </div>

            <button
              onClick={handleManualRefresh}
              style={{ backgroundColor: "#233D4D" }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>

            <button
              onClick={handleGenerateSessions}
              style={{ backgroundColor: "#FE7F2D" }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlayCircle className="h-5 w-5" />
              Générer Sessions
            </button>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Présences */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiUserCheck className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                PRÉSENTS
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.totalPresent || 0}
            </h3>
            <p className="text-gray-500 text-sm mb-3">Étudiants présents</p>
            <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
              <div className="text-center">
                <div className="font-semibold text-gray-700">
                  {stats?.totalStudents || 0}
                </div>
                <div>Total</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600">
                  {stats?.attendanceRate || 0}%
                </div>
                <div>Taux</div>
              </div>
            </div>
          </div>

          {/* Absences */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <FiUserX className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                ABSENTS
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.totalAbsent || 0}
            </h3>
            <p className="text-gray-500 text-sm mb-3">Étudiants absents</p>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Taux d'absence</span>
                <span className="text-sm font-semibold text-red-600">
                  {stats?.totalStudents > 0
                    ? Math.round(
                        (stats.totalAbsent / stats.totalStudents) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiZap className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                SESSIONS
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.totalSessions || 0}
            </h3>
            <p className="text-gray-500 text-sm mb-3">Sessions programmées</p>
            <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
              <div className="text-center">
                <div className="font-semibold text-green-600">
                  {stats?.activeSessions || 0}
                </div>
                <div>Actives</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-600">
                  {stats?.closedSessions || 0}
                </div>
                <div>Terminées</div>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiTrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                PERFORMANCE
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.averageTime || "--:--"}
            </h3>
            <p className="text-gray-500 text-sm mb-3">
              Heure moyenne d'arrivée
            </p>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Données filtrées</span>
                <span className="text-sm font-semibold text-blue-600">
                  {filteredAttendance.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts */}
        {stats && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Attendance Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FiPieChart className="text-green-600" />
                    Répartition Présence/Absence
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Distribution globale des présences
                  </p>
                </div>
              </div>
              <div className="h-64">
                <Doughnut
                  data={attendanceChartData}
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
                          usePointStyle: true,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Room Distribution */}
            {Object.keys(stats.byRoom || {}).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <FiBarChart2 className="text-blue-600" />
                      Taux par Salle
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Performance des salles de classe
                    </p>
                  </div>
                </div>
                <div className="h-64">
                  <Bar
                    data={roomDistributionChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          ticks: {
                            callback: function (value) {
                              return value + "%";
                            },
                          },
                        },
                      },
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )}

            {/* Hourly Attendance */}
            {stats.attendanceByHour &&
              Object.keys(stats.attendanceByHour).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <FiClock className="text-purple-600" />
                        Présences par Heure
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Distribution horaire des arrivées
                      </p>
                    </div>
                  </div>
                  <div className="h-64">
                    <Bar
                      data={hourlyAttendanceChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              stepSize: 1,
                            },
                          },
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher étudiant, salle ou groupe..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FiCalendar className="h-5 w-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
                max={new Date().toISOString().split("T")[0]}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <FiHome className="h-5 w-5 text-gray-500" />
              <select
                value={selectedRoom}
                onChange={(e) => {
                  setSelectedRoom(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-4 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-[180px]"
              >
                <option value="all">Toutes les salles</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name || room.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 ${showFilters ? "bg-blue-100 text-blue-600" : "bg-white text-gray-700"} border border-gray-300 rounded-lg`}
              >
                <FiFilter className="h-4 w-4" />
                {showFilters ? <FiChevronUp /> : <FiChevronDown />}
              </button>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-4 py-2 ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                  title="Vue grille"
                >
                  <FiList className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-4 py-2 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                  title="Vue liste"
                >
                  <FiBarChart2 className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
                >
                  <FiDownload className="h-4 w-4" />
                  CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Groupe
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les groupes</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="present">Présent</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attendance Records */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Registre des Présences
              </h2>
              <div className="text-sm text-gray-500 mt-1 sm:mt-0">
                {filteredAttendance.length} enregistrement
                {filteredAttendance.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredAttendance.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {paginatedAttendance.map((record, index) => {
                  const student = students.find(
                    (s) => s.id === record.student_id,
                  );

                  return (
                    <div key={index} className="p-4 hover:bg-gray-50">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-2 rounded-lg ${
                                  record.status === "PRESENT"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-red-100 text-red-600"
                                }`}
                              >
                                {record.status === "PRESENT" ? (
                                  <FiCheckCircle className="h-5 w-5" />
                                ) : (
                                  <FiXCircle className="h-5 w-5" />
                                )}
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {student?.name ||
                                  record.student_name ||
                                  `Étudiant ${record.student_id}`}
                              </h3>
                            </div>

                            {record.group_name && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                {record.group_name}
                              </span>
                            )}
                            {record.room && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                                <FiHome className="inline mr-1 h-3 w-3" />
                                {record.room}
                              </span>
                            )}
                            {record.time && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                                <FiClock className="inline mr-1 h-3 w-3" />
                                {record.time}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <FiCalendar className="mr-1 h-4 w-4" />
                              {record.date}
                            </span>
                            {record.fingerprint_id && (
                              <span>ID Empreinte: {record.fingerprint_id}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <FiUserCheck className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {searchTerm ||
                  selectedRoom !== "all" ||
                  selectedGroup !== "all" ||
                  statusFilter !== "all" ||
                  selectedDate !== new Date().toISOString().split("T")[0]
                    ? "Aucune présence trouvée"
                    : "Aucune présence enregistrée"}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                  {searchTerm
                    ? "Aucune présence ne correspond à votre recherche."
                    : selectedRoom !== "all" ||
                        selectedGroup !== "all" ||
                        statusFilter !== "all" ||
                        selectedDate !== new Date().toISOString().split("T")[0]
                      ? "Aucune présence ne correspond à vos filtres."
                      : "Aucune présence n'a été enregistrée pour aujourd'hui."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredAttendance.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Affichage {startIndex + 1} à{" "}
                  {Math.min(endIndex, filteredAttendance.length)} sur{" "}
                  {filteredAttendance.length} enregistrements
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="5">5 par page</option>
                    <option value="10">10 par page</option>
                    <option value="20">20 par page</option>
                    <option value="50">50 par page</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      <FiChevronLeft className="h-4 w-4" />
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 border rounded text-sm font-medium ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      <FiChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sessions Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Sessions du Jour
              </h2>
              <div className="text-sm text-gray-500 mt-1 sm:mt-0">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {sessions.map((session) => {
              const isExpanded = expandedSessions[session.id];
              const room = rooms.find((r) => r.id === session.room);
              const group = groups.find((g) => g.id === session.group);
              const attendanceForSession = attendanceData.filter(
                (record) =>
                  record.group_id === session.group &&
                  record.date === selectedDate,
              );

              const presentCount = attendanceForSession.filter(
                (a) => a.status === "PRESENT",
              ).length;
              const totalStudentsInGroup = students.filter(
                (s) => s.group === session.group,
              ).length;
              const attendanceRate =
                totalStudentsInGroup > 0
                  ? Math.round((presentCount / totalStudentsInGroup) * 100)
                  : 0;

              return (
                <div key={session.id} className="p-4 hover:bg-gray-50">
                  {/* Session Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {session.subject || "Session"}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            session.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : session.status === "CLOSED"
                                ? "bg-gray-100 text-gray-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {session.status === "ACTIVE"
                            ? "ACTIVE"
                            : session.status === "CLOSED"
                              ? "TERMINÉE"
                              : "PLANIFIÉE"}
                        </span>
                        {room && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            Salle: {room.name || session.room}
                          </span>
                        )}
                        {group && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                            Groupe: {group.name || session.group}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <FiClock className="mr-1 h-4 w-4" />
                          {session.start} - {session.end}
                        </span>
                        <span>
                          <FiPercent className="inline mr-1 h-4 w-4" />
                          Taux: {attendanceRate}%
                        </span>
                        <span>
                          <FiUsers className="inline mr-1 h-4 w-4" />
                          {presentCount}/{totalStudentsInGroup} étudiants
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {session.status === "ACTIVE" && (
                        <button
                          onClick={() => handleCloseSession(session.id)}
                          className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          <FiStopCircle className="h-4 w-4" />
                          Terminer
                        </button>
                      )}
                      <button
                        onClick={() => toggleSession(session.id)}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        {isExpanded ? "Masquer" : "Afficher"}
                        {isExpanded ? (
                          <FiChevronUp className="h-4 w-4" />
                        ) : (
                          <FiChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Session Details */}
                  {isExpanded && (
                    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h4 className="font-medium text-gray-900">
                          Liste des Présences ({attendanceForSession.length})
                        </h4>
                      </div>

                      {attendanceForSession.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Étudiant
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Statut
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Heure
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Méthode
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {attendanceForSession.map((record, index) => {
                                const student = students.find(
                                  (s) => s.id === record.student_id,
                                );

                                return (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center">
                                        <div
                                          className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                                            record.status === "PRESENT"
                                              ? "bg-green-100"
                                              : "bg-red-100"
                                          }`}
                                        >
                                          {record.status === "PRESENT" ? (
                                            <FiUserCheck className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <FiUserX className="h-4 w-4 text-red-600" />
                                          )}
                                        </div>
                                        <div className="font-medium text-gray-900">
                                          {student?.name ||
                                            record.student_name ||
                                            `Étudiant ${record.student_id}`}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          record.status === "PRESENT"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {record.status === "PRESENT"
                                          ? "PRÉSENT"
                                          : "ABSENT"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {record.time || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm text-gray-700">
                                        {record.method === "FINGERPRINT"
                                          ? "Empreinte"
                                          : "Manuel"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <FiUsers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p>Aucune présence enregistrée pour cette session</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {sessions.length === 0 && (
              <div className="text-center py-12">
                <FiCalendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune session disponible
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  Aucune session n'a été générée pour cette date.
                </p>
                <button
                  onClick={handleGenerateSessions}
                  style={{ backgroundColor: "#FE7F2D" }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  <FiPlayCircle className="h-4 w-4" />
                  Générer Sessions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${stats && stats.attendanceRate < 70 ? "bg-red-500" : "bg-green-500"}`}
              ></div>
              <span className="text-sm font-medium text-gray-700">
                {stats && stats.attendanceRate < 70
                  ? "Taux critique"
                  : "Taux optimal"}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats?.totalPresent || 0} présences • {stats?.totalAbsent || 0}{" "}
              absences • {stats?.attendanceRate || 0}% de taux
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <FiRefreshCw className="h-3 w-3" />
              Auto-refresh: {autoRefresh ? "Activé (30s)" : "Désactivé"}
            </p>
            <p>
              Dernière mise à jour:{" "}
              {lastUpdated
                ? lastUpdated.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "--:--"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
