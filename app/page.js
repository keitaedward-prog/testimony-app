// app/page.js - PUBLIC HOMEPAGE - FETCH ALL APPROVED POSTS (NO SERVER PAGINATION)
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import PublicHomeClient from './components/PublicHomeClient';

async function getAllApprovedPosts() {
  try {
    const q = query(
      collection(db, 'testimonies'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const allPosts = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allPosts.push({
        id: doc.id,
        title: data.title || 'Untitled Testimony',
        content: data.content || data.description || '',
        description: data.description || data.content || '',
        type: data.type || 'text',
        status: data.status || 'approved',
        userName: data.userName || `User ${data.phoneNumber || 'Anonymous'}`,
        phoneNumber: data.phoneNumber || '',
        mediaUrl: data.mediaUrl || '',
        mediaType: data.mediaType || '',
        location: data.location || null,
        coordinates: data.coordinates || null,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      });
    });
    
    return {
      posts: allPosts,
      totalPosts: allPosts.length,
    };
  } catch (error) {
    console.error('Error fetching approved posts:', error);
    return {
      posts: [],
      totalPosts: 0,
    };
  }
}

export default async function HomePage() {
  const postsData = await getAllApprovedPosts();
  
  console.log(`✅ Server fetched ${postsData.posts.length} approved posts`);
  const coordPosts = postsData.posts.filter(p => p.type === 'coordinates');
  if (coordPosts.length > 0) {
    console.log(`📍 Coordinate posts found: ${coordPosts.length}`);
  }
  
  return <PublicHomeClient initialPosts={postsData} />;
}