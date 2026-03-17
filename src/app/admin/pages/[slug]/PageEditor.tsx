'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPageBySlug, updatePageTranslation } from '@/lib/firestore/pages_db';
import { PAGE_SLUGS, Page, PageContentTranslation } from '@/lib/firestore/pages';
import { Timestamp } from 'firebase/firestore';
import { getAllLanguages } from '@/lib/firestore/internationalization_db';
import { Language } from '@/lib/firestore/internationalization';
import { useLanguage } from '../../../../context/LanguageContext';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAllStoreLocations, createStoreLocation, updateStoreLocation, deleteStoreLocation } from '@/lib/firestore/store_locations_db';
import { StoreLocation } from '@/lib/firestore/store_locations';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';
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

// Loading component for ReactQuill that uses translations
const ReactQuillLoading = () => {
  const { t } = useLanguage();
  return (
    <div className="w-full h-[400px] border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
      <div className="text-gray-500">{t('admin.page_editor_loading') || 'Loading editor component...'}</div>
    </div>
  );
};

// Dynamically import ReactQuill to avoid SSR issues
// Note: React Quill 2.0.0 has compatibility issues with React 19
// We'll use a workaround by patching findDOMNode
const ReactQuill = dynamic(
  async () => {
    if (typeof window === 'undefined') {
      return () => null;
    }
    
    // Loading ReactQuill module
    const ReactQuillModule = await import('react-quill');
    const RQ = ReactQuillModule.default;
    // ReactQuill module loaded
    
    // Return the component as-is - the error might be from internal usage
    // which we can't easily fix, but the component should still work
    return RQ;
  },
  { 
    ssr: false,
    loading: () => <ReactQuillLoading />
  }
);

interface FAQItem {
  question: string;
  answer: string;
}

interface JobItem {
  title: string;
  department: string;
  location: string;
  type: string; // Full-time, Part-time, Contract, etc.
  description: string;
  requirements: string;
  isActive: boolean;
}

interface SizeGuideRow {
  sizeLabel: string;
  length: string;
  chest: string;
  sleeve: string;
  heightRange: string;
}

interface MeasureGuideItem {
  label: string;
  description: string;
}

interface StoreLocationItem {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  description: string;
  isActive: boolean;
}

const PageEditor = () => {
  const params = useParams();
  const slug = params.slug as string;
  const { currentLanguage, t } = useLanguage();
  const pageTitle = PAGE_SLUGS[slug as keyof typeof PAGE_SLUGS] || (t('admin.page_editor_unknown_page') || 'Unknown Page');
  const [, setQuillInstance] = useState<{ root: { innerHTML: string } } | null>(null);
  const quillRef = React.useRef<{ root: { innerHTML: string }; clipboard?: { convert: (html: string) => unknown } } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const isLoadingRef = React.useRef(false);
  const normalizeCode = React.useCallback((code?: string | null) => String(code || '').trim().toLowerCase(), []);
  const tt = React.useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v && v !== key ? v : fallback;
    },
    [t],
  );

  const localizedPageTitle = tt(`admin.pages.${slug}.title`, pageTitle);

  const decodeHtmlEntities = React.useCallback((input: string) => {
    const decodeOnce = (raw: string) => {
      // Browser-safe decode
      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = raw;
        return textarea.value;
      }

      // SSR fallback decode (best-effort)
      return raw
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
    };

    let s = String(input || '');
    // Some content can be double-encoded (e.g. &amp;lt;h2&amp;gt;)
    // Decode a few times until it stabilizes.
    for (let i = 0; i < 3; i++) {
      const decoded = decodeOnce(s);
      if (decoded === s) break;
      s = decoded;
    }
    return s;
  }, []);
  const getDraftKey = React.useCallback(
    (draftSlug: string, code: string) => `page_editor_draft_${draftSlug}_${normalizeCode(code) || code}`,
    [normalizeCode],
  );

  const readDraft = React.useCallback(
    (draftSlug: string, code: string) => {
      try {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(getDraftKey(draftSlug, code));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed as {
          savedAt: number;
          data: Pick<PageContentTranslation, 'languageCode' | 'title' | 'content' | 'metaTitle' | 'metaDescription'>;
        };
      } catch {
        return null;
      }
    },
    [getDraftKey],
  );

  const writeDraft = React.useCallback(
    (draftSlug: string, code: string, data: Pick<PageContentTranslation, 'languageCode' | 'title' | 'content' | 'metaTitle' | 'metaDescription'>) => {
      try {
        if (typeof window === 'undefined') return;
        localStorage.setItem(
          getDraftKey(draftSlug, code),
          JSON.stringify({
            savedAt: Date.now(),
            data,
          }),
        );
      } catch {
        // ignore
      }
    },
    [getDraftKey],
  );

  const clearDraft = React.useCallback(
    (draftSlug: string, code: string) => {
      try {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(getDraftKey(draftSlug, code));
      } catch {
        // ignore
      }
    },
    [getDraftKey],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('en');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  
  // FAQ-specific state
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  
  // Careers-specific state
  const [jobItems, setJobItems] = useState<JobItem[]>([]);

  // Size Guide-specific state
  const [sizeRows, setSizeRows] = useState<SizeGuideRow[]>([
    { sizeLabel: '50 (XS)', length: '50"', chest: '20"', sleeve: '26"', heightRange: `4'10" - 5'0"` },
    { sizeLabel: '52 (S)', length: '52"', chest: '21"', sleeve: '27"', heightRange: `5'1" - 5'2"` },
    { sizeLabel: '54 (M)', length: '54"', chest: '22"', sleeve: '28"', heightRange: `5'3" - 5'4"` },
    { sizeLabel: '56 (L)', length: '56"', chest: '23"', sleeve: '29"', heightRange: `5'5" - 5'6"` },
    { sizeLabel: '58 (XL)', length: '58"', chest: '24"', sleeve: '30"', heightRange: `5'7" - 5'8"` },
    { sizeLabel: '60 (XXL)', length: '60"', chest: '25"', sleeve: '31"', heightRange: `5'9" +` },
  ]);

  const [measureItems, setMeasureItems] = useState<MeasureGuideItem[]>([
    { label: 'Length', description: 'Measure from the highest point of the shoulder down to the hem.' },
    { label: 'Bust', description: 'Measure across the fullest part of the chest, under the arms.' },
    { label: 'Sleeve', description: 'Measure from the shoulder seam down to the wrist.' },
    { label: 'Hips', description: 'Measure around the fullest part of the hips.' },
  ]);

  const [sizeFootnote, setSizeFootnote] = useState('* Sizes may vary slightly depending on the style and cut.');
  const [supportHeading, setSupportHeading] = useState('Still Unsure?');
  const [supportBody, setSupportBody] = useState("We're here to help you find the perfect fit.");
  const [supportEmail, setSupportEmail] = useState('support@pardah.com');
  
  // Store Locations-specific state
  const [storeLocations, setStoreLocations] = useState<StoreLocationItem[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  
  const [formData, setFormData] = useState<PageContentTranslation>({
    languageCode: 'en',
    title: pageTitle,
    content: '',
    metaTitle: '',
    metaDescription: '',
    updatedAt: Timestamp.now(),
  });

  // Parse FAQ content from HTML
  const parseFAQContent = React.useCallback((htmlContent: string) => {
    if (!htmlContent) {
      setFaqItems([]);
      return;
    }
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const elements = Array.from(doc.body.children);
      const items: FAQItem[] = [];
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const tagName = element.tagName.toLowerCase();
        
        if (tagName.match(/^h[2-6]$/)) {
          const question = element.textContent?.trim() || '';
          let answer = '';
          
          let nextSibling = element.nextElementSibling;
          while (nextSibling && !nextSibling.tagName.match(/^h[1-6]$/)) {
            answer += nextSibling.textContent?.trim() + ' ';
            nextSibling = nextSibling.nextElementSibling;
          }
          
          if (question) {
            items.push({ question, answer: answer.trim() || '' });
          }
        }
      }
      
      setFaqItems(items.length > 0 ? items : [{ question: '', answer: '' }]);
    } catch {
      setFaqItems([{ question: '', answer: '' }]);
    }
  }, []);

  // Convert FAQ items to HTML
  const convertFAQToHTML = React.useCallback((items: FAQItem[]): string => {
    return items
      .filter(item => item.question.trim() && item.answer.trim())
      .map(item => `<h2>${item.question}</h2><p>${item.answer}</p>`)
      .join('');
  }, []);

  // Parse Job content from HTML
  const parseJobContent = React.useCallback((htmlContent: string) => {
    if (!htmlContent) {
      setJobItems([]);
      return;
    }
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const elements = Array.from(doc.body.children);
      const items: JobItem[] = [];
      
      // Look for job listings in the format: <div data-job="true">...</div>
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.tagName.toLowerCase() === 'div' && element.getAttribute('data-job') === 'true') {
          const title = element.querySelector('[data-field="title"]')?.textContent?.trim() || '';
          const department = element.querySelector('[data-field="department"]')?.textContent?.trim() || '';
          const location = element.querySelector('[data-field="location"]')?.textContent?.trim() || '';
          const type = element.querySelector('[data-field="type"]')?.textContent?.trim() || 'Full-time';
          const description = element.querySelector('[data-field="description"]')?.innerHTML || '';
          const requirements = element.querySelector('[data-field="requirements"]')?.innerHTML || '';
          const isActive = element.getAttribute('data-active') !== 'false';
          
          if (title) {
            items.push({ title, department, location, type, description, requirements, isActive });
          }
        }
      }
      
      setJobItems(items.length > 0 ? items : [{ title: '', department: '', location: '', type: 'Full-time', description: '', requirements: '', isActive: true }]);
    } catch {
      // Error parsing job content
      setJobItems([{ title: '', department: '', location: '', type: 'Full-time', description: '', requirements: '', isActive: true }]);
    }
  }, []);

  // Convert Job items to HTML
  const convertJobsToHTML = React.useCallback((items: JobItem[]): string => {
    return items
      .filter(item => item.title.trim())
      .map(item => `
        <div data-job="true" data-active="${item.isActive}">
          <h2 data-field="title">${item.title}</h2>
          <p data-field="department"><strong>Department:</strong> ${item.department}</p>
          <p data-field="location"><strong>Location:</strong> ${item.location}</p>
          <p data-field="type"><strong>Type:</strong> ${item.type}</p>
          <div data-field="description">${item.description}</div>
          <div data-field="requirements"><strong>Requirements:</strong> ${item.requirements}</div>
        </div>
      `)
      .join('');
  }, []);

  // Build Size Guide HTML from structured state
  const buildSizeGuideHTML = React.useCallback(
    (
      rows: SizeGuideRow[],
      measures: MeasureGuideItem[],
      footnote: string,
      sHeading: string,
      sBody: string,
      sEmail: string
    ): string => {
      const tableRows = rows
        .filter(r => r.sizeLabel.trim())
        .map(
          (r, idx) => `
            <tr class="hover:bg-gray-50 transition-colors${idx % 2 === 1 ? ' bg-gray-50/50' : ''}">
              <td class="py-4 px-6 font-medium">${r.sizeLabel}</td>
              <td class="py-4 px-6">${r.length}</td>
              <td class="py-4 px-6">${r.chest}</td>
              <td class="py-4 px-6">${r.sleeve}</td>
              <td class="py-4 px-6 text-gray-500">${r.heightRange}</td>
            </tr>`
        )
        .join('');

      const measureList = measures
        .filter(m => m.label.trim() && m.description.trim())
        .map(
          m => `
            <li class="flex gap-3">
              <span class="font-bold text-black min-w-[60px]">${m.label}:</span>
              <span>${m.description}</span>
            </li>`
        )
        .join('');

      return `
        <div class="bg-white min-h-screen pb-20">
          <div class="bg-gray-50 border-b border-gray-100 py-12 mb-10">
            <div class="page-container text-center">
              <h1 class="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">Size Guide</h1>
              <p class="text-gray-500">Find your perfect fit with our comprehensive measurement chart.</p>
            </div>
          </div>
          <div class="page-container max-w-5xl">
            <div class="grid lg:grid-cols-3 gap-12">
              <div class="lg:col-span-2">
                <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mb-8">
                  <div class="bg-gray-50 border-b border-gray-100 p-4">
                    <h2 class="text-lg font-heading font-bold uppercase tracking-widest text-center text-gray-900">Abaya Size Chart</h2>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead class="bg-gray-50 text-gray-900">
                        <tr>
                          <th class="py-4 px-6 text-left font-bold uppercase text-xs tracking-wider">Size</th>
                          <th class="py-4 px-6 text-left font-bold uppercase text-xs tracking-wider">Length (in)</th>
                          <th class="py-4 px-6 text-left font-bold uppercase text-xs tracking-wider">Chest (in)</th>
                          <th class="py-4 px-6 text-left font-bold uppercase text-xs tracking-wider">Sleeve (in)</th>
                          <th class="py-4 px-6 text-left font-bold uppercase text-xs tracking-wider">Height</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        ${tableRows}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p class="text-xs text-gray-400 italic text-center">
                  ${footnote}
                </p>
              </div>
              <div class="space-y-8">
                <div class="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h3 class="font-bold font-heading text-xl mb-4">How to Measure</h3>
                  <ul class="space-y-4 text-sm text-gray-600">
                    ${measureList}
                  </ul>
                </div>
                <div class="bg-gray-50 border border-gray-100 p-6 rounded-2xl text-center">
                  <h3 class="font-heading font-bold text-xl text-gray-900 mb-2">${sHeading}</h3>
                  <p class="text-gray-600 text-sm mb-4">
                    ${sBody}
                  </p>
                  <a href="mailto:${sEmail}" class="inline-block bg-black text-white px-6 py-2 rounded-lg text-xs font-heading font-bold hover:bg-gray-800 transition-colors">
                    Contact Support
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    []
  );

  // Store Locations management functions
  const loadStoreLocations = React.useCallback(async () => {
    if (slug !== 'store-locator') return;
    setLoadingStores(true);
    try {
      const stores = await getAllStoreLocations(false); // Get all stores, not just active
      setStoreLocations(stores.map(store => ({
        id: store.id,
        name: store.name,
        address: store.address,
        city: store.city,
        state: store.state,
        country: store.country,
        zipCode: store.zipCode || '',
        phone: store.phone || '',
        email: store.email || '',
        latitude: store.latitude,
        longitude: store.longitude,
        description: store.description || '',
        isActive: store.isActive,
      })));
    } catch {
      // Error loading store locations
      alert(t('admin.page_editor_store_locations_load_failed') || 'Failed to load store locations.');
    } finally {
      setLoadingStores(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchSettings = React.useCallback(async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      // Failed to fetch settings
    }
  }, []);

  const loadPageData = React.useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      // loadPageData already in progress, skipping
      return;
    }
    
    // loadPageData called
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const [pageData, allLanguages] = await Promise.all([
        getPageBySlug(slug),
        getAllLanguages(false)
      ]);
    
      
      setLanguages(allLanguages);
      setPage(pageData);
      
      if (pageData) {
        // Ensure translations array exists
        const translations = pageData.translations || [];
        
        // Set default language to current language or first available
        const defaultLang = translations.find(tr => normalizeCode(tr.languageCode) === normalizeCode(currentLanguage?.code)) 
          || translations.find(tr => normalizeCode(tr.languageCode) === 'en')
          || translations[0];
        
        if (defaultLang) {
          // Setting default language
          setSelectedLanguageCode(normalizeCode(defaultLang.languageCode) || defaultLang.languageCode);
          // Ensure content is properly set
          const content = defaultLang.content || '';
          setFormData({
            ...defaultLang,
            content
          });

          // Restore any local draft (so unsaved edits survive refresh)
          const normalizedLang = normalizeCode(defaultLang.languageCode) || defaultLang.languageCode;
          const draft = readDraft(slug, normalizedLang);
          if (draft?.data) {
            const remoteUpdatedAtMs =
              typeof (defaultLang as unknown as { updatedAt?: { toDate?: () => Date } }).updatedAt?.toDate === 'function'
                ? (defaultLang as unknown as { updatedAt?: { toDate?: () => Date } }).updatedAt!.toDate!().getTime()
                : 0;
            if (!remoteUpdatedAtMs || draft.savedAt >= remoteUpdatedAtMs) {
              setFormData(prev => ({
                ...prev,
                ...draft.data,
                languageCode: normalizedLang,
              }));
            }
          }
          
          // Parse FAQ items if this is FAQ page
          if (slug === 'faq') {
            if (content) {
              parseFAQContent(content);
            } else {
              setFaqItems([{ question: '', answer: '' }]);
            }
          }
          
          // Parse Job items if this is careers page
          if (slug === 'careers') {
            if (content) {
              parseJobContent(content);
            } else {
              setJobItems([{ title: '', department: '', location: '', type: 'Full-time', description: '', requirements: '', isActive: true }]);
            }
          }
          
          // Load store locations if this is store-locator page
          if (slug === 'store-locator') {
            loadStoreLocations();
          }
        } else {
          // No translations exist, create default
          setSelectedLanguageCode(normalizeCode(currentLanguage?.code) || 'en');
          setFormData({
            languageCode: normalizeCode(currentLanguage?.code) || 'en',
            title: pageTitle,
            content: '',
            metaTitle: '',
            metaDescription: '',
            updatedAt: Timestamp.now(),
          });
          
          if (slug === 'faq') {
            setFaqItems([{ question: '', answer: '' }]);
          }
          
          if (slug === 'careers') {
            setJobItems([{ title: '', department: '', location: '', type: 'Full-time', description: '', requirements: '', isActive: true }]);
          }
          
          // Load store locations if this is store-locator page
          if (slug === 'store-locator') {
            loadStoreLocations();
          }
        }
      } else {
        // Page doesn't exist, initialize with default language
        const langCode = normalizeCode(currentLanguage?.code) || 'en';
        setSelectedLanguageCode(langCode);
        setFormData({
          languageCode: langCode,
          title: pageTitle,
          content: '',
          metaTitle: '',
          metaDescription: '',
          updatedAt: Timestamp.now(),
        });
        
        if (slug === 'faq') {
          setFaqItems([{ question: '', answer: '' }]);
        }
        
        // Load store locations if this is store-locator page
        if (slug === 'store-locator') {
          loadStoreLocations();
        }
      }
      } catch {
        // Error loading page data
    } finally {
        // loadPageData completed, setting loading to false
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [slug, pageTitle, currentLanguage, parseFAQContent, parseJobContent, loadStoreLocations, normalizeCode]);

  useEffect(() => {
    // Setting isClient to true
    setIsClient(true);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    // Slug changed, loading data
    if (slug) {
      loadPageData();
      if (slug === 'store-locator') {
        loadStoreLocations();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]); // Removed loadPageData from dependencies to prevent infinite loop

  // Get Quill instance after ReactQuill mounts
  useEffect(() => {
    if (loading || !isClient) {
      return;
    }
    
    // Wait for ReactQuill to fully render
      const findQuillInstance = () => {
      // Try to find Quill instance from DOM
        const editor = document.querySelector('.ql-editor') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
        if (editor && editor.__quill) {
          // Quill instance found via .ql-editor
        quillRef.current = editor.__quill;
          setQuillInstance(editor.__quill);
          return true;
        }
        
        const container = document.querySelector('.ql-container') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
        if (container && container.__quill) {
          // Quill instance found via .ql-container
        quillRef.current = container.__quill;
          setQuillInstance(container.__quill);
          return true;
        }
        
        return false;
      };

      // Try immediately
      if (!findQuillInstance()) {
      // If not found, try after a short delay (ReactQuill needs time to mount)
      const timer = setTimeout(() => {
          if (!findQuillInstance()) {
          // One more try after longer delay
          setTimeout(() => {
              findQuillInstance();
          }, 300);
          }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedLanguageCode, loading, isClient]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setSaving(true);
    try {
      let latestContent = formData.content;
      
      // If FAQ page, convert FAQ items to HTML
      if (slug === 'faq') {
        latestContent = convertFAQToHTML(faqItems);
      } else if (slug === 'careers') {
        // If Careers page, convert Job items to HTML
        latestContent = convertJobsToHTML(jobItems);
      } else if (slug === 'size-guide') {
        // Size Guide page: build structured HTML from size/measure state
        latestContent = buildSizeGuideHTML(
          sizeRows,
          measureItems,
          sizeFootnote,
          supportHeading,
          supportBody,
          supportEmail
        );
      } else if (slug === 'store-locator') {
        // Store locator page - content is just a description, stores are managed separately
        // Get latest content directly from Quill editor if it exists
        const editor = document.querySelector('.ql-editor') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
        if (editor && editor.__quill) {
          latestContent = editor.__quill.root.innerHTML;
        }
      } else {
        // Get latest content directly from Quill editor before saving
        const editor = document.querySelector('.ql-editor') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
        if (editor && editor.__quill) {
          latestContent = editor.__quill.root.innerHTML;
        }
      }

      // Prepare data with latest content
      const dataToSave: Omit<PageContentTranslation, 'updatedAt'> = {
        ...formData,
        content: editorMode === 'html' ? decodeHtmlEntities(latestContent) : latestContent,
      };

      const normalizedSelected = normalizeCode(selectedLanguageCode) || selectedLanguageCode;
      const normalizedDataToSave = {
        ...dataToSave,
        languageCode: normalizeCode(dataToSave.languageCode) || normalizedSelected,
      };

      await updatePageTranslation(slug, normalizedSelected, normalizedDataToSave);

      // Clear local draft after successful save
      clearDraft(slug, normalizedSelected);
      
      // Update local state with saved content
      setFormData(prev => ({ ...prev, content: latestContent }));
      
      // Reload page data to get updated translations
      await loadPageData();
      
      setInfoDialogMessage(t('admin.page_editor_save_success') || 'Page translation updated successfully! The changes will be visible on the frontend.');
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Error saving page
      setInfoDialogMessage(t('admin.page_editor_save_failed') || 'Failed to update page. Please check console for details.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = <TField extends keyof PageContentTranslation>(field: TField, value: PageContentTranslation[TField]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Image upload handler for ReactQuill
  // Using useRef to store slug to avoid dependency issues
  const slugRef = React.useRef(slug);
  React.useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  const imageHandler = React.useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(t('admin.page_editor_image_size_error') || 'Image size must be less than 5MB. Please compress the image and try again.');
        return;
      }

      // Show loading state
      const loadingMsg = document.createElement('div');
      loadingMsg.id = 'image-upload-loading';
      loadingMsg.textContent = t('admin.page_editor_image_uploading') || 'Uploading image...';
      loadingMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #000; color: #fff; padding: 12px 20px; border-radius: 4px; z-index: 10000;';
      document.body.appendChild(loadingMsg);

      try {
        // Sanitize filename
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `pages/${slugRef.current}/${Date.now()}_${sanitizedFileName}`;
        
        // Upload to Firebase Storage
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, file);
        
        // Get download URL using the upload result ref
        const url = await getDownloadURL(uploadResult.ref);

        // Get Quill instance - use ref first, then fallback to DOM
        let quill = quillRef.current;
        
        if (!quill) {
          const editor = document.querySelector('.ql-editor') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
          if (editor && editor.__quill) {
            quill = editor.__quill;
            // Update ref for next time
            quillRef.current = quill;
          }
        }
        
        if (!quill) {
          // Wait a bit and try again
          await new Promise(resolve => setTimeout(resolve, 300));
          quill = quillRef.current;
          if (!quill) {
          const editor = document.querySelector('.ql-editor') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
          if (editor && editor.__quill) {
            quill = editor.__quill;
              quillRef.current = quill;
            }
          }
        }
        
        if (!quill) {
          throw new Error('Quill editor not found. Please make sure the editor is loaded and try again.');
        }

        // Insert image into editor
        const quillInstance = quill as unknown as { getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number };
        const range = quillInstance.getSelection(true);
        if (range && range.index !== null) {
          quillInstance.insertEmbed(range.index, 'image', url);
          quillInstance.setSelection(range.index + 1);
        } else {
          // If no selection, insert at the end
          const length = quillInstance.getLength();
          quillInstance.insertEmbed(length - 1, 'image', url);
          quillInstance.setSelection(length, 0);
        }

        // Don't update formData immediately - let ReactQuill's onChange handle it
        // This prevents the editor from disappearing
        // The onChange handler will update formData when user types or makes changes

        // Remove loading message
        const loadingElement = document.getElementById('image-upload-loading');
        if (loadingElement) {
          loadingElement.textContent = t('admin.page_editor_image_upload_success') || 'Image uploaded successfully!';
          loadingElement.style.background = '#10b981';
          setTimeout(() => {
            if (loadingElement.parentNode) {
              loadingElement.parentNode.removeChild(loadingElement);
            }
          }, 2000);
        }
      } catch (error: unknown) {
        // Error uploading image
        
        // Remove loading message
        const loadingElement = document.getElementById('image-upload-loading');
        if (loadingElement) {
          loadingElement.parentNode?.removeChild(loadingElement);
        }

        // Show detailed error message
        let errorMessage = t('admin.page_editor_image_upload_failed') || 'Failed to upload image. ';
        const errorObj = error as { code?: string; message?: string };
        if (errorObj.code === 'storage/unauthorized') {
          errorMessage += t('admin.page_editor_image_upload_unauthorized') || 'You are not authorized to upload images. Please make sure you are logged in as an admin.';
        } else if (errorObj.code === 'storage/canceled') {
          errorMessage += t('admin.page_editor_image_upload_canceled') || 'Upload was canceled.';
        } else if (errorObj.code === 'storage/unknown') {
          errorMessage += t('admin.page_editor_image_upload_unknown') || 'An unknown error occurred. Please check your internet connection and try again.';
        } else if (errorObj.message) {
          errorMessage += errorObj.message;
        } else {
          errorMessage += t('admin.page_editor_image_upload_try_again') || 'Please try again.';
        }
        
        alert(errorMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependencies - using refs instead

  // Memoize the modules and formats to prevent re-renders
  // imageHandler is stable (empty deps), so modules won't recreate unnecessarily
  const quillModules = React.useMemo(() => ({
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
        [{ 'color': [] }, { 'background': [] }],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
  }), [imageHandler]);
  
  const quillFormats = React.useMemo(() => [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'script',
    'align',
    'link', 'image', 'video',
    'color', 'background',
    'clean'
  ], []);

  const handleLanguageChange = (languageCode: string) => {
    const normalized = normalizeCode(languageCode) || languageCode;
    setSelectedLanguageCode(normalized);
    
    // Load translation for selected language
    if (page) {
      const translations = page.translations || [];
      const translation = translations.find(tr => normalizeCode(tr.languageCode) === normalized);
      if (translation) {
        setFormData({
          ...translation,
          languageCode: normalized,
          content: translation.content || ''
        });
        
        // Parse FAQ items if this is FAQ page
        if (slug === 'faq' && translation.content) {
          parseFAQContent(translation.content);
        } else if (slug === 'faq') {
          setFaqItems([{ question: '', answer: '' }]);
        }
      } else {
        // Create new translation for this language
        setFormData({
          languageCode: normalized,
          title: pageTitle,
          content: '',
          metaTitle: '',
          metaDescription: '',
          updatedAt: Timestamp.now(),
        });
        
        if (slug === 'faq') {
          setFaqItems([{ question: '', answer: '' }]);
        }
      }
    }

    // Restore draft for selected language (if exists)
    const draft = readDraft(slug, normalized);
    if (draft?.data) {
      setFormData(prev => ({
        ...prev,
        ...draft.data,
        languageCode: normalized,
      }));
    }
  };

  const editorModeLabel =
    editorMode === 'html'
      ? tt('admin.page_editor_mode_html', currentLanguage?.isRTL ? 'وضع HTML' : 'HTML Mode')
      : tt('admin.page_editor_mode_visual', currentLanguage?.isRTL ? 'الوضع المرئي' : 'Visual Mode');

  // Auto-save draft locally (so refresh won't lose edits)
  useEffect(() => {
    const code = normalizeCode(selectedLanguageCode) || selectedLanguageCode || 'en';
    const payload = {
      languageCode: code,
      title: formData.title || '',
      content: formData.content || '',
      metaTitle: formData.metaTitle || '',
      metaDescription: formData.metaDescription || '',
    };

    const timer = setTimeout(() => {
      // Only save draft if there's anything typed
      const hasAny =
        Boolean(payload.title.trim()) ||
        Boolean(payload.content.trim()) ||
        Boolean(payload.metaTitle.trim()) ||
        Boolean(payload.metaDescription.trim());
      if (hasAny) {
        writeDraft(slug, code, payload);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.title, formData.content, formData.metaTitle, formData.metaDescription, selectedLanguageCode, slug, normalizeCode, writeDraft]);

  // FAQ management functions
  const addFAQItem = () => {
    setFaqItems([...faqItems, { question: '', answer: '' }]);
  };

  const removeFAQItem = (index: number) => {
    setFaqItems(faqItems.filter((_, i) => i !== index));
  };

  const updateFAQItem = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...faqItems];
    updated[index] = { ...updated[index], [field]: value };
    setFaqItems(updated);
  };

  // Job management functions
  const addJobItem = () => {
    setJobItems([...jobItems, { title: '', department: '', location: '', type: 'Full-time', description: '', requirements: '', isActive: true }]);
  };

  const removeJobItem = (index: number) => {
    setJobItems(jobItems.filter((_, i) => i !== index));
  };

  const updateJobItem = (index: number, field: keyof JobItem, value: string | boolean) => {
    const updated = [...jobItems];
    updated[index] = { ...updated[index], [field]: value };
    setJobItems(updated);
  };

  const addStoreLocation = () => {
    setStoreLocations([...storeLocations, {
      name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      phone: '',
      email: '',
      latitude: 0,
      longitude: 0,
      description: '',
      isActive: true,
    }]);
  };

  const removeStoreLocation = async (index: number) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    const store = storeLocations[index];
    if (store.id) {
      if (!confirm(t('admin.page_editor_store_delete_confirm') || 'Are you sure you want to delete this store location?')) return;
      try {
        await deleteStoreLocation(store.id);
        setStoreLocations(storeLocations.filter((_, i) => i !== index));
        setInfoDialogMessage(t('admin.page_editor_store_delete_success') || 'Store location deleted successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Error deleting store location
        setInfoDialogMessage(t('admin.page_editor_store_delete_failed') || 'Failed to delete store location.');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    } else {
      setStoreLocations(storeLocations.filter((_, i) => i !== index));
    }
  };

  const updateStoreLocationItem = (index: number, field: keyof StoreLocationItem, value: string | number | boolean) => {
    const updated = [...storeLocations];
    updated[index] = { ...updated[index], [field]: value };
    setStoreLocations(updated);
  };

  const saveStoreLocation = async (index: number) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    const store = storeLocations[index];
    if (!store.name || !store.address || !store.city || !store.state) {
      setInfoDialogMessage(t('admin.page_editor_store_required_fields') || 'Please fill in all required fields (Name, Address, City, State).');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    if (store.latitude === 0 && store.longitude === 0) {
      setInfoDialogMessage(t('admin.page_editor_store_coordinates_required') || 'Please set the location coordinates (Latitude and Longitude).');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }

    try {
      // Build store data object, filtering out undefined values
      const storeData: Record<string, unknown> = {
        name: store.name,
        address: store.address,
        city: store.city,
        state: store.state,
        country: store.country,
        latitude: store.latitude,
        longitude: store.longitude,
        isActive: store.isActive,
      };

      // Only include optional fields if they have values
      if (store.zipCode) storeData.zipCode = store.zipCode;
      if (store.phone) storeData.phone = store.phone;
      if (store.email) storeData.email = store.email;
      if (store.description) storeData.description = store.description;
      // openingHours is optional, don't include if not set

      if (store.id) {
        await updateStoreLocation(store.id, storeData);
        setInfoDialogMessage(t('admin.page_editor_store_update_success') || 'Store location updated successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
        // Reload stores to get updated data
        loadStoreLocations();
      } else {
        const newId = await createStoreLocation(storeData as Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'>);
        const updated = [...storeLocations];
        updated[index] = { ...store, id: newId };
        setStoreLocations(updated);
        setInfoDialogMessage(t('admin.page_editor_store_create_success') || 'Store location created successfully!');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      }
    } catch (error: unknown) {
    // Error saving store location
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setInfoDialogMessage(t('admin.page_editor_store_save_failed', { error: errorMessage }) || `Failed to save store location: ${errorMessage}`);
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  if (!PAGE_SLUGS[slug as keyof typeof PAGE_SLUGS]) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {t('admin.page_editor_not_found') || 'Page not found or invalid slug.'}
        </div>
      </div>
    );
  }

  if (loading) {
    // Showing loading state
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {tt('common.loading', currentLanguage?.isRTL ? 'جاري التحميل...' : 'Loading...')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{localizedPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tt(
              'admin.page_editor_subtitle',
              currentLanguage?.isRTL
                ? `إدارة المحتوى متعدد اللغات وتحسين محركات البحث لصفحة ${localizedPageTitle}`
                : `Manage multi-language content and SEO for ${localizedPageTitle}`,
            ).replace('{{page}}', localizedPageTitle)}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <a 
            href={`/${slug}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('admin.page_editor_view_live') || 'View Live'}
          </a>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`px-4 sm:px-6 py-2 bg-black text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {saving ? (t('admin.page_editor_saving') || 'Saving...') : (t('admin.page_editor_save_changes') || 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <div className="mb-6 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-bold text-gray-700 mb-2">{t('admin.page_editor_select_language') || 'Select Language'}</label>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => {
            const langCode = normalizeCode(lang.code) || lang.code;
            const isSelected = (normalizeCode(selectedLanguageCode) || selectedLanguageCode) === langCode;
            const hasTranslation = page?.translations.some(tr => (normalizeCode(tr.languageCode) || tr.languageCode) === langCode);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageChange(lang.code)}
                title={isSelected ? (t('admin.selected') || 'Selected') : ''}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-black text-white ring-2 ring-black ring-offset-2 shadow-sm'
                    : hasTranslation
                    ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/15' : 'bg-white border border-gray-200'}`}>
                  {langCode.toUpperCase()}
                </span>
                {lang.name} {lang.nativeName && `(${lang.nativeName})`}
                {!hasTranslation && <span className="text-xs opacity-80">{t('admin.page_editor_new') || 'New'}</span>}
                {isSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-4 w-4 ms-1" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Editor, FAQ Form, or Careers Form */}
        <div className="lg:col-span-2 space-y-6">
          {slug === 'faq' ? (
            // FAQ Form Interface
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">{t('admin.page_editor_faq_title') || 'FAQ Questions & Answers'}</label>
                <button
                  type="button"
                  onClick={addFAQItem}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  + {t('admin.page_editor_faq_add') || 'Add FAQ'}
                </button>
              </div>
              
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{t('admin.page_editor_faq_number', { number: (index + 1).toString() }) || `FAQ #${index + 1}`}</span>
                      {faqItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFAQItem(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          {t('admin.page_editor_remove') || 'Remove'}
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_faq_question') || 'Question'} *</label>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) => updateFAQItem(index, 'question', e.target.value)}
                          placeholder={t('admin.page_editor_faq_question_placeholder') || 'Enter your question...'}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_faq_answer') || 'Answer'} *</label>
                        <textarea
                          value={item.answer}
                          onChange={(e) => updateFAQItem(index, 'answer', e.target.value)}
                          placeholder={t('admin.page_editor_faq_answer_placeholder') || 'Enter your answer...'}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {faqItems.length === 0 && (
                  <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="text-gray-500 mb-4">{t('admin.page_editor_faq_empty') || 'No FAQ items yet. Click "Add FAQ" to get started.'}</p>
                    <button
                      type="button"
                      onClick={addFAQItem}
                      className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      {t('admin.page_editor_faq_add_first') || 'Add First FAQ'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : slug === 'careers' ? (
            // Careers Form Interface
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">{t('admin.page_editor_jobs_title') || 'Job Listings'}</label>
                <button
                  type="button"
                  onClick={addJobItem}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  + {t('admin.page_editor_jobs_add') || 'Add Job'}
                </button>
              </div>
              
              <div className="space-y-4">
                {jobItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{t('admin.page_editor_jobs_number', { number: (index + 1).toString() }) || `Job #${index + 1}`}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.isActive}
                            onChange={(e) => updateJobItem(index, 'isActive', e.target.checked)}
                            className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                          />
                          <span className="text-gray-700">{t('admin.status_active') || 'Active'}</span>
                        </label>
                        {jobItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeJobItem(index)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            {t('admin.page_editor_remove') || 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_jobs_title_label') || 'Job Title'} *</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateJobItem(index, 'title', e.target.value)}
                          placeholder={t('admin.page_editor_jobs_title_placeholder') || 'e.g., Senior Frontend Developer'}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_jobs_department') || 'Department'} *</label>
                          <input
                            type="text"
                            value={item.department}
                            onChange={(e) => updateJobItem(index, 'department', e.target.value)}
                            placeholder={t('admin.page_editor_jobs_department_placeholder') || 'e.g., Engineering, Marketing'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_jobs_location') || 'Location'} *</label>
                          <input
                            type="text"
                            value={item.location}
                            onChange={(e) => updateJobItem(index, 'location', e.target.value)}
                            placeholder={t('admin.page_editor_jobs_location_placeholder') || 'e.g., Lahore, Remote'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_jobs_type') || 'Job Type'} *</label>
                        <select
                          value={item.type}
                          onChange={(e) => updateJobItem(index, 'type', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        >
                          <option value="Full-time">{t('admin.page_editor_jobs_type_fulltime') || 'Full-time'}</option>
                          <option value="Part-time">{t('admin.page_editor_jobs_type_parttime') || 'Part-time'}</option>
                          <option value="Contract">{t('admin.page_editor_jobs_type_contract') || 'Contract'}</option>
                          <option value="Internship">{t('admin.page_editor_jobs_type_internship') || 'Internship'}</option>
                          <option value="Freelance">{t('admin.page_editor_jobs_type_freelance') || 'Freelance'}</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_jobs_description') || 'Job Description'} *</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateJobItem(index, 'description', e.target.value)}
                          placeholder={t('admin.page_editor_jobs_description_placeholder') || "Describe the role, responsibilities, and what you're looking for..."}
                          rows={5}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_jobs_requirements') || 'Requirements'} *</label>
                        <textarea
                          value={item.requirements}
                          onChange={(e) => updateJobItem(index, 'requirements', e.target.value)}
                          placeholder={t('admin.page_editor_jobs_requirements_placeholder') || 'List the required skills, experience, and qualifications...'}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {jobItems.length === 0 && (
                  <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="text-gray-500 mb-4">{t('admin.page_editor_jobs_empty') || 'No job listings yet. Click "Add Job" to get started.'}</p>
                    <button
                      type="button"
                      onClick={addJobItem}
                      className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      {t('admin.page_editor_jobs_add_first') || 'Add First Job'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : slug === 'store-locator' ? (
            // Store Locations Form Interface
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">{t('admin.page_editor_stores_title') || 'Store Locations'}</label>
                <button
                  type="button"
                  onClick={addStoreLocation}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  + {t('admin.page_editor_stores_add') || 'Add Store'}
                </button>
              </div>
              
              {loadingStores ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">{t('admin.page_editor_stores_loading') || 'Loading store locations...'}</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {storeLocations.map((store, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase">
                          {t('admin.page_editor_stores_number', { number: (index + 1).toString() }) || `Store #${index + 1}`} {store.id && <span className="text-green-600">({t('admin.page_editor_stores_saved') || 'Saved'})</span>}
                        </span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={store.isActive}
                              onChange={(e) => updateStoreLocationItem(index, 'isActive', e.target.checked)}
                              className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                            />
                            <span className="text-gray-700">{t('admin.status_active') || 'Active'}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => saveStoreLocation(index)}
                            className="px-4 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                          >
                            {store.id ? (t('admin.page_editor_stores_update') || 'Update') : (t('admin.page_editor_stores_save') || 'Save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStoreLocation(index)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            {t('admin.page_editor_remove') || 'Remove'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_name') || 'Store Name'} *</label>
                          <input
                            type="text"
                            value={store.name}
                            onChange={(e) => updateStoreLocationItem(index, 'name', e.target.value)}
                            placeholder={t('admin.page_editor_stores_name_placeholder') || 'e.g., Main Store, Branch 1'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_address') || 'Address'} *</label>
                          <input
                            type="text"
                            value={store.address}
                            onChange={(e) => updateStoreLocationItem(index, 'address', e.target.value)}
                            placeholder={t('admin.page_editor_stores_address_placeholder') || 'Street address'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_city') || 'City'} *</label>
                            <input
                              type="text"
                              value={store.city}
                              onChange={(e) => updateStoreLocationItem(index, 'city', e.target.value)}
                              placeholder={t('admin.page_editor_stores_city_placeholder') || 'City'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_state') || 'State/Province'} *</label>
                            <input
                              type="text"
                              value={store.state}
                              onChange={(e) => updateStoreLocationItem(index, 'state', e.target.value)}
                              placeholder={t('admin.page_editor_stores_state_placeholder') || 'State'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_country') || 'Country'} *</label>
                            <input
                              type="text"
                              value={store.country}
                              onChange={(e) => updateStoreLocationItem(index, 'country', e.target.value)}
                              placeholder={t('admin.page_editor_stores_country_placeholder') || 'Country'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_zipcode') || 'Zip Code'}</label>
                            <input
                              type="text"
                              value={store.zipCode}
                              onChange={(e) => updateStoreLocationItem(index, 'zipCode', e.target.value)}
                              placeholder={t('admin.page_editor_stores_zipcode_placeholder') || 'Zip Code'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_phone') || 'Phone'}</label>
                            <input
                              type="text"
                              value={store.phone}
                              onChange={(e) => updateStoreLocationItem(index, 'phone', e.target.value)}
                              placeholder={t('admin.page_editor_stores_phone_placeholder') || 'Phone number'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_email') || 'Email'}</label>
                            <input
                              type="email"
                              value={store.email}
                              onChange={(e) => updateStoreLocationItem(index, 'email', e.target.value)}
                              placeholder={t('admin.page_editor_stores_email_placeholder') || 'Email address'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_latitude') || 'Latitude'} *</label>
                            <input
                              type="number"
                              step="any"
                              value={store.latitude}
                              onChange={(e) => updateStoreLocationItem(index, 'latitude', parseFloat(e.target.value) || 0)}
                              placeholder={t('admin.page_editor_stores_latitude_placeholder') || 'e.g., 31.5204'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_longitude') || 'Longitude'} *</label>
                            <input
                              type="number"
                              step="any"
                              value={store.longitude}
                              onChange={(e) => updateStoreLocationItem(index, 'longitude', parseFloat(e.target.value) || 0)}
                              placeholder={t('admin.page_editor_stores_longitude_placeholder') || 'e.g., 74.3587'}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.page_editor_stores_description') || 'Description'}</label>
                          <textarea
                            value={store.description}
                            onChange={(e) => updateStoreLocationItem(index, 'description', e.target.value)}
                            placeholder={t('admin.page_editor_stores_description_placeholder') || 'Store description, special features, etc.'}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {storeLocations.length === 0 && (
                    <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-gray-500 mb-4">{t('admin.page_editor_stores_empty') || 'No store locations yet. Click "Add Store" to get started.'}</p>
                      <button
                        type="button"
                        onClick={addStoreLocation}
                        className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        {t('admin.page_editor_stores_add_first') || 'Add First Store'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : slug === 'size-guide' ? (
            // Size Guide structured editor
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">{t('admin.page_editor_size_chart_title') || 'Abaya Size Chart'}</h2>
                <p className="text-sm text-gray-500">
                  {t('admin.page_editor_size_chart_subtitle') || 'Manage size rows for your abaya size chart. These map to the table on the Size Guide page.'}
                </p>
              </div>
              <div className="space-y-4">
                {sizeRows.map((row, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase">
                        {t('admin.page_editor_size_chart_row', { number: (index + 1).toString() }) || `Row #${index + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSizeRows(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-600 hover:text-red-700 text-xs font-medium"
                        disabled={sizeRows.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('admin.page_editor_size_chart_size') || 'Size'}</label>
                        <input
                          type="text"
                          value={row.sizeLabel}
                          onChange={(e) => {
                            const updated = [...sizeRows];
                            updated[index] = { ...updated[index], sizeLabel: e.target.value };
                            setSizeRows(updated);
                          }}
                          placeholder="50 (XS)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('admin.page_editor_size_chart_length') || 'Length (in)'}</label>
                        <input
                          type="text"
                          value={row.length}
                          onChange={(e) => {
                            const updated = [...sizeRows];
                            updated[index] = { ...updated[index], length: e.target.value };
                            setSizeRows(updated);
                          }}
                          placeholder='50"'
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('admin.page_editor_size_chart_chest') || 'Chest (in)'}</label>
                        <input
                          type="text"
                          value={row.chest}
                          onChange={(e) => {
                            const updated = [...sizeRows];
                            updated[index] = { ...updated[index], chest: e.target.value };
                            setSizeRows(updated);
                          }}
                          placeholder='20"'
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('admin.page_editor_size_chart_sleeve') || 'Sleeve (in)'}</label>
                        <input
                          type="text"
                          value={row.sleeve}
                          onChange={(e) => {
                            const updated = [...sizeRows];
                            updated[index] = { ...updated[index], sleeve: e.target.value };
                            setSizeRows(updated);
                          }}
                          placeholder='26"'
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('admin.page_editor_size_chart_height') || 'Height Range'}</label>
                        <input
                          type="text"
                          value={row.heightRange}
                          onChange={(e) => {
                            const updated = [...sizeRows];
                            updated[index] = { ...updated[index], heightRange: e.target.value };
                            setSizeRows(updated);
                          }}
                          placeholder={`4'10" - 5'0"`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSizeRows(prev => [
                      ...prev,
                      { sizeLabel: '', length: '', chest: '', sleeve: '', heightRange: '' },
                    ])
                  }
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  + {t('admin.page_editor_size_chart_add_row') || 'Add Size Row'}
                </button>
              </div>

              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t('admin.page_editor_size_chart_footnote') || 'Size Chart Footnote'}
                  </label>
                  <input
                    type="text"
                    value={sizeFootnote}
                    onChange={(e) => setSizeFootnote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">{t('admin.page_editor_size_chart_measure_title') || 'How to Measure'}</h3>
                  </div>
                  <div className="space-y-3">
                    {measureItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => {
                            const updated = [...measureItems];
                            updated[index] = { ...updated[index], label: e.target.value };
                            setMeasureItems(updated);
                          }}
                          placeholder={t('admin.page_editor_size_chart_measure_length') || 'Length'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        />
                        <textarea
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...measureItems];
                            updated[index] = { ...updated[index], description: e.target.value };
                            setMeasureItems(updated);
                          }}
                          placeholder={t('admin.page_editor_size_chart_measure_description') || 'Description...'}
                          rows={2}
                          className="md:col-span-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">{t('admin.page_editor_size_chart_support_title') || 'Support Block'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {t('admin.page_editor_size_chart_support_heading') || 'Heading'}
                      </label>
                      <input
                        type="text"
                        value={supportHeading}
                        onChange={(e) => setSupportHeading(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {t('admin.page_editor_size_chart_support_body') || 'Body'}
                      </label>
                      <textarea
                        value={supportBody}
                        onChange={(e) => setSupportBody(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {t('admin.page_editor_size_chart_support_email') || 'Support Email'}
                      </label>
                      <input
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Regular Editor for other pages
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between gap-3 mb-3">
                <label className="block text-sm font-bold text-gray-700">{t('admin.page_editor_content_title') || 'Page Content'}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{editorModeLabel}</span>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                    <button
                      type="button"
                      onClick={() => setEditorMode('visual')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        editorMode === 'visual' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {tt('admin.page_editor_mode_visual_button', currentLanguage?.isRTL ? 'مرئي' : 'Visual')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('html')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        editorMode === 'html' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {tt('admin.page_editor_mode_html_button', 'HTML')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative" id="editor-container">
                {(() => {
                  if (!isClient) {
                    return (
                      <div className="w-full h-[400px] border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <div className="text-gray-500">{t('admin.page_editor_initializing') || 'Initializing editor...'}</div>
                      </div>
                    );
                  }

                  if (loading) {
                    return (
                      <div className="w-full h-[400px] border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <div className="text-gray-500">{t('admin.page_editor_loading_data') || 'Loading page data...'}</div>
                      </div>
                    );
                  }

                  if (editorMode === 'html') {
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <textarea
                            value={decodeHtmlEntities(formData.content || '')}
                            onChange={(e) => handleChange('content', e.target.value)}
                            placeholder={
                              tt(
                                'admin.page_editor_html_placeholder',
                                currentLanguage?.isRTL
                                  ? 'اكتب HTML هنا (يمكنك إضافة style inline).'
                                  : 'Write HTML here (you can add inline styles).',
                              )
                            }
                            className="w-full min-h-[400px] font-mono text-sm px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            {tt(
                              'admin.page_editor_html_hint',
                              currentLanguage?.isRTL
                                ? 'ملاحظة: لو رجعت للوضع المرئي، قد يتم تبسيط/تنظيف بعض الـ HTML حسب قيود المحرر. لو محتاج CSS خاص، خليك على وضع HTML.'
                                : 'Note: switching back to Visual may sanitize some HTML. For custom CSS, keep HTML mode.',
                            )}
                          </p>
                        </div>
                        <div>
                          <div className="border border-gray-200 rounded-lg p-4 min-h-[400px] bg-white">
                            <div className="text-xs font-semibold text-gray-500 mb-3">
                              {tt('admin.page_editor_html_preview', currentLanguage?.isRTL ? 'معاينة' : 'Preview')}
                            </div>
                            <div
                              className="quill-content prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(formData.content || '') }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <ReactQuill
                      key={`editor-${selectedLanguageCode}`}
                      theme="snow"
                      value={decodeHtmlEntities(formData.content || '')}
                      onChange={(value: string) => {
                        // Update formData when content changes
                        // This will be called automatically when image is inserted
                        handleChange('content', value);
                      }}
                      placeholder={t('admin.page_editor_content_placeholder') || 'Start writing your content here...'}
                      modules={quillModules}
                      formats={quillFormats}
                      style={{ minHeight: '400px' }}
                      className="bg-white"
                      preserveWhitespace={true}
                    />
                  );
                })()}
                <p className="text-xs text-gray-500 mt-2">
                  {t('admin.page_editor_content_hint') || 'Use the toolbar above to format your content. You can add images, links, videos, and more.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.page_editor_general_settings') || 'General Settings'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.page_editor_page_title', { lang: selectedLanguageCode.toUpperCase() }) || `Page Title (${selectedLanguageCode.toUpperCase()})`}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>

              {page && (
                <div>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={page.isActive}
                      onChange={async (e) => {
                        // Check if demo mode is enabled
                        if (settings.demoMode) {
                          setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
                          setInfoDialogType('error');
                          setShowInfoDialog(true);
                          return;
                        }
                        const updatedPage = { ...page, isActive: e.target.checked };
                        setPage(updatedPage);
                        // Save page active status
                        try {
                          const { createOrUpdatePage } = await import('@/lib/firestore/pages_db');
                          await createOrUpdatePage(updatedPage);
                          setInfoDialogMessage(t('admin.page_editor_page_status_updated') || 'Page status updated successfully!');
                          setInfoDialogType('success');
                          setShowInfoDialog(true);
                        } catch {
                            // Error updating page status
                            setInfoDialogMessage(t('admin.page_editor_page_status_update_failed') || 'Failed to update page status.');
                            setInfoDialogType('error');
                            setShowInfoDialog(true);
                        }
                      }}
                      className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('admin.page_editor_page_active') || 'Page Active'}</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.page_editor_seo_title', { lang: selectedLanguageCode.toUpperCase() }) || `SEO Configuration (${selectedLanguageCode.toUpperCase()})`}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.page_editor_seo_meta_title') || 'Meta Title'}</label>
                <input
                  type="text"
                  value={formData.metaTitle || ''}
                  onChange={(e) => handleChange('metaTitle', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder={formData.title}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.page_editor_seo_meta_description') || 'Meta Description'}</label>
                <textarea
                  value={formData.metaDescription || ''}
                  onChange={(e) => handleChange('metaDescription', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none h-24 resize-none"
                  placeholder={t('admin.page_editor_seo_meta_description_placeholder') || 'Brief description for search engines...'}
                ></textarea>
              </div>
            </div>
          </div>

          {/* Translation Status */}
          {page && page.translations && page.translations.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.page_editor_translations_title') || 'Available Translations'}</h3>
              <div className="space-y-2">
                {page.translations.map((translation) => {
                  const lang = languages.find(l => l.code === translation.languageCode);
                  return (
                    <div key={translation.languageCode} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">
                        {lang?.name || translation.languageCode} {lang?.nativeName && `(${lang.nativeName})`}
                      </span>
                      <span className="text-xs text-gray-500">
                        {translation.updatedAt?.toDate?.() ? new Date(translation.updatedAt.toDate()).toLocaleDateString() : (t('common.not_available') || 'N/A')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default PageEditor;
