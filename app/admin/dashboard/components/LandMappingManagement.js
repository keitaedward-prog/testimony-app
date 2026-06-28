"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { logAdminAction } from '@/lib/auditLogger';
import Pagination from '@/app/components/Pagination';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

const PAGE_SIZE = 10;

export default function LandMappingManagement() {
  const { adminRole } = useAuth();
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

  // Verify land (only land_admin)
  const handleVerify = async (post) => {
    if (adminRole !== 'land_admin') {
      alert('You are not authorised to verify lands.');
      return;
    }
    const newStatus = post.verified ? 'not_verified' : 'verified';
    try {
      await updateDoc(doc(db, 'testimonies', post.id), {
        verified: newStatus === 'verified',
        verifiedBy: auth.currentUser?.uid,
        updatedAt: new Date()
      });
      await logAdminAction('verify_land', 'land', post.id, { verified: newStatus === 'verified', title: post.title });
      alert(`Land ${newStatus === 'verified' ? 'verified' : 'unverified'}`);
      fetchPosts();
    } catch (error) {
      console.error(error);
      alert('Failed to update verification status');
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
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
          <div
            key={post.id}
            className="bg-gray-700 border border-gray-600 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{post.title || 'Untitled Coordinates'}</h3>
                <p className="text-sm text-gray-300">{formatDate(post.createdAt)}</p>
                <p className="text-sm text-blue-300 mt-1">
                  Posted by: {getUserDisplay(post)}
                </p>
                {post.coordinates?.placeName && (
                  <p className="text-green-300 mt-1">📍 {post.coordinates.placeName}</p>
                )}
                <div className="mt-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    post.verified ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
                  }`}>
                    {post.verified ? '✅ Verified' : '⏳ Not Verified'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  href={`/post/${post.id}?admin=true`}
                  className="text-blue-400 hover:text-blue-300 text-sm mr-2 underline"
                >
                  View Details →
                </Link>
                {/* Verify button – only land_admin */}
                {adminRole === 'land_admin' && (
                  <button
                    onClick={() => handleVerify(post)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      post.verified
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {post.verified ? 'Unverify' : 'Verify'}
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="mt-2 text-gray-200">{post.description || 'No description'}</p>

            {/* Coordinates */}
            {post.coordinates && (
              <div className="mt-2 text-sm text-gray-300">
                <p>Latitude: {post.coordinates.latitude?.toFixed(6)}</p>
                <p>Longitude: {post.coordinates.longitude?.toFixed(6)}</p>
              </div>
            )}

            {/* Corners count */}
            {post.fourCorners && (
              <div className="mt-2 text-sm text-purple-300">
                <p className="font-medium">Corners: {post.fourCorners.length}</p>
              </div>
            )}

            {/* Documents */}
            {post.documents && post.documents.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-white">📎 Documents:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {post.documents.map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline text-sm bg-gray-800 px-2 py-1 rounded"
                    >
                      📄 Document {idx+1}
                    </a>
                  ))}
                </div>
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