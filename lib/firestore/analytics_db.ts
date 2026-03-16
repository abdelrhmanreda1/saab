import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { getAllOrders } from './orders_db';
import { getAllProducts } from './products_db';
import { getAllUsers } from './users';
import { getAllPurchaseOrders } from './purchase_orders_db';
import { getOrderRefunds } from './order_management_db';
import { getReviewsByProductId } from './reviews_enhanced_db';
import { getAllStockAdjustments } from './warehouses_db';
import { SalesFunnelStage, CustomerBehavior, ProductPerformance, MarketingCampaign, InventoryReport, FinancialReport, CustomReportTemplate, ScheduledReport } from './analytics';
import { ReturnExchangeRequest } from './user_account';

// ========== SALES FUNNEL ANALYSIS ==========
export const getSalesFunnel = async (startDate: Date, endDate: Date): Promise<SalesFunnelStage[]> => {
  const orders = await getAllOrders();
  const products = await getAllProducts();
   
  // Filter orders by date range
  const filteredOrders = orders.filter(order => {
    const orderDate = order.createdAt.toDate();
    return orderDate >= startDate && orderDate <= endDate;
  });

  // Calculate real visitor data from product views
  // Estimate unique visitors: total product views (assuming each view is a potential visitor)
  // In a real implementation, you'd track unique sessions, but for now we use product views as proxy
  const totalProductViews = products.reduce((sum, p) => {
    const views = p.analytics?.views || 0;
    // Only count views if product was viewed in date range (approximate by checking if product exists)
    return sum + views;
  }, 0);
  
  // Estimate unique visitors: assume each user views multiple products, so divide by average products per session
  // Conservative estimate: 3-5 products per session average
  const estimatedVisitors = Math.max(
    Math.floor(totalProductViews / 4), // Divide by 4 (average products per session)
    filteredOrders.length * 10 // At minimum, visitors should be at least 10x orders
  );
  
  const views = products.reduce((sum, p) => sum + (p.analytics?.views || 0), 0);
  const cartAdds = products.reduce((sum, p) => sum + (p.analytics?.addToCartCount || 0), 0);
  const checkouts = filteredOrders.length;
  const purchases = filteredOrders.filter(o => o.status === 'delivered' || o.status === 'shipped').length;

  const stages: SalesFunnelStage[] = [
    {
      stage: 'visitors',
      count: estimatedVisitors,
      percentage: 100,
    },
    {
      stage: 'views',
      count: views,
      percentage: estimatedVisitors > 0 ? (views / estimatedVisitors) * 100 : 0,
      dropoffRate: estimatedVisitors > 0 ? ((estimatedVisitors - views) / estimatedVisitors) * 100 : 0,
    },
    {
      stage: 'cart',
      count: cartAdds,
      percentage: estimatedVisitors > 0 ? (cartAdds / estimatedVisitors) * 100 : 0,
      dropoffRate: ((views - cartAdds) / views) * 100,
    },
    {
      stage: 'checkout',
      count: checkouts,
      percentage: estimatedVisitors > 0 ? (checkouts / estimatedVisitors) * 100 : 0,
      dropoffRate: ((cartAdds - checkouts) / cartAdds) * 100,
    },
    {
      stage: 'purchases',
      count: purchases,
      percentage: estimatedVisitors > 0 ? (purchases / estimatedVisitors) * 100 : 0,
      dropoffRate: ((checkouts - purchases) / checkouts) * 100,
    },
  ];

  return stages;
};

// ========== CUSTOMER BEHAVIOR ANALYTICS ==========
export const getCustomerBehavior = async (startDate?: Date, endDate?: Date): Promise<CustomerBehavior[]> => {
  const orders = await getAllOrders();
  const users = await getAllUsers();
  const products = await getAllProducts();

  const filteredOrders = startDate && endDate
    ? orders.filter(order => {
        const orderDate = order.createdAt.toDate();
        return orderDate >= startDate && orderDate <= endDate;
      })
    : orders;

  const behaviors: CustomerBehavior[] = users.map(user => {
    const userOrders = filteredOrders.filter(o => o.userId === user.uid);
    const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const productsPurchased = new Set<string>();
    const productsViewed = new Set<string>();

    userOrders.forEach(order => {
      order.items.forEach(item => {
        productsPurchased.add(item.productId);
      });
    });

    // Get viewed products from analytics (simplified)
    products.forEach(product => {
      if (product.analytics?.views && product.analytics.views > 0) {
        productsViewed.add(product.id);
      }
    });

    const averageOrderValue = userOrders.length > 0 ? totalSpent / userOrders.length : 0;

    // Calculate real sessions and pageViews from product analytics
    // Sessions: estimate based on order count (each order = at least 1 session)
    // PageViews: count total product views for products this user might have viewed
    // For logged-in users, we can track better, but for now estimate from orders
    const estimatedSessions = Math.max(userOrders.length, 1); // At least 1 session per order
    const estimatedPageViews = userOrders.length > 0 
      ? userOrders.length * 5 // Estimate 5 page views per order
      : (productsViewed.size > 0 ? productsViewed.size * 2 : 1); // Or 2 views per product viewed
    
    // Calculate cart abandonment rate
    const cartAbandonmentRate = estimatedSessions > 0 && userOrders.length > 0
      ? ((estimatedSessions - userOrders.length) / estimatedSessions) * 100
      : 0;

    return {
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown',
      userEmail: user.email || undefined,
      sessions: estimatedSessions,
      pageViews: estimatedPageViews,
      productsViewed: Array.from(productsViewed),
      productsPurchased: Array.from(productsPurchased),
      totalSpent,
      averageOrderValue,
      lastActivity: (user.createdAt && typeof user.createdAt.toDate === 'function') 
        ? Timestamp.fromDate(user.createdAt.toDate()) 
        : Timestamp.now(),
      returnCustomer: userOrders.length > 1,
      cartAbandonmentRate,
    };
  });

  return behaviors;
};

// ========== PRODUCT PERFORMANCE REPORTS ==========
export const getProductPerformance = async (startDate: Date, endDate: Date, productId?: string): Promise<ProductPerformance[]> => {
  const products = productId ? [] : await getAllProducts();
  const orders = await getAllOrders();
  
  // Get all return/exchange requests
  const returnRequestsCollection = collection(db, 'return_exchange_requests');
  const returnRequestsSnapshot = await getDocs(query(returnRequestsCollection, orderBy('createdAt', 'desc')));
  const returnRequests = returnRequestsSnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    createdAt: doc.data().createdAt,
    updatedAt: doc.data().updatedAt,
  } as ReturnExchangeRequest));

  const filteredOrders = orders.filter(order => {
    const orderDate = order.createdAt.toDate();
    return orderDate >= startDate && orderDate <= endDate;
  });

  // Filter return requests by date range
  const filteredReturns = returnRequests.filter(req => {
    const reqDate = req.createdAt.toDate();
    return reqDate >= startDate && reqDate <= endDate;
  });

  const performancesPromises = products.map(async (product) => {
    const analytics = product.analytics || { views: 0, clicks: 0, addToCartCount: 0, purchases: 0, conversionRate: 0 };
    const productOrders = filteredOrders.filter(o => 
      o.items.some(item => item.productId === product.id)
    );
    const revenue = productOrders.reduce((sum, order) => {
      const item = order.items.find(i => i.productId === product.id);
      return sum + (item ? item.price * item.quantity : 0);
    }, 0);

    // Calculate return rate from return/exchange requests
    const productReturns = filteredReturns.filter(req => 
      req.items.some(item => item.productId === product.id)
    );
    const totalUnitsSold = productOrders.reduce((sum, order) => {
      const item = order.items.find(i => i.productId === product.id);
      return sum + (item ? item.quantity : 0);
    }, 0);
    const totalUnitsReturned = productReturns.reduce((sum, req) => {
      const item = req.items.find(i => i.productId === product.id);
      return sum + (item ? item.quantity : 0);
    }, 0);
    
    const returnRate = totalUnitsSold > 0 
      ? (totalUnitsReturned / totalUnitsSold) * 100 
      : 0;

    // Get rating and review count from reviews collection
    let rating: number | undefined;
    let reviewCount: number | undefined;
    try {
      const reviews = await getReviewsByProductId(product.id);
      reviewCount = reviews.length;
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        rating = totalRating / reviews.length;
      }
    } catch {
      // Failed to fetch reviews for product
      // Continue without rating/reviewCount if fetch fails
    }

    return {
      productId: product.id,
      productName: product.name,
      views: analytics.views,
      clicks: analytics.clicks,
      addToCart: analytics.addToCartCount,
      purchases: analytics.purchases,
      revenue,
      conversionRate: analytics.conversionRate,
      averageOrderValue: productOrders.length > 0 ? revenue / productOrders.length : 0,
      returnRate,
      rating,
      reviewCount,
      period: {
        start: Timestamp.fromDate(startDate),
        end: Timestamp.fromDate(endDate),
      },
    };
  });

  const performances = await Promise.all(performancesPromises);
  return performances.sort((a, b) => b.revenue - a.revenue);
};

// ========== MARKETING CAMPAIGN REPORTS ==========
const campaignsCollectionRef = collection(db, 'marketing_campaigns');

export const addMarketingCampaign = async (campaign: Omit<MarketingCampaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newCampaignRef = await addDoc(campaignsCollectionRef, {
    ...campaign,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newCampaignRef.id;
};

export const getAllMarketingCampaigns = async (): Promise<MarketingCampaign[]> => {
  const querySnapshot = await getDocs(query(campaignsCollectionRef, orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingCampaign));
};

export const updateMarketingCampaign = async (id: string, campaign: Partial<Omit<MarketingCampaign, 'id' | 'createdAt'>>): Promise<void> => {
  const campaignDocRef = doc(db, 'marketing_campaigns', id);
  await updateDoc(campaignDocRef, {
    ...campaign,
    updatedAt: new Date(),
  });
};

// ========== INVENTORY REPORTS ==========
export const getInventoryReport = async (startDate: Date, endDate: Date): Promise<InventoryReport[]> => {
  const products = await getAllProducts();
  const orders = await getAllOrders();
  const purchaseOrders = await getAllPurchaseOrders();
  const stockAdjustments = await getAllStockAdjustments();

  const filteredOrders = orders.filter(order => {
    const orderDate = order.createdAt.toDate();
    return orderDate >= startDate && orderDate <= endDate;
  });

  // Filter purchase orders by date range
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    const poDate = po.createdAt.toDate();
    return poDate >= startDate && poDate <= endDate && (po.status === 'received' || po.status === 'approved');
  });

  // Filter stock adjustments by date range
  const filteredAdjustments = stockAdjustments.filter(adj => {
    const adjDate = adj.createdAt.toDate();
    return adjDate >= startDate && adjDate <= endDate;
  });

  const reports: InventoryReport[] = products.map(product => {
    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    const unitsSold = filteredOrders.reduce((sum, order) => {
      const item = order.items.find(i => i.productId === product.id);
      return sum + (item ? item.quantity : 0);
    }, 0);

    // Calculate units received from purchase orders
    const unitsReceived = filteredPurchaseOrders.reduce((sum, po) => {
      const item = po.items.find(i => i.productId === product.id);
      return sum + (item ? item.quantity : 0);
    }, 0);

    // Calculate units adjusted from stock adjustments
    const unitsAdjusted = filteredAdjustments.reduce((sum, adj) => {
      if (adj.productId === product.id) {
        // Positive quantity means stock added, negative means stock removed
        // adjustmentType 'increase' = positive, 'decrease' = negative
        const quantity = adj.adjustmentType === 'increase' ? adj.quantity : -adj.quantity;
        return sum + quantity;
      }
      return sum;
    }, 0);

    const stockValue = totalStock * product.price;
    const salesValue = unitsSold * product.price;
    const turnoverRate = totalStock > 0 ? (unitsSold / totalStock) * 100 : 0;
    const daysOfStock = unitsSold > 0 ? (totalStock / (unitsSold / 30)) : 999; // Approximate
    const initialStock = totalStock + unitsSold - unitsReceived - unitsAdjusted; // More accurate calculation

    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      brand: product.brandId,
      currentStock: totalStock,
      initialStock: Math.max(0, initialStock), // Ensure non-negative
      unitsSold,
      unitsReceived,
      unitsAdjusted,
      stockValue,
      salesValue,
      turnoverRate,
      daysOfStock,
      lowStockAlert: totalStock < 10,
      period: {
        start: Timestamp.fromDate(startDate),
        end: Timestamp.fromDate(endDate),
      },
    };
  });

  return reports;
};

// ========== FINANCIAL REPORTS ==========
export const getFinancialReport = async (startDate: Date, endDate: Date): Promise<FinancialReport> => {
  const orders = await getAllOrders();
  const purchaseOrders = await getAllPurchaseOrders();
  const refunds = await getOrderRefunds();

  const filteredOrders = orders.filter(order => {
    const orderDate = order.createdAt.toDate();
    return orderDate >= startDate && orderDate <= endDate;
  });

  const completedOrders = filteredOrders.filter(o => o.status === 'delivered');
  const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const shippingRevenue = completedOrders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
  const productSales = totalRevenue - shippingRevenue;

  // Calculate real product costs from purchase orders
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    const poDate = po.createdAt.toDate();
    return poDate >= startDate && poDate <= endDate && (po.status === 'received' || po.status === 'approved');
  });
  
  const productCost = filteredPurchaseOrders.reduce((sum, po) => {
    const orderCost = po.items.reduce((itemSum, item) => {
      // Use totalPrice if available, otherwise calculate from unitPrice
      return itemSum + (item.totalPrice || (item.unitPrice * item.quantity));
    }, 0);
    return sum + orderCost;
  }, 0);

  // If no purchase orders, estimate from product sales (fallback to 60% if no data)
  const estimatedProductCost = productCost > 0 
    ? productCost 
    : productSales * 0.6; // Fallback estimate

  // Calculate shipping costs (estimate 50% of shipping revenue as cost)
  const shippingCost = shippingRevenue * 0.5;

  // Calculate marketing costs from marketing campaigns
  const marketingCampaigns = await getAllMarketingCampaigns();
  const filteredCampaigns = marketingCampaigns.filter(campaign => {
    const campaignStart = campaign.startDate.toDate();
    const campaignEnd = campaign.endDate?.toDate() || new Date();
    return campaignStart >= startDate && campaignEnd <= endDate;
  });
  const marketingCost = filteredCampaigns.reduce((sum, campaign) => sum + (campaign.spent || 0), 0);

  // Operational costs: estimate as 15% of revenue if no specific tracking
  const operationalCost = totalRevenue * 0.15;

  const totalCosts = estimatedProductCost + shippingCost + marketingCost + operationalCost;
  const grossProfit = totalRevenue - (estimatedProductCost + shippingCost);
  const netProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Calculate taxes from orders
  const taxesCollected = completedOrders.reduce((sum, o) => sum + (o.tax || 0), 0);

  // Calculate refunded amount
  const filteredRefunds = refunds.filter(refund => {
    const refundDate = refund.createdAt.toDate();
    return refundDate >= startDate && refundDate <= endDate && refund.status === 'completed';
  });
  // Note: refundedAmount calculated but not included in FinancialReport interface
  // If needed, add to revenue section or costs section
  const refundedOrders = new Set(filteredRefunds.map(r => r.orderId)).size;

  return {
    period: {
      start: Timestamp.fromDate(startDate),
      end: Timestamp.fromDate(endDate),
    },
    revenue: {
      total: totalRevenue,
      productSales,
      shipping: shippingRevenue,
      taxes: taxesCollected,
    },
    costs: {
      total: totalCosts,
      productCost: estimatedProductCost,
      shipping: shippingCost,
      marketing: marketingCost,
      operational: operationalCost,
    },
    profit: {
      gross: grossProfit,
      net: netProfit,
      margin,
    },
    orders: {
      total: filteredOrders.length,
      completed: completedOrders.length,
      cancelled: cancelledOrders.length,
      refunded: refundedOrders,
    },
    taxes: {
      collected: taxesCollected,
      paid: 0, // Would need separate tax payment tracking
    },
  };
};

// ========== CUSTOM REPORT TEMPLATES ==========
const customReportTemplatesCollectionRef = collection(db, 'custom_report_templates');

export const addCustomReportTemplate = async (template: Omit<CustomReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTemplateRef = await addDoc(customReportTemplatesCollectionRef, {
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newTemplateRef.id;
};

export const getCustomReportTemplate = async (id: string): Promise<CustomReportTemplate | null> => {
  const templateDocRef = doc(db, 'custom_report_templates', id);
  const templateDoc = await getDoc(templateDocRef);
  if (templateDoc.exists()) {
    return { id: templateDoc.id, ...templateDoc.data() } as CustomReportTemplate;
  }
  return null;
};

export const getAllCustomReportTemplates = async (): Promise<CustomReportTemplate[]> => {
  const querySnapshot = await getDocs(query(customReportTemplatesCollectionRef, orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomReportTemplate));
};

export const updateCustomReportTemplate = async (id: string, template: Partial<Omit<CustomReportTemplate, 'id' | 'createdAt'>>): Promise<void> => {
  const templateDocRef = doc(db, 'custom_report_templates', id);
  await updateDoc(templateDocRef, {
    ...template,
    updatedAt: new Date(),
  });
};

export const deleteCustomReportTemplate = async (id: string): Promise<void> => {
  const templateDocRef = doc(db, 'custom_report_templates', id);
  await deleteDoc(templateDocRef);
};

// ========== SCHEDULED REPORTS ==========
const scheduledReportsCollectionRef = collection(db, 'scheduled_reports');

export const addScheduledReport = async (report: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newReportRef = await addDoc(scheduledReportsCollectionRef, {
    ...report,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newReportRef.id;
};

export const getScheduledReport = async (id: string): Promise<ScheduledReport | null> => {
  const reportDocRef = doc(db, 'scheduled_reports', id);
  const reportDoc = await getDoc(reportDocRef);
  if (reportDoc.exists()) {
    return { id: reportDoc.id, ...reportDoc.data() } as ScheduledReport;
  }
  return null;
};

export const getAllScheduledReports = async (): Promise<ScheduledReport[]> => {
  const querySnapshot = await getDocs(query(scheduledReportsCollectionRef, orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledReport));
};

export const updateScheduledReport = async (id: string, report: Partial<Omit<ScheduledReport, 'id' | 'createdAt'>>): Promise<void> => {
  const reportDocRef = doc(db, 'scheduled_reports', id);
  await updateDoc(reportDocRef, {
    ...report,
    updatedAt: new Date(),
  });
};

export const deleteScheduledReport = async (id: string): Promise<void> => {
  const reportDocRef = doc(db, 'scheduled_reports', id);
  await deleteDoc(reportDocRef);
};

