"use client";

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  iconUrl: '/leaflet/images/marker-icon.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
});

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: '/leaflet/images/marker-icon.png',
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map clicks
function LocationMarker({ position, setPosition, onPositionChange }) {
  const map = useMapEvents({
    click(e) {
      const newPos = [e.latlng.lat, e.latlng.lng];
      setPosition(newPos);
      if (onPositionChange) {
        onPositionChange(newPos[0], newPos[1]);
      }
      map.flyTo(newPos, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customIcon}>
      <Popup>
        Latitude: {position[0].toFixed(6)}<br />
        Longitude: {position[1].toFixed(6)}
      </Popup>
    </Marker>
  );
}

// Main MapPicker Component
export default function MapPicker({ 
  initialLat, 
  initialLng, 
  onPositionChange,
  height = "400px"
}) {
  const [position, setPosition] = useState(null);
  const [mapKey, setMapKey] = useState(0); // For forcing map re-render
  const mapRef = useRef(null);

  // Initialize position from props
  useEffect(() => {
    if (initialLat && initialLng) {
      const lat = parseFloat(initialLat);
      const lng = parseFloat(initialLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        setPosition([lat, lng]);
      }
    }
  }, [initialLat, initialLng]);

  // Reset map view when position changes
  useEffect(() => {
    if (mapRef.current && position) {
      mapRef.current.flyTo(position, 15);
    }
  }, [position]);

  // Default center (Freetown, Sierra Leone based on your example)
  const defaultCenter = [8.4844, -13.2299];
  
  // Default zoom level
  const defaultZoom = 13;

  // Handle "Use Current Location" button
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
          if (onPositionChange) {
            onPositionChange(newPos[0], newPos[1]);
          }
          setMapKey(prev => prev + 1); // Force map re-render
        },
        (error) => {
          alert('Unable to get current location. Please enable location services.');
        }
      );
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-gray-700">Interactive Map</h3>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          📍 Use My Location
        </button>
      </div>
      
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
        <MapContainer
          key={mapKey}
          center={position || defaultCenter}
          zoom={defaultZoom}
          style={{ height, width: '100%' }}
          ref={mapRef}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position && (
            <LocationMarker 
              position={position} 
              setPosition={setPosition}
              onPositionChange={onPositionChange}
            />
          )}
        </MapContainer>
      </div>
      
      <div className="mt-3 text-sm text-gray-600">
        <p className="flex items-center gap-1">
          <span className="text-blue-600">📌</span> 
          Click on the map to set coordinates. Drag marker to adjust.
        </p>
        {position && (
          <p className="mt-1 font-mono text-sm bg-gray-100 p-2 rounded">
            Selected: {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}