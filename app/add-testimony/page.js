// app/add-testimony/page.js - WITH PROPER PLACE NAME CAPTURE + AUDIO ALONGSIDE IMAGE
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';

export default function AddTestimonyPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [postType, setPostType] = useState('text');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);               // main media file (image/video/audio)
  const [filePreview, setFilePreview] = useState('');
  const [audioFile, setAudioFile] = useState(null);     // additional audio for image posts
  
  // Location states
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Upload states
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. CHECK AUTH
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

  // 2. GET LOCATION WITH PLACE NAME
  const getLocationWithPlaceName = () => {
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
            
            let placeName = 'Unknown Location';
            let detailedAddress = {};
            
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`
              );
              
              if (response.ok) {
                const data = await response.json();
                
                if (data.address) {
                  const address = data.address;
                  detailedAddress = address;
                  
                  const addressParts = [];
                  
                  if (address.road) addressParts.push(address.road);
                  if (address.house_number) addressParts.push(address.house_number);
                  if (address.neighbourhood) addressParts.push(address.neighbourhood);
                  if (address.suburb) addressParts.push(address.suburb);
                  if (address.city) addressParts.push(address.city);
                  else if (address.town) addressParts.push(address.town);
                  else if (address.village) addressParts.push(address.village);
                  else if (address.municipality) addressParts.push(address.municipality);
                  if (address.state) addressParts.push(address.state);
                  if (address.country) addressParts.push(address.country);
                  
                  if (addressParts.length > 0) {
                    placeName = addressParts.join(', ');
                  }
                  
                  let shortPlaceName = '';
                  if (address.road) {
                    shortPlaceName = address.road;
                    if (address.house_number) shortPlaceName = `${address.house_number} ${shortPlaceName}`;
                    if (address.city || address.town || address.village) {
                      shortPlaceName += `, ${address.city || address.town || address.village}`;
                    }
                  } else {
                    shortPlaceName = placeName;
                  }
                  
                  detailedAddress.shortPlaceName = shortPlaceName;
                  detailedAddress.fullPlaceName = placeName;
                }
              }
            } catch (geocodeError) {
              console.log('Geocoding failed, using coordinates as fallback:', geocodeError);
              placeName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
              detailedAddress = {
                coordinates: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                shortPlaceName: placeName,
                fullPlaceName: placeName
              };
            }

            const locationData = {
              latitude,
              longitude,
              accuracy,
              placeName: detailedAddress.shortPlaceName || placeName,
              detailedAddress: detailedAddress,
              timestamp: new Date().toISOString(),
            };
            
            setLocation(locationData);
            setIsGettingLocation(false);
            console.log('✅ Detailed location captured:', locationData);
            resolve(locationData);
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
              errorMessage = 'Location permission denied. Please enable location to post.';
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
          timeout: 20000,
          maximumAge: 0,
        }
      );
    });
  };

  // 3. HANDLE MAIN FILE SELECTION
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Max 500MB
    if (selectedFile.size > 500 * 1024 * 1024) {
      setError('File size must be less than 500MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    if (postType === 'image' && selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview('');
    }
  };

  // 4. HANDLE AUDIO FILE SELECTION (for image posts)
  const handleAudioFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > 500 * 1024 * 1024) {
      setError('Audio file size must be less than 500MB');
      return;
    }

    setAudioFile(selectedFile);
    setError('');
  };

  // 5. MANUALLY REQUEST LOCATION
  const handleRequestLocation = async () => {
    try {
      const loc = await getLocationWithPlaceName();
      alert(`Location captured: ${loc.placeName}`);
      setLocation(loc);
    } catch (error) {
      // Error already shown
    }
  };

  // 6. HANDLE FORM SUBMISSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to post');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      // Get location with place name
      let locationData = null;
      try {
        console.log('📍 Attempting to get location with place name...');
        locationData = await getLocationWithPlaceName();
        console.log('✅ Location obtained:', locationData);
      } catch (locError) {
        console.log('⚠️ Location not available:', locError.message);
        if (!confirm('Could not get your location. Post without location?')) {
          setUploading(false);
          return;
        }
      }

      // Upload main file if needed
      let mediaUrl = '';
      let fileName = '';

      if (postType !== 'text' && file) {
        fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `testimonies/${user.uid}/${fileName}`);
        await uploadBytes(storageRef, file);
        mediaUrl = await getDownloadURL(storageRef);
      }

      // Upload audio file if present (for image posts)
      let audioUrl = '';
      if (postType === 'image' && audioFile) {
        const audioFileName = `${Date.now()}_audio_${audioFile.name}`;
        const audioStorageRef = ref(storage, `testimonies/${user.uid}/${audioFileName}`);
        await uploadBytes(audioStorageRef, audioFile);
        audioUrl = await getDownloadURL(audioStorageRef);
      }

      // Prepare testimony data
      const testimonyData = {
        userId: user.uid,
        userPhone: user.phoneNumber || '',
        userName: `User ${user.phoneNumber || 'Anonymous'}`,
        title: title || '',
        description: description || '',
        content: description || '',
        type: postType,
        mediaUrl: mediaUrl || '',
        audioUrl: audioUrl || '',        // new field for additional audio
        fileName: fileName || '',
        status: 'pending',
        location: locationData ? {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          placeName: locationData.placeName,
          detailedAddress: locationData.detailedAddress,
          timestamp: locationData.timestamp
        } : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('📝 Saving testimony with location and audio:', testimonyData);

      const docRef = await addDoc(collection(db, 'testimonies'), testimonyData);
      
      console.log('✅ Testimony saved with ID:', docRef.id);
      
      setSuccess(`Testimony posted successfully! ${locationData ? `Location: ${locationData.placeName}` : 'No location captured.'}`);
      
      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      setFilePreview('');
      setAudioFile(null);
      setLocation(null);
      setLocationError('');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('❌ Error posting testimony:', err);
      setError(`Failed to post: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 7. SHOW LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // 8. MAIN FORM UI
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New Testimony</h1>
              <p className="text-gray-600 mt-2">
                Share your experience through text, image, audio, or video.
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
            {/* POST TYPE SELECTION */}
            <div className="mb-8">
              <h2 className="text-lg font-medium mb-4">Choose Testimony Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { type: 'text', label: '📝 Text', desc: 'Write your story' },
                  { type: 'image', label: '🖼️ Image', desc: 'Upload an image (can add audio)' },
                  { type: 'audio', label: '🎤 Audio', desc: 'Upload audio' },
                  { type: 'video', label: '🎥 Video', desc: 'Upload video' },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setPostType(item.type);
                      setFile(null);
                      setFilePreview('');
                      setAudioFile(null); // Clear audio when switching types
                    }}
                    className={`p-4 border-2 rounded-lg text-center transition ${postType === item.type ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="text-2xl mb-2">{item.label.split(' ')[0]}</div>
                    <div className="font-medium">{item.label.split(' ')[1]}</div>
                    <div className="text-sm text-gray-500 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* LOCATION CAPTURE SECTION */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h2 className="text-lg font-medium text-gray-700 mb-3">📍 Location Capture</h2>
              <p className="text-sm text-gray-600 mb-3">
                Your location will be captured automatically when you submit. 
                This helps show where testimonies are coming from.
              </p>
              
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm">
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${location ? 'text-green-600' : 'text-yellow-600'}`}>
                    {location ? '✅ Ready to capture' : '⏳ Will capture on submit'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRequestLocation}
                  disabled={isGettingLocation}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {isGettingLocation ? 'Getting Location...' : 'Test Now'}
                </button>
              </div>

              {locationError && (
                <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
                  ❌ {locationError}
                </div>
              )}

              {location && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="font-medium text-green-700 mb-2">
                    📍 {location.placeName}
                  </div>
                  {location.detailedAddress?.road && (
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Street:</span> {location.detailedAddress.road}
                      {location.detailedAddress.house_number && ` ${location.detailedAddress.house_number}`}
                    </div>
                  )}
                  {location.detailedAddress?.neighbourhood && (
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Neighborhood:</span> {location.detailedAddress.neighbourhood}
                    </div>
                  )}
                  {location.detailedAddress?.city && (
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">City:</span> {location.detailedAddress.city}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    <br />
                    Accuracy: ~{Math.round(location.accuracy)} meters
                  </div>
                </div>
              )}
            </div>

            {/* TITLE INPUT */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your testimony a title"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* DESCRIPTION OR TEXT TESTIMONY */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {postType === 'text' ? 'Your Testimony' : 'Description (Optional)'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={postType === 'text' ? 8 : 4}
                placeholder={postType === 'text' ? 'Write your full testimony here...' : 'Add a description...'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* MAIN FILE UPLOAD (for non-text types) */}
            {postType !== 'text' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload {postType === 'image' ? 'Image' : postType === 'audio' ? 'Audio' : 'Video'}
                </label>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept={
                        postType === 'image' ? 'image/*' :
                        postType === 'audio' ? 'audio/*' :
                        'video/*'
                      }
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer block"
                    >
                      <div className="text-4xl mb-2">
                        {postType === 'image' ? '🖼️' :
                         postType === 'audio' ? '🎤' : '🎥'}
                      </div>
                      <div className="text-blue-600 font-medium">
                        Click to choose a file
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {postType === 'image' ? 'JPG, PNG, GIF (max 500MB)' :
                         postType === 'audio' ? 'MP3, WAV, AAC (max 500MB)' :
                         'MP4, MOV, AVI (max 500MB)'}
                      </div>
                    </label>
                  </div>

                  {/* MAIN FILE INFO & PREVIEW */}
                  {file && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Selected file:</div>
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            setFilePreview('');
                          }}
                          className="text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                      
                      {/* IMAGE PREVIEW */}
                      {postType === 'image' && filePreview && (
                        <div className="mt-4">
                          <div className="font-medium mb-2">Preview:</div>
                          <img
                            src={filePreview}
                            alt="Preview"
                            className="max-w-full h-48 object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ADDITIONAL AUDIO UPLOAD FOR IMAGE POSTS */}
            {postType === 'image' && (
              <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-lg font-medium text-gray-700 mb-3">🎤 Add Audio Narration (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You can also upload an audio file to accompany your image. This will be played alongside the image.
                </p>
                
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      onChange={handleAudioFileChange}
                      accept="audio/*"
                      className="hidden"
                      id="audio-upload"
                    />
                    <label
                      htmlFor="audio-upload"
                      className="cursor-pointer block"
                    >
                      <div className="text-4xl mb-2">🎤</div>
                      <div className="text-purple-600 font-medium">
                        Click to choose an audio file
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        MP3, WAV, AAC (max 500MB)
                      </div>
                    </label>
                  </div>

                  {audioFile && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Selected audio:</div>
                        <button
                          type="button"
                          onClick={() => setAudioFile(null)}
                          className="text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        🎵 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <div className="flex space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || (postType !== 'text' && !file)}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Posting...
                  </span>
                ) : (
                  'Post Testimony'
                )}
              </button>
            </div>

            {/* FORM NOTES */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start">
                <div className="text-yellow-500 mr-3">ℹ️</div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Important Information:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your <strong>location (place name)</strong> will be automatically captured when you submit.</li>
                    <li>All testimonies require <strong>admin approval</strong> before appearing publicly.</li>
                    <li>You can edit or delete your testimony only while it's <strong>pending approval</strong>.</li>
                    <li>For image posts, you can optionally add an audio narration.</li>
                    <li>Max file size per file: 500MB.</li>
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
            <Link href="/map-land-here" className="hover:text-blue-600">Map Land Here</Link>
          </div>
          <p>© 2026 Testimony App. All rights reserved.</p>
          <p className="mt-2">Share Your Story</p>
        </footer>
      </div>
    </div>
  );
}