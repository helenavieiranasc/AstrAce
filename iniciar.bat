@echo off
rem Inicia o AstrAce em http://localhost:5001 (Ctrl+C para parar).
cd /d "%~dp0"
start "" http://localhost:5001
".venv\Scripts\flask.exe" --app run run --debug --port 5001
pause
