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
import { Bar, Doughnut, Line, Pie } from "react-chartjs-2";
import studentAPI from "../api/studentsApi";
import groupAPI from "../api/groupsApi";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  FiSearch,
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiCheck,
  FiUsers,
  FiUser,
  FiMail,
  FiPhone,
  FiActivity,
  FiFilter,
  FiDownload,
  FiSave,
  FiHash,
  FiBriefcase,
  FiUserCheck,
  FiClock,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiStar,
  FiTrendingUp,
  FiCalendar,
  FiChevronRight,
  FiChevronLeft,
  FiCopy,
  FiAlertCircle,
  FiShield,
  FiPercent,
  FiPlus,
  FiZap,
  FiPieChart,
  FiBarChart2,
  FiGrid,
  FiList,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiHome,
  FiMapPin,
} from "react-icons/fi";
import { MdDateRange, MdSchool, MdOutlineWarning } from "react-icons/md";
import { BsClockHistory } from "react-icons/bs";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

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

const MySwal = withReactContent(Swal);

const Students = () => {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState({
    students: true,
    stats: true,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    group: "",
    fingerprint_id: "",
    email: "",
    phone: "",
    active: true,
  });
  console.log(students)
  const [activeFilter, setActiveFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [formErrors, setFormErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showMobileForm, setShowMobileForm] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useState("list");

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    fetchStudents();
    fetchGroups();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStudents();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchStudents = async () => {
    try {
      setLoading(prev => ({ ...prev, students: true }));
      const response = await studentAPI.getAll();
      if (response.data.success) {
        let studentsData = response.data.data;
        if (
          studentsData &&
          typeof studentsData === "object" &&
          !Array.isArray(studentsData)
        ) {
          studentsData = Object.values(studentsData);
        }
        const sortedStudents = (studentsData || []).sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );
        setStudents(sortedStudents);
        setLastUpdated(new Date());
      } else {
        toast.error(response.data.error || "Failed to load students");
      }
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Error loading students. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, students: false }));
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await groupAPI.getAll();
      if (response.data.success) {
        const groupsData = response.data.data || {};
        const groupsArray = Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data,
        }));
        setGroups(groupsArray);
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  };

  const calculateStudentStats = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s?.active !== false).length;
    const inactiveStudents = students.filter(s => s?.active === false).length;
    const activePercentage = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
    
    // Students per group
    const studentsPerGroup = {};
    students.forEach(student => {
      const groupId = student.group;
      if (groupId) {
        studentsPerGroup[groupId] = (studentsPerGroup[groupId] || 0) + 1;
      }
    });
    
    // Groups with most students
    const groupsWithStudents = groups.map(group => ({
      ...group,
      studentCount: studentsPerGroup[group.id] || 0,
    })).sort((a, b) => b.studentCount - a.studentCount);
    
    return {
      totalStudents,
      activeStudents,
      inactiveStudents,
      activePercentage,
      studentsPerGroup,
      groupsWithStudents,
    };
  }, [students, groups]);

  const stats = calculateStudentStats;

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    if (formData.fingerprint_id && !/^\d+$/.test(formData.fingerprint_id)) {
      errors.fingerprint_id = "Fingerprint ID must be a number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix form errors");
      return;
    }

    try {
      const studentData = {
        name: formData.name.trim(),
        group: formData.group.trim() || "",
        email: formData.email.trim() || "",
        phone: formData.phone.trim() || "",
        active: formData.active,
      };

      if (formData.fingerprint_id.trim()) {
        studentData.fingerprint_id = parseInt(formData.fingerprint_id);
      }

      if (editingStudent) {
        const response = await studentAPI.update(
          editingStudent.fingerprint_id,
          studentData,
        );
        if (response.data.success) {
          toast.success("Student updated successfully!");
          resetForm();
          fetchStudents();
          setSelectedStudent(null);
        } else {
          toast.error(response.data.error || "Failed to update student");
        }
      } else {
        const response = await studentAPI.create(studentData);
        if (response.data.success) {
          toast.success("Student created successfully!");
          resetForm();
          fetchStudents();
        } else {
          toast.error(response.data.error || "Failed to create student");
        }
      }
    } catch (error) {
      console.error("Error saving student:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Unknown error";
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name || "",
      group: student.group || "",
      fingerprint_id: student.fingerprint_id?.toString() || "",
      email: student.email || "",
      phone: student.phone || "",
      active: student.active !== false,
    });
    setSelectedStudent(student);
    setShowMobileForm(true);
  };

  const handleDelete = async (student) => {
    const result = await MySwal.fire({
      title: "Supprimer l'Étudiant",
      html: (
        <div className="text-left">
          <p className="mb-4 text-gray-600">
            Êtes-vous sûr de vouloir supprimer cet étudiant ?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                <FiUser className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{student.name}</p>
                <p className="text-sm text-gray-600">
                  ID: {student.fingerprint_id}
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-red-600">Cette action est irréversible.</p>
        </div>
      ),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Oui, supprimer",
      cancelButtonText: "Annuler",
      reverseButtons: true,
      customClass: {
        popup: "rounded-xl",
        confirmButton: "px-4 py-2 rounded-lg",
        cancelButton: "px-4 py-2 rounded-lg",
      },
    });

    if (result.isConfirmed) {
      try {
        const response = await studentAPI.delete(student.fingerprint_id);
        if (response.data.success) {
          toast.success("Étudiant supprimé avec succès!");
          fetchStudents();
          if (selectedStudent?.fingerprint_id === student.fingerprint_id) {
            setSelectedStudent(null);
          }
          if (editingStudent?.fingerprint_id === student.fingerprint_id) {
            resetForm();
          }
        } else {
          toast.error(response.data.error || "Failed to delete student");
        }
      } catch (error) {
        console.error("Error deleting student:", error);
        const errorMessage = error.response?.data?.error || error.message;
        toast.error(`Error: ${errorMessage}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      group: "",
      fingerprint_id: "",
      email: "",
      phone: "",
      active: true,
    });
    setEditingStudent(null);
    setFormErrors({});
  };

  const exportStudents = () => {
    const dataStr = JSON.stringify(students, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etudiants_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Étudiants exportés avec succès!");
  };

  const refreshStudents = () => {
    fetchStudents();
    toast.info("Actualisation de la liste des étudiants...");
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier!");
  };

  const filteredStudents = students.filter((student) => {
    if (!student) return false;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (student.name?.toLowerCase() || "").includes(searchLower) ||
      (student.group?.toLowerCase() || "").includes(searchLower) ||
      (student.email?.toLowerCase() || "").includes(searchLower) ||
      (student.fingerprint_id?.toString() || "").includes(searchLower);

    const matchesFilter =
      activeFilter === "all"
        ? true
        : activeFilter === "active"
          ? student.active !== false
          : activeFilter === "inactive"
            ? student.active === false
            : true;

    const matchesGroup = 
      groupFilter === "all" || 
      (student.group && student.group === groupFilter);

    return matchesSearch && matchesFilter && matchesGroup;
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Chart data
  const studentStatusChartData = {
    labels: ["Actifs", "Inactifs"],
    datasets: [
      {
        data: [stats.activeStudents, stats.inactiveStudents],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderColor: ["#22c55e", "#ef4444"],
        borderWidth: 2,
      },
    ],
  };

  const groupDistributionChartData = {
    labels: stats.groupsWithStudents.slice(0, 5).map(g => g.name),
    datasets: [
      {
        label: "Nombre d'étudiants",
        data: stats.groupsWithStudents.slice(0, 5).map(g => g.studentCount),
        backgroundColor: [
          "rgba(30, 64, 175, 0.8)",
          "rgba(37, 99, 235, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(96, 165, 250, 0.8)",
          "rgba(6, 182, 212, 0.8)",
        ],
        borderColor: [
          "#1e40af",
          "#2563eb",
          "#3b82f6",
          "#60a5fa",
          "#06b6d4",
        ],
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  if (loading.students) {
    return (
      <LoadingSpinner
        message={"Chargement des étudiants..."}
        sub={"Synchronisation avec Firebase"}
        className="min-h-screen"
      />
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-2">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      {/* Mobile Form Toggle Button */}
      <button
        onClick={() => setShowMobileForm(!showMobileForm)}
        className="lg:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-blue-600 hover:bg-blue-700"
      >
        {showMobileForm ? (
          <FiX className="h-6 w-6 text-white" />
        ) : (
          <FiUserPlus className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mb-2">
              <FiUsers className="text-gray-700" />
              Gestion des Étudiants
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
              onClick={refreshStudents}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading.students ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Students Card */}
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
            {stats.totalStudents}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Inscrits au système</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {stats.activeStudents}
              </div>
              <div>Actifs</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700">
                {stats.inactiveStudents}
              </div>
              <div>Inactifs</div>
            </div>
          </div>
        </div>

        {/* Active Rate Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <FiActivity className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">
              ACTIVITÉ
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {stats.activePercentage}%
          </h3>
          <p className="text-gray-500 text-sm mb-3">Taux d'activation</p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Statut global</span>
              <span className={`text-sm font-semibold ${
                stats.activePercentage > 70 ? 'text-green-600' : 
                stats.activePercentage > 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {stats.activePercentage > 70 ? 'Excellent' : 
                 stats.activePercentage > 50 ? 'Bon' : 'À améliorer'}
              </span>
            </div>
          </div>
        </div>

        {/* Groups Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <MdSchool className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              GROUPES
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {Object.keys(stats.studentsPerGroup).length}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Groupes avec étudiants</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-indigo-600">
                {stats.groupsWithStudents[0]?.studentCount || 0}
              </div>
              <div>Max/groupe</div>
            </div>
          </div>
        </div>

        {/* Filtered Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <FiFilter className="h-5 w-5 text-cyan-600" />
            </div>
            <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded">
              FILTRÉS
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {filteredStudents.length}
          </h3>
          <p className="text-gray-500 text-sm mb-3">
            Résultats de recherche
          </p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiEye className="text-blue-600" />
                <span className="text-xs text-gray-500">Page actuelle</span>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {currentPage}/{totalPages}
              </span>
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
                placeholder="Rechercher par nom, groupe, email ou ID..."
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
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="border cursor-pointer border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs seulement</option>
                <option value="inactive">Inactifs seulement</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <FiFilter className="h-5 w-5 text-gray-500" />
              <select 
                value={groupFilter}
                onChange={(e) => {
                  setGroupFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="border cursor-pointer border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
              >
                <option value="all">Tous les groupes</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex border border-gray-300 rounded-lg overflow-hidden ">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2.5 cursor-pointer ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                title="Vue grille"
              >
                <FiGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2.5 cursor-pointer ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                title="Vue liste"
              >
                <FiList className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportStudents}
                className="flex items-center gap-2 px-4 py-2 bg-white border cursor-pointer border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                title="Exporter"
              >
                <FiDownload className="h-4 w-4" />
                Exporter
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowMobileForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiUserPlus className="h-4 w-4" />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Students Content */}
      <div className="max-w-7xl mx-auto">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {currentStudents.map((student, index) => {
              const groupInfo = groups.find(g => g.id === student.group);
              
              return (
                <div
                  key={student.fingerprint_id || index}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden"
                >
                  {/* Status Indicator */}
                  <div className={`absolute top-0 left-0 w-2 h-full ${
                    student.active !== false ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>

                  <div className="p-6 ml-2">
                    {/* Student Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-xl ${
                        student.active !== false ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <FiUser className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">
                          {student.name || "N/A"}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            student.active !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {student.active !== false ? 'Actif' : 'Inactif'}
                          </span>
                          {student.fingerprint_id && (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              ID: {student.fingerprint_id}
                            </code>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 mb-4">
                      {student.group && (
                        <div className="flex items-center text-sm">
                          <MdSchool className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                          <div>
                            <span className="font-medium text-gray-900">
                              {groupInfo?.name || student.group}
                            </span>
                            {groupInfo?.level && (
                              <div className="text-xs text-gray-500">
                                {groupInfo.level}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {student.email && (
                        <div className="flex items-center text-sm">
                          <FiMail className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                          <span className="text-gray-700 truncate">
                            {student.email}
                          </span>
                        </div>
                      )}
                      
                      {student.phone && (
                        <div className="flex items-center text-sm">
                          <FiPhone className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
                          <span className="text-gray-700">
                            {student.phone}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(student)}
                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FiEdit2 className="h-4 w-4" />
                            Modifier
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {student.phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(student.phone);
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Copier le téléphone"
                            >
                              <FiCopy className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(student);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
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
                  Liste des Étudiants
                </h2>
                <div className="text-sm text-gray-500 mt-1 sm:mt-0">
                  {filteredStudents.length} étudiant{filteredStudents.length !== 1 ? "s" : ""} trouvé{filteredStudents.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredStudents.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Étudiant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Détails
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentStudents.map((student, index) => {
                      const groupInfo = groups.find(g => g.id === student.group);
                      
                      return (
                        <tr
                          key={student.fingerprint_id || index}
                          className={`transition-all hover:shadow-md cursor-pointer ${
                            selectedStudent?.fingerprint_id === student.fingerprint_id
                              ? "bg-blue-50"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedStudent(student)}
                        >
                          <td className="px-6 py-2">
                            <div className="flex items-center">
                              <div className="shrink-0 h-10 w-10">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                  student.active !== false ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  <FiUser className="h-5 w-5" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 flex items-center">
                                  {student.name || "N/A"}
                                  {student.active === false && (
                                    <FiEyeOff className="h-4 w-4 ml-2 text-gray-400" />
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {student.fingerprint_id || "N/A"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-2">
                            <div className="space-y-2">
                              {student.group && (
                                <div className="flex items-center text-sm">
                                  <MdSchool className="h-4 w-4 mr-2 text-gray-400" />
                                  <div>
                                    <span className="font-medium text-blue-600">
                                      {groupInfo?.name || student.group}
                                    </span>
                                    {groupInfo?.level && (
                                      <div className="text-xs text-gray-500">
                                        {groupInfo.level}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-2">
                            <div className="space-y-2">
                              {student.email && (
                                <div className="flex items-center text-sm">
                                  <FiMail className="h-4 w-4 mr-2 text-gray-400" />
                                  <span className="text-gray-700 truncate max-w-50">
                                    {student.email}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-2">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                student.active !== false
                                  ? "text-green-700 bg-green-100 border border-green-200"
                                  : "text-gray-700 bg-gray-100 border border-gray-200"
                              }`}>
                                <div className={`h-2 w-2 rounded-full mr-2 ${
                                  student.active !== false ? "bg-green-500" : "bg-gray-500"
                                }`}></div>
                                {student.active !== false ? "Actif" : "Inactif"}
                              </span>
                              {student.phone && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(student.phone);
                                  }}
                                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                                  title="Copier le téléphone"
                                >
                                  <FiPhone className="h-4 w-4 text-gray-500" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-2">
                            <div className="flex space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(student);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <FiEdit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(student);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-16">
                  <div className="inline-flex p-6 rounded-full mb-4 bg-gray-100">
                    <FiUsers className="h-16 w-16 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || activeFilter !== "all" || groupFilter !== "all"
                      ? "Aucun étudiant trouvé"
                      : "Aucun étudiant enregistré"}
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto mb-6">
                    {searchTerm
                      ? "Aucun étudiant ne correspond à votre recherche. Essayez d'autres termes."
                      : activeFilter !== "all" || groupFilter !== "all"
                        ? "Aucun étudiant ne correspond à vos filtres."
                        : "Commencez par ajouter votre premier étudiant."}
                  </p>
                  {!searchTerm && activeFilter === "all" && groupFilter === "all" && (
                    <button
                      onClick={() => {
                        resetForm();
                        setShowMobileForm(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg hover:shadow-lg transition-all bg-blue-600 text-white"
                    >
                      <FiUserPlus className="h-5 w-5" />
                      Ajouter le premier étudiant
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Affichage {indexOfFirstItem + 1} à{" "}
                    {Math.min(indexOfLastItem, filteredStudents.length)} sur{" "}
                    {filteredStudents.length} étudiants
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg ${
                        currentPage === 1
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <FiChevronLeft className="h-5 w-5" />
                    </button>

                    {[...Array(Math.min(5, totalPages))].map((_, index) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = index + 1;
                      } else if (currentPage <= 3) {
                        pageNum = index + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + index;
                      } else {
                        pageNum = currentPage - 2 + index;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => paginate(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-lg ${
                        currentPage === totalPages
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <FiChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Analytics Charts */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Student Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiPieChart className="text-indigo-600" />
                Statut des Étudiants
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Répartition active/inactive
              </p>
            </div>
          </div>
          <div className="h-64 flex items-center">
            <div className="w-1/2">
              <Doughnut
                data={studentStatusChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "65%",
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
            <div className="w-1/2 pl-8">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-700">Actifs</span>
                    </div>
                    <span className="font-semibold text-green-600">
                      {stats.activeStudents}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(stats.activeStudents / stats.totalStudents) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-gray-700">Inactifs</span>
                    </div>
                    <span className="font-semibold text-red-600">
                      {stats.inactiveStudents}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${(stats.inactiveStudents / stats.totalStudents) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Group Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiBarChart2 className="text-cyan-600" />
                Répartition par Groupe
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Top 5 des groupes par nombre d'étudiants
              </p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={groupDistributionChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(0, 0, 0, 0.05)" },
                    ticks: {
                      color: "#6b7280",
                    },
                    title: {
                      display: true,
                      text: "Nombre d'étudiants",
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

      {/* Student Form Modal */}
      {showMobileForm && (
        <div className="studentsForm fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingStudent ? "Modifier l'Étudiant" : "Nouvel Étudiant"}
                </h3>
                <button
                  onClick={() => {
                    setShowMobileForm(false);
                    resetForm();
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 space-y-4 space-x-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom Complet *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Entrez le nom de l'étudiant"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Groupe
                  </label>
                  <select
                    name="group"
                    value={formData.group}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionnez un groupe</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="etudiant@email.com"
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de Téléphone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+212 6 XX XX XX XX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fingerprint ID
                  </label>
                  <input
                    type="text"
                    name="fingerprint_id"
                    value={formData.fingerprint_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Entrez l'ID fingerprint"
                  />
                  {formErrors.fingerprint_id && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FiAlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.fingerprint_id}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {editingStudent
                      ? "Impossible de changer l'ID fingerprint pour un étudiant existant"
                      : "Laissez vide pour générer automatiquement"}
                  </p>
                </div>

                <div className="flex items-center p-4 cursor-pointer"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      active: !prev.active,
                    }))
                  }
                >
                  <input
                    type="checkbox"
                    id="active"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <label
                    htmlFor="active"
                    className="ml-3 text-sm flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span>Étudiant actif</span>
                      <div className={`h-2 w-2 rounded-full ${formData.active ? "bg-green-500" : "bg-gray-400"}`}></div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-col space-y-3">
                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {editingStudent ? (
                      <>
                        <FiSave className="h-5 w-5" />
                        Mettre à jour
                      </>
                    ) : (
                      <>
                        <FiUserPlus className="h-5 w-5" />
                        Ajouter l'étudiant
                      </>
                    )}
                  </button>

                  {editingStudent && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Annuler
                    </button>
                  )}
                </div>
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
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">
                Système IoT Opérationnel
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats.totalStudents} étudiants • {stats.activeStudents} actifs • 
              {stats.activePercentage}% de taux d'activation
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

export default Students;