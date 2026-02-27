// app/dashboard/page.js
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import Link from 'next/link';
import Pagination from '@/app/components/Pagination';

// Helper function to normalize phone numbers
const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '232' + normalized.substring(1);
  }
  return '+' + normalized;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allPosts, setAllPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // 1. CHECK AUTH AND FETCH USER PROFILE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🔐 Auth state changed:', currentUser ? 'User logged in' : 'No user');
      
      if (currentUser) {
        setUser(currentUser);
        const phone = currentUser.phoneNumber || '';
        const normalizedPhone = normalizePhoneNumber(phone);
        setUserPhoneNumber(normalizedPhone);
        
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          } else {
            // If user document doesn't exist, create a minimal one
            const minimalProfile = {
              uid: currentUser.uid,
              phone: normalizedPhone,
              firstName: currentUser.displayName?.split(' ')[0] || 'User',
              lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || '',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            setUserProfile(minimalProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
        
        console.log('📱 Phone details:', { original: phone, normalized: normalizedPhone });
      } else {
        console.log('❌ No user, redirecting to login...');
        router.push('/login');
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [router]);

  // 2. FETCH POSTS when user and phone number are available
  useEffect(() => {
    if (user && userPhoneNumber) {
      console.log('🚀 User and phone ready, fetching posts...');
      fetchUserPosts(userPhoneNumber);
    }
  }, [user, userPhoneNumber]);

  // 3. FILTER POSTS based on active tab and search term
  useEffect(() => {
    // First filter by status tab
    let filtered = allPosts;
    if (activeTab === 'approved') filtered = allPosts.filter(p => p.status === 'approved');
    if (activeTab === 'pending') filtered = allPosts.filter(p => p.status === 'pending');
    
    // Then filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(post => 
        post.title?.toLowerCase().includes(term) ||
        post.description?.toLowerCase().includes(term) ||
        post.content?.toLowerCase().includes(term) ||
        post.location?.placeName?.toLowerCase().includes(term) ||
        post.coordinates?.placeName?.toLowerCase().includes(term) ||
        post.type?.toLowerCase().includes(term) ||
        post.id?.toLowerCase().includes(term)
      );
    }
    
    setFilteredPosts(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allPosts, activeTab, searchTerm]);

  // 4. UPDATE DISPLAYED POSTS when pagination or filtered posts change
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredPosts.slice(startIndex, endIndex);
    
    setDisplayedPosts(paginated);
    setTotalPages(Math.ceil(filteredPosts.length / itemsPerPage));
  }, [filteredPosts, currentPage, itemsPerPage]);

  // 5. FETCH USER'S POSTS FROM FIRESTORE
  const fetchUserPosts = async (phoneNumber) => {
    if (!phoneNumber) {
      console.error('❌ No phone number to fetch posts');
      setAllPosts([]);
      return;
    }
    
    console.log('🔍 Fetching posts for phone:', phoneNumber);
    
    try {
      // Try querying by userPhone
      const q = query(
        collection(db, 'testimonies'),
        where('userPhone', '==', phoneNumber)
      );
      
      const querySnapshot = await getDocs(q);
      const postsArray = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        postsArray.push({
          id: doc.id,
          ...data
        });
      });
      
      console.log(`📊 Found ${postsArray.length} posts via userPhone`);
      
      if (postsArray.length > 0) {
        postsArray.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
        setAllPosts(postsArray);
        return;
      }
      
      // If no posts found, try userId
      if (user?.uid) {
        const q2 = query(
          collection(db, 'testimonies'),
          where('userId', '==', user.uid)
        );
        
        const querySnapshot2 = await getDocs(q2);
        const postsArray2 = [];
        
        querySnapshot2.forEach((doc) => {
          const data = doc.data();
          postsArray2.push({
            id: doc.id,
            ...data
          });
        });
        
        console.log(`📊 Found ${postsArray2.length} posts via userId`);
        
        if (postsArray2.length > 0) {
          postsArray2.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
          });
          setAllPosts(postsArray2);
          return;
        }
      }
      
      // If still no posts, set empty array
      setAllPosts([]);
      
    } catch (error) {
      console.error('❌ Error fetching posts:', error);
      setAllPosts([]);
    }
  };

  // 6. REFRESH POSTS
  const refreshPosts = () => {
    if (userPhoneNumber) {
      console.log('🔄 Manually refreshing posts...');
      fetchUserPosts(userPhoneNumber);
      setCurrentPage(1);
    }
  };

  // 7. HANDLE POST DELETION (only for pending posts)
  const handleDeletePost = async (postId, postStatus) => {
    if (postStatus !== 'pending') {
      alert('You can only delete posts that are pending approval.');
      return;
    }

    if (confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteDoc(doc(db, 'testimonies', postId));
        alert('Post deleted successfully!');
        refreshPosts();
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
      }
    }
  };

  // 8. HANDLE POST EDITING (only for pending posts, NOT for coordinate posts)
  const handleEditPost = (post) => {
    if (post.type === 'coordinates') {
      alert('Coordinate posts cannot be edited. You can only delete them if they are still pending.');
      return;
    }
    
    if (post.status !== 'pending') {
      alert('You can only edit posts that are pending approval.');
      return;
    }
    setEditingPost(post.id);
    setEditTitle(post.title || '');
    setEditDescription(post.description || '');
  };

  const handleSaveEdit = async (postId) => {
    try {
      await updateDoc(doc(db, 'testimonies', postId), {
        title: editTitle,
        description: editDescription,
        updatedAt: new Date()
      });
      setEditingPost(null);
      alert('Post updated successfully!');
      refreshPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
  };

  // 9. HANDLE PAGE CHANGE
  const handlePageChange = (page, newItemsPerPage = itemsPerPage) => {
    setCurrentPage(page);
    if (newItemsPerPage !== itemsPerPage) {
      setItemsPerPage(newItemsPerPage);
    }
  };

  // 10. COUNT POSTS BY STATUS
  const approvedCount = allPosts.filter(p => p.status === 'approved').length;
  const pendingCount = allPosts.filter(p => p.status === 'pending').length;
  const rejectedCount = allPosts.filter(p => p.status === 'rejected').length;

  // 11. FORMAT DATE
  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // 12. GET POST TYPE ICON
  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'audio': return '🎤';
      case 'video': return '🎥';
      case 'coordinates': return '📍';
      default: return '📝';
    }
  };

  // 13. SHOW LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading your dashboard...</div>
      </div>
    );
  }

  // 14. MAIN DASHBOARD UI
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* HEADER */}
      <header className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Welcome back! Here you can manage all your testimonies and coordinates.
            </p>
            {user && (
              <div className="mt-3 space-y-1">
                <p className="text-sm text-gray-500">
                  Logged in as: 
                  <span className="font-medium ml-1">
                    {userProfile ? (
                      <>
                        {userProfile.firstName} {userProfile.lastName} 
                        <span className="text-gray-400 ml-1">({user.phoneNumber})</span>
                      </>
                    ) : (
                      user.phoneNumber
                    )}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  User ID: <span className="font-mono">{user.uid.substring(0, 10)}...</span>
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => signOut(auth).then(() => router.push('/login'))}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              Logout
            </button>
            <button
              onClick={refreshPosts}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Refresh Posts
            </button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: QUICK ACTIONS & STATS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="space-y-4">
              <Link
                href="/add-testimony"
                className="block w-full p-4 text-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                ➕ Add New Testimony
              </Link>
              <Link
                href="/map-land-here"
                className="block w-full p-4 text-center bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                🗺️ Map Land Here
              </Link>
            </div>
          </div>

          {/* User Stats Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Your Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Posts:</span>
                <span className="font-bold">{allPosts.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Testimonies:</span>
                <span className="font-bold text-blue-600">{allPosts.filter(p => p.type !== 'coordinates').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Coordinates:</span>
                <span className="font-bold text-green-600">{allPosts.filter(p => p.type === 'coordinates').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Approved:</span>
                <span className="font-bold text-green-600">{approvedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-bold text-yellow-600">{pendingCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Rejected:</span>
                <span className="font-bold text-red-600">{rejectedCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: USER'S POSTS */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-wrap justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Your Posts</h2>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                <button
                  onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  All ({allPosts.length})
                </button>
                <button
                  onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg ${activeTab === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg ${activeTab === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
                >
                  Pending ({pendingCount})
                </button>
              </div>
            </div>

            {/* 🔍 SEARCH INPUT */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search your posts by title, description, location, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {filteredPosts.length} of {allPosts.length} posts shown
              </p>
            </div>

            {/* Pagination Stats */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="text-sm text-blue-800">
                  Showing {displayedPosts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredPosts.length)} of {filteredPosts.length} posts
                  {activeTab !== 'all' && ` (filtered from ${allPosts.length} total)`}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* POSTS LIST */}
            {displayedPosts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">
                  {searchTerm ? '🔍' : activeTab === 'approved' ? '✅' : activeTab === 'pending' ? '⏳' : '📝'}
                </div>
                <h3 className="text-xl font-medium mb-2">
                  {searchTerm
                    ? 'No matching posts'
                    : activeTab === 'approved' ? 'No approved posts yet' :
                      activeTab === 'pending' ? 'No pending posts' :
                      'No posts yet'}
                </h3>
                <p className="mb-6">
                  {searchTerm
                    ? 'Try a different search term'
                    : activeTab === 'approved' ? 'Your approved posts will appear here.' :
                      activeTab === 'pending' ? 'Posts waiting for admin approval will appear here.' :
                      'Start sharing your testimonies or coordinates!'}
                </p>
                {!searchTerm && (
                  <Link
                    href="/add-testimony"
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Post
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {displayedPosts.map((post) => (
                    <div key={post.id} className="border rounded-lg p-6 hover:shadow-md transition">
                      {/* POST HEADER */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          {editingPost === post.id ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="text-xl font-bold w-full p-2 border rounded mb-2"
                              placeholder="Post title"
                            />
                          ) : (
                            <h3 className="text-xl font-bold">
                              {getTypeIcon(post.type)} {post.title || 'Untitled Testimony'}
                            </h3>
                          )}
                          <div className="flex flex-wrap items-center mt-2 gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              post.status === 'approved' ? 'bg-green-100 text-green-800' :
                              post.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {post.status?.charAt(0).toUpperCase() + post.status?.slice(1)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDate(post.createdAt)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              post.type === 'coordinates' 
                                ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {post.type === 'coordinates' ? '📍 COORDINATES' : post.type?.charAt(0).toUpperCase() + post.type?.slice(1)}
                              {post.type === 'coordinates' && (
                                <span className="ml-1 text-xs text-purple-600">(Read-only)</span>
                              )}
                            </span>
                            {post.location && post.type !== 'coordinates' && (
                              <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                                📍 {post.location.placeName}
                              </span>
                            )}
                            {post.coordinates && post.type === 'coordinates' && (
                              <span className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                📍 {post.coordinates.placeName}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* ACTION BUTTONS */}
                        {post.status === 'pending' && (
                          <div className="flex space-x-2">
                            {post.type === 'coordinates' ? (
                              // Coordinate posts: Delete only
                              <button
                                onClick={() => handleDeletePost(post.id, post.status)}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                              >
                                Delete
                              </button>
                            ) : editingPost === post.id ? (
                              // Regular posts in edit mode
                              <>
                                <button
                                  onClick={() => handleSaveEdit(post.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              // Regular posts in view mode
                              <>
                                <button
                                  onClick={() => handleEditPost(post)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePost(post.id, post.status)}
                                  className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* POST CONTENT */}
                      {editingPost === post.id ? (
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full p-3 border rounded h-40 mb-4"
                          placeholder="Post description"
                        />
                      ) : (
                        <p className="text-gray-700 mb-4">{post.description}</p>
                      )}

                      {/* MEDIA PREVIEW */}
                      {post.mediaUrl && post.type !== 'text' && post.type !== 'coordinates' && (
                        <div className="mt-4">
                          {post.type === 'image' && (
                            <img 
                              src={post.mediaUrl} 
                              alt={post.title} 
                              className="max-w-full h-48 object-cover rounded-lg"
                            />
                          )}
                          {post.type === 'audio' && (
                            <div className="p-4 bg-gray-100 rounded-lg">
                              <p className="mb-2">🎤 Audio Testimony</p>
                              <audio controls className="w-full">
                                <source src={post.mediaUrl} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          )}
                          {post.type === 'video' && (
                            <div className="p-4 bg-gray-100 rounded-lg">
                              <p className="mb-2">🎥 Video Testimony</p>
                              <video controls className="w-full max-h-96">
                                <source src={post.mediaUrl} type="video/mp4" />
                                Your browser does not support the video element.
                              </video>
                            </div>
                          )}
                        </div>
                      )}

                      {/* POST FOOTER */}
                      <div className="mt-6 pt-4 border-t flex justify-between items-center">
                        <div>
                          <Link
                            href={`/post/${post.id}?userId=${encodeURIComponent(user?.uid || '')}&userPhone=${encodeURIComponent(userPhoneNumber || '')}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View Details →
                          </Link>
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: <span className="font-mono">{post.id.substring(0, 10)}...</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination Component */}
                <div className="mt-8">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredPosts.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    showInfo={false}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-12 pt-8 border-t text-center text-gray-600 text-sm">
        <div className="flex justify-center space-x-6 mb-4">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <Link href="/add-testimony" className="hover:text-blue-600">Add Testimony</Link>
          <Link href="/map-land-here" className="hover:text-blue-600">Map Land Here</Link>
        </div>
        <p>© 2026 Testimony App. All rights reserved. - Manage Your Content</p>
      </footer>
    </div>
  );
}