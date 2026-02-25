@echo off
title MOM Daily Inventory Upload
echo ================================================
echo  MOM - Daily Inventory Upload ^& Invoice Sync
echo ================================================
echo.

cd /d "c:\projects\supabase\mom\mom-app"
python upload.py

echo.
echo ================================================
echo  Done. Press any key to close.
echo ================================================
pause >nul
