import React, { useState } from 'react';
import { migrateFirestoreSpots } from '../../utils/migrateFirestoreSpots';

export default function MigrateSpots() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleMigrate = async () => {
    if (!window.confirm('This will update all Firestore spots to add region, approvalStatus, and deleted fields. Continue?')) {
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const migrationResult = await migrateFirestoreSpots();
      setResult(migrationResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Migrate Firestore Spots</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-yellow-800 mb-2">⚠️ Important</h2>
        <p className="text-yellow-700 text-sm">
          This migration adds missing fields (region, approvalStatus, deleted) to existing spots in Firestore.
          This is required for the mobile app's region-based sync to work properly.
        </p>
      </div>

      <button
        onClick={handleMigrate}
        disabled={isRunning}
        className={`px-6 py-3 rounded-lg font-semibold ${
          isRunning
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isRunning ? 'Migrating...' : 'Run Migration'}
      </button>

      {result && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2">✅ Migration Complete</h3>
          <ul className="text-green-700 text-sm space-y-1">
            <li>Updated: {result.updatedCount} spots</li>
            <li>Skipped: {result.skippedCount} spots (already migrated)</li>
            <li>Errors: {result.errorCount} spots</li>
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">❌ Migration Failed</h3>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
