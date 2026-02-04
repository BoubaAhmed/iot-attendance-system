import React from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiMapPin, // Better for Salles/Rooms
  FiLayers, // Better for Groupes
  FiCalendar, // Better for Schedules
  FiBookOpen, // Better for Subjects
  FiCheckCircle, // Better for Attendance/Présences
  FiSettings,
  FiActivity,
  FiCpu, // Represents IoT/ESP32
} from "react-icons/fi";

const Sidebar = ({ mobileOpen = false, onClose = () => {} }) => {
  const navigation = [
    { name: "Tableau de bord", to: "/", icon: FiHome },
    { name: "Étudiants", to: "/students", icon: FiUsers },
    { name: "Salles", to: "/rooms", icon: FiMapPin },
    { name: "Groupes", to: "/groups", icon: FiLayers },
    { name: "Emploi du temps", to: "/schedules", icon: FiCalendar },
    { name: "Matières", to: "/subjects", icon: FiBookOpen },
    { name: "Présences", to: "/attendance", icon: FiCheckCircle },
    { name: "Paramètres", to: "/settings", icon: FiSettings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar hidden md:flex fixed top-0 left-0 h-screen w-64 text-bg-soft shadow-lg z-50 flex-col">
        {/* Brand / Logo Section */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary rounded-lg text-white">
              <FiCpu size={24} />
            </div>
            <h1 className="text-xl font-bold text-bg-soft tracking-tight">
              Présence<span className="text-accent">Auto</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/30 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-bg-soft/80">
              Cloud Sync Active
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive ? "bg-primary/10 text-accent border border-primary/20" : "hover:bg-primary/5 hover:text-primary"} `
                }
              >
                <Icon className="text-lg transition-transform group-hover:scale-110 text-bg-soft/90" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Team / Footer Section */}
        <div className="p-4 bg-primary-dark/5 border-t border-primary-dark/15">
          <div className="flex items-center gap-2 mb-3 px-2">
            <FiActivity className="text-accent text-xs" />
            <p className="text-[10px] font-bold text-bg-soft/80 uppercase tracking-widest">
              Project Team
            </p>
          </div>

          <div className="space-y-2 px-2">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-bg-soft">
                Bouba Ahmed
              </span>
              <span className="text-[10px] text-bg-soft/70">IoT Developer</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-bg-soft">
                Lkhalidi Mohamed
              </span>
              <span className="text-[10px] text-bg-soft/70">
                Frontend Engineer
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar md:hidden fixed inset-0 z-50 transition-transform ${mobileOpen ? "visible" : "pointer-events-none"} `}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`${mobileOpen ? "opacity-60 visible" : "opacity-0 invisible"} fixed inset-0 bg-black`}
          onClick={onClose}
        />
        <aside
          className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed left-0 top-0 bottom-0 w-72 bg-primary-dark text-bg-soft shadow-xl transform transition-transform duration-300 p-5`}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg text-white">
                <FiCpu size={22} />
              </div>
              <h2 className="text-lg font-bold">
                Présence <span className="text-accent">Auto</span>
              </h2>
            </div>
            <button onClick={onClose} className="text-bg-soft/90">
              ✕
            </button>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg transition ${isActive ? "bg-primary/10 text-accent" : "hover:bg-primary/5"}`
                  }
                >
                  <Icon />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
