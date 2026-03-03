import React, { useState } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { firebaseConfig } from '../../config';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

export default function TestFirestoreQuery() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const testQuery = async () => {
    setLoading(true);
    setResults(null);

    try {
      // Test 1: Get first 5 spots with region field
      const spotsWithRegion = await firestore
        .collection('public_spots')
        .where('region', '==', 'Chesapeake Bay')
        .limit(5)
        .get();

      // Test 2: Get first 5 spots total
      const allSpots = await firestore
        .collection('public_spots')
        .limit(5)
        .get();

      // Test 3: Count spots by region
      const regionCounts = {};
      const regionSnapshot = await firestore
        .collection('public_spots')
        .limit(100)
        .get();

      regionSnapshot.docs.forEach(doc => {
        const region = doc.data().region;
        if (region) {
          regionCounts[region] = (regionCounts[region] || 0) + 1;
        } else {
          regionCounts['<no region>'] = (regionCounts['<no region>'] || 0) + 1;
        }
      });

      setResults({
        chesapeakeCount: spotsWithRegion.docs.length,
        chesapeakeSample: spotsWithRegion.docs.slice(0, 3).map(d => ({
          id: d.id,
          name: d.data().name,
          region: d.data().region,
          lat: d.data().latitude,
          lng: d.data().longitude,
        })),
        allSpotsSample: allSpots.docs.slice(0, 3).map(d => ({
          id: d.id,
          name: d.data().name,
          region: d.data().region,
          lat: d.data().latitude,
          lng: d.data().longitude,
        })),
        regionCounts,
      });
    } catch (error) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Firestore Query</h1>

      <button
        onClick={testQuery}
        disabled={loading}
        className={`px-6 py-3 rounded-lg font-semibold mb-6 ${
          loading
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? 'Testing...' : 'Run Test Query'}
      </button>

      {results && (
        <div className="space-y-6">
          {results.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2">❌ Error</h3>
              <p className="text-red-700 text-sm">{results.error}</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">
                  Chesapeake Bay Query Results
                </h3>
                <p className="text-blue-700 text-sm mb-2">
                  Found: {results.chesapeakeCount} spots
                </p>
                {results.chesapeakeSample.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold mb-1">Sample spots:</p>
                    <pre className="text-xs bg-white p-2 rounded overflow-auto">
                      {JSON.stringify(results.chesapeakeSample, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">
                  All Spots Sample (first 3)
                </h3>
                <pre className="text-xs bg-white p-2 rounded overflow-auto">
                  {JSON.stringify(results.allSpotsSample, null, 2)}
                </pre>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-800 mb-2">
                  Region Distribution (first 100 spots)
                </h3>
                <pre className="text-xs bg-white p-2 rounded overflow-auto">
                  {JSON.stringify(results.regionCounts, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
