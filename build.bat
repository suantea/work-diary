@echo off
chcp 65001 >nul
echo === asuan build ===

call node generate-icons.js
if errorlevel 1 goto err

call npx vite build
if errorlevel 1 goto err

echo === native modules ===
call npx @electron/rebuild -f -w better-sqlite3
if errorlevel 1 goto err

echo === installer ===
call npx electron-builder --win
if errorlevel 1 goto err

echo === OK: release\asuan 工作助手 Setup *.exe
goto end

:err
echo === FAILED (errorlevel=%errorlevel%) ===
pause
exit /b %errorlevel%

:end
pause
