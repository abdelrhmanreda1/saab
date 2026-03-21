'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../../components/admin/Sidebar';
import { onAdminAuthStateChanged } from '@/lib/auth';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { Order } from '@/lib/firestore/orders';
import { ChatSession } from '@/lib/firestore/notifications';
import { playOrderSound } from '@/lib/utils/notifications';
import Dialog from '@/components/ui/Dialog';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [newOrder, setNewOrder] = useState<Order | null>(null);
  const lastOrderTimestampRef = useRef<number>(0);
  const isInitialOrdersSnapshotRef = useRef<boolean>(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatSession, setNewChatSession] = useState<ChatSession | null>(null);
  const [newChatMessageText, setNewChatMessageText] = useState<string>('');
  const lastChatMessageTimestampRef = useRef<number>(0);
  const isInitialChatSnapshotRef = useRef<boolean>(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [newChatsCount, setNewChatsCount] = useState(0);
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAdminAuthStateChanged((user, isAdmin) => {
      if (user && isAdmin) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        router.push('/login?returnUrl=/admin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  // Global real-time listener for new orders (all admin pages)
  useEffect(() => {
    // Sirf authenticated admin aur non-demo mode me listener chalay
    if (!isAuthenticated || settings?.demoMode) {
      return;
    }

    const ordersCollectionRef = collection(db, 'orders');
    const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newOrders: Order[] = [];

        // First snapshot: baseline set karo, popup mat dikhao
        if (isInitialOrdersSnapshotRef.current) {
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as Order;
            if (data.createdAt) {
              const ts = data.createdAt.toMillis();
              if (ts > lastOrderTimestampRef.current) {
                lastOrderTimestampRef.current = ts;
              }
            }
          });
          isInitialOrdersSnapshotRef.current = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const orderData = { id: change.doc.id, ...change.doc.data() } as Order;

            if (orderData.createdAt && lastOrderTimestampRef.current > 0) {
              const orderTimestamp = orderData.createdAt.toMillis();

              if (orderTimestamp > lastOrderTimestampRef.current) {
                lastOrderTimestampRef.current = orderTimestamp;
                newOrders.push(orderData);
              }
            }
          }
        });

        if (newOrders.length > 0) {
          const latestOrder = newOrders[0];
          setNewOrder(latestOrder);
          setShowNewOrderDialog(true);
          setNewOrdersCount(prev => prev + newOrders.length);
          playOrderSound();
        }
      },
      (error) => {
        console.error('Error listening to orders (layout):', error);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, settings?.demoMode]);

  // Global real-time listener for new live chat messages (all admin pages)
  useEffect(() => {
    if (!isAuthenticated || settings?.demoMode) {
      return;
    }

    const chatSessionsRef = collection(db, 'chat_sessions');
    const q = query(chatSessionsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newUserMessages: { session: ChatSession; messageText: string }[] = [];

        // First snapshot: baseline set karo, popup mat dikhao
        if (isInitialChatSnapshotRef.current) {
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as ChatSession;
            if (data.updatedAt) {
              const ts = data.updatedAt.toMillis();
              if (ts > lastChatMessageTimestampRef.current) {
                lastChatMessageTimestampRef.current = ts;
              }
            }
          });
          isInitialChatSnapshotRef.current = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const sessionData = { id: change.doc.id, ...change.doc.data() } as ChatSession;
            const messages = sessionData.messages || [];
            if (!messages.length) return;

            const lastMsg = messages[messages.length - 1];

            if (lastMsg.createdAt) {
              const msgTimestamp = lastMsg.createdAt.toMillis();

              // Sirf customer (non-admin) ke naye messages ke liye popup
              if (!lastMsg.isAdmin && msgTimestamp > lastChatMessageTimestampRef.current) {
                lastChatMessageTimestampRef.current = msgTimestamp;
                newUserMessages.push({
                  session: sessionData,
                  messageText: lastMsg.message || '',
                });
              } else if (msgTimestamp > lastChatMessageTimestampRef.current) {
                // Timestamp update karo taake duplication na ho
                lastChatMessageTimestampRef.current = msgTimestamp;
              }
            }
          }
        });

        if (newUserMessages.length > 0) {
          const { session, messageText } = newUserMessages[0];
          setNewChatSession(session);
          setNewChatMessageText(messageText);
          setShowNewChatDialog(true);
          setNewChatsCount(prev => prev + newUserMessages.length);
          // Same sound reuse kar lete hain jaise orders ke liye
          playOrderSound();
        }
      },
      (error) => {
        console.error('Error listening to chat sessions (layout):', error);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, settings?.demoMode]);

  // (Optional) Global listener for new customers (for notification badge)
  useEffect(() => {
    if (!isAuthenticated || settings?.demoMode) {
      return;
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    let latestCreatedAt = 0;
    let isInitialUsersSnapshot = true;

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newUsers: number[] = [];

        if (isInitialUsersSnapshot) {
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as { createdAt?: { toMillis: () => number } };
            if (data.createdAt) {
              const ts = data.createdAt.toMillis();
              if (ts > latestCreatedAt) {
                latestCreatedAt = ts;
              }
            }
          });
          isInitialUsersSnapshot = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as { createdAt?: { toMillis: () => number } };
            if (data.createdAt) {
              const ts = data.createdAt.toMillis();
              if (ts > latestCreatedAt) {
                latestCreatedAt = ts;
                newUsers.push(ts);
              }
            }
          }
        });

        if (newUsers.length > 0) {
          setNewCustomersCount(prev => prev + newUsers.length);
          // Optional: sound mat bajao customers pe, ya chaho to yahan bhi playOrderSound() kar sakte ho
        }
      },
      (error) => {
        console.error('Error listening to users (layout):', error);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, settings?.demoMode]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    // Use setTimeout to avoid calling setState synchronously in effect
    const timer = setTimeout(() => {
      setSidebarOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Handle loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-h-screen w-full md:w-auto">
        {/* Desktop Header */}
        <div className="hidden md:block sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-end gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(prev => !prev)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={t('admin.notifications_title') || 'Notifications'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-gray-700"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.25h-5.714a4.5 4.5 0 01-4.5-4.5V9a6.857 6.857 0 1113.714 0v3.75a4.5 4.5 0 01-4.5 4.5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 17.25a2.25 2.25 0 004.5 0"
                  />
                </svg>
                {(newOrdersCount + newChatsCount + newCustomersCount) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                    {Math.min(newOrdersCount + newChatsCount + newCustomersCount, 99)}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        {t('admin.notifications_title') || 'Notifications'}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-gray-800"
                        onClick={() => {
                          setNewOrdersCount(0);
                          setNewChatsCount(0);
                          setNewCustomersCount(0);
                        }}
                      >
                        {t('admin.notifications_clear_all') || 'Clear'}
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {(newOrdersCount + newChatsCount + newCustomersCount) === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-gray-500">
                          {t('admin.notifications_empty') || 'No new notifications'}
                        </div>
                      )}

                      {newOrdersCount > 0 && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                          onClick={() => {
                            router.push('/admin/orders');
                            setIsNotificationsOpen(false);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {t('admin.notifications_new_orders') || 'New orders'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {newOrdersCount} {t('admin.notifications_new_orders_suffix') || 'new order(s) placed'}
                            </p>
                          </div>
                          <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] rounded-full bg-gray-900 text-white text-xs font-semibold">
                            {newOrdersCount}
                          </span>
                        </button>
                      )}

                      {newChatsCount > 0 && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                          onClick={() => {
                            router.push('/admin/customers/live-chat');
                            setIsNotificationsOpen(false);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {t('admin.notifications_new_chats') || 'New live chat messages'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {newChatsCount} {t('admin.notifications_new_chats_suffix') || 'new message(s) from customers'}
                            </p>
                          </div>
                          <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] rounded-full bg-blue-600 text-white text-xs font-semibold">
                            {newChatsCount}
                          </span>
                        </button>
                      )}

                      {newCustomersCount > 0 && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                          onClick={() => {
                            router.push('/admin/customers');
                            setIsNotificationsOpen(false);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {t('admin.notifications_new_customers') || 'New customers'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {newCustomersCount} {t('admin.notifications_new_customers_suffix') || 'new customer account(s)'}
                            </p>
                          </div>
                          <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] rounded-full bg-green-600 text-white text-xs font-semibold">
                            {newCustomersCount}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Language Switcher */}
            {settings?.site?.enableLanguageSwitcher && (
              <LanguageSwitcher />
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={t('admin.menu_open') || 'Open menu'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{t('admin.panel') || 'Admin Panel'}</h1>
          
          {/* Mobile Language Switcher */}
          {settings?.site?.enableLanguageSwitcher && (
            <LanguageSwitcher />
          )}
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>

        {/* Global New Order Alert Dialog (visible on all admin pages) */}
        <Dialog
          isOpen={showNewOrderDialog && !!newOrder && pathname?.startsWith('/admin')}
          onClose={() => {
            setShowNewOrderDialog(false);
            setNewOrder(null);
          }}
          title={t('admin.new_order_alert_title') || 'New Order Received!'}
          message={
            newOrder
              ? `${t('admin.new_order_alert_message') || 'A new order has been received'}\n\n${t('admin.orders_order_id') || 'Order ID'}: ${newOrder.id?.slice(0, 8) || ''}\n${t('admin.orders_customer') || 'Customer'}: ${newOrder.shippingAddress?.fullName || 'N/A'}\n${t('admin.orders_total') || 'Total'}: ${newOrder.totalAmount ?? ''}`
              : ''
          }
          type="success"
          showCancel={false}
          confirmText={t('admin.view_order') || 'View Order'}
          onConfirm={() => {
            if (newOrder?.id) {
              window.location.href = `/admin/orders/${newOrder.id}`;
            }
            setShowNewOrderDialog(false);
            setNewOrder(null);
          }}
        />

        {/* Global Live Chat Message Alert Dialog (visible on all admin pages) */}
        <Dialog
          isOpen={showNewChatDialog && !!newChatSession && pathname?.startsWith('/admin')}
          onClose={() => {
            setShowNewChatDialog(false);
            setNewChatSession(null);
            setNewChatMessageText('');
          }}
          title={t('admin.new_chat_message_title') || 'New Live Chat Message'}
          message={
            newChatSession
              ? `${newChatSession.userName || 'Customer'}\n${newChatSession.userEmail || newChatSession.userPhone || ''}\n\n${newChatMessageText}`
              : ''
          }
          type="info"
          showCancel={false}
          confirmText={t('admin.view_chat') || 'View Chat'}
          onConfirm={() => {
            window.location.href = '/admin/customers/live-chat';
            setShowNewChatDialog(false);
            setNewChatSession(null);
            setNewChatMessageText('');
          }}
        />
      </main>
    </div>
  );
}
