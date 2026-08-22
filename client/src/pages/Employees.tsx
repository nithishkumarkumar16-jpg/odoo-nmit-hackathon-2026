import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, User, MapPin, Briefcase, Mail, Check, AlertCircle, Plane } from 'lucide-react';

interface Employee {
  user_id: string;
  login_id: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  designation: string | null;
  location: string | null;
  department_name: string | null;
  manager_name: string | null;
  current_status: 'present' | 'on_leave' | 'absent';
}

export const Employees: React.FC = () => {
  const { user, socket } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Employee Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [location, setLocation] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  const fetchEmployees = async () => {
    try {
      const res = await api.get(`/employees?search=${search}`);
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to load employee list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search]);

  // Handle Real-time presence status update from Socket.io!
  useEffect(() => {
    if (socket) {
      const handleStatusChange = (data: { userId: string; status: 'present' | 'on_leave' | 'absent' }) => {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.user_id === data.userId ? { ...emp, current_status: data.status } : emp
          )
        );
      };

      socket.on('ATTENDANCE_CHANGED', handleStatusChange);

      return () => {
        socket.off('ATTENDANCE_CHANGED', handleStatusChange);
      };
    }
  }, [socket]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);
    try {
      const res = await api.post('/employees', {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        designation: designation || undefined,
        location: location || undefined,
        dateOfJoining: dateOfJoining || undefined,
      });

      setSuccessInfo(res.data.employee);
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setDesignation('');
      setLocation('');
      setDateOfJoining('');
      fetchEmployees();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create employee');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, login id, email, or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => {
              setIsModalOpen(true);
              setSuccessInfo(null);
              setError(null);
            }}
            className="flex items-center justify-center space-x-2 bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-sm hover:bg-indigo-700 transition duration-200"
          >
            <Plus size={16} />
            <span>New Employee</span>
          </button>
        )}
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-200 h-44 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => (
            <div
              key={emp.user_id}
              onClick={() => navigate(`/profile/${emp.user_id}`)}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-300 relative group flex items-start space-x-4 shadow-sm"
            >
              
              {/* Photo / Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold flex-shrink-0 group-hover:bg-indigo-100 transition-all duration-300">
                {emp.profile_picture_url ? (
                  <img
                    src={`http://localhost:5000${emp.profile_picture_url}`}
                    alt={`${emp.first_name} ${emp.last_name}`}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <span>{emp.first_name[0]}{emp.last_name[0]}</span>
                )}
              </div>

              {/* Info Details */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 truncate">
                  {emp.first_name} {emp.last_name}
                </h3>
                <p className="text-xs text-gray-400 font-semibold truncate flex items-center space-x-1">
                  <Briefcase size={12} className="text-gray-400" />
                  <span>{emp.designation || 'Specialist'}</span>
                </p>
                <p className="text-xs text-gray-500 font-semibold truncate flex items-center space-x-1">
                  <Mail size={12} className="text-gray-400" />
                  <span>{emp.email}</span>
                </p>
                <p className="text-xs text-gray-500 truncate flex items-center space-x-1">
                  <MapPin size={12} className="text-gray-400" />
                  <span>{emp.location || 'Gandhinagar Office'}</span>
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase">
                    {emp.login_id}
                  </span>
                  {emp.department_name && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                      {emp.department_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Indicator Dot */}
              <div className="absolute top-4 right-4 flex items-center">
                {emp.current_status === 'present' && (
                  <div className="w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white ring-2 ring-green-100 shadow-sm" title="Present" />
                )}
                {emp.current_status === 'on_leave' && (
                  <div className="flex items-center justify-center w-5 h-5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-600 shadow-sm" title="On Leave">
                    <Plane size={11} className="transform rotate-45" />
                  </div>
                )}
                {emp.current_status === 'absent' && (
                  <div className="w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white ring-2 ring-amber-100 shadow-sm" title="Absent" />
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* New Employee Creation Modal (Admin-only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 border border-gray-200 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-gray-900">Add New Employee</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold bg-gray-50 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 text-xs font-semibold rounded">
                {error}
              </div>
            )}

            {successInfo ? (
              <div className="bg-green-50 border border-green-200 p-6 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 text-green-700 font-bold text-sm">
                  <Check size={18} />
                  <span>Employee Created Successfully!</span>
                </div>
                <div className="text-xs text-gray-700 space-y-2">
                  <p><strong>Login ID:</strong> <code className="bg-white border px-1.5 py-0.5 rounded text-indigo-600">{successInfo.loginId}</code></p>
                  <p><strong>Temporary Password:</strong> <code className="bg-white border px-1.5 py-0.5 rounded text-indigo-600">{successInfo.tempPassword}</code></p>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">
                    Please provide these credentials to the employee. They will be forced to change password upon first sign-in.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@company.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Developer"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Gandhinagar"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Joining Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dateOfJoining}
                    onChange={(e) => setDateOfJoining(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm shadow-sm hover:bg-indigo-700 transition duration-200"
                >
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
