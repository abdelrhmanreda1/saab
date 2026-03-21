'use client';

import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app, db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { Order, OrderStatus } from '@/lib/firestore/orders';
import { useCart } from '../../../context/CartContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { useSettings } from '../../../context/SettingsContext';
import { formatDateOnly } from '@/lib/utils/dateTime';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { LanguageContext } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import Dialog from '../../../components/ui/Dialog';
import AccountMobileNav from '@/components/AccountMobileNav';
import { getProductPricingSummary } from '@/lib/utils/product-pricing';

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  
  // Dialog states
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogTitle, setInfoDialogTitle] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const { demoUser } = useAuth();
  const router = useRouter();
  const auth = getAuth(app);
  const languageContext = useContext(LanguageContext);
  const t = useMemo(
    () => (languageContext?.t ? languageContext.t : (key: string) => key),
    [languageContext],
  );

  const fetchOrdersFromApi = useCallback(async (firebaseUser: User) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch('/api/account/orders', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to fetch orders');
    }

    setOrders((result.orders || []) as Order[]);
  }, []);

  const fetchAuthorizedOrder = useCallback(
    async (orderId: string) => {
      if (!user) {
        throw new Error('You must be logged in to view this order.');
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/account/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to fetch order');
      }

      return result.order as Order;
    },
    [user]
  );

  useEffect(() => {
    // Check for demo user first
    if (settings?.demoMode && demoUser) {
      setUser(null); // No Firebase Auth user in demo mode
      const fetchOrdersForDemoUser = async () => {
        try {
          // Fetch products first to get images
          const allProducts = await getAllProducts();
          const productsMap = new Map<string, Product>();
          allProducts.forEach(product => {
            productsMap.set(product.id, product);
          });
          setProducts(productsMap);

          const q = query(collection(db, 'orders'), where('userId', '==', demoUser.uid), orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          const fetchedOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
          setOrders(fetchedOrders);
        } catch {
          // Error fetching orders
          setOrders([]);
        }
        setLoading(false);
      };
      fetchOrdersForDemoUser();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
            // Fetch products first to get images
            const allProducts = await getAllProducts();
            const productsMap = new Map<string, Product>();
            allProducts.forEach(product => {
              productsMap.set(product.id, product);
            });
            setProducts(productsMap);

            await fetchOrdersFromApi(currentUser);
        } catch {
            // Error fetching orders
            setOrders([]);
        }
      } else {
        setOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, settings?.demoMode, demoUser, fetchOrdersFromApi]);

  const handleCancelOrderClick = (orderId: string) => {
    if (!orderId) {
      setCancelError(t('account.orders.cancel_failed') || 'Failed to cancel order. Order ID is missing.');
      setShowCancelDialog(true);
      return;
    }

    if (!user?.uid) {
      setCancelError(t('account.orders.cancel_failed') || 'You must be logged in to cancel an order.');
      setShowCancelDialog(true);
      return;
    }

    setOrderToCancel(orderId);
    setCancelError(null);
    setCancelSuccess(false);
    setShowCancelDialog(true);
  };

  const handleCancelOrderConfirm = async () => {
    const userId = user?.uid || (settings?.demoMode && demoUser ? demoUser.uid : null);
    if (!orderToCancel || !userId) {
      setCancelError(t('account.orders.cancel_failed') || 'Invalid order or user information.');
      return;
    }
    
    setCancellingOrderId(orderToCancel);
    setCancelError(null);
    setCancelSuccess(false);
    
    try {
      if (settings?.demoMode && demoUser) {
        throw new Error('Order cancellation is unavailable in demo mode.');
      }

      if (!user) {
        throw new Error('You must be logged in to cancel an order.');
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/account/orders/${orderToCancel}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to cancel order');
      }

      // Update local state
      setOrders(orders.map(order => 
        order.id === orderToCancel 
          ? { ...order, status: OrderStatus.Cancelled }
          : order
      ));
      setCancelSuccess(true);
      // Close dialog after 2 seconds
      setTimeout(() => {
        setShowCancelDialog(false);
        setOrderToCancel(null);
        setCancelSuccess(false);
        setCancellingOrderId(null);
      }, 2000);
    } catch (error) {
      // Error cancelling order
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCancelError(t('account.orders.cancel_failed') || `Failed to cancel order: ${errorMessage}`);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleCancelDialogClose = () => {
    if (!cancellingOrderId) {
      setShowCancelDialog(false);
      setOrderToCancel(null);
      setCancelError(null);
      setCancelSuccess(false);
    }
  };

  const handleReorder = async (order: Order) => {
    try {
      // Fetch products and add to cart
      const { getAllProducts } = await import('@/lib/firestore/products_db');
      const products = await getAllProducts();
      let addedItems = 0;
      
      for (const orderItem of order.items) {
        const product = products.find(p => p.id === orderItem.productId);
        if (product) {
          const variant = orderItem.variant 
            ? product.variants.find(v => v.id === orderItem.variant?.id)
            : undefined;
          const pricing = getProductPricingSummary(
            product,
            settings?.goldPricing,
            settings?.goldPricing?.cache
          );
          addToCart({ ...product, price: pricing.currentPrice, salePrice: undefined }, orderItem.quantity, variant);
          addedItems += 1;
        }
      }

      if (addedItems === 0) {
        setInfoDialogTitle(t('common.error') || 'Error');
        setInfoDialogMessage(t('account.orders.reorder_failed') || 'Failed to add items to cart.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        return;
      }
      
      router.push('/cart');
    } catch {
      // Error reordering
      setInfoDialogTitle(t('common.error') || 'Error');
      setInfoDialogMessage(t('account.orders.reorder_failed') || 'Failed to add items to cart.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const order = orders.find((entry) => entry.id === orderId) || await fetchAuthorizedOrder(orderId);
      if (!order) {
        setInfoDialogTitle(t('common.error') || 'Error');
        setInfoDialogMessage(t('account.orders.invoice_not_found') || 'Order not found.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
        return;
      }
      
      // Generate invoice HTML
      const invoiceHTML = generateInvoiceHTML(order);
      
      // Create blob and download
      const blob = new Blob([invoiceHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${orderId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Error downloading invoice
      setInfoDialogTitle(t('common.error') || 'Error');
      setInfoDialogMessage(t('account.orders.invoice_download_failed') || 'Failed to download invoice.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const generateInvoiceHTML = (order: Order): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>${t('account.orders.invoice_title')} - ${order.id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .invoice-details { margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
    .total { text-align: right; font-weight: bold; font-size: 18px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${t('account.orders.invoice_title')}</h1>
    <p>${t('account.orders.invoice_order')} #${order.id}</p>
  </div>
  <div class="invoice-details">
    <p><strong>${t('account.orders.invoice_date')}:</strong> ${formatDateOnly(order.createdAt, {
      dateFormat: settings.site.dateFormat,
      timezone: settings.site.timezone,
    })}</p>
    <p><strong>${t('account.orders.invoice_status')}:</strong> ${order.status}</p>
    <p><strong>${t('account.orders.invoice_payment_method')}:</strong> ${order.paymentMethod}</p>
  </div>
  <h2>${t('account.orders.invoice_shipping_address')}</h2>
  <p>${order.shippingAddress?.fullName || ''}<br>
  ${order.shippingAddress?.address || ''}<br>
  ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zipCode || ''}</p>
  <h2>${t('account.orders.invoice_order_items')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('account.orders.invoice_product')}</th>
        <th>${t('account.orders.invoice_quantity')}</th>
        <th>${t('account.orders.invoice_price')}</th>
        <th>${t('account.orders.invoice_total')}</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map(item => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>${formatPrice(item.price)}</td>
          <td>${formatPrice(item.price * item.quantity)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="total">
    <p>${t('account.orders.invoice_total_amount')}: ${formatPrice(order.totalAmount)}</p>
  </div>
</body>
</html>
    `;
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="bg-gray-50 border-b border-gray-100 py-12 mb-10">
          <div className="page-container">
            <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-96 animate-pulse" />
          </div>
        </div>

        <div className="page-container pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sidebar Skeleton */}
            <div className="hidden md:block">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>

            {/* Orders Skeleton */}
            <div className="md:col-span-2 space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-6 py-5 border-b border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex gap-6">
                        <div className="h-12 bg-gray-200 rounded w-32 animate-pulse" />
                        <div className="h-12 bg-gray-200 rounded w-24 animate-pulse" />
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-20 animate-pulse" />
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {[1, 2].map((j) => (
                      <div key={j} className="flex gap-4 pb-4 border-b border-gray-100">
                        <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse" />
                        <div className="flex-grow space-y-2">
                          <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
                          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                        </div>
                        <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
                      </div>
                    ))}
                    <div className="mt-6 pt-6 border-t border-gray-100 flex gap-3 justify-end">
                      <div className="h-9 bg-gray-200 rounded-lg w-28 animate-pulse" />
                      <div className="h-9 bg-gray-200 rounded-lg w-28 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if user is logged in (either Firebase Auth user or demo user)
  const isLoggedIn = user || (settings?.demoMode && demoUser);
  
  if (!isLoggedIn) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
              <h1 className="text-3xl font-heading font-bold mb-4 text-gray-900">
                {t('account.orders.login_title')}
              </h1>
              <p className="text-gray-500 mb-8">
                {t('account.orders.login_message')}
              </p>
              <Link href="/login" className="bg-black text-white px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                  {t('account.orders.login_button')}
              </Link>
          </div>
      )
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-gray-50 border-b border-gray-100 py-6 md:py-12 mb-6 md:mb-10">
        <div className="page-container">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-heading font-bold text-gray-900 mb-2 text-center md:text-left">
            {t('account.title') || 'My Account'}
          </h1>
          <p className="text-sm md:text-base text-gray-500 text-center md:text-left">
            {t('account.orders.subtitle') || 'View and manage your orders.'}
          </p>
        </div>
      </div>

      <div className="page-container pb-12">
        <AccountMobileNav />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Sidebar / Navigation */}
          <div className="hidden md:block">
            <div className="bg-gray-50 rounded-xl p-4">
              <nav className="space-y-2">
                <Link href="/account/profile" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_profile')}
                </Link>
                <Link href="/account/orders" className="block px-4 py-2 bg-black text-white rounded-lg font-medium">
                  {t('account.nav_orders')}
                </Link>
                <Link href="/account/addresses" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_addresses')}
                </Link>
                <Link href="/account/returns" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_returns')}
                </Link>
                <Link href="/account/refunds" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_refunds')}
                </Link>
                <Link href="/account/preferences" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_preferences')}
                </Link>
                <Link href="/wishlist" className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                  {t('account.nav_wishlist')}
                </Link>
              </nav>
            </div>
          </div>

          {/* Right Column: Orders Content */}
          <div className="md:col-span-2">
            {orders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                </div>
                <h2 className="text-xl font-heading font-bold mb-2 text-gray-900">
                  {t('account.orders.empty_title')}
                </h2>
                <p className="text-gray-500 mb-8">
                  {t('account.orders.empty_message')}
                </p>
                <Link href="/shop" className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-black rounded-full hover:bg-gray-900 transition-colors">
                  {t('account.orders.empty_cta')}
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order, index) => (
                  <div key={order.id || index} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Order Header */}
                <div className="bg-gray-50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100">
                    <div className="flex flex-wrap gap-6 text-sm">
                        <div>
                            <p className="text-gray-500 mb-1 text-xs font-medium">
                              {t('account.orders.order_placed') || 'Order Placed'}
                            </p>
                            <p className="font-medium text-gray-900 text-sm">
                              {formatDateOnly(order.createdAt, {
                                dateFormat: settings.site.dateFormat,
                                timezone: settings.site.timezone,
                              }) || 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500 mb-1 text-xs font-medium">
                              {t('account.orders.total') || 'Total'}
                            </p>
                            <p className="font-bold text-gray-900 text-sm">{formatPrice(order.totalAmount)}</p>
                        </div>
                        <div className="hidden md:block">
                            <p className="text-gray-500 mb-1 text-xs font-medium">
                              {t('account.orders.ship_to') || 'Ship To'}
                            </p>
                            <p className="font-medium text-gray-900 text-sm">
                              {order.shippingAddress?.fullName || t('common.account') || 'Account'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'delivered' ? 'bg-green-50 text-green-700' : 
                            order.status === 'cancelled' ? 'bg-red-50 text-red-700' : 
                            order.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                            'bg-yellow-50 text-yellow-700'
                        }`}>
                            {order.status}
                        </span>
                        <div className="text-right text-xs text-gray-500 font-mono">
                            #{order.id ? order.id.slice(0, 8) : 'N/A'}...
                        </div>
                    </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                    <div className="space-y-4">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex gap-4 items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                    {(() => {
                                      // Try to get image from order item first, then from product
                                      let imageUrl = item.productImage;
                                      if (!imageUrl) {
                                        const product = products.get(item.productId);
                                        if (product && product.images && product.images.length > 0) {
                                          imageUrl = product.images[0];
                                        }
                                      }
                                      
                                      return imageUrl ? (
                                        <Image 
                                            src={imageUrl} 
                                            alt={item.productName} 
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                      ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">
                                        IMG
                                    </div>
                                      );
                                    })()}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium text-sm text-gray-900">{item.productName}</h3>
                                            {item.variant && (
                                                <p className="text-xs text-gray-500 mt-0.5">{item.variant.name}: {item.variant.value}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-0.5">{(t('account.orders.quantity_label') || 'Quantity:')} {item.quantity}</p>
                                        </div>
                                        <p className="font-bold text-sm text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap justify-end gap-3">
                        {order.id && (
                            <>
                                <Link 
                                    href={`/account/orders/${order.id}`} 
                                    className="px-4 py-2 text-sm text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {t('account.orders.view_details')}
                                </Link>
                                {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                    <button
                                        onClick={() => handleCancelOrderClick(order.id!)}
                                        disabled={cancellingOrderId === order.id}
                                    className="px-4 py-2 text-sm text-red-600 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {cancellingOrderId === order.id ? t('account.orders.cancelling') : t('account.orders.cancel')}
                                    </button>
                                )}
                                {order.status === 'delivered' && (
                                    <Link 
                                        href={`/account/orders/${order.id}/return`} 
                                        className="px-4 py-2 text-sm text-blue-600 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        {t('account.orders.return_exchange')}
                                    </Link>
                                )}
                                <button
                                    onClick={() => handleReorder(order)}
                                    className="px-4 py-2 text-sm text-green-600 font-medium border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                    {t('account.orders.reorder')}
                                </button>
                                <button
                                    onClick={() => handleDownloadInvoice(order.id!)}
                                    className="px-4 py-2 text-sm text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {t('account.orders.download_invoice')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
              </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Order Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCancelDialogClose}>
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {cancelSuccess ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
                  {t('account.orders.cancel_success') || 'Order Cancelled Successfully'}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {t('account.orders.cancel_success_message') || 'Your order has been cancelled successfully.'}
                </p>
              </>
            ) : cancelError ? (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
                  {t('account.orders.cancel_failed') || 'Failed to Cancel Order'}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {cancelError}
                </p>
                <button
                  onClick={handleCancelDialogClose}
                  className="w-full bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition-colors"
                >
                  {t('common.close') || 'Close'}
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-yellow-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
                  {t('account.orders.cancel_confirm_title') || 'Cancel Order?'}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {t('account.orders.cancel_confirm') || 'Are you sure you want to cancel this order? This action cannot be undone.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelDialogClose}
                    disabled={cancellingOrderId !== null}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-full font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.cancel') || 'No, Keep Order'}
                  </button>
                  <button
                    onClick={handleCancelOrderConfirm}
                    disabled={cancellingOrderId !== null}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancellingOrderId ? (t('account.orders.cancelling') || 'Cancelling...') : (t('account.orders.confirm_cancel') || 'Yes, Cancel Order')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={infoDialogTitle}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default OrdersPage;
