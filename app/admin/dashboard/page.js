// app/admin/dashboard/page.js
"use client";

import AuditLogs from './components/AuditLogs';
import LandMappingManagement from './components/LandMappingManagement';
import ElearningManagement from './components/ElearningManagement';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  setDoc 
} from 'firebase/firestore';
import AdminSidebar from './components/AdminSidebar';
import PostsManagement from './components/PostsManagement';
import UsersManagement from './components/UsersManagement';
import ReportsDashboard from './components/ReportsDashboard';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Store Firestore user data
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalPosts: 0,
    pendingPosts: 0,
    totalUsers: 0,
    recentActivity: 0
  });

  // Check auth and admin status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/admin/login');
        return;
      }
      
      setUser(currentUser);
      
      try {
        // Check if user is admin
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        if (adminDoc.exists()) {
          setIsAdmin(true);
          
          // Fetch user's profile from users collection
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          }
          
          fetchDashboardStats();
        } else {
          // Not an admin, redirect
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Admin check error:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchDashboardStats = async () => {
    try {
      // Get total posts
      const postsQuery = query(collection(db, 'testimonies'));
      const postsSnapshot = await getDocs(postsQuery);
      
      // Get pending posts
      const pendingPosts = postsSnapshot.docs.filter(
        doc => doc.data().status === 'pending'
      ).length;

      // Get total users (from authentication, we need to store them separately)
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);

      setStats({
        totalPosts: postsSnapshot.size,
        pendingPosts,
        totalUsers: usersSnapshot.size,
        recentActivity: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Verifying admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Access denied. Admins only.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Top Navigation Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">🔐 Admin Dashboard</h1>
            <div className="text-sm text-gray-400">
              Logged in as: 
              <span className="font-medium ml-1">
                {userProfile ? (
                  <>
                    {userProfile.firstName} {userProfile.lastName} 
                    <span className="text-gray-500 ml-1">({user?.phoneNumber || user?.email})</span>
                  </>
                ) : (
                  user?.email || user?.phoneNumber
                )}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Quick Stats Overview */}
          {activeTab === 'overview' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <div className="text-3xl font-bold text-blue-400">{stats.totalPosts}</div>
                  <div className="text-gray-400 mt-2">Total Posts</div>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <div className="text-3xl font-bold text-yellow-400">{stats.pendingPosts}</div>
                  <div className="text-gray-400 mt-2">Pending Approval</div>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <div className="text-3xl font-bold text-green-400">{stats.totalUsers}</div>
                  <div className="text-gray-400 mt-2">Total Users</div>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <div className="text-3xl font-bold text-purple-400">{stats.recentActivity}</div>
                  <div className="text-gray-400 mt-2">Recent Activity</div>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Content Based on Tab */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            {activeTab === 'posts' && <PostsManagement />}
            {activeTab === 'users' && <UsersManagement />}
            {activeTab === 'reports' && <ReportsDashboard />}
            {activeTab === 'audit' && <AuditLogs />}
            {activeTab === 'landmapping' && <LandMappingManagement />}
            {activeTab === 'elearning' && <ElearningManagement />}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>
                <p>Settings content goes here...</p>
              </div>
            )}
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
                <p className="text-gray-400">Quick actions and recent notifications will appear here.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}