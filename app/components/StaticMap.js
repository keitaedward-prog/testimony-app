"use client";

export default function StaticMap({ 
  latitude, 
  longitude, 
  placeName,
  width = "100%",
  height = "150px",
  zoom = 14,
  className = ""
}) {
  
  if (!latitude || !longitude) {
    return (
      <div className={`bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-center p-4">
          <div className="text-3xl mb-2">🗺️</div>
          <p className="text-gray-600 text-sm">Location map not available</p>
        </div>
      </div>
    );
  }

  // Format coordinates for display
  const latFormatted = latitude.toFixed(6);
  const lngFormatted = longitude.toFixed(6);
  
  // Generate a simple map using a placeholder with coordinates
  // In production, you could use: https://staticmap.openstreetmap.org
  // But for simplicity, we'll use a styled div with coordinates
  
  return (
    <div className={`relative rounded-lg overflow-hidden border border-gray-300 shadow-sm ${className}`} style={{ width, height }}>
      {/* Map-like background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
        {/* Grid lines for map effect */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 right-0 h-px bg-gray-400"></div>
          <div className="absolute top-1/3 left-0 right-0 h-px bg-gray-400"></div>
          <div className="absolute top-2/3 left-0 right-0 h-px bg-gray-400"></div>
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-400"></div>
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-gray-400"></div>
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-gray-400"></div>
        </div>
        
        {/* Center marker */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg animate-pulse"></div>
            <div className="w-3 h-3 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>
        </div>
      </div>
      
      {/* Coordinates overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="text-white">
          <div className="font-mono text-xs mb-1">
            {latFormatted}, {lngFormatted}
          </div>
          {placeName && (
            <div className="font-medium text-sm truncate">
              📍 {placeName}
            </div>
          )}
        </div>
      </div>
      
      {/* Interactive buttons */}
      <div className="absolute top-2 right-2 flex space-x-1">
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/90 hover:bg-white text-gray-800 text-xs px-2 py-1 rounded shadow-sm transition flex items-center"
          title="Open in OpenStreetMap"
        >
          <span className="mr-1">OSM</span>
          <span>↗</span>
        </a>
        <a
          href={`https://www.google.com/maps?q=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/90 hover:bg-white text-gray-800 text-xs px-2 py-1 rounded shadow-sm transition flex items-center"
          title="Open in Google Maps"
        >
          <span className="mr-1">GMaps</span>
          <span>📍</span>
        </a>
      </div>
      
      {/* Watermark */}
      <div className="absolute bottom-1 left-2 text-white/70 text-[6px]">
        Click buttons to view on map
      </div>
    </div>
  );
}