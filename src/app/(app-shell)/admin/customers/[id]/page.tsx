'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firestore/users';
import { getCustomerNotes, addCustomerNote, deleteCustomerNote } from '@/lib/firestore/customer_management_db';
import { getCustomerCommunications } from '@/lib/firestore/customer_management_db';
import { calculateCustomerLifetimeValue } from '@/lib/firestore/customer_management_db';
import { getAllCustomerTags, addTagToCustomer, removeTagFromCustomer } from '@/lib/firestore/customer_management_db';
import { getOrdersByUserId } from '@/lib/firestore/orders_db';
import { Order } from '@/lib/firestore/orders';
import { CustomerNote, CustomerTag, CustomerLifetimeValue, CustomerCommunication } from '@/lib/firestore/customer_management';
import { UserProfile } from '@/lib/firestore/users';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';

const CustomerDetailPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<UserProfile | null>(null);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [communications, setCommunications] = useState<CustomerCommunication[]>([]);
  const [clv, setClv] = useState<CustomerLifetimeValue | null>(null);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'communications' | 'orders'>('overview');
  const [newNote, setNewNote] = useState('');
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;
  const auth = getAuth(app);
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const [customerData, notesData, commsData, clvData, tagsData, settingsData] = await Promise.all([
            getUserProfile(customerId),
            getCustomerNotes(customerId, false, currentUser.uid),
            getCustomerCommunications(customerId),
            calculateCustomerLifetimeValue(customerId),
            getAllCustomerTags(),
            getSettings(),
          ]);
          
          setCustomer(customerData);
          setNotes(notesData);
          setCommunications(commsData);
          setClv(clvData);
          setTags(tagsData);
          if (settingsData) {
            setSettings({ ...defaultSettings, ...settingsData });
          }
        } catch {
          // Error fetching customer data
          router.push('/admin/customers');
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, customerId]);

  const handleAddNote = async () => {
    if (!user || !newNote.trim()) return;

    // Block adding notes in demo mode
    if (settings.demoMode) {
      alert(
        t('admin.settings.save_disabled_demo') ||
          'Settings saving is disabled in demo mode.'
      );
      return;
    }

    try {
      await addCustomerNote({
        userId: customerId,
        note: newNote.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Admin',
        isPrivate: isPrivateNote,
      });
      setNewNote('');
      setIsPrivateNote(false);
      const updatedNotes = await getCustomerNotes(customerId, false, user.uid);
      setNotes(updatedNotes);
    } catch {
      // Error adding note
      alert('Failed to add note.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm(t('admin.customer_notes_delete_confirm') || 'Are you sure you want to delete this note?')) return;
    try {
      await deleteCustomerNote(noteId);
      if (user) {
        const updatedNotes = await getCustomerNotes(customerId, false, user.uid);
        setNotes(updatedNotes);
      }
    } catch {
      // Error deleting note
      alert(t('admin.customer_notes_delete_failed') || 'Failed to delete note.');
    }
  };

  const handleToggleTag = async (tagId: string, isTagged: boolean) => {
    try {
      if (isTagged) {
        await removeTagFromCustomer(customerId, tagId);
      } else {
        await addTagToCustomer(customerId, tagId);
      }
      // Refresh customer data
      const customerData = await getUserProfile(customerId);
      setCustomer(customerData);
    } catch {
      // Error updating tag
      alert(t('admin.customer_tags_update_failed') || 'Failed to update tag.');
    }
  };

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

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900">
            {t('admin.customer_detail_not_found_title')}
          </h1>
          <Link
            href="/admin/customers"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {t('admin.customer_detail_back_to_customers')}
          </Link>
        </div>
      </div>
    );
  }

  // Get customer's tag IDs from user document (tags are stored as array of tag IDs)
  const customerTagIds = ((customer as UserProfile & { tags?: string[] })?.tags) || [];
  const customerTags = tags.filter(tag => tag.id && customerTagIds.includes(tag.id));
  const customerInitial =
    (customer.displayName || (settings.demoMode ? 'C' : customer.email) || 'C')
      .charAt(0)
      .toUpperCase();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <Link
          href="/admin/customers"
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t('admin.customer_detail_back_to_customers')}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-6 mb-6">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg sm:text-xl font-semibold">
              {customerInitial}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900">
                {customer.displayName ||
                  (settings.demoMode ? 'Customer' : customer.email) ||
                  'Customer'}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-xs sm:text-sm text-gray-700 border border-gray-200">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 14c-4.418 0-8 1.79-8 4v1h16v-1c0-2.21-3.582-4-8-4z"
                    />
                  </svg>
                  <span className="truncate max-w-[160px] sm:max-w-xs">
                    {settings.demoMode ? '************' : customer.email}
                  </span>
                </span>
                {customer.phoneNumber && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-xs sm:text-sm text-gray-700 border border-gray-200">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 19.72V21a2 2 0 01-2 2h-1C9.82 23 3 16.18 3 8V7a2 2 0 012-2z"
                      />
                    </svg>
                    <span className="truncate max-w-[140px] sm:max-w-xs">
                      {settings.demoMode ? '************' : customer.phoneNumber}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    customer.role === 'admin'
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {customer.role === 'admin'
                    ? t('admin.customers_role_admin')
                    : t('admin.customers_role_customer')}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    customer.isBlocked
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}
                >
                  {customer.isBlocked
                    ? t('admin.customers_status_blocked')
                    : t('admin.customers_status_active')}
                </span>
              </div>
            </div>
          </div>
          {clv && (
            <div className="mt-2 sm:mt-0 flex-shrink-0 bg-gray-50 rounded-lg px-4 py-3 sm:px-5 sm:py-4 min-w-[180px]">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">
                {t('admin.customer_detail_lifetime_value_label')}
              </p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {formatPrice(clv.totalRevenue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('admin.customer_detail_lifetime_value_predicted', {
                  value: clv.predictedCLV.toLocaleString(),
                })}
              </p>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            {t('admin.customer_detail_tags_label')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => {
              const isTagged = customerTags.some(ct => ct.id === tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id!, isTagged)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isTagged
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isTagged && tag.color ? { backgroundColor: tag.color } : {}}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 overflow-x-auto">
          <nav className="flex gap-2 sm:gap-4 min-w-max sm:min-w-0">
            {(['overview', 'notes', 'communications', 'orders'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-3 sm:px-4 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-b-2 border-gray-900 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'overview' && t('admin.customer_detail_tabs_overview')}
                {tab === 'notes' && t('admin.customer_detail_tabs_notes')}
                {tab === 'communications' &&
                  t('admin.customer_detail_tabs_communications')}
                {tab === 'orders' && t('admin.customer_detail_tabs_orders')}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {clv && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 mb-1">
                    {t('admin.customer_detail_overview_total_revenue')}
                  </p>
                  <p className="text-lg sm:text-xl font-bold">{formatPrice(clv.totalRevenue)}</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 mb-1">
                    {t('admin.customer_detail_overview_total_orders')}
                  </p>
                  <p className="text-lg sm:text-xl font-bold">{clv.totalOrders}</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 mb-1">
                    {t('admin.customer_detail_overview_avg_order_value')}
                  </p>
                  <p className="text-lg sm:text-xl font-bold">{formatPrice(clv.averageOrderValue)}</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500 mb-1">
                    {t('admin.customer_detail_overview_customer_age')}
                  </p>
                  <p className="text-lg sm:text-xl font-bold">
                    {t('admin.customer_detail_overview_customer_age_days', {
                      days: clv.customerAge.toString(),
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <h3 className="font-semibold mb-3 text-sm sm:text-base">
                {t('admin.customer_detail_notes_add_title')}
              </h3>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('admin.customer_detail_notes_add_placeholder')}
                rows={3}
                className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none mb-3 text-sm"
                disabled={settings.demoMode}
              />
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <input
                  type="checkbox"
                  id="privateNote"
                  checked={isPrivateNote}
                  onChange={(e) => setIsPrivateNote(e.target.checked)}
                  className="w-4 h-4"
                  disabled={settings.demoMode}
                />
                <label htmlFor="privateNote" className="text-xs sm:text-sm text-gray-600">
                  {t('admin.customer_detail_notes_private_label')}
                </label>
              </div>
              <button
                onClick={handleAddNote}
                className={`bg-gray-900 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors w-full sm:w-auto ${
                  settings.demoMode ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-800'
                }`}
                disabled={settings.demoMode}
              >
                {t('admin.customer_detail_notes_add_button')}
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  {t('admin.customer_detail_notes_empty')}
                </p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{note.createdByName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(note.createdAt.seconds * 1000).toLocaleString()}
                          {note.isPrivate && (
                            <span className="ml-2 text-orange-600">
                              {t('admin.customer_detail_notes_private_badge')}
                            </span>
                          )}
                        </p>
                      </div>
                      {note.createdBy === user?.uid && (
                        <button
                          onClick={() => note.id && handleDeleteNote(note.id)}
                          className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium flex-shrink-0"
                        >
                          {t('admin.customer_detail_notes_delete')}
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm sm:text-base">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'communications' && (
          <div className="space-y-3 sm:space-y-4">
            {communications.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-sm">
                {t('admin.customer_detail_communications_empty')}
              </p>
            ) : (
              communications.map(comm => (
                <div key={comm.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md capitalize">
                        {comm.type}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-md ${
                        comm.direction === 'inbound' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {comm.direction}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(comm.createdAt.seconds * 1000).toLocaleString()}
                    </span>
                  </div>
                  {comm.subject && (
                    <p className="font-medium text-gray-900 mb-1 text-sm sm:text-base">{comm.subject}</p>
                  )}
                  <p className="text-gray-700 text-sm sm:text-base">{comm.message}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <CustomerOrdersTab customerId={customerId} />
        )}
      </div>
    </div>
  );
};

const CustomerOrdersTab = ({ customerId }: { customerId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const customerOrders = await getOrdersByUserId(customerId);
        setOrders(customerOrders);
      } catch {
        // Error fetching orders
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [customerId]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="relative inline-block">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        </div>
        <p className="text-sm text-gray-500 mt-2">{t('admin.customer_detail_orders_loading')}</p>
      </div>
    );
  }

  return (
    <div>
      {orders.length === 0 ? (
        <p className="text-gray-500 text-center py-8 text-sm">
          {t('admin.customer_detail_orders_empty')}
        </p>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {orders.map(order => (
            <div key={order.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm sm:text-base">
                    {t('admin.customer_detail_orders_label', {
                      id: order.id?.slice(0, 8) ?? '',
                    })}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold uppercase ${
                    order.status === 'delivered'
                      ? 'bg-green-50 text-green-700'
                      : order.status === 'cancelled'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-yellow-50 text-yellow-700'
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-gray-900 font-semibold text-sm sm:text-base">{formatPrice(order.totalAmount)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerDetailPage;

