'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStaffMember, updateStaffMember, getStaffMemberByUid } from '@/lib/firestore/user_management_db';
import { StaffMember, AdminRole } from '@/lib/firestore/user_management';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { getSettings } from '@/lib/firestore/settings_db';
import { Settings, defaultSettings } from '@/lib/firestore/settings';
import Dialog from '@/components/ui/Dialog';
import { Value } from 'react-phone-number-input';
import type { Country as PhoneCountry } from 'react-phone-number-input';
import dynamic from 'next/dynamic';

const PhoneInput = dynamic(() => import('react-phone-number-input'), { ssr: false });

const EditStaffPage = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const params = useParams();
  const staffId = params.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const [appSettings, setAppSettings] = useState<Settings>(defaultSettings);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoDialogMessage, setInfoDialogMessage] = useState('');
  const [infoDialogType, setInfoDialogType] = useState<'success' | 'error'>('error');

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '' as Value | undefined,
    role: AdminRole.Admin, // Filhal sirf Admin role - future mein aur roles add honge
    isActive: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Try to get by UID first (works for both staff collection and users collection)
          let staffMember = await getStaffMemberByUid(staffId);
          
          // If not found by UID, try by document ID (for staff collection)
          if (!staffMember) {
            staffMember = await getStaffMember(staffId);
          }
          
          if (staffMember) {
            setStaff(staffMember);
            setFormData({
              displayName: staffMember.displayName || '',
              phoneNumber: staffMember.phoneNumber as Value | undefined,
              role: AdminRole.Admin, // Filhal sirf Admin role - existing staff ko bhi Admin set karo
              isActive: staffMember.isActive,
            });
          } else {
            alert('Staff member not found');
            router.push('/admin/staff');
          }
        } catch {
          alert('Failed to load staff member');
          router.push('/admin/staff');
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, staffId]);

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const data = await getSettings();
        if (data) {
          setAppSettings({ ...defaultSettings, ...data });
        }
      } catch {
        // Failed to fetch settings
      }
    };
    fetchSettingsData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handlePhoneChange = (value: Value | undefined) => {
    setFormData(prev => ({
      ...prev,
      phoneNumber: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !staff) return;
    if (appSettings.demoMode) {
      setInfoDialogMessage(t('admin.settings.save_disabled_demo') || 'Settings saving is disabled in demo mode.');
      setInfoDialogType('error');
      setShowInfoDialog(true);
      return;
    }
    setSaving(true);
    try {
      // If staff member is from users collection (created via script), update users collection
      // Otherwise update staff collection
      if (staff.id === staff.uid) {
        // This is from users collection, update users document
        const userDocRef = doc(db, 'users', staff.uid);
        await updateDoc(userDocRef, {
          displayName: formData.displayName,
          phoneNumber: formData.phoneNumber ? String(formData.phoneNumber) : undefined,
          role: 'admin', // Filhal sirf Admin role
          isAdmin: true, // Sab staff members admin hain filhal
          isBlocked: !formData.isActive,
          updatedAt: new Date(),
        });
      } else {
        // This is from staff collection, update staff document
        await updateStaffMember(staff.id!, {
          displayName: formData.displayName,
          phoneNumber: formData.phoneNumber ? String(formData.phoneNumber) : undefined,
          role: AdminRole.Admin, // Filhal sirf Admin role
          isActive: formData.isActive,
        });
      }

      setInfoDialogMessage(t('admin.staff_update_success') || 'Staff member updated successfully!');
      setInfoDialogType('success');
      setShowInfoDialog(true);
      setTimeout(() => {
        router.push('/admin/staff');
      }, 1500);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update staff member.';
      setInfoDialogMessage(errorMessage);
      setInfoDialogType('error');
      setShowInfoDialog(true);
    } finally {
      setSaving(false);
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

  if (!staff) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/staff"
          className="text-gray-600 hover:text-gray-900 text-sm font-medium mb-4 inline-flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {t('admin.staff_back') || 'Back to Staff'}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
          {t('admin.edit_staff_member') || 'Edit Staff Member'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('admin.staff_edit_subtitle') || 'Update staff member information'}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_email') || 'Email'}</label>
          <input
            type="email"
            value={staff.email}
            disabled
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">{t('admin.staff_email_cannot_change') || 'Email cannot be changed'}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_display_name') || 'Display Name'} *</label>
          <input
            type="text"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_phone_number') || 'Phone Number'}</label>
          <div className="phone-input-container">
            <PhoneInput
              international
              defaultCountry={(settings?.site?.defaultCountry as PhoneCountry) || ("PK" as PhoneCountry)}
              value={formData.phoneNumber}
              onChange={handlePhoneChange}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('admin.staff_form_role') || 'Role'} *</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-gray-50"
            disabled
          >
            <option value={AdminRole.Admin}>{t('admin.staff_role_admin') || 'Admin'}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('admin.staff_role_note') || 'Currently only Admin role is available. More roles will be added in future updates.'}</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
          />
          <label className="text-sm text-gray-700">{t('admin.staff_form_active') || 'Active'}</label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.push('/admin/staff')}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            {t('admin.common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (t('admin.staff_updating') || 'Updating...') : (t('admin.staff_update_button') || 'Update Staff Member')}
          </button>
        </div>
      </form>

      {/* Info Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => {
          setShowInfoDialog(false);
          if (infoDialogType === 'success') {
            router.push('/admin/staff');
          }
        }}
        title={infoDialogType === 'success' ? (t('common.success') || 'Success') : (t('common.error') || 'Error')}
        message={infoDialogMessage}
        type={infoDialogType}
        showCancel={false}
        confirmText={t('common.close') || 'Close'}
      />

      {/* Custom styles for PhoneInput */}
      <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .PhoneInputCountry {
          position: relative;
          align-self: stretch;
          display: flex;
          align-items: center;
          padding-right: 0.5rem;
          margin-right: 0.5rem;
          border-right: 1px solid #e5e7eb;
        }
        .PhoneInputCountryIcon {
          width: 1.25rem;
          height: 0.875rem;
          max-width: 1.25rem;
          max-height: 0.875rem;
          box-shadow: 0 0 1px rgba(0,0,0,0.5);
          object-fit: contain;
        }
        .PhoneInputCountryIcon img {
          width: 1.25rem !important;
          height: 0.875rem !important;
          max-width: 1.25rem !important;
          max-height: 0.875rem !important;
        }
        .PhoneInputCountrySelect {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          z-index: 1;
          border: 0;
          opacity: 0;
          cursor: pointer;
        }
        .PhoneInputInput {
          flex: 1;
          min-width: 0;
          background-color: transparent;
          border: none;
          padding: 0;
          font-size: 1rem;
          line-height: 1.5rem;
          color: #111827;
        }
        .PhoneInputInput:focus {
          outline: none;
        }
        .phone-input-container {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.625rem 1rem;
          transition: all 0.2s;
        }
        .phone-input-container:focus-within {
          border-color: #000;
          ring: 1px solid #000;
          box-shadow: 0 0 0 1px #000;
        }
      `}</style>
    </div>
  );
};

export default EditStaffPage;

