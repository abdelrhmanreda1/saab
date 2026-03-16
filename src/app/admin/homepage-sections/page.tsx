'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultHomepageSections,
  HomepageSection,
} from '@/lib/firestore/homepage_sections';
import {
  getHomepageSections,
  seedHomepageSections,
  updateHomepageSections,
} from '@/lib/firestore/homepage_sections_db';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import { useLanguage } from '@/context/LanguageContext';

export default function HomepageSectionsPage() {
  const { t } = useLanguage();
  const [sections, setSections] = useState<HomepageSection[]>(defaultHomepageSections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setMessage(null);

    try {
      const fetchedSections = await getHomepageSections();
      setSections(fetchedSections);
    } catch {
      setSections(defaultHomepageSections);
      setMessage({ type: 'error', text: 'Failed to load homepage sections.' });
    }

    try {
      const fetchedSettings = await getSettings();
      if (fetchedSettings) {
        setSettings({ ...defaultSettings, ...fetchedSettings });
      }
    } catch {
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSection = (id: string, updates: Partial<HomepageSection>) => {
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.id === id ? { ...section, ...updates } : section
      )
    );
  };

  const reorderSections = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    setSections((currentSections) => {
      const sortedSections = [...currentSections].sort((a, b) => a.order - b.order);
      const sourceIndex = sortedSections.findIndex((section) => section.id === sourceId);
      const targetIndex = sortedSections.findIndex((section) => section.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentSections;
      }

      const reorderedSections = [...sortedSections];
      const [movedSection] = reorderedSections.splice(sourceIndex, 1);
      reorderedSections.splice(targetIndex, 0, movedSection);

      return reorderedSections.map((section, index) => ({
        ...section,
        order: index + 1,
      }));
    });
  };

  const handleSave = async () => {
    if (settings.demoMode) {
      setMessage({
        type: 'error',
        text: t('admin.settings.save_disabled_demo') || 'Saving is disabled in demo mode.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await updateHomepageSections(sections);
      setMessage({ type: 'success', text: 'Homepage sections saved successfully.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save homepage sections.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (settings.demoMode) {
      setMessage({
        type: 'error',
        text: t('admin.settings.save_disabled_demo') || 'Saving is disabled in demo mode.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await seedHomepageSections();
      const resetSections = await getHomepageSections();
      setSections(resetSections);
      setMessage({ type: 'success', text: 'Homepage sections reset to defaults.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to reset homepage sections.' });
    } finally {
      setSaving(false);
    }
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm font-medium text-gray-600">
          {t('admin.common.loading') || 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Homepage Sections</h1>
          <p className="mt-1 text-sm text-gray-500">
            Control visibility, order, titles, subtitles, and item limits for the homepage sections.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Section</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Enabled</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Custom Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Custom Subtitle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Item Limit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Drag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedSections.map((section) => (
                <tr
                  key={section.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragOverSectionId !== section.id) {
                      setDragOverSectionId(section.id);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedSectionId) {
                      reorderSections(draggedSectionId, section.id);
                    }
                    setDraggedSectionId(null);
                    setDragOverSectionId(null);
                  }}
                  className={dragOverSectionId === section.id ? 'bg-gray-50' : ''}
                >
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium text-gray-900">{section.label}</p>
                    <p className="mt-1 text-sm text-gray-500">{section.description}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wider text-gray-400">{section.id}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) =>
                          updateSection(section.id, { enabled: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      Show
                    </label>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                      {section.order}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <input
                      type="text"
                      value={section.title ?? ''}
                      onChange={(event) =>
                        updateSection(section.id, {
                          title: event.target.value || null,
                        })
                      }
                      placeholder="Use homepage default"
                      className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">Optional override for the section heading.</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <textarea
                      value={section.subtitle ?? ''}
                      onChange={(event) =>
                        updateSection(section.id, {
                          subtitle: event.target.value || null,
                        })
                      }
                      placeholder="Use homepage default"
                      rows={3}
                      className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">Optional override for the section description.</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <input
                      type="number"
                      min="1"
                      value={section.itemLimit ?? ''}
                      onChange={(event) =>
                        updateSection(section.id, {
                          itemLimit: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                      placeholder="Auto"
                      className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">Leave empty to use default.</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => {
                        setDraggedSectionId(section.id);
                        setDragOverSectionId(section.id);
                      }}
                      onDragEnd={() => {
                        setDraggedSectionId(null);
                        setDragOverSectionId(null);
                      }}
                      className={`inline-flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 text-sm transition active:cursor-grabbing ${
                        draggedSectionId === section.id
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      aria-label={`Drag ${section.label}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm0 5.25h.008v.008H8.25V12Zm0 5.25h.008v.008H8.25v-.008Zm7.5-10.5h.008v.008h-.008V6.75Zm0 5.25h.008v.008h-.008V12Zm0 5.25h.008v.008h-.008v-.008Z" />
                      </svg>
                      Drag
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
