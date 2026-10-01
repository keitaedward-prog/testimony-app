// app/admin/dashboard/page.js
"use client";

import AuditLogs from './components/AuditLogs';
import LandMappingManagement from './components/LandMappingManagement';
import ElearningManagement from './components/ElearningManagement';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, getDoc, doc } from 'firebase/firestore';
import AdminSidebar from './components/AdminSidebar';
import PostsManagement from './components/PostsManagement';
import UsersManagement from './components/UsersManagement';
import ReportsDashboard from './components/ReportsDashboard';
import ThemeToggle from '@/app/components/ThemeToggle';
import { FaBars } from 'react-icons/fa';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalPosts: 0,
    pendingPosts: 0,
    totalUsers: 0,
    recentActivity: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/admin/login');
        return;
      }
      setUser(currentUser);
      try {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        if (adminDoc.exists()) {
          setIsAdmin(true);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) setUserProfile(userDoc.data());
          fetchDashboardStats();
        } else {
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
      const postsSnapshot = await getDocs(query(collection(db, 'testimonies')));
      const pendingPosts = postsSnapshot.docs.filter(d => d.data().status === 'pending').length;
      const usersSnapshot = await getDocs(query(collection(db, 'users')));
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
      <div className="min-h-screen admin-shell flex items-center justify-center">
        <div className="animate-pulse text-xl">Verifying admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen admin-shell flex items-center justify-center">
        <div className="text-xl">Access denied. Admins only.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen admin-shell">
      {/* Top Navigation Bar */}
      <header className="admin-card border-b admin-border px-4 md:px-6 py-3 md:py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg admin-text-muted hover:bg-[var(--admin-hover)] transition"
              aria-label="Open menu"
            >
              <FaBars size={20} />
            </button>
            <h1 className="text-lg md:text-2xl font-bold truncate">🔐 Admin</h1>
            <div className="hidden md:block text-sm admin-text-dim truncate">
              Logged in as:{' '}
              <span className="font-medium admin-text-muted">
                {userProfile
                  ? `${userProfile.firstName} ${userProfile.lastName}`
                  : user?.email || user?.phoneNumber}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm md:text-base text-white font-medium active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />

        <main className="flex-1 p-3 md:p-6 min-w-0 overflow-x-hidden">
          {activeTab === 'overview' && (
            <div className="mb-8 animate-fade-in">
              <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Dashboard Overview</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatCard label="Total Posts" value={stats.totalPosts} color="text-blue-500" />
                <StatCard label="Pending" value={stats.pendingPosts} color="text-yellow-500" />
                <StatCard label="Total Users" value={stats.totalUsers} color="text-green-500" />
                <StatCard label="Recent Activity" value={stats.recentActivity} color="text-purple-500" />
              </div>
            </div>
          )}

          <div className="admin-card rounded-xl border admin-border p-3 md:p-6 animate-fade-in">
            {activeTab === 'posts' && <PostsManagement />}
            {activeTab === 'users' && <UsersManagement />}
            {activeTab === 'reports' && <ReportsDashboard />}
            {activeTab === 'audit' && <AuditLogs />}
            {activeTab === 'landmapping' && <LandMappingManagement />}
            {activeTab === 'elearning' && <ElearningManagement />}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-6">Admin Settings</h2>
                <p className="admin-text-muted">Settings content goes here...</p>
              </div>
            )}
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-6">Recent Activity</h2>
                <p className="admin-text-muted">Quick actions and recent notifications will appear here.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="admin-card p-4 md:p-6 rounded-xl border admin-border transition-all duration-300 hover:scale-[1.03] hover:shadow-lg">
      <div className={`text-2xl md:text-3xl font-bold ${color}`}>{value}</div>
      <div className="admin-text-dim mt-1 md:mt-2 text-xs md:text-sm">{label}</div>
    </div>
  );
}