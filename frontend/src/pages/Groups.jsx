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
import { Doughnut,Pie } from "react-chartjs-2";
import { listenToGroups, listenToStudents } from "../firebase/firebase";
import groupAPI from "../api/groupsApi";
import studentAPI from "../api/studentsApi";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  FiUsers,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiPlus,
  FiX,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiUser,
  FiChevronUp,
  FiClock,
  FiCalendar,
  FiTrendingUp,
  FiPieChart,
  FiBarChart2,
  FiHome,
} from "react-icons/fi";
import {MdMeetingRoom} from "react-icons/md";

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

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState({
    groups: true,
    stats: true,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    level: "",
    year: new Date().getFullYear(),
    capacity: 30,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [viewMode, setViewMode] = useState("list");

  useEffect(() => {
    fetchData();
    const cleanup = setupRealtimeListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchData();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchData = async () => {
    setLoading({ groups: true, stats: true });
    setError(null);
    try {
      const [groupsRes, studentsRes] = await Promise.all([
        groupAPI.getAll(),
        studentAPI.getAll(),
      ]);

      if (groupsRes.data.success) {
        const groupsData = groupsRes.data.data || {};
        const groupsArray = Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data,
        }));
        setGroups(groupsArray);
      }

      if (studentsRes.data.success) {
        setStudents(studentsRes.data.data || {});
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load groups data");
    } finally {
      setLoading({ groups: false, stats: false });
    }
  };

  const setupRealtimeListeners = () => {
    const unsubscribeGroups = listenToGroups((groupsData) => {
      if (groupsData) {
        const groupsArray = Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data,
        }));
        setGroups(groupsArray);
      }
    });

    const unsubscribeStudents = listenToStudents((studentsData) => {
      if (studentsData) {
        setStudents(studentsData);
      }
    });

    return () => {
      unsubscribeGroups();
      unsubscribeStudents();
    };
  };

  const calculateGroupStats = () => {
    const totalGroups = groups.length;
    const totalStudents = Object.keys(students).length;
    const avgStudentsPerGroup = totalGroups > 0 ? Math.round(totalStudents / totalGroups) : 0;
    
    // Count groups by level
    const levels = {};
    groups.forEach(group => {
      const level = group.level || 'Not specified';
      levels[level] = (levels[level] || 0) + 1;
    });
    
    // Capacity utilization
    const totalCapacity = groups.reduce((sum, group) => sum + (parseInt(group.capacity) || 0), 0);
    const capacityUtilization = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;
    
    return {
      totalGroups,
      totalStudents,
      avgStudentsPerGroup,
      levels,
      totalCapacity,
      capacityUtilization,
    };
  };

  const stats = useMemo(() => calculateGroupStats(), [groups, students]);

  const countStudentsInGroup = (groupId) => {
    if (!students) return 0;
    return Object.values(students).filter(
      (student) => student.group === groupId,
    ).length;
  };

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setFormData({
      name: "",
      description: "",
      level: "",
      year: new Date().getFullYear(),
      capacity: 30,
    });
    setIsModalOpen(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || "",
      description: group.description || "",
      level: group.level || "",
      year: group.year || new Date().getFullYear(),
      capacity: group.capacity || 30,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError("Group name is required");
      return;
    }

    try {
      if (editingGroup) {
        await groupAPI.update(editingGroup.id, formData);
        setSuccess("Group updated successfully");
      } else {
        await groupAPI.create(formData);
        setSuccess("Group created successfully");
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error saving group:", error);
      setError(error.response?.data?.error || "Failed to save group");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("Are you sure you want to delete this group?")) {
      return;
    }

    const studentCount = countStudentsInGroup(groupId);
    if (studentCount > 0) {
      if (
        !window.confirm(
          `This group has ${studentCount} student(s). Are you sure you want to delete it?`,
        )
      ) {
        return;
      }
    }

    try {
      await groupAPI.delete(groupId);
      setSuccess("Group deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error deleting group:", error);
      setError(error.response?.data?.error || "Failed to delete group");
    }
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      searchTerm === "" ||
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description &&
        group.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesYear = filterYear === "all" || group.year == filterYear;
    const matchesLevel = filterLevel === "all" || group.level === filterLevel;

    return matchesSearch && matchesYear && matchesLevel;
  });

  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = filteredGroups.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const getStudentsInGroup = (groupId) => {
    if (!students) return [];
    return Object.entries(students)
      .filter(([, student]) => student.group === groupId)
      .map(([id, student]) => ({ id, ...student }));
  };

  const allLevels = [...new Set(groups.map((g) => g.level).filter(Boolean))];
  const allYears = [...new Set(groups.map((g) => g.year).filter(Boolean))].sort(
    (a, b) => b - a,
  );

  // Chart data
  const levelDistributionChartData = {
    labels: Object.keys(stats.levels),
    datasets: [
      {
        data: Object.values(stats.levels),
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

  const capacityUtilizationChartData = {
    labels: ["Utilisé", "Disponible"],
    datasets: [
      {
        data: [stats.capacityUtilization, 100 - stats.capacityUtilization],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(148, 163, 184, 0.8)",
        ],
        borderColor: ["#22c55e", "#94a3b8"],
        borderWidth: 2,
      },
    ],
  };

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleManualRefresh = async () => {
    setError(null);
    await fetchData();
  };

  if (loading.groups) {
    return (
      <LoadingSpinner
        message={"Loading groups..."}
        sub={"Fetching data from Firebase"}
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
              <FiUsers className="w-6 h-6 text-blue-600" />
              Groupes d'Étudiants
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
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoRefresh}
                    onChange={() => setAutoRefresh(!autoRefresh)}
                  />
                  <div className={`block w-10 h-6 rounded-full ${autoRefresh ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoRefresh ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
              </label>
            </div>
            
            <button
              onClick={handleManualRefresh} style={{ backgroundColor:"#233D4D" }}
              className="flex items-center cursor-pointer gap-2 px-4 py-2 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading.groups ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            
            <button
              onClick={handleCreateGroup} style={{ backgroundColor:"#FE7F2D" }}
              className="flex items-center cursor-pointer gap-2 px-4 py-2 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlus className="h-5 w-5" />
              Nouveau Groupe
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FiAlertCircle className="h-5 w-5 text-red-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={handleManualRefresh}
              className="text-sm font-medium text-red-800 hover:text-red-900"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FiCheckCircle className="h-5 w-5 text-green-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Succès</h3>
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="text-sm font-medium text-green-800 hover:text-green-900"
            >
              Fermer
            </button>
          </div>
        )}
      </div>

      {/* Main Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Groups Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiUsers className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              GROUPES
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.totalGroups}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Groupes configurés</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {Object.keys(stats.levels).length}
              </div>
              <div>Niveaux</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {allYears.length}
              </div>
              <div>Années</div>
            </div>
          </div>
        </div>

        {/* Students Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <FiUser className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">
              ÉTUDIANTS
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.totalStudents}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Inscrits dans le système</p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Moyenne par groupe</span>
              <span className="text-sm font-semibold text-teal-600">
                {stats.avgStudentsPerGroup}
              </span>
            </div>
          </div>
        </div>

        {/* Capacity Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <MdMeetingRoom className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              CAPACITÉ
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.totalCapacity}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Places totales</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-green-600">
                {stats.capacityUtilization}%
              </div>
              <div>Utilisation</div>
            </div>
          </div>
        </div>

        {/* Performance Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <FiTrendingUp className="h-5 w-5 text-cyan-600" />
            </div>
            <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded">
              PERFORMANCE
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {filteredGroups.length}
          </h3>
          <p className="text-gray-500 text-sm mb-3">
            Groupes filtrés
          </p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiFilter className="text-blue-600" />
                <span className="text-xs text-gray-500">Critères actifs</span>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {filterYear !== "all" || filterLevel !== "all" || searchTerm ? "Oui" : "Non"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Level Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiPieChart className="text-indigo-600" />
                Répartition par Niveau
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Distribution des groupes par niveau académique
              </p>
            </div>
          </div>
          <div className="h-64">
            <Pie
              data={levelDistributionChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "right",
                    labels: {
                      color: "#374151",
                      font: { size: 11 },
                      padding: 15,
                      usePointStyle: true,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Capacity Utilization */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiBarChart2 className="text-cyan-600" />
                Utilisation de la Capacité
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Taux d'occupation des groupes
              </p>
            </div>
          </div>
          <div className="h-64 flex items-center">
            <div className="w-1/2">
              <Doughnut
                data={capacityUtilizationChartData}
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
            <div className="w-1/2 pl-8">
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold text-gray-900 text-center">
                    {stats.capacityUtilization}%
                  </div>
                  <p className="text-sm text-gray-500 text-center">Taux d'utilisation</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Étudiants inscrits</span>
                    <span className="font-semibold">{stats.totalStudents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Capacité totale</span>
                    <span className="font-semibold">{stats.totalCapacity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Places disponibles</span>
                    <span className="font-semibold text-green-600">
                      {stats.totalCapacity - stats.totalStudents}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, description..."
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
              <FiFilter className="h-5 w-5 text-gray-500" />
              <select 
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-4 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
              >
                <option value="all">Toutes les années</option>
                {allYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <FiFilter className="h-5 w-5 text-gray-500" />
              <select 
                value={filterLevel}
                onChange={(e) => {
                  setFilterLevel(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-4 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
              >
                <option value="all">Tous les niveaux</option>
                {allLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 cursor-pointer ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                title="Vue grille"
              >
                <FiHome className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 cursor-pointer ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                title="Vue liste"
              >
                <FiUsers className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Content */}
      <div className="max-w-7xl mx-auto">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {paginatedGroups.map((group) => {
              const studentCount = countStudentsInGroup(group.id);
              const groupStudents = getStudentsInGroup(group.id);
              const utilization = Math.round((studentCount / (group.capacity || 30)) * 100);

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden"
                >
                  {/* Status Indicator */}
                  <div className={`absolute top-0 left-0 w-2 h-full ${
                    utilization > 80 ? 'bg-red-500' : 
                    utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>

                  <div className="p-6 ml-2">
                    {/* Group Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <FiUsers className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">
                          {group.name}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {group.level || "Non spécifié"}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                            Année: {group.year}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {group.description && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                        {group.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Étudiants</span>
                        <span className="font-semibold text-gray-900">
                          {studentCount}/{group.capacity || 30}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Utilisation</span>
                        <span className={`font-semibold ${
                          utilization > 80 ? 'text-red-600' : 
                          utilization > 50 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {utilization}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-full rounded-full ${
                            utilization > 80 ? 'bg-red-500' : 
                            utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${utilization}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditGroup(group)}
                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FiEdit2 className="h-4 w-4" />
                            Modifier
                          </button>
                          <button
                            onClick={() => toggleGroupExpansion(group.id)}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <FiUsers className="h-4 w-4" />
                            {groupStudents.length}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Students View */}
                  {expandedGroup === group.id && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="p-4">
                        <h4 className="font-medium text-gray-900 mb-3">
                          Étudiants du groupe ({groupStudents.length})
                        </h4>
                        {groupStudents.length > 0 ? (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {groupStudents.map((student) => (
                              <div key={student.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                    <FiUser className="h-4 w-4 text-gray-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 text-sm">
                                      {student.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {student.email || "—"}
                                    </div>
                                  </div>
                                </div>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {student.id}
                                </code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <FiUsers className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm">Aucun étudiant dans ce groupe</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Groupes Disponibles
                </h2>
                <div className="text-sm text-gray-500 mt-1 sm:mt-0">
                  {filteredGroups.length} groupe{filteredGroups.length !== 1 ? "s" : ""} trouvé{filteredGroups.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredGroups.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {paginatedGroups.map((group) => {
                    const studentCount = countStudentsInGroup(group.id);
                    const isExpanded = expandedGroup === group.id;
                    const groupStudents = getStudentsInGroup(group.id);
                    const utilization = Math.round((studentCount / (group.capacity || 30)) * 100);

                    return (
                      <div key={group.id} className="p-4 hover:bg-gray-50">
                        {/* Group Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {group.name}
                              </h3>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                {group.level || "Non spécifié"}
                              </span>
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                                Année: {group.year}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                utilization > 80 ? 'bg-red-100 text-red-800' :
                                utilization > 50 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {studentCount}/{group.capacity || 30} étudiants
                              </span>
                            </div>

                            {group.description && (
                              <p className="text-gray-600 text-sm mb-3">
                                {group.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <FiUsers className="mr-1 h-4 w-4" />
                                {studentCount} étudiant{studentCount !== 1 ? "s" : ""}
                              </span>
                              <span>ID: {group.id}</span>
                              <div className="flex items-center gap-2">
                                <span>Utilisation:</span>
                                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-full rounded-full ${
                                      utilization > 80 ? 'bg-red-500' : 
                                      utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${utilization}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs">{utilization}%</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleGroupExpansion(group.id)}
                              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              {isExpanded ? (
                                <>
                                  <FiChevronUp className="h-4 w-4" />
                                  Masquer
                                </>
                              ) : (
                                <>
                                  <FiUsers className="h-4 w-4" />
                                  Étudiants
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleEditGroup(group)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <FiEdit2 className="h-5 w-5" />
                            </button>

                            <button
                              onClick={() => handleDeleteGroup(group.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <FiTrash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Students View */}
                        {isExpanded && (
                          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                              <h4 className="font-medium text-gray-900">
                                Étudiants du Groupe ({groupStudents.length})
                              </h4>
                            </div>

                            {groupStudents.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="min-w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Étudiant
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        ID
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Email
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Fingerprint ID
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {groupStudents.map((student) => (
                                      <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                          <div className="flex items-center">
                                            <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                              <FiUser className="h-4 w-4 text-gray-600" />
                                            </div>
                                            <div className="font-medium text-gray-900">
                                              {student.name}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                            {student.id}
                                          </code>
                                        </td>
                                        <td className="px-4 py-3">
                                          {student.email || "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                          {student.fingerprint_id ? (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                              {student.fingerprint_id}
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">
                                              Non assigné
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-8 text-center text-gray-500">
                                <FiUsers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p>Aucun étudiant dans ce groupe</p>
                                <p className="text-sm mt-1">
                                  Ajoutez des étudiants depuis la section Étudiants
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-white">
                  <FiUsers className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {searchTerm || filterYear !== "all" || filterLevel !== "all"
                      ? "Aucun groupe trouvé"
                      : "Aucun groupe configuré"}
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-8">
                    {searchTerm
                      ? "Aucun groupe ne correspond à votre recherche. Essayez avec d'autres termes."
                      : filterYear !== "all" || filterLevel !== "all"
                      ? "Aucun groupe ne correspond à vos filtres."
                      : "Commencez par ajouter votre premier groupe au système."}
                  </p>
                  {!searchTerm && filterYear === "all" && filterLevel === "all" && (
                    <button
                      onClick={handleCreateGroup}
                      className="inline-flex items-center gap-3 px-6 py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <FiPlus className="h-5 w-5" />
                      Ajouter votre premier groupe
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredGroups.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Affichage {startIndex + 1} à{" "}
                    {Math.min(startIndex + itemsPerPage, filteredGroups.length)} sur{" "}
                    {filteredGroups.length} groupes
                  </div>

                  <div className="flex items-center gap-3">
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
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingGroup ? "Modifier le Groupe" : "Nouveau Groupe"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du Groupe *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Groupe 1, L3 Info"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description optionnelle du groupe"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Niveau
                    </label>
                    <input
                      type="text"
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: L1, L2, M1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Année
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          year: parseInt(e.target.value) || new Date().getFullYear(),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="2000"
                      max="2100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacité Maximum
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        capacity: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nombre maximum d'étudiants dans ce groupe
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiSave className="h-4 w-4" />
                  {editingGroup ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className="text-sm font-medium text-gray-700">
                {error ? 'Système en erreur' : 'Système IoT Opérationnel'}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats.totalGroups} groupes • {stats.totalStudents} étudiants • {stats.capacityUtilization}% d'utilisation
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <FiRefreshCw className="h-3 w-3" />
              Auto-refresh: {autoRefresh ? 'Activé (30s)' : 'Désactivé'}
            </p>
            <p>
              Dernière mise à jour:{" "}
              {lastUpdated
                ? lastUpdated.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : '--:--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Groups;