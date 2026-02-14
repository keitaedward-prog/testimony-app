"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import Link from 'next/link';
import { FaPhone } from 'react-icons/fa';

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (phoneNumber) {
      let cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned.length > 0) {
        cleaned = '+' + cleaned;
        if (cleaned.length > 4) cleaned = cleaned.substring(0,4)+' '+cleaned.substring(4);
        if (cleaned.length > 8) cleaned = cleaned.substring(0,8)+' '+cleaned.substring(8);
        if (cleaned.length > 12) cleaned = cleaned.substring(0,12)+' '+cleaned.substring(12);
        if (cleaned.length > 16) cleaned = cleaned.substring(0,16);
      }
      setPhoneNumber(cleaned);
    }
  }, [phoneNumber]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!phoneNumber) {
      setError('Please enter your phone number');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      await signInWithCustomToken(auth, data.token);
      
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <FaPhone className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Login</h1>
          <p className="text-gray-600">Enter your phone number to sign in</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">✅ {success}</div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">❌ {error}</div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaPhone className="inline mr-2 text-blue-500" />
              Phone Number *
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+232 123 456 7890"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +232 for Sierra Leone)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t text-center">
          <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm">
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}