# Firebase Database Structure

## Firestore Collections

### 1. `users` Collection
```
users/{userId}
  - uid: string (Firebase Auth UID)
  - name: string
  - age: number
  - gender: string
  - native: string (hometown/city)
  - mobile: string
  - email: string
  - createdAt: timestamp
  - role: "user" | "admin"
  - isActive: boolean
  - devices: map
    - {deviceId}: { userAgent, ip, lastLogin, deviceName }  (max 3 devices)
  - deviceLimit: number (default 3, admin can change)
  - currentSession: { deviceId, sessionToken, loginAt } | null
```

### 2. `courseAccess` Collection
```
courseAccess/{userId}
  - userId: string
  - hasAccess: boolean
  - grantedAt: timestamp
  - grantedBy: string (admin uid)
  - expiresAt: timestamp (grantedAt + 6 months default)
  - isExpired: boolean (auto-updated by cloud function)
  - cloudinaryKey: string (which cloudinary account key to use)
  - accessDuration: number (months, default 6)
```

### 3. `watchHistory` Collection
```
watchHistory/{userId}/videos/{videoId}
  - videoId: string
  - title: string
  - watchCount: number
  - totalWatchTime: number (seconds)
  - lastWatched: timestamp
  - firstWatched: timestamp
  - progress: number (0-100 percentage)
```

### 4. `notifications` Collection
```
notifications/{notificationId}
  - type: "access_expired" | "new_registration" | "cloudinary_limit" | "multi_device"
  - title: string
  - message: string
  - userId: string | null
  - userName: string | null
  - userEmail: string | null
  - cloudinaryAccount: string | null
  - isRead: boolean
  - createdAt: timestamp
```

### 5. `cloudinaryAccounts` Collection
```
cloudinaryAccounts/{accountId}
  - name: string (e.g., "Account 1")
  - cloudName: string
  - apiKey: string
  - apiSecret: string
  - isActive: boolean
  - isCurrentActive: boolean
  - usagePercent: number (0-100)
  - bandwidthUsed: number (MB)
  - bandwidthLimit: number (MB)
  - order: number (priority order, 1 = first)
  - lastChecked: timestamp
```

### 6. `videos` Collection
```
videos/{videoId}
  - id: string
  - classNumber: number (1-19)
  - title: string
  - description: string
  - cloudinaryPublicIds: map
    - account1: string
    - account2: string
    ... (same video on multiple accounts)
  - duration: number (seconds)
  - thumbnail: string (URL)
  - order: number
```

### 7. `loginAttempts` Collection (security)
```
loginAttempts/{attemptId}
  - email: string
  - ip: string
  - success: boolean
  - timestamp: timestamp
  - deviceId: string
```

### 8. `deviceApprovalRequests` Collection
```
deviceApprovalRequests/{requestId}
  - userId: string
  - userEmail: string
  - newDeviceId: string
  - newDeviceInfo: map
  - token: string (unique approval token)
  - status: "pending" | "approved" | "denied" | "expired"
  - createdAt: timestamp
  - expiresAt: timestamp (15 minutes)
```

## Firebase Security Rules
- Only authenticated users can read/write their own documents
- Admin role users can read/write all documents
- courseAccess is read-only for regular users
- notifications is admin-only write
- cloudinaryAccounts is admin-only
