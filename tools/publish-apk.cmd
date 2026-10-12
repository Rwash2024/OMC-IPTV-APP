@echo off
rem Builds the signed app, checks it is really signed with your release key, and publishes it for download.
rem Run in your own terminal from the project folder:  .\tools\publish-apk.cmd
setlocal
set "ROOT=%~dp0.."
set "JAVA_HOME=D:\dev-tools\jdk21"
set "APKSIGNER=D:\dev-tools\android-sdk\build-tools\36.0.0\apksigner.bat"

if not exist "%ROOT%\android\keystore.properties" (
  echo No signing key set up. Run tools\setup-signing.cmd first.
  exit /b 1
)

call "%ROOT%\build-apk.cmd" || exit /b 1

echo.
echo Checking the signature...
call "%APKSIGNER%" verify --print-certs "%ROOT%\OMC-IPTV.apk" > "%TEMP%\omc-cert.txt" 2>&1
if errorlevel 1 (
  type "%TEMP%\omc-cert.txt"
  echo The app is not validly signed. Nothing was published.
  exit /b 1
)
findstr /C:"Android Debug" "%TEMP%\omc-cert.txt" >nul
if not errorlevel 1 (
  echo This app is signed with the test key, not your release key. Nothing was published.
  exit /b 1
)
findstr /C:"certificate DN" "%TEMP%\omc-cert.txt"

echo.
echo Publishing...
cd /d "%ROOT%"
call npm.cmd run release:apk || exit /b 1
echo.
echo Done. Paste the printed values into the dashboard ^> App settings and press Save.
exit /b 0
