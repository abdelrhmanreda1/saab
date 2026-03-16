/**
 * Browser notification utilities for chat and orders
 */

// Audio elements for notification sounds
let notificationAudio: HTMLAudioElement | null = null;
let orderAudio: HTMLAudioElement | null = null;

const getNotificationAudio = (): HTMLAudioElement => {
  if (!notificationAudio) {
    notificationAudio = new Audio('/audio/notification.wav');
    notificationAudio.volume = 0.7; // Set volume to 70%
  }
  return notificationAudio;
};

const getOrderAudio = (): HTMLAudioElement => {
  if (!orderAudio) {
    orderAudio = new Audio('/audio/order.wav');
    orderAudio.volume = 0.7; // Set volume to 70%
  }
  return orderAudio;
};

export const playOrderSound = (): void => {
  try {
    const audio = getOrderAudio();
    audio.currentTime = 0; // Reset to start
    audio.play().catch((error) => {
      // Ignore audio play errors (e.g., user interaction required)
      console.log('Could not play order sound:', error);
    });
  } catch (error) {
    // Ignore audio errors
    console.log('Audio error:', error);
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const showChatNotification = (
  title: string,
  message: string,
  icon?: string
): void => {
  // Play notification sound (always play, even if page is visible)
  try {
    const audio = getNotificationAudio();
    audio.currentTime = 0; // Reset to start
    audio.play().catch((error) => {
      // Ignore audio play errors (e.g., user interaction required)
      console.log('Could not play notification sound:', error);
    });
  } catch (error) {
    // Ignore audio errors
    console.log('Audio error:', error);
  }

  // Show browser notification only if permission is granted
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  // Don't show browser notification if page is visible (user is viewing the page)
  // But sound will still play
  if (document.visibilityState === 'visible') {
    return;
  }

  const notification = new Notification(title, {
    body: message,
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'chat-message', // Use tag to replace previous notifications
    requireInteraction: false,
  });

  // Auto close after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);

  // Handle click to focus window
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

