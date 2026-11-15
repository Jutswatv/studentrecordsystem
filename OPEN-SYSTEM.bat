@echo off
cd /d "%~dp0"
echo Open http://localhost:8000 in your browser after the server starts.
echo Keep this window open while using the system.
"C:\php\php.exe" -d extension=pdo_sqlite -S localhost:8000 -t "%~dp0public"
pause
