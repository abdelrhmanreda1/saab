'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrder } from '@/lib/firestore/orders_db';
import { Order } from '@/lib/firestore/orders';
import { addOrderNote, getOrderNotes } from '@/lib/firestore/order_management_db';
import { OrderNote } from '@/lib/firestore/order_management';
import { useAuth } from '../../../../../context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const OrderNotesPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, filter]);

  const fetchData = async () => {
    try {
      const [orderData, notesData] = await Promise.all([
        getOrder(orderId),
        getOrderNotes(orderId, filter === 'internal' ? true : filter === 'external' ? false : undefined),
      ]);
      setOrder(orderData);
      setNotes(notesData);
    } catch {
      // Failed to fetch notes
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteText.trim()) return;

    try {
      await addOrderNote({
        orderId: order!.id!,
        note: noteText,
        isInternal,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Admin',
      });

      setNoteText('');
      setShowForm(false);
      fetchData();
    } catch {
      // Failed to add note
      alert(t('admin.order_notes_add_failed'));
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

  if (!order) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto text-center py-12">
        {t('admin.order_common_not_found')}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t('admin.order_back_to_orders')}
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              {t('admin.order_notes_title')}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {t('account.order_details.order_label')} #{order.id?.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_notes_filter_all')}
          </button>
          <button
            onClick={() => setFilter('internal')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'internal' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_notes_filter_internal')}
          </button>
          <button
            onClick={() => setFilter('external')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'external' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.order_notes_filter_customer')}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-black text-white px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('admin.order_notes_add_button')}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">
            {t('admin.order_notes_add_title')}
          </h2>
          <form onSubmit={handleAddNote} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.order_notes_note_label')}
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                required
                placeholder={t('admin.order_notes_note_placeholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isInternal"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-gray-900"
              />
              <label htmlFor="isInternal" className="text-sm font-medium text-gray-700">
                {t('admin.order_notes_internal_checkbox')}
              </label>
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('admin.order_notes_save_button')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setNoteText('');
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('admin.order_notes_cancel_button')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {notes.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg font-medium mb-2">{t('admin.order_notes_empty')}</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900">
                      {note.createdByName || 'System'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {note.createdAt?.toDate
                        ? new Date(note.createdAt.toDate()).toLocaleString()
                        : t('common.not_available')}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                    note.isInternal ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {note.isInternal
                      ? t('admin.order_notes_internal_badge')
                      : t('admin.order_notes_customer_badge')}
                  </span>
                </div>
                <div className="text-gray-700 mt-2">{note.note}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderNotesPage;

