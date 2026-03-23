'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((name) => name !== menuName)
        : [...prev, menuName]
    );
  };

  const handleLogout = async () => {
    try {
      const auth = await getFirebaseAuth();
      await signOut(auth);
      router.push('/login?returnUrl=/admin');
    } catch {
      // Failed to logout
    }
  };

  // Define Icons
  const Icons = {
    Dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
    Products: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3.75h3.75M12 15.75h3.75M12 7.5V3.75m0 3.75H3.75m16.5 0H3.75" />
      </svg>
    ),
    Sales: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
    Customer: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    Marketing: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.795l-1.014 5.795m0-11.59a23.877 23.877 0 0 1 1.014 5.795l-1.014 5.795m0 0a23.763 23.763 0 0 1-1.872-3.626" />
      </svg>
    ),
    Blogs: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
      </svg>
    ),
    PageManagement: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    Geography: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    Settings: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    ChevronDown: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    ),
    ChevronRight: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    ),
    Search: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    )
  };

  const menuItems = [
    { 
      name: t('admin.dashboard') || 'Dashboard', 
      path: '/admin', 
      icon: Icons.Dashboard 
    },
    { 
      name: t('admin.products') || 'Products', 
      icon: Icons.Products,
      submenu: [
        { name: t('admin.all_products') || 'All Products', path: '/admin/products' },
        ...(settings?.features?.productBundles ? [{ name: t('admin.product_bundles') || 'Product Bundles', path: '/admin/products/bundles' }] : []),
        { name: t('admin.categories') || 'Categories', path: '/admin/categories' },
        ...(settings?.features?.collections ? [{ name: t('admin.collections') || 'Collections', path: '/admin/collections' }] : []),
        { name: t('admin.brands') || 'Brands', path: '/admin/brands' },
        { name: t('admin.sizes') || 'Sizes', path: '/admin/sizes' },
        { name: t('admin.colors') || 'Colors', path: '/admin/colors' },
        ...(settings?.features?.productTemplates ? [{ name: t('admin.product_templates') || 'Product Templates', path: '/admin/products/templates' }] : []),
        ...(settings?.features?.importExport ? [{ name: t('admin.import_export') || 'Import/Export', path: '/admin/products/import-export' }] : []),
      ]
    },
    { 
      name: t('admin.inventory') || 'Inventory', 
      icon: Icons.Products,
      submenu: [
        { name: t('admin.stock_management') || 'Stock Management', path: '/admin/stocks' },
        { name: t('admin.inventory_alerts') || 'Inventory Alerts', path: '/admin/inventory-alerts' },
        { name: t('admin.warehouses') || 'Warehouses', path: '/admin/inventory/warehouses' },
        { name: t('admin.stock_transfers') || 'Stock Transfers', path: '/admin/inventory/stock-transfers' },
        { name: t('admin.stock_adjustments') || 'Stock Adjustments', path: '/admin/inventory/stock-adjustments' },
        { name: t('admin.stock_history') || 'Stock History', path: '/admin/inventory/stock-history' },
        { name: t('admin.suppliers') || 'Suppliers', path: '/admin/suppliers' },
        { name: t('admin.purchase_orders') || 'Purchase Orders', path: '/admin/purchase-orders' },
      ]
    },
    { 
      name: t('admin.sales') || 'Sales', 
      icon: Icons.Sales,
      submenu: [
        { name: t('admin.orders') || 'Orders', path: '/admin/orders' },
        { name: t('admin.reports') || 'Reports', path: '/admin/reports' },
        { name: t('admin.order_refunds') || 'Refunds', path: '/admin/orders/refunds' },
        { name: t('admin.order_returns') || 'Returns', path: '/admin/orders/returns' },
        { name: t('admin.batch_processing') || 'Batch Processing', path: '/admin/orders/batch-processing' },
      ]
    },
    { 
      name: t('admin.customers') || 'Customers', 
      icon: Icons.Customer,
      submenu: [
        { name: t('admin.customer_list') || 'Customer List', path: '/admin/customers' },
        ...(settings?.features?.customerSegmentation ? [{ name: t('admin.segmentation') || 'Customer Segmentation', path: '/admin/customers/segmentation' }] : []),
        { name: t('admin.live_chat') || 'Live Chat', path: '/admin/customers/live-chat' },
        { name: t('admin.contact') || 'Contact', path: '/admin/customers/contact' },
        { name: t('admin.career') || 'Career', path: '/admin/customers/career' },
        { name: t('admin.newsletter') || 'Newsletter', path: '/admin/customers/newsletter' },
        ...(settings?.features?.importExport ? [{ name: t('admin.import_export') || 'Import/Export', path: '/admin/customers/import-export' }] : []),
      ]
    },
    { 
      name: t('admin.marketing') || 'Marketing', 
      icon: Icons.Marketing,
      submenu: [
        { name: t('admin.banners') || 'Banners', path: '/admin/banners' },
        { name: t('admin.coupons') || 'Coupons', path: '/admin/coupons' },
        { name: t('admin.email_campaigns') || 'Email Campaigns', path: '/admin/marketing/email-campaigns' },
        { name: t('admin.push_campaigns') || 'Push Campaigns', path: '/admin/marketing/push-campaigns' },
        ...(settings?.features?.abandonedCarts ? [{ name: t('admin.abandoned_carts') || 'Abandoned Carts', path: '/admin/marketing/abandoned-carts' }] : []),
        { name: t('admin.flash_sales') || 'Flash Sales', path: '/admin/marketing/flash-sales' },
        { name: t('admin.email_marketing') || 'Email Marketing', path: '/admin/email-marketing' },
      ]
    },
    ...(settings?.features?.blog ? [{ 
      name: t('admin.blogs') || 'Blogs', 
      path: '/admin/posts', 
      icon: Icons.Blogs 
    }] : []),
    { 
      name: t('admin.page_management') || 'Page Management', 
      icon: Icons.PageManagement,
      submenu: [
        { name: t('admin.homepage_sections') || 'Homepage Sections', path: '/admin/homepage-sections' },
        { name: t('admin.about_us') || 'About Us', path: '/admin/pages/about' },
        { name: t('admin.privacy_policy') || 'Privacy Policy', path: '/admin/pages/privacy' },
        { name: t('admin.terms_of_service') || 'Terms of Service', path: '/admin/pages/terms' },
        { name: t('admin.shipping_returns') || 'Shipping & Returns', path: '/admin/pages/shipping' },
        { name: t('admin.size_guide') || 'Size Guide', path: '/admin/pages/size-guide' },
        { name: t('admin.store_locator') || 'Store Locator', path: '/admin/pages/store-locator' },
        { name: t('admin.careers') || 'Careers', path: '/admin/pages/careers' },
        { name: t('admin.faqs') || 'FAQs', path: '/admin/pages/faq' },
        { name: t('admin.contact_us') || 'Contact Us', path: '/admin/pages/contact' },
      ]
    },
    { 
      name: t('admin.shipping') || 'Shipping', 
      icon: Icons.Sales,
      submenu: [
        { name: t('admin.shipping_zones') || 'Shipping Zones', path: '/admin/shipping/zones' },
        { name: t('admin.shipping_rates') || 'Shipping Rates', path: '/admin/shipping/rates' },
        { name: t('admin.free_shipping_rules') || 'Free Shipping Rules', path: '/admin/shipping/free-shipping' },
        { name: t('admin.carriers') || 'Carriers', path: '/admin/shipping/carriers' },
        { name: t('admin.gift_wrap') || 'Gift Wrap', path: '/admin/shipping/gift-wrap' },
      ]
    },
    ...((settings?.geography?.countries || settings?.geography?.states || settings?.geography?.cities) ? [{
      name: t('admin.geography') || 'Geography', 
      icon: Icons.Geography,
      submenu: [
        ...(settings?.geography?.countries ? [{ name: t('admin.countries') || 'Countries', path: '/admin/geography/countries' }] : []),
        ...(settings?.geography?.states ? [{ name: t('admin.states') || 'States', path: '/admin/geography/states' }] : []),
        ...(settings?.geography?.cities ? [{ name: t('admin.cities') || 'Cities', path: '/admin/geography/cities' }] : []),
      ]
    }] : []),
    { 
      name: t('admin.settings') || 'Settings', 
      icon: Icons.Settings,
      submenu: [
        { name: t('admin.general_settings') || 'General Settings', path: '/admin/settings' },
        { name: t('admin.theme') || 'Theme', path: '/admin/settings/theme' },
        { name: t('admin.languages') || 'Languages', path: '/admin/settings/languages' },
        { name: t('admin.translations') || 'Translations', path: '/admin/settings/translations' },
        { name: t('admin.currencies') || 'Currencies', path: '/admin/settings/currencies' },
        { name: t('admin.tax_rates') || 'Tax Rates', path: '/admin/settings/tax-rates' },
        { name: t('admin.payment_settings_title') || 'Payment Settings', path: '/admin/settings/payment-settings' },
        { name: t('admin.payment_methods') || 'Payment Methods', path: '/admin/settings/payment-methods' },
        { name: t('admin.payment_gateways') || 'Payment Gateways', path: '/admin/settings/payment-gateways' },
        { name: t('admin.backup_restore') || 'Backup & Restore', path: '/admin/settings/backup-restore' },
      ]
    },
    { 
      name: t('admin.analytics') || 'Analytics', 
      icon: Icons.Sales,
      submenu: [
        { name: t('admin.sales_funnel') || 'Sales Funnel', path: '/admin/analytics/sales-funnel' },
        { name: t('admin.customer_behavior') || 'Customer Behavior', path: '/admin/analytics/customer-behavior' },
        { name: t('admin.product_performance') || 'Product Performance', path: '/admin/analytics/product-performance' },
        { name: t('admin.marketing_campaigns') || 'Marketing Campaigns', path: '/admin/analytics/marketing-campaigns' },
        { name: t('admin.inventory_reports') || 'Inventory Reports', path: '/admin/analytics/inventory-reports' },
        { name: t('admin.financial_reports') || 'Financial Reports', path: '/admin/analytics/financial-reports' },
        { name: t('admin.custom_reports') || 'Custom Reports', path: '/admin/analytics/custom-reports' },
        { name: t('admin.scheduled_reports') || 'Scheduled Reports', path: '/admin/analytics/scheduled-reports' },
      ]
    },
    { 
      name: t('admin.staff_management') || 'Staff Management', 
      path: '/admin/staff', 
      icon: Icons.Customer 
    },
    { 
      name: t('admin.activity_logs') || 'Activity Logs', 
      path: '/admin/activity-logs', 
      icon: Icons.Settings 
    },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    // If it's a direct link and matches search
    if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return true;
    }
    
    // If it has submenu, filter submenu items
    if (item.submenu) {
      const filteredSubmenu = item.submenu.filter(sub => 
        sub.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      // If parent matches or any child matches
      return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || filteredSubmenu.length > 0;
    }
    
    return false;
  }).map(item => {
    // If it has submenu and parent doesn't match, filter submenu
    if (item.submenu && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      const filteredSubmenu = item.submenu.filter(sub => 
        sub.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return {
        ...item,
        submenu: filteredSubmenu
      };
    }
    return item;
  });

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-72 bg-white text-gray-900 flex flex-col min-h-screen border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        shadow-xl md:shadow-none
      `}>
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{t('admin.panel') || 'Admin Panel'}</h2>
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={t('admin.menu_close') || 'Close menu'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* Search Box */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder={t('admin.search_menu') || 'Search menu...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 text-sm text-gray-900 placeholder-gray-400 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all border border-gray-200"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">
            {Icons.Search}
          </span>
        </div>
      </div>

      <nav className="flex-grow py-2 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {filteredMenuItems.map((item) => (
            <li key={item.name}>
              {item.submenu ? (
                // Menu Item with Submenu
                <div>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center justify-between py-2.5 px-3 rounded-md transition-all duration-150 ${
                      expandedMenus.includes(item.name) || searchQuery
                        ? 'bg-gray-100 text-gray-900' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${expandedMenus.includes(item.name) ? 'text-gray-900' : 'text-gray-500'}`}>
                        {item.icon}
                      </span>
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <span className={`transition-transform duration-200 text-gray-400 ${expandedMenus.includes(item.name) || searchQuery ? 'rotate-180' : ''}`}>
                      {Icons.ChevronDown}
                    </span>
                  </button>
                  
                  {/* Submenu List */}
                  {(expandedMenus.includes(item.name) || searchQuery) && (
                    <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
                      {item.submenu.map((subItem) => (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.path}
                            onClick={onClose}
                            className={`block py-2 px-3 rounded-md text-sm transition-colors ${
                              pathname === subItem.path
                                ? 'bg-gray-900 text-white font-medium'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            {subItem.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                // Direct Link
                <Link
                  href={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-md transition-all duration-150 ${
                    pathname === item.path
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`${pathname === item.path ? 'text-white' : 'text-gray-500'}`}>
                    {item.icon}
                  </span>
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleLogout}
          className="w-full bg-white hover:bg-gray-900 text-gray-700 hover:text-white font-medium py-2.5 px-4 rounded-md transition-all duration-200 flex items-center justify-center gap-2 group border border-gray-200 hover:border-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 transition-transform group-hover:-translate-x-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          {t('admin.logout') || 'Logout'}
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
