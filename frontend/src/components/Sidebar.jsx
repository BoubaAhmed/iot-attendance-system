import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  FiHome,
  FiUsers,
  FiMapPin,     // Better for Salles/Rooms
  FiLayers,     // Better for Groupes
  FiCalendar,   // Better for Schedules
  FiBookOpen,   // Better for Subjects
  FiCheckCircle, // Better for Attendance/Présences
  FiSettings,
  FiActivity,
  FiCpu         // Represents IoT/ESP32
} from 'react-icons/fi'

const Sidebar = () => {
  const navigation = [
    { name: 'Tableau de bord', to: '/', icon: FiHome },
    { name: 'Étudiants', to: '/students', icon: FiUsers },
    { name: 'Salles & ESP32', to: '/rooms', icon: FiMapPin },
    { name: 'Groupes', to: '/groups', icon: FiLayers },
    { name: 'Emploi du temps', to: '/schedules', icon: FiCalendar },
    { name: 'Matières', to: '/subjects', icon: FiBookOpen },
    { name: 'Présences', to: '/attendance', icon: FiCheckCircle },
    { name: 'Paramètres', to: '/settings', icon: FiSettings },
  ]

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shadow-xl z-50 flex flex-col">
      
      {/* Brand / Logo Section */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <FiCpu size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Présence<span className="text-blue-500">Auto</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            Cloud Sync Active
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                    : 'hover:bg-slate-800 hover:text-white border border-transparent'
                }`
              }
            >
              <Icon className="text-lg transition-transform group-hover:scale-110" />
              {item.name}
            </NavLink>
          )
        })}
      </nav>

      {/* Team / Footer Section */}
      <div className="p-4 bg-slate-950/50 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-3 px-2">
          <FiActivity className="text-blue-500 text-xs" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Project Team
          </p>
        </div>
        
        <div className="space-y-2 px-2">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-200">Bouba Ahmed</span>
            <span className="text-[10px] text-slate-500">IoT Developer</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-200">Lkhalidi Mohamed</span>
            <span className="text-[10px] text-slate-500">Frontend Engineer</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar