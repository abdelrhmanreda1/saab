'use client';

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { PurchaseOrder, PurchaseOrderItem } from '@/lib/firestore/suppliers';
import { addPurchaseOrder, updatePurchaseOrder, getPurchaseOrder, generateOrderNumber } from '@/lib/firestore/purchase_orders_db';
import { getAllSuppliers } from '@/lib/firestore/suppliers_db';
import { Supplier } from '@/lib/firestore/suppliers';
import { getAllProducts } from '@/lib/firestore/products_db';
import { Product } from '@/lib/firestore/products';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import Dialog from '../ui/Dialog';

interface PurchaseOrderFormProps {
  orderId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ orderId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(!!orderId);
  const [error, setError] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>>({
    orderNumber: generateOrderNumber(),
    supplierId: '',
    supplierName: '',
    items: [],
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
    status: 'draft',
    notes: '',
    createdBy: user?.uid || '',
  });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersData, productsData] = await Promise.all([
          getAllSuppliers(true),
          getAllProducts(),
        ]);
        setSuppliers(suppliersData);
        setProducts(productsData);

        if (orderId) {
          const fetchedOrder = await getPurchaseOrder(orderId);
          if (fetchedOrder) {
            setOrder({
              orderNumber: fetchedOrder.orderNumber,
              supplierId: fetchedOrder.supplierId,
              supplierName: fetchedOrder.supplierName,
              items: fetchedOrder.items,
              subtotal: fetchedOrder.subtotal,
              tax: fetchedOrder.tax,
              shipping: fetchedOrder.shipping,
              total: fetchedOrder.total,
              status: fetchedOrder.status,
              expectedDeliveryDate: fetchedOrder.expectedDeliveryDate,
              receivedDate: fetchedOrder.receivedDate,
              notes: fetchedOrder.notes || '',
              createdBy: fetchedOrder.createdBy,
            });
          }
        }
      } catch {
        // Failed to fetch data
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId, user]);

  useEffect(() => {
    const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal + order.tax + order.shipping;
    setOrder(prev => ({ ...prev, subtotal, total }));
  }, [order.items, order.tax, order.shipping]);

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supplierId = e.target.value;
    const supplier = suppliers.find(s => s.id === supplierId);
    setOrder(prev => ({
      ...prev,
      supplierId,
      supplierName: supplier?.name || '',
    }));
  };

  const handleAddItem = () => {
    if (!selectedProductId || itemQuantity <= 0 || itemUnitPrice <= 0) {
      alert(t('admin.purchase_orders.fill_all_fields') || 'Please fill all item fields');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const variant = selectedVariantId ? product.variants.find(v => v.id === selectedVariantId) : null;
    const totalPrice = itemQuantity * itemUnitPrice;

    const newItem: PurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      variantId: variant?.id,
      variantName: variant ? `${variant.name}: ${variant.value}` : undefined,
      quantity: itemQuantity,
      unitPrice: itemUnitPrice,
      totalPrice,
    };

    setOrder(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    // Reset form
    setSelectedProductId('');
    setSelectedVariantId('');
    setItemQuantity(1);
    setItemUnitPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order.supplierId || order.items.length === 0) {
      setInfoDialogMessage(t('admin.purchase_orders.select_supplier') || 'Please select a supplier and add at least one item');
      setShowInfoDialog(true);
      return;
    }

    const settings = await getSettings();
    if (settings?.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setShowInfoDialog(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (orderId) {
        await updatePurchaseOrder(orderId, order);
      } else {
        await addPurchaseOrder(order);
      }
      setInfoDialogMessage(orderId ? (t('admin.purchase_orders_update_success') || 'Purchase order updated successfully!') : (t('admin.purchase_orders_create_success') || 'Purchase order created successfully!'));
      setShowInfoDialog(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      // Failed to save purchase order
      setError(t('admin.purchase_orders_save_failed') || 'Failed to save purchase order. Please try again.');
      setInfoDialogMessage(t('admin.purchase_orders_save_failed') || 'Failed to save purchase order. Please try again.');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  if (loading && orderId && !order.supplierId) {
    return <div className="text-center py-12">{t('admin.purchase_orders_loading') || t('common.loading') || 'Loading...'}</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {orderId
          ? `${t('common.edit') || 'Edit'} ${t('admin.purchase_orders') || 'Purchase Orders'}`
          : `${t('common.add') || 'Add'} ${t('admin.purchase_orders') || 'Purchase Orders'}`}
      </h2>
      {error && <div className="text-red-500 bg-red-50 p-4 rounded-lg mb-6">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="orderNumber" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_order_number_label') || 'Order Number'}</label>
            <input
              type="text"
              id="orderNumber"
              value={order.orderNumber}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="supplierId" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_supplier_label') || 'Supplier'} *</label>
            <select
              id="supplierId"
              value={order.supplierId}
              onChange={handleSupplierChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">{t('admin.purchase_orders_select_supplier') || 'Select Supplier'}</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_status_label') || 'Status'}</label>
            <select
              id="status"
              value={order.status}
              onChange={(e) => setOrder(prev => ({ ...prev, status: e.target.value as PurchaseOrder['status'] }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            >
              <option value="draft">{t('admin.purchase_orders_status_draft') || 'Draft'}</option>
              <option value="pending">{t('admin.purchase_orders_status_pending') || 'Pending'}</option>
              <option value="approved">{t('admin.purchase_orders_status_approved') || 'Approved'}</option>
              <option value="ordered">{t('admin.purchase_orders_status_ordered') || 'Ordered'}</option>
              <option value="received">{t('admin.purchase_orders_status_received') || 'Received'}</option>
              <option value="cancelled">{t('admin.purchase_orders_status_cancelled') || 'Cancelled'}</option>
            </select>
          </div>

          <div>
            <label htmlFor="expectedDeliveryDate" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_expected_delivery_label') || 'Expected Delivery Date'}</label>
            <input
              type="date"
              id="expectedDeliveryDate"
              value={order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate.seconds * 1000).toISOString().split('T')[0] : ''}
              onChange={(e) => setOrder(prev => ({ ...prev, expectedDeliveryDate: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : undefined }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-bold mb-4">{t('admin.purchase_orders_add_items_title') || 'Add Items'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_product_label') || t('products.title') || 'Product'}</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedVariantId('');
                  const product = products.find(p => p.id === e.target.value);
                  if (product) {
                    setItemUnitPrice(product.price);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
              >
                <option value="">{t('admin.purchase_orders_select_product') || 'Select Product'}</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>

            {selectedProduct && selectedProduct.variants.length > 0 && (
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_variant_label') || 'Variant'}</label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => {
                    setSelectedVariantId(e.target.value);
                    const variant = selectedProduct.variants.find(v => v.id === e.target.value);
                    if (variant) {
                      setItemUnitPrice(selectedProduct.price + (variant.priceAdjustment || 0));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
                >
                  <option value="">{t('admin.purchase_orders_no_variant') || 'No Variant'}</option>
                  {selectedProduct.variants.map(variant => (
                    <option key={variant.id} value={variant.id}>{variant.name}: {variant.value}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">{t('products.quantity') || 'Quantity'}</label>
              <input
                type="number"
                min="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_unit_price_label') || 'Unit Price'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemUnitPrice}
                onChange={(e) => setItemUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('admin.purchase_orders_add_item_button') || 'Add Item'}
              </button>
            </div>
          </div>

          {order.items.length > 0 && (
            <div className="mt-6 border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('products.quantity') || 'Quantity'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.purchase_orders_unit_price_label') || 'Unit Price'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.purchase_orders_total_label') || 'Total'}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('admin.purchase_orders_action_label') || 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{item.productName}</div>
                        {item.variantName && <div className="text-gray-500 text-xs">{item.variantName}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPrice(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(item.totalPrice)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('common.remove') || 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
          <div>
            <label htmlFor="tax" className="block text-gray-700 text-sm font-bold mb-2">{t('checkout.tax') || 'Tax'}</label>
            <input
              type="number"
              id="tax"
              min="0"
              step="0.01"
              value={order.tax}
              onChange={(e) => setOrder(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div>
            <label htmlFor="shipping" className="block text-gray-700 text-sm font-bold mb-2">{t('products.shipping') || 'Shipping'}</label>
            <input
              type="number"
              id="shipping"
              min="0"
              step="0.01"
              value={order.shipping}
              onChange={(e) => setOrder(prev => ({ ...prev, shipping: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex justify-end">
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">{t('cart.subtotal') || 'Subtotal'}: {formatPrice(order.subtotal)}</div>
                <div className="text-sm text-gray-600 mb-1">{t('checkout.tax') || 'Tax'}: {formatPrice(order.tax)}</div>
                <div className="text-sm text-gray-600 mb-1">{t('checkout.shipping_cost') || t('products.shipping') || 'Shipping'}: {formatPrice(order.shipping)}</div>
                <div className="text-lg font-bold text-gray-900 mt-2">{t('cart.total') || 'Total'}: {formatPrice(order.total)}</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.purchase_orders_notes_label') || 'Notes'}</label>
            <textarea
              id="notes"
              value={order.notes}
              onChange={(e) => setOrder(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-70"
            disabled={loading}
          >
            {loading
              ? (t('common.saving') || 'Saving...')
              : orderId
                ? (t('admin.purchase_orders_update_button') || 'Update Order')
                : (t('admin.purchase_orders_create_button') || 'Create Order')}
          </button>
        </div>
      </form>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={t('common.error') || 'Error'}
        message={infoDialogMessage}
        type="error"
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default PurchaseOrderForm;

