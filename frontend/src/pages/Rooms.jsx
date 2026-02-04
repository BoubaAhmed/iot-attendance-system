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
import { Bar, Doughnut, Line } from "react-chartjs-2";
import roomAPI from "../api/roomsApi";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  FiPlus,
  FiHome,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiEdit2,
  FiTrash2,
  FiPower,
  FiCheck,
  FiX,
  FiSave,
  FiDownload,
  FiUpload,
  FiEye,
  FiEyeOff,
  FiMapPin,
  FiInfo,
  FiCpu,
  FiUser,
  FiClock,
  FiCalendar,
  FiBarChart2,
  FiTrendingUp,
  FiGrid,
  FiList,
  FiChevronRight,
  FiChevronLeft,
  FiChevronDown,
  FiChevronUp,
  FiMoreVertical,
  FiCopy,
  FiExternalLink,
  FiZap,
  FiActivity,
  FiCheckCircle,
  FiXCircle,
  FiPieChart,
  FiAlertCircle,
  FiMonitor,
  FiUsers,
  FiToggleLeft,
  FiWifi,
  FiSettings,
} from "react-icons/fi";
import {
  MdDateRange,
  MdSchool,
  MdMeetingRoom,
  MdOutlineWarning,
  MdAccessTime,
} from "react-icons/md";
import { BsWifi, BsWifiOff, BsClockHistory } from "react-icons/bs";

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

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState({
    rooms: true,
    stats: true,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [capacityFilter, setCapacityFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [roomStats, setRoomStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalCapacity: 0,
    avgCapacity: 0,
    utilizationRate: 0,
    esp32Connected: 0,
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    capacity: "",
    equipment: "",
    active: true,
    esp32_id: "",
  });

  useEffect(() => {
    fetchRooms();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchRooms();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchRooms = async () => {
    try {
      setLoading({ rooms: true, stats: true });
      setError(null);
      
      const response = await roomAPI.getAll();
      if (response.data.success) {
        const roomsArray = Object.entries(response.data.data || {}).map(
          ([id, data]) => ({
            id,
            ...data,
          })
        );
        setRooms(roomsArray);
        calculateRoomStats(roomsArray);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Erreur chargement salles:", error);
      setError("Impossible de charger les données des salles");
    } finally {
      setLoading({ rooms: false, stats: false });
    }
  };

  const calculateRoomStats = (roomsData) => {
    const total = roomsData.length;
    const active = roomsData.filter(r => r.active).length;
    const inactive = total - active;
    const totalCapacity = roomsData.reduce((sum, room) => 
      sum + (parseInt(room.capacity) || 0), 0);
    const avgCapacity = total > 0 ? Math.round(totalCapacity / total) : 0;
    const utilizationRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const esp32Connected = roomsData.filter(r => r.esp32_id && r.esp32_id.trim() !== "").length;

    setRoomStats({
      total,
      active,
      inactive,
      totalCapacity,
      avgCapacity,
      utilizationRate,
      esp32Connected,
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await roomAPI.update(editingRoom.id, formData);
      } else {
        await roomAPI.create(formData);
      }
      resetForm();
      fetchRooms();
    } catch (error) {
      console.error("Erreur sauvegarde salle:", error);
      setError("Erreur lors de la sauvegarde de la salle");
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name || "",
      location: room.location || "",
      description: room.description || "",
      capacity: room.capacity || "",
      equipment: room.equipment || "",
      active: room.active !== false,
      esp32_id: room.esp32_id || ""
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (roomId, currentStatus) => {
    try {
      await roomAPI.updateStatus(roomId, !currentStatus);
      fetchRooms();
    } catch (error) {
      console.error("Erreur changement statut salle:", error);
      setError("Erreur lors du changement de statut");
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette salle ?")) {
      try {
        await roomAPI.delete(roomId);
        fetchRooms();
      } catch (error) {
        console.error("Erreur suppression salle:", error);
        setError("Erreur lors de la suppression");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      description: "",
      capacity: "",
      equipment: "",
      active: true,
      esp32_id: ""
    });
    setEditingRoom(null);
    setShowForm(false);
  };

  const handleSelectAll = () => {
    if (selectedRooms.length === filteredRooms.length) {
      setSelectedRooms([]);
    } else {
      setSelectedRooms(filteredRooms.map(room => room.id));
    }
  };

  const handleSelectRoom = (roomId) => {
    setSelectedRooms(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const exportRooms = () => {
    const dataToExport = selectedRooms.length > 0 
      ? rooms.filter(room => selectedRooms.includes(room.id))
      : rooms;
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `salles_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter rooms based on search and status
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        !searchTerm ||
        room.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? room.active
          : statusFilter === "inactive"
          ? !room.active
          : true;

      const matchesCapacity = 
        !capacityFilter || 
        (room.capacity && parseInt(room.capacity) >= parseInt(capacityFilter));

      const matchesEquipment = 
        equipmentFilter === "all" || 
        (room.equipment && room.equipment.toLowerCase().includes(equipmentFilter));

      return matchesSearch && matchesStatus && matchesCapacity && matchesEquipment;
    }).sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name?.localeCompare(b.name || "");
        case "capacity":
          return (parseInt(b.capacity) || 0) - (parseInt(a.capacity) || 0);
        case "status":
          return (b.active ? 1 : 0) - (a.active ? 1 : 0);
        default:
          return 0;
      }
    });
  }, [rooms, searchTerm, statusFilter, capacityFilter, equipmentFilter, sortBy]);

  // Chart data for room utilization
  const roomStatusChartData = {
    labels: ["Actives", "Inactives"],
    datasets: [
      {
        data: [roomStats.active, roomStats.inactive],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderColor: ["#22c55e", "#ef4444"],
        borderWidth: 2,
      },
    ],
  };

  const capacityDistributionChartData = {
    labels: filteredRooms.slice(0, 5).map(room => room.name),
    datasets: [
      {
        label: "Capacité",
        data: filteredRooms.slice(0, 5).map(room => parseInt(room.capacity) || 0),
        backgroundColor: "rgba(14, 165, 233, 0.8)",
        borderColor: "#0ea5e9",
        borderWidth: 1,
        borderRadius: 4,
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
    await fetchRooms();
  };

  if (loading.rooms) {
    return (
      <LoadingSpinner
        message={"Chargement des salles..."}
        sub={"Synchronisation avec Firebase"}
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FiMonitor className="w-6 h-6" style={{ color:"#233D4D" }} />
              Gestion des Salles IoT
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
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading.rooms ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            
            <button
              onClick={() => setShowForm(true)} style={{ backgroundColor:"#FE7F2D" }}
              className="flex items-center gap-2 px-4 py-2  text-white rounded-lg cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlus className="h-5 w-5" />
              Nouvelle salle
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
      </div>

      {/* Main Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Rooms Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiHome className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              TOTAL
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {roomStats.total}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Salles configurées</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-green-600">
                {roomStats.active}
              </div>
              <div>Actives</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-600">
                {roomStats.inactive}
              </div>
              <div>Inactives</div>
            </div>
          </div>
        </div>

        {/* Capacity Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <FiUser className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">
              CAPACITÉ
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {roomStats.totalCapacity}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Places totales</p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Moyenne par salle</span>
              <span className="text-sm font-semibold text-teal-600">
                {roomStats.avgCapacity} places
              </span>
            </div>
          </div>
        </div>

        {/* Utilization Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FiTrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              UTILISATION
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {roomStats.utilizationRate}%
          </h3>
          <p className="text-gray-500 text-sm mb-3">Taux d'utilisation</p>
          <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="font-semibold text-green-600">
                {roomStats.esp32Connected}
              </div>
              <div>ESP32 connectés</div>
            </div>
          </div>
        </div>

        {/* Selection Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <FiCheckCircle className="h-5 w-5 text-cyan-600" />
            </div>
            <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded">
              SÉLECTION
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {selectedRooms.length}
          </h3>
          <p className="text-gray-500 text-sm mb-3">Salles sélectionnées</p>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiFilter className="text-blue-600" />
                <span className="text-xs text-gray-500">Filtre actif</span>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {filteredRooms.length}
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
                placeholder="Rechercher par nom, localisation ou description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FiFilter className="h-5 w-5 text-gray-500" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 cursor-pointer rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actives seulement</option>
                <option value="inactive">Inactives seulement</option>
              </select>
            </div>
            
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
            
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer ${showAdvancedFilters ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-700'} border border-gray-300 rounded-lg`}
            >
              <FiFilter className="h-4 w-4" />
              {showAdvancedFilters ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={exportRooms}
                className="flex items-center gap-2 px-4 py-1.5 cursor-pointer bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                title="Exporter"
              >
                <FiDownload className="h-4 w-4" />
                {selectedRooms.length > 0 ? 'Exporter sélection' : 'Exporter tout'}
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacité minimum
                </label>
                <input
                  type="number"
                  placeholder="Ex: 20"
                  value={capacityFilter}
                  onChange={(e) => setCapacityFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tri par
                </label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">Nom (A-Z)</option>
                  <option value="capacity">Capacité</option>
                  <option value="status">Statut</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Équipement
                </label>
                <select 
                  value={equipmentFilter}
                  onChange={(e) => setEquipmentFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous</option>
                  <option value="projector">Projecteur</option>
                  <option value="ordinateurs">Ordinateurs</option>
                  <option value="computer">Computer</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selection Bar */}
      {selectedRooms.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-lg">
                  {selectedRooms.length}
                </div>
                <div>
                  <p className="font-medium text-blue-800">
                    {selectedRooms.length} salle{selectedRooms.length !== 1 ? 's' : ''} sélectionnée{selectedRooms.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-blue-600">
                    Actions disponibles sur les salles sélectionnées
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    selectedRooms.forEach(roomId => {
                      const room = rooms.find(r => r.id === roomId);
                      if (room) handleToggleStatus(roomId, room.active);
                    });
                  }}
                  className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50"
                >
                  {selectedRooms.some(id => {
                    const room = rooms.find(r => r.id === id);
                    return room?.active;
                  }) ? 'Désactiver tout' : 'Activer tout'}
                </button>
                <button
                  onClick={exportRooms}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Exporter sélection
                </button>
                <button
                  onClick={() => setSelectedRooms([])}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Content */}
      <div className="max-w-7xl mx-auto">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className={`bg-white rounded-xl border ${
                  room.active ? 'border-gray-200' : 'border-gray-300'
                } shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden`}
              >
                {/* Active Status Indicator */}
                <div className={`absolute top-0 left-0 w-2 h-full ${
                  room.active ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>

                <div className="p-6 ml-2">
                  {/* Selection Checkbox */}
                  <div className="absolute top-4 right-4 z-10">
                    <input
                      type="checkbox"
                      checked={selectedRooms.includes(room.id)}
                      onChange={() => handleSelectRoom(room.id)}
                      className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </div>

                  {/* Room Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${
                      room.active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <FiHome className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate">
                        {room.name}
                      </h3>
                      {room.location && (
                        <div className="flex items-center text-gray-600 mt-1 text-sm">
                          <FiMapPin className="h-4 w-4 mr-2 shrink-0" />
                          <span className="truncate">{room.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      room.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {room.active ? 'Active' : 'Inactive'}
                      {room.esp32_id && (
                        <span className="ml-1">
                          • <FiCpu className="inline h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Description */}
                  {room.description && (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                      {room.description}
                    </p>
                  )}

                  {/* Room Details */}
                  <div className="space-y-3 mb-4">
                    {room.capacity && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Capacité</span>
                        <span className="font-semibold text-gray-900">
                          {room.capacity} places
                        </span>
                      </div>
                    )}
                    
                    {room.equipment && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Équipement</span>
                        <span className="font-medium text-gray-900 truncate ml-2 max-w-30">
                          {room.equipment.split(',')[0].trim()}
                          {room.equipment.split(',').length > 1 && '...'}
                        </span>
                      </div>
                    )}
                    
                    {room.esp32_id && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">ESP32 ID</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {room.esp32_id}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(room)}
                          className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FiEdit2 className="h-4 w-4" />
                          Modifier
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(room.id, room.active)}
                          className={`p-2 rounded-lg transition-colors ${
                            room.active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={room.active ? 'Désactiver' : 'Activer'}
                        >
                          {room.active ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
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
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRooms.length === filteredRooms.length && filteredRooms.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </th>

                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <FiCpu className="w-4 h-4" />
                      Salle
                    </span>
                  </th>

                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <FiMapPin className="w-4 h-4" />
                      Localisation
                    </span>
                  </th>

                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <FiUsers className="w-4 h-4" />
                      Capacité
                    </span>
                  </th>

                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <FiToggleLeft className="w-4 h-4" />
                      Statut
                    </span>
                  </th>

                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <FiWifi className="w-4 h-4" />
                      ESP32
                    </span>
                  </th>

                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <FiSettings className="w-4 h-4" />
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRooms.includes(room.id)}
                        onChange={() => handleSelectRoom(room.id)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-10 w-10">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            room.active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <FiHome className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{room.name}</div>
                          {room.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">{room.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{room.location || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{room.capacity || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${room.active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          room.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {room.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {room.esp32_id ? (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {room.esp32_id}
                        </code>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(room)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(room.id, room.active)}
                          className={`p-2 rounded-lg transition-colors ${
                            room.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={room.active ? "Désactiver" : "Activer"}
                        >
                          {room.active ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {filteredRooms.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
            <FiHome className="h-20 w-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {searchTerm || statusFilter !== "all" || capacityFilter || equipmentFilter !== "all"
                ? "Aucune salle trouvée"
                : "Aucune salle configurée"}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              {searchTerm
                ? "Aucune salle ne correspond à votre recherche. Essayez avec d'autres termes."
                : statusFilter !== "all" || capacityFilter || equipmentFilter !== "all"
                ? "Aucune salle ne correspond à vos filtres. Essayez de modifier vos critères."
                : "Commencez par ajouter votre première salle au système."}
            </p>
            {!searchTerm && statusFilter === "all" && !capacityFilter && equipmentFilter === "all" && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-3 px-6 py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <FiPlus className="h-5 w-5" />
                Ajouter votre première salle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Analytics Charts */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Room Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiPieChart className="text-indigo-600" />
                Répartition des Salles
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Statut d'activation des salles
              </p>
            </div>
          </div>
          <div className="h-64 flex items-center">
            <div className="w-1/2">
              <Doughnut
                data={roomStatusChartData}
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
                      <span className="text-sm font-medium text-gray-700">Actives</span>
                    </div>
                    <span className="font-semibold text-green-600">
                      {roomStats.active}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(roomStats.active / roomStats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-gray-700">Inactives</span>
                    </div>
                    <span className="font-semibold text-red-600">
                      {roomStats.inactive}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${(roomStats.inactive / roomStats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Taux d'activation</span>
                    <span className="font-bold text-blue-600">
                      {roomStats.utilizationRate}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Capacity Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiBarChart2 className="text-cyan-600" />
                Distribution des Capacités
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Top 5 des salles par capacité
              </p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={capacityDistributionChartData}
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
                      callback: (value) => `${value} places`,
                    },
                    title: {
                      display: true,
                      text: 'Capacité (places)',
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

      {/* Room Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingRoom ? "Modifier la salle" : "Nouvelle salle"}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {editingRoom
                      ? `ID: ${editingRoom.id}`
                      : "Configurer une nouvelle salle"}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FiX className="h-6 w-6 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <span className="text-red-500">*</span> Nom de la salle
                    </label>
                    <div className="relative">
                      <FiHome className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="Ex: Salle Robotics Lab"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Localisation
                    </label>
                    <div className="relative">
                      <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="Ex: Bâtiment A, 1er étage"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Capacité
                    </label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      placeholder="Nombre de places"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Équipement
                    </label>
                    <input
                      type="text"
                      name="equipment"
                      value={formData.equipment}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      placeholder="Ex: Projecteur, Ordinateurs"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      ESP32 ID
                    </label>
                    <div className="relative">
                      <FiCpu className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="esp32_id"
                        value={formData.esp32_id}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="ID de l'ESP32"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm resize-none"
                      placeholder="Description détaillée de la salle..."
                    />
                  </div>
                </div>

                <div className="flex items-center p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="active"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <label
                    htmlFor="active"
                    className="ml-3 text-sm text-gray-700"
                  >
                    <span className="font-medium">
                      Activer cette salle dans le système
                    </span>
                    <p className="text-gray-500 mt-1">
                      La salle pourra recevoir des sessions et enregistrer des présences
                    </p>
                  </label>
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-8 py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                  >
                    <FiSave className="h-5 w-5" />
                    {editingRoom ? "Mettre à jour" : "Créer la salle"}
                  </button>
                </div>
              </form>
            </div>
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
              {roomStats.total} salles • {roomStats.active} actives • {roomStats.esp32Connected} ESP32 connectés
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

export default Rooms;