import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      
      const token = authAPI.initialize();
      
      if (token) {
        await checkUserAuth();
      } else {
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await authAPI.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoadingAuth(true);
      const data = await authAPI.login(email, password);
      
      if (data.two_factor_required) {
        setIsLoadingAuth(false);
        return data; // Return to handle in UI
      }

      setUser(data.user);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      return data;
    } catch (error) {
      setIsLoadingAuth(false);
      throw error;
    }
  };

  const verify2FA = async (twoFactorToken, token) => {
    try {
      setIsLoadingAuth(true);
      const data = await authAPI.verify2FALogin(twoFactorToken, token);
      setUser(data.user);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      return data;
    } catch (error) {
      setIsLoadingAuth(false);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      setIsLoadingAuth(true);
      const data = await authAPI.register(userData);
      setUser(data.user);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      return data;
    } catch (error) {
      setIsLoadingAuth(false);
      throw error;
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      login,
      verify2FA,
      register,
      logout,
      navigateToLogin,
      checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
