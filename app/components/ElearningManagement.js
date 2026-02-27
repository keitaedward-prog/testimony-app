// app/components/ElearningManagement.js
"use client";

import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, startAfter 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '@/lib/firebase';
import { logAdminAction } from '@/lib/auditLogger';
import Pagination from '@/app/components/Pagination';

const PAGE_SIZE = 10;

export default function ElearningManagement() {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('text');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [uploading, setUploading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchPosts(true);
  }, []);

  useEffect(() => {
    let filtered = posts;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = posts.filter(p => 
        p.title?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }
    setFilteredPosts(filtered);
    setCurrentPage(1);
  }, [searchTerm, posts]);

  useEffect(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    setDisplayedPosts(filteredPosts.slice(start, end));
    setTotalPages(Math.ceil(filteredPosts.length / PAGE_SIZE));
  }, [filteredPosts, currentPage]);

  const fetchPosts = async (reset = false) => {
    setLoading(true);
    try {
      let q = query(collection(db, 'eLearning'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (reset) {
        setPosts(fetched);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } else {
        setPosts(prev => [...prev, ...fetched]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error('Error fetching e-learning posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > 500 * 1024 * 1024) { // 500MB
      alert('File too large (max 500MB)');
      return;
    }
    setFile(selected);
    if (type === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result);
      reader.readAsDataURL(selected);
    } else {
      setFilePreview('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) {
      alert('Title and description are required');
      return;
    }
    setUploading(true);
    try {
      let mediaUrl = '';
      if (file) {
        const storageRef = ref(storage, `eLearning/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        mediaUrl = await getDownloadURL(storageRef);
      }

      const postData = {
        title,
        description,
        type,
        mediaUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
        postedBy: auth.currentUser?.uid,
      };

      if (editingPost) {
        await updateDoc(doc(db, 'eLearning', editingPost.id), postData);
        await logAdminAction('update_elearning', 'elearning', editingPost.id, { title });
        alert('Updated successfully');
      } else {
        const docRef = await addDoc(collection(db, 'eLearning'), postData);
        await logAdminAction('create_elearning', 'elearning', docRef.id, { title });
        alert('Created successfully');
      }

      // Reset form
      setShowForm(false);
      setEditingPost(null);
      setTitle('');
      setDescription('');
      setType('text');
      setFile(null);
      setFilePreview('');
      fetchPosts(true);
    } catch (error) {
      console.error('Error saving e-learning post:', error);
      alert('Failed to save');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (post) => {
    if (confirm('Delete this e-learning post?')) {
      try {
        await deleteDoc(doc(db, 'eLearning', post.id));
        await logAdminAction('delete_elearning', 'elearning', post.id, { title: post.title });
        fetchPosts(true);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setTitle(post.title);
    setDescription(post.description);
    setType(post.type);
    setFile(null);
    setFilePreview('');
    setShowForm(true);
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString();
  };

  if (loading && posts.length === 0) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">E‑Learning Management</h2>
        <button onClick={() => { setShowForm(!showForm); setEditingPost(null); setTitle(''); setDescription(''); setType('text'); setFile(null); }} className="px-4 py-2 bg-blue-600 text-white rounded">
          {showForm ? 'Cancel' : '➕ New Post'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4">{editingPost ? 'Edit Post' : 'Create New Post'}</h3>
          <div className="mb-4">
            <label className="block mb-2">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 bg-gray-700 rounded" required />
          </div>
          <div className="mb-4">
            <label className="block mb-2">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 bg-gray-700 rounded" rows="3" required />
          </div>
          <div className="mb-4">
            <label className="block mb-2">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2 bg-gray-700 rounded">
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="document">Document</option> {/* New option */}
            </select>
          </div>
          {type !== 'text' && (
            <div className="mb-4">
              <label className="block mb-2">Upload File</label>
              <input 
                type="file" 
                onChange={handleFileChange} 
                accept={
                  type === 'image' ? 'image/*' :
                  type === 'audio' ? 'audio/*' :
                  type === 'video' ? 'video/*' :
                  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt' // for documents
                } 
                className="w-full p-2 bg-gray-700 rounded" 
              />
              {filePreview && <img src={filePreview} alt="Preview" className="mt-2 max-h-48 rounded" />}
            </div>
          )}
          <div className="flex space-x-4">
            <button type="submit" disabled={uploading} className="px-6 py-2 bg-green-600 text-white rounded">{uploading ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-600 text-white rounded">Cancel</button>
          </div>
        </form>
      )}

      <div className="mb-6">
        <input type="text" placeholder="Search posts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded" />
      </div>

      <div className="space-y-4">
        {displayedPosts.map(post => (
          <div key={post.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{post.title}</h3>
                <p className="text-sm text-gray-400">{formatDate(post.createdAt)}</p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleEdit(post)} className="px-3 py-1 bg-blue-600 rounded">Edit</button>
                <button onClick={() => handleDelete(post)} className="px-3 py-1 bg-red-600 rounded">Delete</button>
              </div>
            </div>
            <p className="mt-2 text-gray-300">{post.description}</p>
            {post.mediaUrl && (
              <div className="mt-2">
                {post.type === 'image' && <img src={post.mediaUrl} alt={post.title} className="max-h-60 rounded" />}
                {post.type === 'audio' && <audio controls src={post.mediaUrl} className="w-full" />}
                {post.type === 'video' && <video controls src={post.mediaUrl} className="w-full max-h-60" />}
                {post.type === 'document' && (
                  <div className="mt-2">
                    <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      📄 View Document
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPosts.length}
          itemsPerPage={PAGE_SIZE}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-8"
        />
      )}
    </div>
  );
}