import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Rooms from "./pages/Rooms";
import Attendance from "./pages/Attendance";
import "./App.css";
import Groups from "./pages/Groups";
import Schedule from "./pages/Schedule";
import Subjects from "./pages/Subjects";

import { useState } from "react";
import ErrorPage from "./pages/ErrorPage";
import SplashScreen from "./components/SplashScreen";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
    {loading ?
    <SplashScreen /> :
    <Router>
      <div className="min-h-screen bg-bg-soft">
        {/* mobile topbar */}
        <div className="md:hidden bg-white shadow-sm sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open menu"
                className="p-2 rounded-md bg-primary text-white"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>
              <h1 className="text-lg font-bold text-primary-dark">
                Présence<span className="text-accent">Auto</span>
              </h1>
            </div>
            <div className="text-sm text-primary-dark/70">Tableau</div>
          </div>
        </div>

        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="md:ml-64">
          <div className="p-6 max-w-7xl mx-auto" style={{ backgroundColor: "#FCF9EA" }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/schedules" element={<Schedule />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="*" element={<ErrorPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
    }
    </>
  );
}

export default App;
