:: Before running the bat file — kill everything first:

::Close any VS Code terminal that has npm run dev or npm run bridge running in it (click the trash icon in the terminal panel, not just the X on the tab)
::Close any existing Electron sidebar window
::Close any PowerShell or cmd windows related to the project
::Wait 5 seconds

::Then double-click start-draft-assistant.bat
::It will automatically clear ports 3000 and 4001 even if something is still holding them, so you don't need to do that manually.
::Expected behavior step by step:

::A cmd window titled "DK App+Bridge" opens and starts printing Next.js build output — this is normal, takes ~15-20 seconds
::The bat file waits 12 seconds then opens a second cmd window titled "DK Sidebar"
::The sidebar Electron window appears on the right edge of your screen, initially showing "Connecting…" in amber
::Once the app is fully booted, the sidebar turns green — "Bridge connected"
::Open http://localhost:3000 in Chrome to see the dashboard

::If the sidebar says "Connecting…" for more than 30 seconds: check the "DK App+Bridge" window for error output. The most common cause is prisma generate needing to run again after a dependency change — if you see a Prisma error, run npx prisma generate once in the project folder then re-run the bat file.
@echo off
title DK Draft Assistant

echo.
echo  =========================================
echo   DK Draft Assistant - Starting up...
echo  =========================================
echo.

:: Kill anything holding ports 3000 or 4001
echo [1/4] Clearing ports 3000 and 4001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4001 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo    Ports cleared.

:: Start the Next.js app + bridge together
echo [2/4] Starting app and bridge...
start "DK App+Bridge" cmd /k "cd /d C:\Users\mason\dk-portfolio-analyzer && npm run dev:all"

:: Wait for app to be ready
echo [3/4] Waiting 12 seconds for app to start...
timeout /t 12 /nobreak > nul

:: Start the Electron sidebar
echo [4/4] Starting sidebar window...
start "DK Sidebar" cmd /k "cd /d C:\Users\mason\electron-sidebar && npm start"

echo.
echo  =========================================
echo   Started. Expected behavior:
echo.
echo   A window titled "DK App+Bridge" shows
echo   Next.js and bridge logs. Wait until you
echo   see "bridge listening on ws://localhost:4001"
echo   before opening a draft room.
echo.
echo   A narrow sidebar window appears on the
echo   right edge of your screen.
echo.
echo   Dashboard: http://localhost:3000
echo   Live view: http://localhost:3000/live-draft
echo.
echo   TO SHUT DOWN: close both terminal windows
echo   then close the sidebar window.
echo  =========================================
echo.
pause