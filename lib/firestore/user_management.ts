import { Timestamp } from 'firebase/firestore';

export enum AdminRole {
  SuperAdmin = 'super_admin',
  Admin = 'admin',
  Manager = 'manager',
  Staff = 'staff',
  Viewer = 'viewer',
}

export interface Permission {
  resource: string; // e.g., 'products', 'orders', 'customers'
  actions: string[]; // e.g., ['read', 'write', 'delete']
}

export interface RolePermissions {
  id?: string;
  role: AdminRole;
  name: string; // Display name
  description?: string;
  permissions: Permission[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StaffMember {
  id?: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: AdminRole;
  permissions?: Permission[]; // Custom permissions (overrides role permissions)
  isActive: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string; // Admin UID who created this staff member
}

export interface ActivityLog {
  id?: string;
  userId: string;
  userName: string;
  action: string; // e.g., 'product.created', 'order.updated'
  resource: string; // e.g., 'products', 'orders'
  resourceId?: string; // ID of the resource affected
  details?: Record<string, unknown>; // Additional details
  ipAddress?: string;
  userAgent?: string;
  createdAt: Timestamp;
}

export interface TwoFactorAuth {
  id?: string;
  userId: string;
  enabled: boolean;
  secret?: string; // TOTP secret (encrypted)
  backupCodes?: string[]; // Backup codes (encrypted)
  verifiedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

