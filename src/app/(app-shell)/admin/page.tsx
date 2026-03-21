'use client';

import { useEffect, useState } from 'react';
import { Order } from '@/lib/firestore/orders';
import { getAllOrders } from '@/lib/firestore/orders_db';
import { getAllProducts } from '@/lib/firestore/products_db';
import { getAllUsers, UserProfile } from '@/lib/firestore/users';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllBrands } from '@/lib/firestore/brands_db';
import { getAllInventoryAlerts } from '@/lib/firestore/inventory_alerts_db';
import { Product } from '@/lib/firestore/products';
import { Category } from '@/lib/firestore/categories';
import { Brand } from '@/lib/firestore/brands';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// Helper interface for Order Items
interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    image?: string;
}


const Dashboard = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [stats, setStats] = useState({
    orders: [] as Order[],
    products: [] as Product[],
    users: [] as UserProfile[],
    categories: [] as Category[],
    brands: [] as Brand[],
    inventoryAlerts: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedOrders, fetchedProducts, fetchedUsers, fetchedCategories, fetchedBrands, fetchedAlerts] = await Promise.all([
          getAllOrders(),
          getAllProducts(),
          getAllUsers(),
          getAllCategories(),
          getAllBrands(),
          getAllInventoryAlerts(false)
        ]);
        
        setStats({
          orders: fetchedOrders,
          products: fetchedProducts,
          users: fetchedUsers,
          categories: fetchedCategories,
          brands: fetchedBrands,
          inventoryAlerts: fetchedAlerts.length,
        });
      } catch {
        setError(t('admin.dashboard_fetch_failed'));
        // Error fetching dashboard data
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80vh]">
        <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-black"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold">
                {t('admin.common.loading') || 'Loading...'}
            </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm">
        {t('common.error')}: {error}
      </div>
    );
  }

  // --- METRICS CALCULATION ---

  // 1. Basic Counts
  const totalOrders = stats.orders.length;
  const totalRevenue = stats.orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalProducts = stats.products.length;
  const totalCustomers = stats.users.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 2. Order Status
  const pendingOrders = stats.orders.filter(order => order.status === 'pending').length;
  const deliveredOrders = stats.orders.filter(order => order.status === 'delivered').length;
  const cancelledOrders = stats.orders.filter(order => order.status === 'cancelled').length;
  const processingOrders = stats.orders.filter(order => order.status === 'processing').length;

  // 3. Inventory Health
  const lowStockProducts = stats.products.filter(product => {
      const totalStock = product.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;
      return totalStock > 0 && totalStock < 10;
  });
  const outOfStockProducts = stats.products.filter(product => {
      const totalStock = product.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;
      return totalStock === 0;
  });

  // 4. Top Selling Products (Derived from Orders)
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  
  stats.orders.forEach(order => {
      if (order.status !== 'cancelled' && Array.isArray(order.items)) {
          (order.items as OrderItem[]).forEach(item => {
              const current = productSalesMap.get(item.productName) || { name: item.productName, quantity: 0, revenue: 0 };
              productSalesMap.set(item.productName, {
                  name: item.productName,
                  quantity: current.quantity + item.quantity,
                  revenue: current.revenue + (item.price * item.quantity)
              });
          });
      }
  });

  const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

  // --- CHART DATA PREPARATION ---

  // A. Revenue Chart (Last 7 Days)
  const revenueData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDateStr = d.toDateString(); // For precise comparison

    const dailyRevenue = stats.orders
      .filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === fullDateStr && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return { name: dateStr, revenue: dailyRevenue };
  });

  // B. Order Status Pie Chart Data
  const orderStatusData = [
    { name: t('admin.pending') || 'Pending', value: pendingOrders, color: '#FFBB28' }, // Yellow
    { name: t('admin.processing') || 'Processing', value: processingOrders, color: '#0088FE' }, // Blue
    { name: t('admin.delivered') || 'Delivered', value: deliveredOrders, color: '#00C49F' }, // Green
    { name: t('admin.cancelled') || 'Cancelled', value: cancelledOrders, color: '#FF8042' }, // Orange
  ].filter(d => d.value > 0);

  // C. Top Customers (by Spend)
  const customerSpendMap = new Map<string, { name: string; spend: number; orders: number }>();
  stats.orders.forEach(order => {
      if (order.status !== 'cancelled') {
        const address = order.shippingAddress as { fullName?: string } | null;
        const name = address?.fullName || 'Guest'; // Use name or ID
        const current = customerSpendMap.get(name) || { name, spend: 0, orders: 0 };
        customerSpendMap.set(name, {
            name,
            spend: current.spend + order.totalAmount,
            orders: current.orders + 1
        });
      }
  });
  const topCustomers = Array.from(customerSpendMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.dashboard')}</h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">{t('admin.dashboard_overview')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium text-gray-500 bg-white px-3 sm:px-4 py-2 rounded-lg shadow-sm border border-gray-200 text-center sm:text-left">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <Link href="/admin/products/add" className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold uppercase tracking-wide hover:bg-gray-800 transition-colors shadow-sm text-center">
                + {t('admin.add_product')}
            </Link>
        </div>
      </div>

      {/* KEY METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Revenue */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">+12.5%</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">{t('admin.total_revenue') || 'Total Revenue'}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(totalRevenue)}</p>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
              {t('admin.active_label')}
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">
            {t('admin.total_orders')}
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalOrders}</p>
        </div>

        {/* Average Order Value */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-purple-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">
            {t('admin.avg_order_value')}
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(averageOrderValue)}</p>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-orange-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{totalCustomers} Total</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">
            {t('admin.customers')}
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            +{Math.ceil(totalCustomers * 0.1)} {t('admin.customers')}
          </p>
        </div>
      </div>

      {/* --- CHARTS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
        {/* Revenue Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">
                          {t('admin.revenue_overview')}
                        </h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(val) => `${formatPrice(val/1000)}k`} />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: unknown) => [
                              formatPrice(Number(value)),
                              t('admin.revenue_label'),
                            ]}
                        />
                        <CartesianGrid vertical={false} stroke="#f5f5f5" />
                        <Area type="monotone" dataKey="revenue" stroke="#000000" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Order Status Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              {t('admin.order_status_distribution')}
            </h3>
            <div className="h-64 w-full flex items-center justify-center">
                {orderStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={orderStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {orderStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="text-gray-400">
                      {t('admin.no_orders_chart')}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        {/* LEFT COLUMN (2/3) */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6 lg:space-y-8">
            
            {/* Recent Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{t('admin.recent_orders') || 'Recent Orders'}</h3>
                        <p className="text-xs text-gray-500">
                          {t('admin.manage_transactions')}
                        </p>
                    </div>
                    <Link
                      href="/admin/orders"
                      className="text-xs font-bold uppercase tracking-wider text-black hover:underline"
                    >
                        {t('admin.view_all')}
                    </Link>
                </div>
                
                {stats.orders.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-3 text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                        </svg>
                        {t('admin.no_orders')}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          {t('admin.order')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          {t('admin.customer')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          {t('admin.amount')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          {t('admin.status')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                          {t('admin.date')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {stats.orders.slice(0, 6).map((order) => {
                                        const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                                        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                                        const address = order.shippingAddress as { fullName?: string } | null;
                                        const customerName = address?.fullName || t('admin.guest_user');
                                        const customerInitial = customerName.charAt(0).toUpperCase();
                                        const orderId = order.id || t('common.not_available');

                                        return (
                                            <tr key={orderId} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-sm text-gray-600">#{orderId.slice(0, 8)}</span>
                                                </td>
                                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 mr-2">
                                                            {customerInitial}
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-900">{customerName}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {formatPrice(order.totalAmount)}
                                                </td>
                                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md
                                                        ${order.status === 'delivered' ? 'bg-green-50 text-green-700' : 
                                                        order.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 
                                                        order.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                                                        order.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                                                    <div className="font-medium">{formattedDate}</div>
                                                    <div className="text-xs text-gray-400">{time}</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-200">
                            {stats.orders.slice(0, 6).map((order) => {
                                const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                                const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                                const address = order.shippingAddress as { fullName?: string } | null;
                                const customerName = address?.fullName || t('admin.guest_user');
                                const customerInitial = customerName.charAt(0).toUpperCase();
                                const orderId = order.id || t('common.not_available');

                                return (
                                    <div key={orderId} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                                                    {customerInitial}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{customerName}</div>
                                                    <div className="text-xs text-gray-500 font-mono">#{orderId.slice(0, 8)}</div>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md
                                                ${order.status === 'delivered' ? 'bg-green-50 text-green-700' : 
                                                order.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 
                                                order.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                                                order.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="text-gray-600">
                                                <span className="font-medium">{formatPrice(order.totalAmount)}</span>
                                            </div>
                                            <div className="text-gray-500 text-xs">
                                                {formattedDate} {time}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Inventory Status - Horizontal */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex-1">
                                <h3 className="text-lg font-bold mb-1">
                                  {t('admin.inventory_health')}
                                </h3>
                        <p className="text-gray-400 text-sm mb-6">
                          {t('admin.stock_monitoring')}
                        </p>
                        
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex-1">
                                <div className="text-2xl font-bold">
                                  {totalProducts - outOfStockProducts.length}
                                </div>
                                <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
                                  {t('admin.in_stock')}
                                </div>
                            </div>
                            <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-4 flex-1 border border-yellow-500/30">
                                <div className="text-2xl font-bold text-yellow-400">
                                  {lowStockProducts.length}
                                </div>
                                <div className="text-xs text-yellow-400/80 uppercase tracking-wider mt-1">
                                  {t('admin.low_stock')}
                                </div>
                            </div>
                            <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 flex-1 border border-red-500/30">
                                <div className="text-2xl font-bold text-red-400">
                                  {outOfStockProducts.length}
                                </div>
                                <div className="text-xs text-red-400/80 uppercase tracking-wider mt-1">
                                  {t('admin.out_of_stock')}
                                </div>
                            </div>
                        </div>
                        {stats.inventoryAlerts > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <Link href="/admin/inventory-alerts" className="flex items-center justify-between bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg p-3 border border-yellow-500/30 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                        <span className="text-sm font-medium text-yellow-400">
                                          {t('admin.inventory_alerts_active', {
                                            count: stats.inventoryAlerts,
                                          })}
                                        </span>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-yellow-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </Link>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-shrink-0 bg-white/5 rounded-full p-6 border border-white/10">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-white/80">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                        </svg>
                    </div>
                </div>
                
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
            </div>
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="space-y-4 md:space-y-6 lg:space-y-8">

             {/* Top Customers Widget */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  {t('admin.top_customers')}
                </h3>
                <div className="space-y-6">
                    {topCustomers.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          {t('admin.no_customers_data')}
                        </p>
                    ) : (
                        topCustomers.map((customer, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                                        {customer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {customer.name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          {customer.orders}{' '}
                                          {t('admin.customer_orders_suffix')}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                    {formatPrice(customer.spend)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {/* Top Products */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  {t('admin.top_products')}
                </h3>
                <div className="space-y-6">
                    {topProducts.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          {t('admin.no_sales_data')}
                        </p>
                    ) : (
                        topProducts.map((product, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-gray-600 transition-colors">
                                          {product.name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          {product.quantity}{' '}
                                          {t('admin.sold_suffix')}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                    {formatPrice(product.revenue)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <Link
                      href="/admin/products"
                      className="block text-center text-xs font-bold uppercase tracking-widest text-black hover:text-gray-600 transition-colors"
                    >
                        {t('admin.manage_catalog')}
                    </Link>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
                <Link href="/admin/orders" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-black hover:shadow-md transition-all text-center group">
                    <div className="w-10 h-10 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-black group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-600">
                      {t('admin.orders_quick')}
                    </span>
                </Link>
                <Link href="/admin/users" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-black hover:shadow-md transition-all text-center group">
                    <div className="w-10 h-10 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-black group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-600">
                      {t('admin.users_quick')}
                    </span>
                </Link>
                <Link href="/admin/products" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-black hover:shadow-md transition-all text-center group">
                    <div className="w-10 h-10 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-black group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-600">
                      {t('admin.products_quick')}
                    </span>
                </Link>
                <Link href="/admin/settings" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-black hover:shadow-md transition-all text-center group">
                    <div className="w-10 h-10 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-black group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-600">
                      {t('admin.settings_quick')}
                    </span>
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
