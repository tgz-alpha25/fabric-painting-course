#!/bin/bash
# =============================================
# FRONTEND SETUP SCRIPT - Fabric Painting Course
# =============================================

echo ""
echo "=========================================="
echo "  Fabric Painting Course - Frontend Setup"
echo "=========================================="
echo ""

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Please install Node.js v18+ from https://nodejs.org"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"

echo ""
echo "Installing frontend dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "ERROR: npm install failed."
  exit 1
fi

echo ""
echo "✓ Dependencies installed successfully!"
echo ""

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✓ Created .env file from template"
  echo ""
  echo "⚠️  IMPORTANT: Edit frontend/.env with your Firebase Web config!"
  echo "   Get these from: Firebase Console → Project Settings → Your Web App"
  echo "   Required: REACT_APP_FIREBASE_API_KEY"
  echo "   Required: REACT_APP_FIREBASE_AUTH_DOMAIN"
  echo "   Required: REACT_APP_FIREBASE_PROJECT_ID"
  echo "   Required: REACT_APP_FIREBASE_APP_ID"
  echo "   Required: REACT_APP_WHATSAPP_NUMBER (your business WhatsApp)"
else
  echo "✓ .env file already exists"
fi

echo ""
echo "ℹ️  Place your demo video at: frontend/public/demo.mp4"
echo ""
echo "=========================================="
echo "  Frontend setup complete!"
echo "  Run: npm start"
echo "=========================================="
