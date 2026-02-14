// app/admin/login/page.js - UPDATED (REMOVED TEST LOGOUT)
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { FaEnvelope, FaPhone, FaKey } from 'react-icons/fa';

export default function AdminLoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-format phone number
  useEffect(() => {
    if (phone) {
      let cleaned = phone.replace(/\D/g, '');
      if (cleaned.length > 0) {
        cleaned = '+' + cleaned;
        if (cleaned.length > 4) {
          cleaned = cleaned.substring(0, 4) + ' ' + cleaned.substring(4);
        }
        if (cleaned.length > 8) {
          cleaned = cleaned.substring(0, 8) + ' ' + cleaned.substring(8);
        }
        if (cleaned.length > 12) {
          cleaned = cleaned.substring(0, 12) + ' ' + cleaned.substring(12);
        }
        if (cleaned.length > 16) {
          cleaned = cleaned.substring(0, 16);
        }
      }
      setPhone(cleaned);
    }
  }, [phone]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let authEmail = '';
      
      if (loginMethod === 'email') {
        authEmail = email;
      } else {
        authEmail = phone.replace(/\s/g, '') + '@phone.admin';
      }

      if (!authEmail || !password) {
        setError('Please enter email/phone and password');
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, authEmail, password);
      const user = userCredential.user;
      
      console.log('Admin logged in:', user.uid);

      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      
      if (adminDoc.exists()) {
        console.log('Admin verified, redirecting to dashboard');
        router.push('/admin/dashboard');
      } else {
        await signOut(auth);
        setError('Access denied. Admin privileges required.');
      }
      
    } catch (err) {
      console.error('Admin login error:', err);
      
      if (err.code === 'auth/user-not-found') {
        setError('Admin account not found');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email/phone format');
      } else {
        setError(`Login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full p-8 bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-gray-400">Restricted access - Admin only</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg">
            ❌ {error}
          </div>
        )}

        {/* Login Method Toggle */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-3 rounded-lg ${loginMethod === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            <FaEnvelope className="inline mr-2" />
            Email
          </button>
          <button
            onClick={() => setLoginMethod('phone')}
            className={`flex-1 py-3 rounded-lg ${loginMethod === 'phone' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            <FaPhone className="inline mr-2" />
            Phone
          </button>
        </div>

        <form onSubmit={handleLogin}>
          {loginMethod === 'email' ? (
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">
                <FaEnvelope className="inline mr-2 text-blue-400" />
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin@example.com"
                required
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">
                <FaPhone className="inline mr-2 text-blue-400" />
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+232 123 456 7890"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Include country code (e.g., +232)
              </p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-300 text-sm mb-2">
              <FaKey className="inline mr-2 text-blue-400" />
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Authenticating...
              </span>
            ) : (
              'Access Admin Dashboard'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            ← Back to Public Site
          </Link>
        </div>

        <div className="mt-8 p-4 bg-gray-900/50 rounded-lg">
          <p className="text-xs text-gray-400 text-center">
            ⚠️ This area is restricted to authorized personnel only.<br/>
            Unauthorized access attempts are logged.
          </p>
        </div>

        {/* TEST LOGOUT BUTTON HAS BEEN REMOVED */}
      </div>
    </div>
  );
}