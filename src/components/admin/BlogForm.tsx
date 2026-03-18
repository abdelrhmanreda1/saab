'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { BlogPost } from '@/lib/firestore/blog';
import { addPost, updatePost, getPostById } from '@/lib/firestore/blog_db';
import { getBlogSEO, createOrUpdateBlogSEO } from '@/lib/firestore/seo_db';
import { generateSlug } from '@/lib/utils/slug';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useLanguage } from '@/context/LanguageContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '../ui/Dialog';
import 'react-quill/dist/quill.snow.css';

// Custom CSS for image resize in Quill editor
if (typeof window !== 'undefined') {
  const styleId = 'quill-image-resize-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Make images in Quill editor resizable */
      .ql-editor img {
        max-width: 100%;
        height: auto;
        cursor: pointer;
        display: inline-block;
        position: relative;
        min-width: 100px;
        min-height: 100px;
        border: 2px dashed transparent;
        transition: border-color 0.2s;
      }
      .ql-editor img:hover {
        border-color: #4299e1;
      }
      .ql-editor img.resizing {
        border-color: #3182ce;
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }
}

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
        <div className="text-gray-500">Loading editor component...</div>
      </div>
    )
  }
);

interface BlogFormProps {
  postId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const BlogForm: React.FC<BlogFormProps> = ({ postId, onSuccess, onCancel }) => {
  const { t } = useLanguage();
  const isEditMode = !!postId;
  const postIdRef = useRef(postId);
  const quillRef = useRef<{ root: { innerHTML: string }; getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void } | null>(null);
  const reactQuillRef = useRef<{ getEditor: () => { getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number } } | null>(null);
  const [isClient, setIsClient] = useState(false);
  // const [, setQuillReady] = useState(false); // Currently unused but may be needed for future quill initialization tracking

  const [activeTab, setActiveTab] = useState<'en' | 'ar'>('en');
  const [post, setPost] = useState<Partial<BlogPost>>({
    title: '',
    title_ar: '',
    slug: '',
    excerpt: '',
    excerpt_ar: '',
    content: '',
    content_ar: '',
    coverImage: '',
    author: '',
    isPublished: false,
  });
  
  const [seoData, setSeoData] = useState({
    title: '',
    description: '',
    keywords: [] as string[],
    metaImage: '',
    canonicalUrl: '',
    noIndex: false,
    noFollow: false,
  });
  
  const [keywordsInput, setKeywordsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const data = await getSettings();
        if (data) {
          setSettings({ ...defaultSettings, ...data });
        }
      } catch {
        // Failed to fetch settings
      }
    };
    fetchSettingsData();
  }, []);

  useEffect(() => {
    if (isEditMode && postId) {
      postIdRef.current = postId;
      setLoading(true);
      Promise.all([
        getPostById(postId),
        getBlogSEO(postId)
      ]).then(([fetchedPost, fetchedSEO]) => {
        if (fetchedPost) {
          setPost(fetchedPost);
          // If slug exists, assume it was manually edited (or at least don't auto-update)
          if (fetchedPost.slug) {
            setSlugManuallyEdited(true);
          }
        }
        if (fetchedSEO) {
          setSeoData({
            title: fetchedSEO.title || '',
            description: fetchedSEO.description || '',
            keywords: fetchedSEO.keywords || [],
            metaImage: fetchedSEO.metaImage || '',
            canonicalUrl: fetchedSEO.canonicalUrl || '',
            noIndex: fetchedSEO.noIndex || false,
            noFollow: fetchedSEO.noFollow || false,
          });
          setKeywordsInput(fetchedSEO.keywords?.join(', ') || '');
        }
      }).finally(() => setLoading(false));
    }
  }, [postId, isEditMode]);


  // Helper function to get Quill instance
  const getQuillInstance = useCallback((): { getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void } | null => {
    // Try ReactQuill ref first (getEditor method)
    if (reactQuillRef.current) {
      try {
        // ReactQuill exposes getEditor() method
        const reactQuillComponent = reactQuillRef.current as unknown as { getEditor?: () => { getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void } };
        if (reactQuillComponent.getEditor && typeof reactQuillComponent.getEditor === 'function') {
          const editor = reactQuillComponent.getEditor();
          if (editor) {
            quillRef.current = editor as unknown as { root: { innerHTML: string }; getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void };
            return editor;
          }
        }
      } catch {
        // Ignore errors when trying to get editor instance
      }
    }

    // Try cached ref
    if (quillRef.current) {
      return quillRef.current as unknown as { getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void };
    }

    // Try to find via specific container ID
    const editorContainer = document.querySelector('#blog-editor-container');
    if (editorContainer) {
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
        const quill = editor.__quill;
        quillRef.current = quill as unknown as { root: { innerHTML: string }; getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void };
        return quill;
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
        const quill = container.__quill;
        quillRef.current = quill as unknown as { root: { innerHTML: string }; getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void };
        return quill;
      }
    }

    // Fallback: try global query for .ql-editor
    const globalEditor = document.querySelector('.ql-editor') as HTMLElement & { 
      __quill?: { 
        getSelection: (focus?: boolean) => { index: number; length: number } | null; 
        insertEmbed: (index: number, type: string, value: string) => void; 
        setSelection: (index: number, length?: number) => void; 
        getLength: () => number;
        deleteText: (index: number, length: number) => void;
      } 
    } | null;
    
    if (globalEditor?.__quill) {
      const quill = globalEditor.__quill;
      quillRef.current = quill as unknown as { root: { innerHTML: string }; getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void };
      return quill;
    }

    // Last fallback: try .ql-container globally
    const globalContainer = document.querySelector('.ql-container') as HTMLElement & { 
      __quill?: { 
        getSelection: (focus?: boolean) => { index: number; length: number } | null; 
        insertEmbed: (index: number, type: string, value: string) => void; 
        setSelection: (index: number, length?: number) => void; 
        getLength: () => number;
        deleteText: (index: number, length: number) => void;
      } 
    } | null;
    
    if (globalContainer?.__quill) {
      const quill = globalContainer.__quill;
      quillRef.current = quill as unknown as { root: { innerHTML: string }; getSelection: (focus?: boolean) => { index: number; length: number } | null; insertEmbed: (index: number, type: string, value: string) => void; setSelection: (index: number, length?: number) => void; getLength: () => number; deleteText: (index: number, length: number) => void };
      return quill;
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
        alert(t('common.image_size_error') || 'Image size must be less than 5MB. Please compress the image and try again.');
        return;
      }

      // Show loading state
      const loadingMsg = document.createElement('div');
      loadingMsg.id = 'image-upload-loading';
      loadingMsg.textContent = t('admin.blog_uploading_image') || 'Uploading image...';
      loadingMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #000; color: #fff; padding: 12px 20px; border-radius: 4px; z-index: 10000;';
      document.body.appendChild(loadingMsg);

      try {
        // Sanitize filename
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const postIdOrNew = postIdRef.current || 'new';
        const filePath = `blog/${postIdOrNew}/${Date.now()}_${sanitizedFileName}`;
        
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, file);
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
          const editorElement = document.querySelector('#blog-editor-container .ql-editor') as HTMLElement;
          if (editorElement) {
            editorElement.focus();
            await new Promise(resolve => setTimeout(resolve, 300));
            quillInstance = getQuillInstance();
          }
        }
        
        if (!quillInstance) {
          throw new Error(t('admin.blog_quill_not_found') || 'Quill editor not found. Please make sure the editor is loaded and try again.');
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

        // Remove loading message
        const loadingElement = document.getElementById('image-upload-loading');
        if (loadingElement) {
          loadingElement.textContent = t('admin.blog_image_upload_success') || 'Image uploaded successfully!';
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

        let errorMessage = 'Failed to upload image. ';
        const errorObj = error as { code?: string; message?: string };
        if (errorObj.code === 'storage/unauthorized') {
          errorMessage += 'You are not authorized to upload images.';
        } else if (errorObj.code === 'storage/canceled') {
          errorMessage += 'Upload was canceled.';
        } else if (errorObj.code === 'storage/unknown') {
          errorMessage += 'An unknown error occurred.';
        } else if (errorObj.message) {
          errorMessage += errorObj.message;
        } else {
          errorMessage += 'Please try again.';
        }
        
        setInfoDialogMessage(errorMessage);
        setShowInfoDialog(true);
      }
    };
  }, [getQuillInstance, t]);

  // Quill modules configuration
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
        [{ 'color': [] }, { 'background': [] }],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    }
    // Note: Image resize is handled via CSS (see styles above)
    // If you want advanced resize controls, install: npm install quill-image-resize-module-react
    // Then uncomment and configure imageResize module below:
    // imageResize: {
    //   modules: ['Resize', 'DisplaySize', 'Toolbar'],
    //   handleStyles: {
    //     backgroundColor: '#000',
    //     border: '2px solid #fff',
    //     borderRadius: '4px'
    //   }
    // }
  }), [imageHandler]);
  
  const quillFormats = useMemo(() => [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'script',
    'align',
    'link', 'image', 'video',
    'color', 'background',
    'clean'
  ], []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setLoading(true);
    try {
      // Get latest content from Quill editor
      let latestContent = post.content;
      if (isClient) {
        const editor = document.querySelector('.ql-editor') as HTMLElement & { __quill?: { root: { innerHTML: string } } } | null;
        if (editor && editor.__quill) {
          latestContent = editor.__quill.root.innerHTML;
        }
      }

      // Upload cover image if file is selected
      let coverImageUrl = post.coverImage;
      if (coverImageFile) {
        const storageRef = ref(storage, `blog/cover-images/${Date.now()}_${coverImageFile.name}`);
        const uploadResult = await uploadBytes(storageRef, coverImageFile);
        coverImageUrl = await getDownloadURL(uploadResult.ref);
      }

      const postData = {
        ...post,
        content: latestContent,
        coverImage: coverImageUrl,
        publishedAt: post.isPublished && !post.publishedAt ? Timestamp.now() : post.publishedAt
      };

      let savedPostId = postId;
      if (isEditMode && postId) {
        await updatePost(postId, postData);
        savedPostId = postId;
      } else {
        const newPostRef = await addPost(postData as Omit<BlogPost, 'id'>);
        savedPostId = newPostRef.id;
      }

      // Save SEO data
      if (savedPostId) {
        const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k.length > 0);
        await createOrUpdateBlogSEO({
          blogPostId: savedPostId,
          title: seoData.title || undefined,
          description: seoData.description || undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          metaImage: seoData.metaImage || undefined,
          canonicalUrl: seoData.canonicalUrl || undefined,
          noIndex: seoData.noIndex,
          noFollow: seoData.noFollow,
        });
      }

      setInfoDialogMessage(isEditMode ? (t('admin.posts_update_success') || 'Post updated successfully!') : (t('admin.posts_create_success') || 'Post created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save post
      setInfoDialogMessage(t('admin.posts_save_failed') || 'Failed to save post.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setPost(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      // Auto-generate slug in real-time when title changes (only if slug wasn't manually edited)
      if (name === 'title' && value && !slugManuallyEdited) {
        updated.slug = generateSlug(value);
      }
      
      // Track if slug is manually edited
      if (name === 'slug') {
        setSlugManuallyEdited(true);
      }
      
      return updated;
    });
  };

  const handleSEOChange = (field: string, value: string | boolean | string[]) => {
    setSeoData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading && isEditMode) {
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-gray-900">
          {isEditMode
            ? `${t('common.edit') || 'Edit'} ${t('admin.blog_post') || 'Post'}`
            : `${t('common.add') || 'Add'} ${t('admin.blog_post') || 'Post'}`}
        </h2>

        {/* Language Tab Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('en')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'en'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🇬🇧 English
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'ar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🇸🇦 العربية
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title + Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                {activeTab === 'ar' ? 'العنوان (عربي)' : (t('admin.blog_title_label') || 'Title')}
              </label>
              <input
                type="text"
                name={activeTab === 'ar' ? 'title_ar' : 'title'}
                value={activeTab === 'ar' ? (post.title_ar || '') : post.title}
                onChange={handleChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all ${activeTab === 'ar' ? 'text-right' : ''}`}
                dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                required={activeTab === 'en'}
                placeholder={activeTab === 'ar' ? 'أدخل العنوان بالعربي' : 'Enter title in English'}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.blog_slug_label') || 'Slug'}</label>
              <input
                type="text"
                name="slug"
                value={post.slug}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.blog_author_label') || 'Author'}</label>
            <input
              type="text"
              name="author"
              value={post.author}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
              required
            />
          </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">{t('admin.blog_cover_image_label') || 'Cover Image'}</label>
          
          <div className="flex flex-col gap-4">
            {(coverImagePreview || post.coverImage) && (
              <div className="relative w-full max-w-md h-48 sm:h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                <Image 
                  src={coverImagePreview || post.coverImage || '/placeholder.png'} 
                  alt={t('admin.blog_cover_image_preview_alt') || 'Cover Image Preview'}  
                  fill
                  className="object-cover"
                />
              </div>
            )}
            
            <div className="flex items-center justify-center w-full">
              <label htmlFor="dropzone-file-cover" className="flex flex-col items-center justify-center w-full h-28 sm:h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-4 sm:pb-6 px-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                  </svg>
                  <p className="mb-1 sm:mb-2 text-xs sm:text-sm text-gray-500 text-center">
                    <span className="font-semibold">{t('admin.upload_click_to_upload') || 'Click to upload'}</span> {t('admin.upload_or_drag_drop') || 'or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500 text-center">{t('admin.blog_cover_upload_types_hint') || 'SVG, PNG, JPG or GIF (MAX. 1920x1080px)'}</p>
                </div>
                <input id="dropzone-file-cover" type="file" className="hidden" accept="image/*" onChange={handleCoverImageChange} />
              </label>
            </div>
            
            <div className="text-xs text-gray-400">
              <p className="mb-1">{t('admin.upload_or_enter_url_manually') || 'Or enter URL manually:'}</p>
              <input
                type="text"
                name="coverImage"
                value={post.coverImage}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                placeholder={t('admin.upload_url_placeholder') || 'https://example.com/image.jpg'}
                onFocus={() => {
                  // Clear file selection when URL input is focused
                  setCoverImageFile(null);
                  setCoverImagePreview(null);
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            {activeTab === 'ar' ? 'المقتطف (عربي)' : (t('admin.blog_excerpt_label') || 'Excerpt')}
          </label>
          <textarea
            name={activeTab === 'ar' ? 'excerpt_ar' : 'excerpt'}
            value={activeTab === 'ar' ? (post.excerpt_ar || '') : post.excerpt}
            onChange={handleChange}
            rows={3}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all ${activeTab === 'ar' ? 'text-right' : ''}`}
            dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
            placeholder={activeTab === 'ar' ? 'ملخص قصير للمقال...' : (t('admin.blog_excerpt_placeholder') || 'Brief summary of the post...')}
            required={activeTab === 'en'}
          />
        </div>

        {/* Quill Editor for Content */}
        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            {activeTab === 'ar' ? 'المحتوى (عربي)' : (t('admin.blog_content_label') || 'Content')}
          </label>
          <div className="relative" id="blog-editor-container">
            {!isClient ? (
              <div className="w-full h-[300px] sm:h-[400px] border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                <div className="text-gray-500 text-sm">{t('admin.products_editor_initializing') || 'Initializing editor...'}</div>
              </div>
            ) : (
              <div className={`bg-white rounded-lg border border-gray-300 overflow-hidden ${activeTab === 'ar' ? 'quill-rtl' : ''}`}>
                <ReactQuill
                  key={activeTab}
                  theme="snow"
                  value={activeTab === 'ar' ? (post.content_ar || '') : (post.content || '')}
                  onChange={(value: string) => {
                    if (activeTab === 'ar') {
                      setPost(prev => ({ ...prev, content_ar: value }));
                    } else {
                      setPost(prev => ({ ...prev, content: value }));
                    }
                  }}
                  placeholder={activeTab === 'ar' ? 'ابدأ كتابة المقال هنا...' : (t('admin.blog_content_placeholder') || 'Start writing your blog post here...')}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ minHeight: '300px', direction: activeTab === 'ar' ? 'rtl' : 'ltr', textAlign: activeTab === 'ar' ? 'right' : 'left' }}
                  className="bg-white"
                  preserveWhitespace={true}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('admin.products_description_help') || 'Use the toolbar above to format your content. You can add images, links, videos, and more.'}
          </p>
        </div>

        {/* SEO Configuration */}
        <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{t('admin.products_seo_configuration') || 'SEO Configuration'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_title') || 'Meta Title'}</label>
              <input
                type="text"
                value={seoData.title}
                onChange={(e) => handleSEOChange('title', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={post.title || (t('admin.blog_seo_meta_title_placeholder') || 'Blog post title')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_description') || 'Meta Description'}</label>
              <textarea
                value={seoData.description}
                onChange={(e) => handleSEOChange('description', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none h-24 resize-none"
                placeholder={t('admin.products_seo_meta_description_placeholder') || 'Brief description for search engines...'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_keywords_label') || 'Keywords (comma-separated)'}</label>
              <input
                type="text"
                value={keywordsInput}
                onChange={(e) => {
                  setKeywordsInput(e.target.value);
                  const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k.length > 0);
                  handleSEOChange('keywords', keywords);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.blog_seo_keywords_placeholder') || 'fashion, style, abaya, modest wear'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_meta_image_url') || 'Meta Image URL'}</label>
              <input
                type="text"
                value={seoData.metaImage}
                onChange={(e) => handleSEOChange('metaImage', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.blog_seo_meta_image_placeholder') || 'https://example.com/og-image.jpg'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.products_seo_canonical_url') || 'Canonical URL'}</label>
              <input
                type="text"
                value={seoData.canonicalUrl}
                onChange={(e) => handleSEOChange('canonicalUrl', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder={t('admin.blog_seo_canonical_placeholder') || 'https://example.com/blog/post-slug'}
              />
            </div>

            <div className="flex flex-wrap gap-4 sm:gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seoData.noIndex}
                  onChange={(e) => handleSEOChange('noIndex', e.target.checked)}
                  className="w-4 h-4 border-gray-300 rounded focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">{t('admin.seo_no_index') || 'No Index'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seoData.noFollow}
                  onChange={(e) => handleSEOChange('noFollow', e.target.checked)}
                  className="w-4 h-4 border-gray-300 rounded focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">{t('admin.seo_no_follow') || 'No Follow'}</span>
              </label>
            </div>
          </div>
        </div>

        <div>
           <label className="inline-flex items-center cursor-pointer">
             <input
                type="checkbox"
                name="isPublished"
                checked={post.isPublished}
                onChange={handleChange}
                className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
             />
             <span className="ml-2 text-sm sm:text-base text-gray-700 font-medium">{t('admin.blog_published_label') || 'Published'}</span>
           </label>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 sm:gap-4 pt-6 border-t border-gray-200">
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
              (t('admin.blog_save_button') || 'Save Post')
            )}
          </button>
        </div>
      </form>
      </div>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => {
          setShowInfoDialog(false);
          if (infoDialogType === 'success') {
            onSuccess();
          }
        }}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />
    </div>
  );
};

export default BlogForm;
