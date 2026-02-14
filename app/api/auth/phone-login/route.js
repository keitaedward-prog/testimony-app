import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');
  // If it starts with '0', assume local number and add Sierra Leone country code
  if (normalized.startsWith('0')) {
    normalized = '232' + normalized.substring(1);
  }
  // Ensure it starts with '+'
  return '+' + normalized;
}

export async function POST(request) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log('🔍 Looking up user with phone:', normalizedPhone);

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByPhoneNumber(normalizedPhone);
    } catch (error) {
      console.log('❌ User not found:', normalizedPhone);
      return NextResponse.json(
        { error: 'No account found with this phone number' },
        { status: 404 }
      );
    }

    const customToken = await adminAuth.createCustomToken(userRecord.uid, {
      phone_number: normalizedPhone,
    });

    console.log('✅ Custom token generated for:', normalizedPhone);

    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error('❌ Phone login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}