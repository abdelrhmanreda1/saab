'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllNewsletterSubscriptions, unsubscribeNewsletter } from '@/lib/firestore/newsletter_db';
import { NewsletterSubscription } from '@/lib/firestore/newsletter_db';
import { useLanguage } from '@/context/LanguageContext';

const NewsletterPage = () => {
  const [, setUser] = useState<User | null>(null);
  const [subscriptions, setSubscriptions] = useState<NewsletterSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useLanguage();

  const loadSubscriptions = useCallback(async () => {
    try {
      const allSubscriptions = await getAllNewsletterSubscriptions();
      setSubscriptions(allSubscriptions);
    } catch {
      // Error loading newsletter subscriptions
      alert(t('admin.newsletter_load_failed'));
    }
  }, [t]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadSubscriptions();
      } else {
        window.location.href = '/login?returnUrl=/admin/customers/newsletter';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadSubscriptions]);

  const handleUnsubscribe = async (email: string) => {
    if (
      !confirm(
        t('admin.newsletter_unsubscribe_confirm', {
          email,
        })
      )
    ) {
      return;
    }
    
    try {
      await unsubscribeNewsletter(email);
      await loadSubscriptions();
      alert(t('admin.newsletter_unsubscribe_success'));
    } catch {
      // Error unsubscribing
      alert(t('admin.newsletter_unsubscribe_failed'));
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesFilter = filter === 'all' || sub.status === filter;
    const matchesSearch = searchQuery === '' || 
      sub.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.source && sub.source.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const unsubscribedCount = subscriptions.filter(s => s.status === 'unsubscribed').length;

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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              {t('admin.newsletter_title')}
            </h1>
            <p className="text-gray-500 text-sm">
              {t('admin.newsletter_subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <div className="text-center">
              <p className="font-bold text-gray-900">{activeCount}</p>
              <p className="text-gray-500 text-xs">
                {t('admin.newsletter_active_count_label')}
              </p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{unsubscribedCount}</p>
              <p className="text-gray-500 text-xs">
                {t('admin.newsletter_unsubscribed_count_label')}
              </p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{subscriptions.length}</p>
              <p className="text-gray-500 text-xs">
                {t('admin.newsletter_total_count_label')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder={t('admin.newsletter_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'unsubscribed')}
            className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
          >
            <option value="all">{t('admin.newsletter_filter_all')}</option>
            <option value="active">{t('admin.newsletter_filter_active')}</option>
            <option value="unsubscribed">
              {t('admin.newsletter_filter_unsubscribed')}
            </option>
          </select>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.newsletter_none')}</p>
            <p className="text-sm text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Source</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Subscribed</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSubscriptions.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{subscription.email}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          subscription.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {subscription.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {subscription.source || t('admin.newsletter_source_unknown')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        <div>
                          {subscription.subscribedAt && typeof subscription.subscribedAt.toDate === 'function'
                            ? new Date(subscription.subscribedAt.toDate()).toLocaleDateString()
                            : t('admin.newsletter_subscribed_unknown')}
                        </div>
                        {subscription.unsubscribedAt && (
                          <div className="text-xs text-gray-400">
                            {t('admin.newsletter_unsubscribed_at_label')}{' '}
                            {typeof subscription.unsubscribedAt.toDate === 'function'
                              ? new Date(subscription.unsubscribedAt.toDate()).toLocaleDateString()
                              : t('admin.newsletter_unsubscribed_at_unknown')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        {subscription.status === 'active' && (
                          <button
                            onClick={() => handleUnsubscribe(subscription.email)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            {t('admin.newsletter_unsubscribe_button') || 'Unsubscribe'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredSubscriptions.map((subscription) => (
                <div key={subscription.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{subscription.email}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>Source: {subscription.source || t('admin.newsletter_source_unknown')}</p>
                        <p>Subscribed: {subscription.subscribedAt && typeof subscription.subscribedAt.toDate === 'function'
                          ? new Date(subscription.subscribedAt.toDate()).toLocaleDateString()
                          : t('admin.newsletter_subscribed_unknown')}</p>
                        {subscription.unsubscribedAt && (
                          <p>Unsubscribed: {typeof subscription.unsubscribedAt.toDate === 'function'
                            ? new Date(subscription.unsubscribedAt.toDate()).toLocaleDateString()
                            : t('admin.newsletter_unsubscribed_at_unknown')}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ml-3 ${
                      subscription.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {subscription.status}
                    </span>
                  </div>
                  {subscription.status === 'active' && (
                    <button
                      onClick={() => handleUnsubscribe(subscription.email)}
                      className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {t('admin.newsletter_unsubscribe_button') || 'Unsubscribe'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsletterPage;

