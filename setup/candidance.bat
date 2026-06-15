@echo off
REM Desktop launcher for Candidance (the install runbook points a shortcut here).
REM Closing this window stops the app. It starts the production server, opens the
REM browser, and survives in-app updates (the supervisor restarts the server).
title Candidance
cd /d "%~dp0.."
node setup\launcher.mjs
echo.
echo Candidance s'est arrete. Vous pouvez fermer cette fenetre.
pause >nul
