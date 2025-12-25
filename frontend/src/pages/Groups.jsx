import React, { useState, useEffect } from 'react';
import { groupAPI, studentAPI } from '../api/api';
import { listenToGroups, listenToStudents } from '../firebase/firebase';
import { 
  FiUsers,
  FiUserPlus,
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
  FiBook
} from 'react-icons/fi';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // États pour la modale de création/édition
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: '',
    year: new Date().getFullYear(),
    capacity: 30
  });
  
  // États pour la recherche et filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // État pour l'affichage des étudiants d'un groupe
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    fetchData();
    setupRealtimeListeners();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const groupsResponse = await groupAPI.getAll();
      if (groupsResponse.data.success) {
        const groupsData = groupsResponse.data.data || {};
        const groupsArray = Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data
        }));
        setGroups(groupsArray);
      }

      const studentsResponse = await studentAPI.getAll();
      if (studentsResponse.data.success) {
        const studentsData = studentsResponse.data.data || {};
        setStudents(studentsData);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
      setError('Impossible de charger les données des groupes');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListeners = () => {
    const unsubscribeGroups = listenToGroups((groupsData) => {
      if (groupsData) {
        const groupsArray = Object.entries(groupsData).map(([id, data]) => ({
          id,
          ...data
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

  // Compter les étudiants par groupe
  const countStudentsInGroup = (groupId) => {
    if (!students) return 0;
    return Object.values(students).filter(student => 
      student.group && student.group.toString() === groupId.toString()
    ).length;
  };

  // Ouvrir modale pour créer un nouveau groupe
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      level: '',
      year: new Date().getFullYear(),
      capacity: 30
    });
    setIsModalOpen(true);
  };

  // Ouvrir modale pour éditer un groupe
  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || '',
      description: group.description || '',
      level: group.level || '',
      year: group.year || new Date().getFullYear(),
      capacity: group.capacity || 30
    });
    setIsModalOpen(true);
  };

  // Gérer la soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('Le nom du groupe est requis');
      return;
    }

    try {
      if (editingGroup) {
        // Mettre à jour le groupe existant
        await groupAPI.update(editingGroup.id, formData);
        setSuccess('Groupe mis à jour avec succès');
      } else {
        // Créer un nouveau groupe
        await groupAPI.create(formData);
        setSuccess('Groupe créé avec succès');
      }
      
      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur enregistrement groupe:', error);
      setError(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  // Supprimer un groupe
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) {
      return;
    }

    // Vérifier si le groupe contient des étudiants
    const studentCount = countStudentsInGroup(groupId);
    if (studentCount > 0) {
      if (!window.confirm(`Ce groupe contient ${studentCount} étudiant(s). Êtes-vous vraiment sûr de vouloir le supprimer ?`)) {
        return;
      }
    }

    try {
      await groupAPI.delete(groupId);
      setSuccess('Groupe supprimé avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur suppression groupe:', error);
      setError('Erreur lors de la suppression du groupe');
    }
  };

  // Filtrer et rechercher les groupes
  const filteredGroups = groups.filter(group => {
    // Filtre par recherche
    const matchesSearch = searchTerm === '' || 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtre par année
    const matchesYear = filterYear === 'all' || group.year == filterYear;
    
    // Filtre par niveau
    const matchesLevel = filterLevel === 'all' || group.level === filterLevel;
    
    return matchesSearch && matchesYear && matchesLevel;
  });

  // Pagination
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = filteredGroups.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Toggle l'affichage des étudiants d'un groupe
  const toggleGroupExpansion = (groupId) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
    }
  };

  // Obtenir les étudiants d'un groupe
  const getStudentsInGroup = (groupId) => {
    if (!students) return [];
    return Object.entries(students)
      .filter(([student]) =>
        student.group && student.group.toString() === groupId.toString()
      )
      .map(([id, student]) => ({ id, ...student }));
  };

  // Obtenir tous les niveaux uniques
  const allLevels = [...new Set(groups.map(group => group.level).filter(Boolean))];

  // Obtenir toutes les années uniques
  const allYears = [...new Set(groups.map(group => group.year).filter(Boolean))].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des groupes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion des groupes</h1>
            <p className="text-gray-600 mt-1">Organisez vos étudiants par groupes</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={fetchData}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiRefreshCw className="h-4 w-4" />
              Actualiser
            </button>
            <button
              onClick={handleCreateGroup}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPlus className="h-5 w-5" />
              Nouveau groupe
            </button>
          </div>
        </div>

        {/* Messages d'erreur/succès */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <FiAlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <FiCheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-green-800 font-medium">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Groupes totaux</p>
                <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Étudiants inscrits</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(students).length}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <FiUser className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Moyenne par groupe</p>
                <p className="text-2xl font-bold text-gray-900">
                  {groups.length > 0 
                    ? Math.round(Object.keys(students).length / groups.length) 
                    : 0}
                </p>
                <p className="text-xs text-gray-500">étudiants par groupe</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiBook className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center">
            <FiFilter className="h-5 w-5 text-gray-500 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Filtres et recherche</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Recherche */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un groupe..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            
            {/* Filtre par année */}
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Toutes les années</option>
              {allYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            {/* Filtre par niveau */}
            <select
              value={filterLevel}
              onChange={(e) => {
                setFilterLevel(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les niveaux</option>
              {allLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste des groupes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Groupes disponibles</h2>
            <div className="text-sm text-gray-500 mt-1 sm:mt-0">
              {filteredGroups.length} groupe{filteredGroups.length !== 1 ? 's' : ''} trouvé{filteredGroups.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {filteredGroups.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {paginatedGroups.map(group => {
                const studentCount = countStudentsInGroup(group.id);
                const isExpanded = expandedGroup === group.id;
                const groupStudents = getStudentsInGroup(group.id);
                
                return (
                  <div key={group.id} className="p-5 hover:bg-gray-50 transition-colors">
                    {/* En-tête du groupe */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {group.level || 'N/A'}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                            Année: {group.year}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                            {studentCount}/{group.capacity || 30} étudiants
                          </span>
                        </div>
                        
                        {group.description && (
                          <p className="text-gray-600 mb-3">{group.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <FiUsers className="mr-1" size={14} />
                            {studentCount} étudiant{studentCount !== 1 ? 's' : ''}
                          </span>
                          <span>ID: {group.id}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleGroupExpansion(group.id)}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          {isExpanded ? (
                            <>
                              <FiX className="h-4 w-4" />
                              Réduire
                            </>
                          ) : (
                            <>
                              <FiUsers className="h-4 w-4" />
                              Voir étudiants
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Modifier"
                        >
                          <FiEdit2 className="h-5 w-5" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <FiTrash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Détails du groupe (dépliés) */}
                    {isExpanded && (
                      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <h4 className="font-medium text-gray-900">
                            Étudiants du groupe ({groupStudents.length})
                          </h4>
                        </div>
                        
                        {groupStudents.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Étudiant
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ID
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    RFID
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {groupStudents.map(student => (
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
                                      {student.email || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      {student.rfid ? (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                          {student.rfid}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">Non assigné</span>
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
                              Ajoutez des étudiants dans la section "Étudiants"
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
            <div className="text-center py-12">
              <FiUsers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun groupe trouvé
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {searchTerm || filterYear !== 'all' || filterLevel !== 'all' 
                  ? 'Aucun groupe ne correspond à vos critères de recherche.'
                  : 'Aucun groupe n\'a été créé. Commencez par créer votre premier groupe.'
                }
              </p>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Créer un groupe
              </button>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {filteredGroups.length > 0 && (
          <div className="p-5 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Affichage de {startIndex + 1} à {Math.min(startIndex + itemsPerPage, filteredGroups.length)} sur {filteredGroups.length} groupes
              </div>
              
              <div className="flex items-center space-x-2">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="5">5 par page</option>
                  <option value="10">10 par page</option>
                  <option value="20">20 par page</option>
                  <option value="50">50 par page</option>
                </select>
                
                <div className="flex items-center space-x-1">
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
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
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

      {/* Modale de création/édition */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingGroup ? 'Modifier le groupe' : 'Créer un nouveau groupe'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du groupe *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Groupe 1, L3 Info, etc."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: L1, L2, M1, etc."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Année
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="2000"
                      max="2100"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacité maximale
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nombre maximum d'étudiants dans ce groupe
                  </p>
                </div>
              </div>
              
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FiSave className="h-4 w-4" />
                  {editingGroup ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;