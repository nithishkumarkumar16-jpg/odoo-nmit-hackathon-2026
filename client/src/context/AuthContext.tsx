import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import io, { Socket } from 'socket.io-client';

interface User {
  userId: string;
  companyId: string;
  companyName: string;
  loginId: string;
  email: string;
  role: 'admin' | 'employee';
  mustChangePassword: boolean;
}

interface AttendanceStatus {
  checkedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  workHours: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  attendanceStatus: AttendanceStatus;
  login: (userData: any, tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  updateUserPasswordFlag: (mustChange: boolean) => void;
  refreshAttendance: () => Promise<void>;
  socket: Socket | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    checkedIn: false,
    checkInTime: null,
    checkOutTime: null,
    workHours: null,
  });

  const login = (userData: any, tokens: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const refreshAttendance = async () => {
    if (!user) return;
    try {
      const res = await api.get('/attendance/status');
      setAttendanceStatus(res.data);
    } catch (err) {
      console.error('Failed to get attendance status', err);
    }
  };

  const checkIn = async () => {
    try {
      const res = await api.post('/attendance/check-in');
      await refreshAttendance();
      // Emitting through socket for real-time presence indicators
      if (socket && user) {
        socket.emit('attendance_update', { userId: user.userId, status: 'present' });
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to check in');
    }
  };

  const checkOut = async () => {
    try {
      await api.post('/attendance/check-out');
      await refreshAttendance();
      if (socket && user) {
        socket.emit('attendance_update', { userId: user.userId, status: 'absent' });
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to check out');
    }
  };

  const updateUserPasswordFlag = (mustChange: boolean) => {
    if (user) {
      const updated = { ...user, mustChangePassword: mustChange };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    }
  };

  // Load user from localstorage on startup
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  // Initialize WebSockets and attendance when user logs in
  useEffect(() => {
    if (user) {
      refreshAttendance();

      const newSocket = io('http://localhost:5000');
      newSocket.emit('join_company', user.companyId);
      newSocket.emit('join_user', user.userId);

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        attendanceStatus,
        login,
        logout,
        checkIn,
        checkOut,
        updateUserPasswordFlag,
        refreshAttendance,
        socket,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
