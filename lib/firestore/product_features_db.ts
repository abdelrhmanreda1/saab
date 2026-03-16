import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where, limit } from 'firebase/firestore';
import { getAllProducts, getProduct } from './products_db';
import { Product } from './products';
import { ProductComparison, ProductTag, SavedSearch, ProductNotification, SizeChart, GiftRegistry } from './product_features';

// ========== RECENTLY VIEWED PRODUCTS ==========
const recentlyViewedCollectionRef = collection(db, 'recently_viewed_products');

export const addRecentlyViewed = async (userId: string, productId: string): Promise<void> => {
  // Remove existing entry for this user-product combination
  const existingQuery = query(
    recentlyViewedCollectionRef,
    where('userId', '==', userId),
    where('productId', '==', productId)
  );
  const existingDocs = await getDocs(existingQuery);
  existingDocs.forEach(async (doc) => {
    await deleteDoc(doc.ref);
  });

  // Add new entry
  await addDoc(recentlyViewedCollectionRef, {
    userId,
    productId,
    viewedAt: new Date(),
  });
};

export const getRecentlyViewed = async (userId: string, limitCount: number = 10): Promise<Product[]> => {
  const q = query(
    recentlyViewedCollectionRef,
    where('userId', '==', userId),
    orderBy('viewedAt', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  const productIds = querySnapshot.docs.map(doc => doc.data().productId);
  
  const products: Product[] = [];
  for (const productId of productIds) {
    const product = await getProduct(productId);
    if (product) products.push(product);
  }
  
  return products;
};

// ========== PRODUCT COMPARISON ==========
const productComparisonCollectionRef = collection(db, 'product_comparisons');

export const addProductComparison = async (userId: string, productIds: string[]): Promise<string> => {
  // Remove existing comparison for this user
  const existingQuery = query(productComparisonCollectionRef, where('userId', '==', userId));
  const existingDocs = await getDocs(existingQuery);
  existingDocs.forEach(async (doc) => {
    await deleteDoc(doc.ref);
  });

  const newComparisonRef = await addDoc(productComparisonCollectionRef, {
    userId,
    productIds: productIds.slice(0, 4), // Max 4 products
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newComparisonRef.id;
};

export const getProductComparison = async (userId: string): Promise<ProductComparison | null> => {
  const q = query(productComparisonCollectionRef, where('userId', '==', userId), limit(1));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as ProductComparison;
};

export const removeProductFromComparison = async (userId: string, productId: string): Promise<void> => {
  const comparison = await getProductComparison(userId);
  if (comparison && comparison.id) {
    const updatedProductIds = comparison.productIds.filter(id => id !== productId);
    if (updatedProductIds.length === 0) {
      await deleteDoc(doc(db, 'product_comparisons', comparison.id));
    } else {
      await updateDoc(doc(db, 'product_comparisons', comparison.id), {
        productIds: updatedProductIds,
        updatedAt: new Date(),
      });
    }
  }
};

// ========== PRODUCT RECOMMENDATIONS (Non-AI) ==========
export const getProductRecommendations = async (productId: string, limitCount: number = 8): Promise<Product[]> => {
  const product = await getProduct(productId);
  if (!product) return [];

  const allProducts = await getAllProducts();
  
  // Filter by same category
  const categoryProducts = allProducts
    .filter(p => p.id !== productId && p.category === product.category && p.isActive)
    .slice(0, limitCount);

  // If not enough, add same brand products
  if (categoryProducts.length < limitCount && product.brandId) {
    const brandProducts = allProducts
      .filter(p => p.id !== productId && p.brandId === product.brandId && p.isActive && !categoryProducts.find(cp => cp.id === p.id))
      .slice(0, limitCount - categoryProducts.length);
    categoryProducts.push(...brandProducts);
  }

  // If still not enough, add featured products
  if (categoryProducts.length < limitCount) {
    const featuredProducts = allProducts
      .filter(p => p.id !== productId && p.isFeatured && p.isActive && !categoryProducts.find(cp => cp.id === p.id))
      .slice(0, limitCount - categoryProducts.length);
    categoryProducts.push(...featuredProducts);
  }

  return categoryProducts.slice(0, limitCount);
};

// ========== PRODUCT TAGS ==========
const productTagsCollectionRef = collection(db, 'product_tags');

export const addProductTag = async (tag: Omit<ProductTag, 'id' | 'createdAt'>): Promise<string> => {
  const newTagRef = await addDoc(productTagsCollectionRef, {
    ...tag,
    createdAt: new Date(),
  });
  return newTagRef.id;
};

export const getAllProductTags = async (): Promise<ProductTag[]> => {
  const querySnapshot = await getDocs(query(productTagsCollectionRef, orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductTag));
};

export const getProductTag = async (id: string): Promise<ProductTag | null> => {
  const tagDocRef = doc(db, 'product_tags', id);
  const tagDoc = await getDoc(tagDocRef);
  if (tagDoc.exists()) {
    return { id: tagDoc.id, ...tagDoc.data() } as ProductTag;
  }
  return null;
};

// ========== SAVED SEARCHES ==========
const savedSearchesCollectionRef = collection(db, 'saved_searches');

export const addSavedSearch = async (search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newSearchRef = await addDoc(savedSearchesCollectionRef, {
    ...search,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newSearchRef.id;
};

export const getSavedSearches = async (userId: string): Promise<SavedSearch[]> => {
  const q = query(savedSearchesCollectionRef, where('userId', '==', userId), orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedSearch));
};

export const deleteSavedSearch = async (id: string): Promise<void> => {
  const searchDocRef = doc(db, 'saved_searches', id);
  await deleteDoc(searchDocRef);
};

// ========== PRODUCT NOTIFICATIONS ==========
const productNotificationsCollectionRef = collection(db, 'product_notifications');

export const addProductNotification = async (notification: Omit<ProductNotification, 'id' | 'createdAt'>): Promise<string> => {
  // Check if notification already exists
  const existingQuery = query(
    productNotificationsCollectionRef,
    where('userId', '==', notification.userId),
    where('productId', '==', notification.productId),
    where('type', '==', notification.type)
  );
  const existingDocs = await getDocs(existingQuery);
  if (!existingDocs.empty) {
    return existingDocs.docs[0].id;
  }

  const newNotificationRef = await addDoc(productNotificationsCollectionRef, {
    ...notification,
    createdAt: new Date(),
  });
  return newNotificationRef.id;
};

export const getProductNotifications = async (userId: string): Promise<ProductNotification[]> => {
  const q = query(productNotificationsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductNotification));
};

export const markNotificationAsNotified = async (id: string): Promise<void> => {
  const notificationDocRef = doc(db, 'product_notifications', id);
  await updateDoc(notificationDocRef, {
    notified: true,
    notifiedAt: new Date(),
  });
};

export const deleteProductNotification = async (id: string): Promise<void> => {
  const notificationDocRef = doc(db, 'product_notifications', id);
  await deleteDoc(notificationDocRef);
};

// ========== SIZE CHARTS ==========
const sizeChartsCollectionRef = collection(db, 'size_charts');

export const addSizeChart = async (chart: Omit<SizeChart, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newChartRef = await addDoc(sizeChartsCollectionRef, {
    ...chart,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newChartRef.id;
};

export const getSizeChart = async (productId: string): Promise<SizeChart | null> => {
  const q = query(sizeChartsCollectionRef, where('productId', '==', productId), limit(1));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as SizeChart;
};

export const updateSizeChart = async (id: string, chart: Partial<Omit<SizeChart, 'id' | 'createdAt'>>): Promise<void> => {
  const chartDocRef = doc(db, 'size_charts', id);
  await updateDoc(chartDocRef, {
    ...chart,
    updatedAt: new Date(),
  });
};

// ========== GIFT REGISTRIES ==========
const giftRegistriesCollectionRef = collection(db, 'gift_registries');

export const addGiftRegistry = async (registry: Omit<GiftRegistry, 'id' | 'shareCode' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newRegistryRef = await addDoc(giftRegistriesCollectionRef, {
    ...registry,
    shareCode,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newRegistryRef.id;
};

export const getGiftRegistry = async (id: string): Promise<GiftRegistry | null> => {
  const registryDocRef = doc(db, 'gift_registries', id);
  const registryDoc = await getDoc(registryDocRef);
  if (registryDoc.exists()) {
    return { id: registryDoc.id, ...registryDoc.data() } as GiftRegistry;
  }
  return null;
};

export const getGiftRegistryByCode = async (shareCode: string): Promise<GiftRegistry | null> => {
  const q = query(giftRegistriesCollectionRef, where('shareCode', '==', shareCode), limit(1));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as GiftRegistry;
};

export const getUserGiftRegistries = async (userId: string): Promise<GiftRegistry[]> => {
  const q = query(giftRegistriesCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftRegistry));
};

export const updateGiftRegistry = async (id: string, registry: Partial<Omit<GiftRegistry, 'id' | 'createdAt'>>): Promise<void> => {
  const registryDocRef = doc(db, 'gift_registries', id);
  await updateDoc(registryDocRef, {
    ...registry,
    updatedAt: new Date(),
  });
};

export const deleteGiftRegistry = async (id: string): Promise<void> => {
  const registryDocRef = doc(db, 'gift_registries', id);
  await deleteDoc(registryDocRef);
};


