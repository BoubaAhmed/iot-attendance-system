import React, { useState, useEffect } from 'react';
import { FiSearch, FiUserPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiUsers, FiUser, FiMail, FiPhone, FiActivity, FiFilter, FiDownload, FiSave, FiHash, FiBriefcase, FiUserCheck, FiClock, FiRefreshCw, FiEye, FiEyeOff, FiStar, FiTrendingUp, FiCalendar, FiChevronRight, FiChevronLeft, FiCopy, FiAlertCircle, FiShield, FiPercent} from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import studentAPI from '../api/studentsApi';

const MySwal = withReactContent(Swal);

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    fingerprint_id: '',
    email: '',
    phone: '',
    active: true
  });
  const [activeFilter, setActiveFilter] = useState('all');
  const [formErrors, setFormErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showMobileForm, setShowMobileForm] = useState(false);

  // Color palette
  const colors = {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d'
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f'
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d'
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827'
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getAll();
      if (response.data.success) {
        // Handle the case where data might be an object or array
        let studentsData = response.data.data;
        if (studentsData && typeof studentsData === 'object' && !Array.isArray(studentsData)) {
          // Convert object to array if needed
          studentsData = Object.values(studentsData);
        }
        const sortedStudents = (studentsData || []).sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        setStudents(sortedStudents);
      } else {
        toast.error(response.data.error || 'Failed to load students');
      }
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Error loading students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (formData.fingerprint_id && !/^\d+$/.test(formData.fingerprint_id)) {
      errors.fingerprint_id = 'Fingerprint ID must be a number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix form errors');
      return;
    }
    
    try {
      // Prepare student data
      const studentData = {
        name: formData.name.trim(),
        group: formData.group.trim() || '',
        email: formData.email.trim() || '',
        phone: formData.phone.trim() || '',
        active: formData.active
      };
      
      // Only include fingerprint_id if it's provided
      if (formData.fingerprint_id.trim()) {
        studentData.fingerprint_id = parseInt(formData.fingerprint_id);
      }
      
      if (editingStudent) {
        const response = await studentAPI.update(editingStudent.fingerprint_id, studentData);
        if (response.data.success) {
          toast.success('Student updated successfully!');
          resetForm();
          fetchStudents();
          setSelectedStudent(null);
        } else {
          toast.error(response.data.error || 'Failed to update student');
        }
      } else {
        const response = await studentAPI.create(studentData);
        if (response.data.success) {
          toast.success('Student created successfully!');
          resetForm();
          fetchStudents();
        } else {
          toast.error(response.data.error || 'Failed to create student');
        }
      }
    } catch (error) {
      console.error('Error saving student:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name || '',
      group: student.group || '',
      fingerprint_id: student.fingerprint_id?.toString() || '',
      email: student.email || '',
      phone: student.phone || '',
      active: student.active !== false
    });
    setSelectedStudent(student);
    setShowMobileForm(true);
  };

  const handleDelete = async (student) => {
    const result = await MySwal.fire({
      title: <div className="text-lg font-semibold text-gray-900">Delete Student</div>,
      html: (
        <div className="text-left">
          <p className="mb-4 text-gray-600">Are you sure you want to delete this student?</p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                <FiUser className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{student.name}</p>
                <p className="text-sm text-gray-600">Fingerprint ID: {student.fingerprint_id}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: colors.danger[600],
      cancelButtonColor: colors.gray[500],
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-xl',
        confirmButton: 'px-4 py-2 rounded-lg',
        cancelButton: 'px-4 py-2 rounded-lg'
      }
    });
    
    if (result.isConfirmed) {
      try {
        const response = await studentAPI.delete(student.fingerprint_id);
        if (response.data.success) {
          toast.success('Student deleted successfully!');
          fetchStudents();
          if (selectedStudent?.fingerprint_id === student.fingerprint_id) {
            setSelectedStudent(null);
          }
          if (editingStudent?.fingerprint_id === student.fingerprint_id) {
            resetForm();
          }
        } else {
          toast.error(response.data.error || 'Failed to delete student');
        }
      } catch (error) {
        console.error('Error deleting student:', error);
        const errorMessage = error.response?.data?.error || error.message;
        toast.error(`Error: ${errorMessage}`);
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
    setFormErrors({});
  };

  const exportStudents = () => {
    const dataStr = JSON.stringify(students, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Students exported successfully!');
  };

  const refreshStudents = () => {
    fetchStudents();
    toast.info('Refreshing student list...');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (!student) return false;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (student.name?.toLowerCase() || '').includes(searchLower) ||
      (student.group?.toLowerCase() || '').includes(searchLower) ||
      (student.email?.toLowerCase() || '').includes(searchLower) ||
      (student.fingerprint_id?.toString() || '').includes(searchLower)
    );
    
    const matchesFilter = 
      activeFilter === 'all' ? true :
      activeFilter === 'active' ? student.active !== false :
      activeFilter === 'inactive' ? student.active === false : true;
    
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const activeCount = students.filter(s => s?.active !== false).length;
  const inactiveCount = students.filter(s => s?.active === false).length;
  const activePercentage = students.length > 0 ? Math.round((activeCount / students.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.gray[50] }}>
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-t-transparent animate-spin mx-auto" style={{ borderColor: colors.primary[500] }}></div>
            <FiUsers className="h-8 w-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ color: colors.primary[600] }} />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading students...</p>
          <p className="text-sm text-gray-500">Please wait a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.gray[50] }}>
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
        className="lg:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center"
        style={{ backgroundColor: colors.primary[600] }}
      >
        {showMobileForm ? (
          <FiX className="h-6 w-6 text-white" />
        ) : (
          <FiUserPlus className="h-6 w-6 text-white" />
        )}
      </button>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: colors.primary[100] }}>
                  <FiUsers className="h-8 w-8" style={{ color: colors.primary[600] }} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Student Management</h1>
                  <p className="text-gray-600 mt-1 flex items-center space-x-2">
                    <span>{students.length} student{students.length !== 1 ? 's' : ''} registered</span>
                    <span className="text-gray-400">•</span>
                    <span className="flex items-center">
                      <FiPercent className="h-4 w-4 mr-1" />
                      {activePercentage}% active
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={refreshStudents}
                className="flex items-center gap-2 px-4 py-2.5 border rounded-lg hover:shadow-sm transition-all"
                style={{ 
                  backgroundColor: 'white',
                  borderColor: colors.gray[300],
                  color: colors.gray[700]
                }}
              >
                <FiRefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={exportStudents}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:shadow-sm transition-all"
                style={{ 
                  backgroundColor: colors.warning[100],
                  color: colors.warning[700]
                }}
              >
                <FiDownload className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl p-5 shadow-sm transition-all hover:shadow-md"
              style={{ 
                background: `linear-gradient(135deg, ${colors.primary[50]}, white)`,
                border: `1px solid ${colors.primary[200]}`
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.primary[600] }}>Total Students</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{students.length}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.primary[100] }}>
                  <FiUsers className="h-6 w-6" style={{ color: colors.primary[600] }} />
                </div>
              </div>
            </div>
            
            <div className="rounded-xl p-5 shadow-sm transition-all hover:shadow-md"
              style={{ 
                background: `linear-gradient(135deg, ${colors.success[50]}, white)`,
                border: `1px solid ${colors.success[200]}`
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.success[600] }}>Active</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.success[100] }}>
                  <FiActivity className="h-6 w-6" style={{ color: colors.success[600] }} />
                </div>
              </div>
            </div>
            
            <div className="rounded-xl p-5 shadow-sm transition-all hover:shadow-md"
              style={{ 
                background: `linear-gradient(135deg, ${colors.gray[50]}, white)`,
                border: `1px solid ${colors.gray[200]}`
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.gray[600] }}>Inactive</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{inactiveCount}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.gray[100] }}>
                  <FiUserCheck className="h-6 w-6" style={{ color: colors.gray[600] }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Students Table (2/3 on desktop) */}
          <div className="lg:w-2/3">
            {/* Search and Filter Bar */}
            <div className="rounded-xl p-4 mb-6 shadow-sm"
              style={{ 
                backgroundColor: 'white',
                border: `1px solid ${colors.gray[200]}`
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" 
                    style={{ color: colors.gray[400] }}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, group, email, or fingerprint ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg focus:ring-2 focus:outline-none transition-all"
                    style={{ 
                      backgroundColor: colors.gray[50],
                      border: `1px solid ${colors.gray[300]}`,
                      color: colors.gray[900]
                    }}
                  />
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <FiFilter className="h-5 w-5" style={{ color: colors.gray[500] }} />
                    <select 
                      value={activeFilter}
                      onChange={(e) => setActiveFilter(e.target.value)}
                      className="px-3 py-2.5 rounded-lg focus:ring-2 focus:outline-none transition-all"
                      style={{ 
                        backgroundColor: colors.gray[50],
                        border: `1px solid ${colors.gray[300]}`,
                        color: colors.gray[700],
                        minWidth: '180px'
                      }}
                    >
                      <option value="all">All Students</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={() => {
                      resetForm();
                      setSelectedStudent(null);
                      setShowMobileForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:shadow-sm transition-all"
                    style={{ 
                      backgroundColor: colors.primary[50],
                      color: colors.primary[700]
                    }}
                  >
                    <FiUserPlus className="h-4 w-4" />
                    Add New
                  </button>
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="rounded-xl overflow-hidden shadow-sm"
              style={{ 
                backgroundColor: 'white',
                border: `1px solid ${colors.gray[200]}`
              }}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr style={{ backgroundColor: colors.gray[50] }}>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: colors.gray[600] }}>
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: colors.gray[600] }}>
                        Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: colors.gray[600] }}>
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: colors.gray[600] }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: colors.gray[200] }}>
                    {currentStudents.map((student, index) => (
                      <tr 
                        key={student.fingerprint_id || index} 
                        className={`transition-all hover:shadow-md cursor-pointer ${
                          selectedStudent?.fingerprint_id === student.fingerprint_id 
                            ? 'bg-blue-50' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedStudent(student)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center"
                              style={{ 
                                background: `linear-gradient(135deg, ${colors.primary[100]}, ${colors.primary[200]})`
                              }}
                            >
                              <FiUser className="h-5 w-5" style={{ color: colors.primary[600] }} />
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900 flex items-center">
                                {student.name || 'N/A'}
                                {student.active === false && (
                                  <FiEyeOff className="h-4 w-4 ml-2" style={{ color: colors.gray[400] }} />
                                )}
                              </div>
                              <div className="text-sm flex items-center space-x-2">
                                <span className="text-gray-500">ID:</span>
                                <code className="px-2 py-0.5 rounded text-xs"
                                  style={{ 
                                    backgroundColor: colors.gray[100],
                                    color: colors.gray[700]
                                  }}
                                >
                                  {student.fingerprint_id || 'N/A'}
                                </code>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            {student.group && (
                              <div className="flex items-center text-sm">
                                <FiBriefcase className="h-4 w-4 mr-2 shrink-0" style={{ color: colors.gray[400] }} />
                                <span className="font-medium" style={{ color: colors.primary[600] }}>
                                  {student.group}
                                </span>
                              </div>
                            )}
                            {student.email && (
                              <div className="flex items-center text-sm">
                                <FiMail className="h-4 w-4 mr-2 shrink-0" style={{ color: colors.gray[400] }} />
                                <span className="text-gray-700 truncate max-w-[150px]">{student.email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              student.active !== false
                                ? 'text-green-700 bg-green-100 border border-green-200'
                                : 'text-gray-700 bg-gray-100 border border-gray-200'
                            }`}>
                              <div className={`h-2 w-2 rounded-full mr-2 ${
                                student.active !== false ? 'bg-green-500' : 'bg-gray-500'
                              }`}></div>
                              {student.active !== false ? 'Active' : 'Inactive'}
                            </span>
                            {student.phone && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(student.phone);
                                }}
                                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                                title="Copy phone"
                              >
                                <FiPhone className="h-4 w-4" style={{ color: colors.gray[500] }} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(student);
                              }}
                              className="p-2 rounded-lg transition-all hover:shadow-sm"
                              style={{ 
                                backgroundColor: colors.primary[50],
                                color: colors.primary[600]
                              }}
                              title="Edit"
                            >
                              <FiEdit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(student);
                              }}
                              className="p-2 rounded-lg transition-all hover:shadow-sm"
                              style={{ 
                                backgroundColor: colors.danger[50],
                                color: colors.danger[600]
                              }}
                              title="Delete"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {currentStudents.length === 0 && (
                  <div className="text-center py-16">
                    <div className="inline-flex p-6 rounded-full mb-4" 
                      style={{ backgroundColor: colors.gray[100] }}
                    >
                      <FiUsers className="h-16 w-16" style={{ color: colors.gray[400] }} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm || activeFilter !== 'all' ? 'No students found' : 'No students yet'}
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6">
                      {searchTerm 
                        ? "No students match your search. Try different keywords."
                        : activeFilter !== 'all'
                        ? "No students match this filter."
                        : "Get started by adding your first student."
                      }
                    </p>
                    {!searchTerm && activeFilter === 'all' && (
                      <button
                        onClick={() => {
                          resetForm();
                          setShowMobileForm(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg hover:shadow-lg transition-all"
                        style={{ 
                          background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
                          color: 'white'
                        }}
                      >
                        <FiUserPlus className="h-5 w-5" />
                        Add First Student
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t" style={{ borderColor: colors.gray[200] }}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredStudents.length)} of {filteredStudents.length} entries
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-lg ${
                          currentPage === 1 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <FiChevronLeft className="h-5 w-5" />
                      </button>
                      
                      {[...Array(totalPages)].map((_, index) => (
                        <button
                          key={index}
                          onClick={() => paginate(index + 1)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            currentPage === index + 1
                              ? 'text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: currentPage === index + 1 ? colors.primary[600] : 'transparent'
                          }}
                        >
                          {index + 1}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-lg ${
                          currentPage === totalPages 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <FiChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Form (1/3 on desktop) */}
          <div className={`lg:w-1/3 ${showMobileForm ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-6">
              <div className="rounded-xl shadow-lg overflow-hidden"
                style={{ 
                  backgroundColor: 'white',
                  border: `1px solid ${colors.gray[200]}`
                }}
              >
                {/* Form Header */}
                <div className="px-6 py-5 border-b"
                  style={{ 
                    backgroundColor: colors.primary[50],
                    borderColor: colors.primary[200]
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: colors.primary[100] }}>
                        {editingStudent ? (
                          <FiEdit2 className="h-5 w-5" style={{ color: colors.primary[600] }} />
                        ) : (
                          <FiUserPlus className="h-5 w-5" style={{ color: colors.primary[600] }} />
                        )}
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900">
                          {editingStudent ? 'Edit Student' : 'Add New Student'}
                        </h2>
                        <p className="text-sm" style={{ color: colors.primary[600] }}>
                          {editingStudent ? `Fingerprint ID: ${editingStudent.fingerprint_id}` : 'Fill student details'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetForm}
                      className="p-2 rounded-lg hover:bg-white transition-colors"
                      style={{ color: colors.gray[500] }}
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                  <div className="space-y-4">
                    {/* Name Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.gray[700] }}>
                        <div className="flex items-center">
                          <FiUser className="h-4 w-4 mr-2" style={{ color: colors.primary[500] }} />
                          Full Name *
                        </div>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:outline-none transition-all"
                        style={{ 
                          backgroundColor: colors.gray[50],
                          border: `1px solid ${formErrors.name ? colors.danger[300] : colors.gray[300]}`,
                          color: colors.gray[900]
                        }}
                        placeholder="Enter student name"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm flex items-center" style={{ color: colors.danger[600] }}>
                          <FiAlertCircle className="h-4 w-4 mr-1" />
                          {formErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Group Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.gray[700] }}>
                        <div className="flex items-center">
                          <FiBriefcase className="h-4 w-4 mr-2" style={{ color: colors.primary[500] }} />
                          Group
                        </div>
                      </label>
                      <input
                        type="text"
                        name="group"
                        value={formData.group}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:outline-none transition-all"
                        style={{ 
                          backgroundColor: colors.gray[50],
                          border: `1px solid ${colors.gray[300]}`,
                          color: colors.gray[900]
                        }}
                        placeholder="e.g., G1, G2, etc."
                      />
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.gray[700] }}>
                        <div className="flex items-center">
                          <FiMail className="h-4 w-4 mr-2" style={{ color: colors.primary[500] }} />
                          Email Address
                        </div>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:outline-none transition-all"
                        style={{ 
                          backgroundColor: colors.gray[50],
                          border: `1px solid ${formErrors.email ? colors.danger[300] : colors.gray[300]}`,
                          color: colors.gray[900]
                        }}
                        placeholder="student@email.com"
                      />
                      {formErrors.email && (
                        <p className="mt-1 text-sm flex items-center" style={{ color: colors.danger[600] }}>
                          <FiAlertCircle className="h-4 w-4 mr-1" />
                          {formErrors.email}
                        </p>
                      )}
                    </div>

                    {/* Phone Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.gray[700] }}>
                        <div className="flex items-center">
                          <FiPhone className="h-4 w-4 mr-2" style={{ color: colors.primary[500] }} />
                          Phone Number
                        </div>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:outline-none transition-all"
                        style={{ 
                          backgroundColor: colors.gray[50],
                          border: `1px solid ${colors.gray[300]}`,
                          color: colors.gray[900]
                        }}
                        placeholder="+212 6 XX XX XX XX"
                      />
                    </div>

                    {/* Fingerprint ID Field */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.gray[700] }}>
                        <div className="flex items-center">
                          <FiHash className="h-4 w-4 mr-2" style={{ color: colors.primary[500] }} />
                          Fingerprint ID
                        </div>
                      </label>
                      <input
                        type="text"
                        name="fingerprint_id"
                        value={formData.fingerprint_id}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:outline-none transition-all"
                        style={{ 
                          backgroundColor: colors.gray[50],
                          border: `1px solid ${formErrors.fingerprint_id ? colors.danger[300] : colors.gray[300]}`,
                          color: colors.gray[900]
                        }}
                        placeholder="Enter fingerprint ID"
                      />
                      {formErrors.fingerprint_id && (
                        <p className="mt-1 text-sm flex items-center" style={{ color: colors.danger[600] }}>
                          <FiAlertCircle className="h-4 w-4 mr-1" />
                          {formErrors.fingerprint_id}
                        </p>
                      )}
                      <p className="mt-1 text-xs" style={{ color: colors.gray[500] }}>
                        {editingStudent ? "Cannot change fingerprint ID for existing student" : "Leave empty to auto-generate"}
                      </p>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center p-4 rounded-lg border transition-all hover:bg-gray-50 cursor-pointer"
                      style={{ 
                        backgroundColor: formData.active ? colors.success[50] : colors.gray[50],
                        borderColor: formData.active ? colors.success[200] : colors.gray[300]
                      }}
                      onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                    >
                      <input
                        type="checkbox"
                        id="active"
                        name="active"
                        checked={formData.active}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded focus:ring-2"
                        style={{ 
                          color: colors.primary[600],
                          borderColor: colors.gray[300]
                        }}
                      />
                      <label htmlFor="active" className="ml-3 text-sm flex-1 cursor-pointer" style={{ color: colors.gray[700] }}>
                        <div className="flex items-center justify-between">
                          <span>Student is active</span>
                          <div className={`h-2 w-2 rounded-full ${formData.active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="mt-6 pt-6 border-t" style={{ borderColor: colors.gray[200] }}>
                    <div className="flex flex-col space-y-3">
                      <button
                        type="submit"
                        className="w-full py-3 rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        style={{ 
                          background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
                          color: 'white'
                        }}
                      >
                        {editingStudent ? (
                          <>
                            <FiSave className="h-5 w-5" />
                            Update Student
                          </>
                        ) : (
                          <>
                            <FiUserPlus className="h-5 w-5" />
                            Add Student
                          </>
                        )}
                      </button>
                      
                      {editingStudent && (
                        <button
                          type="button"
                          onClick={resetForm}
                          className="w-full py-3 rounded-lg font-medium hover:shadow transition-all"
                          style={{ 
                            backgroundColor: colors.gray[100],
                            color: colors.gray[700],
                            border: `1px solid ${colors.gray[300]}`
                          }}
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;