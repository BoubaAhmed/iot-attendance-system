import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  FiHome,
  FiUsers,
  FiGrid,
  FiCheckSquare,
  FiSettings,
  FiLogOut,
} from 'react-icons/fi'

const Sidebar = () => {

  const navigation = [
    { name: 'Dashboard', to: '/', icon: FiHome },
    { name: 'Étudiants', to: '/students', icon: FiUsers },
    { name: 'Salles', to: '/rooms', icon: FiGrid },
    { name: 'Groupes', to: '/groups', icon: FiGrid },
    { name: 'Schedules', to: '/schedules', icon: FiGrid },
    { name: 'Subjects', to: '/subjects', icon: FiGrid },
    { name: 'Présences', to: '/attendance', icon: FiCheckSquare },
    { name: 'Paramètres', to: '/settings', icon: FiSettings },
  ]

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 shadow-sm z-50">
      
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Présence Auto</h1>
        <p className="text-sm text-gray-500 mt-1">IoT Attendance System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon className={`text-lg ${({ isActive }) => isActive ? 'text-blue-600' : 'text-gray-400'} group-hover:text-current`} />
              {item.name}
            </NavLink>
          )
        })}
      </nav>

      {/* Logout Section */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-gray-100 bg-white">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Team
            </p>

            <ul className="space-y-1">
                <li className="text-sm text-gray-800">Bouba Ahmed</li>
                <li className="text-sm text-gray-800">Lkhalidi Mohamed</li>
            </ul>
        </div>

    </aside>
  )
}

export default Sidebar