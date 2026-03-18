import axios from 'axios';

/**
 * Generate a map snapshot URL using Mapbox Static Images API
 * @param {Object} options - Snapshot configuration
 * @param {number} options.latitude - Latitude coordinate
 * @param {number} options.longitude - Longitude coordinate
 * @param {number} [options.zoom=15] - Zoom level
 * @param {number} [options.width=400] - Image width
 * @param {number} [options.height=400] - Image height
 * @param {number} [options.bearing=0] - Map bearing/rotation
 * @param {number} [options.pitch=0] - Map pitch/tilt
 * @returns {string} Mapbox Static Images API URL
 */
export function generateMapboxSnapshotUrl({
  latitude,
  longitude,
  zoom = 15,
  width = 400,
  height = 400,
  bearing = 0,
  pitch = 0,
}) {
  // Validate coordinates
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid coordinates: lat=${latitude}, lng=${longitude}`);
  }

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    throw new Error('VITE_MAPBOX_ACCESS_TOKEN not configured');
  }

  // Mapbox Static Images API URL
  // Format: /styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}{@2x}
  const styleId = 'outdoors-v12';
  const overlay = `pin-s+2196F3(${longitude},${latitude})`; // Blue marker at center
  const url = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${overlay}/${longitude},${latitude},${zoom},${bearing},${pitch}/${width}x${height}@2x?access_token=${mapboxToken}`;

  return url;
}

/**
 * Download a map snapshot from Mapbox Static Images API
 * @param {Object} options - Snapshot configuration
 * @returns {Promise<Blob>} PNG image blob
 */
export async function downloadMapboxSnapshot(options) {
  const url = generateMapboxSnapshotUrl(options);

  console.log(`📸 Downloading snapshot: lat=${options.latitude}, lng=${options.longitude}`);

  try {
    const response = await axios.get(url, {
      responseType: 'blob',
      timeout: 30000,
    });

    console.log(`✅ Snapshot downloaded: ${response.data.size} bytes`);
    return response.data;
  } catch (error) {
    console.error('❌ Mapbox API error:', error.message);
    throw new Error(`Failed to download snapshot: ${error.message}`);
  }
}

/**
 * Upload a snapshot blob to Firebase Storage (R2)
 * @param {Blob} blob - Image blob
 * @param {string} r2Key - R2 storage key (path)
 * @param {Object} storage - Firebase storage instance
 * @returns {Promise<string>} R2 key of uploaded image
 */
export async function uploadSnapshotToR2(blob, r2Key, storage) {
  console.log(`📤 Uploading snapshot to R2: ${r2Key}`);

  try {
    const storageRef = storage.ref(r2Key);
    
    // Upload blob
    await storageRef.put(blob, {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    });

    // Make file publicly accessible
    await storageRef.updateMetadata({
      cacheControl: 'public, max-age=31536000',
    });

    console.log(`✅ Snapshot uploaded to R2: ${r2Key}`);
    return r2Key;
  } catch (error) {
    console.error('❌ R2 upload error:', error.message);
    throw new Error(`Failed to upload snapshot to R2: ${error.message}`);
  }
}

/**
 * Generate and upload a map snapshot
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {string} r2Key - R2 storage key
 * @param {Object} storage - Firebase storage instance
 * @returns {Promise<string>} R2 key of uploaded snapshot
 */
export async function generateAndUploadSnapshot(latitude, longitude, r2Key, storage) {
  console.log(`🗺️ Generating and uploading snapshot for ${latitude}, ${longitude}`);

  // Download snapshot from Mapbox
  const blob = await downloadMapboxSnapshot({
    latitude,
    longitude,
    zoom: 15,
    width: 400,
    height: 400,
  });

  // Upload to R2
  await uploadSnapshotToR2(blob, r2Key, storage);

  return r2Key;
}
