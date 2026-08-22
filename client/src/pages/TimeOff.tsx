import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Clock, Check, X, FileText, Paperclip, ChevronLeft, ChevronRight, MessageSquare, AlertCircle
} from 'lucide-react';

interface Request {
  leave_request_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  login_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  remarks: string | null;
  attachment_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requires_attachment: boolean;
  reviewer_comments: string | null;
}

export const TimeOff: React.FC = () => {
  const { user, socket } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeAdminTab, setActiveAdminTab] = useState<'requests' | 'allocations'>('requests');
  const [loading, setLoading] = useState(true);

  // Data States
  const [balances, setBalances] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [adminRequests, setAdminRequests] = useState<Request[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [targetUserId, setTargetUserId] = useState(user?.userId || '');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDays, setTotalDays] = useState('1');
  const [remarks, setRemarks] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  // Review Dialog Field
  const [reviewComments, setReviewComments] = useState<{ [id: string]: string }>({});

  // Heatmap Year Selector
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [heatmapData, setHeatmapData] = useState<any[]>([]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      const balRes = await api.get('/leave/balances');
      setBalances(balRes.data);

      const heatRes = await api.get(`/leave/heatmap?year=${heatmapYear}`);
      setHeatmapData(heatRes.data);
    } catch (err) {
      console.error('Failed to load employee leave details', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const reqRes = await api.get('/leave/admin/requests');
      setAdminRequests(reqRes.data);

      const allocRes = await api.get('/leave/admin/allocations');
      setAllocations(allocRes.data);

      const empRes = await api.get('/employees');
      setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load admin leave stats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await api.get('/leave/types');
      setLeaveTypes(res.data);
      if (res.data.length > 0) setLeaveTypeId(res.data[0].leave_type_id);
    } catch (err) {
      console.error('Failed to load leave types', err);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    } else {
      fetchEmployeeData();
    }
  }, [isAdmin, heatmapYear]);

  // Real-time WebSocket handlers for updates on leaves!
  useEffect(() => {
    if (socket) {
      const handleLeaveUpdate = (data: any) => {
        // Reload details when leave request status is updated
        if (isAdmin) fetchAdminData();
        else fetchEmployeeData();
      };

      const handleNewRequest = (data: any) => {
        if (isAdmin) fetchAdminData();
      };

      socket.on('LEAVE_UPDATED', handleLeaveUpdate);
      socket.on('NEW_LEAVE_REQUEST', handleNewRequest);

      return () => {
        socket.off('LEAVE_UPDATED', handleLeaveUpdate);
        socket.off('NEW_LEAVE_REQUEST', handleNewRequest);
      };
    }
  }, [socket, isAdmin]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append('userId', targetUserId);
    formData.append('leaveTypeId', leaveTypeId);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);
    formData.append('totalDays', totalDays);
    formData.append('remarks', remarks);
    if (attachment) {
      formData.append('attachment', attachment);
    }

    try {
      await api.post('/leave/request', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setIsModalOpen(false);
      // Reset form
      setStartDate('');
      setEndDate('');
      setTotalDays('1');
      setRemarks('');
      setAttachment(null);

      if (isAdmin) fetchAdminData();
      else fetchEmployeeData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request leave');
    }
  };

  const handleReviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const comments = reviewComments[requestId] || '';
      await api.put(`/leave/admin/requests/${requestId}/review`, {
        status,
        comments,
      });
      // Clear comments for this request
      setReviewComments((prev) => {
        const copy = { ...prev };
        delete copy[requestId];
        return copy;
      });
      fetchAdminData();
    } catch (err) {
      console.error('Failed to review leave request', err);
    }
  };

  const handleAllocationUpdate = async (userId: string, leaveTypeId: string, year: number, totalDays: number) => {
    try {
      await api.put('/leave/admin/allocations', {
        userId,
        leaveTypeId,
        year,
        totalDays,
      });
      fetchAdminData();
    } catch (err) {
      console.error('Failed to update leave allocation', err);
    }
  };

  // Renders the heatmap visualizer calendar grid
  const renderHeatmap = () => {
    const days: any[] = [];
    const now = new Date(heatmapYear, 0, 1);
    const end = new Date(heatmapYear + 1, 0, 1);

    // Map heatmapData into lookup object
    const dayLookup: { [dateStr: string]: 'approved' | 'pending' } = {};
    heatmapData.forEach((req) => {
      const start = new Date(req.start_date);
      const stop = new Date(req.end_date);
      for (let d = new Date(start); d <= stop; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dayLookup[dateStr] = req.status === 'approved' ? 'approved' : 'pending';
      }
    });

    while (now < end) {
      const dateStr = now.toISOString().split('T')[0];
      const status = dayLookup[dateStr];
      const dayOfWeek = now.getDay();

      days.push({
        dateStr,
        dayOfMonth: now.getDate(),
        month: now.getMonth(),
        dayOfWeek,
        status,
      });
      now.setDate(now.getDate() + 1);
    }

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Leave Utilization Heatmap</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHeatmapYear(heatmapYear - 1)}
              className="p-1 border rounded-lg hover:bg-gray-50 text-gray-500"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold text-gray-700">{heatmapYear}</span>
            <button
              onClick={() => setHeatmapYear(heatmapYear + 1)}
              className="p-1 border rounded-lg hover:bg-gray-50 text-gray-500"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Calendar Heatmap Grid */}
        <div className="grid grid-cols-2 gap-5 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4 xl:grid-cols-6">
          {months.map((m, mIndex) => {
            const monthDays = days.filter((d) => d.month === mIndex);
            return (
              <div key={m} className="min-w-0 rounded-xl border border-gray-100 bg-white p-3 shadow-sm space-y-2.5">
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider text-center">{m}</p>
                <div className="grid grid-cols-7 gap-1.5 place-items-center">
                  {Array.from({ length: monthDays[0]?.dayOfWeek ?? 0 }).map((_, index) => (
                    <span key={`${m}-blank-${index}`} aria-hidden="true" className="h-4 w-4" />
                  ))}
                  {monthDays.map((d) => (
                    <div
                      key={d.dateStr}
                      title={`${d.dateStr}: ${d.status || 'No leaves'}`}
                      className={`h-4 w-4 rounded-md transition-colors ${
                        d.status === 'approved'
                          ? 'bg-green-500 text-white'
                          : d.status === 'pending'
                          ? 'bg-amber-400 text-white'
                          : 'bg-gray-200/60 text-gray-400 hover:bg-gray-300'
                      }`}
                    >
                      {/* Optional short index representation */}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-semibold text-gray-500 pt-1">
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-gray-200/60 rounded-sm" />
            <span>Available / Work Day</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-amber-400 rounded-sm" />
            <span>Pending Request</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <span>Approved Time Off</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Leaves & Time Off</h2>
          <p className="text-xs text-gray-500 mt-1">Submit request, view heatmap calendars, and check balances</p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setError(null);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-sm transition duration-200 flex items-center justify-center space-x-2"
        >
          <Calendar size={16} />
          <span>Apply Time Off</span>
        </button>
      </div>

      {/* Employee View Panels */}
      {!isAdmin ? (
        <div className="space-y-6">
          {/* Allocation summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {balances.map((bal) => (
              <div key={bal.balance_id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                    {bal.leave_type_name}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    bal.is_paid ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {bal.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
                <div className="flex items-baseline space-x-1.5 pt-1">
                  <span className="text-3xl font-black text-indigo-600">{Number(bal.remaining_days)}</span>
                  <span className="text-xs font-semibold text-gray-400">/ {Number(bal.total_days)} Days left</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full"
                    style={{ width: `${(Number(bal.used_days) / Number(bal.total_days)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Heatmap visualization */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            {renderHeatmap()}
          </div>
        </div>
      ) : (
        /* Admin View Tabs */
        <div className="space-y-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveAdminTab('requests')}
              className={`pb-3 text-sm font-bold border-b-2 mr-6 transition duration-200 ${
                activeAdminTab === 'requests' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Time Off Requests
            </button>
            <button
              onClick={() => setActiveAdminTab('allocations')}
              className={`pb-3 text-sm font-bold border-b-2 transition duration-200 ${
                activeAdminTab === 'allocations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Allocation Settings
            </button>
          </div>

          {activeAdminTab === 'requests' ? (
            /* Time Off Requests Table */
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Employee</th>
                      <th className="py-4 px-6">Leave Type</th>
                      <th className="py-4 px-6">Period</th>
                      <th className="py-4 px-6">Days Count</th>
                      <th className="py-4 px-6">Remarks & Files</th>
                      <th className="py-4 px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {adminRequests.map((req) => (
                      <tr key={req.leave_request_id} className="hover:bg-gray-50/50">
                        <td className="py-4 px-6">
                          <p className="text-gray-900 font-bold">{req.first_name} {req.last_name}</p>
                          <p className="text-[10px] text-gray-400 uppercase">{req.login_id}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                            {req.leave_type_name}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs">
                          {req.start_date.split('T')[0]} to {req.end_date.split('T')[0]}
                        </td>
                        <td className="py-4 px-6 font-bold">{Number(req.total_days).toFixed(1)} Days</td>
                        <td className="py-4 px-6 space-y-1">
                          <p className="text-xs italic text-gray-500">{req.remarks || 'No remarks'}</p>
                          {req.attachment_url && (
                            <a
                              href={`http://localhost:5000${req.attachment_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                            >
                              <Paperclip size={10} />
                              <span>View Certificate Attachment</span>
                            </a>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {req.status === 'pending' ? (
                            <div className="flex flex-col space-y-2">
                              <input
                                type="text"
                                placeholder="Review comments..."
                                value={reviewComments[req.leave_request_id] || ''}
                                onChange={(e) =>
                                  setReviewComments({
                                    ...reviewComments,
                                    [req.leave_request_id]: e.target.value,
                                  })
                                }
                                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none w-full"
                              />
                              <div className="flex space-x-2 justify-center">
                                <button
                                  onClick={() => handleReviewRequest(req.leave_request_id, 'approved')}
                                  className="flex items-center space-x-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded text-xs font-bold hover:bg-green-100 transition"
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleReviewRequest(req.leave_request_id, 'rejected')}
                                  className="flex items-center space-x-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded text-xs font-bold hover:bg-red-100 transition"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  req.status === 'approved'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {req.status}
                              </span>
                              {req.reviewer_comments && (
                                <p className="text-[10px] text-gray-400 mt-1 italic">
                                  "{req.reviewer_comments}"
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {adminRequests.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400 italic">
                          No leave requests pending review
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Allocation Management Editor */
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Employee</th>
                      <th className="py-4 px-6">Leave Type</th>
                      <th className="py-4 px-6">Year</th>
                      <th className="py-4 px-6">Used Days</th>
                      <th className="py-4 px-6">Total Allocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {allocations.map((alloc) => (
                      <tr key={alloc.balance_id} className="hover:bg-gray-50/50">
                        <td className="py-4 px-6">
                          <p className="text-gray-900 font-bold">{alloc.first_name} {alloc.last_name}</p>
                          <p className="text-[10px] text-gray-400 uppercase">{alloc.login_id}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                            {alloc.leave_type_name}
                          </span>
                        </td>
                        <td className="py-4 px-6">{alloc.year}</td>
                        <td className="py-4 px-6">{Number(alloc.used_days).toFixed(1)} Days</td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            step="0.5"
                            defaultValue={Number(alloc.total_days)}
                            onBlur={(e) =>
                              handleAllocationUpdate(
                                alloc.user_id,
                                alloc.leave_type_id,
                                alloc.year,
                                Number(e.target.value)
                              )
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded font-semibold text-xs text-center focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Leave Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-gray-200 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-gray-900">Request Time Off</h2>
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

            <form onSubmit={handleApplyLeave} className="space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Apply on behalf of Employee
                  </label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  >
                    {employees.map((e: any) => (
                      <option key={e.user_id} value={e.user_id}>
                        {e.first_name} {e.last_name} ({e.login_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Time Off Type
                </label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.leave_type_id} value={lt.leave_type_id}>
                      {lt.name} {lt.requires_attachment ? '(Requires Document)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Total Requested Days (Supports e.g. 0.5 for half-days)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={totalDays}
                  onChange={(e) => setTotalDays(e.target.value)}
                  placeholder="e.g. 1.0 or 0.5"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center space-x-1">
                  <FileText size={12} />
                  <span>Document Attachment (Required for Sick Leave)</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm shadow-sm hover:bg-indigo-700 transition duration-200"
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
