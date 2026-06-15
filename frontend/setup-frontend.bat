@echo off
echo.
echo ===========================================
echo   Fabric Painting Course - Frontend Setup
echo ===========================================
echo.

node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed.
    echo Please install from https://nodejs.org
    pause
    exit /b 1
)

echo Node.js detected:
node -v

echo.
echo Installing frontend dependencies...
npm install

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
IF NOT EXIST ".env" (
    copy .env.example .env
    echo Created .env file from template
    echo.
    echo IMPORTANT: Edit frontend\.env with your Firebase web config!
    echo Get it from: Firebase Console - Project Settings - Your Web App
) ELSE (
    echo .env file already exists
)

echo.
echo Place your demo video at: frontend\public\demo.mp4
echo.
echo ===========================================
echo   Frontend setup complete!
echo   Run: npm start
echo ===========================================
pause
