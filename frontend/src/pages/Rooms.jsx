import React, { useState, useEffect } from 'react';
import roomAPI from '../api/roomsApi';
import esp32API from '../api/esp32Api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  FiPlus,
  FiWifi,
  FiHome,
  FiSettings,
  FiPower,
  FiAlertCircle,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiActivity,
  FiClock,
  FiRadio,
  FiEye,
  FiEyeOff,
  FiDownload,
  FiUpload,
  FiCheckCircle,
  FiXCircle,
  FiCpu,
  FiZap,
  FiBarChart2,
  FiServer,
  FiTrendingUp,
  FiBattery,
  FiThermometer,
  FiHardDrive
} from 'react-icons/fi';
import { MdMemory, MdNetworkCheck, MdWifiTethering } from 'react-icons/md';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' or 'esp32'
  const [esp32Status, setEsp32Status] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    esp32_id: '',
    location: '',
    description: '',
    active: true
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (rooms.length > 0 && activeTab === 'esp32') {
      fetchESP32Status();
    }
  }, [rooms, activeTab]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomAPI.getAll();
      if (response.data.success) {
        const roomsArray = Object.entries(response.data.data || {}).map(([id, data]) => ({
          id,
          ...data
        }));
        setRooms(roomsArray);
      }
    } catch (error) {
      console.error('Erreur chargement salles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchESP32Status = async () => {
    try {
      const statusPromises = rooms
        .filter(room => room.esp32_id)
        .map(async (room) => {
          try {
            const response = await esp32API.status(room.esp32_id);
            if (response.data.success) {
              return {
                roomId: room.id,
                esp32_id: room.esp32_id,
                status: response.data,
                lastUpdated: new Date().toISOString()
              };
            }
          } catch (error) {
            return {
              roomId: room.id,
              esp32_id: room.esp32_id,
              status: null,
              error: error.message,
              lastUpdated: new Date().toISOString()
            };
          }
        });

      const results = await Promise.all(statusPromises);
      const statusMap = {};
      results.forEach(result => {
        if (result) {
          statusMap[result.roomId] = result;
        }
      });
      setEsp32Status(statusMap);
    } catch (error) {
      console.error('Erreur récupération status ESP32:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      console.error('Erreur sauvegarde salle:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name || '',
      esp32_id: room.esp32_id || '',
      location: room.location || '',
      description: room.description || '',
      active: room.active !== false
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (roomId, currentStatus) => {
    try {
      await roomAPI.updateStatus(roomId, !currentStatus);
      fetchRooms();
    } catch (error) {
      console.error('Erreur changement statut salle:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette salle ?')) {
      try {
        await roomAPI.delete(roomId);
        fetchRooms();
      } catch (error) {
        console.error('Erreur suppression salle:', error);
        alert('Erreur: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      esp32_id: '',
      location: '',
      description: '',
      active: true
    });
    setEditingRoom(null);
    setShowForm(false);
  };

  const isRoomOnline = (room) => {
    if (!room.last_seen) return false;
    const lastSeen = new Date(room.last_seen);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    return diffMinutes < 5;
  };

  const onlineRooms = rooms.filter(isRoomOnline);
  const activeRooms = rooms.filter(r => r.active);
  const roomsWithESP32 = rooms.filter(r => r.esp32_id);

  // Filter rooms based on search and status
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = 
      !searchTerm || 
      room.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.esp32_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? room.active :
      statusFilter === 'inactive' ? !room.active :
      statusFilter === 'online' ? isRoomOnline(room) :
      true;
    
    return matchesSearch && matchesStatus;
  });

  // Filter ESP32 devices
  const filteredESP32 = rooms.filter(room => {
    if (!room.esp32_id) return false;
    const matchesSearch = 
      !searchTerm || 
      room.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.esp32_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'online' ? isRoomOnline(room) :
      statusFilter === 'offline' ? !isRoomOnline(room) :
      true;
    
    return matchesSearch && matchesStatus;
  });

  const exportRooms = () => {
    const dataStr = JSON.stringify(rooms, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salles_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pingESP32 = async (esp32_id) => {
    try {
      await esp32API.ping({ esp32_id });
      fetchRooms(); // Refresh rooms to update last_seen
    } catch (error) {
      console.error('Erreur ping ESP32:', error);
      alert('Erreur: ' + error.message);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-800">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Gestion des Salles & ESP32
            </h1>
            <p className="text-gray-600 mt-1">
              Configuration et surveillance des équipements IoT
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchRooms}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow text-gray-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <button
              onClick={exportRooms}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow text-gray-700"
            >
              <FiDownload className="h-4 w-4" />
              Exporter
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlus className="h-5 w-5" />
              Nouvelle salle
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiHome className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                Total
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {rooms.length}
            </h3>
            <p className="text-gray-600 mb-4">Salles</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-gray-500">Actives</p>
                  <p className="font-semibold text-green-600">{activeRooms.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Connectées</p>
                  <p className="font-semibold text-green-600">{onlineRooms.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FiCpu className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-medium text-purple-600">
                  {roomsWithESP32.length}/{rooms.length}
                </span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {roomsWithESP32.length}
            </h3>
            <p className="text-gray-600 mb-4">ESP32 Configurés</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Taux d'équipement</span>
                  <span className="font-semibold text-purple-600">
                    {rooms.length > 0 
                      ? Math.round((roomsWithESP32.length / rooms.length) * 100) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <FiWifi className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex items-center">
                <FiTrendingUp className="h-5 w-5 text-green-500 mr-1" />
                <span className="text-xs font-medium text-green-600">
                  {onlineRooms.length}/{rooms.length}
                </span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {onlineRooms.length}
            </h3>
            <p className="text-gray-600 mb-4">ESP32 en ligne</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Taux de connectivité</span>
                  <span className="font-semibold text-green-600">
                    {rooms.length > 0 
                      ? Math.round((onlineRooms.length / rooms.length) * 100) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <FiActivity className="h-6 w-6 text-orange-600" />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                Dernière heure
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {new Date().getHours()}h
            </h3>
            <p className="text-gray-600 mb-4">Dernière mise à jour</p>
            <div className="pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Statut système</span>
                  <span className="font-semibold text-green-600">Opérationnel</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex-1 py-4 px-6 text-center font-medium text-lg transition-colors ${
                activeTab === 'rooms'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FiHome className="h-5 w-5" />
                Salles
              </div>
            </button>
            <button
              onClick={() => setActiveTab('esp32')}
              className={`flex-1 py-4 px-6 text-center font-medium text-lg transition-colors ${
                activeTab === 'esp32'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FiCpu className="h-5 w-5" />
                ESP32
              </div>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'rooms' 
                    ? "Rechercher par nom, ID ESP32 ou localisation..."
                    : "Rechercher par ESP32 ID, salle ou localisation..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FiFilter className="h-5 w-5 text-gray-500" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-[180px]"
                >
                  <option value="all">Tous les statuts</option>
                  {activeTab === 'rooms' ? (
                    <>
                      <option value="active">Actives seulement</option>
                      <option value="inactive">Inactives seulement</option>
                      <option value="online">En ligne seulement</option>
                    </>
                  ) : (
                    <>
                      <option value="online">En ligne</option>
                      <option value="offline">Hors ligne</option>
                    </>
                  )}
                </select>
              </div>
              {activeTab === 'esp32' && (
                <button
                  onClick={fetchESP32Status}
                  className="flex items-center gap-2 px-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Vérifier statut
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rooms Management Tab */}
      {activeTab === 'rooms' && (
        <div className="max-w-7xl mx-auto">
          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredRooms.map(room => {
              const online = isRoomOnline(room);
              // const esp32Status = esp32Status[room.id];
              
              return (
                <div key={room.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                  {/* Room Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-bold text-gray-900 text-xl">{room.name}</h3>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                            room.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {room.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {room.location && (
                          <div className="flex items-center text-gray-600 mb-2">
                            <FiHome className="h-4 w-4 mr-2" />
                            {room.location}
                          </div>
                        )}
                        {room.esp32_id && (
                          <div className="flex items-center text-gray-600">
                            <FiCpu className="h-4 w-4 mr-2" />
                            <span className="font-mono">{room.esp32_id}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium mb-3 ${
                          online ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          <div className="flex items-center">
                            <div className={`h-2 w-2 rounded-full mr-2 ${online ? 'bg-purple-500' : 'bg-gray-400'}`}></div>
                            {online ? 'En ligne' : 'Hors ligne'}
                          </div>
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          ID: {room.id.substring(0, 8)}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    {room.description && (
                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {room.description}
                      </p>
                    )}

                    {/* Status Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Dernière activité</div>
                        <div className="flex items-center font-medium">
                          <FiClock className="h-4 w-4 mr-2 text-gray-400" />
                          {room.last_seen ? (
                            new Date(room.last_seen).toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          ) : (
                            'Jamais'
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Connectivité</div>
                        <div className="flex items-center font-medium">
                          <FiWifi className="h-4 w-4 mr-2 text-gray-400" />
                          {online ? 'Stable' : 'Perdue'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-6 pt-4">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleEdit(room)}
                        className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      >
                        <FiSettings className="h-4 w-4" />
                        Modifier
                      </button>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleStatus(room.id, room.active)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors ${
                            room.active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {room.active ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                          {room.active ? 'Désactiver' : 'Activer'}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <FiPower className="h-4 w-4" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredRooms.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <FiHome className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {searchTerm || statusFilter !== 'all' ? 'Aucune salle trouvée' : 'Aucune salle configurée'}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto mb-8">
                {searchTerm 
                  ? "Aucune salle ne correspond à votre recherche. Essayez avec d'autres termes."
                  : statusFilter !== 'all'
                  ? "Aucune salle ne correspond à ce filtre."
                  : "Commencez par ajouter votre première salle au système IoT."
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FiPlus className="h-5 w-5" />
                  Ajouter votre première salle
                </button>
              )}
            </div>
          )}

          {/* Summary Footer */}
          {filteredRooms.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                <div className="mb-4 lg:mb-0">
                  <h4 className="font-bold text-gray-900 mb-2">Récapitulatif</h4>
                  <p className="text-gray-600">
                    Affichage de <span className="font-semibold">{filteredRooms.length}</span> salle{filteredRooms.length !== 1 ? 's' : ''} sur {rooms.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-green-500 mr-3"></div>
                    <div>
                      <p className="text-sm text-gray-500">Salles actives</p>
                      <p className="font-semibold text-gray-900">{activeRooms.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-purple-500 mr-3"></div>
                    <div>
                      <p className="text-sm text-gray-500">ESP32 en ligne</p>
                      <p className="font-semibold text-gray-900">{onlineRooms.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-blue-500 mr-3"></div>
                    <div>
                      <p className="text-sm text-gray-500">Connectivité</p>
                      <p className="font-semibold text-gray-900">
                        {rooms.length > 0 
                          ? Math.round((onlineRooms.length / rooms.length) * 100) 
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ESP32 Management Tab */}
      {activeTab === 'esp32' && (
        <div className="max-w-7xl mx-auto">
          {/* ESP32 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {filteredESP32.map(room => {
              const online = isRoomOnline(room);
              const esp32Data = esp32Status[room.id];
              
              return (
                <div key={room.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                  {/* ESP32 Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-bold text-gray-900 text-xl">{room.esp32_id}</h3>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                            online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            <div className="flex items-center">
                              <div className={`h-2 w-2 rounded-full mr-2 ${online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                              {online ? 'Connecté' : 'Déconnecté'}
                            </div>
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600 mb-1">
                          <FiHome className="h-4 w-4 mr-2" />
                          <span className="font-medium">{room.name}</span>
                          {room.location && (
                            <span className="ml-3 text-sm">• {room.location}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          Room ID: {room.id.substring(0, 8)}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-lg font-bold mb-1 ${
                          room.active ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {room.active ? 'ACTIF' : 'INACTIF'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {room.last_seen ? (
                            <div className="flex items-center gap-1">
                              <FiClock className="h-3 w-3" />
                              {new Date(room.last_seen).toLocaleDateString('fr-FR')}
                            </div>
                          ) : 'Jamais connecté'}
                        </div>
                      </div>
                    </div>

                    {/* ESP32 Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-xl">
                        <div className="flex items-center mb-2">
                          <MdNetworkCheck className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="font-medium text-gray-900">État réseau</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          {online ? 'Stable' : 'Indisponible'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {online ? 'Connexion établie' : 'Aucun signal'}
                        </div>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-xl">
                        <div className="flex items-center mb-2">
                          <FiCpu className="h-5 w-5 text-purple-600 mr-2" />
                          <span className="font-medium text-gray-900">Dispositif</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-600 mb-1">
                          ESP32
                        </div>
                        <div className="text-sm text-gray-600">
                          Microcontrôleur
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ESP32 Status Details */}
                  <div className="p-6">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FiActivity className="h-5 w-5 text-blue-600" />
                      Informations système
                    </h4>
                    
                    {esp32Data?.status ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500 mb-1">Dernière vérification</div>
                            <div className="font-medium">
                              {new Date(esp32Data.lastUpdated).toLocaleTimeString('fr-FR')}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500 mb-1">Session active</div>
                            <div className="font-medium">
                              {esp32Data.status.active_session ? 'Oui' : 'Non'}
                            </div>
                          </div>
                        </div>
                        
                        {esp32Data.status.timestamp && (
                          <div className="bg-green-50 p-4 rounded-xl">
                            <div className="flex items-center">
                              <FiCheckCircle className="h-5 w-5 text-green-600 mr-2" />
                              <div>
                                <div className="font-medium text-green-800">API ESP32 accessible</div>
                                <div className="text-sm text-green-600">
                                  Dernière réponse: {new Date(esp32Data.status.timestamp).toLocaleTimeString('fr-FR')}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 p-4 rounded-xl">
                        <div className="flex items-center">
                          <FiAlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                          <div>
                            <div className="font-medium text-yellow-800">Statut non disponible</div>
                            <div className="text-sm text-yellow-600">
                              {esp32Data?.error || "L'ESP32 n'a pas encore été contacté"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                      <button
                        onClick={() => pingESP32(room.esp32_id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        <FiRefreshCw className="h-4 w-4" />
                        Envoyer Ping
                      </button>
                      <button
                        onClick={() => handleEdit(room)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
                      >
                        <FiSettings className="h-4 w-4" />
                        Configurer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ESP32 Empty State */}
          {filteredESP32.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <FiCpu className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {searchTerm || statusFilter !== 'all' ? 'Aucun ESP32 trouvé' : 'Aucun ESP32 configuré'}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto mb-8">
                {searchTerm 
                  ? "Aucun ESP32 ne correspond à votre recherche."
                  : statusFilter !== 'all'
                  ? "Aucun ESP32 ne correspond à ce filtre."
                  : "Aucun ESP32 n'est configuré pour le moment. Configurez un ESP32 dans les paramètres d'une salle."
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FiPlus className="h-5 w-5" />
                  Configurer un ESP32
                </button>
              )}
            </div>
          )}

          {/* ESP32 Summary */}
          {filteredESP32.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                <div className="mb-4 lg:mb-0">
                  <h4 className="font-bold text-gray-900 mb-2">Statistiques ESP32</h4>
                  <p className="text-gray-600">
                    {filteredESP32.length} ESP32 trouvé{filteredESP32.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Connectés</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {onlineRooms.length}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Taux de réponse</div>
                    <div className="text-2xl font-bold text-green-600">
                      {filteredESP32.length > 0 
                        ? Math.round((onlineRooms.length / filteredESP32.length) * 100) 
                        : 0}%
                    </div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Dernier ping</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {new Date().getHours()}h
                    </div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">En attente</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {filteredESP32.length - onlineRooms.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Room Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {editingRoom ? `ID: ${editingRoom.id}` : 'Configuration de la salle et de son ESP32'}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FiXCircle className="h-6 w-6 text-gray-500" />
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
                      <span className="text-red-500">*</span> ID ESP32
                    </label>
                    <div className="relative">
                      <FiCpu className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="esp32_id"
                        value={formData.esp32_id}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="Ex: ESP32_A1B2C3"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Localisation
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      placeholder="Ex: Bâtiment A, 1er étage, Bureau 101"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="4"
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm resize-none"
                      placeholder="Description détaillée de la salle, équipements disponibles, etc."
                    />
                  </div>
                </div>

                <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="active"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="active" className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">Activer cette salle dans le système</span>
                    <p className="text-gray-500 mt-1">La salle pourra recevoir des sessions et enregistrer des présences</p>
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
                    className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                  >
                    <FiSettings className="h-5 w-5" />
                    {editingRoom ? 'Mettre à jour' : 'Créer la salle'}
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
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">Système IoT actif</span>
            </div>
            <p className="text-sm text-gray-600">
              {rooms.length} salles • {roomsWithESP32.length} ESP32 • Connectivité: {rooms.length > 0 
                ? Math.round((onlineRooms.length / rooms.length) * 100) 
                : 0}%
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

export default Rooms;