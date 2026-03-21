'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banner } from '@/lib/firestore/banners';
import { getAllBanners, deleteBanner, updateBanner } from '@/lib/firestore/banners_db';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const BannerList = () => {
  const { t } = useLanguage();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchBanners = useCallback(async () => {
    try {
      const fetchedBanners = await getAllBanners();
      // Sort by order if available
      const sortedBanners = fetchedBanners.sort((a, b) => (a.order || 0) - (b.order || 0));
      setBanners(sortedBanners);
    } catch {
      // Error fetching banners
      setError(t('admin.banners_fetch_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const data = await getSettings();
        if (data) {
          setSettings({ ...defaultSettings, ...data });
        }
      } catch {
        // Failed to fetch settings
      }
    };
    fetchSettingsData();
  }, []);

  const handleDelete = async (id: string) => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(t('admin.banners_delete_confirm') || 'Are you sure you want to delete this banner?');
    setConfirmDialogAction(() => async () => {
      try {
        await deleteBanner(id);
        setBanners(banners.filter(b => b.id !== id));
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.banners_delete_success') || 'Banner deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Error deleting banner
        setInfoDialogMessage(t('admin.banners_delete_failed') || 'Failed to delete banner.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    const count = selectedIds.size;
    setConfirmDialogMessage(t('admin.banners_batch_delete_confirm', { count: count.toString() }) || `Are you sure you want to delete ${count} banner(s)?`);
    setConfirmDialogAction(() => async () => {
      try {
        const deletePromises = Array.from(selectedIds).map(id => deleteBanner(id));
        await Promise.all(deletePromises);
        setBanners(banners.filter(banner => !selectedIds.has(banner.id!)));
        setSelectedIds(new Set());
        setInfoDialogMessage(t('admin.banners_batch_delete_success', { count: count.toString() }) || `${count} banner(s) deleted successfully!`);
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        setInfoDialogMessage(t('admin.banners_batch_delete_failed') || 'Failed to delete banners.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedBanners.map(banner => banner.id!).filter(Boolean) as string[];
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Pagination logic
  const totalPages = Math.ceil(banners.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBanners = banners.slice(startIndex, endIndex);
  const isAllSelected = paginatedBanners.length > 0 && paginatedBanners.every(banner => banner.id && selectedIds.has(banner.id));
  const isSomeSelected = paginatedBanners.some(banner => banner.id && selectedIds.has(banner.id));

  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const newBanners = [...banners];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap order in local state first for instant feedback
    [newBanners[index], newBanners[swapIndex]] = [newBanners[swapIndex], newBanners[index]];
    setBanners(newBanners);

    // Update in DB
    try {
        await updateBanner(newBanners[index].id!, { order: swapIndex });
        await updateBanner(newBanners[swapIndex].id!, { order: index }); 
    } catch {
        // Failed to reorder
        // Revert on error
        fetchBanners();
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {t('admin.banners_page_title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.banners_page_subtitle')}
          </p>
        </div>
        <Link
          href="/admin/banners/new"
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.banners_add_button')}
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Batch Actions & Items Per Page */}
      {banners.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  {t('admin.common.delete_selected') || 'Delete Selected'} ({selectedIds.size})
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {t('admin.common.clear_selection') || 'Clear Selection'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 font-medium">{t('admin.common.items_per_page') || 'Items per page'}:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {banners.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium mb-2">
              {t('admin.banners_empty_title')}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {t('admin.banners_empty_subtitle')}
            </p>
            <Link
              href="/admin/banners/new"
              className="inline-flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('admin.banners_empty_cta')}
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = isSomeSelected && !isAllSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                      />
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_image')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_title')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_subtitle')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_device_type')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_link')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_status')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_order')}
                    </th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('admin.banners_table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBanners.map((banner) => {
                    const originalIndex = banners.findIndex(b => b.id === banner.id);
                    return (
                    <tr key={banner.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(banner.id!) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={banner.id ? selectedIds.has(banner.id) : false}
                          onChange={(e) => banner.id && handleSelectItem(banner.id, e.target.checked)}
                          className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {banner.imageUrl ? (
                          <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-gray-100">
                            <Image
                              src={banner.imageUrl}
                              alt={banner.title || 'Banner'}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                            <span className="text-xs text-gray-400">
                              {t('shop.no_image')}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{banner.title || (t('admin.banners_untitled') || 'Untitled')}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate">{banner.subtitle || '-'}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${
                          banner.deviceType === 'desktop' ? 'bg-blue-50 text-blue-700' :
                          banner.deviceType === 'mobile' ? 'bg-purple-50 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {banner.deviceType === 'desktop'
                            ? t('admin.banners_device_desktop')
                            : banner.deviceType === 'mobile'
                            ? t('admin.banners_device_mobile')
                            : t('admin.banners_device_both')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {banner.linkTo ? (
                          <a
                            href={banner.linkTo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 truncate max-w-xs block"
                          >
                            {banner.linkTo}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${
                            banner.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {banner.isActive ? t('admin.status_active') : t('admin.status_inactive')}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveBanner(originalIndex, 'up')}
                            disabled={originalIndex === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('admin.banners_move_up_title')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <span className="text-sm text-gray-500 min-w-[2rem] text-center">{originalIndex + 1}</span>
                          <button
                            onClick={() => moveBanner(originalIndex, 'down')}
                            disabled={originalIndex === banners.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('admin.banners_move_down_title')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => router.push(`/admin/banners/edit/${banner.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(banner.id!)}
                            className="text-red-600 hover:text-red-800 font-medium transition-colors"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedBanners.map((banner) => {
                const originalIndex = banners.findIndex(b => b.id === banner.id);
                return (
                <div key={banner.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(banner.id!) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={banner.id ? selectedIds.has(banner.id) : false}
                      onChange={(e) => banner.id && handleSelectItem(banner.id, e.target.checked)}
                      className="w-4 h-4 mt-1 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                  <div className="flex items-start gap-4 flex-1">
                    {banner.imageUrl ? (
                      <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={banner.imageUrl}
                          alt={banner.title || 'Banner'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {t('shop.no_image')}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{banner.title || (t('admin.banners_untitled') || 'Untitled')}</h3>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{banner.subtitle || '-'}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${
                          banner.deviceType === 'desktop' ? 'bg-blue-50 text-blue-700' :
                          banner.deviceType === 'mobile' ? 'bg-purple-50 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {banner.deviceType === 'desktop'
                            ? t('admin.banners_device_desktop')
                            : banner.deviceType === 'mobile'
                            ? t('admin.banners_device_mobile')
                            : t('admin.banners_device_both')}
                        </span>
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md ${
                            banner.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {banner.isActive ? t('admin.status_active') : t('admin.status_inactive')}
                        </span>
                      </div>
                      {banner.linkTo && (
                        <a
                          href={banner.linkTo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 truncate block"
                        >
                          {banner.linkTo}
                        </a>
                      )}
                    </div>
                  </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveBanner(originalIndex, 'up')}
                        disabled={originalIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={t('admin.banners_move_up_title')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <span className="text-sm text-gray-500 min-w-[2rem] text-center">{originalIndex + 1}</span>
                      <button
                        onClick={() => moveBanner(originalIndex, 'down')}
                        disabled={originalIndex === banners.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={t('admin.banners_move_down_title')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/admin/banners/edit/${banner.id}`)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id!)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-700">
                  {t('admin.common.showing') || 'Showing'} {startIndex + 1} {t('admin.common.to') || 'to'} {Math.min(endIndex, banners.length)} {t('admin.common.of') || 'of'} {banners.length} {t('admin.common.results') || 'results'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.previous') || 'Previous'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('admin.common.next') || 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />

      {/* Confirm Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title={t('common.confirm') || 'Confirm'}
        message={confirmDialogMessage}
        type="confirm"
        onConfirm={() => {
          if (confirmDialogAction) {
            confirmDialogAction();
          }
          setShowConfirmDialog(false);
        }}
        confirmText={t('common.confirm') || 'Confirm'}
        cancelText={t('common.cancel') || 'Cancel'}
      />
    </div>
  );
};

export default BannerList;
