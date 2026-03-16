import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, where, Timestamp } from 'firebase/firestore';
import { Product } from './products';
import { generateSlug } from '../utils/slug';
import { logActivity } from '../utils/activityLogger';

const productsCollectionRef = collection(db, 'products');

export const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Auto-generate slug if not provided
  const finalProduct = { ...product };
  if (!finalProduct.slug || finalProduct.slug.trim() === '') {
    if (finalProduct.name && finalProduct.name.trim() !== '') {
      const baseSlug = generateSlug(finalProduct.name);
      if (baseSlug && baseSlug.trim() !== '') {
        // Check if slug exists and make it unique
        const q = query(productsCollectionRef, where('slug', '==', baseSlug));
        const existing = await getDocs(q);
        if (!existing.empty) {
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          let slugExists = true;
          while (slugExists) {
            const checkQ = query(productsCollectionRef, where('slug', '==', uniqueSlug));
            const checkResult = await getDocs(checkQ);
            if (checkResult.empty) {
              slugExists = false;
            } else {
              counter++;
              uniqueSlug = `${baseSlug}-${counter}`;
            }
          }
          finalProduct.slug = uniqueSlug;
        } else {
          finalProduct.slug = baseSlug;
        }
      } else {
        // Fallback: use timestamp if slug generation fails
        finalProduct.slug = `product-${Date.now()}`;
      }
    } else {
      // Fallback: use timestamp if no name
      finalProduct.slug = `product-${Date.now()}`;
    }
  } else {
    // Ensure slug is trimmed
    finalProduct.slug = finalProduct.slug.trim();
  }
  
  const newProductRef = await addDoc(productsCollectionRef, {
    ...finalProduct,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  // Log activity
  await logActivity('product.created', 'products', newProductRef.id, {
    productName: finalProduct.name,
  });
  
  return newProductRef.id;
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const productDocRef = doc(db, 'products', id);
  const productDoc = await getDoc(productDocRef);
  if (productDoc.exists()) {
    return { id: productDoc.id, ...productDoc.data() } as Product;
  }
  return null;
};

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    return null;
  }
  
  const q = query(productsCollectionRef, where('slug', '==', slug.trim()));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Product;
  }
  return null;
};

export const getAllProducts = async (): Promise<Product[]> => {
  const q = query(productsCollectionRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const updateProduct = async (id: string, product: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> => {
  const productDocRef = doc(db, 'products', id);
  
  // Auto-generate slug if name changed and slug not provided
  const finalProduct = { ...product };
  if (finalProduct.name && finalProduct.name.trim() !== '' && (!finalProduct.slug || finalProduct.slug.trim() === '')) {
    const existingProduct = await getProduct(id);
    // Only regenerate slug if name changed
    if (existingProduct && existingProduct.name !== finalProduct.name) {
      const baseSlug = generateSlug(finalProduct.name);
      if (baseSlug && baseSlug.trim() !== '') {
        // Check if slug exists (excluding current product)
        const q = query(productsCollectionRef, where('slug', '==', baseSlug));
        const existing = await getDocs(q);
        const slugExists = existing.docs.some(doc => doc.id !== id);
        
        if (slugExists) {
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          let slugStillExists = true;
          while (slugStillExists) {
            const checkQ = query(productsCollectionRef, where('slug', '==', uniqueSlug));
            const checkResult = await getDocs(checkQ);
            slugStillExists = checkResult.docs.some(doc => doc.id !== id);
            if (slugStillExists) {
              counter++;
              uniqueSlug = `${baseSlug}-${counter}`;
            }
          }
          finalProduct.slug = uniqueSlug;
        } else {
          finalProduct.slug = baseSlug;
        }
      }
    }
  } else if (finalProduct.slug) {
    // Ensure slug is trimmed
    finalProduct.slug = finalProduct.slug.trim();
  }

  // Firestore does not allow undefined field values – remove them
  const cleanedProduct: Record<string, unknown> = {};
  Object.entries(finalProduct).forEach(([key, value]) => {
    if (value !== undefined) {
      cleanedProduct[key] = value;
    }
  });

  await updateDoc(productDocRef, {
    ...cleanedProduct,
    updatedAt: Timestamp.now(),
  });
  
  // Log activity
  const existingProduct = await getProduct(id);
  await logActivity('product.updated', 'products', id, {
    productName: existingProduct?.name || product.name,
    fieldsUpdated: Object.keys(finalProduct),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  const productDocRef = doc(db, 'products', id);
  
  // Get product info before deleting for logging
  const product = await getProduct(id);
  
  await deleteDoc(productDocRef);
  
  // Log activity
  await logActivity('product.deleted', 'products', id, {
    productName: product?.name,
  });
};

// Bulk Operations
export const bulkUpdateProducts = async (productIds: string[], updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> => {
  const updatePromises = productIds.map(id => {
    const productDocRef = doc(db, 'products', id);
    return updateDoc(productDocRef, {
      ...updates,
      updatedAt: new Date(),
    });
  });
  await Promise.all(updatePromises);
};

// Product Duplication
export const duplicateProduct = async (productId: string, newName?: string): Promise<string> => {
  const originalProduct = await getProduct(productId);
  if (!originalProduct) {
    throw new Error('Product not found');
  }

  const duplicatedProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
    name: newName || `${originalProduct.name} (Copy)`,
    slug: generateSlug(newName || `${originalProduct.name} (Copy)`),
    description: originalProduct.description,
    images: [...originalProduct.images],
    price: originalProduct.price,
    pricingMode: originalProduct.pricingMode,
    salePrice: originalProduct.salePrice,
    discountType: originalProduct.discountType,
    discountValue: originalProduct.discountValue,
    goldKarat: originalProduct.goldKarat,
    goldWeight: originalProduct.goldWeight,
    makingChargeType: originalProduct.makingChargeType,
    makingChargeValue: originalProduct.makingChargeValue,
    manualPriceAdjustment: originalProduct.manualPriceAdjustment,
    goldPricingSnapshot: originalProduct.goldPricingSnapshot,
    category: originalProduct.category,
    brandId: originalProduct.brandId,
    variants: originalProduct.variants.map(v => ({ ...v })),
    isFeatured: false,
    isActive: false,
    allowPreOrder: originalProduct.allowPreOrder || false,
    isBundle: originalProduct.isBundle || false,
    analytics: {
      views: 0,
      clicks: 0,
      addToCartCount: 0,
      purchases: 0,
      conversionRate: 0,
    },
  };

  return await addProduct(duplicatedProduct);
};

// Product Analytics
export const incrementProductView = async (productId: string): Promise<void> => {
  const productDocRef = doc(db, 'products', productId);
  const productDoc = await getDoc(productDocRef);
  
  if (productDoc.exists()) {
    const currentData = productDoc.data();
    const analytics = currentData.analytics || {
      views: 0,
      clicks: 0,
      addToCartCount: 0,
      purchases: 0,
      conversionRate: 0,
    };

    analytics.views = (analytics.views || 0) + 1;
    analytics.conversionRate = analytics.purchases > 0 
      ? (analytics.purchases / analytics.views) * 100 
      : 0;
    analytics.lastViewed = Timestamp.now();

    await updateDoc(productDocRef, {
      analytics,
      updatedAt: Timestamp.now(),
    });
  }
};

export const incrementProductClick = async (productId: string): Promise<void> => {
  const productDocRef = doc(db, 'products', productId);
  const productDoc = await getDoc(productDocRef);
  
  if (productDoc.exists()) {
    const currentData = productDoc.data();
    const analytics = currentData.analytics || {
      views: 0,
      clicks: 0,
      addToCartCount: 0,
      purchases: 0,
      conversionRate: 0,
    };

    analytics.clicks = (analytics.clicks || 0) + 1;

    await updateDoc(productDocRef, {
      analytics,
      updatedAt: Timestamp.now(),
    });
  }
};

export const incrementAddToCart = async (productId: string): Promise<void> => {
  const productDocRef = doc(db, 'products', productId);
  const productDoc = await getDoc(productDocRef);
  
  if (productDoc.exists()) {
    const currentData = productDoc.data();
    const analytics = currentData.analytics || {
      views: 0,
      clicks: 0,
      addToCartCount: 0,
      purchases: 0,
      conversionRate: 0,
    };

    analytics.addToCartCount = (analytics.addToCartCount || 0) + 1;

    await updateDoc(productDocRef, {
      analytics,
      updatedAt: Timestamp.now(),
    });
  }
};

export const incrementProductPurchase = async (
  productId: string,
  quantity: number = 1
): Promise<void> => {
  const productDocRef = doc(db, 'products', productId);
  const productDoc = await getDoc(productDocRef);

  if (!productDoc.exists()) {
    return;
  }

  const currentData = productDoc.data();
  const analytics = currentData.analytics || {
    views: 0,
    clicks: 0,
    addToCartCount: 0,
    purchases: 0,
    conversionRate: 0,
  };

  const incrementBy = quantity > 0 ? quantity : 1;
  analytics.purchases = (analytics.purchases || 0) + incrementBy;

  // Recalculate conversion rate based on views and purchases
  analytics.conversionRate =
    analytics.views && analytics.views > 0
      ? (analytics.purchases / analytics.views) * 100
      : 0;

  await updateDoc(productDocRef, {
    analytics,
    updatedAt: Timestamp.now(),
  });
};

// Migration function to add slugs to all existing products
export const migrateProductsToSlugs = async (): Promise<{ updated: number; errors: number }> => {
  const allProducts = await getAllProducts();
  let updated = 0;
  let errors = 0;

  for (const product of allProducts) {
    try {
      // Skip if product already has a valid slug
      if (product.slug && product.slug.trim() !== '') {
        continue;
      }

      // Generate slug from product name
      const baseSlug = generateSlug(product.name || `product-${product.id}`);
      if (!baseSlug || baseSlug.trim() === '') {
        continue;
      }

      // Check if slug already exists
      const q = query(productsCollectionRef, where('slug', '==', baseSlug));
      const existing = await getDocs(q);
      
      let finalSlug = baseSlug;
      if (!existing.empty && existing.docs[0].id !== product.id) {
        // Slug exists for another product, make it unique
        let counter = 1;
        let uniqueSlug = `${baseSlug}-${counter}`;
        let slugExists = true;
        while (slugExists) {
          const checkQ = query(productsCollectionRef, where('slug', '==', uniqueSlug));
          const checkResult = await getDocs(checkQ);
          if (checkResult.empty || checkResult.docs[0].id === product.id) {
            slugExists = false;
            finalSlug = uniqueSlug;
          } else {
            counter++;
            uniqueSlug = `${baseSlug}-${counter}`;
          }
        }
      }

      // Update product with slug
      const productDocRef = doc(db, 'products', product.id);
      await updateDoc(productDocRef, {
        slug: finalSlug,
        updatedAt: Timestamp.now(),
      });
      updated++;
    } catch {
      // Failed to migrate product
      errors++;
    }
  }

  return { updated, errors };
};
