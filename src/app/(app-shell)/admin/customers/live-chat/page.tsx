'use client';

import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth, storage, db } from '@/lib/firebase';
import { getAllChatSessions, updateChatSession, addChatMessage } from '@/lib/firestore/notifications_db';
import { ChatSession } from '@/lib/firestore/notifications';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { requestNotificationPermission, showChatNotification } from '@/lib/utils/notifications';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';

const LiveChatPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const { t } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageTimestampsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Request notification permission on mount
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const auth = await getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          await loadSessions();
          await loadProducts();
        } else {
          window.location.href = '/login?returnUrl=/admin/customers/live-chat';
        }
        setLoading(false);
      });
    })();

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedSession?.messages]);

  const loadProducts = async () => {
    try {
      const allProducts = await getAllProducts();
      setProducts(allProducts);
    } catch {
      // Error loading products
    }
  };

  const loadSessions = async () => {
    try {
      const allSessions = await getAllChatSessions();
      // Filter to keep only the latest session per user (by userId)
      const uniqueSessions = new Map<string, ChatSession>();
      allSessions.forEach(session => {
        if (!session.userId) return;
        const existing = uniqueSessions.get(session.userId);
        if (!existing || (session.updatedAt && existing.updatedAt && 
            session.updatedAt.toMillis() > existing.updatedAt.toMillis())) {
          uniqueSessions.set(session.userId, session);
        }
      });
      setSessions(Array.from(uniqueSessions.values()));
    } catch {
      // Error loading chat sessions
    }
  };

  // Real-time listener for all sessions to detect new messages (for notifications)
  useEffect(() => {
    if (!user || sessions.length === 0) return;

    const unsubscribes: Unsubscribe[] = [];

    sessions.forEach((session) => {
      if (!session.id) return;

      const sessionDocRef = doc(db, 'chat_sessions', session.id);
      const unsubscribe: Unsubscribe = onSnapshot(
        sessionDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const updatedSession = { id: snapshot.id, ...snapshot.data() } as ChatSession;
            
            // Check for new user messages (not from admin)
            if (updatedSession.messages && updatedSession.messages.length > 0) {
              const lastMsg = updatedSession.messages[updatedSession.messages.length - 1];
              const sessionId = updatedSession.id || '';
              const lastTimestamp = lastMessageTimestampsRef.current.get(sessionId) || 0;
              
              if (lastMsg.createdAt) {
                const msgTimestamp = lastMsg.createdAt.toMillis();
                
                // New message from user (not admin)
                if (msgTimestamp > lastTimestamp && !lastMsg.isAdmin) {
                  lastMessageTimestampsRef.current.set(sessionId, msgTimestamp);
                  
                  // Only show notification if this session is not selected or page is not visible
                  if (selectedSession?.id !== sessionId || document.visibilityState !== 'visible') {
                    showChatNotification(
                      updatedSession.userName || 'Customer',
                      lastMsg.message || 'New message',
                      '/favicon.ico'
                    );
                  }
                } else if (msgTimestamp > lastTimestamp) {
                  // Update timestamp even for admin messages
                  lastMessageTimestampsRef.current.set(sessionId, msgTimestamp);
                }
              }
            }
            
            // Update in sessions list
            setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
          }
        },
        (error) => {
          // Handle permission errors gracefully
          if (error.code === 'permission-denied') {
            console.error('Permission denied for chat session');
          }
        }
      );
      
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [sessions, selectedSession?.id, user]);

  // Real-time listener for selected session (for real-time updates)
  useEffect(() => {
    if (!selectedSession?.id) return;

    const sessionDocRef = doc(db, 'chat_sessions', selectedSession.id);
    const unsubscribe: Unsubscribe = onSnapshot(
      sessionDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const updatedSession = { id: snapshot.id, ...snapshot.data() } as ChatSession;
          setSelectedSession(updatedSession);
          // Update in sessions list too
          setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
        }
      },
      (error) => {
        // Handle permission errors gracefully (e.g., on logout)
        if (error.code === 'permission-denied') {
          // User logged out or lost access, cleanup
          setSelectedSession(null);
        }
      }
    );

    return () => unsubscribe();
  }, [selectedSession?.id]);

  const handleStatusChange = async (sessionId: string, status: 'active' | 'closed' | 'waiting') => {
    try {
      await updateChatSession(sessionId, { status });
      await loadSessions();
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, status } : null);
      }
    } catch {
      // Error updating session status
      alert(t('admin.live_chat_update_status_failed'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession?.id || !user || (!replyMessage.trim() && selectedImages.length === 0 && !selectedProduct)) return;

    setSending(true);
    try {
      let imageUrls: string[] = [];
      
      // Upload images
      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(async (file) => {
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `chat/${selectedSession.id}/${Date.now()}_${sanitizedFileName}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, file);
          return getDownloadURL(storageRef);
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      await addChatMessage(selectedSession.id, {
        userId: selectedSession.userId,
        userName: selectedSession.userName,
        message: replyMessage.trim() || (selectedProduct ? `Check out this product: ${selectedProduct.name}` : ''),
        isAdmin: true,
        adminId: user.uid,
        adminName: user.displayName || user.email || 'Admin',
        read: false,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        productId: selectedProduct?.id,
        productName: selectedProduct?.name,
        productImage: selectedProduct?.images?.[0],
        productUrl: selectedProduct ? `/products/${selectedProduct.slug}` : undefined,
      });

      setReplyMessage('');
      setSelectedImages([]);
      setImagePreviews([]);
      setSelectedProduct(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      } catch {
      // Error sending reply
      alert(t('admin.live_chat_send_failed'));
    } finally {
      setSending(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
    product.slug.toLowerCase().includes(searchProductQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {t('admin.common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
          {t('admin.live_chat_title')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('admin.live_chat_subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 h-[calc(100vh-150px)] sm:h-[calc(100vh-200px)]">
        {/* Sessions List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-900">{t('admin.live_chat_sessions_title') || 'Chat Sessions'}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.live_chat_sessions_total', {
                count: sessions.length.toString(),
              })}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>{t('admin.live_chat_sessions_empty') || 'No chat sessions yet'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedSession?.id === session.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 truncate">{session.userName}</p>
                          {session.isGuest && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 font-medium">
                              {t('admin.live_chat_sessions_guest_badge')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {session.userPhone ||
                            (session.isGuest
                              ? t('admin.live_chat_sessions_guest_phone') || 'Guest'
                              : t('admin.live_chat_sessions_no_phone') || 'No phone')}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                          session.status
                        )}`}
                      >
                        {session.status}
                      </span>
                    </div>
                    {session.lastMessage && (
                      <p className="text-xs text-gray-600 truncate mt-1">{session.lastMessage}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {session.lastMessageAt && typeof session.lastMessageAt.toDate === 'function'
                        ? new Date(session.lastMessageAt.toDate()).toLocaleString()
                        : t('admin.live_chat_sessions_no_messages')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {selectedSession ? (
            <>
              <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{selectedSession.userName}</h2>
                    {selectedSession.isGuest && (
                      <span className="px-2 py-1 text-xs rounded-md bg-orange-50 text-orange-700 font-semibold">
                        {t('admin.live_chat_sessions_guest_badge')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{selectedSession.userPhone || (selectedSession.isGuest ? (t('admin.live_chat_sessions_guest_user') || 'Guest User') : (t('admin.live_chat_sessions_no_phone') || 'No phone'))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSession.status}
                    onChange={(e) => handleStatusChange(selectedSession.id!, e.target.value as 'active' | 'closed' | 'waiting')}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  >
                    <option value="waiting">
                      {t('admin.live_chat_status_waiting')}
                    </option>
                    <option value="active">
                      {t('admin.live_chat_status_active')}
                    </option>
                    <option value="closed">
                      {t('admin.live_chat_status_closed')}
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {selectedSession.messages && selectedSession.messages.length > 0 ? (
                  selectedSession.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${!message.isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 sm:px-4 py-2 ${
                          !message.isAdmin
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {message.productId && message.productUrl && (
                          <div className={`mb-2 p-3 rounded-lg border ${!message.isAdmin ? 'bg-white/20 border-white/30' : 'bg-white border-gray-200'}`}>
                            <div className="flex gap-3">
                              {message.productImage && (
                                <Image src={message.productImage} alt={message.productName || 'Product'} width={64} height={64} className="w-16 h-16 object-cover rounded" unoptimized />
                              )}
                              <div className="flex-1">
                                <p className={`text-sm font-semibold ${!message.isAdmin ? 'text-white' : 'text-gray-900'}`}>
                                  {message.productName}
                                </p>
                                <Link
                                  href={message.productUrl}
                                  target="_blank"
                                  className={`text-xs underline ${!message.isAdmin ? 'text-blue-200' : 'text-blue-600'}`}
                                >
                                  {t('admin.live_chat_view_product') || 'View Product'}
                                </Link>
                              </div>
                            </div>
                          </div>
                        )}
                        {message.images && message.images.length > 0 && (
                          <div className="mb-2 grid grid-cols-2 gap-2">
                            {message.images.map((imgUrl, imgIdx) => (
                              <Image key={imgIdx} src={imgUrl} alt={`Attachment ${imgIdx + 1}`} width={200} height={128} className="w-full h-32 object-cover rounded" unoptimized />
                            ))}
                          </div>
                        )}
                        {message.message && <p className="text-sm">{message.message}</p>}
                        <p className="text-xs mt-1 opacity-70">
                          {message.createdAt && typeof message.createdAt.toDate === 'function'
                            ? new Date(message.createdAt.toDate()).toLocaleString()
                            : t('admin.live_chat_message_just_now')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>{t('admin.live_chat_no_messages') || 'No messages yet'}</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Form */}
              <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
                {selectedProduct && (
                  <div className="mb-3 p-2 sm:p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                    <div className="flex gap-2 sm:gap-3 items-center flex-1 min-w-0">
                      {selectedProduct.images?.[0] && (
                        <Image src={selectedProduct.images[0]} alt={selectedProduct.name} width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded flex-shrink-0" unoptimized />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{selectedProduct.name}</p>
                        <p className="text-xs text-gray-500">
                          {t('admin.live_chat_product_selected')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
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
                        <Image src={preview} alt={`Preview ${idx + 1}`} width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded border border-gray-200" unoptimized />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendReply} className="space-y-2 sm:space-y-3">
                  <div className="flex gap-1 sm:gap-2">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder={t('admin.live_chat_reply_placeholder')}
                      className="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-xs sm:text-sm"
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
                      className="px-2 sm:px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs sm:text-sm font-medium"
                      disabled={sending}
                      title={t('admin.live_chat_upload_image') || 'Upload Image'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-6.364-6.364l2.909-2.909m-6.364 0L2.25 5.25m13.5 0L21.75 9.75" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductSelector(!showProductSelector)}
                      className="px-2 sm:px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs sm:text-sm font-medium"
                      disabled={sending}
                      title={t('admin.live_chat_select_product') || 'Select Product'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a6 6 0 00-1.5-4.243V6a6 6 0 10-9 4.243V21M13.5 21H21M13.5 21v-7.5a6 6 0 011.5-4.243V6a6 6 0 10-9 4.243V21m0 0H3" />
                      </svg>
                    </button>
                    <button
                      type="submit"
                      disabled={sending || (!replyMessage.trim() && selectedImages.length === 0 && !selectedProduct)}
                      className="px-3 sm:px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
                    >
                      {sending
                        ? t('admin.live_chat_sending')
                        : t('admin.live_chat_send')}
                    </button>
                  </div>
                </form>
                {showProductSelector && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                      placeholder={t('admin.live_chat_product_search_placeholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    />
                    <div className="space-y-2">
                      {filteredProducts.slice(0, 10).map((product) => (
                        <button
                          key={product.id}
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
                        <p className="text-sm text-gray-500 text-center py-4">
                          {t('admin.live_chat_product_none')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-16 h-16 mx-auto mb-4 text-gray-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                  </svg>
                  <p>{t('admin.live_chat_select_session_prompt')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveChatPage;

