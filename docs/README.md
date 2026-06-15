# Fabric Art Painting Course Website

A full-stack secure course platform with React frontend, Node.js backend, Firebase database, and Cloudinary video streaming — built to prevent video downloads, manage users, and restrict access.

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Tech Stack](#tech-stack)
3. [Firebase Setup (from scratch)](#firebase-setup)
4. [Cloudinary Setup (from scratch)](#cloudinary-setup)
5. [Gmail App Password Setup](#gmail-setup)
6. [Backend Setup](#backend-setup)
7. [Frontend Setup](#frontend-setup)
8. [Running the App](#running-the-app)
9. [Creating the Admin User](#creating-admin-user)
10. [Uploading Videos to Cloudinary](#uploading-videos)
11. [Adding Videos to Firebase](#adding-videos-to-firebase)
12. [Security Features](#security-features)
13. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
fabric-painting-course/
├── backend/                 # Node.js Express server
│   ├── config/
│   │   ├── firebase.js      # Firebase Admin SDK
│   │   └── cloudinary.js    # Multi-account Cloudinary config
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── videoController.js
│   │   ├── adminController.js
│   │   └── contactController.js
│   ├── middleware/
│   │   └── auth.js          # JWT + access verification
│   ├── routes/
│   │   └── index.js
│   ├── services/
│   │   └── cronJobs.js      # Auto-expire access, Cloudinary monitoring
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── setup.sh
│
├── frontend/                # React app
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/AuthModal.js
│   │   │   └── Layout/{Navbar,Footer}.js
│   │   ├── context/AuthContext.js
│   │   ├── pages/
│   │   │   ├── Landing.js
│   │   │   ├── Course.js
│   │   │   ├── Contact.js
│   │   │   ├── Admin.js
│   │   │   └── ApproveDevice.js
│   │   ├── utils/api.js
│   │   ├── config/firebase.js
│   │   ├── styles/global.css
│   │   └── App.js
│   ├── package.json
│   ├── .env.example
│   └── setup.sh
│
└── docs/
    ├── FIREBASE_DB_STRUCTURE.md
    ├── firestore.rules
    └── README.md  ← this file
```

---

## Tech Stack
- **Frontend:** React 18, React Router, HLS.js, Firebase Auth (OTP), Axios
- **Backend:** Node.js, Express, Firebase Admin SDK, Cloudinary, Nodemailer
- **Database:** Firebase Firestore
- **Video Streaming:** Cloudinary (HLS / signed URLs)
- **Auth:** Firebase Phone OTP + JWT sessions
- **Cron:** node-cron (auto-expire access, monitor Cloudinary usage)

---

## Firebase Setup

### Step 1: Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → Enter a name (e.g., `fabric-painting-course`)
3. Disable Google Analytics (optional) → Click **Create Project**

### Step 2: Enable Firebase Authentication
1. In your project, go to **Build → Authentication**
2. Click **Get Started**
3. Under **Sign-in method**, enable:
   - **Email/Password** → Enable → Save
   - **Phone** → Enable → Save

### Step 3: Create Firestore Database
1. Go to **Build → Firestore Database**
2. Click **Create Database**
3. Choose **Start in production mode**
4. Select a region (e.g., `asia-south1` for India) → Enable

### Step 4: Apply Security Rules
1. In Firestore → **Rules** tab
2. Replace all content with the contents of `docs/firestore.rules`
3. Click **Publish**

### Step 5: Get Firebase Web Config (for frontend)
1. Go to **Project Settings** (gear icon) → **General** tab
2. Scroll to **Your apps** → Click **Add app** → Choose Web `</>`
3. Register app (any nickname) → Copy the `firebaseConfig` object
4. You'll need these values for `frontend/.env`:
   ```
   REACT_APP_FIREBASE_API_KEY=...
   REACT_APP_FIREBASE_AUTH_DOMAIN=...
   REACT_APP_FIREBASE_PROJECT_ID=...
   REACT_APP_FIREBASE_STORAGE_BUCKET=...
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
   REACT_APP_FIREBASE_APP_ID=...
   ```
5. Also copy just the **apiKey** for backend:
   ```
   FIREBASE_WEB_API_KEY=same_api_key_as_above
   ```

### Step 6: Get Firebase Admin SDK (for backend)
1. Go to **Project Settings** → **Service accounts** tab
2. Click **Generate new private key** → Download the JSON file
3. Open the JSON file and copy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the full key including `\n` characters)

### Step 7: Enable Phone Auth Test Numbers (optional, for development)
1. Authentication → Sign-in method → Phone → Scroll to **Phone numbers for testing**
2. Add a test number like `+91 9999999999` with OTP `123456`

---

## Cloudinary Setup

Cloudinary is used to securely stream videos in HLS format, which prevents IDM and network-tab downloading.

### Step 1: Create Cloudinary Accounts
1. Go to [https://cloudinary.com](https://cloudinary.com) → Sign Up (free)
2. After signup, go to **Dashboard**
3. Note your: **Cloud Name**, **API Key**, **API Secret**
4. Create multiple accounts (3-5) to handle bandwidth limits

### Step 2: Configure Signed Uploads (Security)
1. In Cloudinary Dashboard → **Settings → Upload**
2. Under **Upload presets**, enable **Signed uploads only**
3. This ensures only your backend can generate URLs

### Step 3: Set Videos as Authenticated (Private)
When uploading videos (Step: Uploading Videos), use `type: "authenticated"` so that:
- Videos cannot be accessed without a signed URL
- Signed URLs expire after 1 hour
- This blocks IDM, network tab sniffing, and screen recording apps

### Step 4: Add Cloudinary credentials to backend .env
```
CLOUDINARY_ACCOUNT_1_CLOUD_NAME=your_cloud_name
CLOUDINARY_ACCOUNT_1_API_KEY=your_api_key
CLOUDINARY_ACCOUNT_1_API_SECRET=your_api_secret

CLOUDINARY_ACCOUNT_2_CLOUD_NAME=...
```

### Step 5: Add Accounts to Firestore (via Admin Panel)
After the app is running, go to `/admin` → Cloudinary tab → Add accounts via the UI, or manually add to `cloudinaryAccounts` Firestore collection.

---

## Gmail Setup

For OTP emails and contact form:

1. Go to [https://myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification → Enable it
3. Then go to: Security → **App passwords**
4. Select App: **Mail**, Device: **Other** → type "FabricCourse"
5. Copy the 16-character app password
6. Add to backend `.env`:
   ```
   EMAIL_USER=yourgmail@gmail.com
   EMAIL_PASS=your_16_char_app_password
   ADMIN_EMAIL=yourgmail@gmail.com
   ```

---

## Backend Setup

```bash
cd backend

# Make setup script executable
chmod +x setup.sh

# Run setup
./setup.sh

# Edit .env with your credentials
nano .env   # or use any text editor

# Start development server
npm run dev

# Start production server
npm start
```

### Required .env values
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=""
FIREBASE_WEB_API_KEY=
JWT_SECRET=any_long_random_string
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
ADMIN_EMAIL=
FRONTEND_URL=http://localhost:3000
CLOUDINARY_ACCOUNT_1_CLOUD_NAME=
CLOUDINARY_ACCOUNT_1_API_KEY=
CLOUDINARY_ACCOUNT_1_API_SECRET=
```

---

## Frontend Setup

```bash
cd frontend

# Make setup script executable
chmod +x setup.sh

# Run setup
./setup.sh

# Edit .env with your Firebase web config
nano .env

# Start development
npm start

# Build for production
npm run build
```

### Required .env values
```
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WHATSAPP_NUMBER=919876543210
REACT_APP_TELEGRAM_URL=https://t.me/yourusername
REACT_APP_INSTAGRAM_URL=https://instagram.com/yourusername
REACT_APP_YOUTUBE_URL=https://youtube.com/@yourchannel
```

---

## Running the App

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
# Opens http://localhost:3000
```

**Admin panel** (no navbar link — go directly): `http://localhost:3000/admin`

---

## Creating the Admin User

1. First, **register normally** through the website with your email
2. Then, in Firebase Console → **Firestore Database → users collection**
3. Find your user document (by email)
4. Edit the `role` field: change `"user"` to `"admin"`
5. Now when you login and visit `/admin`, you'll have full access

---

## Uploading Videos to Cloudinary

For each of the 19 class videos:

### Method 1: Cloudinary Dashboard (Easy)
1. Login to cloudinary.com → **Media Library**
2. Click **Upload** → Select video file
3. In upload settings: set **Access mode** to `Authenticated`
4. After upload, copy the **Public ID** (e.g., `courses/class1`)

### Method 2: Cloudinary CLI
```bash
npm install -g cloudinary-cli
cld upload class1.mp4 --public_id "courses/class1" --resource_type video --type authenticated
```

### Adding Public IDs to Firebase
After uploading all videos, add them to Firestore:
1. Go to Firebase Console → Firestore → **videos collection**
2. Add a document for each class with this structure:
```json
{
  "classNumber": 1,
  "title": "Class 1 - Material Requirement",
  "description": "Essential materials for fabric painting.",
  "cloudinaryPublicIds": {
    "account1": "courses/class1",
    "account2": "courses/class1_backup"
  },
  "duration": 1800,
  "thumbnail": "",
  "order": 1
}
```

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| Video Download Prevention | HLS streaming via signed Cloudinary URLs (expire in 1hr) |
| IDM / Extension Blocking | HLS `.m3u8` format — IDM cannot download segmented streams |
| Right-click Blocked | `contextmenu` event prevented on all pages |
| F12 / DevTools Keys Blocked | `keydown` event blocks F12, Ctrl+Shift+I, Ctrl+U |
| Text Selection Disabled | CSS `user-select: none` globally |
| Network Tab URL Leaking | URLs are signed & expire — useless after 1 hour |
| Single Device Session | JWT session tokens rotate on new login |
| Multi-device Login | Email approval required for new devices |
| Device Limit | Max 3 devices per user (admin configurable) |
| OTP Registration | Firebase Phone Auth (SMS OTP) |
| Rate Limiting | Login: 10 req/15min, Video: 30 req/min |
| Course Access Control | Admin grants/revokes access per user |
| Auto-expiry | Cron job auto-expires access after 6 months |
| Admin Notifications | Real-time alerts for expiry, new users, Cloudinary limits |

---

## Troubleshooting

**"Token expired" error:**
- Re-login. JWT tokens last 7 days.

**OTP not received:**
- Check Firebase Phone Auth is enabled
- Use Indian number format: `+91XXXXXXXXXX`
- Check Firebase quota (free: 10 SMS/day in test mode)

**Video not playing:**
- Check Cloudinary public ID is correct in Firestore
- Ensure video is uploaded as `type: authenticated`
- Check backend Cloudinary credentials in .env

**Cloudinary URLs not working:**
- Make sure `CLOUDINARY_ACCOUNT_1_*` env vars are set
- Cloudinary accounts must be seeded in Firestore `cloudinaryAccounts` collection

**Admin panel not accessible:**
- Ensure your user's `role` field is `"admin"` in Firestore
- Must be logged in before visiting `/admin`

**"No course access" error:**
- Admin must grant access via `/admin` → Users → Grant Access button

---

## Deployment (Production)

### Backend (e.g., Railway / Render / VPS):
```bash
cd backend
npm start
# Set PORT and NODE_ENV=production in environment
```

### Frontend (e.g., Vercel / Netlify):
```bash
cd frontend
npm run build
# Deploy the /build folder
# Set REACT_APP_API_URL=https://your-backend-url.com/api
```

---

*Built with React, Node.js, Firebase & Cloudinary*
