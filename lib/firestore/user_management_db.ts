import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { RolePermissions, StaffMember, ActivityLog, TwoFactorAuth, AdminRole } from './user_management';

// ========== ROLE PERMISSIONS ==========
const rolePermissionsCollectionRef = collection(db, 'role_permissions');

export const addRolePermissions = async (rolePerms: Omit<RolePermissions, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newRolePermsRef = await addDoc(rolePermissionsCollectionRef, {
    ...rolePerms,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newRolePermsRef.id;
};

export const getRolePermissions = async (role: AdminRole): Promise<RolePermissions | null> => {
  const q = query(rolePermissionsCollectionRef, where('role', '==', role));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as RolePermissions;
};

export const getAllRolePermissions = async (): Promise<RolePermissions[]> => {
  const querySnapshot = await getDocs(rolePermissionsCollectionRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RolePermissions));
};

export const updateRolePermissions = async (id: string, rolePerms: Partial<Omit<RolePermissions, 'id' | 'createdAt'>>): Promise<void> => {
  const rolePermsDocRef = doc(db, 'role_permissions', id);
  await updateDoc(rolePermsDocRef, {
    ...rolePerms,
    updatedAt: new Date(),
  });
};

// ========== STAFF MANAGEMENT ==========
const staffCollectionRef = collection(db, 'staff');

export const addStaffMember = async (staff: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newStaffRef = await addDoc(staffCollectionRef, {
    ...staff,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newStaffRef.id;
};

export const getStaffMember = async (id: string): Promise<StaffMember | null> => {
  const staffDocRef = doc(db, 'staff', id);
  const staffDoc = await getDoc(staffDocRef);
  if (staffDoc.exists()) {
    return { id: staffDoc.id, ...staffDoc.data() } as StaffMember;
  }
  return null;
};

export const getStaffMemberByUid = async (uid: string): Promise<StaffMember | null> => {
  // First try staff collection
  const q = query(staffCollectionRef, where('uid', '==', uid));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as StaffMember;
  }
  
  // If not found in staff collection, check users collection
  const usersCollectionRef = collection(db, 'users');
  const userDocRef = doc(usersCollectionRef, uid);
  const userDoc = await getDoc(userDocRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data();
    // Only return if user is admin/staff
    if (data.isAdmin || data.role === 'admin' || data.role === 'staff') {
      let role = AdminRole.Staff;
      if (data.role === 'admin' || data.isAdmin) {
        role = AdminRole.Admin;
      } else if (data.role === 'staff') {
        role = AdminRole.Staff;
      }
      
      return {
        id: uid,
        uid: uid,
        email: data.email || '',
        displayName: data.displayName || data.name || '',
        phoneNumber: data.phoneNumber || data.phone || '',
        role: role,
        isActive: !data.isBlocked,
        lastLoginAt: data.lastLoginAt,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: data.updatedAt || Timestamp.now(),
      } as StaffMember;
    }
  }
  
  return null;
};

export const getAllStaffMembers = async (): Promise<StaffMember[]> => {
  // Get staff from staff collection
  const staffQuerySnapshot = await getDocs(query(staffCollectionRef, orderBy('createdAt', 'desc')));
  const staffMembers = staffQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));

  // Also get admin/staff from users collection (for accounts created via script)
  const usersCollectionRef = collection(db, 'users');
  
  // Fetch users with isAdmin: true or role: 'admin' or role: 'staff'
  const adminUsersQuery1 = query(usersCollectionRef, where('isAdmin', '==', true));
  const adminUsersQuery2 = query(usersCollectionRef, where('role', '==', 'admin'));
  const adminUsersQuery3 = query(usersCollectionRef, where('role', '==', 'staff'));
  
  const [snapshot1, snapshot2, snapshot3] = await Promise.all([
    getDocs(adminUsersQuery1),
    getDocs(adminUsersQuery2),
    getDocs(adminUsersQuery3)
  ]);
  
  // Combine all admin/staff users and remove duplicates
  const allAdminUserDocs = new Map<string, { id: string; data: () => { email?: string; displayName?: string; name?: string; phoneNumber?: string; phone?: string; role?: string; isAdmin?: boolean; isBlocked?: boolean; lastLoginAt?: Timestamp; createdAt?: Timestamp; updatedAt?: Timestamp } }>();
  
  snapshot1.docs.forEach(doc => {
    if (!allAdminUserDocs.has(doc.id)) {
      allAdminUserDocs.set(doc.id, doc);
    }
  });
  
  snapshot2.docs.forEach(doc => {
    if (!allAdminUserDocs.has(doc.id)) {
      allAdminUserDocs.set(doc.id, doc);
    }
  });
  
  snapshot3.docs.forEach(doc => {
    if (!allAdminUserDocs.has(doc.id)) {
      allAdminUserDocs.set(doc.id, doc);
    }
  });
  
  const adminUsers = Array.from(allAdminUserDocs.values())
    .map(doc => {
      const data = doc.data();
      // Check if this user is already in staff collection
      const existingStaff = staffMembers.find(s => s.uid === doc.id);
      if (existingStaff) return null; // Skip if already in staff collection
      
      // Determine role
      let role = AdminRole.Staff;
      if (data.role === 'admin' || data.isAdmin) {
        role = AdminRole.Admin;
      } else if (data.role === 'staff') {
        role = AdminRole.Staff;
      }
      
      // Convert user document to StaffMember format
      return {
        id: doc.id,
        uid: doc.id,
        email: data.email || '',
        displayName: data.displayName || data.name || '',
        phoneNumber: data.phoneNumber || data.phone || '',
        role: role,
        isActive: !data.isBlocked,
        lastLoginAt: data.lastLoginAt,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: data.updatedAt || Timestamp.now(),
      } as StaffMember;
    })
    .filter((staff): staff is StaffMember => staff !== null);

  // Combine and sort by createdAt
  const allStaff = [...staffMembers, ...adminUsers].sort((a, b) => {
    const getTimestamp = (ts: Timestamp | { seconds?: number; nanoseconds?: number } | undefined): number => {
      if (!ts) return 0;
      if (ts instanceof Timestamp) {
        return ts.toMillis();
      }
      if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
        return ts.seconds * 1000;
      }
      return 0;
    };
    const aTime = getTimestamp(a.createdAt);
    const bTime = getTimestamp(b.createdAt);
    return bTime - aTime; // Descending order
  });

  return allStaff;
};

export const updateStaffMember = async (id: string, staff: Partial<Omit<StaffMember, 'id' | 'createdAt'>>): Promise<void> => {
  const staffDocRef = doc(db, 'staff', id);
  await updateDoc(staffDocRef, {
    ...staff,
    updatedAt: new Date(),
  });
};

export const deleteStaffMember = async (id: string): Promise<void> => {
  const staffDocRef = doc(db, 'staff', id);
  await deleteDoc(staffDocRef);
};

export const checkPermission = async (userId: string, resource: string, action: string): Promise<boolean> => {
  const staff = await getStaffMemberByUid(userId);
  if (!staff || !staff.isActive) return false;

  // Check custom permissions first
  if (staff.permissions) {
    const customPerm = staff.permissions.find(p => p.resource === resource);
    if (customPerm && customPerm.actions.includes(action)) {
      return true;
    }
  }

  // Check role permissions
  const rolePerms = await getRolePermissions(staff.role);
  if (rolePerms) {
    const perm = rolePerms.permissions.find(p => p.resource === resource);
    if (perm && perm.actions.includes(action)) {
      return true;
    }
  }

  // Super admin has all permissions
  if (staff.role === AdminRole.SuperAdmin) {
    return true;
  }

  return false;
};

// ========== ACTIVITY LOGS ==========
const activityLogsCollectionRef = collection(db, 'activity_logs');

export const addActivityLog = async (log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<string> => {
  const newLogRef = await addDoc(activityLogsCollectionRef, {
    ...log,
    createdAt: new Date(),
  });
  return newLogRef.id;
};

export const getActivityLog = async (id: string): Promise<ActivityLog | null> => {
  const logDocRef = doc(db, 'activity_logs', id);
  const logDoc = await getDoc(logDocRef);
  if (logDoc.exists()) {
    return { id: logDoc.id, ...logDoc.data() } as ActivityLog;
  }
  return null;
};

export const getUserActivityLogs = async (userId: string, limit?: number): Promise<ActivityLog[]> => {
  const q = query(activityLogsCollectionRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  if (limit) {
    // Note: Firestore doesn't support limit in query builder directly, would need to use limit() function
    // For now, we'll fetch all and limit client-side
  }
  const querySnapshot = await getDocs(q);
  const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
  return limit ? logs.slice(0, limit) : logs;
};

export const getAllActivityLogs = async (filters?: {
  userId?: string;
  resource?: string;
  action?: string;
  limit?: number;
}): Promise<ActivityLog[]> => {
  let q = query(activityLogsCollectionRef, orderBy('createdAt', 'desc'));
  
  if (filters?.userId) {
    q = query(activityLogsCollectionRef, where('userId', '==', filters.userId), orderBy('createdAt', 'desc'));
  }
  
  const querySnapshot = await getDocs(q);
  let logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
  
  // Client-side filtering
  if (filters?.resource) {
    logs = logs.filter(log => log.resource === filters.resource);
  }
  if (filters?.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  if (filters?.limit) {
    logs = logs.slice(0, filters.limit);
  }
  
  return logs;
};

// ========== TWO-FACTOR AUTHENTICATION ==========
const twoFactorAuthCollectionRef = collection(db, 'two_factor_auth');

export const addTwoFactorAuth = async (tfa: Omit<TwoFactorAuth, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTFARef = await addDoc(twoFactorAuthCollectionRef, {
    ...tfa,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newTFARef.id;
};

export const getTwoFactorAuth = async (userId: string): Promise<TwoFactorAuth | null> => {
  const q = query(twoFactorAuthCollectionRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as TwoFactorAuth;
};

export const updateTwoFactorAuth = async (userId: string, tfa: Partial<Omit<TwoFactorAuth, 'id' | 'userId' | 'createdAt'>>): Promise<void> => {
  const existing = await getTwoFactorAuth(userId);
  if (existing) {
    const tfaDocRef = doc(db, 'two_factor_auth', existing.id!);
    await updateDoc(tfaDocRef, {
      ...tfa,
      updatedAt: new Date(),
    });
  } else {
    await addTwoFactorAuth({
      userId,
      enabled: false,
      ...tfa,
    });
  }
};

export const enableTwoFactorAuth = async (userId: string, secret: string, backupCodes: string[]): Promise<void> => {
  await updateTwoFactorAuth(userId, {
    enabled: true,
    secret,
    backupCodes,
    verifiedAt: Timestamp.now(),
  });
};

export const disableTwoFactorAuth = async (userId: string): Promise<void> => {
  await updateTwoFactorAuth(userId, {
    enabled: false,
    secret: undefined,
    backupCodes: undefined,
  });
};

