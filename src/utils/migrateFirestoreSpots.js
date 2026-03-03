import firebase from 'firebase/app';
import 'firebase/firestore';
import { firebaseConfig } from '../config';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

/**
 * Migration script to add missing fields to existing Firestore spots
 * Run this once to populate region, approvalStatus, mapSnapshotPath, and deleted fields
 */
export async function migrateFirestoreSpots() {
  console.log('🔄 Starting Firestore spots migration...');
  
  try {
    const spotsRef = firestore.collection('public_spots');
    const snapshot = await spotsRef.get();
    
    console.log(`📊 Found ${snapshot.docs.length} spots to check`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const spotDoc of snapshot.docs) {
      const data = spotDoc.data();
      const spotId = spotDoc.id;
      
      try {
        // Always re-derive region from coordinates to fix incorrect regions
        let region = null;
        if (data.latitude && data.longitude) {
          region = determineRegionFromCoordinates(data.latitude, data.longitude);
        }
        
        // Fallback to 'US East' if no region detected
        if (!region) {
          region = 'US East';
        }
        
        const updates = {
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        // Always update region based on coordinates
        updates.region = region;
        if (data.approvalStatus === undefined) {
          updates.approvalStatus = 'approved';
        }
        if (data.deleted === undefined) {
          updates.deleted = false;
        }
        if (data.mapSnapshotPath === undefined) {
          updates.mapSnapshotPath = null;
        }
        
        await firestore.collection('public_spots').doc(spotId).update(updates);
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log(`   Progress: ${updatedCount} spots updated...`);
        }
      } catch (error) {
        console.error(`❌ Error updating spot ${spotId}:`, error);
        errorCount++;
      }
    }
    
    console.log('✅ Migration complete!');
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    return { updatedCount, skippedCount, errorCount };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Determine region from coordinates
 * Same logic as mobile app's RegionDetectorService
 */
function determineRegionFromCoordinates(lat, lng) {
  const regionBounds = {
    'Caribbean': [10.0, 28.0, -85.0, -60.0],
    'Mediterranean': [30.0, 46.0, -6.0, 37.0],
    'Pacific': [-30.0, 30.0, -180.0, -70.0],
    'US East': [36.5, 39.5, -77.5, -75.0],
    'Great Lakes': [41.0, 49.0, -93.0, -76.0],
  };
  
  for (const [regionName, bounds] of Object.entries(regionBounds)) {
    const [minLat, maxLat, minLng, maxLng] = bounds;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return regionName;
    }
  }
  
  return null; // Unknown region
}
