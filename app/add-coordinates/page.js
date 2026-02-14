// app/add-coordinates/page.js - UPDATED WITH FOUR CORNERS FEATURE + AUTO-POPULATE ON SUBMIT
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import MapPicker to avoid SSR issues
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
  
  // Four corners state
  const [corners, setCorners] = useState([
    { lat: '', lng: '' }, // corner 1
    { lat: '', lng: '' }, // corner 2
    { lat: '', lng: '' }, // corner 3
    { lat: '', lng: '' }  // corner 4
  ]);
  const [gettingCornerIndex, setGettingCornerIndex] = useState(null); // which corner is getting location
  
  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. CHECK AUTH - User must be logged in
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

  // 2. Handle map position changes (main coordinate)
  const handleMapPositionChange = (lat, lng) => {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    
    // Auto-fetch place name for the new coordinates
    fetchPlaceName(lat, lng);
  };

  // 3. Fetch place name from coordinates
  const fetchPlaceName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=16`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.display_name) {
          // Get a concise place name
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
      console.log('Geocoding failed, using coordinates as place name:', error);
      setPlaceName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  // 4. GET CURRENT LOCATION (Auto-fill main coordinates) - now returns coordinates
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      setIsGettingLocation(true);
      setLocationError('');

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords;
            
            // Set coordinates in state
            setLatitude(latitude.toFixed(6));
            setLongitude(longitude.toFixed(6));
            
            // Fetch place name
            await fetchPlaceName(latitude, longitude);
            
            setIsGettingLocation(false);
            // Resolve with the coordinates so they can be used directly
            resolve({ 
              latitude: latitude.toFixed(6), 
              longitude: longitude.toFixed(6), 
              placeName: placeName // note: placeName state might not be updated yet, but we'll re-fetch in handleSubmit if needed
            });
          } catch (error) {
            setIsGettingLocation(false);
            reject(error);
          }
        },
        (error) => {
          setIsGettingLocation(false);
          let errorMessage = '';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location services.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
            default:
              errorMessage = 'An unknown error occurred.';
              break;
          }
          setLocationError(errorMessage);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  // 5. Get location for a specific corner
  const getCornerLocation = async (index) => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
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
      
      // Update the specific corner
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

  // 6. Handle manual coordinate input changes (main)
  const handleLatitudeChange = (value) => {
    setLatitude(value);
    const lat = parseFloat(value);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      fetchPlaceName(lat, lng);
    }
  };

  const handleLongitudeChange = (value) => {
    setLongitude(value);
    const lat = parseFloat(latitude);
    const lng = parseFloat(value);
    if (!isNaN(lat) && !isNaN(lng)) {
      fetchPlaceName(lat, lng);
    }
  };

  // 7. Handle corner input changes
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

  // 8. Validate all coordinates are filled
  const validateCoordinates = (mainLat, mainLng, cornersArray) => {
    // Main coordinates
    if (!mainLat || !mainLng) {
      setError('Main coordinates are required. Use the map, "Get Current Location", or enter manually.');
      return false;
    }
    const lat = parseFloat(mainLat);
    const lng = parseFloat(mainLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Main coordinates are invalid. Latitude: -90 to 90, Longitude: -180 to 180.');
      return false;
    }

    // Four corners
    for (let i = 0; i < cornersArray.length; i++) {
      const corner = cornersArray[i];
      if (!corner.lat || !corner.lng) {
        setError(`Corner ${i+1} coordinates are required. Please fill all four corners.`);
        return false;
      }
      const latCorner = parseFloat(corner.lat);
      const lngCorner = parseFloat(corner.lng);
      if (isNaN(latCorner) || isNaN(lngCorner) || latCorner < -90 || latCorner > 90 || lngCorner < -180 || lngCorner > 180) {
        setError(`Corner ${i+1} coordinates are invalid.`);
        return false;
      }
    }
    return true;
  };

  // 9. HANDLE FORM SUBMISSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to post coordinates');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      let mainLat = latitude;
      let mainLng = longitude;
      let mainPlaceName = placeName;

      // If main coordinates are empty, try to get them automatically
      if (!mainLat || !mainLng) {
        try {
          const location = await getCurrentLocation();
          // Use returned values
          mainLat = location.latitude;
          mainLng = location.longitude;
          // Fetch place name again to ensure it's set
          await fetchPlaceName(parseFloat(mainLat), parseFloat(mainLng));
          mainPlaceName = placeName; // will be updated after fetchPlaceName
        } catch (locError) {
          setError('Could not get your current location. Please enter coordinates manually or allow location access.');
          setSubmitting(false);
          return;
        }
      }

      // Validate all coordinates using current values
      if (!validateCoordinates(mainLat, mainLng, corners)) {
        setSubmitting(false);
        return;
      }

      // Prepare coordinate data with four corners
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
          accuracy: 50, // Default accuracy for manual input
          timestamp: new Date().toISOString(),
        },
        fourCorners: corners.map(corner => ({
          latitude: parseFloat(corner.lat),
          longitude: parseFloat(corner.lng)
        })),
        status: 'pending',
        userId: user.uid,
        userPhone: user.phoneNumber || '',
        userName: `User ${user.phoneNumber || 'Anonymous'}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('📝 Saving coordinate post with four corners:', coordinateData);

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'testimonies'), coordinateData);
      
      console.log('✅ Coordinate post saved with ID:', docRef.id);
      
      setSuccess(`Coordinates posted successfully! Status: Pending admin approval.`);
      
      // Reset form
      setTitle('');
      setDescription('');
      setLatitude('');
      setLongitude('');
      setPlaceName('');
      setCorners([{ lat: '', lng: '' }, { lat: '', lng: '' }, { lat: '', lng: '' }, { lat: '', lng: '' }]);
      setLocationError('');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('❌ Error posting coordinates:', err);
      setError(`Failed to post coordinates: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 10. SHOW LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // 11. MAIN FORM UI
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New Coordinates</h1>
              <p className="text-gray-600 mt-2">
                Share a location or define a four‑corner land area. All fields are required.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {/* SUCCESS/ERROR MESSAGES */}
        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
            ✅ {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            ❌ {error}
          </div>
        )}

        {/* MAIN FORM */}
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit}>
            {/* TITLE INPUT */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 'Favorite Viewpoint' or 'Meeting Spot'"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* DESCRIPTION/TEXT NOTES */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description / Notes (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add any notes about this location..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* SECTION 1: INTERACTIVE MAP & MAIN COORDINATES */}
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h2 className="text-lg font-medium text-gray-700 mb-3">🗺️ Main Location</h2>
              <p className="text-sm text-gray-600 mb-4">
                This is the primary location for your post. You can also define a land area using the four corners below.
              </p>
              
              {/* MAP COMPONENT */}
              <MapPicker
                initialLat={latitude}
                initialLng={longitude}
                onPositionChange={handleMapPositionChange}
                height="400px"
              />

              {/* COORDINATES SECTION - MANUAL INPUTS */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-md font-medium text-gray-700 mb-3">📍 Main Coordinates</h3>
                
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 mb-4"
                  >
                    {isGettingLocation ? 'Getting Location...' : '📡 Get Current Location Automatically'}
                  </button>
                  
                  {locationError && (
                    <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
                      ❌ {locationError}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Latitude *
                    </label>
                    <input
                      type="text"
                      value={latitude}
                      onChange={(e) => handleLatitudeChange(e.target.value)}
                      placeholder="e.g., 8.488147"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Between -90 and 90</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Longitude *
                    </label>
                    <input
                      type="text"
                      value={longitude}
                      onChange={(e) => handleLongitudeChange(e.target.value)}
                      placeholder="e.g., -13.235127"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Between -180 and 180</p>
                  </div>
                </div>

                {/* PLACE NAME */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Place Name (Auto-filled from coordinates)
                  </label>
                  <input
                    type="text"
                    value={placeName}
                    onChange={(e) => setPlaceName(e.target.value)}
                    placeholder="Place name will be auto-filled from coordinates..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* COORDINATE PREVIEW */}
                {(latitude || longitude) && (
                  <div className="mt-4 p-3 bg-white rounded border">
                    <div className="font-medium text-gray-700 mb-2">
                      📍 Main Coordinate Preview
                    </div>
                    <div className="text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>Latitude:</div>
                        <div className="font-mono">{latitude || 'Not set'}</div>
                        <div>Longitude:</div>
                        <div className="font-mono">{longitude || 'Not set'}</div>
                        {placeName && (
                          <>
                            <div>Place Name:</div>
                            <div className="font-medium text-green-700">{placeName}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: FOUR CORNERS COORDINATES */}
            <div className="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h2 className="text-lg font-medium text-gray-700 mb-3">🔲 Four Corners (Land Area)</h2>
              <p className="text-sm text-gray-600 mb-4">
                Define the four corners of a land plot. You can enter coordinates manually or use the buttons to capture your current location at each corner.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border border-purple-100">
                    <h3 className="font-bold text-purple-800 mb-3">Corner {index + 1}</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Latitude</label>
                        <input
                          type="text"
                          value={corners[index].lat}
                          onChange={(e) => handleCornerLatChange(index, e.target.value)}
                          placeholder="Latitude"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Longitude</label>
                        <input
                          type="text"
                          value={corners[index].lng}
                          onChange={(e) => handleCornerLngChange(index, e.target.value)}
                          placeholder="Longitude"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => getCornerLocation(index)}
                        disabled={gettingCornerIndex !== null}
                        className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50 text-sm"
                      >
                        {gettingCornerIndex === index ? 'Getting...' : `GET COORDINATE ${index + 1}`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4">
                * All four corners are required. You can either type the coordinates or use the buttons to capture your current location at each corner.
              </p>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="flex space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Posting Coordinates...
                  </span>
                ) : (
                  'Post Coordinates'
                )}
              </button>
            </div>

            {/* FORM NOTES */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start">
                <div className="text-blue-500 mr-3">ℹ️</div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">About Coordinate Posts:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Main location:</strong> You can set it via map, "Get Current Location", or manually.</li>
                    <li><strong>Four corners:</strong> Required. Use the buttons to capture your current location at each corner, or enter coordinates manually.</li>
                    <li>All coordinate posts require <strong>admin approval</strong> before appearing publicly.</li>
                    <li>Once approved, they'll appear in the <strong>"Coordinates Only"</strong> tab on the homepage.</li>
                    <li>Admins can <strong>delete but not edit</strong> coordinate posts.</li>
                  </ul>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <footer className="mt-12 pt-8 border-t text-center text-gray-600 text-sm">
          <div className="flex justify-center space-x-6 mb-4">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
            <Link href="/add-testimony" className="hover:text-blue-600">Add Testimony</Link>
            <Link href="/add-coordinates" className="hover:text-blue-600">Add Coordinates</Link>
          </div>
          <p>© 2026 Testimony App. All rights reserved.</p>
          <p className="mt-2">Share Location Coordinates</p>
        </footer>
      </div>
    </div>
  );
}