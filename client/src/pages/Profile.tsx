import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  User, Briefcase, Mail, MapPin, Tag, Award, Heart, Shield, Lock, CreditCard, DollarSign, Edit3, Save, Upload, Check
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'resume' | 'private' | 'salary' | 'security'>('resume');
  const [loading, setLoading] = useState(true);

  // Profile data state
  const [header, setHeader] = useState<any>({});
  const [resume, setResume] = useState<any>({});
  const [privateInfo, setPrivateInfo] = useState<any>({});
  const [salary, setSalary] = useState<any>({ structure: null, components: [] });
  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Edit Modes
  const [editResumeMode, setEditResumeMode] = useState(false);
  const [editPrivateMode, setEditPrivateMode] = useState(false);
  const [editSalaryMode, setEditSalaryMode] = useState(false);

  // Edit Forms
  const [aboutForm, setAboutForm] = useState('');
  const [jobHighlightsForm, setJobHighlightsForm] = useState('');
  const [skillsForm, setSkillsForm] = useState('');
  const [certsForm, setCertsForm] = useState('');
  const [interestsForm, setInterestsForm] = useState('');

  const [dobForm, setDobForm] = useState('');
  const [addressForm, setAddressForm] = useState('');
  const [nationalityForm, setNationalityForm] = useState('');
  const [genderForm, setGenderForm] = useState('');
  const [maritalForm, setMaritalForm] = useState('');
  const [emgNameForm, setEmgNameForm] = useState('');
  const [emgPhoneForm, setEmgPhoneForm] = useState('');
  const [bankNameForm, setBankNameForm] = useState('');
  const [bankAccForm, setBankAccForm] = useState('');
  const [bankIfscForm, setBankIfscForm] = useState('');
  const [panForm, setPanForm] = useState('');
  const [aadharForm, setAadharForm] = useState('');
  const [bloodForm, setBloodForm] = useState('');

  // Salary structures forms
  const [monthWage, setMonthWage] = useState<number>(0);
  const [workDaysWeek, setWorkDaysWeek] = useState<number>(5);
  const [shiftHours, setShiftHours] = useState<number>(8.0);
  const [breakHours, setBreakHours] = useState<number>(1.0);
  const [pfEmpRate, setPfEmpRate] = useState<number>(12.0);
  const [pfEmployerRate, setPfEmployerRate] = useState<number>(12.0);
  const [profTax, setProfTax] = useState<number>(200.0);

  // Security Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMsg, setSecurityMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Picture Upload
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/profile/${userId}`);
      setHeader(res.data.header);
      setResume(res.data.resume);
      setPrivateInfo(res.data.privateInfo);
      setCanEdit(res.data.canEdit);
      setIsOwner(res.data.isOwner);

      // Pre-fill Forms
      setAboutForm(res.data.resume.about || '');
      setJobHighlightsForm(res.data.resume.job_highlights || '');
      setSkillsForm(res.data.resume.skills?.join(', ') || '');
      setCertsForm(res.data.resume.certifications?.join(', ') || '');
      setInterestsForm(res.data.resume.interests?.join(', ') || '');

      setDobForm(res.data.privateInfo.date_of_birth ? res.data.privateInfo.date_of_birth.split('T')[0] : '');
      setAddressForm(res.data.privateInfo.residing_address || '');
      setNationalityForm(res.data.privateInfo.nationality || '');
      setGenderForm(res.data.privateInfo.gender || '');
      setMaritalForm(res.data.privateInfo.marital_status || '');
      setEmgNameForm(res.data.privateInfo.emergency_contact_name || '');
      setEmgPhoneForm(res.data.privateInfo.emergency_contact_phone || '');
      setBankNameForm(res.data.privateInfo.bank_name || '');
      setBankAccForm(res.data.privateInfo.bank_account_number || '');
      setBankIfscForm(res.data.privateInfo.bank_ifsc || '');
      setPanForm(res.data.privateInfo.pan_number || '');
      setAadharForm(res.data.privateInfo.aadhar_number || '');
      setBloodForm(res.data.privateInfo.blood_group || '');

      // Load Salary Structure if admin (or owner)
      if (currentUser?.role === 'admin') {
        const salRes = await api.get(`/payroll/structure/${userId}`);
        setSalary(salRes.data);
        if (salRes.data.structure) {
          setMonthWage(Number(salRes.data.structure.month_wage));
          setWorkDaysWeek(Number(salRes.data.structure.working_days_per_week));
          setShiftHours(Number(salRes.data.structure.standard_shift_hours));
          setBreakHours(Number(salRes.data.structure.break_time_hours));
          setPfEmpRate(Number(salRes.data.structure.pf_employee_rate));
          setPfEmployerRate(Number(salRes.data.structure.pf_employer_rate));
          setProfTax(Number(salRes.data.structure.professional_tax));
        }
      }
    } catch (err) {
      console.error('Failed to load profile details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handleUpdateResume = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/profile/${userId}/resume`, {
        about: aboutForm,
        jobHighlights: jobHighlightsForm,
        skills: skillsForm.split(',').map((s) => s.trim()).filter(Boolean),
        certifications: certsForm.split(',').map((c) => c.trim()).filter(Boolean),
        interests: interestsForm.split(',').map((i) => i.trim()).filter(Boolean),
      });
      setEditResumeMode(false);
      fetchProfile();
    } catch (err) {
      console.error('Failed to update resume', err);
    }
  };

  const handleUpdatePrivate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/profile/${userId}/private-info`, {
        dateOfBirth: dobForm || null,
        residingAddress: addressForm,
        nationality: nationalityForm,
        gender: genderForm,
        maritalStatus: maritalForm,
        emergencyContactName: emgNameForm,
        emergencyContactPhone: emgPhoneForm,
        bankName: bankNameForm,
        bankAccountNumber: bankAccForm.includes('*') ? undefined : bankAccForm, // Only send if edited
        bankIfsc: bankIfscForm,
        panNumber: panForm.includes('*') ? undefined : panForm,
        aadharNumber: aadharForm.includes('*') ? undefined : aadharForm,
        bloodGroup: bloodForm,
      });
      setEditPrivateMode(false);
      fetchProfile();
    } catch (err) {
      console.error('Failed to update private info', err);
    }
  };

  // Salary Components Recomputation invariant visualization logic!
  const getRecalculatedComponents = () => {
    const wage = Number(monthWage) || 0;
    const basic = wage * 0.5;
    const hra = basic * 0.4;
    const stdAllow = 2000;
    const bonus = 3000;
    const nonFixedTotal = basic + hra + stdAllow + bonus;
    const remainder = Math.max(wage - nonFixedTotal, 0);

    return [
      { name: 'Basic Salary (50% of Wage)', amount: basic },
      { name: 'House Rent Allowance (40% of Basic)', amount: hra },
      { name: 'Standard Allowance', amount: stdAllow },
      { name: 'Performance Bonus', amount: bonus },
      { name: 'Fixed Allowance (Absorbs remainder)', amount: remainder },
    ];
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payroll/structure', {
        userId,
        monthWage,
        workingDaysPerWeek: workDaysWeek,
        standardShiftHours: shiftHours,
        breakTimeHours: breakHours,
        pfEmployeeRate: pfEmpRate,
        pfEmployerRate: pfEmployerRate,
        professionalTax: profTax,
      });
      setEditSalaryMode(false);
      fetchProfile();
    } catch (err) {
      console.error('Failed to save salary structure', err);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg(null);

    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setSecurityMsg({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setSecurityMsg({ type: 'error', text: err.response?.data?.error || 'Password update failed' });
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadMsg('Uploading...');
    const formData = new FormData();
    formData.append('picture', e.target.files[0]);

    try {
      const res = await api.post('/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadMsg('Uploaded successfully!');
      fetchProfile();
      setTimeout(() => setUploadMsg(null), 3000);
    } catch (err) {
      setUploadMsg('Upload failed');
      setTimeout(() => setUploadMsg(null), 3000);
    }
  };

  if (loading) {
    return <div className="text-center py-10 font-medium text-gray-500">Loading Profile Details...</div>;
  }

  return (
    <div className="space-y-6">
      
      {/* Profile Header Block */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-sm">
        
        {/* Profile Pic Upload */}
        <div className="relative group">
          <div className="w-28 h-28 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-4xl overflow-hidden">
            {header.profile_picture_url ? (
              <img
                src={`http://localhost:5000${header.profile_picture_url}`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{header.first_name[0]}{header.last_name[0]}</span>
            )}
          </div>
          {isOwner && (
            <label className="absolute inset-0 bg-black/40 text-white rounded-2xl flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition duration-200">
              <Upload size={18} />
              <span className="text-[10px] font-bold mt-1 uppercase">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePictureUpload} />
            </label>
          )}
        </div>

        <div className="space-y-4 text-center md:text-left flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center md:justify-start">
            <h1 className="text-2xl font-extrabold text-gray-900 leading-none">
              {header.first_name} {header.last_name}
            </h1>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold tracking-wide uppercase max-w-max self-center">
              ID: {header.login_id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm text-gray-500 font-semibold">
            <p className="flex items-center justify-center md:justify-start space-x-1">
              <Briefcase size={14} className="text-gray-400" />
              <span>{header.designation || 'Staff'}</span>
            </p>
            <p className="flex items-center justify-center md:justify-start space-x-1">
              <Mail size={14} className="text-gray-400" />
              <span className="truncate">{header.email}</span>
            </p>
            <p className="flex items-center justify-center md:justify-start space-x-1">
              <MapPin size={14} className="text-gray-400" />
              <span>{header.location || 'Gandhinagar'}</span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start text-xs font-bold text-gray-700">
            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
              Dept: {header.department_name || 'N/A'}
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
              Manager: {header.manager_name || 'Marc Admin'}
            </span>
          </div>

          {uploadMsg && <p className="text-xs text-indigo-600 font-bold">{uploadMsg}</p>}
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('resume')}
          className={`pb-3 text-sm font-bold border-b-2 mr-6 transition duration-200 ${
            activeTab === 'resume' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Resume
        </button>
        <button
          onClick={() => setActiveTab('private')}
          className={`pb-3 text-sm font-bold border-b-2 mr-6 transition duration-200 ${
            activeTab === 'private' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Private Info
        </button>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('salary')}
            className={`pb-3 text-sm font-bold border-b-2 mr-6 transition duration-200 ${
              activeTab === 'salary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Salary Structure
          </button>
        )}
        {isOwner && (
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 text-sm font-bold border-b-2 transition duration-200 ${
              activeTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Security & Password
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
        
        {/* RESUME TAB PANEL */}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-gray-900">Career Resume</h2>
              {canEdit && !editResumeMode && (
                <button
                  onClick={() => setEditResumeMode(true)}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <Edit3 size={14} />
                  <span>Edit Resume</span>
                </button>
              )}
            </div>

            {editResumeMode ? (
              <form onSubmit={handleUpdateResume} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    About Me
                  </label>
                  <textarea
                    rows={4}
                    value={aboutForm}
                    onChange={(e) => setAboutForm(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    What I love about my job / Highlights
                  </label>
                  <textarea
                    rows={3}
                    value={jobHighlightsForm}
                    onChange={(e) => setJobHighlightsForm(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Skills (Comma separated)
                    </label>
                    <input
                      type="text"
                      value={skillsForm}
                      onChange={(e) => setSkillsForm(e.target.value)}
                      placeholder="e.g. React, Node.js"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Certifications
                    </label>
                    <input
                      type="text"
                      value={certsForm}
                      onChange={(e) => setCertsForm(e.target.value)}
                      placeholder="e.g. AWS Solution Architect"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Interests / Hobbies
                    </label>
                    <input
                      type="text"
                      value={interestsForm}
                      onChange={(e) => setInterestsForm(e.target.value)}
                      placeholder="e.g. Hiking, Reading"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-1"
                  >
                    <Save size={14} />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditResumeMode(false)}
                    className="border border-gray-300 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    {resume.about || 'No information added.'}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                    What I love about my job
                  </h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    {resume.job_highlights || 'No highlights added.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                      <Tag size={13} />
                      <span>Skills & Core competencies</span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {resume.skills?.length > 0 ? (
                        resume.skills.map((skill: string) => (
                          <span key={skill} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-semibold">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">None listed</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                      <Award size={13} />
                      <span>Certifications</span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {resume.certifications?.length > 0 ? (
                        resume.certifications.map((cert: string) => (
                          <span key={cert} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-semibold">
                            {cert}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">None listed</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                      <Heart size={13} />
                      <span>Interests & Hobbies</span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {resume.interests?.length > 0 ? (
                        resume.interests.map((hobby: string) => (
                          <span key={hobby} className="text-xs bg-pink-50 text-pink-700 px-2.5 py-1 rounded-lg font-semibold">
                            {hobby}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">None listed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRIVATE INFO TAB PANEL */}
        {activeTab === 'private' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-gray-900">Personal & Private Information</h2>
              {canEdit && !editPrivateMode && (
                <button
                  onClick={() => setEditPrivateMode(true)}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <Edit3 size={14} />
                  <span>Edit Private Info</span>
                </button>
              )}
            </div>

            {editPrivateMode ? (
              <form onSubmit={handleUpdatePrivate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={dobForm}
                      onChange={(e) => setDobForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Gender
                    </label>
                    <input
                      type="text"
                      value={genderForm}
                      onChange={(e) => setGenderForm(e.target.value)}
                      placeholder="e.g. Male"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Marital Status
                    </label>
                    <input
                      type="text"
                      value={maritalForm}
                      onChange={(e) => setMaritalForm(e.target.value)}
                      placeholder="e.g. Single"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Residing Address
                  </label>
                  <input
                    type="text"
                    value={addressForm}
                    onChange={(e) => setAddressForm(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Nationality
                    </label>
                    <input
                      type="text"
                      value={nationalityForm}
                      onChange={(e) => setNationalityForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={emgNameForm}
                      onChange={(e) => setEmgNameForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="text"
                      value={emgPhoneForm}
                      onChange={(e) => setEmgPhoneForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankNameForm}
                      onChange={(e) => setBankNameForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Bank Account Number (Encrypted)
                    </label>
                    <input
                      type="text"
                      value={bankAccForm}
                      onChange={(e) => setBankAccForm(e.target.value)}
                      placeholder="Leave unchanged or enter new"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Bank IFSC
                    </label>
                    <input
                      type="text"
                      value={bankIfscForm}
                      onChange={(e) => setBankIfscForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      PAN Number (Encrypted)
                    </label>
                    <input
                      type="text"
                      value={panForm}
                      onChange={(e) => setPanForm(e.target.value)}
                      placeholder="Leave unchanged or enter new"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Aadhar Number (Encrypted)
                    </label>
                    <input
                      type="text"
                      value={aadharForm}
                      onChange={(e) => setAadharForm(e.target.value)}
                      placeholder="Leave unchanged or enter new"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Blood Group
                    </label>
                    <input
                      type="text"
                      value={bloodForm}
                      onChange={(e) => setBloodForm(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-1"
                  >
                    <Save size={14} />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPrivateMode(false)}
                    className="border border-gray-300 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">General Information</h3>
                  <div className="grid grid-cols-2 gap-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-100 font-medium">
                    <span className="text-gray-400">Date of Birth:</span>
                    <span className="text-gray-800">{privateInfo.date_of_birth || 'N/A'}</span>
                    
                    <span className="text-gray-400">Gender:</span>
                    <span className="text-gray-800">{privateInfo.gender || 'N/A'}</span>

                    <span className="text-gray-400">Marital Status:</span>
                    <span className="text-gray-800">{privateInfo.marital_status || 'N/A'}</span>

                    <span className="text-gray-400">Address:</span>
                    <span className="text-gray-800 truncate">{privateInfo.residing_address || 'N/A'}</span>

                    <span className="text-gray-400">Nationality:</span>
                    <span className="text-gray-800">{privateInfo.nationality || 'N/A'}</span>

                    <span className="text-gray-400">Blood Group:</span>
                    <span className="text-gray-800">{privateInfo.blood_group || 'N/A'}</span>
                  </div>

                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Emergency Contact</h3>
                  <div className="grid grid-cols-2 gap-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-100 font-medium">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-gray-800">{privateInfo.emergency_contact_name || 'N/A'}</span>

                    <span className="text-gray-400">Phone Number:</span>
                    <span className="text-gray-800">{privateInfo.emergency_contact_phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Financial & Government Info</h3>
                  <div className="grid grid-cols-2 gap-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-100 font-semibold font-mono">
                    <span className="text-gray-400 font-sans font-medium">Bank Name:</span>
                    <span className="text-gray-800 font-sans font-bold">{privateInfo.bank_name || 'N/A'}</span>

                    <span className="text-gray-400 font-sans font-medium">Account No:</span>
                    <span className="text-gray-800">{privateInfo.bank_account_number || 'N/A'}</span>

                    <span className="text-gray-400 font-sans font-medium">IFSC Code:</span>
                    <span className="text-gray-800">{privateInfo.bank_ifsc || 'N/A'}</span>

                    <span className="text-gray-400 font-sans font-medium">PAN Number:</span>
                    <span className="text-gray-800">{privateInfo.pan_number || 'N/A'}</span>

                    <span className="text-gray-400 font-sans font-medium">Aadhar Number:</span>
                    <span className="text-gray-800">{privateInfo.aadhar_number || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SALARY STRUCTURE TAB PANEL */}
        {activeTab === 'salary' && currentUser?.role === 'admin' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-gray-900">Compensation & Working Schedule</h2>
              {!editSalaryMode && (
                <button
                  onClick={() => setEditSalaryMode(true)}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <Edit3 size={14} />
                  <span>Configure Salary Structure</span>
                </button>
              )}
            </div>

            {editSalaryMode ? (
              <form onSubmit={handleSaveSalary} className="space-y-6">
                
                {/* Structure Form inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Salary Configuration</h3>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Monthly Wage
                      </label>
                      <input
                        type="number"
                        required
                        value={monthWage}
                        onChange={(e) => setMonthWage(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        Yearly Value: ${(monthWage * 12).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          PF Employee rate (%)
                        </label>
                        <input
                          type="number"
                          value={pfEmpRate}
                          onChange={(e) => setPfEmpRate(Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          PF Employer rate (%)
                        </label>
                        <input
                          type="number"
                          value={pfEmployerRate}
                          onChange={(e) => setPfEmployerRate(Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Professional Tax (Fixed)
                      </label>
                      <input
                        type="number"
                        value={profTax}
                        onChange={(e) => setProfTax(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Work Schedule Configuration</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Days/Week
                        </label>
                        <input
                          type="number"
                          value={workDaysWeek}
                          onChange={(e) => setWorkDaysWeek(Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Shift Hours
                        </label>
                        <input
                          type="number"
                          value={shiftHours}
                          onChange={(e) => setShiftHours(Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Break Hours
                        </label>
                        <input
                          type="number"
                          value={breakHours}
                          onChange={(e) => setBreakHours(Number(e.target.value))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* LIVE COMPONENT RECALCULATION MATH BOX */}
                    <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl space-y-3">
                      <h4 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider flex items-center space-x-1">
                        <Check size={14} />
                        <span>Live Calculation Preview</span>
                      </h4>
                      <div className="text-xs text-indigo-900 space-y-2">
                        {getRecalculatedComponents().map((c) => (
                          <div key={c.name} className="flex justify-between font-semibold">
                            <span>{c.name}:</span>
                            <span>${c.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="border-t border-indigo-200 pt-2 flex justify-between font-extrabold text-sm">
                          <span>Total Month Wage:</span>
                          <span>${monthWage.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-1"
                  >
                    <Save size={14} />
                    <span>Save structure</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSalaryMode(false)}
                    className="border border-gray-300 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">Core Structure Info</h3>
                  <div className="grid grid-cols-2 gap-y-3 bg-gray-50 p-5 rounded-2xl border border-gray-100 font-medium">
                    <span className="text-gray-400">Monthly Wage:</span>
                    <span className="text-gray-800 font-bold">${Number(salary.structure?.month_wage || 0).toLocaleString()}</span>
                    
                    <span className="text-gray-400">Yearly Wage:</span>
                    <span className="text-gray-800 font-bold">${Number(salary.structure?.yearly_wage || 0).toLocaleString()}</span>

                    <span className="text-gray-400">Working days/week:</span>
                    <span className="text-gray-800">{salary.structure?.working_days_per_week || 5} days</span>

                    <span className="text-gray-400">Shift duration:</span>
                    <span className="text-gray-800">{salary.structure?.standard_shift_hours || 8} hrs</span>

                    <span className="text-gray-400">Break duration:</span>
                    <span className="text-gray-800">{salary.structure?.break_time_hours || 1} hr</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">Salary Components Breakdown</h3>
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-2.5 font-semibold">
                    {salary.components.map((c: any) => (
                      <div key={c.component_id} className="flex justify-between text-gray-700">
                        <span className="font-medium text-gray-500">{c.component_name}</span>
                        <span>${Number(c.computed_amount).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-2 flex justify-between text-indigo-700 font-extrabold">
                      <span>Total Sum:</span>
                      <span>${Number(salary.structure?.month_wage || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECURITY TAB PANEL */}
        {activeTab === 'security' && isOwner && (
          <div className="space-y-6">
            <h2 className="text-lg font-extrabold text-gray-900">Security Configuration</h2>
            
            {securityMsg && (
              <div
                className={`p-4 text-xs font-bold rounded border-l-4 ${
                  securityMsg.type === 'success'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-red-50 border-red-500 text-red-700'
                }`}
              >
                {securityMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="max-w-md space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none text-sm"
                />
              </div>

              <button
                type="submit"
                className="bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center space-x-1 shadow-sm"
              >
                <Lock size={14} />
                <span>Save New Password</span>
              </button>
            </form>
          </div>
        )}

      </div>

    </div>
  );
};
