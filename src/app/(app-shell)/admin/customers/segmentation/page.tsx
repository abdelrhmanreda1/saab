'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getAllUsers } from '@/lib/firestore/users';
import { segmentAllCustomers } from '@/lib/firestore/customer_management_db';
import { CustomerSegment } from '@/lib/firestore/customer_management';
import { UserProfile } from '@/lib/firestore/users';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

const CustomerSegmentationPage = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [segments, setSegments] = useState<{ [userId: string]: CustomerSegment }>({});
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | 'all'>('all');
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const fetchedCustomers = await getAllUsers();
          setCustomers(fetchedCustomers.filter(c => c.role !== 'admin'));
          
          const customerSegments = await segmentAllCustomers();
          setSegments(customerSegments);
        } catch {
          // Error fetching data
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const filteredCustomers = selectedSegment === 'all'
    ? customers
    : customers.filter(c => segments[c.uid] === selectedSegment);

  const segmentCounts = Object.values(segments).reduce((acc, segment) => {
    acc[segment] = (acc[segment] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const getSegmentColor = (segment: CustomerSegment) => {
    switch (segment) {
      case CustomerSegment.VIP:
        return 'bg-purple-100 text-purple-800';
      case CustomerSegment.HighValue:
        return 'bg-blue-100 text-blue-800';
      case CustomerSegment.Frequent:
        return 'bg-green-100 text-green-800';
      case CustomerSegment.Regular:
        return 'bg-gray-100 text-gray-800';
      case CustomerSegment.New:
        return 'bg-yellow-100 text-yellow-800';
      case CustomerSegment.Inactive:
        return 'bg-red-100 text-red-800';
      case CustomerSegment.OneTime:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.customer_segmentation') || 'Customer Segmentation'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.customer_segmentation_subtitle') || 'Segment customers by behavior and value'}</p>
        </div>
        <button
          onClick={async () => {
            const customerSegments = await segmentAllCustomers();
            setSegments(customerSegments);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          {t('admin.resend_segmentation') || 'Resegment Customers'}
        </button>
      </div>

      {/* Segment Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <button
          onClick={() => setSelectedSegment('all')}
          className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
            selectedSegment === 'all'
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="font-semibold text-sm sm:text-base">{t('admin.customer_segmentation_all') || 'All'}</p>
          <p className="text-xs sm:text-sm opacity-70">{customers.length}</p>
        </button>
        {Object.values(CustomerSegment).map(segment => (
          <button
            key={segment}
            onClick={() => setSelectedSegment(segment)}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
              selectedSegment === segment
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-xs sm:text-sm capitalize">{segment.replace('_', ' ')}</p>
            <p className="text-xs opacity-70">{segmentCounts[segment] || 0}</p>
          </button>
        ))}
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.customer_segmentation_empty') || 'No customers found in this segment.'}</p>
            <p className="text-sm text-gray-400">{t('admin.customer_segmentation_empty_message') || 'Try selecting a different segment'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_segmentation_table_customer') || 'Customer'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_segmentation_table_email') || 'Email'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_segmentation_table_segment') || 'Segment'}</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.customer_segmentation_table_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="font-medium text-gray-900 text-sm">{customer.displayName || customer.email || (t('admin.customer_segmentation_customer') || 'Customer')}</div>
                        {customer.phoneNumber && (
                          <div className="text-xs text-gray-500">{customer.phoneNumber}</div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{customer.email}</td>
                      <td className="px-4 sm:px-6 py-4">
                        {segments[customer.uid] && (
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${getSegmentColor(segments[customer.uid])}`}>
                            {segments[customer.uid].replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <Link
                          href={`/admin/customers/${customer.uid}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {t('admin.customer_segmentation_view_details') || 'View Details'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <div key={customer.uid} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {customer.displayName || customer.email || (t('admin.customer_segmentation_customer') || 'Customer')}
                      </h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p className="truncate">{customer.email}</p>
                        {customer.phoneNumber && <p>{t('admin.customer_segmentation_table_phone') || 'Phone'}: {customer.phoneNumber}</p>}
                      </div>
                    </div>
                    {segments[customer.uid] && (
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ml-3 ${getSegmentColor(segments[customer.uid])}`}>
                        {segments[customer.uid].replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/admin/customers/${customer.uid}`}
                    className="block w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors text-center"
                  >
                    {t('admin.customer_segmentation_view_details') || 'View Details'}
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerSegmentationPage;

