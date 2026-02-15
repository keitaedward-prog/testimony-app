import admin from 'firebase-admin';
// ... other imports
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  return NextResponse.json({ message: 'Reset password API is reachable' });
}

export async function POST(request) {
  try {
    const { uid, newPassword } = await request.json();

    if (!uid || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Verify the requester is an admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    const adminDoc = await adminDb.collection('admins').doc(decodedToken.uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    await adminAuth.updateUser(uid, { password: newPassword });

    console.log(`✅ Password reset for user ${uid}`);

    // After await adminAuth.updateUser(...)
    try {
      await adminDb.collection('auditLogs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        admin: {
          uid: decodedToken.uid,
          email: decodedToken.email || null,
          phone: decodedToken.phone_number || null,
        },
        action: 'reset_password',
        targetType: 'user',
        targetId: uid,
        details: { note: 'Password reset by admin' },
      });
    } catch (logError) {
      console.error('Failed to write audit log:', logError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}