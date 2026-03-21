'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getAllCustomerTags, addCustomerTag, updateCustomerTag, deleteCustomerTag } from '@/lib/firestore/customer_management_db';
import { CustomerTag } from '@/lib/firestore/customer_management';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

const CustomerTagsPage = () => {
  const { t } = useLanguage();
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<CustomerTag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#000000',
    description: '',
  });
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const fetchedTags = await getAllCustomerTags();
          setTags(fetchedTags);
        } catch {
          // Error fetching tags
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingTag) {
        await updateCustomerTag(editingTag.id!, formData);
      } else {
        await addCustomerTag(formData);
      }
      const fetchedTags = await getAllCustomerTags();
      setTags(fetchedTags);
      setShowForm(false);
      setEditingTag(null);
      setFormData({ name: '', color: '#000000', description: '' });
    } catch {
      // Error saving tag
      alert(t('admin.customer_tags_save_failed') || 'Failed to save tag.');
    }
  };

  const handleEdit = (tag: CustomerTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color || '#000000',
      description: tag.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.customer_tags_delete_confirm') || 'Are you sure you want to delete this tag?')) return;
    try {
      await deleteCustomerTag(id);
      setTags(tags.filter(t => t.id !== id));
    } catch {
      // Error deleting tag
      alert(t('admin.customer_tags_delete_failed') || 'Failed to delete tag.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold">
            {t('admin.common.loading') || 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('admin.customer_tags_title') || 'Customer Tags'}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.customer_tags_subtitle') || 'Manage customer tags and labels'}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingTag(null);
            setFormData({ name: '', color: '#000000', description: '' });
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('admin.customer_tags_add') || 'Add Tag'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{editingTag ? (t('admin.customer_tags_edit_title') || 'Edit Tag') : (t('admin.customer_tags_add_title_full') || 'Add Tag')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.customer_tags_name_label') || 'Tag Name'} *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.customer_tags_color_label') || 'Color'}</label>
              <div className="flex gap-4 items-center">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.customer_tags_description_label') || 'Description'}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingTag(null);
                  setFormData({ name: '', color: '#000000', description: '' });
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('admin.common.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
              >
                {editingTag ? (t('admin.customer_tags_update_button') || 'Update') : (t('admin.customer_tags_create_button') || 'Create')} {t('admin.customer_tags_add') || 'Tag'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {tags.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">{t('admin.customer_tags_empty_title') || 'No tags found.'}</p>
            <p className="text-sm text-gray-400">{t('admin.customer_tags_empty_message') || 'Get started by creating your first tag'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-6">
            {tags.map((tag) => (
              <div key={tag.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#000000' }}
                    />
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{tag.name}</h3>
                  </div>
                </div>
                {tag.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tag.description}</p>
                )}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    {t('admin.common.edit') || 'Edit'}
                  </button>
                  <button
                    onClick={() => tag.id && handleDelete(tag.id)}
                    className="flex-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-medium hover:bg-red-100 transition-colors"
                  >
                    {t('admin.common.delete') || 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerTagsPage;

