import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs } from 'firebase/firestore';
import { Category } from './categories';

const categoriesCollectionRef = collection(db, 'categories');

export const addCategory = async (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newCategoryRef = await addDoc(categoriesCollectionRef, {
    ...category,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newCategoryRef.id;
};

export const getCategory = async (id: string): Promise<Category | null> => {
  const categoryDocRef = doc(db, 'categories', id);
  const categoryDoc = await getDoc(categoryDocRef);
  if (categoryDoc.exists()) {
    return { id: categoryDoc.id, ...categoryDoc.data() } as Category;
  }
  return null;
};

export const getAllCategories = async (): Promise<Category[]> => {
  const q = query(categoriesCollectionRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

export const updateCategory = async (id: string, category: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<void> => {
  const categoryDocRef = doc(db, 'categories', id);
  await updateDoc(categoryDocRef, {
    ...category,
    updatedAt: new Date(),
  });
};

export const deleteCategory = async (id: string): Promise<void> => {
  const categoryDocRef = doc(db, 'categories', id);
  await deleteDoc(categoryDocRef);
};

// Get all child categories (recursive) for a given parent category ID
export const getChildCategories = (parentId: string, allCategories: Category[]): string[] => {
  const children: string[] = [];
  const directChildren = allCategories.filter(c => c.parentCategory === parentId);
  
  directChildren.forEach(child => {
    children.push(child.id);
    // Recursively get grandchildren
    const grandchildren = getChildCategories(child.id, allCategories);
    children.push(...grandchildren);
  });
  
  return children;
};

// Get all category IDs including parent and all children
export const getCategoryWithChildren = (categoryId: string, allCategories: Category[]): string[] => {
  return [categoryId, ...getChildCategories(categoryId, allCategories)];
};

// Get only top-level categories (no parent)
export const getTopLevelCategories = async (): Promise<Category[]> => {
  const allCategories = await getAllCategories();
  return allCategories.filter(c => !c.parentCategory);
};

// Build category tree structure
export interface CategoryTreeNode extends Category {
  children?: CategoryTreeNode[];
}

export const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];
  
  // First pass: create map
  categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });
  
  // Second pass: build tree
  categories.forEach(cat => {
    const categoryNode = categoryMap.get(cat.id)!;
    if (cat.parentCategory) {
      const parent = categoryMap.get(cat.parentCategory);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(categoryNode);
      } else {
        rootCategories.push(categoryNode);
      }
    } else {
      rootCategories.push(categoryNode);
    }
  });
  
  return rootCategories;
};
