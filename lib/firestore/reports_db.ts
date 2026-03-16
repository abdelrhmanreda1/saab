import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SalesReport {
  date: string;
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
}

export const getSalesReport = async (startDate: Date, endDate: Date): Promise<SalesReport[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => doc.data());

    // Group by date
    const reportMap = new Map<string, { totalOrders: number; totalSales: number }>();

    orders.forEach(order => {
      // Use createdAt if available, otherwise fallback or skip
      if (!order.createdAt) return;
      
      const date = order.createdAt.toDate().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const current = reportMap.get(date) || { totalOrders: 0, totalSales: 0 };

      reportMap.set(date, {
        totalOrders: current.totalOrders + 1,
        totalSales: current.totalSales + (order.totalAmount || 0)
      });
    });

    // Convert to array
    const report: SalesReport[] = Array.from(reportMap.entries()).map(([date, data]) => ({
      date,
      totalOrders: data.totalOrders,
      totalSales: data.totalSales,
      averageOrderValue: data.totalOrders > 0 ? data.totalSales / data.totalOrders : 0
    }));

    // Sort by date
    return report.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    // Failed to generate sales report
    return [];
  }
};

