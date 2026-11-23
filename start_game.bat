@echo off
setlocal
cd /d "%~dp0"
title Edenomaly Launcher
where py >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python launcher 'py' not found. Install Python 3.
    pause
    exit /b 1
)
py -3 "%~dp0tools\launch_game.py"
if errorlevel 1 (
    echo.
    echo Launcher failed. Read the error above.
    pause
    exit /b 1
)
