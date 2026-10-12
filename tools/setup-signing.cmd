@echo off
rem Creates the key that signs the OMC IPTV app. Run it ONCE, in your own terminal:  .\tools\setup-signing.cmd
rem
rem The password is typed here, hidden, and never leaves this computer. Use letters and digits only (12+ characters):
rem symbols like % ^ & ! break batch files.
rem
rem IMPORTANT: back up the key file and the password in two safe places. If either is lost, you can never publish
rem an update that installs over your customers' copies.
setlocal
set "JAVA_HOME=D:\dev-tools\jdk21"
set "KEYDIR=%USERPROFILE%\OMC-keys"
set "KEYFILE=%KEYDIR%\omc-release.jks"
set "ALIAS=omc"

if exist "%KEYFILE%" (
  echo A key already exists at %KEYFILE%
  echo Not touching it. Delete it yourself only if you are sure nothing was ever released with it.
  exit /b 1
)
if not exist "%KEYDIR%" mkdir "%KEYDIR%"

call :ask "Choose a key password (hidden)" PW1
call :ask "Type it again" PW2
if not "%PW1%"=="%PW2%" (
  echo The two passwords do not match. Run the script again.
  exit /b 1
)
if "%PW1%"=="" (
  echo The password cannot be empty.
  exit /b 1
)

"%JAVA_HOME%\bin\keytool.exe" -genkeypair -keystore "%KEYFILE%" -alias %ALIAS% -keyalg RSA -keysize 2048 -validity 10000 ^
  -storepass "%PW1%" -keypass "%PW1%" -dname "CN=OMC IPTV, O=OMC, C=EG"
if errorlevel 1 (
  echo Could not create the key.
  exit /b 1
)

set "PROPS=%~dp0..\android\keystore.properties"
> "%PROPS%" echo storeFile=%KEYFILE:\=/%
>> "%PROPS%" echo storePassword=%PW1%
>> "%PROPS%" echo keyAlias=%ALIAS%
>> "%PROPS%" echo keyPassword=%PW1%

echo.
echo Done.
echo   Key file:        %KEYFILE%
echo   Build settings:  android\keystore.properties (stays on this computer, not in git)
echo.
echo NOW BACK UP the key file and your password in two safe places.
exit /b 0

:ask
rem Reads a hidden line into the variable named by %2.
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$s = Read-Host -AsSecureString '%~1'; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))"`) do set "%~2=%%p"
exit /b 0
