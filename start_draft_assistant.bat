@echo off
title DK Draft Assistant Launcher
 
echo Starting App + Bridge...
start "App + Bridge" cmd /k "cd /d C:\Users\mason\Downloads\dk-portfolio-analyzer-1 && npm run dev:all"
 
echo Waiting for app to start (8 seconds)...
timeout /t 8 /nobreak > nul
 
echo Starting Sidebar Window...
start "Sidebar" cmd /k "cd /d C:\Users\mason\Downloads\electron-sidebar && npm start"
 
echo.
echo ========================================
echo  DK Draft Assistant is starting up.
echo.
echo  Dashboard:  http://localhost:3000
echo  Live draft: http://localhost:3000/live-draft
echo.
echo  The sidebar window will open shortly.
echo  Extension loads automatically on any
echo  draftkings.com tab.
echo ========================================
echo.
pause
 