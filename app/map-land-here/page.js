// app/map-land-here/page.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(
  () => import('@/app/components/MapPicker'),
  { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 animate-pulse rounded-lg"></div> }
);

export default function AddCoordinatesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Default 4 corners
  const [corners, setCorners] = useState([
    { lat: '', lng: '' },
    { lat: '', lng: '' },
    { lat: '', lng: '' },
    { lat: '', lng: '' }
  ]);
  const [gettingCornerIndex, setGettingCornerIndex] = useState(null);

  // Document upload
  const [documents, setDocuments] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else router.push('/login');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

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
      if (!navigator.geolocation) reject(new Error('Geolocation not supported'));
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            setLatitude(latitude.toFixed(6));
            setLongitude(longitude.toFixed(6));
            await fetchPlaceName(latitude, longitude);
            setIsGettingLocation(false);
            resolve({ latitude: latitude.toFixed(6), longitude: longitude.toFixed(6), placeName });
          } catch (err) { reject(err); }
        },
        (error) => {
          setIsGettingLocation(false);
          let msg = 'Location error.';
          if (error.code === 1) msg = 'Permission denied';
          else if (error.code === 2) msg = 'Location unavailable';
          else if (error.code === 3) msg = 'Timeout';
          setLocationError(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const getCornerLocation = async (index) => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    setGettingCornerIndex(index);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
      });
      const { latitude, longitude } = position.coords;
      const updated = [...corners];
      updated[index] = { lat: latitude.toFixed(6), lng: longitude.toFixed(6) };
      setCorners(updated);
    } catch (err) {
      alert('Failed to get location');
    } finally {
      setGettingCornerIndex(null);
    }
  };

  const addCorner = () => {
    if (corners.length >= 7) {
      alert('Maximum 7 corners allowed.');
      return;
    }
    setCorners([...corners, { lat: '', lng: '' }]);
  };

  const removeCorner = () => {
    if (corners.length <= 3) {
      alert('Minimum 3 corners required.');
      return;
    }
    const newCorners = [...corners];
    newCorners.pop();
    setCorners(newCorners);
  };

  // Document upload
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length === 0) return;
    // Limit to 10 files
    if (documents.length + files.length > 10) {
      alert('You can upload up to 10 documents.');
      return;
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Check if image
      if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed.');
        continue;
      }
      // Add to list with a temporary id
      setDocuments(prev => [...prev, { id: Date.now() + i, file, url: null, uploading: false, progress: 0 }]);
    }
    // Reset input
    e.target.value = '';
  };

  const uploadDocument = async (docItem) => {
    try {
      setDocUploadProgress(prev => ({ ...prev, [docItem.id]: 0 }));
      setDocuments(prev => prev.map(d => d.id === docItem.id ? { ...d, uploading: true } : d));

      const file = docItem.file;
      const storageRef = ref(storage, `land_documents/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setDocUploadProgress(prev => ({ ...prev, [docItem.id]: progress }));
          },
          reject,
          resolve
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      setDocuments(prev => prev.map(d => 
        d.id === docItem.id ? { ...d, url: downloadURL, uploading: false } : d
      ));
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Failed to upload ${file.name}`);
      setDocuments(prev => prev.filter(d => d.id !== docItem.id));
    }
  };

  const removeDocument = (id) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  // Submit
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
      const latC = parseFloat(corner.lat);
      const lngC = parseFloat(corner.lng);
      if (isNaN(latC) || isNaN(lngC) || latC < -90 || latC > 90 || lngC < -180 || lngC > 180) {
        setError(`Corner ${i+1} coordinates invalid.`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in');
      return;
    }

    // --- NEW: Validate documents ---
    if (documents.length === 0) {
      setError('At least one land document is required.');
      return;
    }

    // Check if any document is still uploading (should not happen before submit, but safety)
    if (documents.some(d => d.uploading)) {
      setError('Please wait for documents to finish uploading.');
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
          const loc = await getCurrentLocation();
          mainLat = loc.latitude;
          mainLng = loc.longitude;
          mainPlaceName = placeName;
        } catch (locError) {
          setError('Could not get location. Please enter manually.');
          setSubmitting(false);
          return;
        }
      }

      if (!validateCoordinates(mainLat, mainLng, corners)) {
        setSubmitting(false);
        return;
      }

      // Upload any documents that haven't been uploaded yet
      const docsToUpload = documents.filter(d => !d.url);
      for (const doc of docsToUpload) {
        await uploadDocument(doc);
      }

      // After upload, verify all documents have URLs
      const allHaveUrls = documents.every(d => d.url !== null);
      if (!allHaveUrls) {
        setError('Some documents failed to upload. Please try again.');
        setSubmitting(false);
        return;
      }

      // Collect final document URLs
      const docUrls = documents.map(d => ({ url: d.url, name: d.file.name, uploadedAt: new Date().toISOString() }));

      const coordinateData = {
        type: 'coordinates',
        title: title || '',
        description: description || '',
        coordinates: {
          latitude: parseFloat(mainLat),
          longitude: parseFloat(mainLng),
          placeName: mainPlaceName || `${parseFloat(mainLat).toFixed(4)}, ${parseFloat(mainLng).toFixed(4)}`,
          accuracy: 50,
          timestamp: new Date().toISOString(),
        },
        fourCorners: corners.map(c => ({
          latitude: parseFloat(c.lat),
          longitude: parseFloat(c.lng)
        })),
        documents: docUrls,
        verified: false,
        status: 'approved',
        userId: user.uid,
        userPhone: user.phoneNumber || '',
        userName: user.displayName || `User ${user.phoneNumber || 'Anonymous'}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'testimonies'), coordinateData);
      setSuccess(`Land mapped successfully! (${corners.length} corners)`);
      
      // Reset form
      setTitle('');
      setDescription('');
      setLatitude('');
      setLongitude('');
      setPlaceName('');
      setCorners([
        { lat: '', lng: '' },
        { lat: '', lng: '' },
        { lat: '', lng: '' },
        { lat: '', lng: '' }
      ]);
      setDocuments([]);
      setLocationError('');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err) {
      console.error(err);
      setError(`Failed to map land: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Map Land Here</h1>
              <p className="text-gray-600 mt-2">Define a land area with <strong>3 to 7 corners</strong> and upload supporting documents.</p>
            </div>
            <Link href="/dashboard" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">← Back</Link>
          </div>
        </header>

        {success && <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">✅ {success}</div>}
        {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">❌ {error}</div>}

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Title (Optional)</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            </div>

            {/* Main Location */}
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h2 className="text-lg font-medium text-gray-700 mb-3">🗺️ Main Location</h2>
              <MapPicker initialLat={latitude} initialLng={longitude} onPositionChange={handleMapPositionChange} height="400px" />
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-md font-medium text-gray-700 mb-3">📍 Main Coordinates</h3>
                <button type="button" onClick={getCurrentLocation} disabled={isGettingLocation} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4">
                  {isGettingLocation ? 'Getting...' : '📡 Get Current Location'}
                </button>
                {locationError && <div className="text-red-600 mb-4">{locationError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude" className="px-4 py-3 border border-gray-300 rounded-lg" />
                  <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude" className="px-4 py-3 border border-gray-300 rounded-lg" />
                </div>
                <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Place Name" className="w-full px-4 py-3 border border-gray-300 rounded-lg mt-4" />
              </div>
            </div>

            {/* Dynamic Corners */}
            <div className="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-medium text-gray-700">🔲 Land Corners ({corners.length} corners)</h2>
                <div className="space-x-2">
                  <button type="button" onClick={addCorner} className="px-3 py-1 bg-purple-600 text-white rounded text-sm">+ Add</button>
                  <button type="button" onClick={removeCorner} className="px-3 py-1 bg-red-600 text-white rounded text-sm">- Remove</button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">Min 3, max 7. Tap 📍 to use current location.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {corners.map((corner, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border border-purple-100">
                    <h3 className="font-bold text-purple-800 mb-3">Corner {index+1}</h3>
                    <div className="space-y-3">
                      <input type="text" value={corner.lat} onChange={(e) => {
                        const updated = [...corners]; updated[index].lat = e.target.value; setCorners(updated);
                      }} placeholder="Latitude" className="w-full px-3 py-2 border border-gray-300 rounded" />
                      <input type="text" value={corner.lng} onChange={(e) => {
                        const updated = [...corners]; updated[index].lng = e.target.value; setCorners(updated);
                      }} placeholder="Longitude" className="w-full px-3 py-2 border border-gray-300 rounded" />
                      <button type="button" onClick={() => getCornerLocation(index)} disabled={gettingCornerIndex !== null} className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm">
                        {gettingCornerIndex === index ? 'Getting...' : '📍 Use Current'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Upload - NOW REQUIRED */}
            <div className="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h2 className="text-lg font-medium text-gray-700 mb-3">📎 Upload Land Documents <span className="text-red-600">*Required</span></h2>
              <p className="text-sm text-gray-600 mb-4">Upload at least one image (max 10) as proof of land ownership. Land admin will verify.</p>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="hidden"
                  id="doc-upload"
                />
                <label htmlFor="doc-upload" className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
                  Choose Files
                </label>
                <span className="text-sm text-gray-500">{documents.length} files selected</span>
              </div>
              {documents.length === 0 && (
                <p className="text-red-500 text-sm mt-2">⚠️ At least one document is required.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-gray-100 p-2 rounded-lg flex items-center gap-2">
                    <span className="text-xs truncate max-w-[100px]">{doc.file.name}</span>
                    {doc.uploading && <span className="text-xs text-blue-600">{Math.round(docUploadProgress[doc.id] || 0)}%</span>}
                    {doc.url && <span className="text-green-600">✅</span>}
                    <button type="button" onClick={() => removeDocument(doc.id)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                  </div>
                ))}
              </div>
              {documents.some(d => d.uploading) && <div className="mt-2 text-sm text-blue-600">Uploading documents...</div>}
            </div>

            <div className="flex space-x-4 pt-6 border-t">
              <button type="button" onClick={() => router.push('/dashboard')} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50" disabled={submitting}>Cancel</button>
              <button type="submit" disabled={submitting || documents.length === 0} className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? 'Mapping...' : 'Map Land'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}