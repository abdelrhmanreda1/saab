import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { Warehouse, StockTransfer, StockAdjustment, StockHistory } from './warehouses';

// ========== WAREHOUSES ==========
const warehousesCollection = collection(db, 'warehouses');

export const createWarehouse = async (warehouse: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // If this is set as default, unset other defaults
  if (warehouse.isDefault) {
    const existingDefaults = await getDefaultWarehouse();
    if (existingDefaults.length > 0) {
      for (const w of existingDefaults) {
        await updateWarehouse(w.id!, { isDefault: false });
      }
    }
  }

  // Build address object, only including zipCode if it has a value
  const address: Record<string, unknown> = {
    street: warehouse.address.street,
    city: warehouse.address.city,
    state: warehouse.address.state,
    country: warehouse.address.country,
  };
  if (warehouse.address.zipCode !== undefined && warehouse.address.zipCode !== null && warehouse.address.zipCode !== '') {
    address.zipCode = warehouse.address.zipCode;
  }

  // Build contact object, only including optional fields if they have values
  const contact: Record<string, unknown> = {};
  if (warehouse.contact.phone !== undefined && warehouse.contact.phone !== null && warehouse.contact.phone !== '') {
    contact.phone = warehouse.contact.phone;
  }
  if (warehouse.contact.email !== undefined && warehouse.contact.email !== null && warehouse.contact.email !== '') {
    contact.email = warehouse.contact.email;
  }
  if (warehouse.contact.managerName !== undefined && warehouse.contact.managerName !== null && warehouse.contact.managerName !== '') {
    contact.managerName = warehouse.contact.managerName;
  }

  const newWarehouse: Record<string, unknown> = {
    name: warehouse.name,
    code: warehouse.code,
    address,
    contact: Object.keys(contact).length > 0 ? contact : {},
    isActive: warehouse.isActive,
    isDefault: warehouse.isDefault,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(warehousesCollection, newWarehouse);
  return docRef.id;
};

export const getWarehouse = async (id: string): Promise<Warehouse | null> => {
  const docRef = doc(db, 'warehouses', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Warehouse;
  }
  return null;
};

export const getAllWarehouses = async (activeOnly?: boolean): Promise<Warehouse[]> => {
  let q;
  if (activeOnly) {
    q = query(warehousesCollection, where('isActive', '==', true), orderBy('name', 'asc'));
  } else {
    q = query(warehousesCollection, orderBy('name', 'asc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
};

export const getDefaultWarehouse = async (): Promise<Warehouse[]> => {
  const q = query(warehousesCollection, where('isDefault', '==', true), where('isActive', '==', true), limit(1));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
};

export const updateWarehouse = async (id: string, updates: Partial<Omit<Warehouse, 'id' | 'createdAt'>>): Promise<void> => {
  // If setting as default, unset other defaults
  if (updates.isDefault === true) {
    const existingDefaults = await getDefaultWarehouse();
    for (const w of existingDefaults) {
      if (w.id !== id) {
        await updateDoc(doc(db, 'warehouses', w.id!), { isDefault: false });
      }
    }
  }

  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  // Only add fields that are defined
  if (updates.name !== undefined) dataToSave.name = updates.name;
  if (updates.code !== undefined) dataToSave.code = updates.code;
  if (updates.isActive !== undefined) dataToSave.isActive = updates.isActive;
  if (updates.isDefault !== undefined) dataToSave.isDefault = updates.isDefault;

  // Handle address object
  if (updates.address !== undefined) {
    const address: Record<string, unknown> = {
      street: updates.address.street,
      city: updates.address.city,
      state: updates.address.state,
      country: updates.address.country,
    };
    if (updates.address.zipCode !== undefined && updates.address.zipCode !== null && updates.address.zipCode !== '') {
      address.zipCode = updates.address.zipCode;
    } else if (updates.address.zipCode === null || updates.address.zipCode === '') {
      address.zipCode = null;
    }
    dataToSave.address = address;
  }

  // Handle contact object
  if (updates.contact !== undefined) {
    const contact: Record<string, unknown> = {};
    if (updates.contact.phone !== undefined && updates.contact.phone !== null && updates.contact.phone !== '') {
      contact.phone = updates.contact.phone;
    } else if (updates.contact.phone === null || updates.contact.phone === '') {
      contact.phone = null;
    }
    if (updates.contact.email !== undefined && updates.contact.email !== null && updates.contact.email !== '') {
      contact.email = updates.contact.email;
    } else if (updates.contact.email === null || updates.contact.email === '') {
      contact.email = null;
    }
    if (updates.contact.managerName !== undefined && updates.contact.managerName !== null && updates.contact.managerName !== '') {
      contact.managerName = updates.contact.managerName;
    } else if (updates.contact.managerName === null || updates.contact.managerName === '') {
      contact.managerName = null;
    }
    dataToSave.contact = contact;
  }

  const docRef = doc(db, 'warehouses', id);
  await updateDoc(docRef, dataToSave);
};

export const deleteWarehouse = async (id: string): Promise<void> => {
  const docRef = doc(db, 'warehouses', id);
  await deleteDoc(docRef);
};

// ========== STOCK TRANSFERS ==========
const stockTransfersCollection = collection(db, 'stock_transfers');

const generateTransferNumber = (): string => {
  const prefix = 'TRF';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

export const createStockTransfer = async (transfer: Omit<StockTransfer, 'id' | 'transferNumber' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> => {
  const transferNumber = generateTransferNumber();
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    transferNumber,
    fromWarehouseId: transfer.fromWarehouseId,
    fromWarehouseName: transfer.fromWarehouseName,
    toWarehouseId: transfer.toWarehouseId,
    toWarehouseName: transfer.toWarehouseName,
    items: transfer.items.map(item => {
      const itemData: Record<string, unknown> = {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      };
      if (item.variantId !== undefined && item.variantId !== null && item.variantId !== '') {
        itemData.variantId = item.variantId;
      }
      if (item.variantName !== undefined && item.variantName !== null && item.variantName !== '') {
        itemData.variantName = item.variantName;
      }
      return itemData;
    }),
    status: 'pending',
    requestedBy: transfer.requestedBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (transfer.notes !== undefined && transfer.notes !== null && transfer.notes !== '') {
    dataToSave.notes = transfer.notes;
  }
  if (transfer.requestedByName !== undefined && transfer.requestedByName !== null && transfer.requestedByName !== '') {
    dataToSave.requestedByName = transfer.requestedByName;
  }
  
  const docRef = await addDoc(stockTransfersCollection, dataToSave);
  return docRef.id;
};

export const getStockTransfer = async (id: string): Promise<StockTransfer | null> => {
  const docRef = doc(db, 'stock_transfers', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as StockTransfer;
  }
  return null;
};

export const getAllStockTransfers = async (status?: StockTransfer['status']): Promise<StockTransfer[]> => {
  let q;
  if (status) {
    q = query(stockTransfersCollection, where('status', '==', status), orderBy('createdAt', 'desc'));
  } else {
    q = query(stockTransfersCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockTransfer));
};

export const updateStockTransfer = async (id: string, updates: Partial<Omit<StockTransfer, 'id' | 'createdAt'>>): Promise<void> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  // Only add fields that are defined
  if (updates.transferNumber !== undefined) dataToSave.transferNumber = updates.transferNumber;
  if (updates.fromWarehouseId !== undefined) dataToSave.fromWarehouseId = updates.fromWarehouseId;
  if (updates.fromWarehouseName !== undefined) dataToSave.fromWarehouseName = updates.fromWarehouseName;
  if (updates.toWarehouseId !== undefined) dataToSave.toWarehouseId = updates.toWarehouseId;
  if (updates.toWarehouseName !== undefined) dataToSave.toWarehouseName = updates.toWarehouseName;
  if (updates.items !== undefined) {
    dataToSave.items = updates.items.map(item => {
      const itemData: Record<string, unknown> = {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      };
      if (item.variantId !== undefined && item.variantId !== null && item.variantId !== '') {
        itemData.variantId = item.variantId;
      }
      if (item.variantName !== undefined && item.variantName !== null && item.variantName !== '') {
        itemData.variantName = item.variantName;
      }
      return itemData;
    });
  }
  if (updates.status !== undefined) dataToSave.status = updates.status;
  if (updates.requestedBy !== undefined) dataToSave.requestedBy = updates.requestedBy;
  
  // Optional fields - only add if they have values
  if (updates.notes !== undefined && updates.notes !== null && updates.notes !== '') {
    dataToSave.notes = updates.notes;
  } else if (updates.notes === null || updates.notes === '') {
    dataToSave.notes = null;
  }
  
  if (updates.requestedByName !== undefined && updates.requestedByName !== null && updates.requestedByName !== '') {
    dataToSave.requestedByName = updates.requestedByName;
  } else if (updates.requestedByName === null || updates.requestedByName === '') {
    dataToSave.requestedByName = null;
  }
  
  if (updates.approvedBy !== undefined && updates.approvedBy !== null && updates.approvedBy !== '') {
    dataToSave.approvedBy = updates.approvedBy;
  } else if (updates.approvedBy === null || updates.approvedBy === '') {
    dataToSave.approvedBy = null;
  }
  
  if (updates.approvedAt !== undefined && updates.approvedAt !== null) {
    dataToSave.approvedAt = updates.approvedAt;
  } else if (updates.approvedAt === null) {
    dataToSave.approvedAt = null;
  }
  
  if (updates.completedBy !== undefined && updates.completedBy !== null && updates.completedBy !== '') {
    dataToSave.completedBy = updates.completedBy;
  } else if (updates.completedBy === null || updates.completedBy === '') {
    dataToSave.completedBy = null;
  }
  
  if (updates.completedAt !== undefined && updates.completedAt !== null) {
    dataToSave.completedAt = updates.completedAt;
  } else if (updates.completedAt === null) {
    dataToSave.completedAt = null;
  }
  
  const docRef = doc(db, 'stock_transfers', id);
  await updateDoc(docRef, dataToSave);
};

export const approveStockTransfer = async (id: string, approvedBy: string): Promise<void> => {
  await updateStockTransfer(id, {
    status: 'in_transit',
    approvedBy,
    approvedAt: Timestamp.now(),
  });
};

export const completeStockTransfer = async (id: string, completedBy: string): Promise<void> => {
  await updateStockTransfer(id, {
    status: 'completed',
    completedBy,
    completedAt: Timestamp.now(),
  });
};

// ========== STOCK ADJUSTMENTS ==========
const stockAdjustmentsCollection = collection(db, 'stock_adjustments');

const generateAdjustmentNumber = (): string => {
  const prefix = 'ADJ';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

export const createStockAdjustment = async (adjustment: Omit<StockAdjustment, 'id' | 'adjustmentNumber' | 'createdAt'>): Promise<string> => {
  const adjustmentNumber = generateAdjustmentNumber();
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    adjustmentNumber,
    warehouseId: adjustment.warehouseId,
    warehouseName: adjustment.warehouseName,
    productId: adjustment.productId,
    productName: adjustment.productName,
    adjustmentType: adjustment.adjustmentType,
    quantity: adjustment.quantity,
    reason: adjustment.reason,
    adjustedBy: adjustment.adjustedBy,
    createdAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (adjustment.variantId !== undefined && adjustment.variantId !== null && adjustment.variantId !== '') {
    dataToSave.variantId = adjustment.variantId;
  }
  if (adjustment.variantName !== undefined && adjustment.variantName !== null && adjustment.variantName !== '') {
    dataToSave.variantName = adjustment.variantName;
  }
  if (adjustment.notes !== undefined && adjustment.notes !== null && adjustment.notes !== '') {
    dataToSave.notes = adjustment.notes;
  }
  if (adjustment.adjustedByName !== undefined && adjustment.adjustedByName !== null && adjustment.adjustedByName !== '') {
    dataToSave.adjustedByName = adjustment.adjustedByName;
  }
  
  const docRef = await addDoc(stockAdjustmentsCollection, dataToSave);
  return docRef.id;
};

export const getStockAdjustment = async (id: string): Promise<StockAdjustment | null> => {
  const docRef = doc(db, 'stock_adjustments', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as StockAdjustment;
  }
  return null;
};

export const getAllStockAdjustments = async (warehouseId?: string): Promise<StockAdjustment[]> => {
  let q;
  if (warehouseId) {
    q = query(stockAdjustmentsCollection, where('warehouseId', '==', warehouseId), orderBy('createdAt', 'desc'));
  } else {
    q = query(stockAdjustmentsCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAdjustment));
};

// ========== STOCK HISTORY ==========
const stockHistoryCollection = collection(db, 'stock_history');

export const createStockHistory = async (history: Omit<StockHistory, 'id' | 'createdAt'>): Promise<string> => {
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    warehouseId: history.warehouseId,
    warehouseName: history.warehouseName,
    productId: history.productId,
    productName: history.productName,
    movementType: history.movementType,
    quantity: history.quantity,
    previousStock: history.previousStock,
    newStock: history.newStock,
    createdAt: Timestamp.now(),
  };
  
  // Only add optional fields if they have values
  if (history.variantId !== undefined && history.variantId !== null && history.variantId !== '') {
    dataToSave.variantId = history.variantId;
  }
  if (history.variantName !== undefined && history.variantName !== null && history.variantName !== '') {
    dataToSave.variantName = history.variantName;
  }
  if (history.referenceId !== undefined && history.referenceId !== null && history.referenceId !== '') {
    dataToSave.referenceId = history.referenceId;
  }
  if (history.referenceNumber !== undefined && history.referenceNumber !== null && history.referenceNumber !== '') {
    dataToSave.referenceNumber = history.referenceNumber;
  }
  if (history.notes !== undefined && history.notes !== null && history.notes !== '') {
    dataToSave.notes = history.notes;
  }
  if (history.createdBy !== undefined && history.createdBy !== null && history.createdBy !== '') {
    dataToSave.createdBy = history.createdBy;
  }
  
  const docRef = await addDoc(stockHistoryCollection, dataToSave);
  return docRef.id;
};

export const getStockHistory = async (productId: string, variantId?: string, warehouseId?: string): Promise<StockHistory[]> => {
  let q;
  if (variantId && warehouseId) {
    q = query(
      stockHistoryCollection,
      where('productId', '==', productId),
      where('variantId', '==', variantId),
      where('warehouseId', '==', warehouseId),
      orderBy('createdAt', 'desc')
    );
  } else if (variantId) {
    q = query(
      stockHistoryCollection,
      where('productId', '==', productId),
      where('variantId', '==', variantId),
      orderBy('createdAt', 'desc')
    );
  } else if (warehouseId) {
    q = query(
      stockHistoryCollection,
      where('productId', '==', productId),
      where('warehouseId', '==', warehouseId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      stockHistoryCollection,
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockHistory));
};

export const getWarehouseStockHistory = async (warehouseId: string): Promise<StockHistory[]> => {
  const q = query(stockHistoryCollection, where('warehouseId', '==', warehouseId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockHistory));
};

