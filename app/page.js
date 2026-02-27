// app/page.js
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Suspense } from 'react';
import PublicHomeClient from './components/PublicHomeClient';

export const dynamic = 'force-dynamic';

async function getApprovedTestimonies() {
  try {
    const q = query(
      collection(db, 'testimonies'),
      where('status', '==', 'approved'),
      where('type', 'in', ['text', 'image', 'audio', 'video']),
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
        userName: data.userName || `User ${data.phoneNumber || 'Anonymous'}`,
        phoneNumber: data.phoneNumber || '',
        mediaUrl: data.mediaUrl || '',
        location: data.location || null,
        // Convert Timestamps to ISO strings
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      });
    });
    
    return allPosts;
  } catch (error) {
    console.error('Error fetching approved testimonies:', error);
    return [];
  }
}

async function getElearningPosts() {
  try {
    const q = query(collection(db, 'eLearning'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Timestamps to ISO strings
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      };
    });
  } catch (error) {
    console.error('Error fetching eLearning:', error);
    return [];
  }
}

export default async function HomePage() {
  const testimonies = await getApprovedTestimonies();
  const eLearning = await getElearningPosts();
  
  return (
    <Suspense fallback={<div>Loading page...</div>}>
      <PublicHomeClient 
        initialTestimonies={testimonies}
        initialElearning={eLearning}
      />
    </Suspense>
  );
}