<#
.SYNOPSIS
    Control Ultra - AI Super Commander (PowerShell Edition)
    Single-file autonomous command executor for AI assistants.

.DESCRIPTION
    Drop this file into any project. Tell the AI:
    "Use cu.ps1 for all commands. You have full permissions."

.EXAMPLE
    .\cu.ps1 exec "npm install express"
    .\cu.ps1 exec "git status" -Timeout 30
    .\cu.ps1 exec "python app.py" -Timeout 300 -Cwd "C:\projects\myapp"
    .\cu.ps1 batch commands.txt
    .\cu.ps1 daemon
    .\cu.ps1 multi "mkdir src", "echo hello > src\index.js", "dir src"
    .\cu.ps1 status
    .\cu.ps1 help
#>

param(
    [Parameter(Position=0)]
    [string]$Action = "help",

    [Parameter(Position=1)]
    [string]$Command,

    [Parameter(Position=2, ValueFromRemainingArguments)]
    [string[]]$ExtraArgs,

    [int]$Timeout = 120,
    [string]$Cwd = "",
    [switch]$Json,
    [switch]$Silent
)

$ErrorActionPreference = "SilentlyContinue"

# CONFIG
$script:CU_VERSION = "1.0"
$script:CU_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $script:CU_DIR) { $script:CU_DIR = Get-Location }
$script:CU_LOG = Join-Path $script:CU_DIR "cu-log.txt"
$script:CU_QUEUE = Join-Path $script:CU_DIR "cu-queue.txt"
$script:CU_RESULTS = Join-Path $script:CU_DIR "cu-results"

$script:BLOCKED_PATTERNS = @(
    "format [a-zA-Z]:",
    "del /s /q [a-zA-Z]:\\",
    "rd /s /q [a-zA-Z]:\\",
    "rmdir /s /q [a-zA-Z]:\\",
    "Remove-Item.*-Recurse.*-Force.*[a-zA-Z]:\\$",
    "rm -rf /",
    "shutdown /[srf]",
    "Stop-Computer",
    "Restart-Computer",
    "Clear-Disk",
    "Initialize-Disk",
    "mkfs"
)

if (-not (Test-Path $script:CU_RESULTS)) {
    New-Item -ItemType Directory -Path $script:CU_RESULTS -Force | Out-Null
}

function Write-CULog {
    param([string]$Level, [string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$ts] [$Level] $Message"
    Add-Content -Path $script:CU_LOG -Value $entry -ErrorAction SilentlyContinue
}

function Write-CU {
    param([string]$Text, [string]$Color = "White")
    if (-not $Silent) {
        Write-Host "[CU] $Text" -ForegroundColor $Color
    }
}

function Test-CommandSafe {
    param([string]$Cmd)
    foreach ($pattern in $script:BLOCKED_PATTERNS) {
        if ($Cmd -match $pattern) {
            return @{ Safe = $false; Pattern = $pattern }
        }
    }
    return @{ Safe = $true; Pattern = "" }
}

function Invoke-CUExec {
    param(
        [string]$Cmd,
        [int]$TimeoutSec = 120,
        [string]$WorkDir = ""
    )

    if (-not $Cmd) {
        Write-CU "ERROR: No command specified" "Red"
        return @{ success = $false; error = "No command specified"; exitCode = 1 }
    }

    $safety = Test-CommandSafe $Cmd
    if (-not $safety.Safe) {
        Write-CU "=== BLOCKED ===" "Red"
        Write-CU "Dangerous command detected!" "Red"
        Write-CU "Command: $Cmd" "Red"
        Write-CU "Pattern: $($safety.Pattern)" "Red"
        Write-CULog "BLOCKED" $Cmd
        return @{ success = $false; error = "Blocked: $($safety.Pattern)"; exitCode = 1; status = "blocked" }
    }

    $execId = [System.IO.Path]::GetRandomFileName().Replace(".", "")
    $startTime = Get-Date

    Write-CU "======================================" "Cyan"
    Write-CU "Executing command" "Cyan"
    Write-CU "--------------------------------------" "DarkGray"
    Write-CU "CMD: $Cmd" "White"
    $tMsg = "$($TimeoutSec)s | ID: $execId"
    Write-CU "Timeout: $tMsg" "DarkGray"
    Write-CU "======================================" "Cyan"

    Write-CULog "EXEC" "$Cmd (timeout: $($TimeoutSec)s, id: $execId)"

    if ($WorkDir -and (Test-Path $WorkDir)) {
        $workingDir = $WorkDir
    } else {
        $workingDir = $script:CU_DIR
    }

    try {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = "cmd.exe"
        $pinfo.Arguments = "/c $Cmd"
        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.CreateNoWindow = $true
        $pinfo.WorkingDirectory = $workingDir

        $proc = [System.Diagnostics.Process]::Start($pinfo)
        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $stderrTask = $proc.StandardError.ReadToEndAsync()
        $exited = $proc.WaitForExit($TimeoutSec * 1000)

        if (-not $exited) {
            try {
                $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id }
                foreach ($child in $children) {
                    Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
                }
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            } catch {}

            $stdout = if ($stdoutTask.IsCompleted) { $stdoutTask.Result } else { "" }
            $stderr = if ($stderrTask.IsCompleted) { $stderrTask.Result } else { "" }

            if ($stdout) { Write-Host $stdout }

            $dur = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 2)
            Write-CU "TIMEOUT - killed after $($TimeoutSec)s (ran $dur sec)" "Yellow"
            Write-CULog "TIMEOUT" "$Cmd (after $($TimeoutSec)s)"

            return @{
                success = $false
                status = "timeout"
                command = $Cmd
                stdout = $stdout
                stderr = $stderr
                exitCode = -1
                duration = $dur
                id = $execId
            }
        }

        [void]$stdoutTask.Wait(5000)
        [void]$stderrTask.Wait(5000)
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result
        $exitCode = $proc.ExitCode
        $dur = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 2)

        if ($stdout) { Write-Host $stdout }
        if ($stderr) { Write-Host $stderr -ForegroundColor Red }

        Write-Host ""
        if ($exitCode -eq 0) {
            Write-CU "COMPLETED (exit: 0, $dur sec)" "Green"
            Write-CULog "OK" "$Cmd (exit: 0, $dur sec)"
        } else {
            Write-CU "FAILED (exit: $exitCode, $dur sec)" "Red"
            Write-CULog "FAIL" "$Cmd (exit: $exitCode, $dur sec)"
        }
        Write-CU "--------------------------------------" "DarkGray"

        $resultFile = Join-Path $script:CU_RESULTS "$execId.json"
        $stat = "failed"
        if ($exitCode -eq 0) { $stat = "completed" }
        $result = @{
            success = ($exitCode -eq 0)
            status = $stat
            command = $Cmd
            stdout = $stdout
            stderr = $stderr
            exitCode = $exitCode
            duration = $dur
            id = $execId
            timestamp = (Get-Date -Format "o")
        }
        $result | ConvertTo-Json -Depth 3 | Set-Content $resultFile -ErrorAction SilentlyContinue

        return $result

    } catch {
        $errMsg = $_.Exception.Message
        Write-CU "ERROR: $errMsg" "Red"
        Write-CULog "ERROR" "$Cmd - $errMsg"
        return @{
            success = $false
            status = "error"
            command = $Cmd
            error = $errMsg
            exitCode = 1
            id = $execId
        }
    }
}

function Invoke-CUMulti {
    param([string[]]$Commands, [int]$TimeoutSec = 120)

    Write-CU "======================================" "Magenta"
    Write-CU "MULTI MODE - $($Commands.Count) commands" "Magenta"
    Write-CU "======================================" "Magenta"

    $results = @()
    $ok = 0
    $fail = 0

    for ($i = 0; $i -lt $Commands.Count; $i++) {
        $cmd = $Commands[$i].Trim()
        if (-not $cmd -or $cmd.StartsWith("#") -or $cmd.StartsWith("//")) { continue }

        Write-Host ""
        Write-CU "-- Command $($i+1)/$($Commands.Count) --" "DarkGray"
        $result = Invoke-CUExec -Cmd $cmd -TimeoutSec $TimeoutSec
        $results += $result

        if ($result.success) { $ok++ } else { $fail++ }
    }

    Write-Host ""
    $clr = "Green"
    if ($fail -gt 0) { $clr = "Yellow" }
    Write-CU "RESULTS: Total=$($Commands.Count) OK=$ok Fail=$fail" $clr
    Write-CU "======================================" "Magenta"

    return @{
        success = ($fail -eq 0)
        total = $Commands.Count
        ok = $ok
        fail = $fail
        results = $results
    }
}

function Invoke-CUBatch {
    param([string]$FilePath, [int]$TimeoutSec = 120)

    if (-not (Test-Path $FilePath)) {
        Write-CU "ERROR: File not found: $FilePath" "Red"
        return
    }

    $commands = Get-Content $FilePath | Where-Object { $_.Trim() -and -not $_.StartsWith("#") -and -not $_.StartsWith("//") }
    Invoke-CUMulti -Commands $commands -TimeoutSec $TimeoutSec
}

function Start-CUDaemon {
    Write-CU "======================================" "Cyan"
    Write-CU "DAEMON MODE - Watching for commands" "Cyan"
    Write-CU "Queue: $script:CU_QUEUE" "DarkGray"
    Write-CU "Results: $script:CU_RESULTS" "DarkGray"
    Write-CU "Press Ctrl+C to stop" "DarkGray"
    Write-CU "======================================" "Cyan"
    Write-Host ""
    Write-CU "AI: write commands to $script:CU_QUEUE (one per line)" "Yellow"
    Write-Host ""

    Write-CULog "DAEMON" "Started"

    if (-not (Test-Path $script:CU_QUEUE)) {
        New-Item -ItemType File -Path $script:CU_QUEUE -Force | Out-Null
    }

    $lastLineCount = (Get-Content $script:CU_QUEUE -ErrorAction SilentlyContinue | Measure-Object).Count

    while ($true) {
        $lines = Get-Content $script:CU_QUEUE -ErrorAction SilentlyContinue
        $currentCount = ($lines | Measure-Object).Count

        if ($currentCount -gt $lastLineCount) {
            $newLines = $lines[$lastLineCount..($currentCount-1)]
            foreach ($line in $newLines) {
                $cmd = $line.Trim()
                if ($cmd -and -not $cmd.StartsWith("#")) {
                    Write-Host ""
                    Write-CU "NEW command from queue: $cmd" "Yellow"
                    Invoke-CUExec -Cmd $cmd -TimeoutSec $Timeout
                }
            }
            $lastLineCount = $currentCount
        }

        Start-Sleep -Seconds 2
    }
}

function Show-CUStatus {
    Write-CU "======================================" "Cyan"
    Write-CU "CONTROL ULTRA v$script:CU_VERSION" "Cyan"
    Write-CU "======================================" "Cyan"
    Write-CU "Directory: $script:CU_DIR" "White"
    Write-CU "Log: $script:CU_LOG" "DarkGray"
    Write-CU "Queue: $script:CU_QUEUE" "DarkGray"
    Write-CU "Results: $script:CU_RESULTS" "DarkGray"

    if (Test-Path $script:CU_LOG) {
        Write-Host ""
        Write-CU "Last 10 log entries:" "Yellow"
        Get-Content $script:CU_LOG -Tail 10
    }

    if (Test-Path $script:CU_RESULTS) {
        $resultFiles = Get-ChildItem $script:CU_RESULTS -Filter "*.json" -ErrorAction SilentlyContinue
        if ($resultFiles) {
            Write-Host ""
            Write-CU "Results: $($resultFiles.Count) files" "Yellow"
        }
    }

    Write-CU "======================================" "Cyan"
}

function Show-CUHelp {
    Write-Host ""
    Write-Host "  =================================================" -ForegroundColor Cyan
    Write-Host "  CONTROL ULTRA v$script:CU_VERSION - AI Super Commander" -ForegroundColor Cyan
    Write-Host "  =================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Drop this file into any project." -ForegroundColor DarkGray
    Write-Host "  Tell the AI: 'use cu.ps1, you have all permissions'" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  COMMANDS:" -ForegroundColor Yellow
    Write-Host '    .\cu.ps1 exec "command"                Execute a command'
    Write-Host '    .\cu.ps1 exec "command" -Timeout 60    Custom timeout'
    Write-Host '    .\cu.ps1 exec "command" -Cwd "path"    Set working dir'
    Write-Host '    .\cu.ps1 exec "command" -Json           Output as JSON'
    Write-Host '    .\cu.ps1 multi "cmd1","cmd2","cmd3"     Run multiple'
    Write-Host '    .\cu.ps1 batch commands.txt              Run from file'
    Write-Host '    .\cu.ps1 daemon                          Watch queue mode'
    Write-Host '    .\cu.ps1 status                          Show status'
    Write-Host '    .\cu.ps1 help                            Show this help'
    Write-Host ""
    Write-Host "  SAFETY:" -ForegroundColor Yellow
    Write-Host "    - Dangerous commands auto-blocked (format, del /s, etc.)"
    Write-Host "    - Timeout protection (default $($Timeout)s)"
    Write-Host "    - Process tree kill on timeout"
    Write-Host "    - Full execution log in cu-log.txt"
    Write-Host ""
    Write-Host "  =================================================" -ForegroundColor Cyan
}

# MAIN
switch ($Action.ToLower()) {
    { $_ -in "exec", "e", "run", "r" } {
        $result = Invoke-CUExec -Cmd $Command -TimeoutSec $Timeout -WorkDir $Cwd
        if ($Json) { $result | ConvertTo-Json -Depth 3 }
        if ($result.success) { exit 0 } else { exit 1 }
    }
    { $_ -in "multi", "m" } {
        $allCmds = @($Command) + @($ExtraArgs)
        $result = Invoke-CUMulti -Commands $allCmds -TimeoutSec $Timeout
        if ($Json) { $result | ConvertTo-Json -Depth 5 }
        if ($result.success) { exit 0 } else { exit 1 }
    }
    { $_ -in "batch", "b" } {
        Invoke-CUBatch -FilePath $Command -TimeoutSec $Timeout
    }
    { $_ -in "daemon", "d", "watch", "w" } {
        Start-CUDaemon
    }
    { $_ -in "status", "s" } {
        Show-CUStatus
    }
    { $_ -in "help", "h", "--help", "-h" } {
        Show-CUHelp
    }
    default {
        if ($Action) {
            $fullCmd = ($Action, $Command, ($ExtraArgs -join ' ') | Where-Object { $_ }) -join ' '
            $result = Invoke-CUExec -Cmd $fullCmd -TimeoutSec $Timeout -WorkDir $Cwd
            if ($Json) { $result | ConvertTo-Json -Depth 3 }
            if ($result.success) { exit 0 } else { exit 1 }
        } else {
            Show-CUHelp
        }
    }
}
