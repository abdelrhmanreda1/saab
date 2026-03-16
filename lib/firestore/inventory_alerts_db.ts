import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where } from 'firebase/firestore';
import { InventoryAlert } from './suppliers';

const alertsCollectionRef = collection(db, 'inventory_alerts');

export const addInventoryAlert = async (alert: Omit<InventoryAlert, 'id' | 'createdAt'>): Promise<string> => {
  const newAlertRef = await addDoc(alertsCollectionRef, {
    ...alert,
    createdAt: new Date(),
  });
  return newAlertRef.id;
};

export const getInventoryAlert = async (id: string): Promise<InventoryAlert | null> => {
  const alertDocRef = doc(db, 'inventory_alerts', id);
  const alertDoc = await getDoc(alertDocRef);
  if (alertDoc.exists()) {
    return { id: alertDoc.id, ...alertDoc.data() } as InventoryAlert;
  }
  return null;
};

export const getAllInventoryAlerts = async (resolved?: boolean): Promise<InventoryAlert[]> => {
  let q = query(alertsCollectionRef, orderBy('createdAt', 'desc'));
  if (resolved !== undefined) {
    q = query(alertsCollectionRef, where('isResolved', '==', resolved), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryAlert));
};

export const resolveAlert = async (id: string): Promise<void> => {
  const alertDocRef = doc(db, 'inventory_alerts', id);
  await updateDoc(alertDocRef, {
    isResolved: true,
    resolvedAt: new Date(),
  });
};

export const deleteInventoryAlert = async (id: string): Promise<void> => {
  const alertDocRef = doc(db, 'inventory_alerts', id);
  await deleteDoc(alertDocRef);
};

// Check for low stock and create alerts
export const checkLowStock = async (productId: string, variantId: string | null, currentStock: number, threshold: number = 10): Promise<void> => {
  if (currentStock <= threshold) {
    // Check if alert already exists
    const existingAlerts = await getAllInventoryAlerts(false);
    const existingAlert = existingAlerts.find(
      alert => alert.productId === productId && 
      alert.variantId === variantId && 
      !alert.isResolved
    );

    if (!existingAlert) {
      const { getProduct } = await import('./products_db');
      const product = await getProduct(productId);
      
      if (product) {
        const variant = variantId ? product.variants.find(v => v.id === variantId) : null;
        
        await addInventoryAlert({
          productId,
          productName: product.name,
          variantId: variantId || undefined,
          variantName: variant ? `${variant.name}: ${variant.value}` : undefined,
          currentStock,
          threshold,
          alertType: currentStock === 0 ? 'out_of_stock' : 'low',
          isResolved: false,
        });
      }
    }
  }
};

