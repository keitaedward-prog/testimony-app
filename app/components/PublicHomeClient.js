// app/components/PublicHomeClient.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Pagination from './Pagination';

export default function PublicHomeClient({ initialTestimonies, initialElearning }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [testimonies, setTestimonies] = useState(initialTestimonies);
  const [elearning, setElearning] = useState(initialElearning);
  
  const [activeTab, setActiveTab] = useState('testimonies');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [filteredItems, setFilteredItems] = useState([]);
  const [displayedItems, setDisplayedItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const items = activeTab === 'testimonies' ? testimonies : elearning;
    let filtered = items;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = items.filter(item => 
        item.title?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        (activeTab === 'testimonies' && item.location?.placeName?.toLowerCase().includes(term))
      );
    }
    setFilteredItems(filtered);
    setCurrentPage(1);
  }, [activeTab, searchTerm, testimonies, elearning]);

  useEffect(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    setDisplayedItems(filteredItems.slice(start, end));
    setTotalPages(Math.ceil(filteredItems.length / itemsPerPage));
  }, [filteredItems, currentPage, itemsPerPage]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('page', currentPage.toString());
    params.set('limit', itemsPerPage.toString());
    if (searchTerm) params.set('search', searchTerm);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [activeTab, currentPage, itemsPerPage, searchTerm, router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['testimonies', 'elearning'].includes(tab)) setActiveTab(tab);
    const page = searchParams.get('page');
    if (page) setCurrentPage(parseInt(page));
    const limit = searchParams.get('limit');
    if (limit) setItemsPerPage(parseInt(limit));
    const search = searchParams.get('search');
    if (search) setSearchTerm(search);
  }, [searchParams]);

  const handlePageChange = (page, newItemsPerPage) => {
    setCurrentPage(page);
    if (newItemsPerPage && newItemsPerPage !== itemsPerPage) {
      setItemsPerPage(newItemsPerPage);
    }
  };

  const handleSearchClear = () => setSearchTerm('');

  const getTypeIcon = (type) => {
    switch(type) {
      case 'text': return '📝';
      case 'image': return '🖼️';
      case 'audio': return '🎤';
      case 'video': return '🎥';
      default: return '📄';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderItem = (item) => {
    const isElearning = activeTab === 'elearning';
    return (
      <div key={item.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden border border-gray-100">
        <div className="p-6">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-bold flex items-center gap-2">
              {isElearning ? '📚' : getTypeIcon(item.type)} {item.title || (isElearning ? 'E‑Learning' : 'Testimony')}
            </h3>
          </div>
          <p className="text-sm text-gray-500 mb-2">
            {isElearning ? 'Admin' : (
              // Show proper name if available, otherwise phone, else Anonymous
              item.userName && item.userName !== 'User Anonymous'
                ? item.userName
                : (item.userPhone ? `User ${item.userPhone}` : 'Anonymous')
            )} • {formatDate(item.createdAt)}
          </p>
          {!isElearning && item.location?.placeName && (
            <p className="text-sm text-green-600 mb-2">📍 {item.location.placeName}</p>
          )}
          <p className="text-gray-700 line-clamp-3 mb-4">{item.description || 'No description provided.'}</p>
          {item.mediaUrl && (
            <div className="mb-4">
              {item.type === 'image' && <img src={item.mediaUrl} alt={item.title} className="max-h-48 rounded-lg object-cover w-full" onError={(e) => { e.target.src = 'https://placehold.co/600x400/e2e8f0/64748b?text=Unavailable'; }} />}
              {item.type === 'audio' && <audio controls src={item.mediaUrl} className="w-full" />}
              {item.type === 'video' && <video controls src={item.mediaUrl} className="w-full max-h-48 rounded-lg" />}
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <Link 
            href={isElearning ? `/elearning/${item.id}` : `/post/${item.id}`} 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Details →
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Share Your Story</h1>
              <p className="text-xl text-blue-100">A platform for sharing testimonies and educational materials.</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/login" className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition shadow-lg text-center">
                  User Login
                </Link>
              </div>
              <div className="text-center">
                <Link href="/admin/login" className="text-sm text-blue-200 hover:text-white">
                  Admin Access →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Recent Content</h2>
          <p className="text-gray-600 mb-6">Browse approved testimonies and educational materials.</p>

          <div className="flex flex-wrap items-center justify-between border-b border-gray-200">
            <div className="flex">
              <button onClick={() => setActiveTab('testimonies')} className={`px-6 py-3 font-medium ${activeTab === 'testimonies' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                Testimonies ({testimonies.length})
              </button>
              <button onClick={() => setActiveTab('elearning')} className={`px-6 py-3 font-medium ${activeTab === 'elearning' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                E‑Learning ({elearning.length})
              </button>
            </div>

            <div className="mt-2 sm:mt-0 w-full sm:w-auto">
              <div className="relative">
                <input type="text" placeholder="🔍 Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                {searchTerm && (
                  <button onClick={handleSearchClear} className="absolute right-3 top-2 text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{filteredItems.length} items found</p>
            </div>
          </div>
        </div>

        {displayedItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-medium text-gray-700 mb-2">{searchTerm ? 'No matching content' : 'No content to display yet'}</h3>
            <p className="text-gray-500">{searchTerm ? 'Try a different search term.' : 'Check back soon!'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedItems.map(renderItem)}
            </div>
            {totalPages > 1 && (
              <div className="mt-12">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredItems.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  className="mt-8"
                />
              </div>
            )}
          </>
        )}

        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Want to share your own story?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Join our community and share your testimony.</p>
            <div className="space-x-4">
              <Link href="/login" className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow">
                Login to Share
              </Link>
            </div>
          </div>
        </div>

        {/* Organisation logos */}
        <div className="mt-12 flex flex-wrap justify-center items-center gap-8">
          <img src="/peace_building.png" alt="Peace Building Fund" className="h-16 object-contain" />
          <img src="/wones.png" alt="WONES" className="h-16 object-contain" />
          <img src="/christian_aid.png" alt="christian_aid" className="h-16 object-contain" />
        </div>
      </main>

      <footer className="bg-gray-900 text-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <div className="text-2xl font-bold mb-2">Testimony App</div>
              <p className="text-gray-400">Sharing stories that matter.</p>
            </div>
            <div className="flex space-x-6">
              <Link href="/" className="text-gray-300 hover:text-white">Home</Link>
              <Link href="/login" className="text-gray-300 hover:text-white">Login</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            <p>© 2026 Testimony App. All rights reserved.</p>
            <p className="mt-2">Only approved content is displayed publicly.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}