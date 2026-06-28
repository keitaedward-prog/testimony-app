// lib/useAuth.js
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null); // 'admin', 'field_admin', 'land_admin'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (mounted) setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          if (adminDoc.exists()) {
            const data = adminDoc.data();
            const role = data.role || 'admin'; // default for existing admins
            if (mounted) {
              setIsAdmin(true);
              setAdminRole(role);
            }
          } else {
            if (mounted) {
              setIsAdmin(false);
              setAdminRole(null);
            }
          }
        } catch (error) {
          // Permission denied is expected for non-admins – ignore silently
          if (error.code !== 'permission-denied') {
            console.error('Unexpected error checking admin status:', error);
          }
          if (mounted) {
            setIsAdmin(false);
            setAdminRole(null);
          }
        }
      } else {
        if (mounted) {
          setIsAdmin(false);
          setAdminRole(null);
        }
      }
      
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { user, isAdmin, adminRole, loading };
}