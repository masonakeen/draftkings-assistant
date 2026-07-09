@echo off
title Generate ADP Report
cd /d C:\Users\mason\dk-portfolio-analyzer

echo.
echo  =========================================
echo   ADP Report Generator
echo  =========================================
echo.
echo  Reading:  data\overall_draft_history.json
echo  Writing:  data\adp_report.md
echo.

node generate_adp_report.js

echo.
if 0.000000E+00RRORLEVEL 0.000000E+00QU 0 (
  echo  Done! Open data\adp_report.md to view the report.
) else (
  echo  Something went wrong. Check the error above.
)
echo.
pause