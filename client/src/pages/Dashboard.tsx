import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CircleDollarSign, Clock3, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface DashboardData {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  absentToday: number;
  attendancePercentage: number;
  currentMonthPayroll: {
    month: number;
    year: number;
    totalNetPay: number;
    totalGrossPay: number;
  };
}

interface ProfileData {
  header: {
    first_name: string;
    last_name: string;
  };
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const metricStyles = [
  { label: 'Total Employees', key: 'totalEmployees' as const, icon: Users, color: 'bg-indigo-50 text-indigo-600' },
  { label: 'Present Today', key: 'presentToday' as const, icon: Clock3, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'On Leave Today', key: 'onLeaveToday' as const, icon: CalendarDays, color: 'bg-amber-50 text-amber-600' },
  { label: 'Absent Today', key: 'absentToday' as const, icon: Users, color: 'bg-rose-50 text-rose-600' },
];

export const Dashboard: React.FC = () => {
  const { user, attendanceStatus } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        if (user?.role === 'admin') {
          const response = await api.get<DashboardData>('/analytics/dashboard');
          setDashboard(response.data);
        } else if (user) {
          const response = await api.get<ProfileData>(`/profile/${user.userId}`);
          setProfile(response.data);
        }
      } catch (err) {
        setError('We could not load your dashboard right now.');
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user]);

  if (loading) {
    return <div className="py-16 text-center text-sm font-semibold text-gray-500">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</div>;
  }

  if (user?.role === 'employee') {
    const firstName = profile?.header.first_name || 'there';
    const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

    return (
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gray-950 px-6 py-10 text-white shadow-xl sm:px-10">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Your Dayflow</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{greeting}, {firstName}.</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-gray-300">
              {attendanceStatus.checkedIn
                ? `You checked in at ${new Date(attendanceStatus.checkInTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Have a productive day.`
                : 'Your workday starts here. Keep your attendance and time off in one place.'}
            </p>
          </div>
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-indigo-500/30" />
          <div className="absolute -bottom-32 right-24 h-64 w-64 rounded-full border-[20px] border-emerald-400/20" />
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Quick access</p>
              <h2 className="mt-1 text-2xl font-black text-gray-950">Make today count</h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/time-off" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg">
              <CalendarDays className="text-indigo-600" size={24} />
              <h3 className="mt-6 text-lg font-extrabold text-gray-900">Request leave</h3>
              <p className="mt-2 text-sm text-gray-500">Plan time away and follow approval status.</p>
              <ArrowRight className="mt-5 text-gray-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" size={18} />
            </Link>
            <Link to="/payroll" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
              <Wallet className="text-emerald-600" size={24} />
              <h3 className="mt-6 text-lg font-extrabold text-gray-900">View payslips</h3>
              <p className="mt-2 text-sm text-gray-500">Review your salary details and monthly payslips.</p>
              <ArrowRight className="mt-5 text-gray-400 transition group-hover:translate-x-1 group-hover:text-emerald-600" size={18} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const circumference = 2 * Math.PI * 52;
  const progress = dashboard ? (dashboard.attendancePercentage / 100) * circumference : 0;
  const payrollMonth = dashboard ? new Date(dashboard.currentMonthPayroll.year, dashboard.currentMonthPayroll.month - 1).toLocaleString('en-IN', { month: 'long' }) : '';

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Company overview</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950">Good morning, {profile?.header.first_name || 'Admin'}.</h1>
          <p className="mt-2 text-gray-500">Here is what is happening across your workforce today.</p>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500">Live overview</span>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricStyles.map(({ label, key, icon: Icon, color }) => (
          <div key={key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={20} /></div>
            <p className="mt-6 text-sm font-semibold text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-black text-gray-950">{dashboard?.[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl bg-indigo-600 p-7 text-white shadow-lg shadow-indigo-200">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-200">Attendance pulse</p>
          <div className="mt-6 flex items-center gap-6">
            <div className="relative h-36 w-36 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-label={`${dashboard?.attendancePercentage || 0}% attendance`}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-indigo-400" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - progress} className="text-white transition-all duration-700" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-3xl font-black">{dashboard?.attendancePercentage || 0}%</span>
            </div>
            <div>
              <p className="text-xl font-extrabold">Team presence</p>
              <p className="mt-2 text-sm leading-6 text-indigo-100">{dashboard?.presentToday || 0} of {dashboard?.totalEmployees || 0} employees checked in today.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-600">Payroll snapshot</p>
              <h2 className="mt-2 text-2xl font-black text-gray-950">{payrollMonth} {dashboard?.currentMonthPayroll.year}</h2>
            </div>
            <CircleDollarSign className="text-emerald-500" size={28} />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-gray-400">Gross pay</p><p className="mt-2 text-xl font-black text-gray-950">{currency.format(dashboard?.currentMonthPayroll.totalGrossPay || 0)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Net pay</p><p className="mt-2 text-xl font-black text-emerald-700">{currency.format(dashboard?.currentMonthPayroll.totalNetPay || 0)}</p></div>
          </div>
        </section>
      </div>
    </div>
  );
};
