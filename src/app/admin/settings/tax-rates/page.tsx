'use client';

import React, { useState, useEffect } from 'react';
import {
  getAllTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from '@/lib/firestore/internationalization_db';
import { TaxRate } from '@/lib/firestore/internationalization';
import { getAllCategories } from '@/lib/firestore/categories_db';
import { Category } from '@/lib/firestore/categories';
import { getCountries, getStates, getCities } from '@/lib/firestore/geography_db';
import { Country, State, City } from '@/lib/firestore/geography';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';

const TaxRatesPage = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');
  const [formData, setFormData] = useState({
    name: '',
    rate: 0,
    type: 'percentage' as 'percentage' | 'fixed',
    region: '',
    countries: [] as string[],
    states: [] as string[],
    cities: [] as string[],
    applicableTo: 'all' as 'all' | 'products' | 'shipping' | 'both',
    productCategories: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch {
      // Failed to fetch settings
    }
  };

  const fetchData = async () => {
    try {
      const [taxRatesData, categoriesData, countriesData] = await Promise.all([
        getAllTaxRates(),
        getAllCategories(),
        getCountries(),
      ]);
      setTaxRates(taxRatesData);
      setCategories(categoriesData);
      setCountries(countriesData.filter((c) => c.status === 'active'));
    } catch {
      // Failed to fetch data
    } finally {
      setLoading(false);
    }
  };

  // Load states when countries are selected
  useEffect(() => {
    const loadStates = async () => {
      if (selectedCountryIds.length > 0) {
        try {
          const allStates: State[] = [];
          for (const countryId of selectedCountryIds) {
            const countryStates = await getStates(countryId);
            allStates.push(...countryStates);
          }
          setStates(allStates.filter((s, index, self) => 
            index === self.findIndex((st) => st.id === s.id)
          ));
        } catch {
            // Failed to load states
          setStates([]);
        }
      } else {
        setStates([]);
        setCities([]);
      }
    };
    loadStates();
  }, [selectedCountryIds]);

  // Load cities when states are selected
  useEffect(() => {
    const loadCities = async () => {
      if (formData.states && formData.states.length > 0) {
        try {
          const allCities: City[] = [];
          for (const stateId of formData.states) {
            const stateCities = await getCities(stateId);
            allCities.push(...stateCities);
          }
          setCities(allCities.filter((c, index, self) => 
            index === self.findIndex((ci) => ci.id === c.id)
          ));
        } catch {
          // Failed to load cities
          setCities([]);
        }
      } else {
        setCities([]);
      }
    };
    loadCities();
  }, [formData.states]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    try {
      if (editingTaxRate) {
        await updateTaxRate(editingTaxRate.id!, formData);
      } else {
        await createTaxRate(formData);
      }
      setShowForm(false);
      setEditingTaxRate(null);
      resetForm();
      fetchData();
      setInfoDialogMessage(editingTaxRate ? (t('admin.tax_rates_update_success') || 'Tax rate updated successfully!') : (t('admin.tax_rates_create_success') || 'Tax rate created successfully!'));
      setInfoDialogType('success');
      setShowInfoDialog(true);
    } catch {
      // Failed to save tax rate
      setInfoDialogMessage(t('admin.tax_rates_save_failed') || 'Failed to save tax rate');
      setInfoDialogType('error');
      setShowInfoDialog(true);
    }
  };

  const handleEdit = (taxRate: TaxRate) => {
    setEditingTaxRate(taxRate);
    setFormData({
      name: taxRate.name,
      rate: taxRate.rate,
      type: taxRate.type,
      region: taxRate.region || '',
      countries: taxRate.countries || [],
      states: taxRate.states || [],
      cities: taxRate.cities || [],
      applicableTo: taxRate.applicableTo,
      productCategories: taxRate.productCategories || [],
      isActive: taxRate.isActive,
    });
    setSelectedCountryIds(taxRate.countries || []);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Check if demo mode is enabled
    if (settings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setConfirmDialogMessage(
      t('admin.tax_rates_delete_confirm') ||
        'Are you sure you want to delete this tax rate?'
    );
    setConfirmDialogAction(() => async () => {
      try {
        await deleteTaxRate(id);
        fetchData();
        setInfoDialogMessage(t('admin.tax_rates_delete_success') || 'Tax rate deleted successfully.');
        setInfoDialogType('success');
        setShowInfoDialog(true);
      } catch {
        // Failed to delete tax rate
        setInfoDialogMessage(t('admin.tax_rates_delete_failed') || 'Failed to delete tax rate');
        setInfoDialogType('error');
        setShowInfoDialog(true);
      }
    });
    setShowConfirmDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      rate: 0,
      type: 'percentage',
      region: '',
      countries: [],
      states: [],
      cities: [],
      applicableTo: 'all',
      productCategories: [],
      isActive: true,
    });
    setSelectedCountryIds([]);
  };

  const handleCountryToggle = (countryId: string) => {
    const newCountries = formData.countries.includes(countryId)
      ? formData.countries.filter(id => id !== countryId)
      : [...formData.countries, countryId];
    
    setSelectedCountryIds(newCountries);
    setFormData(prev => ({
      ...prev,
      countries: newCountries,
      // Clear states and cities if country is removed
      states: prev.states.filter(s => {
        const state = states.find(st => st.id === s);
        if (!state) return false;
        return newCountries.includes(state.countryId || '');
      }),
      cities: prev.cities.filter(c => {
        const city = cities.find(ci => ci.id === c);
        if (!city) return false;
        const state = states.find(st => st.id === city.stateId);
        if (!state) return false;
        return newCountries.includes(state.countryId || '');
      }),
    }));
  };

  const handleStateToggle = (stateId: string) => {
    setFormData(prev => ({
      ...prev,
      states: prev.states.includes(stateId)
        ? prev.states.filter(id => id !== stateId)
        : [...prev.states, stateId],
      // Clear cities if state is removed
      cities: prev.cities.filter(c => {
        const city = cities.find(ci => ci.id === c);
        return city && city.stateId === stateId ? false : true;
      }),
    }));
  };

  const handleCityToggle = (cityId: string) => {
    setFormData(prev => ({
      ...prev,
      cities: prev.cities.includes(cityId)
        ? prev.cities.filter(id => id !== cityId)
        : [...prev.cities, cityId],
    }));
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {t('admin.tax_rates_title') || 'Tax Rates'}
          </h1>
          <p className="text-gray-500 text-sm">
            {t('admin.tax_rates_subtitle') || 'Configure tax rates by region'}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingTaxRate(null);
            setShowForm(true);
          }}
          className="bg-gray-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          {t('admin.tax_rates_new_button') || '+ New Tax Rate'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">
            {editingTaxRate
              ? t('admin.tax_rates_form_title_edit') || 'Edit Tax Rate'
              : t('admin.tax_rates_form_title_create') || 'Create Tax Rate'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.tax_rates_field_name_label') || 'Tax Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.tax_rates_field_name_placeholder') ||
                    'e.g., GST, VAT, Sales Tax'
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.tax_rates_field_region_label') ||
                    'Region (Country Code) - For backward compatibility'}
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder={
                    t('admin.tax_rates_field_region_placeholder') || 'e.g., PK, US, UK'
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.tax_rates_field_region_hint') ||
                    'Optional: Use countries below for better control'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.tax_rates_field_type_label') || 'Tax Type'}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="percentage">
                    {t('admin.tax_rates_field_type_percentage') || 'Percentage (%)'}
                  </option>
                  <option value="fixed">
                    {t('admin.tax_rates_field_type_fixed') || 'Fixed Amount'}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.type === 'percentage'
                    ? t('admin.tax_rates_field_rate_label_percentage') ||
                      'Tax Rate (%)'
                    : t('admin.tax_rates_field_rate_label_fixed') || 'Tax Amount'}
                </label>
                <input
                  type="number"
                  step={formData.type === 'percentage' ? '0.01' : '0.01'}
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.tax_rates_field_applicable_to_label') || 'Applicable To'}
                </label>
                <select
                  value={formData.applicableTo}
                  onChange={(e) => setFormData({ ...formData, applicableTo: e.target.value as 'all' | 'products' | 'shipping' | 'both' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="all">
                    {t('admin.tax_rates_field_applicable_to_all') || 'All'}
                  </option>
                  <option value="products">
                    {t('admin.tax_rates_field_applicable_to_products') ||
                      'Products Only'}
                  </option>
                  <option value="shipping">
                    {t('admin.tax_rates_field_applicable_to_shipping') ||
                      'Shipping Only'}
                  </option>
                  <option value="both">
                    {t('admin.tax_rates_field_applicable_to_both') ||
                      'Products & Shipping'}
                  </option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.tax_rates_field_countries_label') ||
                  'Countries (Optional - Leave empty for all countries)'}
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                {countries.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    {t('common.loading_countries') || 'Loading countries...'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {countries.map((country) => (
                      <label key={country.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={country.id ? formData.countries.includes(country.id) : false}
                          onChange={() => country.id && handleCountryToggle(country.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{country.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formData.countries.length > 0
                  ? formData.countries.length === 1
                    ? (t('admin.tax_rates_field_countries_selected_singular', {
                        count: formData.countries.length,
                      }) ||
                      `Selected: ${formData.countries.length} country`)
                    : (t('admin.tax_rates_field_countries_selected_plural', {
                        count: formData.countries.length,
                      }) ||
                      `Selected: ${formData.countries.length} countries`)
                  : (t('admin.tax_rates_field_countries_selected_all') ||
                      '(All countries)')}
              </p>
            </div>

            {formData.countries.length > 0 && states.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.tax_rates_field_states_label') ||
                    'States (Optional - Leave empty for all states)'}
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {states.map((state) => (
                      <label key={state.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={state.id ? formData.states.includes(state.id) || false : false}
                          onChange={() => state.id && handleStateToggle(state.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{state.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.states.length > 0
                    ? formData.states.length === 1
                      ? (t('admin.tax_rates_field_states_selected_singular', {
                          count: formData.states.length,
                        }) || `Selected: ${formData.states.length} state`)
                      : (t('admin.tax_rates_field_states_selected_plural', {
                          count: formData.states.length,
                        }) || `Selected: ${formData.states.length} states`)
                    : (t('admin.tax_rates_field_states_selected_all') ||
                        '(All states in selected countries)')}
                </p>
              </div>
            )}

            {formData.states && formData.states.length > 0 && cities.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.tax_rates_field_cities_label') ||
                    'Cities (Optional - Leave empty for all cities)'}
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {cities.map(city => (
                      <label key={city.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={city.id ? formData.cities.includes(city.id) || false : false}
                          onChange={() => city.id && handleCityToggle(city.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{city.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.cities.length > 0
                    ? formData.cities.length === 1
                      ? (t('admin.tax_rates_field_cities_selected_singular', {
                          count: formData.cities.length,
                        }) || `Selected: ${formData.cities.length} city`)
                      : (t('admin.tax_rates_field_cities_selected_plural', {
                          count: formData.cities.length,
                        }) || `Selected: ${formData.cities.length} cities`)
                    : (t('admin.tax_rates_field_cities_selected_all') ||
                        '(All cities in selected states)')}
                </p>
              </div>
            )}

            {formData.applicableTo === 'products' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.tax_rates_field_categories_label') ||
                    'Product Categories (optional)'}
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={formData.productCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, productCategories: [...formData.productCategories, category.id] });
                          } else {
                            setFormData({ ...formData, productCategories: formData.productCategories.filter(id => id !== category.id) });
                          }
                        }}
                        className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
              />
              <span className="text-sm font-medium text-gray-700">
                {t('admin.tax_rates_field_active_label') || 'Active'}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                {editingTaxRate
                  ? t('admin.tax_rates_save_button_update') || 'Update Tax Rate'
                  : t('admin.tax_rates_save_button_create') || 'Create Tax Rate'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingTaxRate(null);
                  resetForm();
                }}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('admin.tax_rates_cancel_button') || t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {taxRates.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <p className="text-base sm:text-lg font-medium mb-2">No tax rates found.</p>
            <p className="text-sm text-gray-400">Get started by adding your first tax rate</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Region</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Applicable To</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {taxRates.map((taxRate) => (
                    <tr key={taxRate.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{taxRate.name}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{taxRate.region || '-'}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                        {taxRate.type === 'percentage'
                          ? t('admin.tax_rates_rate_percentage', { rate: taxRate.rate }) || `${taxRate.rate}%`
                          : t('admin.tax_rates_rate_fixed', { rate: taxRate.rate }) || formatPrice(taxRate.rate)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 capitalize">{taxRate.type}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 capitalize">{taxRate.applicableTo}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          taxRate.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {taxRate.isActive ? t('admin.tax_rates_status_active') || 'Active' : t('admin.tax_rates_status_inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(taxRate)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(taxRate.id!)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {taxRates.map((taxRate) => (
                <div key={taxRate.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{taxRate.name}</h3>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>Region: {taxRate.region || '-'}</p>
                        <p>Rate: {taxRate.type === 'percentage'
                          ? t('admin.tax_rates_rate_percentage', { rate: taxRate.rate }) || `${taxRate.rate}%`
                          : t('admin.tax_rates_rate_fixed', { rate: taxRate.rate }) || formatPrice(taxRate.rate)}</p>
                        <p>Type: {taxRate.type}</p>
                        <p>Applicable To: {taxRate.applicableTo}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      taxRate.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {taxRate.isActive ? t('admin.tax_rates_status_active') || 'Active' : t('admin.tax_rates_status_inactive') || 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(taxRate)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(taxRate.id!)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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

      {/* Confirm Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title={t('common.confirm') || 'Confirm'}
        message={confirmDialogMessage}
        type="confirm"
        onConfirm={() => {
          if (confirmDialogAction) {
            confirmDialogAction();
          }
          setShowConfirmDialog(false);
        }}
        confirmText={t('common.confirm') || 'Confirm'}
        cancelText={t('common.cancel') || 'Cancel'}
      />
    </div>
  );
};

export default TaxRatesPage;

