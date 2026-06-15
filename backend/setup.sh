#!/bin/bash
# ============================================
# BACKEND SETUP SCRIPT - Fabric Painting Course
# ============================================

echo ""
echo "=========================================="
echo "  Fabric Painting Course - Backend Setup"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Please install Node.js v18+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js v18 or higher is required. You have $(node -v)"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
  echo "ERROR: npm is not installed."
  exit 1
fi

echo "✓ npm $(npm -v) detected"
echo ""

# Install dependencies
echo "Installing backend dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "ERROR: npm install failed."
  exit 1
fi

echo ""
echo "✓ Dependencies installed successfully!"
echo ""

# Copy env if not exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✓ Created .env file from template"
  echo ""
  echo "⚠️  IMPORTANT: Edit backend/.env with your actual credentials before starting!"
  echo "   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
  echo "   Required: FIREBASE_WEB_API_KEY (from Firebase Console)"
  echo "   Required: EMAIL_USER, EMAIL_PASS (Gmail)"
  echo "   Required: CLOUDINARY_ACCOUNT_1_* (at least one Cloudinary account)"
else
  echo "✓ .env file already exists"
fi

echo ""
echo "=========================================="
echo "  Backend setup complete!"
echo "  Run: npm run dev"
echo "=========================================="
