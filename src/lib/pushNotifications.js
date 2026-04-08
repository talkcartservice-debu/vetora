import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { usersAPI } from '@/api/apiClient';

export const setupPushNotifications = async () => {
  // Try web notifications if not on native platform
  if (!Capacitor.isNativePlatform()) {
    console.log('Native push notifications not available on web, attempting web notifications...');
    return setupWebNotifications();
  }

  try {
    // Request permission to use push notifications
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('User denied permissions!');
      return;
    }

    // Register with Apple / Google to receive push via APNS/FCM
    await PushNotifications.register();

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      try {
        await usersAPI.registerPushToken(token.value);
      } catch (err) {
        console.error('Failed to register push token with backend', err);
      }
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
      // In-app alert or notification list update could happen here
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
      const data = notification.notification.data;
      if (data && data.link) {
        window.location.href = data.link;
      }
    });

  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
};

export const removePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('Error removing push notification listeners:', error);
  }
};

export const setupWebNotifications = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('This browser does not support desktop notifications');
    return;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission === 'granted') {
      console.log('Web notification permission granted');
    } else {
      console.log('Web notification permission:', permission);
    }
  } catch (err) {
    console.error('Error requesting web notification permission:', err);
  }
};
