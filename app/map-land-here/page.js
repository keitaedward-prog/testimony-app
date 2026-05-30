// app/map-land-here/page.js
// app/map-land-here/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(
  () => import('@/app/components/MapPicker'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }
);

export default function AddCoordinatesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Location states (main coordinate)
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  
  // Dynamic corners – start with 3 corners (minimum)
  const [corners, setCorners] = useState([
    { lat: '', lng: '' },
    { lat: '', lng: '' },
    { lat: '', lng: '' }
  ]);
  const [gettingCornerIndex, setGettingCornerIndex] = useState(null);
  
  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Handle map position change (main coordinate)
  const handleMapPositionChange = (lat, lng) => {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    fetchPlaceName(lat, lng);
  };

  const fetchPlaceName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=16`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.display_name) {
          const address = data.address;
          let conciseName = '';
          if (address.road) {
            conciseName = address.road;
            if (address.city) conciseName += `, ${address.city}`;
            else if (address.town) conciseName += `, ${address.town}`;
            else if (address.village) conciseName += `, ${address.village}`;
          } else if (address.city || address.town || address.village) {
            conciseName = address.city || address.town || address.village;
          } else if (address.country) {
            conciseName = address.country;
          }
          setPlaceName(conciseName || data.display_name.split(',').slice(0, 3).join(','));
        }
      }
    } catch (error) {
      console.log('Geocoding failed', error);
      setPlaceName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      setIsGettingLocation(true);
      setLocationError('');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            setLatitude(latitude.toFixed(6));
            setLongitude(longitude.toFixed(6));
            await fetchPlaceName(latitude, longitude);
            setIsGettingLocation(false);
            resolve({ latitude: latitude.toFixed(6), longitude: longitude.toFixed(6), placeName: placeName });
          } catch (err) {
            setIsGettingLocation(false);
            reject(err);
          }
        },
        (error) => {
          setIsGettingLocation(false);
          let errorMessage = '';
          switch (error.code) {
            case error.PERMISSION_DENIED: errorMessage = 'Location permission denied.'; break;
            case error.POSITION_UNAVAILABLE: errorMessage = 'Location unavailable.'; break;
            case error.TIMEOUT: errorMessage = 'Location request timed out.'; break;
            default: errorMessage = 'Unknown error.';
          }
          setLocationError(errorMessage);
          reject(new Error(errorMessage));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const getCornerLocation = async (index) => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }
    setGettingCornerIndex(index);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;
      const updatedCorners = [...corners];
      updatedCorners[index] = {
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6)
      };
      setCorners(updatedCorners);
    } catch (error) {
      let msg = 'Failed to get location';
      if (error.code === 1) msg = 'Location permission denied';
      else if (error.code === 2) msg = 'Location unavailable';
      else if (error.code === 3) msg = 'Location request timed out';
      alert(msg);
    } finally {
      setGettingCornerIndex(null);
    }
  };

  const handleLatitudeChange = (value) => {
    setLatitude(value);
    const lat = parseFloat(value);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) fetchPlaceName(lat, lng);
  };

  const handleLongitudeChange = (value) => {
    setLongitude(value);
    const lat = parseFloat(latitude);
    const lng = parseFloat(value);
    if (!isNaN(lat) && !isNaN(lng)) fetchPlaceName(lat, lng);
  };

  const handleCornerLatChange = (index, value) => {
    const updated = [...corners];
    updated[index].lat = value;
    setCorners(updated);
  };

  const handleCornerLngChange = (index, value) => {
    const updated = [...corners];
    updated[index].lng = value;
    setCorners(updated);
  };

  // Add a new corner (max 7)
  const addCorner = () => {
    if (corners.length >= 7) {
      alert('Maximum 7 corners allowed.');
      return;
    }
    setCorners([...corners, { lat: '', lng: '' }]);
  };

  // Remove the last corner (min 3)
  const removeCorner = () => {
    if (corners.length <= 3) {
      alert('Minimum 3 corners required.');
      return;
    }
    const newCorners = [...corners];
    newCorners.pop();
    setCorners(newCorners);
  };

  const validateCoordinates = (mainLat, mainLng, cornersArray) => {
    if (!mainLat || !mainLng) {
      setError('Main coordinates are required.');
      return false;
    }
    const lat = parseFloat(mainLat);
    const lng = parseFloat(mainLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Main coordinates invalid.');
      return false;
    }
    if (cornersArray.length < 3 || cornersArray.length > 7) {
      setError('Number of corners must be between 3 and 7.');
      return false;
    }
    for (let i = 0; i < cornersArray.length; i++) {
      const corner = cornersArray[i];
      if (!corner.lat || !corner.lng) {
        setError(`Corner ${i+1} coordinates are required.`);
        return false;
      }
      const latCorner = parseFloat(corner.lat);
      const lngCorner = parseFloat(corner.lng);
      if (isNaN(latCorner) || isNaN(lngCorner) || latCorner < -90 || latCorner > 90 || lngCorner < -180 || lngCorner > 180) {
        setError(`Corner ${i+1} coordinates invalid.`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to map land');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      let mainLat = latitude;
      let mainLng = longitude;
      let mainPlaceName = placeName;

      if (!mainLat || !mainLng) {
        try {
          const location = await getCurrentLocation();
          mainLat = location.latitude;
          mainLng = location.longitude;
          await fetchPlaceName(parseFloat(mainLat), parseFloat(mainLng));
          mainPlaceName = placeName;
        } catch (locError) {
          setError('Could not get location. Please enter coordinates manually or allow location access.');
          setSubmitting(false);
          return;
        }
      }

      if (!validateCoordinates(mainLat, mainLng, corners)) {
        setSubmitting(false);
        return;
      }

      const lat = parseFloat(mainLat);
      const lng = parseFloat(mainLng);

      const coordinateData = {
        type: 'coordinates',
        title: title || '',
        description: description || '',
        coordinates: {
          latitude: lat,
          longitude: lng,
          placeName: mainPlaceName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          accuracy: 50,
          timestamp: new Date().toISOString(),
        },
        fourCorners: corners.map(corner => ({
          latitude: parseFloat(corner.lat),
          longitude: parseFloat(corner.lng)
        })),
        status: 'approved',
        userId: user.uid,
        userPhone: user.phoneNumber || '',
        userName: `User ${user.phoneNumber || 'Anonymous'}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Saving coordinate post with', corners.length, 'corners:', coordinateData);
      await addDoc(collection(db, 'testimonies'), coordinateData);
      setSuccess(`Land mapped successfully! (${corners.length} corners)`);
      
      // Reset form
      setTitle('');
      setDescription('');
      setLatitude('');
      setLongitude('');
      setPlaceName('');
      setCorners([{ lat: '', lng: '' }, { lat: '', lng: '' }, { lat: '', lng: '' }]);
      setLocationError('');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(`Failed to map land: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Map Land Here</h1>
              <p className="text-gray-600 mt-2">
                Define a land area with <strong>3 to 7 corners</strong>. All fields are required.
              </p>
            </div>
            <Link href="/dashboard" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {success && <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">✅ {success}</div>}
        {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">❌ {error}</div>}

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Title (Optional)</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 'Farm Plot'" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description / Notes (Optional)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Add notes about this land..." className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            </div>

            {/* Main Location */}
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h2 className="text-lg font-medium text-gray-700 mb-3">🗺️ Main Location</h2>
              <p className="text-sm text-gray-600 mb-4">This is the primary reference point for your land.</p>
              <MapPicker initialLat={latitude} initialLng={longitude} onPositionChange={handleMapPositionChange} height="400px" />

              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-md font-medium text-gray-700 mb-3">📍 Main Coordinates</h3>
                <div className="mb-4">
                  <button type="button" onClick={getCurrentLocation} disabled={isGettingLocation} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4">
                    {isGettingLocation ? 'Getting Location...' : '📡 Get Current Location Automatically'}
                  </button>
                  {locationError && <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">❌ {locationError}</div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Latitude *</label>
                    <input type="text" value={latitude} onChange={(e) => handleLatitudeChange(e.target.value)} placeholder="e.g., 8.488147" className="w-full px-4 py-3 border border-gray-300 rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Longitude *</label>
                    <input type="text" value={longitude} onChange={(e) => handleLongitudeChange(e.target.value)} placeholder="e.g., -13.235127" className="w-full px-4 py-3 border border-gray-300 rounded-lg" required />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Place Name (Auto-filled)</label>
                  <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Place name" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Dynamic Corners Section */}
            <div className="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-medium text-gray-700">🔲 Land Corners ({corners.length} corners)</h2>
                <div className="space-x-2">
                  <button type="button" onClick={addCorner} className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">+ Add Corner</button>
                  <button type="button" onClick={removeCorner} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">- Remove Last</button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">Minimum 3, maximum 7 corners. You can enter coordinates manually or use the button to capture your current location at each corner.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {corners.map((corner, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border border-purple-100">
                    <h3 className="font-bold text-purple-800 mb-3">Corner {index + 1}</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Latitude</label>
                        <input type="text" value={corner.lat} onChange={(e) => handleCornerLatChange(index, e.target.value)} placeholder="Latitude" className="w-full px-3 py-2 border border-gray-300 rounded" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Longitude</label>
                        <input type="text" value={corner.lng} onChange={(e) => handleCornerLngChange(index, e.target.value)} placeholder="Longitude" className="w-full px-3 py-2 border border-gray-300 rounded" required />
                      </div>
                      <button type="button" onClick={() => getCornerLocation(index)} disabled={gettingCornerIndex !== null} className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm">
                        {gettingCornerIndex === index ? 'Getting...' : `Get Current Location for Corner ${index + 1}`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">* You can have between 3 and 7 corners. All are required before submitting.</p>
            </div>

            <div className="flex space-x-4 pt-6 border-t">
              <button type="button" onClick={() => router.push('/dashboard')} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? 'Mapping Land...' : 'Map Land'}
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start">
                <div className="text-blue-500 mr-3">ℹ️</div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">About Land Mapping:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Main location:</strong> Set via map, "Get Current Location", or manually.</li>
                    <li><strong>Corners:</strong> Minimum 3, maximum 7. Use the buttons to add/remove corners.</li>
                    <li>Land mapping posts are <strong>automatically approved</strong> and appear immediately.</li>
                  </ul>
                </div>
              </div>
            </div>
          </form>
        </div>

        <footer className="mt-12 pt-8 border-t text-center text-gray-600 text-sm">
          <div className="flex justify-center space-x-6 mb-4">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
            <Link href="/add-testimony" className="hover:text-blue-600">Add Testimony</Link>
            <Link href="/map-land-here" className="hover:text-blue-600">Map Land Here</Link>
          </div>
          <p>© 2026 Testimony App. All rights reserved.</p>
          <p className="mt-2">Share Location Coordinates</p>
        </footer>
      </div>
    </div>
  );
}