'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app, db, storage } from '@/lib/firebase';
import { getUserChatSession, createChatSession, addChatMessage, updateChatSession, getChatSession } from '@/lib/firestore/notifications_db';
import { ChatSession } from '@/lib/firestore/notifications';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { getUserProfile } from '@/lib/firestore/users';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { requestNotificationPermission, showChatNotification } from '@/lib/utils/notifications';
import Image from 'next/image';
import Dialog from './ui/Dialog';

const LiveChat: React.FC = () => {
  const { t } = useLanguage();
  const { demoUser } = useAuth();
  const { settings } = useSettings();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [, setGuestSessionId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageTimestampRef = useRef<number>(0);
  // const router = useRouter(); // Currently unused but may be needed for future navigation
  const auth = getAuth(app);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Allow external trigger (e.g., header mobile menu) to open chat
  useEffect(() => {
    const handleOpenChat = () => {
      const isLoggedIn = user || (settings?.demoMode && demoUser);
      if (!isLoggedIn && !session) {
        // Show guest form if no user and no session
        setShowGuestForm(true);
        setIsOpen(true);
      } else {
        setIsOpen(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('open-live-chat', handleOpenChat);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('open-live-chat', handleOpenChat);
      }
    };
  }, [user, settings?.demoMode, demoUser, session]);

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      // Only load existing session, don't create new one
      const loadDemoChatSession = async () => {
        try {
          const chatSession = await getUserChatSession(demoUser.uid);
          if (chatSession) {
            setSession(chatSession);
            // Set initial timestamp
            if (chatSession.messages && chatSession.messages.length > 0) {
              const lastMsg = chatSession.messages[chatSession.messages.length - 1];
              if (lastMsg.createdAt) {
                lastMessageTimestampRef.current = lastMsg.createdAt.toMillis();
              }
            }
          }
        } catch {
          // Failed to load chat session
        }
        setLoading(false);
      };
      loadDemoChatSession();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Only load existing session, don't create new one
          const chatSession = await getUserChatSession(currentUser.uid);
          if (chatSession) {
            setSession(chatSession);
            // Set initial timestamp
            if (chatSession.messages && chatSession.messages.length > 0) {
              const lastMsg = chatSession.messages[chatSession.messages.length - 1];
              if (lastMsg.createdAt) {
                lastMessageTimestampRef.current = lastMsg.createdAt.toMillis();
              }
            }
          }
        } catch {
          // Failed to load chat session
        }
      } else {
        setUser(null);
        // Check if there's a guest session in localStorage
        const savedGuestSessionId = localStorage.getItem('guestChatSessionId');
        if (savedGuestSessionId) {
          try {
            const guestSession = await getChatSession(savedGuestSessionId);
            if (guestSession) {
              setSession(guestSession);
              setGuestSessionId(savedGuestSessionId);
            }
          } catch {
            // Failed to load guest session
            localStorage.removeItem('guestChatSessionId');
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, settings?.demoMode, demoUser]);

  // Real-time listener for chat session updates
  useEffect(() => {
    if (!session?.id || !isOpen) return;

    // Set up real-time listener for chat session
    const sessionDocRef = doc(db, 'chat_sessions', session.id);
    const unsubscribe: Unsubscribe = onSnapshot(
      sessionDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const updatedSession = { id: snapshot.id, ...snapshot.data() } as ChatSession;
          const previousSession = session;
          
          // Check for new admin messages and show notification
          if (updatedSession.messages && previousSession?.messages) {
            const newMessages = updatedSession.messages.filter((msg, idx) => {
              if (idx >= previousSession.messages.length) {
                // New message
                return msg.isAdmin && !msg.read;
              }
              return false;
            });

            // Show notification for new admin messages if chat is not open or page is not visible
            newMessages.forEach((msg) => {
              if (msg.isAdmin && msg.createdAt) {
                const msgTimestamp = msg.createdAt.toMillis();
                if (msgTimestamp > lastMessageTimestampRef.current) {
                  lastMessageTimestampRef.current = msgTimestamp;
                  
                  // Only show notification if chat window is closed or page is not visible
                  if (!isOpen || document.visibilityState !== 'visible') {
                    showChatNotification(
                      msg.adminName || 'Support Team',
                      msg.message || 'New message',
                      '/favicon.ico'
                    );
                  }
                }
              }
            });
          } else if (updatedSession.messages && updatedSession.messages.length > 0) {
            // First time loading messages
            const lastMsg = updatedSession.messages[updatedSession.messages.length - 1];
            if (lastMsg.createdAt) {
              lastMessageTimestampRef.current = lastMsg.createdAt.toMillis();
            }
          }
          
          setSession(updatedSession);
        }
      },
      (error) => {
        // Handle permission errors gracefully (e.g., on logout)
        if (error.code === 'permission-denied') {
          // User logged out or lost access, cleanup
          setSession(null);
        }
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, isOpen]);

  // Handle guest name submission - just store name, don't create session yet
  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    // Just close the form, session will be created when first message is sent
    setShowGuestForm(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // Load products when chat opens
  useEffect(() => {
    if (isOpen && session) {
      loadProducts();
    }
  }, [isOpen, session]);

  const loadProducts = async () => {
    try {
      const allProducts = await getAllProducts();
      setProducts(allProducts);
    } catch {
      // Failed to load products
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedImages(prev => [...prev, ...files]);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && selectedImages.length === 0 && !selectedProduct) return;

    setSending(true);
    try {
      let currentSession = session;
      
      // Create session on first message if it doesn't exist
      if (!currentSession) {
        const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        const userName = user?.displayName || (settings?.demoMode && demoUser ? demoUser.displayName || demoUser.phoneNumber : guestName.trim()) || 'Guest';
        const userEmail = user?.email || undefined;
        const userProfile = user?.uid ? await getUserProfile(user.uid) : (settings?.demoMode && demoUser ? await getUserProfile(demoUser.uid) : null);
        const userPhone = userProfile?.phoneNumber || (settings?.demoMode && demoUser ? demoUser.phoneNumber : undefined);

        const newSessionId = await createChatSession({
          userId,
          userName,
          userEmail,
          userPhone,
          status: 'active', // Set to active immediately as message is being sent
          isGuest: !user && !(settings?.demoMode && demoUser),
        });
        currentSession = await getChatSession(newSessionId);
        if (currentSession && currentSession.isGuest) {
          localStorage.setItem('guestChatSessionId', newSessionId);
        }
        setSession(currentSession);
      }

      if (!currentSession || !currentSession.id) {
        throw new Error('Session ID is missing');
      }

      const userName = user 
        ? (user.displayName || user.email || 'User')
        : (currentSession.userName || 'Guest');
      
      let imageUrls: string[] = [];
      
      // Upload images
      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(async (file) => {
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `chat/${currentSession.id}/${Date.now()}_${sanitizedFileName}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, file);
          return getDownloadURL(storageRef);
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      await addChatMessage(currentSession.id, {
        userId: user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : currentSession.userId),
        userName: userName,
        message: message.trim() || (selectedProduct ? `${t('chat.interested_in_prefix') || "I'm interested in:"} ${selectedProduct.name}` : ''),
        isAdmin: false,
        read: false,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        productId: selectedProduct?.id,
        productName: selectedProduct?.name,
        productImage: selectedProduct?.images?.[0],
        productUrl: selectedProduct ? `/products/${selectedProduct.slug}` : undefined,
      });
      
      setMessage('');
      setSelectedImages([]);
      setImagePreviews([]);
      setSelectedProduct(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Update session status to active if it was waiting
      if (currentSession.status === 'waiting') {
        await updateChatSession(currentSession.id, { status: 'active' });
      }
      
      // Refresh session - use getChatSession to get the updated session with new message
      const updatedSession = await getChatSession(currentSession.id);
      if (updatedSession) {
        setSession(updatedSession);
      }
    } catch (error) {
      // Failed to send message
      console.error('Error sending message:', error);
      setInfoDialogMessage(t('chat.send_failed') || 'Failed to send message.');
      setShowInfoDialog(true);
    } finally {
      setSending(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
    product.slug.toLowerCase().includes(searchProductQuery.toLowerCase())
  );

  // Show button even if loading or not logged in (will handle login on click)
  // But don't show chat window until user is logged in

  const handleButtonClick = () => {
    const isLoggedIn = user || (settings?.demoMode && demoUser);
    if (!isLoggedIn && !session) {
      // Show guest form if no user and no session
      setShowGuestForm(true);
      setIsOpen(true);
      return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Button - Only for Desktop, Left Bottom */}
      <button
        onClick={handleButtonClick}
        className="hidden md:flex fixed bottom-6 left-6 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-all items-center justify-center z-50 group"
        aria-label={t('chat.open_live_chat') || 'Open Live Chat'}
      >
        {!isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {/* Notification Badge if there are unread messages */}
        {session?.messages && session.messages.some(msg => msg.isAdmin && !msg.read) && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {/* Chat Window - Desktop - Show when open (for logged in users, guests with session, or when guest form is showing) */}
      {isOpen && !loading && (user || (settings?.demoMode && demoUser) || session || showGuestForm) && (
        <div className="hidden md:flex fixed bottom-24 left-6 w-72 h-[420px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-40 overflow-hidden">
          <div className="bg-black text-white p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-bold">{t('chat.live_chat_support') || 'Live Chat Support'}</h3>
              {session?.isGuest && (
                <p className="text-xs text-gray-300 mt-1">{t('chat.guest_prefix') || 'Guest:'} {session.userName}</p>
              )}
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowGuestForm(false);
              }}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Guest Name Form */}
          {showGuestForm && !session && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-sm">
                <h4 className="text-lg font-bold text-gray-900 mb-2">{t('chat.start_chat') || 'Start a Chat'}</h4>
                <p className="text-sm text-gray-600 mb-4">{t('chat.enter_name_help') || 'Please enter your name to start chatting with our support team.'}</p>
                <form onSubmit={handleGuestSubmit} className="space-y-3">
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('chat.your_name_placeholder') || 'Your Name'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    {t('chat.start_chat_button') || 'Start Chat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setShowGuestForm(false);
                    }}
                    className="w-full text-gray-600 text-sm hover:text-gray-800"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Chat Messages - Show if session exists, or show empty state if user is logged in but no session */}
          {!showGuestForm && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {!session ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>{t('chat.empty_title') || 'Start a conversation with our support team!'}</p>
                    <p className="text-xs mt-2">{t('chat.empty_subtitle') || 'Type a message below to begin.'}</p>
                  </div>
                ) : session.messages && session.messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>{t('chat.empty_title') || 'Start a conversation with our support team!'}</p>
                  </div>
                ) : (
                  session.messages && session.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] p-2 rounded-lg ${
                  msg.isAdmin
                    ? 'bg-gray-100 text-gray-900'
                    : 'bg-black text-white'
                }`}
              >
                <p className="text-xs font-medium mb-1">
                  {msg.isAdmin ? msg.adminName : msg.userName}
                </p>
                {msg.productId && msg.productUrl && (
                  <div className={`mb-2 p-2 rounded border ${msg.isAdmin ? 'bg-white border-gray-200' : 'bg-white/20 border-white/30'}`}>
                    <div className="flex gap-2">
                      {msg.productImage && (
                        <Image src={msg.productImage} alt={msg.productName || 'Product'} width={48} height={48} className="w-12 h-12 object-cover rounded" unoptimized />
                      )}
                      <div className="flex-1">
                        <p className={`text-xs font-semibold ${msg.isAdmin ? 'text-gray-900' : 'text-white'}`}>
                          {msg.productName}
                        </p>
                        <a
                          href={msg.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs underline ${msg.isAdmin ? 'text-blue-600' : 'text-blue-200'}`}
                        >
                          {t('chat.view_product') || 'View Product'}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-2 grid grid-cols-2 gap-1">
                    {msg.images.map((imgUrl, imgIdx) => (
                      <Image key={imgIdx} src={imgUrl} alt={`Attachment ${imgIdx + 1}`} width={200} height={96} className="w-full h-24 object-cover rounded" unoptimized />
                    ))}
                  </div>
                )}
                {msg.message && <p className="text-sm">{msg.message}</p>}
                <p className="text-xs opacity-70 mt-1">
                  {msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString() : ''}
                </p>
              </div>
            </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-gray-50">
        {selectedProduct && (
          <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
            <div className="flex gap-3 items-center">
              {selectedProduct.images?.[0] && (
                <Image src={selectedProduct.images[0]} alt={selectedProduct.name} width={48} height={48} className="w-12 h-12 object-cover rounded" unoptimized />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500">{t('chat.product_selected') || 'Product selected'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {imagePreviews.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {imagePreviews.map((preview, idx) => (
              <div key={idx} className="relative">
                <Image src={preview} alt={`Preview ${idx + 1}`} width={80} height={80} className="w-20 h-20 object-cover rounded border border-gray-200" unoptimized />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('chat.message_placeholder') || 'Type your message...'}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm"
            disabled={sending}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            disabled={sending}
            title={t('chat.upload_image') || 'Upload Image'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-6.364-6.364l2.909-2.909m-6.364 0L2.25 5.25m13.5 0L21.75 9.75" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowProductSelector(!showProductSelector)}
            className="flex-shrink-0 p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            disabled={sending}
            title={t('chat.select_product') || 'Select Product'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a6 6 0 00-1.5-4.243V6a6 6 0 10-9 4.243V21M13.5 21H21M13.5 21v-7.5a6 6 0 011.5-4.243V6a6 6 0 10-9 4.243V21m0 0H3" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={sending || (!message.trim() && selectedImages.length === 0 && !selectedProduct)}
            className="flex-shrink-0 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
          >
            {t('chat.send') || 'Send'}
          </button>
        </div>
        {showProductSelector && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
            <input
              type="text"
              value={searchProductQuery}
              onChange={(e) => setSearchProductQuery(e.target.value)}
              placeholder={t('chat.search_products') || 'Search products...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            />
            <div className="space-y-2">
              {filteredProducts.slice(0, 10).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setSelectedProduct(product);
                    setShowProductSelector(false);
                    setSearchProductQuery('');
                  }}
                  className="w-full p-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-left"
                >
                  {product.images?.[0] && (
                    <Image src={product.images[0]} alt={product.name} width={48} height={48} className="w-12 h-12 object-cover rounded" unoptimized />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.slug}</p>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">{t('chat.no_products_found') || 'No products found'}</p>
              )}
            </div>
          </div>
              )}
              </form>
            </>
          )}
        </div>
      )}

      {/* Chat Window - Mobile - Full Screen Modal */}
      {isOpen && !loading && (user || (settings?.demoMode && demoUser) || session || showGuestForm) && (
        <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col">
          {/* Header */}
          <div className="bg-black text-white p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold">{t('chat.live_chat_support') || 'Live Chat Support'}</h3>
              {session?.isGuest && (
                <p className="text-xs text-gray-300 mt-1">{t('chat.guest_prefix') || 'Guest:'} {session.userName}</p>
              )}
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowGuestForm(false);
              }}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Guest Name Form */}
          {showGuestForm && !session && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-sm">
                <h4 className="text-lg font-bold text-gray-900 mb-2">{t('chat.start_chat') || 'Start a Chat'}</h4>
                <p className="text-sm text-gray-600 mb-4">{t('chat.enter_name_help') || 'Please enter your name to start chatting with our support team.'}</p>
                <form onSubmit={handleGuestSubmit} className="space-y-3">
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('chat.your_name_placeholder') || 'Your Name'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    {t('chat.start_chat_button') || 'Start Chat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setShowGuestForm(false);
                    }}
                    className="w-full text-gray-600 text-sm hover:text-gray-800"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Chat Messages - Show if session exists, or show empty state if user is logged in but no session */}
          {!showGuestForm && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {!session ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>{t('chat.empty_title') || 'Start a conversation with our support team!'}</p>
                    <p className="text-xs mt-2">{t('chat.empty_subtitle') || 'Type a message below to begin.'}</p>
                  </div>
                ) : session.messages && session.messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>{t('chat.empty_title') || 'Start a conversation with our support team!'}</p>
                  </div>
                ) : (
                  session.messages && session.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] p-2 rounded-lg ${
                          msg.isAdmin
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-black text-white'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1">
                          {msg.isAdmin ? msg.adminName : msg.userName}
                        </p>
                        {msg.productId && msg.productUrl && (
                          <div className={`mb-2 p-2 rounded border ${msg.isAdmin ? 'bg-white border-gray-200' : 'bg-white/20 border-white/30'}`}>
                            <div className="flex gap-2">
                              {msg.productImage && (
                                <Image src={msg.productImage} alt={msg.productName || 'Product'} width={48} height={48} className="w-12 h-12 object-cover rounded" unoptimized />
                              )}
                              <div className="flex-1">
                                <p className={`text-xs font-semibold ${msg.isAdmin ? 'text-gray-900' : 'text-white'}`}>
                                  {msg.productName}
                                </p>
                                <a
                                  href={msg.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs underline ${msg.isAdmin ? 'text-blue-600' : 'text-blue-200'}`}
                                >
                                  {t('chat.view_product') || 'View Product'}
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                        {msg.images && msg.images.length > 0 && (
                          <div className="mb-2 grid grid-cols-2 gap-1">
                            {msg.images.map((imgUrl, imgIdx) => (
                              <Image key={imgIdx} src={imgUrl} alt={`Attachment ${imgIdx + 1}`} width={200} height={96} className="w-full h-24 object-cover rounded" unoptimized />
                            ))}
                          </div>
                        )}
                        {msg.message && <p className="text-sm">{msg.message}</p>}
                        <p className="text-xs opacity-70 mt-1">
                          {msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-gray-50">
                {selectedProduct && (
                  <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
                    <div className="flex gap-3 items-center">
                      {selectedProduct.images?.[0] && (
                        <Image src={selectedProduct.images[0]} alt={selectedProduct.name} width={48} height={48} className="w-12 h-12 object-cover rounded" unoptimized />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{selectedProduct.name}</p>
                        <p className="text-xs text-gray-500">{t('chat.product_selected') || 'Product selected'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {imagePreviews.length > 0 && (
                  <div className="mb-3 flex gap-2 flex-wrap">
                    {imagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative">
                        <Image src={preview} alt={`Preview ${idx + 1}`} width={80} height={80} className="w-20 h-20 object-cover rounded border border-gray-200" unoptimized />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('chat.message_placeholder') || 'Type your message...'}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm"
                    disabled={sending}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={sending}
                    title={t('chat.upload_image') || 'Upload Image'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-6.364-6.364l2.909-2.909m-6.364 0L2.25 5.25m13.5 0L21.75 9.75" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProductSelector(!showProductSelector)}
                    className="flex-shrink-0 p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={sending}
                    title={t('chat.select_product') || 'Select Product'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a6 6 0 00-1.5-4.243V6a6 6 0 10-9 4.243V21M13.5 21H21M13.5 21v-7.5a6 6 0 011.5-4.243V6a6 6 0 10-9 4.243V21m0 0H3" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    disabled={sending || (!message.trim() && selectedImages.length === 0 && !selectedProduct)}
                    className="flex-shrink-0 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                  >
                    {t('chat.send') || 'Send'}
                  </button>
                </div>
                {showProductSelector && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                      placeholder={t('chat.search_products') || 'Search products...'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    />
                    <div className="space-y-2">
                      {filteredProducts.slice(0, 10).map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowProductSelector(false);
                            setSearchProductQuery('');
                          }}
                          className="w-full p-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-left"
                        >
                          {product.images?.[0] && (
                            <Image src={product.images[0]} alt={product.name} width={48} height={48} className="w-12 h-12 object-cover rounded" unoptimized />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.slug}</p>
                          </div>
                        </button>
                      ))}
                      {filteredProducts.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">{t('chat.no_products_found') || 'No products found'}</p>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      )}

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={t('common.error') || 'Error'}
        message={infoDialogMessage}
        type="error"
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </>
  );
};

export default LiveChat;

