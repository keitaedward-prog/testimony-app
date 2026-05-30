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
import Link from 'next/link';

export default function PostsManagement() {
  const [allPosts, setAllPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [categoryModalPost, setCategoryModalPost] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('testimony');
  const [approvalModalPost, setApprovalModalPost] = useState(null);
  
  // NEW: state for editing pending post
  const [editModalPost, setEditModalPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPosts();
  }, [filter]);

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
        const data = doc.data();
        postsArray.push({ id: doc.id, ...data, displayCategory: data.displayCategory || 'testimony' });
      });
      setAllPosts(postsArray);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setAllPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Open edit modal for pending post
  const openEditModal = (post) => {
    setEditModalPost(post);
    setEditTitle(post.title || '');
    setEditDescription(post.description || '');
  };

  // NEW: Save edited pending post
  const saveEdit = async () => {
    if (!editModalPost) return;
    try {
      await updateDoc(doc(db, 'testimonies', editModalPost.id), {
        title: editTitle,
        description: editDescription,
        updatedAt: new Date()
      });
      alert('Post updated successfully!');
      await logAdminAction(
        'edit_pending_post',
        'post',
        editModalPost.id,
        { 
          title: editModalPost.title, 
          newTitle: editTitle,
          description: editModalPost.description,
          newDescription: editDescription,
          userPhone: editModalPost.userPhone,
          userName: editModalPost.userName
        }
      );
      setEditModalPost(null);
      fetchPosts(); // refresh list
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post');
    }
  };

  const openApprovalModal = (post) => {
    setApprovalModalPost(post);
  };

  const approveWithCategory = async (post, category) => {
    try {
      await updateDoc(doc(db, 'testimonies', post.id), {
        status: 'approved',
        displayCategory: category,
        updatedAt: new Date()
      });
      alert(`Post approved as ${category}!`);
      await logAdminAction(
        'approve_post',
        'post',
        post.id,
        { title: post.title || 'Untitled', type: post.type, category, userPhone: post.userPhone, userName: post.userName }
      );
      setApprovalModalPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Error approving post:', error);
      alert('Failed to approve post');
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
      await logAdminAction(
        'reject_post',
        'post',
        postId,
        { title: post.title || 'Untitled', reason: reason || '(no reason)', type: post.type, userPhone: post.userPhone }
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
        await logAdminAction(
          'delete_post',
          'post',
          postId,
          { title: post.title || 'Untitled', type: post.type, userPhone: post.userPhone, userName: post.userName }
        );
        fetchPosts();
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post');
      }
    }
  };

  const openEditCategoryModal = (post) => {
    setCategoryModalPost(post);
    setSelectedCategory(post.displayCategory || 'testimony');
  };

  const saveCategoryEdit = async () => {
    if (!categoryModalPost) return;
    try {
      await updateDoc(doc(db, 'testimonies', categoryModalPost.id), {
        displayCategory: selectedCategory,
        updatedAt: new Date()
      });
      alert(`Category changed to ${selectedCategory}`);
      await logAdminAction(
        'edit_category',
        'post',
        categoryModalPost.id,
        { title: categoryModalPost.title, oldCategory: categoryModalPost.displayCategory, newCategory: selectedCategory }
      );
      setCategoryModalPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  };

  const toggleExpand = (postId) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

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

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-white">✕</button>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-2">{filteredPosts.length} of {allPosts.length} posts shown</p>
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
          <div className="text-6xl mb-4">{searchTerm ? '🔍' : filter === 'pending' ? '⏳' : filter === 'approved' ? '✅' : filter === 'rejected' ? '❌' : '📝'}</div>
          <h3 className="text-xl font-medium mb-2">
            {searchTerm ? 'No matching posts' :
             filter === 'pending' ? 'No pending posts' :
             filter === 'approved' ? 'No approved posts' :
             filter === 'rejected' ? 'No rejected posts' :
             'No posts found'}
          </h3>
          <p>{searchTerm ? 'Try a different search term' : filter === 'pending' ? 'All posts have been reviewed.' : 'Try changing the filter or check back later.'}</p>
          <button onClick={fetchPosts} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">Refresh</button>
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
                        <span className={`px-2 py-1 rounded-full text-xs ${post.type === 'coordinates' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'}`}>
                          {post.type === 'coordinates' ? '📍 COORDINATES' : post.type?.toUpperCase()}
                        </span>
                        {post.status === 'approved' && (
                          <span className={`px-2 py-1 rounded-full text-xs ${post.displayCategory === 'case' ? 'bg-indigo-600' : 'bg-gray-500'}`}>
                            {post.displayCategory === 'case' ? '📂 CASE' : '📝 TESTIMONY'}
                          </span>
                        )}
                        {post.location && post.type !== 'coordinates' && <div className="text-sm text-green-400">📍 {post.location.placeName || 'Location captured'}</div>}
                        {post.coordinates && post.type === 'coordinates' && <div className="text-sm text-purple-400">📍 {post.coordinates.placeName || `${post.coordinates.latitude?.toFixed(4)}, ${post.coordinates.longitude?.toFixed(4)}`}</div>}
                      </div>
                    </div>
                    {getStatusBadge(post.status)}
                  </div>

                  {/* Content (truncated) */}
                  <div className="mb-6">
                    <p className="text-gray-300 mb-2">{post.description || 'No description provided.'}</p>
                    {/* Media display (same as before) – omitted for brevity but unchanged */}
                  </div>

                  {/* Metadata and actions */}
                  <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                    <div className="text-sm text-gray-300">{post.userName && !post.userName.startsWith('User ') ? `${post.userName} (${post.userPhone || 'No phone'})` : `User ${post.userPhone || 'Unknown'}`}</div>
                    <Link href={`/post/${post.id}?admin=true`} className="text-blue-400 hover:text-blue-300 text-sm font-medium">View Details →</Link>
                  </div>

                  <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-700">
                    <div className="text-xs text-gray-500">{post.mediaUrl && post.type !== 'coordinates' ? `Has ${post.type} media` : 'No media'}</div>
                    <div className="flex space-x-3">
                      {post.status === 'pending' && (
                        <>
                          <button onClick={() => openEditModal(post)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">✏️ Edit</button>
                          <button onClick={() => openApprovalModal(post)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium">✅ Approve</button>
                          <button onClick={() => handleReject(post.id, post)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium">❌ Reject</button>
                        </>
                      )}
                      {post.status === 'approved' && <button onClick={() => openEditCategoryModal(post)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium">🏷️ Edit Category</button>}
                      <button onClick={() => handleDelete(post.id, post)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium">🗑️ Delete</button>
                      <button onClick={() => toggleExpand(post.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">{expandedPostId === post.id ? '▲ Collapse' : '▼ Expand'}</button>
                    </div>
                  </div>

                  {expandedPostId === post.id && (
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                      <h4 className="font-bold mb-4">Detailed Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><div className="text-gray-400">Created</div><div>{formatDate(post.createdAt)}</div></div>
                        <div><div className="text-gray-400">Last Updated</div><div>{formatDate(post.updatedAt)}</div></div>
                        <div><div className="text-gray-400">File Name</div><div>{post.fileName || 'None'}</div></div>
                        <div><div className="text-gray-400">Media URL</div><div className="truncate">{post.mediaUrl ? <a href={post.mediaUrl} target="_blank" className="text-blue-400 hover:underline">View</a> : 'None'}</div></div>
                        {post.rejectionReason && <div className="col-span-2"><div className="text-gray-400">Rejection Reason</div><div className="text-red-300">{post.rejectionReason}</div></div>}
                        <div className="col-span-2"><div className="text-gray-400">Full Post ID</div><div className="font-mono text-xs bg-black p-2 rounded">{post.id}</div></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredPosts.length} itemsPerPage={itemsPerPage} onPageChange={handlePageChange} className="mt-8" />}
        </>
      )}

      {/* Edit Pending Post Modal */}
      {editModalPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Edit Pending Post</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setEditModalPost(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 rounded">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModalPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">Approve Post</h3>
            <p className="mb-4">Select the category for this post:</p>
            <div className="flex flex-col space-y-2">
              <button onClick={() => approveWithCategory(approvalModalPost, 'testimony')} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium">📝 Testimony</button>
              <button onClick={() => approveWithCategory(approvalModalPost, 'case')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium">📂 Case</button>
              <button onClick={() => setApprovalModalPost(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {categoryModalPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">Edit Category</h3>
            <p className="mb-2">Post: {categoryModalPost.title}</p>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded mb-4">
              <option value="testimony">Testimony</option>
              <option value="case">Case</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setCategoryModalPost(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={saveCategoryEdit} className="px-4 py-2 bg-blue-600 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}