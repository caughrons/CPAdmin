/**
 * CruisaPalooza Admin — Type definitions
 * These mirror the Dart models in the CruisaPalooza mobile app.
 * See CONTEXT.md for full schema reference.
 */

/**
 * @typedef {Object} SpotChangeRequest
 * @property {string} requestId
 * @property {'create'|'update'|'delete'|'privacy_change'} requestType
 * @property {string|null} spotId
 * @property {string|null} publicSpotId
 * @property {string} requesterId
 * @property {string} requesterEmail
 * @property {'pending'|'approved'|'rejected'} status
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {import('firebase/firestore').Timestamp|null} reviewedAt
 * @property {string|null} reviewedBy
 * @property {string|null} reviewNotes
 * @property {Object|null} proposedData
 * @property {Object|null} originalData
 * @property {string|null} deleteReason
 */

/**
 * @typedef {Object} PublicSpot
 * @property {string} uuid
 * @property {string} name
 * @property {'marina'|'anchorage'|'fuel_dock'|'pump_out'|'restaurant'|'beach'|'park'|'bridge'|'lock'|'hazard'|'other'} type
 * @property {string|null} description
 * @property {number} latitude
 * @property {number} longitude
 * @property {'approved'|'pending_approval'|'pending_changes'|'rejected'} approvalStatus
 * @property {string|null} ownerId
 * @property {string|null} primaryImageR2Key
 * @property {number|null} averageRating
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {import('firebase/firestore').Timestamp} updatedAt
 */

/**
 * @typedef {Object} NewsStory
 * @property {string} storyId
 * @property {'A'|'B'} tier
 * @property {string} section
 * @property {string} headline
 * @property {string} content
 * @property {string} source
 * @property {string|null} sourceDisplayName
 * @property {string} region
 * @property {string|null} imageUrl
 * @property {string|null} imageR2Key
 * @property {'pending'|'released'|'deleted'} status
 * @property {import('firebase/firestore').Timestamp} scheduledRelease
 * @property {import('firebase/firestore').Timestamp|null} actualRelease
 * @property {import('firebase/firestore').Timestamp} createdAt
 */

/**
 * @typedef {Object} FeedGroup
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {'user'|'partner'|'sponsor'|'official'} group_type
 * @property {'public'|'request'|'invite_only'|'contacts_only'} privacy
 * @property {number|null} location_lat
 * @property {number|null} location_lng
 * @property {number|null} location_radius_nm
 * @property {string} created_by
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} member_count
 * @property {number} post_count
 * @property {string|null} avatar_url
 * @property {string|null} avatar_r2_key
 * @property {string[]|null} tags
 */

/**
 * @typedef {Object} AppUser
 * @property {string} uid
 * @property {string} email
 * @property {string} displayName
 * @property {string|null} avatar
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {import('firebase/firestore').Timestamp|null} lastActiveAt
 */

/**
 * @typedef {Object} UserLocation
 * @property {number} latitude
 * @property {number} longitude
 * @property {number|null} heading
 * @property {number|null} speed
 * @property {number} timestamp
 * @property {boolean} isSharing
 */
