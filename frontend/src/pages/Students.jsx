import React, { useState, useEffect } from 'react';
import { studentAPI } from '../api/api';
import { listenToStudents } from '../firebase/firebase';
import { 
  FiSearch,
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiCheck,
  FiUsers,
  FiCreditCard,
  FiUserCheck,
  FiMail,
  FiPhone,
  FiActivity,
  FiFilter,
  FiDownload
} from 'react-icons/fi';

const Students = () => {
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    fingerprint_id: '',
    email: '',
    phone: '',
    active: true
  });
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', 'inactive'

  useEffect(() => {
    fetchStudents();
    setupRealtimeListener();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await studentAPI.getAll();
      if (response.data.success) {
        setStudents(response.data.data || {});
      }
    } catch (error) {
      console.error('Erreur chargement étudiants:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListener = () => {
    const unsubscribe = listenToStudents((data) => {
      if (data) {
        setStudents(data);
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
      if (editingStudent) {
        await studentAPI.update(editingStudent.id, formData);
      } else {
        await studentAPI.create(formData);
      }
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error('Erreur sauvegarde étudiant:', error);
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (studentId) => {
    const student = students[studentId];
    setEditingStudent({ id: studentId, ...student });
    setFormData({
      name: student.name || '',
      group: student.group || '',
      fingerprint_id: student.fingerprint_id || '',
      email: student.email || '',
      phone: student.phone || '',
      active: student.active !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (studentId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet étudiant ?')) {
      try {
        await studentAPI.delete(studentId);
        fetchStudents();
      } catch (error) {
        console.error('Erreur suppression étudiant:', error);
        alert('Erreur: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      group: '',
      fingerprint_id: '',
      email: '',
      phone: '',
      active: true
    });
    setEditingStudent(null);
    setShowForm(false);
  };

  const exportStudents = () => {
    const dataStr = JSON.stringify(students, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etudiants_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrer les étudiants
  const filteredStudents = Object.entries(students).filter(([id, student]) => {
    if (!student) return false;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (student.name?.toLowerCase() || '').includes(searchLower) ||
      id.toLowerCase().includes(searchLower) ||
      (student.group?.toLowerCase() || '').includes(searchLower) ||
      (student.email?.toLowerCase() || '').includes(searchLower)
    );
    
    const matchesFilter = 
      activeFilter === 'all' ? true :
      activeFilter === 'active' ? student.active !== false :
      activeFilter === 'inactive' ? student.active === false : true;
    
    return matchesSearch && matchesFilter;
  });

  const activeCount = Object.values(students).filter(s => s?.active !== false).length;
  const inactiveCount = Object.values(students).filter(s => s?.active === false).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des étudiants...</p>
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestion des étudiants</h1>
            <p className="text-gray-600 mt-1">
              {Object.keys(students).length} étudiant{Object.keys(students).length !== 1 ? 's' : ''} enregistré{Object.keys(students).length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportStudents}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiDownload className="h-4 w-4" />
              Exporter
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiUserPlus className="h-5 w-5" />
              Nouvel étudiant
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(students).length}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Actifs</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <FiActivity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Inactifs</p>
                <p className="text-2xl font-bold text-gray-600">{inactiveCount}</p>
              </div>
              <div className="p-2 bg-gray-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-gray-600" />
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
              placeholder="Rechercher par nom, ID, groupe ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <FiFilter className="h-5 w-5 text-gray-500" />
            <select 
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les étudiants</option>
              <option value="active">Actifs seulement</option>
              <option value="inactive">Inactifs seulement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formulaire modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 md:p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingStudent ? 'Modifier étudiant' : 'Ajouter un étudiant'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {editingStudent ? `ID: ${editingStudent.id}` : 'Remplissez les informations de l\'étudiant'}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-6 w-6 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Ahmed Benali"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Groupe
                    </label>
                    <input
                      type="text"
                      name="group"
                      value={formData.group}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: G1, G2, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <FiMail className="h-5 w-5 text-gray-400 ml-3" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 border-0 rounded-lg focus:ring-0"
                        placeholder="etudiant@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Téléphone
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <FiPhone className="h-5 w-5 text-gray-400 ml-3" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 border-0 rounded-lg focus:ring-0"
                        placeholder="06 XX XX XX XX"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ID Empreinte digitale
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <FiUserCheck className="h-5 w-5 text-gray-400 ml-3" />
                      <input
                        type="number"
                        name="fingerprint_id"
                        value={formData.fingerprint_id}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 border-0 rounded-lg focus:ring-0"
                        placeholder="Ex: 12"
                      />
                    </div>
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
                    Cet étudiant est actif dans le système
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
                    <FiCheck className="h-5 w-5" />
                    {editingStudent ? 'Mettre à jour' : 'Ajouter l\'étudiant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tableau des étudiants */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Étudiant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Informations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Identifiants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map(([id, student]) => (
                <tr key={id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 shrink-0 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FiUsers className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900">
                          {student?.name || 'Non renseigné'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: <span className="font-mono">{id}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {student?.email && (
                        <div className="flex items-center text-sm">
                          <FiMail className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="truncate max-w-45">{student.email}</span>
                        </div>
                      )}
                      {student?.phone && (
                        <div className="flex items-center text-sm">
                          <FiPhone className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{student.phone}</span>
                        </div>
                      )}
                      {student?.group && (
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {student.group}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {student?.fingerprint_id && (
                        <div className="flex items-center">
                          <FiUserCheck className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm">ID: {student.fingerprint_id}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      student?.active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className={`h-2 w-2 rounded-full mr-2 ${
                        student?.active !== false ? 'bg-green-500' : 'bg-gray-500'
                      }`}></div>
                      {student?.active !== false ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <FiEdit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <FiTrash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <FiUsers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || activeFilter !== 'all' ? 'Aucun étudiant trouvé' : 'Aucun étudiant'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {searchTerm 
                  ? 'Aucun étudiant ne correspond à votre recherche. Essayez avec d\'autres termes.'
                  : activeFilter !== 'all'
                  ? 'Aucun étudiant ne correspond à ce filtre.'
                  : 'Commencez par ajouter votre premier étudiant au système.'
                }
              </p>
              {!searchTerm && activeFilter === 'all' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FiUserPlus className="h-5 w-5" />
                  Ajouter un étudiant
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Summary */}
      {filteredStudents.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-gray-600">
          <div className="mb-2 sm:mb-0">
            Affichage de <span className="font-semibold">{filteredStudents.length}</span> étudiant{filteredStudents.length !== 1 ? 's' : ''} sur {Object.keys(students).length}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
              <span>{activeCount} actifs</span>
            </div>
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-gray-400 mr-2"></div>
              <span>{inactiveCount} inactifs</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;