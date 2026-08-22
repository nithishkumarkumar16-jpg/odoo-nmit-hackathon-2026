import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { DollarSign, FileText, ChevronRight, Play, CheckCircle } from 'lucide-react';

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<any[]>([]);

  // Generation inputs
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payroll/payslips');
      setPayslips(res.data);
    } catch (err) {
      console.error('Failed to load payslips', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, []);

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenLoading(true);
    setGenMsg(null);
    try {
      const res = await api.post('/payroll/generate', {
        month: genMonth,
        year: genYear,
      });
      setGenMsg(res.data.message);
      fetchPayslips();
    } catch (err: any) {
      setGenMsg(err.response?.data?.error || 'Failed to generate payslips');
    } finally {
      setGenLoading(false);
    }
  };

  const getMonthName = (m: number) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[m - 1];
  };

  return (
    <div className="space-y-6">
      
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Payroll Engine</h2>
          <p className="text-xs text-gray-500 mt-1">Review monthly payslips, track deductions, and manage structures</p>
        </div>
      </div>

      {isAdmin && (
        /* Admin Generation Form block */
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Generate Monthly Payslips</h3>
          
          {genMsg && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-xs font-bold text-indigo-700">
              {genMsg}
            </div>
          )}

          <form onSubmit={handleGeneratePayroll} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Month
              </label>
              <select
                value={genMonth}
                onChange={(e) => setGenMonth(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none text-xs"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Year
              </label>
              <select
                value={genYear}
                onChange={(e) => setGenYear(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none text-xs"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={genLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm flex items-center space-x-1.5"
            >
              <Play size={12} className="fill-current" />
              <span>{genLoading ? 'Processing...' : 'Run Generation Cycle'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Payslips Record list */}
      <div className="space-y-4">
        <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Generated Payslip Records</h3>

        {loading ? (
          <div className="text-center py-10 font-medium text-gray-400 animate-pulse">
            Loading payroll files...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {payslips.map((slip) => (
              <div
                key={slip.payslip_id}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all duration-300 shadow-sm flex items-start space-x-4"
              >
                <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black">
                  {getMonthName(slip.month)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-gray-900">
                        {isAdmin ? `${slip.first_name} ${slip.last_name}` : `Payslip for ${getMonthName(slip.month)} ${slip.year}`}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                        Period: {slip.month}/{slip.year} • Hired Serial: {slip.login_id}
                      </p>
                    </div>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase">
                      Released
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 pt-3 border-t border-gray-100 text-xs font-semibold text-gray-500">
                    <span className="text-gray-400 font-medium">Payable Days:</span>
                    <span className="text-gray-800 text-right">{Number(slip.payable_days)} Days</span>

                    <span className="text-gray-400 font-medium">Gross Salary:</span>
                    <span className="text-gray-800 text-right">${Number(slip.gross_pay).toLocaleString()}</span>

                    <span className="text-gray-400 font-medium">PF Employee Contrib:</span>
                    <span className="text-red-600 text-right">-${Number(slip.pf_employee_amount).toLocaleString()}</span>

                    <span className="text-gray-400 font-medium">Professional Tax:</span>
                    <span className="text-red-600 text-right">-${Number(slip.professional_tax).toLocaleString()}</span>

                    <span className="text-gray-900 font-bold border-t border-gray-100 pt-1.5">Net Pay Check:</span>
                    <span className="text-indigo-600 font-black text-sm border-t border-gray-100 pt-1.5 text-right">
                      ${Number(slip.net_pay).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {payslips.length === 0 && (
              <div className="col-span-full bg-gray-50/50 border rounded-2xl p-10 text-center text-gray-400 italic">
                No payslip history has been recorded yet.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
