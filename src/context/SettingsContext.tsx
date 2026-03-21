'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({
  children,
  initialSettings = null,
}: {
  children: React.ReactNode;
  initialSettings?: Settings | null;
}) => {
  const mergedInitialSettings = initialSettings
    ? ({ ...defaultSettings, ...initialSettings } as Settings)
    : defaultSettings;
  const [settings, setSettings] = useState<Settings>(mergedInitialSettings);
  const [loading, setLoading] = useState(!initialSettings);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      // Failed to fetch settings
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSettings) return;
    fetchSettings();
  }, [fetchSettings, initialSettings]);

  const value = useMemo(
    () => ({ settings, loading, refreshSettings: fetchSettings }),
    [fetchSettings, loading, settings]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
