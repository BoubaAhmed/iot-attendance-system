import React, { useState, useEffect } from 'react';
import { roomAPI } from '../api/api';
import { listenToRooms } from '../firebase/firebase';
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
  FiUpload
} from 'react-icons/fi';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    esp32_id: '',
    location: '',
    description: '',
    active: true
  });

  useEffect(() => {
    fetchRooms();
    setupRealtimeListener();
  }, []);

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

  const setupRealtimeListener = () => {
    const unsubscribe = listenToRooms((data) => {
      if (data) {
        const roomsArray = Object.entries(data).map(([id, roomData]) => ({
          id,
          ...roomData
        }));
        setRooms(roomsArray);
      }
    });
    return unsubscribe;
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

  // Filtrage des salles
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des salles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion des salles</h1>
            <p className="text-gray-600 mt-1">Configuration des salles et équipements ESP32</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportRooms}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiDownload className="h-4 w-4" />
              Exporter
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPlus className="h-5 w-5" />
              Nouvelle salle
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total salles</p>
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiHome className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Actives</p>
                <p className="text-2xl font-bold text-green-600">{activeRooms.length}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <FiActivity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En ligne</p>
                <p className="text-2xl font-bold text-purple-600">{onlineRooms.length}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiWifi className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Taux de connectivité</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rooms.length > 0 ? Math.round((onlineRooms.length / rooms.length) * 100) : 0}%
                </p>
              </div>
              <div className="p-2 bg-gray-100 rounded-lg">
                <FiRefreshCw className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, ID ESP32 ou localisation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <FiFilter className="h-5 w-5 text-gray-500" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Toutes les salles</option>
              <option value="active">Actives seulement</option>
              <option value="inactive">Inactives seulement</option>
              <option value="online">En ligne seulement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formulaire modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 md:p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingRoom ? 'Modifier la salle' : 'Ajouter une salle'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {editingRoom ? `ID: ${editingRoom.id}` : 'Configurez une nouvelle salle avec ESP32'}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiAlertCircle className="h-6 w-6 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de la salle *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Salle Robotics"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ID ESP32 *
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <FiRadio className="h-5 w-5 text-gray-400 ml-3" />
                      <input
                        type="text"
                        name="esp32_id"
                        value={formData.esp32_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-3 border-0 rounded-lg focus:ring-0"
                        placeholder="Ex: ESP32_A"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Localisation
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Bâtiment A, 1er étage"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Description de la salle et de son utilisation..."
                    />
                  </div>
                </div>

                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="active"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="ml-3 text-sm text-gray-700">
                    Cette salle est active dans le système
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

      {/* Liste des salles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map(room => {
          const online = isRoomOnline(room);
          
          return (
            <div key={room.id} className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all hover:shadow-md">
              <div className="p-5">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{room.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        room.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {room.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {room.location && (
                      <p className="text-sm text-gray-600">
                        <FiHome className="inline mr-1" size={14} />
                        {room.location}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium mb-2 ${
                      online ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full mr-2 ${online ? 'bg-purple-500' : 'bg-gray-400'}`}></div>
                        {online ? 'En ligne' : 'Hors ligne'}
                      </div>
                    </span>
                    <span className="text-xs text-gray-500">
                      ID: {room.id.substring(0, 8)}...
                    </span>
                  </div>
                </div>

                {/* Description */}
                {room.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {room.description}
                  </p>
                )}

                {/* Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm">
                    <FiRadio className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium">ESP32:</span>
                    <code className="ml-2 bg-gray-100 px-2 py-1 rounded font-mono">
                      {room.esp32_id || 'Non configuré'}
                    </code>
                  </div>
                  
                  <div className="flex items-center text-sm">
                    <FiActivity className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium">Dernière activité:</span>
                    <span className="ml-2 text-gray-600">
                      {room.last_seen ? (
                        <span className="flex items-center">
                          {new Date(room.last_seen).toLocaleDateString('fr-FR')}
                          <FiClock className="ml-1" size={12} />
                        </span>
                      ) : (
                        'Jamais connectée'
                      )}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between border-t pt-4">
                  <button
                    onClick={() => handleEdit(room)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <FiSettings className="h-4 w-4" />
                    Modifier
                  </button>
                  
                  <button
                    onClick={() => handleToggleStatus(room.id, room.active)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      room.active
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {room.active ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                    {room.active ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-12">
          <FiHome className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'Aucune salle trouvée' : 'Aucune salle configurée'}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            {searchTerm 
              ? 'Aucune salle ne correspond à votre recherche. Essayez avec d\'autres termes.'
              : statusFilter !== 'all'
              ? 'Aucune salle ne correspond à ce filtre.'
              : 'Commencez par ajouter votre première salle au système.'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPlus className="h-5 w-5" />
              Ajouter une salle
            </button>
          )}
        </div>
      )}

      {/* Footer Summary */}
      {filteredRooms.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-gray-600">
          <div className="mb-2 sm:mb-0">
            Affichage de <span className="font-semibold">{filteredRooms.length}</span> salle{filteredRooms.length !== 1 ? 's' : ''} sur {rooms.length}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
              <span>{activeRooms.length} actives</span>
            </div>
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-purple-500 mr-2"></div>
              <span>{onlineRooms.length} en ligne</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;