'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Product, ProductTranslation, ProductVariant } from '@/lib/firestore/products';
import { addProduct, updateProduct, getProduct } from '@/lib/firestore/products_db';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { getAllBrands } from '@/lib/firestore/brands_db';
import { getAllCollections } from '@/lib/firestore/collections_db';
import { getSizes, getColors } from '@/lib/firestore/attributes_db';
import { Category } from '@/lib/firestore/categories';
import { Brand } from '@/lib/firestore/brands';
import { Collection } from '@/lib/firestore/collections';
import { Size, Color } from '@/lib/firestore/attributes';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateSlug } from '@/lib/utils/slug';
import { getProductSEO, createOrUpdateProductSEO } from '@/lib/firestore/seo_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import { Language } from '@/lib/firestore/internationalization';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';
import { optimizeImageForUpload } from '@/lib/utils/client-image';
import { cleanRichTextHtml } from '@/lib/utils/translations';
import Dialog from '../ui/Dialog';
import 'react-quill/dist/quill.snow.css';

// Polyfill for findDOMNode in React 19 (React Quill compatibility)
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactDOM = require('react-dom');
  if (!ReactDOM.findDOMNode) {
    ReactDOM.findDOMNode = (node: unknown): Node | null => {
      if (!node) return null;
      if (node && typeof node === 'object' && 'nodeType' in node && (node as { nodeType: number }).nodeType === 1) {
        return node as Node;
      }
      if (node && typeof node === 'object' && 'current' in node) {
        return (node as { current: Node | null }).current;
      }
      if (node && typeof node === 'object' && 'getDOMNode' in node) {
        const getDOMNode = (node as { getDOMNode: () => Node | null }).getDOMNode;
        return getDOMNode();
      }
      return null;
    };
  }
}

// Dynamically import ReactQuill to avoid SSR issues
const isArabicDocument = () => {
  if (typeof document === 'undefined') return false;
  const lang = String(document.documentElement?.lang || '').toLowerCase();
  return lang === 'ar' || lang.startsWith('ar-');
};

const ReactQuill = dynamic(
  async () => {
    if (typeof window === 'undefined') {
      return () => null;
    }
    const ReactQuillModule = await import('react-quill');
    return ReactQuillModule.default;
  },
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">
          {isArabicDocument() ? 'جاري تحميل محرر الوصف...' : 'Loading editor component...'}
        </div>
      </div>
    )
  }
);

const normalizeDescriptionHtml = (value: string | undefined | null) => cleanRichTextHtml(value);

interface ProductFormProps {
  productId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ productId, onSuccess, onCancel }) => {
  const initialProductState: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    slug: '', // Slug is now part of Product interface
    description: '',
    images: [],
    price: 0,
    pricingMode: 'fixed',
    salePrice: undefined,
    discountType: undefined,
    discountValue: undefined,
    goldKarat: '24K',
    goldWeight: undefined,
    makingChargeType: 'fixed',
    makingChargeValue: undefined,
    manualPriceAdjustment: undefined,
    category: '',
    collectionId: undefined,
    brandId: '',
    variants: [],
    isFeatured: false,
    isActive: true,
    allowPreOrder: false,
    isBundle: false,
    loyaltyPoints: undefined,
  } as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

  const [product, setProduct] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>(initialProductState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isClient, setIsClient] = useState(false);
  const productIdRef = useRef(productId);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [metaImageFile, setMetaImageFile] = useState<File | null>(null);
  const [metaImagePreview, setMetaImagePreview] = useState<string | null>(null);
  const [seoData, setSeoData] = useState({
    title: '',
    description: '',
    keywords: '',
    metaImage: '',
    canonicalUrl: '',
  });
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('en');
  const [translations, setTranslations] = useState<ProductTranslation[]>([]);
  const baseEnglishRef = useRef<{ name: string; description: string }>({ name: '', description: '' });
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const { t, currentLanguage } = useLanguage();
  // Use ref for t to prevent imageHandler/quillModules from recreating when translations load
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    productIdRef.current = productId;
  }, [productId]);

  const upsertTranslation = useCallback((
    existingTranslations: ProductTranslation[],
    languageCode: string,
    values: Pick<ProductTranslation, 'name' | 'description'>
  ): ProductTranslation[] => {
    const normalizedCode = String(languageCode || '').trim().toLowerCase();
    if (!normalizedCode) {
      return existingTranslations;
    }

    const nextTranslation: ProductTranslation = {
      languageCode,
      name: values.name || '',
      description: values.description || '',
      updatedAt: Timestamp.now(),
    };

    const existingIndex = existingTranslations.findIndex(
      (translation) => String(translation.languageCode || '').trim().toLowerCase() === normalizedCode
    );

    if (existingIndex >= 0) {
      const updatedTranslations = [...existingTranslations];
      updatedTranslations[existingIndex] = nextTranslation;
      return updatedTranslations;
    }

    return [...existingTranslations, nextTranslation];
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedCategories, fetchedCollections, fetchedBrands, fetchedSizes, fetchedColors, settings, allLanguages] = await Promise.all([
          getAllCategories(),
          getAllCollections(),
          getAllBrands(),
          getSizes(),
          getColors(),
          getSettings(),
          getAllLanguages(false)
        ]);
        setCategories(fetchedCategories);
        setCollections(fetchedCollections);
        setBrands(fetchedBrands);
        setSizes(fetchedSizes);
        setColors(fetchedColors);
        setLanguages(allLanguages);
        if (settings) {
          setSettings({ ...defaultSettings, ...settings });
          // Get website URL from settings
          if (settings.company?.website) {
            setWebsiteUrl(settings.company.website);
          }
        }
        // Set default language
        const defaultLang = currentLanguage?.code || 'en';
        setSelectedLanguageCode(defaultLang);
      } catch {
        // Failed to fetch attributes
      }
    };
    fetchData();

    if (productId) {
      setLoading(true);
      Promise.all([
        getProduct(productId),
        getProductSEO(productId)
      ])
        .then(([fetchedProduct, fetchedSEO]) => {
          if (fetchedProduct) {
            // Exclude id, createdAt, updatedAt, translations for form state
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, createdAt, updatedAt, ...rest } = fetchedProduct;
            const productTranslations = (fetchedProduct as Product & { translations?: ProductTranslation[] }).translations;
            setProduct({
              ...rest,
              description: normalizeDescriptionHtml(rest.description),
            });
            baseEnglishRef.current = {
              name: rest.name || '',
              description: normalizeDescriptionHtml(rest.description),
            };
            
            // Set translations
            if (productTranslations && productTranslations.length > 0) {
              setTranslations(
                productTranslations.map((translation) => ({
                  ...translation,
                  description: normalizeDescriptionHtml(translation.description),
                }))
              );
              // Set default language to current language or first available
              const defaultLang = productTranslations.find(t => t.languageCode === currentLanguage?.code) 
                || productTranslations.find(t => t.languageCode === 'en')
                || productTranslations[0];
              if (defaultLang) {
                setSelectedLanguageCode(defaultLang.languageCode);
                // Update product name and description from translation
                setProduct(prev => ({
                  ...prev,
                  name: defaultLang.name || prev.name,
                  description: normalizeDescriptionHtml(defaultLang.description) || prev.description
                }));
              }
            }
          } else {
            setError('Product not found.');
          }
          if (fetchedSEO) {
            setSeoData({
              title: fetchedSEO.title || '',
              description: fetchedSEO.description || '',
              keywords: fetchedSEO.keywords?.join(', ') || '',
              metaImage: fetchedSEO.metaImage || '',
              canonicalUrl: fetchedSEO.canonicalUrl || '',
            });
            if (fetchedSEO.metaImage) {
              setMetaImagePreview(fetchedSEO.metaImage);
            }
          }
        })
        .catch(() => {
          setError('Failed to load product for editing.');
          // Failed to load product
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Get Quill instance helper function
  const getQuillInstance = useCallback(() => {
    const editorContainer = document.querySelector('#product-description-editor-container');
    if (!editorContainer) return null;

    // Try .ql-editor first
    const editor = editorContainer.querySelector('.ql-editor') as HTMLElement & { 
      __quill?: { 
        getSelection: (focus?: boolean) => { index: number; length: number } | null; 
        insertEmbed: (index: number, type: string, value: string) => void; 
        setSelection: (index: number, length?: number) => void; 
        getLength: () => number;
        deleteText: (index: number, length: number) => void;
      } 
    } | null;
    
    if (editor?.__quill) {
      return editor.__quill;
    }

    // Try .ql-container
    const container = editorContainer.querySelector('.ql-container') as HTMLElement & { 
      __quill?: { 
        getSelection: (focus?: boolean) => { index: number; length: number } | null; 
        insertEmbed: (index: number, type: string, value: string) => void; 
        setSelection: (index: number, length?: number) => void; 
        getLength: () => number;
        deleteText: (index: number, length: number) => void;
      } 
    } | null;
    
    if (container?.__quill) {
      return container.__quill;
    }

    // Try global .ql-editor
    const globalEditor = document.querySelector('#product-description-editor-container .ql-editor') as HTMLElement & { 
      __quill?: { 
        getSelection: (focus?: boolean) => { index: number; length: number } | null; 
        insertEmbed: (index: number, type: string, value: string) => void; 
        setSelection: (index: number, length?: number) => void; 
        getLength: () => number;
        deleteText: (index: number, length: number) => void;
      } 
    } | null;
    
    if (globalEditor?.__quill) {
      return globalEditor.__quill;
    }

    return null;
  }, []);

  // Image upload handler for Quill editor
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setInfoDialogMessage(tRef.current('common.image_size_error') || 'Image size must be less than 5MB. Please compress the image and try again.');
        setShowInfoDialog(true);
        return;
      }

      // Show loading state
      const loadingMsg = document.createElement('div');
      loadingMsg.id = 'image-upload-loading';
      loadingMsg.textContent = tRef.current('admin.products_uploading_image') || 'Uploading image...';
      loadingMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #000; color: #fff; padding: 12px 20px; border-radius: 4px; z-index: 10000;';
      document.body.appendChild(loadingMsg);

      try {
        // Sanitize filename
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const productIdOrNew = productIdRef.current || 'new';
        const filePath = `products/${productIdOrNew}/description/${Date.now()}_${sanitizedFileName}`;
        
        const optimizedImage = await optimizeImageForUpload(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.78 });
        const storageRef = ref(storage, filePath.replace(sanitizedFileName, optimizedImage.name));
        const uploadResult = await uploadBytes(storageRef, optimizedImage, {
          contentType: optimizedImage.type,
        });
        const url = await getDownloadURL(uploadResult.ref);

        // Get Quill instance with multiple retries
        let quillInstance = getQuillInstance();
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!quillInstance && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200));
          quillInstance = getQuillInstance();
          attempts++;
        }
        
        if (!quillInstance) {
          // Last attempt: try to find it by clicking in the editor first
          const editorElement = document.querySelector('#product-description-editor-container .ql-editor') as HTMLElement;
          if (editorElement) {
            editorElement.focus();
            await new Promise(resolve => setTimeout(resolve, 300));
            quillInstance = getQuillInstance();
          }
        }
        
        if (!quillInstance) {
          throw new Error('Quill editor not found. Please make sure the editor is loaded and try again.');
        }

        // Insert image at cursor position
        const range = quillInstance.getSelection(true);
        if (range && range.index !== null && range.index >= 0) {
          // Delete any selected text first to avoid showing URL
          if (range.length > 0) {
            quillInstance.deleteText(range.index, range.length);
          }
          // Insert image embed (not URL text)
          quillInstance.insertEmbed(range.index, 'image', url);
          // Move cursor after the image
          quillInstance.setSelection(range.index + 1, 0);
        } else {
          // Insert at end if no selection
          const length = quillInstance.getLength();
          quillInstance.insertEmbed(length - 1, 'image', url);
          quillInstance.setSelection(length, 0);
        }

        // Update product description
        const editorElement = document.querySelector('#product-description-editor-container .ql-editor') as HTMLElement;
        if (editorElement) {
          setProduct(prev => ({
            ...prev,
            description: normalizeDescriptionHtml(editorElement.innerHTML)
          }));
        }

        // Remove loading message
        const loadingElement = document.getElementById('image-upload-loading');
        if (loadingElement) {
          loadingElement.textContent = tRef.current('admin.products_image_upload_success') || 'Image uploaded successfully!';
          loadingElement.style.background = '#10b981';
          setTimeout(() => {
            if (loadingElement.parentNode) {
              loadingElement.parentNode.removeChild(loadingElement);
            }
          }, 2000);
        }
      } catch (error: unknown) {
        // Failed to upload image
        
        const loadingElement = document.getElementById('image-upload-loading');
        if (loadingElement) {
          loadingElement.parentNode?.removeChild(loadingElement);
        }

        let errorMessage = tRef.current('admin.products_upload_failed_prefix') || 'Failed to upload image. ';
        const errorObj = error as { code?: string; message?: string };
        if (errorObj.code === 'storage/unauthorized') {
          errorMessage += tRef.current('admin.products_upload_unauthorized') || 'You are not authorized to upload images.';
        } else if (errorObj.code === 'storage/canceled') {
          errorMessage += tRef.current('admin.products_upload_canceled') || 'Upload was canceled.';
        } else if (errorObj.code === 'storage/unknown') {
          errorMessage += tRef.current('admin.products_upload_unknown') || 'An unknown error occurred.';
        } else if (errorObj.message) {
          errorMessage += errorObj.message;
        } else {
          errorMessage += tRef.current('common.please_try_again') || 'Please try again.';
        }
        
        setInfoDialogMessage(errorMessage);
        setShowInfoDialog(true);
      }
    };
  }, [getQuillInstance]);

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    }
  }), [imageHandler]);
  
  const quillFormats = useMemo(() => [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'script',
    'align',
    'link', 'image', 'video',
    'clean'
  ], []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setProduct(prevProduct => {
      const normalizedValue =
        type === 'checkbox'
          ? checked
          : type === 'number'
            ? (value === '' ? undefined : parseFloat(value))
            : name === 'description'
              ? normalizeDescriptionHtml(value)
              : value;

      const updated = {
        ...prevProduct,
        [name]: normalizedValue,
      };
      
      // Auto-generate slug when name changes
      if (name === 'name' && value) {
        updated.slug = generateSlug(value);
        // Auto-generate canonical URL when slug changes
        if (updated.slug && websiteUrl) {
          setSeoData(prev => ({
            ...prev,
            canonicalUrl: prev.canonicalUrl || `${websiteUrl}/products/${updated.slug}`
          }));
        }
      }
      
      return updated;
    });
    
    if (selectedLanguageCode === 'en' && (name === 'name' || name === 'description')) {
      baseEnglishRef.current = {
        name: name === 'name' ? String(value) : (product.name || ''),
        description: name === 'description' ? String(value) : (product.description || ''),
      };
    }

    // Update translation if editing a specific language
    if (selectedLanguageCode !== 'en' && (name === 'name' || name === 'description')) {
      setTranslations(prev =>
        upsertTranslation(prev, selectedLanguageCode, {
          name: name === 'name' ? String(value) : product.name,
          description: name === 'description' ? normalizeDescriptionHtml(value) : product.description,
        })
      );
    }
  };

  // Handle language change
  const handleLanguageChange = (languageCode: string) => {
    const normalizedSelected = String(selectedLanguageCode || '').trim().toLowerCase();
    const normalizedTarget = String(languageCode || '').trim().toLowerCase();

    if (selectedLanguageCode === 'en') {
      baseEnglishRef.current = {
        name: product.name || '',
        description: product.description || '',
      };
    } else {
      setTranslations(prev =>
        upsertTranslation(prev, selectedLanguageCode, {
          name: product.name || '',
          description: product.description || '',
        })
      );
    }

    setSelectedLanguageCode(languageCode);
    
    if (normalizedTarget === 'en') {
      setProduct(prev => ({
        ...prev,
        name: baseEnglishRef.current.name || '',
        description: normalizeDescriptionHtml(baseEnglishRef.current.description) || ''
      }));
    } else {
      const latestTranslations =
        normalizedSelected !== 'en'
          ? upsertTranslation(translations, selectedLanguageCode, {
              name: product.name || '',
              description: product.description || '',
            })
          : translations;
      const translation = latestTranslations.find(
        (t) => String(t.languageCode || '').trim().toLowerCase() === normalizedTarget
      );
      if (translation) {
        setProduct(prev => ({
          ...prev,
          name: translation.name || '',
          description: normalizeDescriptionHtml(translation.description) || ''
        }));
      } else {
        setProduct(prev => ({
          ...prev,
          name: '',
          description: ''
        }));
      }
    }
  };

  const handleManualImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setProduct(prevProduct => ({
      ...prevProduct,
      images: value.split(',').map(url => url.trim()).filter(url => url !== ''),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...files]);

      // Create previews
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleMetaImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMetaImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setMetaImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMetaImage = () => {
    setMetaImageFile(null);
    setMetaImagePreview(null);
    setSeoData(prev => ({ ...prev, metaImage: '' }));
  };

  const removeImage = (index: number, isPreview: boolean) => {
    if (isPreview) {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
        setProduct(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    }
  };

  const handleVariantChange = (index: number, field: string, value: string | number | undefined) => {
    const newVariants = [...product.variants];
    
    // If selecting a size, set both name="Size" and value="Small"
    if (field === 'sizeId') {
        const selectedSize = sizes.find(s => s.id === value);
        if (selectedSize) {
            newVariants[index] = {
                ...newVariants[index],
                name: 'Size',
                value: selectedSize.name,
            };
        }
    } else if (field === 'colorId') {
        const selectedColor = colors.find(c => c.id === value);
        if (selectedColor) {
             newVariants[index] = {
                ...newVariants[index],
                name: 'Color',
                value: selectedColor.name,
            };
        }
    } else {
        // Standard fields like stock, price, salePrice, priceAdjustment
        newVariants[index] = {
            ...newVariants[index],
            [field]: value
        };
    }

    setProduct(prevProduct => ({
      ...prevProduct,
      variants: newVariants,
    }));
  };

  const addVariant = () => {
    setProduct(prevProduct => ({
      ...prevProduct,
      variants: [...prevProduct.variants, { 
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9), 
        name: 'Size', 
        value: '', 
        stock: 0,
        extraPrice: 0
      }],
    }));
  };

  const removeVariant = (index: number) => {
    setProduct(prevProduct => ({
      ...prevProduct,
      variants: prevProduct.variants.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled (only for updates, not for new products)
    if (productId && settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let finalImages = [...product.images];

      // Upload new images
      if (imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
            const optimizedImage = await optimizeImageForUpload(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
            const storageRef = ref(storage, `products/${Date.now()}_${optimizedImage.name}`);
            const uploadResult = await uploadBytes(storageRef, optimizedImage, {
              contentType: optimizedImage.type,
            });
            return getDownloadURL(uploadResult.ref);
        });
        const uploadedUrls = await Promise.all(uploadPromises);
        finalImages = [...finalImages, ...uploadedUrls];
      }

      const finalTranslations = upsertTranslation(
        [...translations],
        selectedLanguageCode,
        {
          name: product.name || '',
          description: normalizeDescriptionHtml(product.description) || '',
        }
      );

      const englishTranslation =
        String(selectedLanguageCode || '').trim().toLowerCase() === 'en'
          ? { name: product.name || '', description: product.description || '' }
          : finalTranslations.find(
              (translation) => String(translation.languageCode || '').trim().toLowerCase() === 'en'
            );

      // Ensure slug exists before saving
      const finalProductData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'analytics'> & { 
        images: string[];
        translations?: ProductTranslation[];
      } = {
        ...product,
        name: englishTranslation?.name || baseEnglishRef.current.name || '',
        description: normalizeDescriptionHtml(englishTranslation?.description || baseEnglishRef.current.description || ''),
        images: finalImages
      };
      if (!finalProductData.slug || finalProductData.slug.trim() === '') {
        // Generate slug from name if missing
        finalProductData.slug = generateSlug(finalProductData.name || `product-${Date.now()}`);
      }

      const localizedTranslations = finalTranslations.filter(
        (translation) =>
          String(translation.languageCode || '').trim().toLowerCase() !== 'en' &&
          Boolean(translation.name || normalizeDescriptionHtml(translation.description))
      ).map((translation) => ({
        ...translation,
        description: normalizeDescriptionHtml(translation.description),
      }));

      if (localizedTranslations.length > 0) {
        finalProductData.translations = localizedTranslations;
      } else {
        delete finalProductData.translations;
      }

      // Firestore does not allow undefined field values – clean them before save
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleanedProductData: any = { ...finalProductData };
      if (!finalProductData.discountType) {
        delete cleanedProductData.discountType;
        delete cleanedProductData.discountValue;
      } else if (finalProductData.discountValue === undefined || Number.isNaN(finalProductData.discountValue as number)) {
        delete cleanedProductData.discountValue;
      }
      if (finalProductData.salePrice === undefined || Number.isNaN(finalProductData.salePrice as number)) {
        delete cleanedProductData.salePrice;
      }
      if (finalProductData.pricingMode !== 'gold') {
        delete cleanedProductData.goldKarat;
        delete cleanedProductData.goldWeight;
        delete cleanedProductData.makingChargeType;
        delete cleanedProductData.makingChargeValue;
        delete cleanedProductData.manualPriceAdjustment;
        delete cleanedProductData.goldPricingSnapshot;
      } else {
        delete cleanedProductData.salePrice;
        delete cleanedProductData.discountType;
        delete cleanedProductData.discountValue;
      }
      // Generic cleanup: remove ALL remaining undefined fields
      Object.keys(cleanedProductData).forEach(key => {
        if (cleanedProductData[key] === undefined) {
          delete cleanedProductData[key];
        }
      });

      let savedProductId = productId;
      if (productId) {
        await updateProduct(productId, cleanedProductData);
      } else {
        savedProductId = await addProduct(cleanedProductData);
      }

      // Upload meta image if file is selected
      let metaImageUrl = seoData.metaImage;
      if (metaImageFile) {
        const optimizedImage = await optimizeImageForUpload(metaImageFile, { maxWidth: 1600, maxHeight: 900, quality: 0.8 });
        const storageRef = ref(storage, `products/${savedProductId}/meta-image/${Date.now()}_${optimizedImage.name}`);
        const uploadResult = await uploadBytes(storageRef, optimizedImage, {
          contentType: optimizedImage.type,
        });
        metaImageUrl = await getDownloadURL(uploadResult.ref);
      }

      // Auto-generate canonical URL if not set (use website URL from settings)
      const finalCanonicalUrl = seoData.canonicalUrl || (finalProductData.slug && websiteUrl ? `${websiteUrl}/products/${finalProductData.slug}` : undefined);

      // Save SEO data
      if (savedProductId && (seoData.title || seoData.description || seoData.keywords || metaImageUrl || finalCanonicalUrl)) {
        await createOrUpdateProductSEO({
          productId: savedProductId,
          title: seoData.title || undefined,
          description: seoData.description || undefined,
          keywords: seoData.keywords ? seoData.keywords.split(',').map(k => k.trim()).filter(k => k) : undefined,
          metaImage: metaImageUrl || undefined,
          canonicalUrl: finalCanonicalUrl || undefined,
          noIndex: false,
          noFollow: false,
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to save product:', err);
      setError(t('admin.products_save_failed') || 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && productId && !product.name) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {t('common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-gray-900">
        {productId
          ? `${t('common.edit') || 'Edit'} ${t('admin.products') || 'Products'}`
          : `${t('common.add') || 'Add'} ${t('admin.products') || 'Products'}`}
      </h2>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Language Selector */}
        {languages.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('admin.select_language') || t('admin.translations_select_language_placeholder') || 'Select Language'}
            </label>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang: Language) => {
                const hasTranslation = translations.some((t: ProductTranslation) => t.languageCode === lang.code);
                const isSelected = selectedLanguageCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : hasTranslation
                        ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {lang.name} {lang.nativeName && `(${lang.nativeName})`}
                    {!hasTranslation && <span className="ml-1 sm:ml-2 text-xs">{t('admin.language_new_badge') || 'New'}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label htmlFor="name" className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.product_templates_use_modal_name_label') || t('common.name') || 'Product Name'}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={product.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="price" className="block text-gray-700 text-sm font-semibold mb-2">
              {t('products.price') || 'Price'}
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={product.price}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              required
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Discount Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 border-t border-gray-200 pt-6">
          <div>
            <label htmlFor="pricingMode" className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.products_pricing_mode_label') || 'Pricing Mode'}
            </label>
            <select
              id="pricingMode"
              name="pricingMode"
              value={product.pricingMode || 'fixed'}
              onChange={(e) => {
                const value = e.target.value as 'fixed' | 'gold';
                setProduct(prev => ({
                  ...prev,
                  pricingMode: value,
                  salePrice: value === 'gold' ? undefined : prev.salePrice,
                  discountType: value === 'gold' ? undefined : prev.discountType,
                  discountValue: value === 'gold' ? undefined : prev.discountValue,
                }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all bg-white"
            >
              <option value="fixed">{t('admin.products_pricing_mode_fixed') || 'Fixed Price'}</option>
              <option value="gold">{t('admin.products_pricing_mode_gold') || 'Gold Price Based'}</option>
            </select>
          </div>
          <div>
            <label htmlFor="salePrice" className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.products_sale_price_optional') || 'Sale Price - Optional'}
            </label>
            <input
              type="number"
              id="salePrice"
              name="salePrice"
              value={product.salePrice || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                setProduct(prev => ({ ...prev, salePrice: value }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              min="0"
              step="0.01"
              placeholder={t('admin.products_enter_sale_price') || 'Enter sale price'}
              disabled={product.pricingMode === 'gold'}
            />
            <p className="text-xs text-gray-500 mt-1">{t('admin.products_sale_price_hint') || 'If set, this will be the discounted price'}</p>
          </div>
          <div>
            <label htmlFor="discountType" className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.products_discount_type') || 'Discount Type'}</label>
            <select
              id="discountType"
              name="discountType"
              value={product.discountType || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : e.target.value as 'percentage' | 'fixed';
                setProduct(prev => ({ ...prev, discountType: value }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all bg-white"
            >
              <option value="">{t('admin.products_discount_none') || 'None'}</option>
              <option value="percentage">{t('admin.products_discount_percentage') || 'Percentage (%)'}</option>
              <option value="fixed">{t('admin.products_discount_fixed_amount') || 'Fixed Amount'}</option>
            </select>
          </div>
          <div>
            <label htmlFor="discountValue" className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.products_discount_value') || 'Discount Value'} {product.discountType === 'percentage' ? '(%)' : ''}
            </label>
            <input
              type="number"
              id="discountValue"
              name="discountValue"
              value={product.discountValue || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                setProduct(prev => ({ ...prev, discountValue: value }));
                // Auto-calculate salePrice if discount type is set
                if (product.discountType && value !== undefined && product.price > 0) {
                  if (product.discountType === 'percentage') {
                    const calculatedSalePrice = product.price * (1 - value / 100);
                    setProduct(prev => ({ ...prev, salePrice: calculatedSalePrice, discountValue: value }));
                  } else {
                    const calculatedSalePrice = Math.max(0, product.price - value);
                    setProduct(prev => ({ ...prev, salePrice: calculatedSalePrice, discountValue: value }));
                  }
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              min="0"
              step={product.discountType === 'percentage' ? '0.01' : '0.01'}
              placeholder={product.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 500'}
              disabled={!product.discountType || product.pricingMode === 'gold'}
            />
          </div>
        </div>

        {product.pricingMode === 'gold' && (
          <div className="border-t border-gray-200 pt-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">{t('admin.products_gold_pricing') || 'Gold Pricing'}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {t('admin.products_gold_pricing_hint') || 'Dynamic price is based on cached gold rate, product weight, making charge, manual adjustment, and gold tax settings.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <label htmlFor="goldKarat" className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.products_gold_karat') || 'Gold Karat'}</label>
                <select
                  id="goldKarat"
                  name="goldKarat"
                  value={product.goldKarat || '24K'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all bg-white"
                >
                  <option value="24K">24K</option>
                  <option value="22K">22K</option>
                  <option value="21K">21K</option>
                  <option value="18K">18K</option>
                </select>
              </div>

              <div>
                <label htmlFor="goldWeight" className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.products_gold_weight') || 'Weight (grams)'}</label>
                <input
                  type="number"
                  id="goldWeight"
                  name="goldWeight"
                  value={product.goldWeight ?? ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                  min="0"
                  step="0.001"
                  placeholder="e.g. 4.250"
                />
              </div>

              <div>
                <label htmlFor="makingChargeType" className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.products_making_charge_type') || 'Making Charge Type'}</label>
                <select
                  id="makingChargeType"
                  name="makingChargeType"
                  value={product.makingChargeType || 'fixed'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all bg-white"
                >
                  <option value="fixed">{t('admin.products_discount_fixed_amount') || 'Fixed Amount'}</option>
                  <option value="percentage">{t('admin.products_discount_percentage_short') || 'Percentage'}</option>
                </select>
              </div>

              <div>
                <label htmlFor="makingChargeValue" className="block text-gray-700 text-sm font-semibold mb-2">
                  {t('admin.products_making_charge') || 'Making Charge'} {product.makingChargeType === 'percentage' ? '(%)' : ''}
                </label>
                <input
                  type="number"
                  id="makingChargeValue"
                  name="makingChargeValue"
                  value={product.makingChargeValue ?? ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                  min="0"
                  step="0.01"
                  placeholder={product.makingChargeType === 'percentage' ? 'e.g. 8' : 'e.g. 150'}
                />
              </div>

              <div>
                <label htmlFor="manualPriceAdjustment" className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.products_manual_adjustment') || 'Manual Adjustment'}</label>
                <input
                  type="number"
                  id="manualPriceAdjustment"
                  name="manualPriceAdjustment"
                  value={product.manualPriceAdjustment ?? ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                  step="0.01"
                  placeholder="e.g. 25"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <div className="h-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-900">{t('admin.products_gold_pricing_settings') || 'Current Gold Pricing Settings'}</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Provider: {settings.goldPricing?.provider || 'manual'} | Refresh: {settings.goldPricing?.refreshIntervalSeconds || 60}s
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    Default margin: {settings.goldPricing?.defaultMarginValue || 0} {settings.goldPricing?.defaultMarginType === 'percentage' ? '%' : 'SAR'} | Taxes: 24K {settings.goldPricing?.karatTaxRates?.['24K'] || 0}% / 22K {settings.goldPricing?.karatTaxRates?.['22K'] || 0}% / 21K {settings.goldPricing?.karatTaxRates?.['21K'] || 0}% / 18K {settings.goldPricing?.karatTaxRates?.['18K'] || 0}%
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    Cached rate: {settings.goldPricing?.cache?.pricePerGram || settings.goldPricing?.manualPricePerGram || 0} {settings.goldPricing?.cache?.currency || 'SAR'} / gram
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loyalty Points Section - Only show if loyalty points are enabled in settings */}
        <div className="border-t border-gray-200 pt-6">
          <div>
            <label htmlFor="loyaltyPoints" className="block text-gray-700 text-sm font-semibold mb-2">
              {t('admin.products_loyalty_points_optional') || 'Loyalty Points (Optional)'}
            </label>
            <input
              type="number"
              id="loyaltyPoints"
              name="loyaltyPoints"
              value={product.loyaltyPoints || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                setProduct(prev => ({ ...prev, loyaltyPoints: value }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              min="0"
              step="1"
              placeholder={t('admin.products_loyalty_points_placeholder') || 'e.g. 100'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.products_loyalty_points_hint') || 'Points customers will earn when purchasing this product'}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-gray-700 text-sm font-semibold mb-2">
            {t('products.description') || t('common.description') || 'Description'}
          </label>
          <textarea
            id="description"
            name="description"
            value={product.description || ''}
            onChange={handleChange}
            rows={12}
            dir={selectedLanguageCode === 'ar' ? 'rtl' : 'ltr'}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all resize-y ${
              selectedLanguageCode === 'ar' ? 'text-right' : ''
            }`}
            placeholder={t('admin.products_description_placeholder') || 'Write product description here...'}
          />
          <p className="text-xs text-gray-500 mt-2">
            {t('admin.products_description_help') || 'Use plain text here so the saved content stays visible and easy to edit.'}
          </p>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">{t('admin.products_images_label') || 'Product Images'}</label>
          
          <div className="space-y-4">
             {/* Image Previews */}
             <div className="flex flex-wrap gap-4">
                {product.images.map((url, index) => (
                    <div key={`existing-${index}`} className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                        {/* Use simple img tag for production compatibility */}
                        <img 
                            src={url} 
                            alt={`${t('admin.products_image_alt') || 'Product'} ${index + 1}`} 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                        <button
                            type="button"
                            onClick={() => removeImage(index, false)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
                {imagePreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                        {/* Use simple img tag for production compatibility */}
                        <img 
                            src={preview} 
                            alt={`${t('admin.products_new_upload_alt') || 'New Upload'} ${index + 1}`} 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="text-white text-xs font-bold">{t('admin.language_new_badge') || 'New'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => removeImage(index, true)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
             </div>

             {/* Upload Button */}
             <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file-products" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">{t('admin.upload_click_to_upload') || 'Click to upload'}</span> {t('admin.upload_or_drag_drop') || 'or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">{t('admin.upload_file_types_hint') || 'SVG, PNG, JPG or GIF (MAX. 800x400px)'}</p>
                    </div>
                    <input id="dropzone-file-products" type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                </label>
            </div>

            <div className="text-xs text-gray-400">
                {t('admin.upload_or_enter_urls') || 'Or manually enter URLs (comma-separated):'}
                <input
                    type="text"
                    id="images"
                    name="images"
                    value={product.images.join(', ')}
                    onChange={handleManualImageChange}
                    placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                    className="mt-1 w-full px-3 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-gray-400 outline-none"
                />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settings?.features?.category && (
            <div>
              <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.categories') || 'Category'}</label>
              <select
                id="category"
                name="category"
                value={product.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                required
              >
                <option value="">{t('admin.products_select_category') || 'Select Category'}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {settings?.features?.collections && (
            <div>
              <label htmlFor="collectionId" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.products_collection_optional') || 'Collection (Optional)'}</label>
              <select
                id="collectionId"
                name="collectionId"
                value={product.collectionId || ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : e.target.value;
                  setProduct(prev => ({ ...prev, collectionId: value }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              >
                <option value="">{t('admin.products_select_collection') || 'Select Collection'}</option>
                {collections.map(collection => (
                  <option key={collection.id} value={collection.id}>{collection.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {settings?.features?.brands && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="brandId" className="block text-gray-700 text-sm font-bold mb-2">{t('admin.brands') || 'Brand'}</label>
              <select
                id="brandId"
                name="brandId"
                value={product.brandId || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              >
                <option value="">{t('admin.products_select_brand') || 'Select Brand'}</option>
                {brands.map(brand => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-6">
          <label className="block text-gray-700 text-sm font-bold mb-4">{t('admin.products_variants') || 'Variants'}</label>
          {product.variants.map((variant, index) => (
            <div key={variant.id} className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center bg-gray-50 p-4 rounded-lg">
              {/* Variant Type Selector */}
              <div className="w-full md:w-1/4">
                 <select
                    value={variant.name}
                    onChange={(e) => {
                        // Reset value when type changes
                        const newVariants = [...product.variants];
                        newVariants[index] = { ...newVariants[index], name: e.target.value, value: '' };
                        setProduct(prev => ({ ...prev, variants: newVariants }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                 >
                    <option value="Size">{t('admin.products_variant_size') || 'Size'}</option>
                    <option value="Color">{t('admin.products_variant_color') || 'Color'}</option>
                    <option value="Material">{t('admin.products_variant_material') || 'Material (Custom)'}</option>
                 </select>
              </div>

              {/* Value Selector (Dynamic based on Type) */}
              <div className="w-full md:w-1/4">
                  {variant.name === 'Size' ? (
                      <select
                        value={sizes.find(s => s.name === variant.value)?.id || ''}
                        onChange={(e) => handleVariantChange(index, 'sizeId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                      >
                          <option value="">{t('admin.products_select_size') || 'Select Size'}</option>
                          {sizes.map(size => (
                              <option key={size.id} value={size.id}>{size.name} ({size.code})</option>
                          ))}
                      </select>
                  ) : variant.name === 'Color' ? (
                      <select
                        value={colors.find(c => c.name === variant.value)?.id || ''}
                        onChange={(e) => handleVariantChange(index, 'colorId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                      >
                          <option value="">{t('admin.products_select_color') || 'Select Color'}</option>
                          {colors.map(color => (
                              <option key={color.id} value={color.id}>{color.name}</option>
                          ))}
                      </select>
                  ) : (
                      <input
                        type="text"
                        placeholder="Value (e.g. Cotton)"
                        value={variant.value}
                        onChange={(e) => handleVariantChange(index, 'value', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                  )}
              </div>

              <input
                type="number"
                placeholder={t('admin.products_variant_stock_placeholder') || 'Stock'}
                value={variant.stock}
                onChange={(e) => handleVariantChange(index, 'stock', parseFloat(e.target.value) || 0)}
                className="w-full md:w-1/4 px-3 py-2 border border-gray-300 rounded"
                min="0"
              />
              <input
                type="number"
                placeholder={t('admin.products_variant_extra_price_placeholder') || 'Extra Price'}
                value={variant.extraPrice ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const newVariants = [...product.variants];
                  newVariants[index] = { ...newVariants[index], extraPrice: val } as ProductVariant;
                  setProduct(prev => ({ ...prev, variants: newVariants }));
                }}
                className="w-full md:w-1/4 px-3 py-2 border border-gray-300 rounded"
                min="0"
                step="0.01"
                title="Extra price added to base product price (e.g., +200 for Medium size, 0 for no extra charge)"
              />
              <button
                type="button"
                onClick={() => removeVariant(index)}
                className="text-red-600 hover:text-red-800 font-medium px-2"
              >
                {t('common.remove') || 'Remove'}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVariant}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('admin.products_add_variant') || 'Add Variant'}
          </button>
        </div>

        {/* SEO Configuration */}
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.products_seo_configuration') || 'SEO Configuration'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_title') || 'Meta Title'}</label>
              <input
                type="text"
                value={seoData.title}
                onChange={(e) => setSeoData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                placeholder={product.name || (t('admin.products_seo_meta_title_placeholder') || 'Product meta title')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_description') || 'Meta Description'}</label>
              <textarea
                value={seoData.description}
                onChange={(e) => setSeoData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none h-24 resize-none"
                placeholder={t('admin.products_seo_meta_description_placeholder') || 'Brief description for search engines...'}
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_keywords_label') || 'Keywords (comma-separated)'}</label>
              <input
                type="text"
                value={seoData.keywords}
                onChange={(e) => setSeoData(prev => ({ ...prev, keywords: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_image') || 'Meta Image'}</label>
              
              {/* Image Preview */}
              {(metaImagePreview || seoData.metaImage) && (
                <div className="relative w-full max-w-xs h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 mb-4 group">
                  {/* Use simple img tag for production compatibility */}
                  <img 
                    src={metaImagePreview || seoData.metaImage || '/placeholder.png'} 
                    alt={t('admin.products_seo_meta_image_preview_alt') || 'Meta Image Preview'}  
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeMetaImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file-meta" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">{t('admin.upload_click_to_upload') || 'Click to upload'}</span> {t('admin.upload_or_drag_drop') || 'or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500">{t('admin.upload_file_types_hint_meta') || 'SVG, PNG, JPG or GIF (MAX. 1200x630px)'}</p>
                  </div>
                  <input id="dropzone-file-meta" type="file" className="hidden" accept="image/*" onChange={handleMetaImageChange} />
                </label>
              </div>

              {/* Manual URL Input */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">{t('admin.upload_or_enter_url_manually') || 'Or enter URL manually:'}</p>
                <input
                  type="text"
                  value={seoData.metaImage}
                  onChange={(e) => {
                    setSeoData(prev => ({ ...prev, metaImage: e.target.value }));
                    setMetaImageFile(null);
                    setMetaImagePreview(null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                  placeholder={t('admin.upload_url_placeholder') || 'https://example.com/image.jpg'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_canonical_url') || 'Canonical URL'}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seoData.canonicalUrl || (product.slug && websiteUrl ? `${websiteUrl}/products/${product.slug}` : '')}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-gray-50"
                  placeholder={websiteUrl ? `Auto-generated from product slug (${websiteUrl}/products/...)` : 'Loading website URL...'}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (product.slug && websiteUrl) {
                      const autoUrl = `${websiteUrl}/products/${product.slug}`;
                      setSeoData(prev => ({ ...prev, canonicalUrl: autoUrl }));
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerate from product slug"
                  disabled={!product.slug || !websiteUrl}
                >
                  Auto
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Auto-generated from product slug. Click &quot;Auto&quot; to regenerate.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-6 border-t border-gray-200 pt-6">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="isFeatured"
              checked={product.isFeatured}
              onChange={handleChange}
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-700 font-medium">{t('admin.products_featured') || 'Featured Product'}</span>
          </label>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={product.isActive}
              onChange={handleChange}
              className="form-checkbox h-5 w-5 text-green-600 rounded focus:ring-green-500"
            />
            <span className="ml-2 text-gray-700 font-medium">{t('admin.products_active') || 'Active Product'}</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 sm:gap-4 pt-6 border-t border-gray-200">
          {productId && (
            <Link
              href={`/admin/products/templates/save?product=${productId}`}
              className="px-4 sm:px-6 py-2 border border-purple-300 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m-3-3h6.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {t('admin.products_save_as_template') || 'Save as Template'}
            </Link>
          )}
          <div className="flex items-center gap-3 sm:gap-4 sm:ml-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 sm:px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.saving') || 'Saving...'}
                </>
              ) : (
                productId ? (t('admin.products_update_button') || 'Update Product') : (t('admin.products_create_button') || 'Create Product')
              )}
            </button>
          </div>
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

export default ProductForm;
