// app/admin/dashboard/components/LandMappingManagement.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { logAdminAction } from '@/lib/auditLogger';
import Pagination from '@/app/components/Pagination';
import Link from 'next/link';  // <-- added

const PAGE_SIZE = 10;

export default function LandMappingManagement() {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    let filtered = posts;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = posts.filter(p => 
        p.title?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.coordinates?.placeName?.toLowerCase().includes(term) ||
        p.userName?.toLowerCase().includes(term) ||
        p.userPhone?.toLowerCase().includes(term)
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

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'testimonies'),
        where('type', '==', 'coordinates'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.().toISOString() || null,
      }));
      setPosts(fetched);
    } catch (error) {
      console.error('Error fetching land mapping posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (post) => {
    if (confirm('Delete this land mapping post?')) {
      try {
        await deleteDoc(doc(db, 'testimonies', post.id));
        await logAdminAction('delete_landmapping', 'landmapping', post.id, { title: post.title });
        fetchPosts();
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString();
  };

  const getUserDisplay = (post) => {
    if (post.userName && !post.userName.startsWith('User ')) {
      return `${post.userName} (${post.userPhone || 'No phone'})`;
    }
    return `User ${post.userPhone || 'Unknown'}`;
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Land Mapping Posts</h2>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title, description, place name, or user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded"
        />
      </div>

      <div className="space-y-4">
        {displayedPosts.map(post => (
          <div key={post.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold">{post.title || 'Untitled Coordinates'}</h3>
                <p className="text-sm text-gray-400">{formatDate(post.createdAt)}</p>
                <p className="text-sm text-blue-400 mt-1">
                  Posted by: {getUserDisplay(post)}
                </p>
                {post.coordinates?.placeName && (
                  <p className="text-green-400 mt-1">📍 {post.coordinates.placeName}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  href={`/post/${post.id}?admin=true`}
                  className="text-blue-400 hover:text-blue-300 text-sm mr-2"
                >
                  View Details →
                </Link>
                <button onClick={() => handleDelete(post)} className="px-3 py-1 bg-red-600 rounded">
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-2 text-gray-300">{post.description || 'No description'}</p>
            {post.coordinates && (
              <div className="mt-2 text-sm">
                <p>Latitude: {post.coordinates.latitude?.toFixed(6)}</p>
                <p>Longitude: {post.coordinates.longitude?.toFixed(6)}</p>
              </div>
            )}
            {post.fourCorners && (
              <div className="mt-2">
                <p className="font-bold">Four Corners:</p>
                {post.fourCorners.map((c, i) => (
                  <p key={i} className="text-xs">Corner {i+1}: {c.latitude?.toFixed(6)}, {c.longitude?.toFixed(6)}</p>
                ))}
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