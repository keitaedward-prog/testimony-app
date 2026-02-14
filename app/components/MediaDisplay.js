// app/components/MediaDisplay.js - CLIENT COMPONENT for media display
"use client";

import { useState } from 'react';
import { FaDownload } from 'react-icons/fa';

export default function MediaDisplay({ mediaUrl, title }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = () => {
    console.log('❌ Image failed to load');
    setImageError(true);
  };

  const handleImageLoad = () => {
    console.log('✅ Image loaded successfully!');
    setImageLoaded(true);
  };

  // If image failed to load, show download link
  if (imageError) {
    return (
      <div className="p-8 text-center">
        <div className="text-5xl mb-4">📎</div>
        <p className="text-gray-600 mb-2">Media file attached</p>
        <p className="text-sm text-gray-500 mb-6">
          The image could not be displayed inline, but you can download it.
        </p>
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 font-medium"
        >
          <FaDownload /> Download File
        </a>
        <div className="mt-4">
          <a href={mediaUrl} target="_blank" className="text-blue-600 hover:underline">
            🔗 Open in new tab
          </a>
        </div>
      </div>
    );
  }

  // Show the image
  return (
    <div className="text-center">
      <div className="mb-4">
        <img
          src={mediaUrl}
          alt={title || 'Testimony media'}
          className={`max-w-full h-auto max-h-[500px] mx-auto rounded-lg shadow-lg ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-300`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
        {!imageLoaded && !imageError && (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-400">Loading image...</div>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          🔗 Open Full Size
        </a>
        <a
          href={mediaUrl}
          download
          className="inline-flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50"
        >
          <FaDownload /> Download File
        </a>
      </div>
    </div>
  );
}