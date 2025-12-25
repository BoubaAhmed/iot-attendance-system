import React, { useState, useEffect } from 'react';
import { subjectAPI } from '../api/api';
import { listenToSubjects } from '../firebase/firebase';
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
  FiBookmark
} from 'react-icons/fi';

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // États pour la modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    credits: 3,
    level: '',
    semester: 1,
    color: '#3B82F6'
  });
  
  // États pour la recherche et filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Couleurs disponibles pour les matières
  const colorOptions = [
    { value: '#3B82F6', name: 'Bleu', bg: 'bg-blue-100', text: 'text-blue-800' },
    { value: '#10B981', name: 'Vert', bg: 'bg-green-100', text: 'text-green-800' },
    { value: '#8B5CF6', name: 'Violet', bg: 'bg-purple-100', text: 'text-purple-800' },
    { value: '#EF4444', name: 'Rouge', bg: 'bg-red-100', text: 'text-red-800' },
    { value: '#F59E0B', name: 'Jaune', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    { value: '#EC4899', name: 'Rose', bg: 'bg-pink-100', text: 'text-pink-800' },
    { value: '#6366F1', name: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    { value: '#059669', name: 'Émeraude', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  ];

  // Niveaux disponibles
  const levelOptions = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat'];

  useEffect(() => {
    fetchData();
    setupRealtimeListener();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await subjectAPI.getAll();
      if (response.data.success) {
        const subjectsData = response.data.data || {};
        const subjectsArray = Object.entries(subjectsData).map(([id, data]) => ({
          id,
          ...data
        }));
        setSubjects(subjectsArray);
      }
    } catch (error) {
      console.error('Erreur chargement matières:', error);
      setError('Impossible de charger les matières');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListener = () => {
    const unsubscribe = listenToSubjects((subjectsData) => {
      if (subjectsData) {
        const subjectsArray = Object.entries(subjectsData).map(([id, data]) => ({
          id,
          ...data
        }));
        setSubjects(subjectsArray);
      }
    });
    return unsubscribe;
  };

  const handleCreateSubject = () => {
    setEditingSubject(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      credits: 3,
      level: '',
      semester: 1,
      color: '#3B82F6'
    });
    setIsModalOpen(true);
  };

  const handleEditSubject = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      description: subject.description || '',
      credits: subject.credits || 3,
      level: subject.level || '',
      semester: subject.semester || 1,
      color: subject.color || '#3B82F6'
    });
    setIsModalOpen(true);
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette matière ?')) {
      return;
    }

    try {
      await subjectAPI.delete(subjectId);
      setSuccess('Matière supprimée avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur suppression matière:', error);
      setError('Erreur lors de la suppression de la matière');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Le nom et le code de la matière sont requis');
      return;
    }

    try {
      if (editingSubject) {
        await subjectAPI.update(editingSubject.id, formData);
        setSuccess('Matière mise à jour avec succès');
      } else {
        await subjectAPI.create(formData);
        setSuccess('Matière créée avec succès');
      }
      
      setIsModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur enregistrement matière:', error);
      setError(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  // Filtrer les matières
  const filteredSubjects = subjects.filter(subject => {
    // Filtre par recherche
    const matchesSearch = searchTerm === '' || 
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (subject.description && subject.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtre par niveau
    const matchesLevel = filterLevel === 'all' || subject.level === filterLevel;
    
    // Filtre par semestre
    const matchesSemester = filterSemester === 'all' || subject.semester == filterSemester;
    
    return matchesSearch && matchesLevel && matchesSemester;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubjects = filteredSubjects.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Obtenir tous les niveaux uniques
  const allLevels = [...new Set(subjects.map(subject => subject.level).filter(Boolean))].sort();

  // Obtenir tous les semestres uniques
  const allSemesters = [...new Set(subjects.map(subject => subject.semester).filter(Boolean))].sort((a, b) => a - b);

  // Statistiques
  const stats = {
    totalSubjects: subjects.length,
    totalCredits: subjects.reduce((sum, subject) => sum + (subject.credits || 0), 0),
    levelsCount: allLevels.length,
    semestersCount: allSemesters.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des matières...</p>
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion des matières</h1>
            <p className="text-gray-600 mt-1">Définissez les matières enseignées dans votre établissement</p>
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
              onClick={handleCreateSubject}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPlus className="h-5 w-5" />
              Nouvelle matière
            </button>
          </div>
        </div>

        {/* Messages d'erreur/succès */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <FiAlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <FiCheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-800 font-medium">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Matières totales</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSubjects}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiBook className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Crédits totaux</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCredits}</p>
                <p className="text-xs text-gray-500">Crédits ECTS</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <FiBookmark className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Niveaux couverts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.levelsCount}</p>
                <p className="text-xs text-gray-500">De {allLevels[0] || '-'} à {allLevels[allLevels.length - 1] || '-'}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiBarChart2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Semestres</p>
                <p className="text-2xl font-bold text-gray-900">{stats.semestersCount}</p>
                <p className="text-xs text-gray-500">Semestres actifs</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <FiClock className="h-6 w-6 text-orange-600" />
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
                placeholder="Rechercher une matière..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            
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
              {levelOptions.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
              {allLevels.filter(level => !levelOptions.includes(level)).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            
            {/* Filtre par semestre */}
            <select
              value={filterSemester}
              onChange={(e) => {
                setFilterSemester(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les semestres</option>
              {Array.from({ length: 6 }, (_, i) => i + 1).map(sem => (
                <option key={sem} value={sem}>Semestre {sem}</option>
              ))}
              {allSemesters.filter(sem => sem > 6).map(sem => (
                <option key={sem} value={sem}>Semestre {sem}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste des matières */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Matières disponibles</h2>
            <div className="text-sm text-gray-500 mt-1 sm:mt-0">
              {filteredSubjects.length} matière{filteredSubjects.length !== 1 ? 's' : ''} trouvée{filteredSubjects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {filteredSubjects.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {paginatedSubjects.map(subject => {
                const colorOption = colorOptions.find(c => c.value === subject.color) || colorOptions[0];
                
                return (
                  <div key={subject.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <div className={`px-3 py-1 rounded-full ${colorOption.bg} ${colorOption.text} text-sm font-medium`}>
                            {subject.code}
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900">{subject.name}</h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                            {subject.credits || 3} crédits
                          </span>
                          {subject.level && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {subject.level}
                            </span>
                          )}
                          {subject.semester && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                              Semestre {subject.semester}
                            </span>
                          )}
                        </div>
                        
                        {subject.description && (
                          <p className="text-gray-600 mb-3">{subject.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <FiCode className="mr-1" size={14} />
                            Code: {subject.code}
                          </span>
                          <span className="flex items-center">
                            <FiTag className="mr-1" size={14} />
                            ID: {subject.id}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditSubject(subject)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Modifier"
                        >
                          <FiEdit2 className="h-5 w-5" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <FiTrash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FiBookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune matière trouvée
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {searchTerm || filterLevel !== 'all' || filterSemester !== 'all' 
                  ? 'Aucune matière ne correspond à vos critères de recherche.'
                  : 'Aucune matière n\'a été créée. Commencez par créer votre première matière.'
                }
              </p>
              <button
                onClick={handleCreateSubject}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Créer une matière
              </button>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {filteredSubjects.length > 0 && (
          <div className="p-5 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Affichage de {startIndex + 1} à {Math.min(startIndex + itemsPerPage, filteredSubjects.length)} sur {filteredSubjects.length} matières
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
                  {editingSubject ? 'Modifier la matière' : 'Créer une nouvelle matière'}
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
                    Nom de la matière *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Algorithmique, Base de données, etc."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code de la matière *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: INF101, BD201, etc."
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
                    placeholder="Description de la matière..."
                    rows="3"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Niveau
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Sélectionner un niveau</option>
                      {levelOptions.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  
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
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Semestre
                    </label>
                    <input
                      type="number"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="12"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couleur
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {colorOptions.map(color => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: color.value })}
                          className={`h-8 rounded-lg border-2 ${formData.color === color.value ? 'border-gray-900' : 'border-transparent'}`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
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
                  {editingSubject ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;