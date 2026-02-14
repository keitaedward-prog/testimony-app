"use client";

import { useState, useEffect } from 'react';

export default function MiniMap({ 
  latitude, 
  longitude, 
  placeName,
  width = "100%",
  height = "150px",
  zoom = 14,
  showMarker = true,
  className = ""
}) {
  const [mapUrl, setMapUrl] = useState('');
  const [attribution, setAttribution] = useState('');

  // Generate static map URL using OpenStreetMap
  useEffect(() => {
    if (!latitude || !longitude) return;

    // Use OpenStreetMap static map API
    const tileServer = "https://tile.openstreetmap.org";
    const zoomLevel = Math.min(Math.max(zoom, 1), 19);
    
    // Calculate tile coordinates
    const latRad = latitude * Math.PI / 180;
    const n = Math.pow(2, zoomLevel);
    const xTile = Math.floor((longitude + 180) / 360 * n);
    const yTile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    
    // For a simple static map, we can use a tile service
    // Note: In production, consider using a dedicated static map service or caching
    const staticMapUrl = `${tileServer}/${zoomLevel}/${xTile}/${yTile}.png`;
    
    // Alternative: Use OpenStreetMap static map (requires attribution)
    // const staticMapUrl = `https://staticmap.openstreetmap.org/staticmap.php?center=${latitude},${longitude}&zoom=${zoomLevel}&size=300x200&maptype=mapnik&markers=${latitude},${longitude},red`;
    
    setMapUrl(staticMapUrl);
    setAttribution(`© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors`);
    
  }, [latitude, longitude, zoom]);

  // Fallback if map fails to load
  const handleImageError = (e) => {
    console.error('Map image failed to load, showing fallback');
    e.target.onerror = null;
    e.target.src = `https://via.placeholder.com/300x150/4a5568/9ca3af?text=Map+Unavailable`;
  };

  if (!latitude || !longitude) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-1">🗺️</div>
          <p className="text-sm">No coordinates available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden border border-gray-200 ${className}`} style={{ width, height }}>
      {/* Map Image */}
      <div className="relative w-full h-full">
        <img
          src={mapUrl}
          alt={`Map of ${placeName || `location at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}`}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
        
        {/* Map Marker */}
        {showMarker && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="w-6 h-6 bg-red-600 rounded-full border-2 border-white shadow-lg"></div>
              <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>
          </div>
        )}
        
        {/* Overlay gradient for better text visibility */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/40 to-transparent"></div>
        
        {/* Coordinates overlay */}
        <div className="absolute bottom-2 left-2 right-2 text-white text-xs">
          <div className="font-mono truncate">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </div>
          {placeName && (
            <div className="font-medium truncate text-sm">
              {placeName}
            </div>
          )}
        </div>
      </div>
      
      {/* Attribution - hidden on small screens, shown on hover */}
      <div className="absolute bottom-0 right-0 p-1 bg-black/50 text-white text-[8px] opacity-0 hover:opacity-100 transition-opacity">
        {attribution ? (
          <div dangerouslySetInnerHTML={{ __html: attribution }} />
        ) : (
          <span>Map data © OpenStreetMap contributors</span>
        )}
      </div>
      
      {/* Interactive controls overlay */}
      <div className="absolute top-2 right-2 flex space-x-1">
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/90 hover:bg-white text-gray-800 text-xs px-2 py-1 rounded shadow-sm transition"
          title="Open in OpenStreetMap"
        >
          ↗
        </a>
        <a
          href={`https://www.google.com/maps?q=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/90 hover:bg-white text-gray-800 text-xs px-2 py-1 rounded shadow-sm transition"
          title="Open in Google Maps"
        >
          📍
        </a>
      </div>
    </div>
  );
}