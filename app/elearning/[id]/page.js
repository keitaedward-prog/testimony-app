// app/elearning/[id]/page.js
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FaDownload } from 'react-icons/fa';

export const dynamic = 'force-dynamic';

async function getElearningPost(id) {
  try {
    const docRef = doc(db, 'eLearning', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
    };
  } catch (error) {
    console.error('Error fetching e-learning post:', error);
    return null;
  }
}

export default async function ElearningDetailPage({ params }) {
  const post = await getElearningPost(params.id);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6">
          ← Back to Home
        </Link>

        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <div className="p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{post.title}</h1>
            <p className="text-gray-500 mb-6">
              Posted on {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown date'}
            </p>

            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-gray-700 whitespace-pre-line">{post.description}</p>
            </div>

            {post.mediaUrl && (
              <div className="mt-8 border-t pt-8">
                <h2 className="text-xl font-semibold mb-4">Attached Material</h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {post.type === 'image' && (
                    <div>
                      <img src={post.mediaUrl} alt={post.title} className="max-w-full max-h-96 mx-auto rounded-lg shadow" />
                      <div className="flex justify-center mt-4">
                        <a
                          href={post.mediaUrl}
                          download
                          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <FaDownload /> Download Image
                        </a>
                      </div>
                    </div>
                  )}

                  {post.type === 'audio' && (
                    <div>
                      <audio controls src={post.mediaUrl} className="w-full" />
                      <div className="flex justify-center mt-4">
                        <a
                          href={post.mediaUrl}
                          download
                          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <FaDownload /> Download Audio
                        </a>
                      </div>
                    </div>
                  )}

                  {post.type === 'video' && (
                    <div>
                      <video controls src={post.mediaUrl} className="w-full max-h-96 rounded-lg" />
                      <div className="flex justify-center mt-4">
                        <a
                          href={post.mediaUrl}
                          download
                          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <FaDownload /> Download Video
                        </a>
                      </div>
                    </div>
                  )}

                  {post.type === 'document' && (
                    <div className="text-center">
                      <a
                        href={post.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <FaDownload /> Open / Download Document
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}