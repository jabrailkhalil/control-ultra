@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ═══════════════════════════════════════════════════════════
::  CONTROL ULTRA — AI Super Commander v1.0
::  Single-file autonomous command executor for AI assistants
::
::  Usage:
::    cu.cmd exec "command here"         — Execute a command
::    cu.cmd exec "command" -t 60        — With custom timeout (seconds)
::    cu.cmd batch commands.txt          — Execute commands from file
::    cu.cmd daemon                      — Start watcher mode
::    cu.cmd queue "command"             — Add command to daemon queue
::    cu.cmd status                      — Show info
::    cu.cmd kill PID                    — Kill a process
::    cu.cmd killall                     — Kill all child processes
::    cu.cmd help                        — Show help
:: ═══════════════════════════════════════════════════════════

set "CU_VERSION=1.0"
set "CU_DIR=%~dp0"
set "CU_LOG=%CU_DIR%cu-log.txt"
set "CU_QUEUE=%CU_DIR%cu-queue.txt"
set "CU_RESULTS=%CU_DIR%cu-results"
set "CU_DEFAULT_TIMEOUT=120"
set "CU_HELPER=%CU_DIR%cu-exec-helper.ps1"

:: Create results dir
if not exist "%CU_RESULTS%" mkdir "%CU_RESULTS%" 2>nul

:: Create helper PowerShell script if missing
if not exist "%CU_HELPER%" call :create_helper

:: Parse action
set "ACTION=%~1"
if "%ACTION%"=="" goto :help

if /i "%ACTION%"=="exec" goto :exec
if /i "%ACTION%"=="e" goto :exec
if /i "%ACTION%"=="run" goto :exec
if /i "%ACTION%"=="batch" goto :batch
if /i "%ACTION%"=="b" goto :batch
if /i "%ACTION%"=="daemon" goto :daemon
if /i "%ACTION%"=="d" goto :daemon
if /i "%ACTION%"=="queue" goto :queue
if /i "%ACTION%"=="q" goto :queue
if /i "%ACTION%"=="status" goto :status
if /i "%ACTION%"=="s" goto :status
if /i "%ACTION%"=="kill" goto :kill
if /i "%ACTION%"=="killall" goto :killall
if /i "%ACTION%"=="help" goto :help
if /i "%ACTION%"=="h" goto :help
if /i "%ACTION%"=="--help" goto :help

:: No action keyword — treat all args as command
set "CMD_TO_RUN=%*"
set "TIMEOUT_SEC=%CU_DEFAULT_TIMEOUT%"
goto :do_exec

:: ═══════════════════════════════════════
:: EXEC
:: ═══════════════════════════════════════
:exec
set "CMD_TO_RUN=%~2"
if "%CMD_TO_RUN%"=="" (
    echo [CU] ERROR: No command specified
    echo [CU] Usage: cu.cmd exec "your command"
    exit /b 1
)
set "TIMEOUT_SEC=%CU_DEFAULT_TIMEOUT%"
if /i "%~3"=="timeout" if not "%~4"=="" set "TIMEOUT_SEC=%~4"
if /i "%~3"=="-t" if not "%~4"=="" set "TIMEOUT_SEC=%~4"
goto :do_exec

:do_exec
:: Safety check
call :check_blocked "%CMD_TO_RUN%"
if errorlevel 1 (
    echo [CU] ══════════════════════════════════════
    echo [CU] BLOCKED — dangerous command detected
    echo [CU] Command: %CMD_TO_RUN%
    echo [CU] ══════════════════════════════════════
    call :log "BLOCKED" "%CMD_TO_RUN%"
    exit /b 1
)

echo [CU] ══════════════════════════════════════
echo [CU] CONTROL ULTRA — Executing
echo [CU] CMD: %CMD_TO_RUN%
echo [CU] Timeout: %TIMEOUT_SEC%s
echo [CU] ══════════════════════════════════════

call :log "EXEC" "%CMD_TO_RUN%"

:: Execute via PowerShell helper for timeout support
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CU_HELPER%" -Cmd "%CMD_TO_RUN%" -TimeoutSec %TIMEOUT_SEC% -WorkDir "%CU_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if %EXIT_CODE% EQU 0 (
    echo [CU] COMPLETED successfully
    call :log "OK" "%CMD_TO_RUN%"
) else if %EXIT_CODE% EQU 124 (
    echo [CU] TIMEOUT — process was killed
    call :log "TIMEOUT" "%CMD_TO_RUN%"
) else (
    echo [CU] FAILED with exit code %EXIT_CODE%
    call :log "FAIL" "%CMD_TO_RUN% exit=%EXIT_CODE%"
)
echo [CU] ──────────────────────────────────────
exit /b %EXIT_CODE%


:: ═══════════════════════════════════════
:: BATCH
:: ═══════════════════════════════════════
:batch
set "BATCH_FILE=%~2"
if "%BATCH_FILE%"=="" (
    echo [CU] ERROR: No batch file specified
    exit /b 1
)
if not exist "%BATCH_FILE%" (
    echo [CU] ERROR: File not found: %BATCH_FILE%
    exit /b 1
)

echo [CU] ══════════════════════════════════════
echo [CU] BATCH MODE from: %BATCH_FILE%
echo [CU] ══════════════════════════════════════

set "B_TOTAL=0"
set "B_OK=0"
set "B_FAIL=0"

for /f "usebackq delims=" %%L in ("%BATCH_FILE%") do (
    set "LINE=%%L"
    if not "!LINE!"=="" if not "!LINE:~0,1!"=="#" (
        set /a B_TOTAL+=1
        echo.
        echo [CU] ── Command !B_TOTAL! ──
        call :exec_simple "!LINE!"
        if !ERRORLEVEL! EQU 0 ( set /a B_OK+=1 ) else ( set /a B_FAIL+=1 )
    )
)

echo.
echo [CU] ══════════════════════════════════════
echo [CU] BATCH RESULTS: Total=%B_TOTAL% OK=%B_OK% Fail=%B_FAIL%
echo [CU] ══════════════════════════════════════
if %B_FAIL% GTR 0 exit /b 1
exit /b 0


:: ═══════════════════════════════════════
:: DAEMON
:: ═══════════════════════════════════════
:daemon
echo [CU] ══════════════════════════════════════
echo [CU] DAEMON MODE — watching %CU_QUEUE%
echo [CU] AI: write commands to cu-queue.txt
echo [CU] Press Ctrl+C to stop
echo [CU] ══════════════════════════════════════

if not exist "%CU_QUEUE%" type nul > "%CU_QUEUE%"
call :log "DAEMON" "Started"

set "LAST_LINES=0"
for /f %%A in ('type "%CU_QUEUE%" 2^>nul ^| find /c /v ""') do set "LAST_LINES=%%A"

:daemon_loop
set "CUR_LINES=0"
for /f %%A in ('type "%CU_QUEUE%" 2^>nul ^| find /c /v ""') do set "CUR_LINES=%%A"

if !CUR_LINES! GTR !LAST_LINES! (
    set "LN=0"
    for /f "usebackq delims=" %%L in ("%CU_QUEUE%") do (
        set /a LN+=1
        if !LN! GTR !LAST_LINES! (
            set "DCMD=%%L"
            if not "!DCMD!"=="" if not "!DCMD:~0,1!"=="#" (
                echo.
                echo [CU] NEW: !DCMD!
                call :exec_simple "!DCMD!"
            )
        )
    )
    set "LAST_LINES=!CUR_LINES!"
)

ping -n 3 127.0.0.1 >nul 2>&1
goto :daemon_loop


:: ═══════════════════════════════════════
:: QUEUE
:: ═══════════════════════════════════════
:queue
set "Q_CMD=%~2"
if "%Q_CMD%"=="" (echo [CU] ERROR: No command & exit /b 1)
echo %Q_CMD%>> "%CU_QUEUE%"
echo [CU] Added to queue: %Q_CMD%
exit /b 0


:: ═══════════════════════════════════════
:: STATUS
:: ═══════════════════════════════════════
:status
echo [CU] ══════════════════════════════════════
echo [CU] CONTROL ULTRA v%CU_VERSION%
echo [CU] Dir: %CU_DIR%
echo [CU] ──────────────────────────────────────
if exist "%CU_LOG%" (
    echo [CU] Last log entries:
    powershell -NoProfile -Command "Get-Content '%CU_LOG%' -Tail 10"
)
echo [CU] ══════════════════════════════════════
exit /b 0


:: ═══════════════════════════════════════
:: KILL / KILLALL
:: ═══════════════════════════════════════
:kill
set "K_PID=%~2"
if "%K_PID%"=="" (echo [CU] ERROR: No PID & exit /b 1)
taskkill /PID %K_PID% /T /F 2>nul
echo [CU] Killed PID %K_PID%
call :log "KILL" "PID %K_PID%"
exit /b 0

:killall
echo [CU] Killing all tracked processes...
for %%F in ("%CU_RESULTS%\*.pid") do (
    set /p KP=<"%%F"
    taskkill /PID !KP! /T /F 2>nul
    del "%%F" 2>nul
)
echo [CU] Done
exit /b 0


:: ═══════════════════════════════════════
:: HELP
:: ═══════════════════════════════════════
:help
echo.
echo   ══════════════════════════════════════════
echo   CONTROL ULTRA v%CU_VERSION% — AI Super Commander
echo   ══════════════════════════════════════════
echo.
echo   Drop this file into any project folder.
echo   Tell the AI: "use cu.cmd for all commands"
echo.
echo   cu.cmd exec "command"           Execute command
echo   cu.cmd exec "cmd" -t 60        Custom timeout
echo   cu.cmd batch file.txt           Run from file
echo   cu.cmd daemon                   Watch queue mode
echo   cu.cmd queue "command"          Add to queue
echo   cu.cmd status                   Show status
echo   cu.cmd kill PID                 Kill process
echo   cu.cmd killall                  Kill all
echo   cu.cmd help                     This help
echo.
echo   SAFETY: dangerous commands blocked.
echo   TIMEOUT: default %CU_DEFAULT_TIMEOUT%s, auto-kill on hang.
echo.
exit /b 0


:: ═══════════════════════════════════════
:: INTERNAL FUNCTIONS
:: ═══════════════════════════════════════

:exec_simple
set "ES_CMD=%~1"
call :check_blocked "%ES_CMD%"
if errorlevel 1 (
    echo [CU] BLOCKED: %ES_CMD%
    exit /b 1
)
echo [CU] Running: %ES_CMD%
call :log "EXEC" "%ES_CMD%"
cmd /c %ES_CMD%
set "ES_EXIT=%ERRORLEVEL%"
if %ES_EXIT% EQU 0 (echo [CU] OK) else (echo [CU] FAIL exit=%ES_EXIT%)
call :log "DONE" "%ES_CMD% exit=%ES_EXIT%"
exit /b %ES_EXIT%

:check_blocked
set "CB_CMD=%~1"
for %%P in ("format " "del /s /q C:\" "rd /s /q C:\" "rmdir /s /q C:\" "rm -rf /" "shutdown /s" "shutdown /r" "shutdown /f" "mkfs") do (
    echo !CB_CMD! | findstr /i /c:%%P >nul 2>&1
    if not errorlevel 1 exit /b 1
)
exit /b 0

:log
echo [%DATE% %TIME%] [%~1] %~2 >> "%CU_LOG%" 2>nul
exit /b 0

:create_helper
:: Create the PowerShell helper script for timeout-protected execution
(
echo param^([string]$Cmd, [int]$TimeoutSec = 120, [string]$WorkDir = "."^)
echo $ErrorActionPreference = 'SilentlyContinue'
echo try {
echo     $pinfo = New-Object System.Diagnostics.ProcessStartInfo
echo     $pinfo.FileName = 'cmd.exe'
echo     $pinfo.Arguments = '/c ' + $Cmd
echo     $pinfo.UseShellExecute = $false
echo     $pinfo.RedirectStandardOutput = $true
echo     $pinfo.RedirectStandardError = $true
echo     $pinfo.CreateNoWindow = $true
echo     if ^(Test-Path $WorkDir^) { $pinfo.WorkingDirectory = $WorkDir }
echo     $proc = [System.Diagnostics.Process]::Start^($pinfo^)
echo     $stdoutTask = $proc.StandardOutput.ReadToEndAsync^(^)
echo     $stderrTask = $proc.StandardError.ReadToEndAsync^(^)
echo     $exited = $proc.WaitForExit^($TimeoutSec * 1000^)
echo     if ^(-not $exited^) {
echo         try {
echo             $children = Get-CimInstance Win32_Process ^| Where-Object { $_.ParentProcessId -eq $proc.Id }
echo             foreach ^($c in $children^) { Stop-Process -Id $c.ProcessId -Force -ErrorAction SilentlyContinue }
echo             Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
echo         } catch {}
echo         $out = if^($stdoutTask.IsCompleted^){$stdoutTask.Result}else{''}
echo         if ^($out^) { Write-Host $out }
echo         Write-Host '[CU] TIMEOUT: killed after' $TimeoutSec 'seconds' -ForegroundColor Yellow
echo         exit 124
echo     }
echo     [void]$stdoutTask.Wait^(5000^)
echo     [void]$stderrTask.Wait^(5000^)
echo     $out = $stdoutTask.Result
echo     $err = $stderrTask.Result
echo     if ^($out^) { Write-Host $out }
echo     if ^($err^) { Write-Host $err -ForegroundColor Red }
echo     exit $proc.ExitCode
echo } catch {
echo     Write-Host '[CU] ERROR:' $_.Exception.Message -ForegroundColor Red
echo     exit 1
echo }
) > "%CU_HELPER%"
exit /b 0
