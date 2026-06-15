# Fabric Art Painting Course — Quick Start

## Prerequisites
- Node.js v18+
- Firebase account (free)
- Cloudinary account (free)
- Gmail account

## 1. Read full docs
See `docs/README.md` for complete setup instructions including Firebase and Cloudinary configuration from scratch.

## 2. Setup Backend
```bash
cd backend
chmod +x setup.sh && ./setup.sh
# Edit backend/.env with your credentials
npm run dev 
```

## 3. Setup Frontend
```bash
cd frontend
chmod +x setup.sh && ./setup.sh
# Edit frontend/.env with Firebase web config
npm start
```

## 4. Access
- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (after setting role=admin in Firestore)
- Backend API: http://localhost:5000/api

## Project Pages
| Page | URL | Access |
|------|-----|--------|
| Home / Landing | `/` | Public |
| Course (videos) | `/course` | Login + Course Access |
| Contact | `/contact` | Public |
| Admin Dashboard | `/admin` | Admin only |
| Device Approval | `/approve-device` | Email link |
