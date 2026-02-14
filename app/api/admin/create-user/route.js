import admin from 'firebase-admin';
// ... other imports
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '232' + normalized.substring(1);
  }
  return '+' + normalized;
}

export async function POST(request) {
  try {
    // Verify that the requester is an admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if the requester is in the admins collection
    const adminDoc = await adminDb.collection('admins').doc(decodedToken.uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const { firstName, lastName, email, phone, password, isAdmin, isActive } = await request.json();

    // Validate required fields
    if (!firstName || !phone || !password) {
      return NextResponse.json(
        { error: 'First name, phone number, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    
    // Determine auth email
    let authEmail = email;
    if (!authEmail || !authEmail.includes('@')) {
      // Use phone number as email base
      const phoneDigits = normalizedPhone.replace(/\D/g, '');
      authEmail = `${phoneDigits}@phone.user`;
    }

    // Create user in Firebase Auth with phone number
    const userRecord = await adminAuth.createUser({
      email: authEmail,
      password: password,
      phoneNumber: normalizedPhone,
      displayName: `${firstName} ${lastName || ''}`.trim(),
    });

    console.log('✅ Firebase Auth user created:', userRecord.uid);

    // Prepare Firestore user data
    const userData = {
      uid: userRecord.uid,
      firstName,
      lastName: lastName || '',
      email: email || '',
      phone: normalizedPhone,
      isActive: isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: decodedToken.uid,
      userType: isAdmin ? 'admin' : 'user',
    };

    // Save to users collection
    await adminDb.collection('users').doc(userRecord.uid).set(userData);

    // If admin, add to admins collection
    if (isAdmin) {
      const adminData = {
        uid: userRecord.uid,
        email: email || '',
        phone: normalizedPhone,
        firstName,
        lastName: lastName || '',
        addedAt: new Date(),
        addedBy: decodedToken.uid,
      };
      await adminDb.collection('admins').doc(userRecord.uid).set(adminData);
    }

    // After successful creation, log to Firestore using Admin SDK
    try {
      await adminDb.collection('auditLogs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        admin: {
          uid: decodedToken.uid,
          email: decodedToken.email || null,
          phone: decodedToken.phone_number || null,
        },
        action: 'create_user',
        targetType: 'user',
        targetId: userRecord.uid,
        details: {
          firstName,
          lastName: lastName || '',
          phone: normalizedPhone,
          email: email || null,
          isAdmin: isAdmin || false,
        },
      });
    } catch (logError) {
      console.error('Failed to write audit log:', logError);
      // Don't fail the whole request
    }

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    
    let errorMessage = 'Failed to create user';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Email already in use';
    } else if (error.code === 'auth/phone-number-already-exists') {
      errorMessage = 'Phone number already registered';
    } else if (error.code === 'auth/invalid-phone-number') {
      errorMessage = 'Invalid phone number format';
    } else {
      errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}