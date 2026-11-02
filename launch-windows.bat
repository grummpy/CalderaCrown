@echo off
cd /d "%~dp0"
where py >nul 2>&1 && (
  py -3 server.py
  exit /b %ERRORLEVEL%
)
where python >nul 2>&1 && (
  python server.py
  exit /b %ERRORLEVEL%
)
echo Python 3 is required to launch Caldera Crown.
echo Install it from https://www.python.org/downloads/ and try again.
exit /b 1
