// app/admin/dashboard/components/PostsManagement.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  updateDoc, 
  doc,
  deleteDoc,
  where 
} from 'firebase/firestore';
import Pagination from '@/app/components/Pagination';
import { logAdminAction } from '@/lib/auditLogger';

export default function PostsManagement() {
  const [allPosts, setAllPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch posts when filter changes
  useEffect(() => {
    fetchPosts();
  }, [filter]);

  // Apply search filter
  useEffect(() => {
    let filtered = allPosts;
    if (filter !== 'all') {
      filtered = allPosts.filter(p => p.status === filter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(post => 
        post.title?.toLowerCase().includes(term) ||
        post.description?.toLowerCase().includes(term) ||
        post.content?.toLowerCase().includes(term) ||
        post.userName?.toLowerCase().includes(term) ||
        post.userPhone?.toLowerCase().includes(term) ||
        post.location?.placeName?.toLowerCase().includes(term) ||
        post.coordinates?.placeName?.toLowerCase().includes(term) ||
        post.id?.toLowerCase().includes(term)
      );
    }
    setFilteredPosts(filtered);
    setCurrentPage(1);
  }, [searchTerm, allPosts, filter]);

  // Update displayed posts
  useEffect(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    setDisplayedPosts(filteredPosts.slice(start, end));
    setTotalPages(Math.ceil(filteredPosts.length / itemsPerPage));
  }, [filteredPosts, currentPage, itemsPerPage]);

  const fetchPosts = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      let q;
      if (filter === 'all') {
        q = query(
          collection(db, 'testimonies'),
          where('type', 'in', ['text', 'image', 'audio', 'video']),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'testimonies'),
          where('type', 'in', ['text', 'image', 'audio', 'video']),
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
      }
      const querySnapshot = await getDocs(q);
      const postsArray = [];
      querySnapshot.forEach((doc) => {
        postsArray.push({ id: doc.id, ...doc.data() });
      });
      setAllPosts(postsArray);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setAllPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleApprove = async (postId, post) => {
    if (confirm('Approve this post?')) {
      try {
        await updateDoc(doc(db, 'testimonies', postId), {
          status: 'approved',
          updatedAt: new Date()
        });
        alert('Post approved!');
        
        // Log the action
        await logAdminAction(
          'approve_post',
          'post',
          postId,
          {
            title: post.title || 'Untitled',
            type: post.type,
            userPhone: post.userPhone,
            userName: post.userName
          }
        );
        
        fetchPosts();
      } catch (error) {
        console.error('Error approving post:', error);
        alert('Failed to approve post');
      }
    }
  };

  const handleReject = async (postId, post) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      await updateDoc(doc(db, 'testimonies', postId), {
        status: 'rejected',
        rejectionReason: reason || '',
        updatedAt: new Date()
      });
      alert('Post rejected!');
      
      // Log the action
      await logAdminAction(
        'reject_post',
        'post',
        postId,
        {
          title: post.title || 'Untitled',
          reason: reason || '(no reason)',
          type: post.type,
          userPhone: post.userPhone
        }
      );
      
      fetchPosts();
    } catch (error) {
      console.error('Error rejecting post:', error);
      alert('Failed to reject post');
    }
  };

  const handleDelete = async (postId, post) => {
    if (confirm('Permanently delete this post?')) {
      try {
        await deleteDoc(doc(db, 'testimonies', postId));
        alert('Post deleted!');
        
        // Log the action
        await logAdminAction(
          'delete_post',
          'post',
          postId,
          {
            title: post.title || 'Untitled',
            type: post.type,
            userPhone: post.userPhone,
            userName: post.userName
          }
        );
        
        fetchPosts();
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post');
      }
    }
  };

  const toggleExpand = (postId) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  // --- UTILITIES ---
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return 'Invalid date'; }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'image': return '🖼️';
      case 'audio': return '🎤';
      case 'video': return '🎥';
      case 'coordinates': return '📍';
      default: return '📝';
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500 text-white',
      approved: 'bg-green-500 text-white',
      rejected: 'bg-red-500 text-white'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm ${styles[status] || 'bg-gray-500'}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  const handlePageChange = (page, newItemsPerPage) => {
    setCurrentPage(page);
    if (newItemsPerPage && newItemsPerPage !== itemsPerPage) {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
    }
  };

  const pendingCount = allPosts.filter(p => p.status === 'pending').length;
  const approvedCount = allPosts.filter(p => p.status === 'approved').length;
  const rejectedCount = allPosts.filter(p => p.status === 'rejected').length;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-xl mb-4">Loading posts...</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header + Filter Buttons */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Posts Management</h2>
        <div className="flex space-x-4">
          <div className="flex space-x-2">
            <button onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-700'}`}>
              All ({allPosts.length})
            </button>
            <button onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-yellow-600' : 'bg-gray-700'}`}>
              Pending ({pendingCount})
            </button>
            <button onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded ${filter === 'approved' ? 'bg-green-600' : 'bg-gray-700'}`}>
              Approved ({approvedCount})
            </button>
            <button onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded ${filter === 'rejected' ? 'bg-red-600' : 'bg-gray-700'}`}>
              Rejected ({rejectedCount})
            </button>
          </div>
          <button onClick={fetchPosts} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
            Refresh
          </button>
        </div>
      </div>

      {/* 🔍 SEARCH INPUT */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search posts by title, description, place name, author, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {filteredPosts.length} of {allPosts.length} posts shown
        </p>
      </div>

      {/* Stats Card */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center"><div className="text-2xl font-bold">{allPosts.length}</div><div className="text-sm text-gray-400">Total</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-yellow-400">{pendingCount}</div><div className="text-sm text-gray-400">Pending</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-green-400">{approvedCount}</div><div className="text-sm text-gray-400">Approved</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-red-400">{rejectedCount}</div><div className="text-sm text-gray-400">Rejected</div></div>
        </div>
      </div>

      {/* Pagination Info */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-300">
            Showing {displayedPosts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredPosts.length)} of {filteredPosts.length} posts
            {filter !== 'all' && ` (filtered from ${allPosts.length} total)`}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">Show:</span>
            <select value={itemsPerPage} onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white">
              <option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      {displayedPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">
            {searchTerm ? '🔍' : filter === 'pending' ? '⏳' : filter === 'approved' ? '✅' : filter === 'rejected' ? '❌' : '📝'}
          </div>
          <h3 className="text-xl font-medium mb-2">
            {searchTerm ? 'No matching posts' :
             filter === 'pending' ? 'No pending posts' :
             filter === 'approved' ? 'No approved posts' :
             filter === 'rejected' ? 'No rejected posts' :
             'No posts found'}
          </h3>
          <p>
            {searchTerm ? 'Try a different search term' :
             filter === 'pending' ? 'All posts have been reviewed.' :
             'Try changing the filter or check back later.'}
          </p>
          <button onClick={fetchPosts} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
            Refresh
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {displayedPosts.map((post) => (
              <div key={post.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        {getTypeIcon(post.type)} {post.title || 'Untitled Testimony'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="text-sm">By: <span className="font-medium">{post.userName || post.userPhone}</span></div>
                        <div className="text-sm text-gray-400">📅 {formatDate(post.createdAt)}</div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          post.type === 'coordinates' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {post.type === 'coordinates' ? '📍 COORDINATES' : post.type?.toUpperCase()}
                          {post.type === 'coordinates' && <span className="ml-1 text-xs">(Immutable)</span>}
                        </span>
                        {post.location && post.type !== 'coordinates' && (
                          <div className="text-sm text-green-400">📍 {post.location.placeName || 'Location captured'}</div>
                        )}
                        {post.coordinates && post.type === 'coordinates' && (
                          <div className="text-sm text-purple-400">
                            📍 {post.coordinates.placeName || `${post.coordinates.latitude?.toFixed(4)}, ${post.coordinates.longitude?.toFixed(4)}`}
                          </div>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(post.status)}
                  </div>

                  {/* Content */}
                  <div className="mb-6">
                    <p className="text-gray-300 mb-2">{post.description || 'No description provided.'}</p>

                    {/* MEDIA DISPLAY */}
                    {post.mediaUrl && post.type !== 'text' && post.type !== 'coordinates' && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Media Content:</h4>
                        {post.type === 'image' && (
                          <div className="border border-gray-700 rounded-lg overflow-hidden">
                            <img src={post.mediaUrl} alt={post.title} className="w-full h-auto max-h-96 object-contain bg-black"
                              onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/1f2937/9ca3af?text=Image+Not+Available'; }} />
                            <div className="p-2 bg-gray-900 text-xs text-gray-400 text-center">Click image to view full size</div>
                          </div>
                        )}
                        {post.type === 'audio' && (
                          <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                            <div className="flex items-center gap-3 mb-3"><span className="text-2xl">🎤</span><span className="font-medium">Audio Testimony</span></div>
                            <audio controls className="w-full">
                              <source src={post.mediaUrl} type="audio/mpeg" />
                              <source src={post.mediaUrl} type="audio/wav" />
                              <source src={post.mediaUrl} type="audio/ogg" />
                            </audio>
                            <div className="mt-2 text-xs text-gray-400">
                              <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Download audio file</a>
                            </div>
                          </div>
                        )}
                        {post.type === 'video' && (
                          <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                            <div className="flex items-center gap-3 mb-3"><span className="text-2xl">🎥</span><span className="font-medium">Video Testimony</span></div>
                            <video controls className="w-full max-h-96 rounded" poster="https://placehold.co/800x450/1f2937/9ca3af?text=Video+Preview">
                              <source src={post.mediaUrl} type="video/mp4" />
                              <source src={post.mediaUrl} type="video/webm" />
                              <source src={post.mediaUrl} type="video/ogg" />
                            </video>
                            <div className="mt-2 text-xs text-gray-400">
                              <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Download video file</a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* LOCATION DETAILS */}
                    {(post.location || post.coordinates) && (
                      <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <span>📍</span> 
                          {post.type === 'coordinates' ? 'Coordinate Location' : 'Location Information'}
                          <span className="text-xs text-gray-400 ml-2">({post.status === 'pending' ? 'Pending' : post.status})</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-gray-400">Place Name</div>
                            <div className="font-medium">
                              {post.type === 'coordinates' 
                                ? post.coordinates?.placeName || 'Not specified' 
                                : post.location?.placeName || 'Not specified'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400">Coordinates</div>
                            <div className="font-mono">
                              {post.type === 'coordinates'
                                ? `${post.coordinates?.latitude?.toFixed(6) || 'N/A'}, ${post.coordinates?.longitude?.toFixed(6) || 'N/A'}`
                                : `${post.location?.latitude?.toFixed(6) || 'N/A'}, ${post.location?.longitude?.toFixed(6) || 'N/A'}`
                              }
                            </div>
                          </div>
                          {(post.coordinates?.accuracy || post.location?.accuracy) && (
                            <div>
                              <div className="text-gray-400">Accuracy</div>
                              <div>~{Math.round(post.type === 'coordinates' ? post.coordinates?.accuracy : post.location?.accuracy)} meters</div>
                            </div>
                          )}
                          {(post.coordinates?.timestamp || post.location?.timestamp) && (
                            <div>
                              <div className="text-gray-400">Captured At</div>
                              <div>{new Date(post.type === 'coordinates' ? post.coordinates?.timestamp : post.location?.timestamp).toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                        {post.type === 'coordinates' && (
                          <div className="mt-3 p-2 bg-purple-900/30 border border-purple-700 rounded">
                            <p className="text-xs text-purple-300">
                              ⚠️ Coordinate posts cannot be edited by anyone. They can only be approved, rejected, or deleted.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <div><span className="text-gray-500">Type:</span> {post.type}{post.type === 'coordinates' && ' (Immutable)'}</div>
                      <div><span className="text-gray-500">User Phone:</span> {post.userPhone}</div>
                      <div><span className="text-gray-500">User ID:</span> <span className="font-mono ml-1">{post.userId?.substring(0, 10)}...</span></div>
                      <div><span className="text-gray-500">Post ID:</span> <span className="font-mono ml-1">{post.id.substring(0, 10)}...</span></div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-700">
                    <div className="text-xs text-gray-500">
                      {post.mediaUrl && post.type !== 'coordinates' ? `Has ${post.type} media` : 'No media'}
                      {post.type === 'coordinates' && <span className="ml-2 text-yellow-500">📍 Cannot be edited by anyone</span>}
                    </div>
                    <div className="flex space-x-3">
                      {post.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(post.id, post)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium">✅ Approve</button>
                          <button onClick={() => handleReject(post.id, post)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium">❌ Reject</button>
                        </>
                      )}
                      <button onClick={() => handleDelete(post.id, post)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium">🗑️ Delete</button>
                      <button onClick={() => toggleExpand(post.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                        {expandedPostId === post.id ? '▲ Collapse' : '▼ Expand'}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS */}
                  {expandedPostId === post.id && (
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                      <h4 className="font-bold mb-4">Detailed Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><div className="text-gray-400">Created</div><div>{formatDate(post.createdAt)}</div></div>
                        <div><div className="text-gray-400">Last Updated</div><div>{formatDate(post.updatedAt)}</div></div>
                        <div><div className="text-gray-400">File Name</div><div>{post.fileName || 'None'}</div></div>
                        <div><div className="text-gray-400">Media URL</div><div className="truncate">
                          {post.mediaUrl ? <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View in browser</a> : 'None'}
                        </div></div>
                        {post.rejectionReason && (
                          <div className="col-span-2"><div className="text-gray-400">Rejection Reason</div><div className="text-red-300">{post.rejectionReason}</div></div>
                        )}
                        <div className="col-span-2"><div className="text-gray-400">Full Post ID</div><div className="font-mono text-xs bg-black p-2 rounded">{post.id}</div></div>
                        {post.type === 'coordinates' && (
                          <div className="col-span-2 p-3 bg-purple-900/30 rounded border border-purple-700">
                            <div className="text-purple-300 font-medium mb-1">⚠️ Immutable Post</div>
                            <div className="text-xs text-purple-200">
                              This is a coordinate post. It cannot be edited by anyone (users or admins). It can only be approved, rejected, or deleted.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredPosts.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                className="mt-8"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}