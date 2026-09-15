@echo off
cd /d "%~dp0ui"
call npm run sync-data
call npx vite --host --open
