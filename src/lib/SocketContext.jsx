import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { showLocalNotification } from './pushNotifications';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin;

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const token = localStorage.getItem('iqon_token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attempt) => {
      setIsConnected(true);
      console.info(`WebSocket reconnected after ${attempt} attempt(s)`);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnect error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('WebSocket reconnect failed after maximum attempts');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    newSocket.on('notification:new', (notification) => {
      console.log('New notification received via socket:', notification);
      showLocalNotification(
        notification.title || 'New Notification',
        notification.body || '',
        { link: notification.link, ...notification.metadata }
      );
    });

    setSocket(newSocket);

    // Force reconnection when browser comes back online
    const handleOnline = () => {
      if (newSocket && !newSocket.connected) {
        console.log('Device back online, reconnecting socket...');
        newSocket.connect();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      newSocket.disconnect();
    };
  }, [user]);

  const emit = (event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
    return () => {};
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, emit, on }}>
      {children}
    </SocketContext.Provider>
  );
};
