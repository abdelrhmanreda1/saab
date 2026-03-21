'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getCustomerBehavior } from '@/lib/firestore/analytics_db';
import { CustomerBehavior } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const CustomerBehaviorPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [, setUser] = useState<User | null>(null);
  const [behaviors, setBehaviors] = useState<CustomerBehavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'activity'>('spent');
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const data = await getCustomerBehavior();
          setBehaviors(data);
        } catch {
          // Error fetching customer behavior
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const sortedBehaviors = [...behaviors].sort((a, b) => {
    switch (sortBy) {
      case 'spent':
        return b.totalSpent - a.totalSpent;
      case 'orders':
        return b.productsPurchased.length - a.productsPurchased.length;
      case 'activity':
        return b.lastActivity.seconds - a.lastActivity.seconds;
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.customer_behavior_analytics') || t('admin.customer_behavior') || 'Customer Behavior Analytics'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.customer_behavior_subtitle') || 'Analyze customer purchasing patterns'}</p>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'spent' | 'orders' | 'activity')}
          className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
        >
          <option value="spent">{t('admin.customer_behavior_sort_spent') || 'Sort by Total Spent'}</option>
          <option value="orders">{t('admin.customer_behavior_sort_orders') || 'Sort by Orders'}</option>
          <option value="activity">{t('admin.customer_behavior_sort_activity') || 'Sort by Last Activity'}</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {sortedBehaviors.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.customer_behavior_empty') || 'No customer behavior data available.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_customer') || 'Customer'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_total_spent') || 'Total Spent'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_avg_order_value') || 'Avg Order Value'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_products_viewed') || 'Products Viewed'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_products_purchased') || 'Products Purchased'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_return_customer') || 'Return Customer'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_behavior_table_last_activity') || 'Last Activity'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedBehaviors.map((behavior) => (
                    <tr key={behavior.userId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div>
                          <div className="font-medium text-sm text-gray-900">{behavior.userName}</div>
                          {behavior.userEmail && (
                            <div className="text-xs text-gray-500">{behavior.userEmail}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatPrice(behavior.totalSpent)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {formatPrice(behavior.averageOrderValue)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{behavior.productsViewed.length}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{behavior.productsPurchased.length}</td>
                      <td className="px-4 sm:px-6 py-4">
                        {behavior.returnCustomer ? (
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-md">
                            {t('admin.common.yes') || 'Yes'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-semibold rounded-md">
                            {t('admin.common.no') || 'No'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-gray-600">
                        {new Date(behavior.lastActivity.seconds * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {sortedBehaviors.map((behavior) => (
                <div key={behavior.userId} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="mb-3">
                    <div className="font-medium text-sm text-gray-900 mb-1">{behavior.userName}</div>
                    {behavior.userEmail && (
                      <div className="text-xs text-gray-500 mb-2">{behavior.userEmail}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div>
                      <span className="font-medium">{t('admin.customer_behavior_table_total_spent') || 'Total Spent'}:</span> {formatPrice(behavior.totalSpent)}
                    </div>
                    <div>
                      <span className="font-medium">{t('admin.customer_behavior_table_avg_order_value') || 'Avg Order'}:</span> {formatPrice(behavior.averageOrderValue)}
                    </div>
                    <div>
                      <span className="font-medium">{t('admin.customer_behavior_table_products_viewed') || 'Viewed'}:</span> {behavior.productsViewed.length}
                    </div>
                    <div>
                      <span className="font-medium">{t('admin.customer_behavior_table_products_purchased') || 'Purchased'}:</span> {behavior.productsPurchased.length}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      {behavior.returnCustomer ? (
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-md">
                          Return Customer
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-semibold rounded-md">
                          New Customer
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(behavior.lastActivity.seconds * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerBehaviorPage;

