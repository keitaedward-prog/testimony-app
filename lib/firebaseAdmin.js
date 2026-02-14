import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// If no Firebase Admin app exists, initialise one
if (!getApps().length) {
  try {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialised');
  } catch (error) {
    console.error('❌ Firebase Admin initialisation error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;