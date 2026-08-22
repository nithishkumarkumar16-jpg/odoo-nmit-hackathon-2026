import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { LogOut, User as UserIcon, Play, Square, Bell, LogIn, ChevronDown } from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout, attendanceStatus, checkIn, checkOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!user) return null;

  const handleCheckInOut = async () => {
    setError(null);
    try {
      if (attendanceStatus.checkedIn) {
        await checkOut();
      } else {
        await checkIn();
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed');
      setTimeout(() => setError(null), 5000);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
              DF
            </div>
            <div>
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Dayflow</span>
              <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">HR Portal</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/employees"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              Employees
            </NavLink>
            <NavLink
              to="/attendance"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              Attendance
            </NavLink>
            <NavLink
              to="/time-off"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              Time Off
            </NavLink>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            
            {/* Real-time Status Dot + Check In / Out widget */}
            <div className="flex items-center space-x-3 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
              <span
                className={`w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                  attendanceStatus.checkedIn ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-semibold text-gray-700 hidden sm:inline">
                {attendanceStatus.checkedIn
                  ? `Checked In (Since ${formatTime(attendanceStatus.checkInTime)})`
                  : 'Red/Idle'}
              </span>
              <button
                onClick={handleCheckInOut}
                className={`flex items-center space-x-1 text-xs font-bold px-3 py-1 rounded-full transition-all duration-200 ${
                  attendanceStatus.checkedIn
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {attendanceStatus.checkedIn ? (
                  <>
                    <Square size={12} className="fill-current" />
                    <span>Check Out</span>
                  </>
                ) : (
                  <>
                    <Play size={12} className="fill-current" />
                    <span>Check In</span>
                  </>
                )}
              </button>
            </div>

            {/* Error notifications */}
            {error && (
              <span className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 rounded-lg px-2.5 py-1.5 animate-bounce">
                {error}
              </span>
            )}

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 focus:outline-none"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200">
                  {user.loginId.slice(2, 4)}
                </div>
                <ChevronDown size={14} className="text-gray-500" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-50">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Logged In As</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{user.email}</p>
                    <p className="text-[10px] bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5 inline-block font-semibold mt-1">
                      {user.role}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate(`/profile/${user.userId}`);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 font-medium"
                  >
                    <UserIcon size={15} />
                    <span>My Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 font-medium"
                  >
                    <LogOut size={15} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
