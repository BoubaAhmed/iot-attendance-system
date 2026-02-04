import React, { useState, useEffect, useMemo } from "react";
import scheduleAPI from "../api/scheduleApi";
import roomAPI from "../api/roomsApi";
import groupAPI from "../api/groupsApi";
import subjectAPI from "../api/subjectsApi";
import LoadingSpinner from "../components/LoadingSpinner";
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
  FiEye,
  FiEyeOff,
  FiMaximize2,
  FiMinimize2,
  FiAlertTriangle,
  FiZap,
  FiCheckSquare,
  FiSquare,
  FiTarget,
  FiTrendingUp,
  FiBarChart2,
  FiPieChart,
} from "react-icons/fi";
import { toast } from "react-toastify";

// Define days
const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const DAYS_DISPLAY = {
  monday: { fr: "Lundi", short: "Lun", en: "Monday" },
  tuesday: { fr: "Mardi", short: "Mar", en: "Tuesday" },
  wednesday: { fr: "Mercredi", short: "Mer", en: "Wednesday" },
  thursday: { fr: "Jeudi", short: "Jeu", en: "Thursday" },
  friday: { fr: "Vendredi", short: "Ven", en: "Friday" },
  saturday: { fr: "Samedi", short: "Sam", en: "Saturday" },
};

// Fixed 2-hour time slots as specified
const TIME_SLOTS = ["08:00-10:00", "10:00-12:00", "14:00-16:00", "16:00-18:00"];

const Schedule = () => {
  const [schedule, setSchedule] = useState({});
  const [rooms, setRooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View and filter states
  const [selectedDay, setSelectedDay] = useState("monday");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [showEmptySlots, setShowEmptySlots] = useState(true);
  // const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    day: "monday",
    room: "",
    timeSlot: TIME_SLOTS[0],
    group: "",
    subject: "",
  });

  // Statistics states
  const [stats, setStats] = useState({
    totalEntries: 0,
    entriesByDay: {},
    entriesByRoom: {},
    entriesByGroup: {},
    conflicts: [],
    utilization: 0,
  });

  // Bulk operations
  const [bulkData, setBulkData] = useState({
    days: [],
    timeSlots: [],
    rooms: [],
    group: "",
    subject: "",
  });

  const [conflicts, setConflicts] = useState([]);
  const [showConflicts, setShowConflicts] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (Object.keys(schedule).length > 0) {
      calculateStats();
      checkConflicts();
    }
  }, [schedule, rooms, groups]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scheduleRes, roomsRes, groupsRes, subjectsRes] = await Promise.all(
        [
          scheduleAPI.getAll(),
          roomAPI.getAll(),
          groupAPI.getAll(),
          subjectAPI.getAll(),
        ],
      );

      if (scheduleRes.data.success) {
        const rawSchedule = scheduleRes.data.data || {};
        const normalized = {};

        Object.entries(rawSchedule).forEach(([roomId, roomObj]) => {
          const roomSchedule = roomObj?.schedule || roomObj || {};
          const scheduleMap = {};

          Object.entries(roomSchedule).forEach(([day, dayArr]) => {
            if (!Array.isArray(dayArr)) {
              const converted = Array.isArray(Object.values(dayArr))
                ? Object.values(dayArr)
                : [];
              dayArr = converted;
            }

            scheduleMap[day] = {};
            (dayArr || []).forEach((session) => {
              if (!session || !session.start || !session.end) return;
              const key = `${session.start}-${session.end}`;
              scheduleMap[day][key] = session;
            });
          });

          normalized[roomId] = {
            room_name: roomObj?.room_name || roomObj?.name || roomId,
            room_data: roomObj?.room_data || {},
            schedule: scheduleMap,
          };
        });

        setSchedule(normalized);
      }

      if (roomsRes.data.success) {
        const roomsData = roomsRes.data.data || {};
        const roomsArray = Object.entries(roomsData)
          .map(([id, data]) => ({
            id,
            ...data,
          }))
          .filter((r) => r.active !== false);
        setRooms(roomsArray);
      }

      if (groupsRes.data.success) {
        const groupsData = groupsRes.data.data || {};
        setGroups(
          Object.entries(groupsData).map(([id, data]) => ({
            id,
            ...data,
          })),
        );
      }

      if (subjectsRes.data.success) {
        const subjectsData = subjectsRes.data.data || {};
        setSubjects(
          Object.entries(subjectsData).map(([id, data]) => ({
            id,
            ...data,
          })),
        );
      }

      toast.success("Données chargées avec succès");
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Erreur chargement emploi du temps:", error);
      toast.error("Impossible de charger les données");
      setError("Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const entriesByDay = {};
    const entriesByRoom = {};
    const entriesByGroup = {};
    let totalEntries = 0;

    DAYS.forEach((day) => {
      entriesByDay[day] = 0;
      Object.entries(schedule).forEach(([roomId, roomSchedule]) => {
        const daySchedule = roomSchedule.schedule
          ? roomSchedule.schedule[day] || {}
          : roomSchedule[day] || {};
        Object.values(daySchedule).forEach((entry) => {
          if (entry && entry.group && entry.subject) {
            entriesByDay[day]++;
            totalEntries++;

            // Count by room
            const room = rooms.find((r) => r.id === roomId);
            const roomName = room?.name || roomId;
            entriesByRoom[roomName] = (entriesByRoom[roomName] || 0) + 1;

            // Count by group
            const groupName =
              groups.find((g) => g.id === entry.group)?.name || entry.group;
            entriesByGroup[groupName] = (entriesByGroup[groupName] || 0) + 1;
          }
        });
      });
    });

    // Calculate utilization
    const totalSlots = rooms.length * TIME_SLOTS.length * DAYS.length;
    const utilization = totalSlots > 0 ? (totalEntries / totalSlots) * 100 : 0;

    setStats((prev) => ({
      ...prev,
      totalEntries,
      entriesByDay,
      entriesByRoom,
      entriesByGroup,
      utilization: Math.round(utilization),
    }));
  };

  const checkConflicts = () => {
    const newConflicts = [];
    const timeSlotMap = {};

    // Check for group conflicts (same group in multiple rooms at same time)
    DAYS.forEach((day) => {
      TIME_SLOTS.forEach((timeSlot) => {
        const key = `${day}-${timeSlot}`;
        timeSlotMap[key] = [];

        Object.entries(schedule).forEach(([roomId, roomSchedule]) => {
          const daySchedule = roomSchedule.schedule
            ? roomSchedule.schedule[day] || {}
            : roomSchedule[day] || {};
          const entry = daySchedule[timeSlot];
          if (entry && entry.group) {
            const room = rooms.find((r) => r.id === roomId);
            const group = groups.find((g) => g.id === entry.group);

            timeSlotMap[key].push({
              roomId,
              roomName: room?.name || roomId,
              groupId: entry.group,
              groupName: group?.name || entry.group,
              subjectId: entry.subject,
              subjectName:
                subjects.find((s) => s.id === entry.subject)?.name ||
                entry.subject,
            });
          }
        });

        // Check for duplicate groups in same time slot
        const groupOccurrences = {};
        timeSlotMap[key].forEach((entry) => {
          groupOccurrences[entry.groupId] =
            (groupOccurrences[entry.groupId] || 0) + 1;
        });

        Object.entries(groupOccurrences).forEach(([groupId, count]) => {
          if (count > 1) {
            const conflictingEntries = timeSlotMap[key].filter(
              (e) => e.groupId === groupId,
            );
            newConflicts.push({
              type: "group_conflict",
              day,
              timeSlot,
              groupId,
              groupName: groups.find((g) => g.id === groupId)?.name || groupId,
              rooms: conflictingEntries.map((e) => e.roomName),
              severity: "high",
            });
          }
        });
      });
    });

    setConflicts(newConflicts);
    setStats((prev) => ({ ...prev, conflicts: newConflicts }));
  };

  const handleAddEntry = () => {
    setEditingEntry(null);
    setFormData({
      day: selectedDay,
      room: rooms.length > 0 ? rooms[0].id : "",
      timeSlot: TIME_SLOTS[0],
      group: groups.length > 0 ? groups[0].id : "",
      subject: subjects.length > 0 ? subjects[0].id : "",
    });
    setIsModalOpen(true);
  };

  const handleEditEntry = (roomId, timeSlot, entry) => {
    setEditingEntry({ roomId, timeSlot, entry });
    setFormData({
      day: selectedDay,
      room: roomId,
      timeSlot,
      group: entry.group || "",
      subject: entry.subject || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteEntry = async (roomId, timeSlot) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce créneau ?")) {
      return;
    }

    try {
      const [start, end] = timeSlot.split("-");
      await scheduleAPI.deleteEntry({
        room: roomId,
        day: selectedDay,
        start,
        end,
      });
      toast.success("Créneau supprimé avec succès");
      fetchData();
    } catch (error) {
      console.error("Erreur suppression créneau:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.room || !formData.group || !formData.subject) {
      toast.error("Tous les champs sont requis");
      return;
    }

    try {
      const [start, end] = formData.timeSlot.split("-");
      const entryData = {
        room: formData.room,
        day: formData.day,
        start: start?.trim(),
        end: end?.trim(),
        group: formData.group,
        subject: formData.subject,
      };

      if (editingEntry) {
        // Delete old entry first, then add new one
        const [oldStart, oldEnd] = editingEntry.timeSlot.split("-");
        await scheduleAPI.deleteEntry({
          room: editingEntry.roomId,
          day: selectedDay,
          start: oldStart,
          end: oldEnd,
        });
        await scheduleAPI.addEntry(entryData);
        toast.success("Créneau mis à jour avec succès");
      } else {
        await scheduleAPI.addEntry(entryData);
        toast.success("Créneau ajouté avec succès");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Erreur enregistrement créneau:", error);
      toast.error(
        error.response?.data?.error || "Erreur lors de l'enregistrement",
      );
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (
      !bulkData.group ||
      !bulkData.subject ||
      bulkData.days.length === 0 ||
      bulkData.timeSlots.length === 0 ||
      bulkData.rooms.length === 0
    ) {
      toast.error("Veuillez remplir tous les champs pour l'ajout en masse");
      return;
    }

    try {
      const promises = [];

      bulkData.days.forEach((day) => {
        bulkData.rooms.forEach((roomId) => {
          bulkData.timeSlots.forEach((timeSlot) => {
            const [start, end] = timeSlot.split("-");
            const entryData = {
              room: roomId,
              day,
              start: start?.trim(),
              end: end?.trim(),
              group: bulkData.group,
              subject: bulkData.subject,
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
      console.error("Erreur ajout en masse:", error);
      toast.error("Erreur lors de l'ajout en masse");
    }
  };

  const handleCopyDay = async (sourceDay, targetDay) => {
    if (
      !window.confirm(
        `Copier l'emploi du temps du ${DAYS_DISPLAY[sourceDay].fr} vers le ${DAYS_DISPLAY[targetDay].fr} ?`,
      )
    ) {
      return;
    }

    try {
      const updates = [];

      // Get all entries for source day
      Object.entries(schedule).forEach(([roomId, roomSchedule]) => {
        const rawSource = roomSchedule.schedule
          ? roomSchedule.schedule[sourceDay] || []
          : roomSchedule[sourceDay] || [];
        // Normalize to array of { timeSlot, entry }
        const sourceEntries = Array.isArray(rawSource)
          ? rawSource.map((s) => ({
              timeSlot: `${s.start}-${s.end}`,
              entry: s,
            }))
          : Object.entries(rawSource).map(([k, v]) => ({
              timeSlot: k,
              entry: v,
            }));

        sourceEntries.forEach(({ timeSlot, entry }) => {
          const [start, end] = timeSlot.split("-");

          // First, delete any existing entry in target day matching start/end
          updates.push(
            (async () => {
              try {
                // Attempt to delete existing (ignore errors)
                await scheduleAPI.deleteEntry({
                  room: roomId,
                  day: targetDay,
                  start: start?.trim(),
                  end: end?.trim(),
                });
              } catch (e) {
                console.log(e)
              }
            })(),
          );

          // Add new entry
          updates.push(
            scheduleAPI.addEntry({
              room: roomId,
              day: targetDay,
              start: start?.trim(),
              end: end?.trim(),
              group: entry.group,
              subject: entry.subject,
            }),
          );
        });
      });

      await Promise.all(updates);
      toast.success(
        `Emploi du temps copié du ${DAYS_DISPLAY[sourceDay].fr} vers le ${DAYS_DISPLAY[targetDay].fr}`,
      );
      fetchData();
    } catch (error) {
      console.error("Erreur copie jour:", error);
      toast.error("Erreur lors de la copie");
    }
  };

  const getRoomSchedule = (roomId) => {
    const room = schedule[roomId];
    if (!room) return {};
    return room.schedule
      ? room.schedule[selectedDay] || {}
      : room[selectedDay] || {};
  };

  const getEntryInfo = (roomId, timeSlot) => {
    const entry = getRoomSchedule(roomId)[timeSlot];
    if (!entry) return null;

    // Backend may already provide group_name / subject_name / teacher_name
    const groupName =
      entry.group_name ||
      groups.find((g) => g.id === entry.group)?.name ||
      entry.group;
    const subjectName =
      entry.subject_name ||
      subjects.find((s) => s.id === entry.subject)?.name ||
      entry.subject;
    const teacherName =
      entry.teacher_name ||
      subjects.find((s) => s.id === entry.subject)?.teacher ||
      "";
    const level = groups.find((g) => g.id === entry.group)?.level || "";

    return {
      groupName,
      subjectName,
      teacher: teacherName,
      level,
    };
  };

  const filteredRooms = rooms.filter((room) => {
    if (selectedRoom !== "all" && room.id !== selectedRoom) return false;
    if (searchTerm) {
      const roomName = room.name?.toLowerCase() || "";
      return roomName.includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const derivedTimeSlots = useMemo(() => {
    const set = new Set();
    filteredRooms.forEach((room) => {
      const daySchedule = getRoomSchedule(room.id) || {};
      Object.keys(daySchedule).forEach((k) => set.add(k));
    });
    const arr = Array.from(set);
    if (arr.length === 0) return TIME_SLOTS;
    return arr.sort((a, b) => a.split("-")[0].localeCompare(b.split("-")[0]));
  }, [schedule, filteredRooms, selectedDay]);

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <LoadingSpinner
        message={"Chargement de l'emploi du temps..."}
        sub={"Préparation du planning..."}
        className="min-h-screen"
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-white p-6">
        <div className="max-w-4xl mx-auto text-center pt-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <FiAlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
            <p className="text-gray-600 mb-6">
              Veuillez vérifier votre connexion au serveur
            </p>
            <button
              onClick={fetchData}
              className="px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-800 p-2">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 inline-flex items-center gap-2">
              <FiCalendar className="w-6 h-6 text-blue-600" />
              Gestion de l'emploi du temps
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

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchData} style={{ backgroundColor:"#215E61" }}
              className="flex items-center gap-2 px-4 py-2 text-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow text-gray-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>

            <button
              onClick={handleAddEntry} style={{ backgroundColor:"#FE7F2D" }}
              className="flex items-center gap-2 px-4 py-2 text-white cursor-pointer rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FiPlus className="h-5 w-5" />
              Ajouter créneau
            </button>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          {/* Total Entries Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiCalendar className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                TOTAL
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalEntries}</h3>
            <p className="text-gray-500 text-sm mb-3">Créneaux programmés</p>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Taux d'occupation</span>
                <span className="font-semibold text-blue-600">{stats.utilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${stats.utilization}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Rooms Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiHome className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                ACTIVES
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{rooms.length}</h3>
            <p className="text-gray-500 text-sm mb-3">Salles disponibles</p>
            <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
              <div className="text-center">
                <div className="font-semibold text-green-600">{Object.keys(stats.entriesByRoom).length}</div>
                <div>Utilisées</div>
              </div>
            </div>
          </div>

          {/* Groups Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiUsers className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                GROUPES
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{Object.keys(stats.entriesByGroup).length}</h3>
            <p className="text-gray-500 text-sm mb-3">Groupes programmés</p>
            <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
              <div className="text-center">
                <div className="font-semibold text-purple-600">{groups.length}</div>
                <div>Total groupes</div>
              </div>
            </div>
          </div>

          {/* Conflicts Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FiAlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">
                ATTENTION
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{conflicts.length}</h3>
            <p className="text-gray-500 text-sm mb-3">Conflits détectés</p>
            <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
              <span>Statut</span>
              <span className={`font-semibold ${conflicts.length > 0 ? "text-red-600" : "text-green-600"}`}>
                {conflicts.length > 0 ? "Avec conflits" : "Aucun conflit"}
              </span>
            </div>
          </div>

        </div>


        {/* Conflict Alert */}
        {conflicts.length > 0 && (
          <div className="mb-6">
            <div className="bg-linear-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <FiAlertTriangle className="h-5 w-5 text-red-600 mr-3" />
                  <div>
                    <h3 className="font-bold text-red-900">
                      Conflits détectés ({conflicts.length})
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      Certains groupes sont programmés dans plusieurs salles
                      simultanément
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConflicts(!showConflicts)}
                  className="text-sm text-red-700 hover:text-red-900 flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-xl"
                >
                  {showConflicts ? "Masquer" : "Voir détails"}
                  {showConflicts ? <FiMinimize2 /> : <FiMaximize2 />}
                </button>
              </div>
              {showConflicts && (
                <div className="space-y-3">
                  {conflicts.map((conflict, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white rounded-xl border border-red-100"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-red-800">
                            Conflit: {conflict.groupName}
                          </p>
                          <p className="text-sm text-red-600 mt-1">
                            {DAYS_DISPLAY[conflict.day].fr} •{" "}
                            {conflict.timeSlot}
                          </p>
                          <p className="text-xs text-red-500 mt-2">
                            Salles concernées: {conflict.rooms.join(", ")}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
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
      </div>

      {/* Day Navigation */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FiClock className="h-5 w-5 text-blue-600" />
                Navigation par jour
              </h2>
              <p className="text-gray-600">Sélectionnez le jour à afficher</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-5 py-3 rounded-xl transition-all duration-200 ${
                    selectedDay === day
                      ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-medium">
                      {DAYS_DISPLAY[day].short}
                    </span>
                    <span className="text-xs mt-1">
                      {stats.entriesByDay[day] || 0} créneaux
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Day Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {DAYS.map((day) => {
              const entryCount = stats.entriesByDay[day] || 0;
              const maxEntries = rooms.length * TIME_SLOTS.length;
              const percentage =
                maxEntries > 0 ? (entryCount / maxEntries) * 100 : 0;

              return (
                <div
                  key={day}
                  className={`p-3 rounded-xl border ${
                    selectedDay === day
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">
                      {DAYS_DISPLAY[day].fr}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        entryCount > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {entryCount}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        percentage > 80
                          ? "bg-red-500"
                          : percentage > 60
                            ? "bg-yellow-500"
                            : percentage > 0
                              ? "bg-green-500"
                              : "bg-gray-300"
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

      {/* Controls */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une salle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FiFilter className="h-5 w-5 text-gray-500" />
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-w-45"
                >
                  <option value="all">Toutes les salles</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowEmptySlots(!showEmptySlots)}
                  className={`p-2 rounded-lg ${
                    showEmptySlots
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                  title={
                    showEmptySlots
                      ? "Masquer les créneaux vides"
                      : "Afficher les créneaux vides"
                  }
                >
                  {showEmptySlots ? <FiEye /> : <FiEyeOff />}
                </button>

                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-4 py-2 ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    title="Vue grille"
                  >
                    <FiGrid className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-4 py-2 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    title="Vue liste"
                  >
                    <FiList className="h-5 w-5" />
                  </button>
                </div>

                <button
                  onClick={() => setIsBulkModalOpen(true)}  style={{ backgroundColor:"#215E61" }}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FiLayers className="h-4 w-4" />
                  Ajout en masse
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Schedule */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          {/* derive time slots across filtered rooms for selected day */}
          {/* generated once per render for consistent grid */}
          {/* Schedule Header */}
          <div className="p-6 border-b border-gray-200"  style={{ backgroundColor:"#233D4D" }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {DAYS_DISPLAY[selectedDay].fr} - Emploi du temps
                </h2>
                <p className="text-gray-300">
                  {filteredRooms.length} salle
                  {filteredRooms.length !== 1 ? "s" : ""} •{" "}
                  {stats.entriesByDay[selectedDay] || 0} créneaux programmés
                </p>
              </div>
              <div className="mt-3 lg:mt-0 flex flex-wrap gap-2">
                {DAYS.filter((day) => day !== selectedDay).map((day) => (
                  <button
                    key={day}
                    onClick={() => handleCopyDay(selectedDay, day)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-white hover:bg-amber-50 hover:text-black hover:cursor-pointer"
                    title={`Copier vers ${DAYS_DISPLAY[day].fr}`}
                  >
                    <FiCopy className="h-4 w-4" />
                    Vers {DAYS_DISPLAY[day].short}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid View */}
          {viewMode === "grid" && filteredRooms.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white p-4 text-left font-bold text-gray-900 border-r border-gray-200">
                      <div className="flex items-center justify-between">
                        <span>Salle / Horaire</span>
                        <span className="text-sm font-normal text-gray-500">
                          {derivedTimeSlots.length} créneaux
                        </span>
                      </div>
                    </th>
                    {/* {derivedTimeSlots.map((timeSlot) => ( */}
                    {TIME_SLOTS.map((timeSlot) => (
                      <th
                        key={timeSlot}
                        className="bg-gray-50 p-4 text-center font-bold text-gray-900 border-b border-gray-200"
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-bold">
                            {timeSlot.split("-")[0]}
                          </span>
                          <span className="text-sm text-gray-500">
                            à {timeSlot.split("-")[1]}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room, roomIndex) => (
                    <tr
                      key={room.id}
                      className={`${roomIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="sticky left-0 z-10 bg-inherit p-4 border-r border-gray-200">
                        <div className="flex flex-col">
                          <div className="font-bold text-gray-900">
                            {room.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {room.location || "—"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {stats.entriesByRoom[room.name] || 0} créneaux cette
                            semaine
                          </div>
                        </div>
                      </td>
                      {/* {derivedTimeSlots.map((timeSlot) => { */}
                      {TIME_SLOTS.map((timeSlot) => {
                        const entry = getRoomSchedule(room.id)[timeSlot];
                        const info = getEntryInfo(room.id, timeSlot);

                        if (!entry && !showEmptySlots) {
                          return (
                            <td
                              key={timeSlot}
                              className="p-4 border-b border-gray-100"
                            >
                              {/* Empty but hidden */}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={timeSlot}
                            className="p-4 border-b border-gray-100"
                          >
                            {entry ? (
                              <div className="bg-linear-to-br from-white to-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="font-bold text-gray-900">
                                        {info?.groupName || entry.group}
                                      </div>
                                      {info?.level && (
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                          {info.level}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-700 mb-1">
                                      {info?.subjectName || entry.subject}
                                    </div>
                                    {info?.teacher && (
                                      <div className="text-xs text-gray-500">
                                        Enseignant: {info.teacher}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() =>
                                        handleEditEntry(
                                          room.id,
                                          timeSlot,
                                          entry,
                                        )
                                      }
                                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                      title="Modifier"
                                    >
                                      <FiEdit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteEntry(room.id, timeSlot)
                                      }
                                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                      title="Supprimer"
                                    >
                                      <FiTrash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="pt-3 border-t border-gray-100">
                                  <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>{room.name}</span>
                                    <span>{timeSlot}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
                                <div className="flex flex-col items-center">
                                  <button
                                    onClick={() => {
                                      setFormData({
                                        day: selectedDay,
                                        room: room.id,
                                        timeSlot,
                                        group:
                                          groups.length > 0 ? groups[0].id : "",
                                        subject:
                                          subjects.length > 0
                                            ? subjects[0].id
                                            : "",
                                      });
                                      setEditingEntry(null);
                                      setIsModalOpen(true);
                                    }}
                                    className="text-gray-400 hover:text-blue-600 hover:bg-white p-2 rounded-lg transition-colors"
                                    title="Ajouter un créneau"
                                  >
                                    <FiPlus className="h-5 w-5" />
                                  </button>
                                  <p className="text-xs text-gray-500 mt-2">
                                    Disponible
                                  </p>
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

          {/* List View */}
          {viewMode === "list" && filteredRooms.length > 0 && (
            <div className="divide-y divide-gray-200">
              {filteredRooms.map((room, roomIndex) => {
                const roomSchedule = getRoomSchedule(room.id);
                const timeSlots = Object.keys(roomSchedule);

                return (
                  <div
                    key={room.id}
                    className={`p-6 transition-colors ${
                      roomIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FiHome className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {room.name}
                            </h3>
                            <div className="text-sm text-gray-600">
                              {room.location || "Localisation non définie"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {timeSlots.length} créneau
                          {timeSlots.length !== 1 ? "x" : ""}
                        </span>
                      </div>
                    </div>

                    {timeSlots.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {timeSlots.map((timeSlot) => {
                          const entry = roomSchedule[timeSlot];
                          const info = getEntryInfo(room.id, timeSlot);

                          return (
                            <div
                              key={timeSlot}
                              className="border border-gray-200 rounded-xl p-4 bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-200"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <div className="font-semibold text-gray-900 mb-2">
                                    {timeSlot}
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center text-sm text-gray-600">
                                      <FiUsers className="mr-2 h-4 w-4" />
                                      <span className="font-medium">
                                        {info?.groupName || entry.group}
                                      </span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600">
                                      <FiBook className="mr-2 h-4 w-4" />
                                      <span>
                                        {info?.subjectName || entry.subject}
                                      </span>
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
                                    onClick={() =>
                                      handleEditEntry(room.id, timeSlot, entry)
                                    }
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                    title="Modifier"
                                  >
                                    <FiEdit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteEntry(room.id, timeSlot)
                                    }
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Supprimer"
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
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          Aucun créneau programmé
                        </h4>
                        <p className="text-gray-600 mb-4">
                          Cette salle n'a pas de cours programmé pour ce jour
                        </p>
                        <button
                          onClick={() => {
                            setFormData({
                              day: selectedDay,
                              room: room.id,
                              timeSlot: TIME_SLOTS[0],
                              group: groups.length > 0 ? groups[0].id : "",
                              subject:
                                subjects.length > 0 ? subjects[0].id : "",
                            });
                            setEditingEntry(null);
                            setIsModalOpen(true);
                          }}
                          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
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

          {/* No Rooms Found */}
          {filteredRooms.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <FiHome className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Aucune salle trouvée
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {searchTerm
                  ? "Aucune salle ne correspond à votre recherche. Essayez un autre terme."
                  : "Aucune salle n'est disponible. Ajoutez des salles d'abord."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedRoom("all");
                  }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingEntry ? "Modifier le créneau" : "Nouveau créneau"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jour
                </label>
                <select
                  value={formData.day}
                  onChange={(e) =>
                    setFormData({ ...formData, day: e.target.value })
                  }
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {DAYS_DISPLAY[day].fr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salle
                </label>
                <select
                  value={formData.room}
                  onChange={(e) =>
                    setFormData({ ...formData, room: e.target.value })
                  }
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  <option value="">Sélectionner une salle</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} • {room.location || "—"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Créneau horaire (2h)
                </label>
                <select
                  value={formData.timeSlot}
                  onChange={(e) =>
                    setFormData({ ...formData, timeSlot: e.target.value })
                  }
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  {Array.from(
                    new Set([...TIME_SLOTS, ...derivedTimeSlots]),
                  ).map((slot) => (
                    <option key={slot} value={slot}>
                      {slot} {TIME_SLOTS.includes(slot) ? "(2h)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Groupe
                </label>
                <select
                  value={formData.group}
                  onChange={(e) =>
                    setFormData({ ...formData, group: e.target.value })
                  }
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  <option value="">Sélectionner un groupe</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} • {group.level || "—"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matière
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                >
                  <option value="">Sélectionner une matière</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} • {subject.teacher || "—"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                  >
                    <FiSave className="h-4 w-4" />
                    {editingEntry ? "Mettre à jour" : "Ajouter le créneau"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Ajout en masse de créneaux
                </h3>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleBulkSubmit}
              className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Jours à programmer
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
                  {DAYS.map((day) => (
                    <label
                      key={day}
                      className="flex items-center p-2 hover:bg-gray-50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={bulkData.days.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkData({
                              ...bulkData,
                              days: [...bulkData.days, day],
                            });
                          } else {
                            setBulkData({
                              ...bulkData,
                              days: bulkData.days.filter((d) => d !== day),
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        {DAYS_DISPLAY[day].fr}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Créneaux horaires (2h)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from(
                    new Set([...TIME_SLOTS, ...derivedTimeSlots]),
                  ).map((slot) => (
                    <label
                      key={slot}
                      className="flex items-center p-3 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50"
                    >
                      <input
                        type="checkbox"
                        checked={bulkData.timeSlots.includes(slot)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkData({
                              ...bulkData,
                              timeSlots: [...bulkData.timeSlots, slot],
                            });
                          } else {
                            setBulkData({
                              ...bulkData,
                              timeSlots: bulkData.timeSlots.filter(
                                (s) => s !== slot,
                              ),
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">{slot}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Salles
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
                  {rooms.map((room) => (
                    <label
                      key={room.id}
                      className="flex items-center p-2 hover:bg-gray-50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={bulkData.rooms.includes(room.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkData({
                              ...bulkData,
                              rooms: [...bulkData.rooms, room.id],
                            });
                          } else {
                            setBulkData({
                              ...bulkData,
                              rooms: bulkData.rooms.filter(
                                (r) => r !== room.id,
                              ),
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        {room.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Groupe
                  </label>
                  <select
                    value={bulkData.group}
                    onChange={(e) =>
                      setBulkData({ ...bulkData, group: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  >
                    <option value="">Sélectionner un groupe</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Matière
                  </label>
                  <select
                    value={bulkData.subject}
                    onChange={(e) =>
                      setBulkData({ ...bulkData, subject: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  >
                    <option value="">Sélectionner une matière</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div className="md:col-span-2">
                <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <FiAlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Résumé de l'ajout en masse
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {bulkData.days.length} jour(s) ×{" "}
                        {bulkData.timeSlots.length} créneau(x) ×{" "}
                        {bulkData.rooms.length} salle(s) ={" "}
                        {bulkData.days.length *
                          bulkData.timeSlots.length *
                          bulkData.rooms.length}{" "}
                        créneaux à ajouter
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  onClick={handleBulkSubmit}
                  disabled={
                    !bulkData.group ||
                    !bulkData.subject ||
                    bulkData.days.length === 0 ||
                    bulkData.timeSlots.length === 0 ||
                    bulkData.rooms.length === 0
                  }
                  className="flex items-center gap-3 px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                >
                  <FiLayers className="h-4 w-4" />
                  Ajouter{" "}
                  {bulkData.days.length *
                    bulkData.timeSlots.length *
                    bulkData.rooms.length}{" "}
                  créneaux
                </button>
              </div>
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
              <span className="text-sm font-medium text-gray-700">
                Emploi du temps actif
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats.totalEntries} créneaux • {rooms.length} salles •{" "}
              {conflicts.length} conflits • Taux d'occupation:{" "}
              {stats.utilization}%
            </p>
          </div>
          <div className="text-sm text-gray-600">
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

export default Schedule;
