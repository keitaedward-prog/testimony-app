import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// If no Firebase Admin app exists, initialise one using environment variables
if (!getApps().length) {
  try {
    // Check if all required environment variables are present
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID ||
        !process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
        !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      console.error('Missing Firebase Admin environment variables');
      throw new Error('Firebase Admin initialization failed: Missing environment variables');
    }

    // Format the private key correctly (replace escaped newlines)
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('✅ Firebase Admin initialised from environment variables');
  } catch (error) {
    console.error('❌ Firebase Admin initialisation error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;