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
import { Doughnut, Pie, Bar } from "react-chartjs-2";
import subjectAPI from "../api/subjectsApi";
import teacherAPI from "../api/teacherApi";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  FiBook,
  FiBookOpen,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
  FiSave,
  FiClock,
  FiUsers,
  FiBarChart2,
  FiChevronLeft,
  FiChevronRight,
  FiCode,
  FiTag,
  FiBookmark,
  FiUser,
  FiHome,
  FiLayers,
  FiTrendingUp,
  FiGrid,
  FiList,
  FiEye,
  FiEyeOff,
  FiMoreVertical,
  FiExternalLink,
  FiDownload,
  FiUpload,
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiCalendar,
  FiPieChart,
  FiBarChart,
  FiCheck,
  FiXCircle,
  FiPercent
} from "react-icons/fi";
import { FaChalkboardTeacher } from "react-icons/fa";

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

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState({
    subjects: true,
    stats: true,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    teacher_id: "",
    credits: 3,
    semester: "S1",
    level: "Licence 1",
    description: ""
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [expandedSubject, setExpandedSubject] = useState(null);

  const levelOptions = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];
  const semesterOptions = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];

  useEffect(() => {
    fetchData();
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
    setLoading({ subjects: true, stats: true });
    setError(null);
    try {
      const [subjectsRes, teachersRes] = await Promise.all([
        subjectAPI.getAll(),
        teacherAPI.getAll()
      ]);

      if (subjectsRes.data.success) {
        const subjectsData = subjectsRes.data.data || {};
        const subjectsArray = Object.entries(subjectsData).map(
          ([id, data]) => ({
            id,
            ...data,
          })
        );
        setSubjects(subjectsArray);
      }

      if (teachersRes.data.success) {
        const teachersData = teachersRes.data.data || {};
        const teachersArray = Object.entries(teachersData).map(
          ([id, data]) => ({
            id,
            ...data,
          })
        );
        setTeachers(teachersArray);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Erreur chargement données:", error);
      setError("Impossible de charger les données");
    } finally {
      setLoading({ subjects: false, stats: false });
    }
  };

  const calculateSubjectStats = useMemo(() => {
    const totalSubjects = subjects.length;
    const totalCredits = subjects.reduce((sum, subject) => sum + (subject.credits || 0), 0);
    
    // Count subjects by level
    const levelDistribution = {};
    subjects.forEach(subject => {
      const level = subject.level || 'Non spécifié';
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    });
    
    // Count subjects by semester
    const semesterDistribution = {};
    subjects.forEach(subject => {
      const semester = subject.semester || 'Non spécifié';
      semesterDistribution[semester] = (semesterDistribution[semester] || 0) + 1;
    });
    
    // Subjects with teacher assigned
    const subjectsWithTeacher = subjects.filter(s => s.teacher_id).length;
    const teacherAssignmentRate = totalSubjects > 0 ? Math.round((subjectsWithTeacher / totalSubjects) * 100) : 0;
    
    // Credits distribution
    const creditsDistribution = subjects.reduce((acc, subject) => {
      const credits = subject.credits || 3;
      acc[credits] = (acc[credits] || 0) + 1;
      return acc;
    }, {});
    
    // Average credits per subject
    const avgCredits = totalSubjects > 0 ? Math.round(totalCredits / totalSubjects * 10) / 10 : 0;
    
    return {
      totalSubjects,
      totalCredits,
      levelDistribution,
      semesterDistribution,
      subjectsWithTeacher,
      teacherAssignmentRate,
      creditsDistribution,
      avgCredits
    };
  }, [subjects]);

  const toggleSubjectExpansion = (subjectId) => {
    setExpandedSubject(expandedSubject === subjectId ? null : subjectId);
  };

  const handleCreateSubject = () => {
    setEditingSubject(null);
    setFormData({
      name: "",
      teacher_id: "",
      credits: 3,
      semester: "S1",
      level: "Licence 1",
      description: ""
    });
    setIsModalOpen(true);
  };

  const handleEditSubject = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name || "",
      teacher_id: subject.teacher_id || "",
      credits: subject.credits || 3,
      semester: subject.semester || "S1",
      level: subject.level || "Licence 1",
      description: subject.description || ""
    });
    setIsModalOpen(true);
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette matière ?")) {
      return;
    }

    try {
      await subjectAPI.delete(subjectId);
      setSuccess("Matière supprimée avec succès");
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (error) {
      console.error("Erreur suppression matière:", error);
      setError("Erreur lors de la suppression de la matière");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError("Le nom de la matière est requis");
      return;
    }

    try {
      if (editingSubject) {
        await subjectAPI.update(editingSubject.id, formData);
        setSuccess("Matière mise à jour avec succès");
      } else {
        await subjectAPI.create(formData);
        setSuccess("Matière créée avec succès");
      }

      setIsModalOpen(false);
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Erreur enregistrement matière:", error);
      setError(error.response?.data?.error || "Erreur lors de l'enregistrement");
    }
  };

  const handleManualRefresh = async () => {
    setError(null);
    await fetchData();
  };

  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch =
      !searchTerm ||
      subject.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.level?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.semester?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === "all" || subject.level === filterLevel;
    const matchesSemester = filterSemester === "all" || subject.semester === filterSemester;
    const matchesTeacher = filterTeacher === "all" || subject.teacher_id === filterTeacher;

    return matchesSearch && matchesLevel && matchesSemester && matchesTeacher;
  });

  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubjects = filteredSubjects.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const allLevels = [
    ...new Set(subjects.map((subject) => subject.level).filter(Boolean))
  ].sort();

  const allSemesters = [
    ...new Set(subjects.map((subject) => subject.semester).filter(Boolean))
  ].sort();

  const stats = calculateSubjectStats;

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const levelDistributionChartData = {
    labels: Object.keys(stats.levelDistribution),
    datasets: [
      {
        data: Object.values(stats.levelDistribution),
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

  const teacherAssignmentChartData = {
    labels: ["Avec enseignant", "Sans enseignant"],
    datasets: [
      {
        data: [stats.subjectsWithTeacher, stats.totalSubjects - stats.subjectsWithTeacher],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(148, 163, 184, 0.8)",
        ],
        borderColor: ["#22c55e", "#94a3b8"],
        borderWidth: 2,
      },
    ],
  };

  const creditsDistributionChartData = {
    labels: Object.keys(stats.creditsDistribution),
    datasets: [
      {
        label: 'Nombre de matières',
        data: Object.values(stats.creditsDistribution),
        backgroundColor: "rgba(139, 92, 246, 0.8)",
        borderColor: "#8b5cf6",
        borderWidth: 1,
      },
    ],
  };

  if (loading.subjects) {
    return (
      <LoadingSpinner
        message={"Chargement des matières..."}
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
              <FiBook className="w-6 h-6 text-blue-600" />
              Gestion des Matières
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
              onClick={handleManualRefresh}
              style={{ backgroundColor: "#233D4D" }}
              className="flex items-center cursor-pointer gap-2 px-4 py-2 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading.subjects ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            
            <button
              onClick={handleCreateSubject}
              style={{ backgroundColor: "#FE7F2D" }}
              className="flex items-center cursor-pointer gap-2 px-4 py-2 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlus className="h-5 w-5" />
              Nouvelle Matière
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
        {/* Total Subjects Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiBook className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              MATIÈRES
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.totalSubjects}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Matières configurées</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {Object.keys(stats.levelDistribution).length}
              </div>
              <div>Niveaux</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {allSemesters.length}
              </div>
              <div>Semestres</div>
            </div>
          </div>
        </div>

        {/* Credits Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FiBookmark className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
              CRÉDITS
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.totalCredits}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Crédits totaux</p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Moyenne par matière</span>
              <span className="text-sm font-semibold text-green-600">
                {stats.avgCredits}
              </span>
            </div>
          </div>
        </div>

        {/* Teachers Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FaChalkboardTeacher className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
              ENSEIGNANTS
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {teachers.length}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Enseignants assignés</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-purple-600">
                {stats.teacherAssignmentRate}%
              </div>
              <div>Taux d'assignation</div>
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
            {filteredSubjects.length}
          </h3>
          <p className="text-gray-500 text-sm mb-3">
            Matières filtrées
          </p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiFilter className="text-blue-600" />
                <span className="text-xs text-gray-500">Critères actifs</span>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {filterLevel !== "all" || filterSemester !== "all" || filterTeacher !== "all" || searchTerm ? "Oui" : "Non"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Level Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiPieChart className="text-indigo-600" />
                Répartition par Niveau
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Distribution des matières par niveau académique
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

        {/* Teacher Assignment */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiUsers className="text-green-600" />
                Assignation Enseignants
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Taux d'assignation des enseignants
              </p>
            </div>
          </div>
          <div className="h-64 flex items-center">
            <div className="w-1/2">
              <Doughnut
                data={teacherAssignmentChartData}
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
                    {stats.teacherAssignmentRate}%
                  </div>
                  <p className="text-sm text-gray-500 text-center">Taux d'assignation</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Avec enseignant</span>
                    <span className="font-semibold text-green-600">
                      {stats.subjectsWithTeacher}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sans enseignant</span>
                    <span className="font-semibold text-red-600">
                      {stats.totalSubjects - stats.subjectsWithTeacher}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total enseignants</span>
                    <span className="font-semibold text-blue-600">
                      {teachers.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Credits Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiBarChart className="text-purple-600" />
                Distribution des Crédits
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Nombre de matières par crédits
              </p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={creditsDistributionChartData}
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
      </div>

      {/* Search and Filter Bar */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, niveau ou semestre..."
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

            <div className="flex items-center gap-2">
              <FiFilter className="h-5 w-5 text-gray-500" />
              <select 
                value={filterSemester}
                onChange={(e) => {
                  setFilterSemester(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-4 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
              >
                <option value="all">Tous les semestres</option>
                {allSemesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-4 py-2 ${showAdvancedFilters ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-700'} border border-gray-300 rounded-lg`}
              >
                <FiFilter className="h-4 w-4" />
                {showAdvancedFilters ? <FiChevronUp /> : <FiChevronDown />}
              </button>
              
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 cursor-pointer ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  title="Vue grille"
                >
                  <FiGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 cursor-pointer ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  title="Vue liste"
                >
                  <FiList className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enseignant
                </label>
                <select
                  value={filterTeacher}
                  onChange={(e) => {
                    setFilterTeacher(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les enseignants</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Crédits minimum
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  placeholder="Ex: 3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Crédits maximum
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  placeholder="Ex: 6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selection Bar */}
      {selectedSubjects.length > 0 && (
        <div className="max-w-7xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-lg">
                {selectedSubjects.length}
              </div>
              <div>
                <p className="font-medium text-blue-800">
                  {selectedSubjects.length} matière{selectedSubjects.length !== 1 ? 's' : ''} sélectionnée{selectedSubjects.length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-blue-600">
                  Actions disponibles sur les matières sélectionnées
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Exporter sélection
              </button>
              <button
                onClick={() => setSelectedSubjects([])}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subjects Content */}
      <div className="max-w-7xl mx-auto">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {paginatedSubjects.map((subject) => {
              const teacher = teachers.find(t => t.id === subject.teacher_id);
              const isExpanded = expandedSubject === subject.id;
              
              return (
                <div
                  key={subject.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden"
                >
                  {/* Status Indicator */}
                  <div className={`absolute top-0 left-0 w-2 h-full ${
                    subject.teacher_id ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>

                  <div className="p-6 ml-2">
                    {/* Subject Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <FiBook className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">
                          {subject.name}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {subject.level || "Non spécifié"}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                            {subject.semester}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                            {subject.credits || 3} crédits
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {subject.description && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                        {subject.description}
                      </p>
                    )}

                    {/* Teacher Info */}
                    <div className="mb-4">
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <FaChalkboardTeacher className="h-4 w-4 mr-2" />
                        <span>Enseignant:</span>
                      </div>
                      <p className={`text-sm font-medium ${subject.teacher_id ? 'text-gray-900' : 'text-gray-400'}`}>
                        {teacher ? teacher.name : "Non assigné"}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Crédits</span>
                        <span className="font-semibold text-gray-900">
                          {subject.credits || 3}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">ID</span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {subject.id.substring(0, 8)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSubject(subject)}
                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FiEdit2 className="h-4 w-4" />
                            Modifier
                          </button>
                          <button
                            onClick={() => toggleSubjectExpansion(subject.id)}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <FiEye className="h-4 w-4" />
                            {isExpanded ? "Masquer" : "Détails"}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details View */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="p-4">
                        <h4 className="font-medium text-gray-900 mb-3">
                          Détails de la matière
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-500">Description complète</p>
                            <p className="text-gray-900 mt-1">{subject.description || "Aucune description"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Niveau</p>
                              <p className="font-medium">{subject.level}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Semestre</p>
                              <p className="font-medium">{subject.semester}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Enseignant</p>
                            <div className="flex items-center mt-1">
                              <FiUser className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="font-medium">
                                {teacher ? teacher.name : "Non assigné"}
                              </span>
                            </div>
                          </div>
                        </div>
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
                  Matières Disponibles
                </h2>
                <div className="text-sm text-gray-500 mt-1 sm:mt-0">
                  {filteredSubjects.length} matière{filteredSubjects.length !== 1 ? "s" : ""} trouvée{filteredSubjects.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredSubjects.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {paginatedSubjects.map((subject) => {
                    const teacher = teachers.find(t => t.id === subject.teacher_id);
                    const isExpanded = expandedSubject === subject.id;
                    
                    return (
                      <div key={subject.id} className="p-4 hover:bg-gray-50">
                        {/* Subject Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <FiBook className="h-4 w-4 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {subject.name}
                                </h3>
                              </div>
                              
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                {subject.level || "Non spécifié"}
                              </span>
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                {subject.semester}
                              </span>
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                {subject.credits || 3} crédits
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                subject.teacher_id ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {subject.teacher_id ? "Avec enseignant" : "Sans enseignant"}
                              </span>
                            </div>

                            {subject.description && (
                              <p className="text-gray-600 text-sm mb-3 line-clamp-1">
                                {subject.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <FaChalkboardTeacher className="mr-1 h-4 w-4" />
                                {teacher ? teacher.name : "Non assigné"}
                              </span>
                              <span>ID: {subject.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSubjectExpansion(subject.id)}
                              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              {isExpanded ? (
                                <>
                                  <FiChevronUp className="h-4 w-4" />
                                  Masquer
                                </>
                              ) : (
                                <>
                                  <FiEye className="h-4 w-4" />
                                  Détails
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleEditSubject(subject)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <FiEdit2 className="h-5 w-5" />
                            </button>

                            <button
                              onClick={() => handleDeleteSubject(subject.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <FiTrash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details View */}
                        {isExpanded && (
                          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                              <h4 className="font-medium text-gray-900">
                                Détails Complets
                              </h4>
                            </div>

                            <div className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Description</p>
                                    <p className="text-gray-900">
                                      {subject.description || "Aucune description disponible"}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Informations académiques</p>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Niveau:</span>
                                        <span className="font-medium">{subject.level}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Semestre:</span>
                                        <span className="font-medium">{subject.semester}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Crédits:</span>
                                        <span className="font-medium">{subject.credits || 3}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Enseignant assigné</p>
                                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                                      <FiUser className="h-5 w-5 text-gray-400 mr-3" />
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {teacher ? teacher.name : "Non assigné"}
                                        </p>
                                        {teacher && (
                                          <p className="text-sm text-gray-500 mt-1">
                                            ID: {teacher.id}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Informations système</p>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">ID de la matière:</span>
                                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                          {subject.id}
                                        </code>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-white">
                  <FiBookOpen className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {searchTerm || filterLevel !== "all" || filterSemester !== "all" || filterTeacher !== "all"
                      ? "Aucune matière trouvée"
                      : "Aucune matière configurée"}
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-8">
                    {searchTerm
                      ? "Aucune matière ne correspond à votre recherche. Essayez avec d'autres termes."
                      : filterLevel !== "all" || filterSemester !== "all" || filterTeacher !== "all"
                      ? "Aucune matière ne correspond à vos filtres."
                      : "Commencez par ajouter votre première matière au système."}
                  </p>
                  {!searchTerm && filterLevel === "all" && filterSemester === "all" && filterTeacher === "all" && (
                    <button
                      onClick={handleCreateSubject}
                      style={{ backgroundColor: "#FE7F2D" }}
                      className="inline-flex items-center gap-3 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <FiPlus className="h-5 w-5" />
                      Ajouter votre première matière
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredSubjects.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Affichage {startIndex + 1} à{" "}
                    {Math.min(startIndex + itemsPerPage, filteredSubjects.length)} sur{" "}
                    {filteredSubjects.length} matières
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingSubject ? "Modifier la Matière" : "Nouvelle Matière"}
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
                    Nom de la Matière *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Robotique, IoT, Base de données"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enseignant
                  </label>
                  <select
                    value={formData.teacher_id}
                    onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Non assigné</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Crédits
                    </label>
                    <input
                      type="number"
                      value={formData.credits}
                      onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 3 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Semestre
                    </label>
                    <select
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {semesterOptions.map((semester) => (
                        <option key={semester} value={semester}>
                          {semester}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Niveau
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description de la matière..."
                    rows="3"
                  />
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
                  style={{ backgroundColor: "#FE7F2D" }}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  <FiSave className="h-4 w-4" />
                  {editingSubject ? "Mettre à jour" : "Créer"}
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
              {stats.totalSubjects} matières • {teachers.length} enseignants • {stats.totalCredits} crédits
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

export default Subjects;