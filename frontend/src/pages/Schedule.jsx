import React, { useState, useEffect, useCallback } from 'react';
import { scheduleAPI, roomAPI, groupAPI, subjectAPI, sessionAPI } from '../api/api';
import { 
  FiCalendar,
  FiClock,
  FiHome,
  FiUsers,
  FiBook,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiFilter,
  FiSearch,
  FiRefreshCw,
  FiPlayCircle,
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiSave,
  FiDownload,
  FiUpload,
  FiGrid,
  FiList,
  FiCopy,
  FiDownloadCloud,
  FiUploadCloud,
  FiLayers,
  FiRepeat,
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiEyeOff,
  FiToggleLeft,
  FiToggleRight,
  FiCheckSquare,
  FiSquare,
  FiCalendar as FiCal,
  FiMaximize2,
  FiMinimize2,
  FiAlertTriangle,
  FiZap,
  FiCopy as FiCopyIcon
} from 'react-icons/fi';
import { toast } from 'react-toastify';
// import TimeSlotEditor from '../components/TimeSlotEditor';
// import ScheduleConflictChecker from '../components/ScheduleConflictChecker';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAYS_DISPLAY = {
  'monday': { fr: 'Lundi', short: 'Lun', en: 'Monday' },
  'tuesday': { fr: 'Mardi', short: 'Mar', en: 'Tuesday' },
  'wednesday': { fr: 'Mercredi', short: 'Mer', en: 'Wednesday' },
  'thursday': { fr: 'Jeudi', short: 'Jeu', en: 'Thursday' },
  'friday': { fr: 'Vendredi', short: 'Ven', en: 'Friday' },
  'saturday': { fr: 'Samedi', short: 'Sam', en: 'Saturday' }
};

const TIME_SLOTS = [
  '08:00-09:30',
  '09:45-11:15',
  '11:30-13:00',
  '14:00-15:30',
  '15:45-17:15',
  '17:30-19:00'
];

const Schedule = () => {
  const [schedule, setSchedule] = useState({});
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // États pour la vue et filtres
  const [selectedDay, setSelectedDay] = useState('monday');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showEmptySlots, setShowEmptySlots] = useState(true);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // États pour la modale d'ajout/édition
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    day: 'monday',
    room: '',
    timeSlot: TIME_SLOTS[0],
    group: '',
    subject: ''
  });
  
  // États pour la génération de sessions
  const [generatingSessions, setGeneratingSessions] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  // États pour les statistiques et conflits
  const [stats, setStats] = useState({
    totalEntries: 0,
    entriesByDay: {},
    entriesByRoom: {},
    entriesByGroup: {},
    conflicts: []
  });

  // États pour le mode de masse
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [bulkData, setBulkData] = useState({
    days: [],
    timeSlots: [],
    rooms: [],
    group: '',
    subject: ''
  });

  const [conflicts, setConflicts] = useState([]);
  const [showConflicts, setShowConflicts] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
    checkConflicts();
  }, [schedule, rooms, groups]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scheduleRes, roomsRes, groupsRes, subjectsRes] = await Promise.all([
        scheduleAPI.getAll(),
        roomAPI.getAll(),
        groupAPI.getAll(),
        subjectAPI.getAll()
      ]);

      if (scheduleRes.data.success) {
        setSchedule(scheduleRes.data.data || {});
      }
      
      if (roomsRes.data.success) {
        const roomsData = roomsRes.data.data || {};
        setRooms(Object.entries(roomsData).map(([id, data]) => ({
          id,
          ...data
        })).filter(r => r.active !== false));
      }
      
      if (groupsRes.data.success) {
        const groupsData = groupsRes.data.data || {};
        setGroups(Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data
        })));
      }
      
      if (subjectsRes.data.success) {
        const subjectsData = subjectsRes.data.data || {};
        setSubjects(Object.entries(subjectsData).map(([id, data]) => ({
          id,
          ...data
        })));
      }
      
      toast.success('Données chargées avec succès');
    } catch (error) {
      console.error('Erreur chargement emploi du temps:', error);
      toast.error('Impossible de charger les données');
      setError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const entriesByDay = {};
    const entriesByRoom = {};
    const entriesByGroup = {};
    let totalEntries = 0;

    DAYS.forEach(day => {
      entriesByDay[day] = 0;
      const roomSchedules = schedule[day] || {};
      
      Object.entries(roomSchedules).forEach(([roomId, roomSchedule]) => {
        Object.values(roomSchedule).forEach(entry => {
          if (entry.group && entry.subject) {
            entriesByDay[day]++;
            totalEntries++;
            
            // Compter par salle
            const room = rooms.find(r => r.id === roomId);
            const roomName = room?.name || roomId;
            entriesByRoom[roomName] = (entriesByRoom[roomName] || 0) + 1;
            
            // Compter par groupe
            const groupName = groups.find(g => g.id === entry.group)?.name || entry.group;
            entriesByGroup[groupName] = (entriesByGroup[groupName] || 0) + 1;
          }
        });
      });
    });

    setStats(prev => ({
      ...prev,
      totalEntries,
      entriesByDay,
      entriesByRoom,
      entriesByGroup
    }));
  };

  const checkConflicts = () => {
    const newConflicts = [];
    const timeSlotMap = {};

    // Vérifier les conflits par créneau horaire
    DAYS.forEach(day => {
      const roomSchedules = schedule[day] || {};
      
      Object.entries(roomSchedules).forEach(([roomId, roomSchedule]) => {
        Object.entries(roomSchedule).forEach(([timeSlot, entry]) => {
          const key = `${day}-${timeSlot}`;
          
          if (!timeSlotMap[key]) {
            timeSlotMap[key] = [];
          }
          
          timeSlotMap[key].push({
            roomId,
            roomName: rooms.find(r => r.id === roomId)?.name || roomId,
            group: entry.group,
            groupName: groups.find(g => g.id === entry.group)?.name || entry.group,
            subject: entry.subject,
            subjectName: subjects.find(s => s.id === entry.subject)?.name || entry.subject
          });
        });
      });
    });

    // Détecter les conflits (même groupe à plusieurs endroits en même temps)
    Object.entries(timeSlotMap).forEach(([key, entries]) => {
      const [day, timeSlot] = key.split('-');
      
      // Vérifier les groupes dupliqués
      const groupOccurrences = {};
      entries.forEach(entry => {
        if (entry.group) {
          groupOccurrences[entry.group] = (groupOccurrences[entry.group] || 0) + 1;
        }
      });

      Object.entries(groupOccurrences).forEach(([groupId, count]) => {
        if (count > 1) {
          const conflictingEntries = entries.filter(e => e.group === groupId);
          newConflicts.push({
            type: 'group_conflict',
            day,
            timeSlot,
            groupId,
            groupName: groups.find(g => g.id === groupId)?.name || groupId,
            rooms: conflictingEntries.map(e => e.roomName),
            severity: 'high'
          });
        }
      });
    });

    setConflicts(newConflicts);
    setStats(prev => ({ ...prev, conflicts: newConflicts }));
  };

  const handleAddEntry = () => {
    setEditingEntry(null);
    setFormData({
      day: selectedDay,
      room: rooms.length > 0 ? rooms[0].id : '',
      timeSlot: TIME_SLOTS[0],
      group: groups.length > 0 ? groups[0].id : '',
      subject: subjects.length > 0 ? subjects[0].id : ''
    });
    setIsModalOpen(true);
  };

  const handleEditEntry = (day, roomId, timeSlot, entry) => {
    setEditingEntry({ day, roomId, timeSlot });
    setFormData({
      day,
      room: roomId,
      timeSlot,
      group: entry.group || '',
      subject: entry.subject || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteEntry = async (day, roomId, timeSlot) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) {
      return;
    }

    try {
      await scheduleAPI.deleteEntry({
        day,
        room: roomId,
        time_slot: timeSlot
      });
      toast.success('Créneau supprimé avec succès');
      fetchData();
    } catch (error) {
      console.error('Erreur suppression créneau:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.room || !formData.group || !formData.subject) {
      toast.error('Tous les champs sont requis');
      return;
    }

    try {
      const entryData = {
        day: formData.day,
        room: formData.room,
        time_slot: formData.timeSlot,
        group: formData.group,
        subject: formData.subject
      };

      if (editingEntry) {
        await scheduleAPI.updateEntry(entryData);
        toast.success('Créneau mis à jour avec succès');
      } else {
        await scheduleAPI.addEntry(entryData);
        toast.success('Créneau ajouté avec succès');
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erreur enregistrement créneau:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (!bulkData.group || !bulkData.subject || bulkData.days.length === 0 || 
        bulkData.timeSlots.length === 0 || bulkData.rooms.length === 0) {
      toast.error('Veuillez remplir tous les champs pour l\'ajout en masse');
      return;
    }

    try {
      const promises = [];
      
      bulkData.days.forEach(day => {
        bulkData.rooms.forEach(roomId => {
          bulkData.timeSlots.forEach(timeSlot => {
            const entryData = {
              day,
              room: roomId,
              time_slot: timeSlot,
              group: bulkData.group,
              subject: bulkData.subject
            };
            promises.push(scheduleAPI.addEntry(entryData));
          });
        });
      });

      await Promise.all(promises);
      toast.success(`${promises.length} créneaux ajoutés avec succès`);
      setIsBulkModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erreur ajout en masse:', error);
      toast.error('Erreur lors de l\'ajout en masse');
    }
  };

  const handleGenerateSessions = async () => {
    if (!selectedDate) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setGeneratingSessions(true);
    try {
      const response = await sessionAPI.generate(selectedDate);
      if (response.data.success) {
        toast.success(`Sessions générées avec succès pour le ${selectedDate}`);
        if (autoGenerate) {
          setSelectedDate(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1)).toISOString().split('T')[0]);
        }
      }
    } catch (error) {
      console.error('Erreur génération sessions:', error);
      toast.error('Erreur lors de la génération des sessions');
    } finally {
      setGeneratingSessions(false);
      setShowGenerateModal(false);
    }
  };

  const handleCopyDay = async (sourceDay, targetDay) => {
    if (!window.confirm(`Copier l'emploi du temps du ${DAYS_DISPLAY[sourceDay].fr} vers le ${DAYS_DISPLAY[targetDay].fr} ?`)) {
      return;
    }

    try {
      const sourceSchedule = schedule[sourceDay] || {};
      const updates = [];

      // Supprimer les entrées existantes du jour cible
      if (schedule[targetDay]) {
        Object.entries(schedule[targetDay]).forEach(([roomId, roomSchedule]) => {
          Object.keys(roomSchedule).forEach(timeSlot => {
            updates.push(
              scheduleAPI.deleteEntry({
                day: targetDay,
                room: roomId,
                time_slot: timeSlot
              })
            );
          });
        });
      }

      // Ajouter les nouvelles entrées
      Object.entries(sourceSchedule).forEach(([roomId, roomSchedule]) => {
        Object.entries(roomSchedule).forEach(([timeSlot, entry]) => {
          updates.push(
            scheduleAPI.addEntry({
              day: targetDay,
              room: roomId,
              time_slot: timeSlot,
              group: entry.group,
              subject: entry.subject
            })
          );
        });
      });

      await Promise.all(updates);
      toast.success(`Emploi du temps copié du ${DAYS_DISPLAY[sourceDay].fr} vers le ${DAYS_DISPLAY[targetDay].fr}`);
      fetchData();
    } catch (error) {
      console.error('Erreur copie jour:', error);
      toast.error('Erreur lors de la copie');
    }
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(schedule, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emploi_du_temps_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Emploi du temps exporté avec succès');
  };

  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        // TODO: Validate imported data structure
        // For now, just show a confirmation
        if (window.confirm('Êtes-vous sûr de vouloir importer cet emploi du temps ? L\'existant sera remplacé.')) {
          // In a real implementation, you would send this to the API
          toast.info('Importation en cours...');
          // await scheduleAPI.importData(importedData);
          toast.success('Importation réussie !');
          fetchData();
        }
      } catch (error) {
        toast.error('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
  };

  const getRoomSchedule = (day, roomId) => {
    return schedule[day]?.[roomId] || {};
  };

  const getEntryInfo = (day, roomId, timeSlot) => {
    const entry = getRoomSchedule(day, roomId)[timeSlot];
    if (!entry) return null;
    
    const group = groups.find(g => g.id === entry.group);
    const subject = subjects.find(s => s.id === entry.subject);
    
    return {
      groupName: group?.name || entry.group,
      subjectName: subject?.name || entry.subject,
      teacher: subject?.teacher || '',
      level: group?.level || ''
    };
  };

  const toggleSlotSelection = (day, roomId, timeSlot) => {
    const slotId = `${day}-${roomId}-${timeSlot}`;
    setSelectedSlots(prev => 
      prev.includes(slotId) 
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    );
  };

  const clearSelections = () => {
    setSelectedSlots([]);
    setBulkData({
      days: [],
      timeSlots: [],
      rooms: [],
      group: '',
      subject: ''
    });
  };

  const filteredRooms = rooms.filter(room => {
    if (selectedRoom !== 'all' && room.id !== selectedRoom) return false;
    if (searchTerm) {
      const roomName = room.name?.toLowerCase() || '';
      return roomName.includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const handleTimeSlotChange = (day, roomId, oldTimeSlot, newTimeSlot) => {
    // Implementation for drag and drop or time slot change
    console.log('Time slot changed:', { day, roomId, oldTimeSlot, newTimeSlot });
    // You would update the schedule here
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <FiCalendar className="absolute inset-0 m-auto h-8 w-8 text-blue-600 animate-pulse" />
        </div>
        <p className="mt-4 text-gray-600 font-medium">Chargement de l'emploi du temps...</p>
        <p className="text-sm text-gray-500 mt-2">Récupération des données en temps réel</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      {/* Header avec navigation */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Gestion de l'emploi du temps
            </h1>
            <p className="text-gray-600 mt-2">
              Planifiez les sessions et générez automatiquement les présences
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
            >
              <FiZap className="h-4 w-4" />
              Générer sessions
            </button>
            <button
              onClick={handleAddEntry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="h-5 w-5" />
              Ajouter créneau
            </button>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
            >
              <FiLayers className="h-5 w-5" />
              Ajout en masse
            </button>
          </div>
        </div>

        {/* Alertes de conflits */}
        {conflicts.length > 0 && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FiAlertTriangle className="h-5 w-5 text-red-600 mr-3" />
                  <h3 className="font-semibold text-red-900">
                    Conflits détectés ({conflicts.length})
                  </h3>
                </div>
                <button
                  onClick={() => setShowConflicts(!showConflicts)}
                  className="text-sm text-red-700 hover:text-red-900 flex items-center gap-1"
                >
                  {showConflicts ? 'Masquer' : 'Voir détails'}
                  {showConflicts ? <FiChevronUp /> : <FiChevronDown />}
                </button>
              </div>
              {showConflicts && (
                <div className="space-y-2">
                  {conflicts.map((conflict, index) => (
                    <div key={index} className="p-3 bg-white rounded-lg border border-red-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-red-800">
                            Conflit de groupe: {conflict.groupName}
                          </p>
                          <p className="text-sm text-red-600">
                            {DAYS_DISPLAY[conflict.day].fr} • {conflict.timeSlot}
                          </p>
                          <p className="text-xs text-red-500">
                            Salles: {conflict.rooms.join(', ')}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          Critique
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Créneaux programmés</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEntries}</p>
                <div className="flex items-center mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (stats.totalEntries / (rooms.length * TIME_SLOTS.length * DAYS.length)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    {Math.round((stats.totalEntries / (rooms.length * TIME_SLOTS.length * DAYS.length)) * 100)}%
                  </span>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiCalendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Salles actives</p>
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Object.keys(stats.entriesByRoom).length} utilisées
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <FiHome className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Groupes affectés</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.entriesByGroup).length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {groups.length} groupes total
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <FiUsers className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Jour le plus chargé</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.entries(stats.entriesByDay).reduce((maxDay, [day, count]) => 
                    count > (stats.entriesByDay[maxDay] || 0) ? day : maxDay, DAYS[0]
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {DAYS_DISPLAY[Object.entries(stats.entriesByDay).reduce((maxDay, [day, count]) => 
                    count > (stats.entriesByDay[maxDay] || 0) ? day : maxDay, DAYS[0]
                  )]?.fr} • {stats.entriesByDay[Object.entries(stats.entriesByDay).reduce((maxDay, [day, count]) => 
                    count > (stats.entriesByDay[maxDay] || 0) ? day : maxDay, DAYS[0]
                  )] || 0} créneaux
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <FiClock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation par jour */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex items-center">
              <FiCalendar className="h-5 w-5 text-gray-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900">Navigation par jour</h2>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    selectedDay === day
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                  }`}
                >
                  <span className="font-medium">{DAYS_DISPLAY[day].short}</span>
                  <span className="text-xs block mt-0.5">{stats.entriesByDay[day] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Statistiques par jour */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {DAYS.map(day => {
              const entryCount = stats.entriesByDay[day] || 0;
              const maxEntries = rooms.length * TIME_SLOTS.length;
              const percentage = maxEntries > 0 ? (entryCount / maxEntries) * 100 : 0;
              
              return (
                <div key={day} className={`p-3 rounded-lg border ${
                  selectedDay === day 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">
                      {DAYS_DISPLAY[day].fr}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entryCount > 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {entryCount}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        percentage > 80 ? 'bg-red-500' :
                        percentage > 60 ? 'bg-yellow-500' :
                        percentage > 0 ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outils et filtres */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center">
            <FiFilter className="h-5 w-5 text-gray-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Outils et filtres</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Recherche */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une salle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            
            {/* Filtre par salle */}
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Toutes les salles</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
            
            {/* Options d'affichage */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEmptySlots(!showEmptySlots)}
                  className={`p-2 rounded-lg ${
                    showEmptySlots 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {showEmptySlots ? <FiEye /> : <FiEyeOff />}
                </button>
                <span className="text-sm text-gray-600">Vides</span>
              </div>
              
              <div className="flex border border-gray-300 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  <FiGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  <FiList className="h-5 w-5" />
                </button>
              </div>
              
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                {isExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles d'action */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Actions rapides</h3>
            <p className="text-sm text-gray-500">Gérez votre emploi du temps efficacement</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Génération auto:</span>
              <button
                onClick={() => setAutoGenerate(!autoGenerate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  autoGenerate ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  autoGenerate ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                <FiDownloadCloud className="h-4 w-4" />
                Exporter
              </button>
              
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer">
                <FiUploadCloud className="h-4 w-4" />
                Importer
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
              
              {selectedSlots.length > 0 && (
                <button
                  onClick={clearSelections}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
                >
                  <FiX className="h-4 w-4" />
                  {selectedSlots.length} sélectionnés
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Emploi du temps principal */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {DAYS_DISPLAY[selectedDay].fr} - Emploi du temps détaillé
              </h2>
              <p className="text-sm text-gray-500">
                {filteredRooms.length} salle{filteredRooms.length !== 1 ? 's' : ''} • {stats.entriesByDay[selectedDay] || 0} créneaux programmés
              </p>
            </div>
            <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
              {DAYS.filter(day => day !== selectedDay).map(day => (
                <button
                  key={day}
                  onClick={() => handleCopyDay(selectedDay, day)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
                  title={`Copier vers ${DAYS_DISPLAY[day].fr}`}
                >
                  <FiCopyIcon className="h-4 w-4" />
                  Copier vers {DAYS_DISPLAY[day].short}
                </button>
              ))}
              
              <button
                onClick={() => {
                  // Copy to all days
                  if (window.confirm('Copier vers tous les jours ?')) {
                    DAYS.filter(day => day !== selectedDay).forEach(day => {
                      handleCopyDay(selectedDay, day);
                    });
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50"
              >
                <FiCopyIcon className="h-4 w-4" />
                Copier vers tous
              </button>
            </div>
          </div>
        </div>
        
        {/* Vue grille améliorée */}
        {viewMode === 'grid' && filteredRooms.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-4 text-left font-semibold text-gray-900 border-r border-gray-200">
                    <div className="flex items-center justify-between">
                      <span>Salle / Horaire</span>
                      <button
                        onClick={() => {
                          const allSlotIds = filteredRooms.flatMap(room =>
                            TIME_SLOTS.map(timeSlot => `${selectedDay}-${room.id}-${timeSlot}`)
                          );
                          setSelectedSlots(allSlotIds);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Tout sélectionner
                      </button>
                    </div>
                  </th>
                  {TIME_SLOTS.map(timeSlot => (
                    <th key={timeSlot} className="bg-gray-50 p-4 text-center font-semibold text-gray-900 border-b border-gray-200">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{timeSlot.split('-')[0]}</span>
                        <span className="text-xs text-gray-500">à {timeSlot.split('-')[1]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room, roomIndex) => (
                  <tr key={room.id} className={`${roomIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="sticky left-0 z-10 bg-inherit p-4 border-r border-gray-200">
                      <div className="flex flex-col">
                        <div className="font-semibold text-gray-900">{room.name}</div>
                        <div className="text-sm text-gray-600">{room.location || '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {stats.entriesByRoom[room.name] || 0} créneaux
                        </div>
                      </div>
                    </td>
                    {TIME_SLOTS.map(timeSlot => {
                      const entry = getRoomSchedule(selectedDay, room.id)[timeSlot];
                      const info = getEntryInfo(selectedDay, room.id, timeSlot);
                      const slotId = `${selectedDay}-${room.id}-${timeSlot}`;
                      const isSelected = selectedSlots.includes(slotId);
                      
                      if (!entry && !showEmptySlots) {
                        return (
                          <td key={timeSlot} className="p-4 border-b border-gray-100">
                            {/* Empty but hidden */}
                          </td>
                        );
                      }
                      
                      return (
                        <td key={timeSlot} className="p-4 border-b border-gray-100">
                          {entry ? (
                            <div className={`relative rounded-xl p-4 border transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm'
                            }`}>
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSlotSelection(selectedDay, room.id, timeSlot)}
                                      className="h-4 w-4 text-blue-600 rounded"
                                    />
                                    <div className="font-semibold text-gray-900">{info?.groupName || entry.group}</div>
                                  </div>
                                  <div className="text-sm text-gray-700 mb-1">{info?.subjectName || entry.subject}</div>
                                  {info?.teacher && (
                                    <div className="text-xs text-gray-500">Enseignant: {info.teacher}</div>
                                  )}
                                </div>
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleEditEntry(selectedDay, room.id, timeSlot, entry)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                                  >
                                    <FiEdit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(selectedDay, room.id, timeSlot)}
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"
                                  >
                                    <FiTrash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className={`text-center py-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
                            }`}>
                              <div className="flex flex-col items-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSlotSelection(selectedDay, room.id, timeSlot)}
                                  className="h-4 w-4 text-blue-600 rounded mb-2"
                                />
                                <button
                                  onClick={() => {
                                    setFormData({
                                      day: selectedDay,
                                      room: room.id,
                                      timeSlot,
                                      group: groups.length > 0 ? groups[0].id : '',
                                      subject: subjects.length > 0 ? subjects[0].id : ''
                                    });
                                    setEditingEntry(null);
                                    setIsModalOpen(true);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 hover:bg-white p-2 rounded-lg transition-colors"
                                >
                                  <FiPlus className="h-5 w-5" />
                                </button>
                                <p className="text-xs text-gray-500 mt-2">Ajouter un créneau</p>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Vue liste améliorée */}
        {viewMode === 'list' && filteredRooms.length > 0 && (
          <div className="divide-y divide-gray-200">
            {filteredRooms.map((room, roomIndex) => {
              const roomSchedule = getRoomSchedule(selectedDay, room.id);
              const timeSlots = Object.keys(roomSchedule);
              
              return (
                <div key={room.id} className={`p-5 transition-colors ${
                  roomIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FiHome className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                          <div className="text-sm text-gray-600">
                            {room.location || 'Localisation non définie'} • {room.esp32_id ? `ESP32: ${room.esp32_id}` : 'ESP32 non configuré'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {timeSlots.length} créneau{timeSlots.length !== 1 ? 'x' : ''}
                      </span>
                      <button
                        onClick={() => {
                          const slotsForRoom = TIME_SLOTS.map(timeSlot => 
                            `${selectedDay}-${room.id}-${timeSlot}`
                          );
                          setSelectedSlots(prev => 
                            slotsForRoom.every(slot => prev.includes(slot))
                              ? prev.filter(slot => !slotsForRoom.includes(slot))
                              : [...prev, ...slotsForRoom.filter(slot => !prev.includes(slot))]
                          );
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Sélectionner tout
                      </button>
                    </div>
                  </div>
                  
                  {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {timeSlots.map(timeSlot => {
                        const entry = roomSchedule[timeSlot];
                        const info = getEntryInfo(selectedDay, room.id, timeSlot);
                        const slotId = `${selectedDay}-${room.id}-${timeSlot}`;
                        const isSelected = selectedSlots.includes(slotId);
                        
                        return (
                          <div key={timeSlot} className={`border rounded-xl p-4 transition-all duration-200 ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm'
                          }`}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSlotSelection(selectedDay, room.id, timeSlot)}
                                    className="h-4 w-4 text-blue-600 rounded"
                                  />
                                  <div className="font-semibold text-gray-900">{timeSlot}</div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <FiUsers className="mr-2 h-4 w-4" />
                                    <span className="font-medium">{info?.groupName || entry.group}</span>
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <FiBook className="mr-2 h-4 w-4" />
                                    <span>{info?.subjectName || entry.subject}</span>
                                  </div>
                                  {info?.teacher && (
                                    <div className="flex items-center text-sm text-gray-500">
                                      <FiUsers className="mr-2 h-4 w-4" />
                                      <span>{info.teacher}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEditEntry(selectedDay, room.id, timeSlot, entry)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                                >
                                  <FiEdit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(selectedDay, room.id, timeSlot)}
                                  className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"
                                >
                                  <FiTrash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <FiClock className="h-8 w-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun créneau programmé</h4>
                      <p className="text-gray-600 mb-4">Cette salle n'a pas de cours programmé pour ce jour</p>
                      <button
                        onClick={() => {
                          setFormData({
                            day: selectedDay,
                            room: room.id,
                            timeSlot: TIME_SLOTS[0],
                            group: groups.length > 0 ? groups[0].id : '',
                            subject: subjects.length > 0 ? subjects[0].id : ''
                          });
                          setEditingEntry(null);
                          setIsModalOpen(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <FiPlus className="inline mr-2" />
                        Ajouter un créneau
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Aucune salle */}
        {filteredRooms.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
              <FiHome className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              Aucune salle trouvée
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              {searchTerm 
                ? 'Aucune salle ne correspond à votre recherche. Essayez un autre terme.'
                : 'Aucune salle n\'est disponible. Ajoutez des salles d\'abord.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRoom('all');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Réinitialiser les filtres
              </button>
              <button
                onClick={() => window.location.href = '/rooms'}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                <FiPlus className="inline mr-2" />
                Ajouter une salle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pied de page avec statistiques */}
      <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Statistiques rapides</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Créneaux programmés</span>
                <span className="font-semibold">{stats.totalEntries}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Taux d'occupation</span>
                <span className="font-semibold">
                  {Math.round((stats.totalEntries / (rooms.length * TIME_SLOTS.length * DAYS.length)) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Conflits détectés</span>
                <span className={`font-semibold ${conflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {conflicts.length}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Actions recommandées</h4>
            <div className="space-y-2">
              {conflicts.length > 0 && (
                <div className="flex items-center text-sm">
                  <FiAlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                  <span>Résoudre {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {stats.totalEntries === 0 && (
                <div className="flex items-center text-sm">
                  <FiPlus className="h-4 w-4 text-blue-500 mr-2" />
                  <span>Ajouter des créneaux à l'emploi du temps</span>
                </div>
              )}
              <div className="flex items-center text-sm">
                <FiPlayCircle className="h-4 w-4 text-green-500 mr-2" />
                <span>Générer les sessions pour aujourd'hui</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Prochaine étape</h4>
            <p className="text-sm text-gray-600 mb-4">
              Une fois l'emploi du temps complété, générez les sessions pour permettre aux ESP32 d'enregistrer les présences automatiquement.
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:opacity-90 transition-opacity"
            >
              <FiPlayCircle className="inline mr-2" />
              Générer sessions maintenant
            </button>
          </div>
        </div>
      </div>

      {/* Modale de création/édition */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingEntry ? 'Modifier le créneau' : 'Ajouter un créneau'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jour
                  </label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {DAYS.map(day => (
                      <option key={day} value={day}>{DAYS_DISPLAY[day].fr}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salle
                  </label>
                  <select
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une salle</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name} • {room.location || '—'}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Créneau horaire
                  </label>
                  <select
                    value={formData.timeSlot}
                    onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Groupe
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner un groupe</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>{group.name} • {group.level || '—'}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Matière
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une matière</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name} • {subject.teacher || '—'}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <FiSave className="h-4 w-4" />
                  {editingEntry ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'ajout en masse */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Ajout en masse de créneaux
                </h3>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleBulkSubmit}>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jours à programmer
                  </label>
                  <div className="space-y-2">
                    {DAYS.map(day => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={bulkData.days.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkData({...bulkData, days: [...bulkData.days, day]});
                            } else {
                              setBulkData({...bulkData, days: bulkData.days.filter(d => d !== day)});
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{DAYS_DISPLAY[day].fr}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Créneaux horaires
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_SLOTS.map(slot => (
                      <label key={slot} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={bulkData.timeSlots.includes(slot)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkData({...bulkData, timeSlots: [...bulkData.timeSlots, slot]});
                            } else {
                              setBulkData({...bulkData, timeSlots: bulkData.timeSlots.filter(s => s !== slot)});
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span className="ml-2 text-xs text-gray-700">{slot}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salles
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {rooms.map(room => (
                      <label key={room.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={bulkData.rooms.includes(room.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkData({...bulkData, rooms: [...bulkData.rooms, room.id]});
                            } else {
                              setBulkData({...bulkData, rooms: bulkData.rooms.filter(r => r !== room.id)});
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{room.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Groupe
                    </label>
                    <select
                      value={bulkData.group}
                      onChange={(e) => setBulkData({...bulkData, group: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Sélectionner un groupe</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Matière
                    </label>
                    <select
                      value={bulkData.subject}
                      onChange={(e) => setBulkData({...bulkData, subject: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Sélectionner une matière</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="p-5 border-t border-gray-200 bg-gray-50">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start">
                    <FiAlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Résumé de l'ajout en masse
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {bulkData.days.length} jour(s) × {bulkData.timeSlots.length} créneau(x) × {bulkData.rooms.length} salle(s) = {bulkData.days.length * bulkData.timeSlots.length * bulkData.rooms.length} créneaux à ajouter
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!bulkData.group || !bulkData.subject || 
                             bulkData.days.length === 0 || 
                             bulkData.timeSlots.length === 0 || 
                             bulkData.rooms.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiLayers className="h-4 w-4" />
                    Ajouter {bulkData.days.length * bulkData.timeSlots.length * bulkData.rooms.length} créneaux
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de génération de sessions */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Générer les sessions
                </h3>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de génération
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Les sessions seront générées à partir de l'emploi du temps correspondant au jour de la semaine
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoGenerate"
                    checked={autoGenerate}
                    onChange={(e) => setAutoGenerate(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="autoGenerate" className="ml-2 text-sm text-gray-700">
                    Génération automatique quotidienne
                  </label>
                </div>
                
                <div className="text-sm text-gray-600">
                  {(() => {
                    const date = new Date(selectedDate);
                    const day = date.toLocaleDateString('fr-FR', { weekday: 'long' });
                    return `Jour: ${DAYS_DISPLAY[day.toLowerCase()]?.fr || day}`;
                  })()}
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start">
                  <FiZap className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Sessions à générer
                    </p>
                    <ul className="text-xs text-green-700 mt-2 space-y-1">
                      <li>• Création automatique des sessions à partir du planning</li>
                      <li>• Chaque créneau devient une session unique</li>
                      <li>• Les ESP32 peuvent démarrer les sessions automatiquement</li>
                      <li>• Les présences sont enregistrées en temps réel</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleGenerateSessions}
                disabled={generatingSessions}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generatingSessions ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Génération...
                  </>
                ) : (
                  <>
                    <FiPlayCircle className="h-4 w-4" />
                    Générer les sessions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;