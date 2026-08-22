import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Search, Calendar, Clock, User, Coffee } from 'lucide-react';

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Date nav states
  const [currentDate, setCurrentDate] = useState(new Date()); // Daily date for admin
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // Month (1-12) for employee
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear()); // Year for employee

  // Data states
  const [employeeData, setEmployeeData] = useState<any>({ summary: {}, records: [] });
  const [adminData, setAdminData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch employee own attendance
  const fetchEmployeeAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/attendance/me?year=${currentYear}&month=${currentMonth}`);
      setEmployeeData(res.data);
    } catch (err) {
      console.error('Failed to load employee attendance records', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch admin daily overview
  const fetchAdminAttendance = async () => {
    try {
      setLoading(true);
      const dateStr = currentDate.toISOString().split('T')[0];
      const res = await api.get(`/attendance/admin?date=${dateStr}&search=${search}`);
      setAdminData(res.data.employees);
    } catch (err) {
      console.error('Failed to load admin daily records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminAttendance();
    } else {
      fetchEmployeeAttendance();
    }
  }, [isAdmin, currentDate, currentMonth, currentYear, search]);

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const formatMonthName = (m: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[m - 1];
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatHours = (hours: any) => {
    if (hours === null || hours === undefined) return '-';
    return `${Number(hours).toFixed(2)} hrs`;
  };

  return (
    <div className="space-y-6">
      
      {/* Navigation Headers */}
      {isAdmin ? (
        /* Admin Date Bar */
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrevDay}
              className="p-2 border border-gray-300 hover:bg-gray-50 rounded-xl transition duration-150"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-extrabold text-gray-900 min-w-[150px] text-center">
              {currentDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <button
              onClick={handleNextDay}
              className="p-2 border border-gray-300 hover:bg-gray-50 rounded-xl transition duration-150"
            >
              <ChevronRight size={16} />
            </button>
            <input
              type="date"
              value={currentDate.toISOString().split('T')[0]}
              onChange={(e) => {
                if (e.target.value) setCurrentDate(new Date(e.target.value));
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none"
            />
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Filter by employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none text-xs"
            />
          </div>
        </div>
      ) : (
        /* Employee Month Bar */
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 border border-gray-300 hover:bg-gray-50 rounded-xl transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-extrabold text-gray-900 text-lg">
              {formatMonthName(currentMonth)} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 border border-gray-300 hover:bg-gray-50 rounded-xl transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold">
            Personal Record
          </span>
        </div>
      )}

      {/* Employee View: Summary Cards */}
      {!isAdmin && employeeData.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Days Present</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{employeeData.summary.presentDays || 0} Days</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Coffee size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Leaves Taken</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{employeeData.summary.leaveDays || 0} Days</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Working Hours</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{employeeData.summary.totalWorkHours || 0} Hrs</p>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm font-medium text-gray-400 animate-pulse">
            Fetching records...
          </div>
        ) : isAdmin ? (
          /* Admin Daily Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Employee</th>
                  <th className="py-4 px-6">Check In</th>
                  <th className="py-4 px-6">Check Out</th>
                  <th className="py-4 px-6">Work Hours</th>
                  <th className="py-4 px-6">Extra Hours</th>
                  <th className="py-4 px-6">Status Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {adminData.map((record) => (
                  <tr key={record.user_id} className="hover:bg-gray-50/50">
                    <td className="py-4 px-6 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {record.first_name[0]}{record.last_name[0]}
                      </div>
                      <div>
                        <p className="text-gray-900 font-bold">{record.first_name} {record.last_name}</p>
                        <p className="text-[10px] text-gray-400 uppercase">{record.login_id}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">{formatTime(record.check_in_time)}</td>
                    <td className="py-4 px-6 font-mono text-xs">{formatTime(record.check_out_time)}</td>
                    <td className="py-4 px-6">{formatHours(record.work_hours)}</td>
                    <td className="py-4 px-6">{formatHours(record.extra_hours)}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          record.status === 'present'
                            ? 'bg-green-50 text-green-700'
                            : record.status === 'on_leave'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {adminData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400 italic">
                      No attendance logs recorded for this day
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Employee Monthly Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Check In Time</th>
                  <th className="py-4 px-6">Check Out Time</th>
                  <th className="py-4 px-6">Work Hours</th>
                  <th className="py-4 px-6">Extra Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {employeeData.records.map((record: any) => (
                  <tr key={record.attendance_id} className="hover:bg-gray-50/50">
                    <td className="py-4 px-6 text-gray-900">
                      {new Date(record.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-500">
                      {formatTime(record.check_in_time)}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-500">
                      {formatTime(record.check_out_time)}
                    </td>
                    <td className="py-4 px-6 text-gray-800">{formatHours(record.work_hours)}</td>
                    <td className="py-4 px-6 text-gray-800">{formatHours(record.extra_hours)}</td>
                  </tr>
                ))}
                {employeeData.records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400 italic">
                      No attendance logs found for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
