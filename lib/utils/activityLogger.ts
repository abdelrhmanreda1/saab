import { addActivityLog } from '../firestore/user_management_db';
import { getAuth } from 'firebase/auth';
import { app } from '../firebase';

/**
 * Helper function to log activities automatically
 * This should be called after any CRUD operation
 */
export const logActivity = async (
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> => {
  try {
    const auth = getAuth(app);
    const user = auth.currentUser;
    
    if (!user) {
      // Don't log if user is not authenticated
      return;
    }

    // Get user agent and IP (if available)
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined;
    
    await addActivityLog({
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown',
      action,
      resource,
      resourceId,
      details,
      userAgent,
    });
  } catch {
    // Don't throw error if activity logging fails - it shouldn't break the main operation
    // Failed to log activity
  }
};

