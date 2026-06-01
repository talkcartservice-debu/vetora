import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { showLocalNotification } from './pushNotifications';
import { notificationsAPI } from '@/api/apiClient';

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
  const lastNotificationTime = useRef(new Date().toISOString());

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
      checkForMissedNotifications();
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
      lastNotificationTime.current = notification.created_at || notification.created_date || new Date().toISOString();
      showLocalNotification(
        notification.title || 'New Notification',
        notification.body || '',
        { link: notification.link, ...notification.metadata }
      );
    });

newSocket.on('chat:new', (msg) => {
       console.log('New chat message received via socket:', msg);
       showLocalNotification(
         'New Message',
         msg.sender_name || msg.sender_username || 'Someone sent you a message',
         { link: `/Chat?username=${msg.sender_username}` }
       );
     });

     newSocket.on('call:incoming', (data) => {
       console.log('Incoming call received via socket:', data);
       showLocalNotification(
         'Incoming Call',
         data.caller_name || data.caller_username || 'Someone is calling you',
         { link: '/Chat', call_type: data.call_type }
       );
     });

     newSocket.on('call:answered', (data) => {
       console.log('Call answered:', data);
     });

     newSocket.on('call:rejected', (data) => {
       console.log('Call rejected:', data);
     });

     newSocket.on('call:ended', (data) => {
       console.log('Call ended:', data);
     });

    const checkForMissedNotifications = async () => {
      try {
        console.log('Checking for missed notifications since:', lastNotificationTime.current);
        const response = await notificationsAPI.list({
          limit: 10,
          since: lastNotificationTime.current,
          unread_only: 'true'
        });
        
        const missed = response.data || [];
        if (missed.length > 0) {
          console.log(`Found ${missed.length} missed notifications`);
          missed.forEach(notification => {
            showLocalNotification(
              notification.title || 'Missed Activity',
              notification.body || '',
              { link: notification.link, ...notification.metadata }
            );
          });
          // Update last time to the newest missed notification
          const latest = missed[0];
          lastNotificationTime.current = latest.created_at || latest.created_date || new Date().toISOString();
        }
      } catch (err) {
        console.error('Failed to fetch missed notifications:', err);
      }
    };

    setSocket(newSocket);

    // Force reconnection and check when browser comes back online
    const handleOnline = () => {
      if (newSocket && !newSocket.connected) {
        console.log('Device back online, reconnecting socket...');
        newSocket.connect();
      }
      checkForMissedNotifications();
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

  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, emit, on }}>
      {children}
    </SocketContext.Provider>
  );
};
