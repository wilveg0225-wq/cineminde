@echo off
setlocal
title CineMinde Deploy

echo ========================================================
echo   CineMinde: Bygger och laddar upp till GitHub...
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Bygger produktionsfiler...
call npm.cmd run build
if %ERRORLEVEL% neq 0 (
    echo [FEL] Produktionsbygget misslyckades!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Skapar uppdaterat arkiv cineminde-deploy.zip...
if exist cineminde-deploy.zip del /f /q cineminde-deploy.zip
tar.exe -a -cf cineminde-deploy.zip src public dist Dockerfile .dockerignore index.html metadata.json package.json package-lock.json README.md server.ts tsconfig.json vite.config.ts .env.example

echo.
echo [3/4] Kontrollerar och skapar git commit...
git add -A
git diff-index --quiet HEAD --
if %ERRORLEVEL% neq 0 (
    git commit -m "Uppdatera CineMinde"
) else (
    echo Inga nya filandringar att committa.
)

echo.
echo [4/4] Skickar till GitHub (git push)...
git push origin main
if %ERRORLEVEL% neq 0 (
    echo [FEL] git push misslyckades. Kontrollera din internetanslutning eller GitHub-behorighet.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   KLART! Repot pa GitHub ar uppdaterat.
echo   Render startar nu bygget automatiskt!
echo ========================================================
echo.
pause
