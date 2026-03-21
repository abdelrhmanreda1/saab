'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getAllMarketingCampaigns } from '@/lib/firestore/analytics_db';
import { MarketingCampaign } from '@/lib/firestore/analytics';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';

const MarketingCampaignsPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const data = await getAllMarketingCampaigns();
          setCampaigns(data);
        } catch {
          // Error fetching campaigns
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const getStatusColor = (status: MarketingCampaign['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
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
            {t('admin.marketing_campaign_reports') || t('admin.marketing_campaigns') || 'Marketing Campaign Reports'}
          </h1>
          <p className="text-gray-500 text-sm">{t('admin.marketing_campaigns_subtitle') || 'Monitor campaign performance and ROI'}</p>
        </div>
        <Link
          href="/admin/analytics/marketing-campaigns/new"
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-sm text-center"
        >
          {t('admin.marketing_campaigns_new') || 'New Campaign'}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium">{t('admin.marketing_campaigns_empty') || 'No marketing campaigns found.'}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_name') || 'Campaign Name'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_type') || 'Type'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_status') || 'Status'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_impressions') || 'Impressions'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_clicks') || 'Clicks'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_ctr') || 'CTR'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_conversions') || 'Conversions'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_revenue') || 'Revenue'}</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('admin.marketing_campaigns_table_roi') || 'ROI'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 capitalize">{campaign.type}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{campaign.impressions.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{campaign.clicks.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{campaign.ctr.toFixed(2)}%</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{campaign.conversions.toLocaleString()}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatPrice(campaign.revenue)}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`text-sm font-medium ${
                          campaign.roi > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {campaign.roi > 0 ? '+' : ''}{campaign.roi.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{campaign.name}</h3>
                      <p className="text-xs text-gray-500 capitalize mb-2">{campaign.type}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ml-3 ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div><span className="font-medium">{t('admin.marketing_campaigns_table_impressions') || 'Impressions'}:</span> {campaign.impressions.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.marketing_campaigns_table_clicks') || 'Clicks'}:</span> {campaign.clicks.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.marketing_campaigns_table_ctr') || 'CTR'}:</span> {campaign.ctr.toFixed(2)}%</div>
                    <div><span className="font-medium">{t('admin.marketing_campaigns_table_conversions') || 'Conversions'}:</span> {campaign.conversions.toLocaleString()}</div>
                    <div><span className="font-medium">{t('admin.marketing_campaigns_table_revenue') || 'Revenue'}:</span> {formatPrice(campaign.revenue)}</div>
                    <div>
                      <span className="font-medium">{t('admin.marketing_campaigns_table_roi') || 'ROI'}:</span>{' '}
                      <span className={campaign.roi > 0 ? 'text-green-600' : 'text-red-600'}>
                        {campaign.roi > 0 ? '+' : ''}{campaign.roi.toFixed(1)}%
                      </span>
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

export default MarketingCampaignsPage;

