// app/components/PublicHomeClient.js - FULL CLIENT-SIDE PAGINATION + SEARCH + TABS + FOOTER 2026
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import StaticMap from './StaticMap';
import Pagination from './Pagination';

export default function PublicHomeClient({ initialPosts }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // All posts (server fetched)
  const [allPosts, setAllPosts] = useState(initialPosts.posts || []);
  
  // UI state
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Derived state (filtered + paginated)
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  // 1. Apply tab and search filters whenever dependencies change
  useEffect(() => {
    // First filter by tab
    let filtered = allPosts.filter(post => {
      if (activeTab === 'testimonies') return post.type !== 'coordinates';
      if (activeTab === 'coordinates') return post.type === 'coordinates';
      return true; // 'all'
    });
    
    // Then filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(post => 
        post.title?.toLowerCase().includes(term) ||
        post.description?.toLowerCase().includes(term) ||
        post.content?.toLowerCase().includes(term) ||
        post.userName?.toLowerCase().includes(term) ||
        post.location?.placeName?.toLowerCase().includes(term) ||
        post.coordinates?.placeName?.toLowerCase().includes(term)
      );
    }
    
    setFilteredPosts(filtered);
    setCurrentPage(1); // reset to first page on filter change
  }, [allPosts, activeTab, searchTerm]);

  // 2. Paginate the filtered posts
  useEffect(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    setDisplayedPosts(filteredPosts.slice(start, end));
    setTotalPages(Math.ceil(filteredPosts.length / itemsPerPage));
  }, [filteredPosts, currentPage, itemsPerPage]);

  // 3. Sync URL parameters (optional – for bookmarking)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    params.set('limit', itemsPerPage.toString());
    if (activeTab !== 'all') params.set('tab', activeTab);
    if (searchTerm) params.set('search', searchTerm);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [currentPage, itemsPerPage, activeTab, searchTerm, router]);

  // 4. Read initial URL params on mount
  useEffect(() => {
    const tab = searchParams.get('tab');
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const search = searchParams.get('search');
    
    if (tab && ['all', 'testimonies', 'coordinates'].includes(tab)) {
      setActiveTab(tab);
    }
    if (page) setCurrentPage(parseInt(page));
    if (limit) setItemsPerPage(parseInt(limit));
    if (search) setSearchTerm(search);
  }, [searchParams]);

  // --- Handlers ---
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handlePageChange = (page, newItemsPerPage) => {
    setCurrentPage(page);
    if (newItemsPerPage && newItemsPerPage !== itemsPerPage) {
      setItemsPerPage(newItemsPerPage);
    }
  };

  const handleSearchClear = () => {
    setSearchTerm('');
  };

  // --- Helpers ---
  const getTypeIcon = (type) => {
    switch(type) {
      case 'text': return '📝';
      case 'image': return '🖼️';
      case 'audio': return '🎤';
      case 'video': return '🎥';
      case 'coordinates': return '📍';
      default: return '📄';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // Counts for tab buttons
  const testimoniesCount = allPosts.filter(p => p.type !== 'coordinates').length;
  const coordinatesCount = allPosts.filter(p => p.type === 'coordinates').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Share Your Story</h1>
              <p className="text-xl text-blue-100">
                A platform for sharing testimonies and coordinates from around the world.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition shadow-lg text-center"
                >
                  User Login
                </Link>
              </div>
              <div className="text-center">
                <Link 
                  href="/admin/login" 
                  className="text-sm text-blue-200 hover:text-white"
                >
                  Admin Access →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title + Tabs + Search */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Recent Shared Stories & Coordinates</h2>
          <p className="text-gray-600 mb-6">
            Browse through approved testimonies and coordinates shared by our community.
          </p>

          <div className="flex flex-wrap items-center justify-between border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => handleTabChange('all')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'all' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Posts ({allPosts.length})
              </button>
              <button
                onClick={() => handleTabChange('testimonies')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'testimonies' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Testimonies Only ({testimoniesCount})
              </button>
              <button
                onClick={() => handleTabChange('coordinates')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'coordinates' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Coordinates Only ({coordinatesCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-2 sm:mt-0 w-full sm:w-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={handleSearchClear}
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {filteredPosts.length} posts found
              </p>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        {displayedPosts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-medium text-gray-700 mb-2">
              {searchTerm ? 'No matching posts' : 'No posts to display yet'}
            </h3>
            <p className="text-gray-500">
              {searchTerm
                ? 'Try a different search term.'
                : activeTab === 'coordinates'
                  ? 'Coordinate posts will appear here once shared and approved.'
                  : activeTab === 'testimonies'
                    ? 'No approved testimonies yet. Check back soon!'
                    : 'No approved posts yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden border border-gray-100 flex flex-col"
                >
                  <div className="p-6 flex-grow">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          {getTypeIcon(post.type)} {post.title || (post.type === 'coordinates' ? 'Shared Coordinates' : 'Shared Testimony')}
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            By {post.userName || 'Anonymous'} • {formatDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Map for coordinate posts */}
                    {post.type === 'coordinates' && post.coordinates && (
                      <div className="mb-4">
                        <StaticMap
                          latitude={post.coordinates.latitude}
                          longitude={post.coordinates.longitude}
                          placeName={post.coordinates.placeName}
                          height="140px"
                          className="rounded-lg border border-gray-200"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="mb-4">
                      <p className="text-gray-700 line-clamp-3">
                        {post.description || post.content || (post.type === 'coordinates' ? 'Coordinate location shared.' : 'No description provided.')}
                      </p>
                    </div>

                    {/* Image preview */}
                    {post.mediaUrl && post.type === 'image' && (
                      <div className="mb-4 overflow-hidden rounded-lg">
                        <img
                          src={post.mediaUrl}
                          alt={post.title || 'Testimony image'}
                          className="w-full h-48 object-cover hover:scale-105 transition duration-300"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://placehold.co/600x400/e2e8f0/64748b?text=Image+unavailable';
                          }}
                        />
                      </div>
                    )}

                    {/* Audio preview */}
                    {post.mediaUrl && post.type === 'audio' && (
                      <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">🎤</span>
                          <span className="font-medium text-sm">Audio Testimony</span>
                        </div>
                        <audio controls className="w-full h-8">
                          <source src={post.mediaUrl} type="audio/mpeg" />
                        </audio>
                      </div>
                    )}

                    {/* Video preview */}
                    {post.mediaUrl && post.type === 'video' && (
                      <div className="mb-4 rounded-lg overflow-hidden">
                        <video controls className="w-full h-48 object-cover">
                          <source src={post.mediaUrl} type="video/mp4" />
                        </video>
                      </div>
                    )}

                    {/* Location badge */}
                    {post.type === 'coordinates' && post.coordinates?.placeName && (
                      <div className="flex items-center mt-2 mb-3 space-x-2">
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                          📍 {post.coordinates.placeName}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          ({post.coordinates.latitude?.toFixed(4)}, {post.coordinates.longitude?.toFixed(4)})
                        </span>
                      </div>
                    )}
                    {post.location?.placeName && post.type !== 'coordinates' && (
                      <div className="flex items-center mt-2 mb-3 space-x-2">
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">
                          📍 {post.location.placeName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-auto border-t border-gray-100 pt-4 px-6 pb-6">
                    <div className="flex justify-between items-center">
                      <span className={`px-3 py-1 text-sm rounded-full ${
                        post.type === 'coordinates'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {post.type === 'coordinates' ? '📍 COORDINATES' : post.type?.toUpperCase() || 'POST'}
                        {post.type === 'coordinates' && (
                          <span className="ml-1 text-xs text-purple-600">(Read-only)</span>
                        )}
                      </span>
                      <Link
                        href={`/post/${post.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12">
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

        {/* Call to action */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Want to share your own story or coordinates?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Join our community and share your testimony or specific location coordinates. Your contribution could help others.
            </p>
            <div className="space-x-4">
              <Link
                href="/login"
                className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow"
              >
                Login to Share
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - UPDATED TO 2026 */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <div className="text-2xl font-bold mb-2">Testimony App</div>
              <p className="text-gray-400">Sharing stories and locations that matter.</p>
            </div>
            <div className="flex space-x-6">
              <Link href="/" className="text-gray-300 hover:text-white">Home</Link>
              <Link href="/login" className="text-gray-300 hover:text-white">Login</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            <p>© 2026 Testimony App. All rights reserved.</p>
            <p className="mt-2">Only approved content is displayed publicly. Coordinate posts are immutable once created.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}