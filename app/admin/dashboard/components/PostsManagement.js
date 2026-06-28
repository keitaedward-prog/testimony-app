// app/admin/dashboard/components/PostsManagement.js
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase'; // <-- Added auth
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
import { useAuth } from '@/lib/useAuth';

export default function PostsManagement() {
  const { adminRole } = useAuth();
  const [allPosts, setAllPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending', 'field_approved', 'approved', 'rejected', 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [categoryModalPost, setCategoryModalPost] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('testimony');
  const [approvalModalPost, setApprovalModalPost] = useState(null);
  const [editModalPost, setEditModalPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [rejectionModal, setRejectionModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

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
        post.userName?.toLowerCase().includes(term) ||
        post.userPhone?.toLowerCase().includes(term) ||
        post.location?.placeName?.toLowerCase().includes(term) ||
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

  // ---- Approval logic ----
  const openApprovalModal = (post) => {
    setApprovalModalPost(post);
  };

  // Approve with category: called from modal
  const approveWithCategory = async (category) => {
    const post = approvalModalPost;
    if (!post) return;
    try {
      const updateData = {
        displayCategory: category,
        updatedAt: new Date()
      };
      let action = 'approve_post';
      let details = { title: post.title, category };

      if (adminRole === 'field_admin') {
        // First-level approval
        updateData.status = 'field_approved';
        updateData.fieldApprovedBy = auth.currentUser?.uid;
        action = 'field_approve_post';
      } else if (adminRole === 'admin') {
        // Direct approval (can also approve field_approved)
        updateData.status = 'approved';
        updateData.adminApprovedBy = auth.currentUser?.uid;
        action = 'admin_approve_post';
      } else {
        alert('You are not authorised to approve posts');
        return;
      }

      await updateDoc(doc(db, 'testimonies', post.id), updateData);
      alert(`Post approved as ${category}! (${adminRole})`);
      await logAdminAction(action, 'post', post.id, details);
      setApprovalModalPost(null);
      fetchPosts();
    } catch (error) {
      console.error(error);
      alert('Failed to approve post');
    }
  };

  // ---- Reject logic ----
  const openRejectModal = (post) => {
    setRejectionModal(post);
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejectionModal) return;
    try {
      await updateDoc(doc(db, 'testimonies', rejectionModal.id), {
        status: 'rejected',
        rejectionReason: rejectionReason || '(no reason)',
        rejectedBy: auth.currentUser?.uid,
        updatedAt: new Date()
      });
      alert('Post rejected!');
      await logAdminAction('reject_post', 'post', rejectionModal.id, { title: rejectionModal.title, reason: rejectionReason });
      setRejectionModal(null);
      fetchPosts();
    } catch (error) {
      console.error(error);
      alert('Failed to reject post');
    }
  };

  // ---- Edit pending post ----
  const openEditModal = (post) => {
    setEditModalPost(post);
    setEditTitle(post.title || '');
    setEditDescription(post.description || '');
  };

  const saveEdit = async () => {
    if (!editModalPost) return;
    try {
      await updateDoc(doc(db, 'testimonies', editModalPost.id), {
        title: editTitle,
        description: editDescription,
        updatedAt: new Date()
      });
      alert('Post updated successfully!');
      await logAdminAction('edit_pending_post', 'post', editModalPost.id, { 
        oldTitle: editModalPost.title, newTitle: editTitle,
        oldDescription: editModalPost.description, newDescription: editDescription
      });
      setEditModalPost(null);
      fetchPosts();
    } catch (error) {
      console.error(error);
      alert('Failed to update post');
    }
  };

  // ---- Delete ----
  const handleDelete = async (post) => {
    if (!confirm('Permanently delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'testimonies', post.id));
      alert('Post deleted!');
      await logAdminAction('delete_post', 'post', post.id, { title: post.title });
      fetchPosts();
    } catch (error) {
      console.error(error);
      alert('Failed to delete post');
    }
  };

  // ---- Category edit for approved posts ----
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
      await logAdminAction('edit_category', 'post', categoryModalPost.id, { oldCategory: categoryModalPost.displayCategory, newCategory: selectedCategory });
      setCategoryModalPost(null);
      fetchPosts();
    } catch (error) {
      console.error(error);
      alert('Failed to update category');
    }
  };

  // Toggle expand
  const toggleExpand = (postId) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  // Utilities
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
      field_approved: 'bg-blue-500 text-white',
      approved: 'bg-green-500 text-white',
      rejected: 'bg-red-500 text-white'
    };
    return <span className={`px-3 py-1 rounded-full text-sm ${styles[status] || 'bg-gray-500'}`}>{status?.toUpperCase().replace('_', ' ')}</span>;
  };

  const handlePageChange = (page, newItemsPerPage) => {
    setCurrentPage(page);
    if (newItemsPerPage && newItemsPerPage !== itemsPerPage) {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
    }
  };

  const pendingCount = allPosts.filter(p => p.status === 'pending').length;
  const fieldApprovedCount = allPosts.filter(p => p.status === 'field_approved').length;
  const approvedCount = allPosts.filter(p => p.status === 'approved').length;
  const rejectedCount = allPosts.filter(p => p.status === 'rejected').length;

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Posts Management</h2>
        <div className="flex space-x-4">
          <div className="flex space-x-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-700'}`}>All ({allPosts.length})</button>
            <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-yellow-600' : 'bg-gray-700'}`}>Pending ({pendingCount})</button>
            <button onClick={() => setFilter('field_approved')} className={`px-4 py-2 rounded ${filter === 'field_approved' ? 'bg-blue-600' : 'bg-gray-700'}`}>Field Approved ({fieldApprovedCount})</button>
            <button onClick={() => setFilter('approved')} className={`px-4 py-2 rounded ${filter === 'approved' ? 'bg-green-600' : 'bg-gray-700'}`}>Approved ({approvedCount})</button>
            <button onClick={() => setFilter('rejected')} className={`px-4 py-2 rounded ${filter === 'rejected' ? 'bg-red-600' : 'bg-gray-700'}`}>Rejected ({rejectedCount})</button>
          </div>
          <button onClick={fetchPosts} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">Refresh</button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Search posts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
        />
        <p className="text-sm text-gray-400 mt-2">{filteredPosts.length} of {allPosts.length} posts shown</p>
      </div>

      {/* Stats */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg grid grid-cols-5 gap-4 text-center">
        <div><div className="text-2xl font-bold">{allPosts.length}</div><div className="text-sm text-gray-400">Total</div></div>
        <div><div className="text-2xl font-bold text-yellow-400">{pendingCount}</div><div className="text-sm text-gray-400">Pending</div></div>
        <div><div className="text-2xl font-bold text-blue-400">{fieldApprovedCount}</div><div className="text-sm text-gray-400">Field Approved</div></div>
        <div><div className="text-2xl font-bold text-green-400">{approvedCount}</div><div className="text-sm text-gray-400">Approved</div></div>
        <div><div className="text-2xl font-bold text-red-400">{rejectedCount}</div><div className="text-sm text-gray-400">Rejected</div></div>
      </div>

      {/* Posts list */}
      {displayedPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No posts found</div>
      ) : (
        <>
          <div className="space-y-6">
            {displayedPosts.map((post) => (
              <div key={post.id} className="bg-gray-700 border border-gray-600 rounded-xl overflow-hidden shadow-md">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        {getTypeIcon(post.type)} {post.title || 'Untitled'}
                        {post.status === 'field_approved' && <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded">⏳ Awaiting Admin</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="text-sm">By: {post.userName || post.userPhone}</div>
                        <div className="text-sm text-gray-400">📅 {formatDate(post.createdAt)}</div>
                        {post.status === 'approved' && post.displayCategory && (
                          <span className={`px-2 py-1 rounded-full text-xs ${post.displayCategory === 'case' ? 'bg-indigo-600' : 'bg-gray-500'}`}>
                            {post.displayCategory === 'case' ? '📂 CASE' : '📝 TESTIMONY'}
                          </span>
                        )}
                        {post.status === 'rejected' && post.rejectionReason && (
                          <span className="text-xs text-red-400">Reason: {post.rejectionReason}</span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(post.status)}
                  </div>

                  <p className="text-gray-300 mb-2">{post.description || 'No description.'}</p>

                  {/* Actions */}
                  <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-700">
                    <div className="text-xs text-gray-500">{post.mediaUrl ? 'Has media' : 'No media'}</div>
                    <div className="flex space-x-3">
                      {/* Pending posts: field_admin or admin can approve/reject */}
                      {post.status === 'pending' && (
                        <>
                          {(adminRole === 'field_admin' || adminRole === 'admin') && (
                            <>
                              <button onClick={() => openApprovalModal(post)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium">✅ Approve</button>
                              <button onClick={() => openRejectModal(post)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium">❌ Reject</button>
                            </>
                          )}
                          <button onClick={() => openEditModal(post)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">✏️ Edit</button>
                        </>
                      )}
                      {/* field_approved: only admin can approve or reject (second level) */}
                      {post.status === 'field_approved' && adminRole === 'admin' && (
                        <>
                          <button onClick={() => openApprovalModal(post)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium">✅ Approve</button>
                          <button onClick={() => openRejectModal(post)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium">❌ Reject</button>
                        </>
                      )}
                      {/* Approved posts: admin can edit category */}
                      {post.status === 'approved' && adminRole === 'admin' && (
                        <button onClick={() => openEditCategoryModal(post)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium">🏷️ Edit Category</button>
                      )}
                      {/* Delete: only admin */}
                      {adminRole === 'admin' && (
                        <button onClick={() => handleDelete(post)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium">🗑️ Delete</button>
                      )}
                      <button onClick={() => toggleExpand(post.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                        {expandedPostId === post.id ? '▲ Collapse' : '▼ Expand'}
                      </button>
                    </div>
                  </div>

                  {expandedPostId === post.id && (
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                      <h4 className="font-bold mb-4">Detailed Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><div className="text-gray-400">Created</div><div>{formatDate(post.createdAt)}</div></div>
                        <div><div className="text-gray-400">Last Updated</div><div>{formatDate(post.updatedAt)}</div></div>
                        <div><div className="text-gray-400">File Name</div><div>{post.fileName || 'None'}</div></div>
                        <div><div className="text-gray-400">Media URL</div><div>{post.mediaUrl ? <a href={post.mediaUrl} target="_blank" className="text-blue-400 hover:underline">View</a> : 'None'}</div></div>
                        {post.rejectionReason && <div className="col-span-2"><div className="text-gray-400">Rejection Reason</div><div className="text-red-300">{post.rejectionReason}</div></div>}
                        {post.fieldApprovedBy && <div className="col-span-2"><div className="text-gray-400">Field Approved By</div><div className="text-blue-300">{post.fieldApprovedBy}</div></div>}
                        {post.adminApprovedBy && <div className="col-span-2"><div className="text-gray-400">Admin Approved By</div><div className="text-green-300">{post.adminApprovedBy}</div></div>}
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

      {/* Approval Modal */}
      {approvalModalPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">Approve Post</h3>
            <p className="mb-4">Select category:</p>
            <button onClick={() => approveWithCategory('testimony')} className="w-full py-2 bg-green-600 hover:bg-green-700 rounded font-medium mb-2">📝 Testimony</button>
            <button onClick={() => approveWithCategory('case')} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium mb-2">📂 Case</button>
            <button onClick={() => setApprovalModalPost(null)} className="w-full py-2 bg-gray-600 hover:bg-gray-500 rounded font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Edit Pending Post Modal */}
      {editModalPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Edit Pending Post</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Title</label>
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} className="w-full p-2 bg-gray-700 border border-gray-600 rounded" />
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setEditModalPost(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Reject Post</h3>
            <p className="mb-2">Post: {rejectionModal.title}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <input type="text" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter reason" className="w-full p-2 bg-gray-700 border border-gray-600 rounded" />
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setRejectionModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={confirmReject} className="px-4 py-2 bg-red-600 rounded">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal (for approved posts) */}
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