@echo off
chcp 65001 >nul
title Deploy CineMinde till GitHub & Render
echo ========================================================
echo   Laddar upp CineMinde med alla nya ändringar...
echo ========================================================
echo.

cd /d "D:\Downloads\cineminde-—-personlig-filmguide"

set "GIT_CMD=C:\Users\wille\AppData\Local\Programs\Git\cmd\git.exe"
if not exist "%GIT_CMD%" set "GIT_CMD=git"

echo [1/4] Bygger produktionsfiler (npm run build)...
call npm.cmd run build

echo.
echo [2/4] Skapar uppdaterad cineminde-deploy.zip...
if exist cineminde-deploy.zip del /f /q cineminde-deploy.zip
tar.exe -a -cf cineminde-deploy.zip src public dist Dockerfile .dockerignore index.html metadata.json package.json package-lock.json README.md server.ts tsconfig.json vite.config.ts .env.example

echo.
echo [3/4] Lägger till filer och skapar git commit...
"%GIT_CMD%" add .
"%GIT_CMD%" commit -m "Uppdatera CineMinde: ogillade kategorier, loop-fix och säsongsbetyg per serie"

echo.
echo [4/4] Skickar till GitHub (git push)...
"%GIT_CMD%" push -u origin main

echo.
echo ========================================================
echo   KLART! Ändringarna är uppladdade till GitHub.
echo   Render / driftsättningen startar automatiskt!
echo ========================================================
echo.
pause
