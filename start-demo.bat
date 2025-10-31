@echo off
REM Tokenized ETF Demo Startup Script for Windows
REM This script automates the entire demo setup:
REM 1. Starts Anvil blockchain
REM 2. Deploys smart contracts
REM 3. Starts frontend development server

setlocal enabledelayedexpansion

echo ========================================
echo   Tokenized ETF Demo - Startup Script
echo ========================================
echo.

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend

REM Step 1: Check if Anvil is running
echo Step 1: Checking Anvil status...
netstat -an | findstr ":8545" >nul
if %errorlevel% equ 0 (
    echo    Anvil is already running on port 8545
    echo    Using existing Anvil instance...
    set ANVIL_RUNNING=true
) else (
    set ANVIL_RUNNING=false
)
echo.

REM Step 2: Start Anvil if not running
if "%ANVIL_RUNNING%"=="false" (
    echo Step 2: Starting Anvil blockchain...
    cd /d "%BACKEND_DIR%"
    start "Anvil" cmd /c "anvil"
    timeout /t 3 /nobreak >nul
    echo    Anvil started
) else (
    echo Step 2: Anvil already running, skipping...
)
echo.

REM Step 3: Deploy Smart Contracts
echo Step 3: Deploying smart contracts...
cd /d "%BACKEND_DIR%"
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
if %errorlevel% neq 0 (
    echo Contract deployment failed!
    pause
    exit /b 1
)
echo    Contracts deployed successfully
echo.

REM Step 4: Check if frontend exists
if not exist "%FRONTEND_DIR%" (
    echo Frontend directory not found, skipping frontend startup...
    echo.
    echo Backend setup complete!
    echo Anvil is running on http://localhost:8545
    echo Contracts are deployed and ready
    pause
    exit /b 0
)

REM Step 5: Start Frontend
echo Step 4: Starting frontend development server...
cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    echo    Installing frontend dependencies...
    call npm install
)

echo    Starting frontend...
echo    Frontend will be available at http://localhost:3000
echo.

npm start

pause

