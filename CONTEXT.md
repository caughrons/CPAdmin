# CruisaPalooza Admin — Backend Context

This file is the primary reference for AI assistants working in the CPAdmin repo. It describes the Firebase backend shared with the CruisaPalooza mobile app.

---

## Firebase Project

| Key | Value |
|---|---|
| **Project ID** | `cruisapalooza-5779c` |
| **Auth Domain** | `cruisapalooza-5779c.firebaseapp.com` |
| **RTDB URL** | `https://cruisapalooza-5779c-default-rtdb.firebaseio.com` |
| **Storage Bucket** | `cruisapalooza-5779c.firebasestorage.app` |
| **Messaging Sender ID** | `383368597239` |

---

## Admin Authentication

- Admin users authenticate via **Firebase Auth (email/password)**
- Admin access is gated on a **custom claim**: `{ admin: true }`
- Set via Firebase Admin SDK (Cloud Function or Firebase Console → Users)
- The admin site should check `user.getIdTokenResult()` for the `admin` claim after login

---

## Firestore Collections

### `users`
User profiles. Document ID = Firebase Auth UID.
```
{
  uid: string,
  email: string,
  displayName: string,
  avatar: string?,          // URL or R2 key
  createdAt: Timestamp,
  lastActiveAt: Timestamp?,
}
```
Subcollection: `users/{uid}/settings/app` — per-user app settings map.

---

### `spot_change_requests`
Admin approval queue for spot create/update/delete/privacy changes.
```
{
  requestId: string,        // e.g. "req_spot_123_1706000000000"
  requestType: string,      // "create" | "update" | "delete" | "privacy_change"
  spotId: string?,          // local SQLite spot ID (stringified int)
  publicSpotId: string?,    // Firestore public_spots doc ID
  requesterId: string,      // Firebase Auth UID
  requesterEmail: string,
  status: string,           // "pending" | "approved" | "rejected"
  createdAt: Timestamp,
  reviewedAt: Timestamp?,
  reviewedBy: string?,      // admin UID
  reviewNotes: string?,
  proposedData: map?,       // fields being proposed (name, type, lat, lng, description, primaryImageR2Key)
  originalData: map?,       // original values (for update requests)
  deleteReason: string?,
}
```

---

### `public_spots`
Approved public spots visible to all users.
```
{
  uuid: string,
  name: string,
  type: string,             // spot type enum (see below)
  description: string?,
  latitude: number,
  longitude: number,
  approvalStatus: string,   // "approved" | "pending_approval" | "pending_changes" | "rejected"
  ownerId: string?,
  primaryImageR2Key: string?,
  averageRating: number?,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

**Spot types:** `marina`, `anchorage`, `fuel_dock`, `pump_out`, `restaurant`, `beach`, `park`, `bridge`, `lock`, `hazard`, `other`

**Approval statuses:** `approved`, `pending_approval`, `pending_changes`, `rejected`

---

### `news_stories`
CruisNews stories synced to mobile app.
```
{
  storyId: string,          // UUID
  tier: string,             // "A" (featured) | "B" (standard)
  section: string,          // news section/category
  headline: string,
  content: string,
  source: string,           // source identifier
  sourceDisplayName: string?,
  region: string,
  imageUrl: string?,        // external image URL
  imageR2Key: string?,      // R2 storage key for uploaded image
  status: string,           // "pending" | "released" | "deleted"
  scheduledRelease: Timestamp,
  actualRelease: Timestamp?,
  createdAt: Timestamp,
}
```

**Story statuses:** `pending`, `released`, `deleted`
**Tiers:** `A` (top stories), `B` (standard)

---

### `feed_groups`
Social feed groups.
```
{
  id: string,
  name: string,
  description: string?,
  group_type: string,       // "user" | "partner" | "sponsor" | "official"
  privacy: string,          // "public" | "request" | "invite_only" | "contacts_only"
  location_lat: number?,
  location_lng: number?,
  location_radius_nm: number?,
  created_by: string,       // Firebase Auth UID
  created_at: string,       // ISO 8601
  updated_at: string,
  member_count: number,
  post_count: number,
  metadata_version: number,
  avatar_url: string?,
  avatar_r2_key: string?,
  tags: string?,            // JSON-encoded array
}
```

**Group types:** `user`, `partner`, `sponsor`, `official`
**Privacy values:** `public`, `request`, `invite_only`, `contacts_only`

Subcollections:
- `feed_groups/{id}/memberships/{userId}` — `FeedGroupMembership`
- `feed_groups/{id}/join_requests/{userId}` — `FeedGroupJoinRequest`
- `feed_groups/{id}/invites/{invitedUserId}` — `FeedGroupInvite`

---

### `posts`
Social feed posts.
```
{
  postId: string,
  authorId: string,
  groupId: string?,
  content: string,
  imageR2Keys: string[]?,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  likeCount: number,
  commentCount: number,
}
```

---

### `chats`
Chat sessions between users.
```
{
  chatId: string,           // e.g. "c_-OjaO00uvIFKtmCiDdpO"
  participants: string[],   // Firebase Auth UIDs
  createdAt: Timestamp,
  lastMessageAt: Timestamp?,
  lastMessagePreview: string?,
}
```

Subcollection: `chats/{chatId}/messages/{messageId}`

---

### `waypoints`
Shared waypoints.
```
{
  waypointId: string,
  ownerId: string,
  name: string,
  latitude: number,
  longitude: number,
  description: string?,
  isShared: boolean,
  createdAt: Timestamp,
}
```

---

### `rendezvous` (shared_events)
Rendezvous/meetup requests.
```
{
  eventId: string,
  creatorId: string,
  title: string,
  description: string?,
  latitude: number?,
  longitude: number?,
  scheduledAt: Timestamp?,
  status: string,           // "pending" | "active" | "cancelled" | "completed"
  participants: string[],
  createdAt: Timestamp,
}
```

---

## Firebase Realtime Database (RTDB)

Base URL: `https://cruisapalooza-5779c-default-rtdb.firebaseio.com`

| Path | Purpose |
|---|---|
| `user_locations/{uid}` | Live GPS location of active users |
| `active_viewports/{uid}` | User's current map viewport bounds |
| `range_lines/{uid}` | Active range line connections |

### `user_locations/{uid}`
```json
{
  "latitude": 40.123,
  "longitude": -74.456,
  "heading": 270.0,
  "speed": 5.2,
  "timestamp": 1706000000000,
  "isSharing": true
}
```

---

## R2 Storage (Cloudflare)

Used for all media storage (images, map snapshots).

**Key patterns:**
- Spot photos: `{uid}/spots/{uuid}.jpg`
- Feed post images: `{uid}/feed/{uuid}.jpg`
- Group avatars: `groups/{groupId}/avatar.jpg`
- User avatars: `{uid}/avatar.jpg`
- News story images: `news/{storyId}.jpg`
- Map snapshots: `{uid}/snapshots/{uuid}.jpg`

Images are uploaded via background queue in the mobile app. The admin site reads R2 keys from Firestore and constructs signed URLs via a Cloud Function.

---

## Cloud Functions (planned)

| Function | Purpose |
|---|---|
| `approveSpot` | Approve a `spot_change_request`, write to `public_spots` |
| `rejectSpot` | Reject a request, update status + notes |
| `disableUser` | Disable a Firebase Auth user account |
| `setAdminClaim` | Set `{ admin: true }` custom claim on a user |
| `getSignedR2Url` | Return a signed URL for an R2 object key |

---

## Mobile App Reference

- **Mobile repo:** `CruisaPalooza` (Flutter/Dart)
- **Mobile bundle ID (iOS):** `com.cruisapalooza.app`
- **Key model files:**
  - `lib/models/spot.dart` — Spot model
  - `lib/models/spot_change_request.dart` — Approval request model
  - `lib/models/feed_group.dart` — Group + membership models
  - `lib/models/news_story.dart` — CruisNews story model
  - `lib/models/user_location.dart` — Live location model
  - `lib/services/spot_approval_service.dart` — Spot approval Firestore ops
  - `lib/services/feed_groups_service.dart` — Group management
  - `lib/services/auth_service.dart` — Firebase Auth wrapper

---

## TypeScript Types

See `src/types/` for TypeScript interfaces mirroring the above models.
