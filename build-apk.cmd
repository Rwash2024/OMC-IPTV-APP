@echo off
rem Builds the debug APK. Run from the project folder:  .\build-apk.cmd
rem Uses the JDK and Android SDK installed in D:\dev-tools.
set "JAVA_HOME=D:\dev-tools\jdk21"
set "ANDROID_HOME=D:\dev-tools\android-sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

cd /d "%~dp0"
call npm.cmd run build || goto :fail
call npx.cmd cap sync android || goto :fail

cd /d "%~dp0android"
if not exist "%~dp0android\gradlew.bat" (
  echo gradlew.bat not found in %~dp0android
  goto :fail
)
rem With a signing key (tools\setup-signing.cmd) this builds the real release APK. Without one it builds a test (debug) APK.
if exist "%~dp0android\keystore.properties" (
  echo Building the signed RELEASE app...
  call "%~dp0android\gradlew.bat" assembleRelease || goto :fail
  set "BUILT=%~dp0android\app\build\outputs\apk\release\app-release.apk"
) else (
  echo No signing key found. Building a DEBUG app. Run tools\setup-signing.cmd before sending the app to customers.
  call "%~dp0android\gradlew.bat" assembleDebug || goto :fail
  set "BUILT=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
)

rem Gradle names the file itself, so keep a friendly copy next to the project.
copy /Y "%BUILT%" "%~dp0OMC-IPTV.apk" >nul || goto :fail

echo.
echo Done. APK:
echo %~dp0OMC-IPTV.apk
exit /b 0

:fail
echo.
echo Build failed. Copy the error above and send it.
exit /b 1
