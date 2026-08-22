import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { LogIn, UserPlus, Building, Mail, Lock, User, Phone, Check } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sign In Form States
  const [signInId, setSignInId] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up Form States
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/signin', {
        loginIdentifier: signInId.trim(),
        password: signInPassword,
      });
      login(res.data.user, res.data.tokens);
      if (res.data.user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      if (err.response?.data?.details) {
        const detailsMsg = err.response.data.details.map((d: any) => d.message).join(', ');
        setError(`Validation failed: ${detailsMsg}`);
      } else {
        setError(err.response?.data?.error || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signUpPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/signup', {
        companyName,
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        password: signUpPassword,
        confirmPassword,
      });
      login(res.data.user, res.data.tokens);
      navigate('/');
    } catch (err: any) {
      if (err.response?.data?.details) {
        const detailsMsg = err.response.data.details.map((d: any) => d.message).join(', ');
        setError(`Validation failed: ${detailsMsg}`);
      } else {
        setError(err.response?.data?.error || 'Failed to onboard company');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white border border-gray-200 p-10 rounded-2xl shadow-sm">
        
        {/* Header Branding */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-sm">
            DF
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isSignUp ? 'Create a workspace' : 'Welcome to Dayflow'}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {isSignUp ? 'Onboard your company and first admin user' : 'Log in to access your HRMS dashboard'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 text-xs font-semibold rounded-r-lg">
            {error}
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setIsSignUp(false); setError(null); }}
            className={`w-1/2 pb-3 text-sm font-bold border-b-2 transition-all duration-200 ${
              !isSignUp ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(null); }}
            className={`w-1/2 pb-3 text-sm font-bold border-b-2 transition-all duration-200 ${
              isSignUp ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Register Workspace
          </button>
        </div>

        {!isSignUp ? (
          /* Sign In Form */
          <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Login ID / Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={signInId}
                    onChange={(e) => setSignInId(e.target.value)}
                    placeholder="Enter Login ID or Email"
                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition duration-200 flex items-center justify-center space-x-2"
            >
              <LogIn size={16} />
              <span>{loading ? 'Logging in...' : 'Sign In'}</span>
            </button>
          </form>
        ) : (
          /* Sign Up (Company Onboarding) Form */
          <form className="mt-8 space-y-4" onSubmit={handleSignUp}>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Company Name
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Odoo India"
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Full Name (Admin)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="John Doe"
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••"
                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Confirm
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition duration-200 flex items-center justify-center space-x-2 mt-4"
            >
              <UserPlus size={16} />
              <span>{loading ? 'Creating...' : 'Register Workspace'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
