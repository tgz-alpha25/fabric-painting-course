@echo off
echo.
echo ==========================================
echo   Fabric Painting Course - Backend Setup
echo ==========================================
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
echo Installing backend dependencies...
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
    echo IMPORTANT: Edit backend\.env with your credentials before starting!
) ELSE (
    echo .env file already exists
)

echo.
echo ==========================================
echo   Backend setup complete!
echo   Run: npm run dev
echo ==========================================
pause
