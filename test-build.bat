@echo off
REM Build performance testing script for Windows
REM Run this locally to verify deployment will be fast

setlocal enabledelayedexpansion

echo.
echo ======================================
echo SQUAD Deployment Build Test
echo ======================================
echo.

REM Check prerequisites
echo [1/5] Checking prerequisites...
node --version >nul 2>&1 || (echo Node.js not found && exit /b 1)
npm --version >nul 2>&1 || (echo npm not found && exit /b 1)
echo ✓ Node.js and npm found
echo.

REM Clean old builds
echo [2/5] Cleaning old builds...
rmdir /s /q dist 2>nul
del /q .tsbuildinfo 2>nul
rmdir /s /q frontend\dist 2>nul
echo ✓ Cleaned
echo.

REM Install dependencies
echo [3/5] Installing dependencies (this may take 2-3 min^)...
set INSTALL_START=%time%
call npm ci --omit=dev --prefer-offline --no-audit >nul 2>&1 || (echo Installation failed && exit /b 1)
cd frontend
call npm ci --omit=dev --prefer-offline --no-audit >nul 2>&1 || (echo Frontend installation failed && cd .. && exit /b 1)
cd ..
set INSTALL_END=%time%
echo ✓ Installed
echo.

REM Build backend
echo [4/5] Building backend ^(TypeScript^)...
set BUILD_START=%time%
call npm run build:backend >nul 2>&1
if errorlevel 1 (echo Backend build failed && exit /b 1)
set BUILD_END=%time%
echo ✓ Backend built
echo.

REM Build frontend  
echo [5/5] Building frontend ^(React + Vite^)...
set FRONTEND_START=%time%
call npm run build:frontend >nul 2>&1
if errorlevel 1 (echo Frontend build failed && exit /b 1)
set FRONTEND_END=%time%
echo ✓ Frontend built
echo.

echo ======================================
echo BUILD SUCCESSFUL!
echo ======================================
echo.
echo Expected Dokploy deployment time: 8-12 minutes ^(first deploy^)
echo Expected Dokploy deployment time: 3-5 minutes ^(subsequent deploys with cache^)
echo.
pause
