@echo off
title Generate ADP Report

rem Change to the folder this .bat lives in
cd /d "%~dp0"

echo.
echo  =========================================
echo   ADP Report Generator
echo  =========================================
echo.
echo  Working dir: %CD%
echo  Reading : data\overall_draft_history.json
echo  Writing : data\adp_report.md
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: node.exe not found on PATH.
    echo Install Node.js or run from a terminal where node works.
    echo.
    pause
    exit /b 1
)

if not exist "generate_adp_report.js" (
    echo ERROR: generate_adp_report.js not found in %CD%
    echo Both files must be in the same folder.
    echo.
    pause
    exit /b 1
)

if not exist "data\overall_draft_history.json" (
    echo ERROR: data\overall_draft_history.json not found.
    echo.
    pause
    exit /b 1
)

node generate_adp_report.js

echo.
if errorlevel 1 (
    echo Something went wrong - check the error above.
) else (
    echo Done! Open data\adp_report.md to view the report.
)
echo.
pause