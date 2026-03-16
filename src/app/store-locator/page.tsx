'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getAllStoreLocations } from '@/lib/firestore/store_locations_db';
import { StoreLocation } from '@/lib/firestore/store_locations';
import { useSettings } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/Toast';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
    initMap: () => void;
    selectStoreFromMap?: (storeId: string) => void;
  }
}

const StoreLocatorPage = () => {
  const { settings, loading: settingsLoading } = useSettings();
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { t } = useLanguage();
  const { showError } = useToast();

  const fetchStores = React.useCallback(async () => {
    try {
      const allStores = await getAllStoreLocations(true); // Only active stores
      setStores(allStores);
    } catch {
      // Failed to fetch stores
      showError(t('store_locator.error_loading_stores') || 'Error fetching stores. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [t, showError]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (!settingsLoading && settings.site.googleMapsApiKey && stores.length > 0 && mapRef.current && !mapLoaded) {
      loadGoogleMaps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, stores, mapLoaded, settingsLoading]);

  const loadGoogleMaps = () => {
    if (window.google && mapRef.current) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${settings.site.googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setMapLoaded(true);
      initializeMap();
    };
    script.onerror = () => {
      // Failed to load Google Maps
      showError(
        t('store_locator.error_google_maps') ||
          'Failed to load Google Maps. Please check your API key.'
      );
    };
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!window.google || !mapRef.current || stores.length === 0) return;

    const center = stores.length > 0
      ? { lat: stores[0].latitude, lng: stores[0].longitude }
      : { lat: 30.3753, lng: 69.3451 }; 

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: stores.length === 1 ? 15 : 10,
      center,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;

    // Add markers for each store
    markersRef.current = stores.map((store) => {
      const marker = new window.google.maps.Marker({
        position: { lat: store.latitude, lng: store.longitude },
        map,
        title: store.name,
        animation: window.google.maps.Animation.DROP,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${store.name}</h3>
            <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">${store.address}</p>
            <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">${store.city}, ${store.state}</p>
            ${store.phone ? `<p style="margin: 4px 0; font-size: 14px;"><a href="tel:${store.phone}" style="color: #0066cc;">${store.phone}</a></p>` : ''}
            <button onclick="window.selectStoreFromMap('${store.id}')" style="margin-top: 8px; padding: 6px 12px; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">View Details</button>
          </div>
        `,
      });

      marker.addListener('click', () => {
        setSelectedStore(store);
        infoWindow.open(map, marker);
      });

      return marker;
    });

    // Fit bounds to show all markers
    if (stores.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      stores.forEach((store) => {
        bounds.extend({ lat: store.latitude, lng: store.longitude });
      });
      map.fitBounds(bounds);
    }

    // Expose function for info window button
    window.selectStoreFromMap = (storeId: string) => {
      const store = stores.find(s => s.id === storeId);
      if (store) {
        setSelectedStore(store);
        // Scroll to store details
        document.getElementById('store-details')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
  };

  const handleStoreClick = (store: StoreLocation) => {
    setSelectedStore(store);
    if (mapInstanceRef.current && window.google) {
      const position = { lat: store.latitude, lng: store.longitude };
      mapInstanceRef.current.setCenter(position);
      mapInstanceRef.current.setZoom(15);
      
      // Trigger click on corresponding marker
      const marker = markersRef.current.find((m, index) => stores[index]?.id === store.id);
      if (marker) {
        window.google.maps.event.trigger(marker, 'click');
      }
    }
  };

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatOpeningHours = (hours: StoreLocation['openingHours']) => {
    if (!hours) return t('store_locator.hours_not_available') || 'Hours not available';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = [
      t('store_locator.monday') || 'Monday',
      t('store_locator.tuesday') || 'Tuesday',
      t('store_locator.wednesday') || 'Wednesday',
      t('store_locator.thursday') || 'Thursday',
      t('store_locator.friday') || 'Friday',
      t('store_locator.saturday') || 'Saturday',
      t('store_locator.sunday') || 'Sunday',
    ];
    
    return days.map((day, index) => {
      const dayHours = hours[day as keyof typeof hours];
      if (!dayHours || dayHours.closed) {
        return `${dayNames[index]}: Closed`;
      }
      return `${dayNames[index]}: ${dayHours.open} - ${dayHours.close}`;
    }).join('\n');
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">
          {t('store_locator.loading') || 'Loading...'}
        </div>
      </div>
    );
  }

  if (!settings.site.googleMapsApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t('store_locator.title') || 'Store Locator'}
          </h1>
          <p className="text-gray-600 mb-4">
            {t('store_locator.no_api_key') ||
              'Google Maps API key is not configured. Please add it in Admin Settings > Site Configuration.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-50 border-b border-gray-100 py-8 mb-6">
        <div className="page-container text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
            {t('store_locator.title') || 'Store Locator'}
          </h1>
          <p className="text-sm text-gray-500">
            {t('store_locator.subtitle') || 'Find our stores near you'}
          </p>
        </div>
      </div>

      <div className="page-container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Store List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <input
                type="text"
                placeholder={t('store_locator.search_placeholder') || 'Search stores...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none"
              />
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">
                  {t('store_locator.stores_found', { count: filteredStores.length }) ||
                    `${filteredStores.length} Store${
                      filteredStores.length !== 1 ? 's' : ''
                    } Found`}
                </h2>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {filteredStores.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {t('store_locator.no_results') || 'No stores found matching your search.'}
                  </div>
                ) : (
                  filteredStores.map((store) => (
                    <div
                      key={store.id}
                      onClick={() => handleStoreClick(store)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedStore?.id === store.id ? 'bg-gray-50 border-l-4 border-l-black' : ''
                      }`}
                    >
                      <h3 className="font-semibold text-gray-900 mb-1">{store.name}</h3>
                      <p className="text-sm text-gray-600 mb-1">{store.address}</p>
                      <p className="text-sm text-gray-600">{store.city}, {store.state}</p>
                      {store.phone && (
                        <p className="text-sm text-blue-600 mt-1">{store.phone}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div ref={mapRef} className="w-full h-[600px]" />
            </div>
          </div>
        </div>

        {/* Store Details */}
        {selectedStore && (
          <div id="store-details" className="mt-6 bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">{selectedStore.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">Address</h3>
                <p className="text-xs text-gray-600 mb-3">
                  {selectedStore.address}<br />
                  {selectedStore.city}, {selectedStore.state} {selectedStore.zipCode}<br />
                  {selectedStore.country}
                </p>

                {selectedStore.phone && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                      {t('store_locator.phone') || 'Phone'}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      <a href={`tel:${selectedStore.phone}`} className="text-blue-600 hover:underline">
                        {selectedStore.phone}
                      </a>
                    </p>
                  </>
                )}

                {selectedStore.email && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                      {t('store_locator.email') || 'Email'}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      <a href={`mailto:${selectedStore.email}`} className="text-blue-600 hover:underline">
                        {selectedStore.email}
                      </a>
                    </p>
                  </>
                )}
              </div>

              <div>
                {selectedStore.openingHours && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                      {t('store_locator.opening_hours') || 'Opening Hours'}
                    </h3>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
                      {formatOpeningHours(selectedStore.openingHours)}
                    </pre>
                  </>
                )}

                {selectedStore.description && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5 mt-3">
                      {t('store_locator.description') || 'Description'}
                    </h3>
                    <p className="text-xs text-gray-600">{selectedStore.description}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreLocatorPage;

