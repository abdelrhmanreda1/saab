import { db } from '../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { SEOSettings, PageSEO, ProductSEO, CategorySEO, BrandSEO, CollectionSEO, BlogSEO } from './seo';

// ========== SEO SETTINGS ==========
const seoSettingsCollection = collection(db, 'seo_settings');

export const getSEOSettings = async (): Promise<SEOSettings | null> => {
  const q = query(seoSettingsCollection, orderBy('createdAt', 'desc'), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as SEOSettings;
  }
  return null;
};

export const updateSEOSettings = async (settings: Partial<Omit<SEOSettings, 'id' | 'createdAt'>>): Promise<void> => {
  const existing = await getSEOSettings();
  if (existing) {
    const docRef = doc(db, 'seo_settings', existing.id!);
    await updateDoc(docRef, { ...settings, updatedAt: Timestamp.now() });
  } else {
    const newSettings: Omit<SEOSettings, 'id'> = {
      siteTitle: settings.siteTitle || 'Pardah - Elegant Abayas & Fashion',
      siteDescription: settings.siteDescription || '',
      siteKeywords: settings.siteKeywords || [],
      ogSiteName: settings.ogSiteName || 'Pardah',
      ogLocale: settings.ogLocale || 'en_US',
      twitterCard: settings.twitterCard || 'summary_large_image',
      organizationName: settings.organizationName || 'Pardah',
      organizationUrl: settings.organizationUrl || '',
      sitemapEnabled: settings.sitemapEnabled ?? true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...settings,
    };
    await addDoc(seoSettingsCollection, newSettings);
  }
};

// ========== PAGE SEO ==========
const pageSEOCollection = collection(db, 'page_seo');

export const getPageSEO = async (pagePath: string): Promise<PageSEO | null> => {
  const q = query(pageSEOCollection, where('pagePath', '==', pagePath), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as PageSEO;
  }
  return null;
};

export const getAllPageSEO = async (): Promise<PageSEO[]> => {
  const q = query(pageSEOCollection, orderBy('pagePath', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PageSEO));
};

export const createOrUpdatePageSEO = async (pageSEO: Omit<PageSEO, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existing = await getPageSEO(pageSEO.pagePath);
  if (existing) {
    const docRef = doc(db, 'page_seo', existing.id!);
    await updateDoc(docRef, { ...pageSEO, updatedAt: Timestamp.now() });
    return existing.id!;
  } else {
    const newPageSEO: Omit<PageSEO, 'id'> = {
      ...pageSEO,
      noIndex: pageSEO.noIndex ?? false,
      noFollow: pageSEO.noFollow ?? false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(pageSEOCollection, newPageSEO);
    return docRef.id;
  }
};

export const deletePageSEO = async (id: string): Promise<void> => {
  const docRef = doc(db, 'page_seo', id);
  await deleteDoc(docRef);
};

// ========== PRODUCT SEO ==========
const productSEOCollection = collection(db, 'product_seo');

export const getProductSEO = async (productId: string): Promise<ProductSEO | null> => {
  const q = query(productSEOCollection, where('productId', '==', productId), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as ProductSEO;
  }
  return null;
};

export const createOrUpdateProductSEO = async (productSEO: Omit<ProductSEO, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existing = await getProductSEO(productSEO.productId);
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    productId: productSEO.productId,
    noIndex: productSEO.noIndex ?? false,
    noFollow: productSEO.noFollow ?? false,
  };
  
  // Only add optional fields if they have values
  if (productSEO.title !== undefined && productSEO.title !== null && productSEO.title !== '') {
    dataToSave.title = productSEO.title;
  }
  if (productSEO.description !== undefined && productSEO.description !== null && productSEO.description !== '') {
    dataToSave.description = productSEO.description;
  }
  if (productSEO.keywords !== undefined && productSEO.keywords !== null && Array.isArray(productSEO.keywords) && productSEO.keywords.length > 0) {
    dataToSave.keywords = productSEO.keywords;
  }
  if (productSEO.metaImage !== undefined && productSEO.metaImage !== null && productSEO.metaImage !== '') {
    dataToSave.metaImage = productSEO.metaImage;
  }
  if (productSEO.canonicalUrl !== undefined && productSEO.canonicalUrl !== null && productSEO.canonicalUrl !== '') {
    dataToSave.canonicalUrl = productSEO.canonicalUrl;
  }
  if (productSEO.structuredData !== undefined && productSEO.structuredData !== null && Object.keys(productSEO.structuredData).length > 0) {
    dataToSave.structuredData = productSEO.structuredData;
  }
  
  if (existing) {
    const docRef = doc(db, 'product_seo', existing.id!);
    await updateDoc(docRef, { ...dataToSave, updatedAt: Timestamp.now() });
    return existing.id!;
  } else {
    const newProductSEO = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(productSEOCollection, newProductSEO);
    return docRef.id;
  }
};

export const deleteProductSEO = async (id: string): Promise<void> => {
  const docRef = doc(db, 'product_seo', id);
  await deleteDoc(docRef);
};

// ========== CATEGORY SEO ==========
const categorySEOCollection = collection(db, 'category_seo');

export const getCategorySEO = async (categoryId: string): Promise<CategorySEO | null> => {
  const q = query(categorySEOCollection, where('categoryId', '==', categoryId), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as CategorySEO;
  }
  return null;
};

export const getAllCategorySEO = async (): Promise<CategorySEO[]> => {
  const q = query(categorySEOCollection, orderBy('categoryId', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategorySEO));
};

export const createOrUpdateCategorySEO = async (categorySEO: Omit<CategorySEO, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existing = await getCategorySEO(categorySEO.categoryId);
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    categoryId: categorySEO.categoryId,
    noIndex: categorySEO.noIndex ?? false,
    noFollow: categorySEO.noFollow ?? false,
  };
  
  // Only add optional fields if they have values
  if (categorySEO.title !== undefined && categorySEO.title !== null && categorySEO.title !== '') {
    dataToSave.title = categorySEO.title;
  }
  if (categorySEO.description !== undefined && categorySEO.description !== null && categorySEO.description !== '') {
    dataToSave.description = categorySEO.description;
  }
  if (categorySEO.keywords !== undefined && categorySEO.keywords !== null && Array.isArray(categorySEO.keywords) && categorySEO.keywords.length > 0) {
    dataToSave.keywords = categorySEO.keywords;
  }
  if (categorySEO.metaImage !== undefined && categorySEO.metaImage !== null && categorySEO.metaImage !== '') {
    dataToSave.metaImage = categorySEO.metaImage;
  }
  if (categorySEO.canonicalUrl !== undefined && categorySEO.canonicalUrl !== null && categorySEO.canonicalUrl !== '') {
    dataToSave.canonicalUrl = categorySEO.canonicalUrl;
  }
  
  if (existing) {
    const docRef = doc(db, 'category_seo', existing.id!);
    await updateDoc(docRef, { ...dataToSave, updatedAt: Timestamp.now() });
    return existing.id!;
  } else {
    const newCategorySEO = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(categorySEOCollection, newCategorySEO);
    return docRef.id;
  }
};

export const deleteCategorySEO = async (id: string): Promise<void> => {
  const docRef = doc(db, 'category_seo', id);
  await deleteDoc(docRef);
};

// ========== BRAND SEO ==========
const brandSEOCollection = collection(db, 'brand_seo');

export const getBrandSEO = async (brandId: string): Promise<BrandSEO | null> => {
  const q = query(brandSEOCollection, where('brandId', '==', brandId), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as BrandSEO;
  }
  return null;
};

export const getAllBrandSEO = async (): Promise<BrandSEO[]> => {
  const q = query(brandSEOCollection, orderBy('brandId', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrandSEO));
};

export const createOrUpdateBrandSEO = async (brandSEO: Omit<BrandSEO, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existing = await getBrandSEO(brandSEO.brandId);
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    brandId: brandSEO.brandId,
    noIndex: brandSEO.noIndex ?? false,
    noFollow: brandSEO.noFollow ?? false,
  };
  
  // Only add optional fields if they have values
  if (brandSEO.title !== undefined && brandSEO.title !== null && brandSEO.title !== '') {
    dataToSave.title = brandSEO.title;
  }
  if (brandSEO.description !== undefined && brandSEO.description !== null && brandSEO.description !== '') {
    dataToSave.description = brandSEO.description;
  }
  if (brandSEO.keywords !== undefined && brandSEO.keywords !== null && Array.isArray(brandSEO.keywords) && brandSEO.keywords.length > 0) {
    dataToSave.keywords = brandSEO.keywords;
  }
  if (brandSEO.metaImage !== undefined && brandSEO.metaImage !== null && brandSEO.metaImage !== '') {
    dataToSave.metaImage = brandSEO.metaImage;
  }
  if (brandSEO.canonicalUrl !== undefined && brandSEO.canonicalUrl !== null && brandSEO.canonicalUrl !== '') {
    dataToSave.canonicalUrl = brandSEO.canonicalUrl;
  }
  
  if (existing) {
    const docRef = doc(db, 'brand_seo', existing.id!);
    await updateDoc(docRef, { ...dataToSave, updatedAt: Timestamp.now() });
    return existing.id!;
  } else {
    const newBrandSEO = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(brandSEOCollection, newBrandSEO);
    return docRef.id;
  }
};

export const deleteBrandSEO = async (id: string): Promise<void> => {
  const docRef = doc(db, 'brand_seo', id);
  await deleteDoc(docRef);
};

// ========== COLLECTION SEO ==========
const collectionSEOCollection = collection(db, 'collection_seo');

export const getCollectionSEO = async (collectionId: string): Promise<CollectionSEO | null> => {
  const q = query(collectionSEOCollection, where('collectionId', '==', collectionId), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as CollectionSEO;
  }
  return null;
};

export const getAllCollectionSEO = async (): Promise<CollectionSEO[]> => {
  const q = query(collectionSEOCollection, orderBy('collectionId', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionSEO));
};

export const createOrUpdateCollectionSEO = async (collectionSEO: Omit<CollectionSEO, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existing = await getCollectionSEO(collectionSEO.collectionId);
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    collectionId: collectionSEO.collectionId,
    noIndex: collectionSEO.noIndex ?? false,
    noFollow: collectionSEO.noFollow ?? false,
  };
  
  // Only add optional fields if they have values
  if (collectionSEO.title !== undefined && collectionSEO.title !== null && collectionSEO.title !== '') {
    dataToSave.title = collectionSEO.title;
  }
  if (collectionSEO.description !== undefined && collectionSEO.description !== null && collectionSEO.description !== '') {
    dataToSave.description = collectionSEO.description;
  }
  if (collectionSEO.keywords !== undefined && collectionSEO.keywords !== null && Array.isArray(collectionSEO.keywords) && collectionSEO.keywords.length > 0) {
    dataToSave.keywords = collectionSEO.keywords;
  }
  if (collectionSEO.metaImage !== undefined && collectionSEO.metaImage !== null && collectionSEO.metaImage !== '') {
    dataToSave.metaImage = collectionSEO.metaImage;
  }
  if (collectionSEO.canonicalUrl !== undefined && collectionSEO.canonicalUrl !== null && collectionSEO.canonicalUrl !== '') {
    dataToSave.canonicalUrl = collectionSEO.canonicalUrl;
  }
  
  if (existing) {
    const docRef = doc(db, 'collection_seo', existing.id!);
    await updateDoc(docRef, { ...dataToSave, updatedAt: Timestamp.now() });
    return existing.id!;
  } else {
    const newCollectionSEO = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collectionSEOCollection, newCollectionSEO);
    return docRef.id;
  }
};

export const deleteCollectionSEO = async (id: string): Promise<void> => {
  const docRef = doc(db, 'collection_seo', id);
  await deleteDoc(docRef);
};

// ========== BLOG SEO ==========
const blogSEOCollection = collection(db, 'blog_seo');

export const getBlogSEO = async (blogPostId: string): Promise<BlogSEO | null> => {
  const q = query(blogSEOCollection, where('blogPostId', '==', blogPostId), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as BlogSEO;
  }
  return null;
};

export const getAllBlogSEO = async (): Promise<BlogSEO[]> => {
  const q = query(blogSEOCollection, orderBy('blogPostId', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogSEO));
};

// Helper function to remove undefined values from object (currently unused but kept for future use)
// const removeUndefined = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> => {
//   const cleaned: Record<string, unknown> = {};
//   Object.keys(obj).forEach(key => {
//     const value = obj[key];
//     if (value !== undefined && value !== null) {
//       cleaned[key] = value;
//     }
//   });
//   return cleaned;
// };

export const createOrUpdateBlogSEO = async (blogSEO: Omit<BlogSEO, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const existing = await getBlogSEO(blogSEO.blogPostId);
  
  // Prepare data object, removing undefined values
  const dataToSave: Record<string, unknown> = {
    blogPostId: blogSEO.blogPostId,
    noIndex: blogSEO.noIndex ?? false,
    noFollow: blogSEO.noFollow ?? false,
  };
  
  // Only add optional fields if they have values
  if (blogSEO.title !== undefined && blogSEO.title !== null && blogSEO.title !== '') {
    dataToSave.title = blogSEO.title;
  }
  if (blogSEO.description !== undefined && blogSEO.description !== null && blogSEO.description !== '') {
    dataToSave.description = blogSEO.description;
  }
  if (blogSEO.keywords !== undefined && blogSEO.keywords !== null && Array.isArray(blogSEO.keywords) && blogSEO.keywords.length > 0) {
    dataToSave.keywords = blogSEO.keywords;
  }
  if (blogSEO.metaImage !== undefined && blogSEO.metaImage !== null && blogSEO.metaImage !== '') {
    dataToSave.metaImage = blogSEO.metaImage;
  }
  if (blogSEO.canonicalUrl !== undefined && blogSEO.canonicalUrl !== null && blogSEO.canonicalUrl !== '') {
    dataToSave.canonicalUrl = blogSEO.canonicalUrl;
  }
  
  if (existing) {
    const docRef = doc(db, 'blog_seo', existing.id!);
    await updateDoc(docRef, { ...dataToSave, updatedAt: Timestamp.now() });
    return existing.id!;
  } else {
    const newBlogSEO = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(blogSEOCollection, newBlogSEO);
    return docRef.id;
  }
};

export const deleteBlogSEO = async (id: string): Promise<void> => {
  const docRef = doc(db, 'blog_seo', id);
  await deleteDoc(docRef);
};

