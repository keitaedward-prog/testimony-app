// app/post/[id]/page.js - FIXED VERSION WITH FOUR CORNERS DISPLAY AND AUDIO NARRATION SUPPORT
"use client";

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import { FaArrowLeft, FaMapMarkerAlt, FaCalendar, FaUser } from 'react-icons/fa';
import MediaDisplay from '@/app/components/MediaDisplay';
import { useRouter } from 'next/navigation';

// Helper to normalize phone numbers
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '232' + normalized.substring(1);
  }
  return '+' + normalized;
}

export default function PostDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const postId = params?.id;
  
  // Get userId and userPhone from URL params (passed from dashboard)
  const currentUserId = searchParams?.get('userId') || null;
  const currentUserPhone = searchParams?.get('userPhone') || null;
  
  // 1. Check authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  // 2. Fetch post data when we have authentication state
  useEffect(() => {
    if (authLoading) return;
    
    async function fetchPostData() {
      if (!postId || postId.trim() === '') {
        setError('Invalid post ID');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        const docRef = doc(db, 'testimonies', postId.trim());
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          console.log('❌ Post document does not exist');
          setError('Post not found');
          setLoading(false);
          return;
        }
        
        const data = docSnap.data();
        const fetchedPost = {
          id: docSnap.id,
          title: data.title || 'Untitled',
          content: data.content || data.description || '',
          description: data.description || data.content || '',
          type: data.type || 'text',
          status: data.status || 'pending',
          userName: data.userName || `User ${data.phoneNumber || 'Anonymous'}`,
          phoneNumber: data.phoneNumber || '',
          mediaUrl: data.mediaUrl || '',
          audioUrl: data.audioUrl || '', // <-- new field for additional audio
          mediaType: data.mediaType || '',
          location: data.location || null,
          coordinates: data.coordinates || null,
          fourCorners: data.fourCorners || null,
          userId: data.userId || '',
          userPhone: data.userPhone || '',
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        };
        
        console.log('📄 Post data loaded:', {
          id: fetchedPost.id,
          status: fetchedPost.status,
          postUserId: fetchedPost.userId,
          postUserPhone: fetchedPost.userPhone,
          currentUserId,
          currentUserPhone,
          currentAuthUser: currentUser?.uid,
          hasFourCorners: !!fetchedPost.fourCorners,
          hasAudioUrl: !!fetchedPost.audioUrl
        });
        
        // CHECK AUTHORIZATION: Client-side version
        // 1. If post is approved, anyone can view it
        if (fetchedPost.status === 'approved') {
          console.log('✅ Approved post - allowing public access');
          setPost(fetchedPost);
          setLoading(false);
          return;
        }
        
        // 2. Check if current user (from auth) owns this post
        if (currentUser) {
          // Check by userId
          if (currentUser.uid && fetchedPost.userId === currentUser.uid) {
            console.log('✅ User owns this post (userId match from auth)');
            setPost(fetchedPost);
            setLoading(false);
            return;
          }
          
          // Check by phone (from auth)
          if (currentUser.phoneNumber) {
            const normalizedCurrent = normalizePhoneNumber(currentUser.phoneNumber);
            const postPhones = [
              fetchedPost.userPhone,
              fetchedPost.phoneNumber,
              fetchedPost.userName?.includes('User ') ? fetchedPost.userName.replace('User ', '') : null
            ].filter(Boolean);
            
            for (const postPhone of postPhones) {
              const normalizedPost = normalizePhoneNumber(postPhone);
              if (normalizedCurrent && normalizedPost && normalizedCurrent === normalizedPost) {
                console.log('✅ User owns this post (phone match from auth)');
                setPost(fetchedPost);
                setLoading(false);
                return;
              }
            }
          }
        }
        
        // 3. Check URL parameters (for users coming from dashboard)
        if (currentUserId && fetchedPost.userId === currentUserId) {
          console.log('✅ User owns this post (userId from URL params)');
          setPost(fetchedPost);
          setLoading(false);
          return;
        }
        
        if (currentUserPhone) {
          const normalizedCurrent = normalizePhoneNumber(currentUserPhone);
          const postPhones = [
            fetchedPost.userPhone,
            fetchedPost.phoneNumber,
            fetchedPost.userName?.includes('User ') ? fetchedPost.userName.replace('User ', '') : null
          ].filter(Boolean);
          
          for (const postPhone of postPhones) {
            const normalizedPost = normalizePhoneNumber(postPhone);
            if (normalizedCurrent && normalizedPost && normalizedCurrent === normalizedPost) {
              console.log('✅ User owns this post (phone from URL params)');
              setPost(fetchedPost);
              setLoading(false);
              return;
            }
          }
        }
        
        // 4. If we get here, user is not authorized
        console.log('❌ User not authorized to view this post');
        console.log('Post requires:', { 
          userId: fetchedPost.userId, 
          userPhone: fetchedPost.userPhone,
          phoneNumber: fetchedPost.phoneNumber
        });
        console.log('User has (auth):', { 
          userId: currentUser?.uid, 
          userPhone: currentUser?.phoneNumber 
        });
        console.log('User has (URL):', { 
          userId: currentUserId, 
          userPhone: currentUserPhone 
        });
        
        setError('You are not authorized to view this post');
        setLoading(false);
        
      } catch (error) {
        console.error('❌ Error fetching post:', error);
        setError(`Error loading post: ${error.message}`);
        setLoading(false);
      }
    }
    
    fetchPostData();
  }, [postId, currentUserId, currentUserPhone, currentUser, authLoading]);
  
  function getLocationInfo(post) {
    if (!post) return null;
    
    if (post.type === 'coordinates' && post.coordinates) {
      return {
        type: 'coordinates',
        placeName: post.coordinates.placeName || 'Unknown Location',
        latitude: post.coordinates.latitude,
        longitude: post.coordinates.longitude,
        accuracy: post.coordinates.accuracy,
        timestamp: post.coordinates.timestamp
      };
    }
    
    if (post.location) {
      return {
        type: 'location',
        placeName: post.location.placeName || 'Unknown Location',
        latitude: post.location.latitude,
        longitude: post.location.longitude,
        accuracy: post.location.accuracy,
        timestamp: post.location.timestamp
      };
    }
    
    return null;
  }
  
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading post...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }
  
  if (error || !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Link 
            href={currentUser ? "/dashboard" : "/"}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <FaArrowLeft /> 
            {currentUser ? 'Back to Dashboard' : 'Back to Home'}
          </Link>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-6">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {error || 'Post Not Found'}
            </h1>
            <p className="text-gray-600 mb-6">
              {error === 'You are not authorized to view this post' 
                ? 'This post is pending approval and can only be viewed by the author.'
                : 'The post you\'re looking for doesn\'t exist or you don\'t have permission to view it.'}
            </p>
            <Link
              href={currentUser ? "/dashboard" : "/"}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition shadow"
            >
              ← {currentUser ? 'Back to Dashboard' : 'Back to Home'}
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Format date
  const formattedDate = post.createdAt 
    ? new Date(post.createdAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Date not available';
  
  const hasMedia = !!post.mediaUrl;
  const locationInfo = getLocationInfo(post);
  const showWarning = post.status !== 'approved';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Link 
          href={post.status === 'approved' ? "/" : "/dashboard"}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <FaArrowLeft /> 
          {post.status === 'approved' ? 'Back to Home' : 'Back to Dashboard'}
        </Link>
        
        {showWarning && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-xl">⏳</div>
              <div>
                <h3 className="font-bold">Post Pending Approval</h3>
                <p className="text-sm mt-1">
                  This post is waiting for admin approval and is only visible to you.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  {post.title}
                </h1>
                
                {locationInfo && (
                  <div className="flex items-center gap-2 mb-2">
                    <FaMapMarkerAlt className="text-blue-200" />
                    <span className="text-blue-100 font-medium">
                      {locationInfo.placeName}
                    </span>
                  </div>
                )}
                
                <p className="text-blue-100 opacity-90">
                  Posted by {post.userName} • {formattedDate}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  post.status === 'approved' ? 'bg-green-500' : 
                  post.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                }`}>
                  {post.status.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  post.type === 'coordinates' ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                  {post.type === 'coordinates' ? '📍 COORDINATES' : '📝 TESTIMONY'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-6 md:p-8">
            <div className="mb-8">
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                  {post.content}
                </p>
              </div>
            </div>
            
            {hasMedia ? (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">
                  Media Attachment
                </h3>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-2">
                  <MediaDisplay 
                    mediaUrl={post.mediaUrl} 
                    title={post.title}
                  />
                </div>
              </div>
            ) : (
              <div className="mb-8 p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-gray-500">No media attached to this post</p>
              </div>
            )}

            {/* Additional Audio Narration (for image posts that include audio) */}
            {post.audioUrl && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Audio Narration</h3>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-4">
                  <audio controls className="w-full" src={post.audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            )}
            
            {locationInfo && (
              <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-green-800">
                  <FaMapMarkerAlt /> 
                  {post.type === 'coordinates' ? 'Coordinate Location' : 'Location Information'}
                </h3>
                
                <div className="mb-4">
                  <div className="p-3 bg-white rounded-lg border border-green-100 mb-3">
                    <div className="font-medium text-gray-700 mb-1">Place Name</div>
                    <div className="text-lg font-semibold text-green-700">
                      {locationInfo.placeName}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-green-100">
                      <span className="font-medium text-gray-700">Latitude:</span>
                      <span className="font-semibold text-green-700 font-mono">
                        {locationInfo.latitude?.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-green-100">
                      <span className="font-medium text-gray-700">Longitude:</span>
                      <span className="font-semibold text-green-700 font-mono">
                        {locationInfo.longitude?.toFixed(6)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-green-300">
                    <div className="flex items-center gap-2 mb-3">
                      <FaMapMarkerAlt className="text-green-600" />
                      <p className="font-medium text-gray-800">
                        {post.type === 'coordinates' 
                          ? 'Coordinate Details' 
                          : 'Location Details'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded font-mono text-green-800 text-center">
                      {locationInfo.latitude?.toFixed(6)}, {locationInfo.longitude?.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FOUR CORNERS SECTION */}
            {post.type === 'coordinates' && post.fourCorners && post.fourCorners.length === 4 && (
              <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-purple-800">
                  <span>🔲</span> Four Corners (Land Area)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {post.fourCorners.map((corner, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-purple-100">
                      <div className="font-bold text-purple-700 mb-2">Corner {index + 1}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-500">Latitude:</div>
                        <div className="font-mono text-purple-800">{corner.latitude?.toFixed(6)}</div>
                        <div className="text-gray-500">Longitude:</div>
                        <div className="font-mono text-purple-800">{corner.longitude?.toFixed(6)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  These coordinates define the four corners of a land plot.
                </p>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <FaCalendar className="text-blue-500 text-lg" />
                  <div>
                    <p className="font-medium text-gray-700">Posted on</p>
                    <p className="text-gray-900">{formattedDate}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <FaUser className="text-purple-500 text-lg" />
                  <div>
                    <p className="font-medium text-gray-700">Author</p>
                    <p className="text-gray-900">{post.userName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <Link
            href={post.status === 'approved' ? "/" : "/dashboard"}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition shadow"
          >
            ← {post.status === 'approved' ? 'Back to All Testimonies' : 'Back to Dashboard'}
          </Link>
        </div>
      </div>
    </div>
  );
}