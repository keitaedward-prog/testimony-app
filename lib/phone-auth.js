// Helper for phone-only authentication

// Create a custom token for phone-only users
export function createPhoneAuthToken(userId, phone) {
  const tokenData = {
    userId: userId,
    phone: phone,
    authMethod: 'phone-only',
    timestamp: Date.now(),
    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  return btoa(JSON.stringify(tokenData));
}

// Verify phone-only auth token
export function verifyPhoneAuthToken(token) {
  try {
    const decoded = JSON.parse(atob(token));
    
    // Check if token is expired
    if (decoded.expires < Date.now()) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('Error verifying phone auth token:', error);
    return null;
  }
}

// Check if user is logged in with phone-only method
export function isPhoneLoggedIn() {
  if (typeof window === 'undefined') return false;
  
  const phoneLogin = localStorage.getItem('phoneLogin');
  const userData = localStorage.getItem('userData');
  
  return phoneLogin === 'true' && userData;
}

// Get phone-only user data
export function getPhoneUserData() {
  if (typeof window === 'undefined') return null;
  
  const userData = localStorage.getItem('userData');
  return userData ? JSON.parse(userData) : null;
}

// Logout phone-only user
export function logoutPhoneUser() {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('phoneLogin');
  localStorage.removeItem('userData');
}