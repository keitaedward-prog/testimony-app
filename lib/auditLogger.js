// lib/auditLogger.js
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Log an admin action to Firestore auditLogs collection.
 * @param {string} action - The action performed (e.g., 'create_user', 'reset_password')
 * @param {string} targetType - Type of target ('user', 'post', 'admin')
 * @param {string} targetId - ID of the user/post affected
 * @param {Object} details - Additional details (e.g., user email, post title, etc.)
 */
export async function logAdminAction(action, targetType, targetId, details = {}) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('Cannot log: no authenticated user');
      return;
    }

    // Get admin info from Firestore (optional, but nice)
    // We'll just log the uid and email/phone.
    const logEntry = {
      timestamp: serverTimestamp(),
      admin: {
        uid: user.uid,
        email: user.email || null,
        phone: user.phoneNumber || null,
      },
      action,
      targetType,
      targetId,
      details,
    };

    await addDoc(collection(db, 'auditLogs'), logEntry);
    console.log(`✅ Audit log created: ${action} on ${targetType} ${targetId}`);
  } catch (error) {
    console.error('❌ Failed to write audit log:', error);
  }
}