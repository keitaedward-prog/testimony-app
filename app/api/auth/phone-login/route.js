import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '232' + normalized.substring(1);
  }
  return '+' + normalized;
}

export async function POST(request) {
  console.log('🚀 POST /api/auth/phone-login HIT at', new Date().toISOString());
  
  try {
    // Log request headers (useful for debugging)
    const headers = Object.fromEntries(request.headers.entries());
    console.log('Headers:', headers);

    // Parse the request body
    let body;
    try {
      body = await request.json();
      console.log('Request body:', body);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { phoneNumber } = body;
    console.log('Received phoneNumber:', phoneNumber);

    if (!phoneNumber) {
      console.log('No phone number provided');
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log('Normalized phone:', normalizedPhone);

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByPhoneNumber(normalizedPhone);
      console.log('User found:', userRecord.uid);
    } catch (error) {
      console.log('User not found:', error.message);
      return NextResponse.json(
        { error: 'No account found with this phone number' },
        { status: 404 }
      );
    }

    const customToken = await adminAuth.createCustomToken(userRecord.uid, {
      phone_number: normalizedPhone,
    });
    console.log('Custom token generated');

    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error('Unhandled error in POST:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

// Add a GET handler for quick browser testing
export async function GET() {
  return NextResponse.json(
    { message: 'This endpoint only accepts POST requests' },
    { status: 405 }
  );
}