@REM ----------------------------------------------------------------------------
@REM Maven Wrapper for Windows (SheGuard Self-Contained)
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set "DIRNAME=%~dp0"
if "%DIRNAME%" == "" set "DIRNAME=."
cd /d "%DIRNAME%"

set "JAVA_EXE=java"
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
)

set "MAVEN_VERSION=3.9.9"
set "USER_HOME=%USERPROFILE%"
set "MAVEN_HOME=%USER_HOME%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%"

if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    "%MAVEN_HOME%\bin\mvn.cmd" %*
    exit /b %ERRORLEVEL%
)

echo [SheGuard] Setting up Maven %MAVEN_VERSION% wrapper...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$url = 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip';" ^
    "$dest = Join-Path $env:TEMP 'apache-maven.zip';" ^
    "$targetDir = Join-Path $env:USERPROFILE '.m2\wrapper\dists';" ^
    "if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null };" ^
    "Write-Host '[SheGuard] Downloading Apache Maven %MAVEN_VERSION%...';" ^
    "Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing;" ^
    "Write-Host '[SheGuard] Extracting Maven...';" ^
    "Expand-Archive -Path $dest -DestinationPath $targetDir -Force;" ^
    "Remove-Item $dest -Force;"

if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    "%MAVEN_HOME%\bin\mvn.cmd" %*
    exit /b %ERRORLEVEL%
)

echo [SheGuard Error] Could not initialize Maven wrapper. Please ensure an active internet connection.
exit /b 1
