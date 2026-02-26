/**
 * Control Ultra — Frontend Application
 * WebSocket client, terminal, dashboard, history, settings
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════
    const state = {
        ws: null,
        connected: false,
        superMode: false,
        config: null,
        commandHistory: [],
        historyIndex: -1,
        completedCount: 0,
        failedCount: 0,
        pendingConfirmations: [],
    };

    const API_BASE = '';
    const WS_URL = `ws://${location.host}`;

    // ═══════════════════════════════════════════════════
    // DOM REFERENCES
    // ═══════════════════════════════════════════════════
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        wsIndicator: $('#ws-indicator'),
        wsDot: $('#ws-indicator .indicator-dot'),
        wsText: $('#ws-indicator .indicator-text'),
        superToggle: $('#super-toggle'),
        superIcon: $('#super-toggle .super-icon'),
        superText: $('#super-toggle .super-text'),
        terminalOutput: $('#terminal-output'),
        commandInput: $('#command-input'),
        commandCwd: $('#command-cwd'),
        btnExecute: $('#btn-execute'),
        btnClearTerminal: $('#btn-clear-terminal'),
        btnScrollBottom: $('#btn-scroll-bottom'),
        btnKillAll: $('#btn-kill-all'),
        runningProcesses: $('#running-processes'),
        commandQueue: $('#command-queue'),
        toastContainer: $('#toast-container'),
        confirmModal: $('#confirm-modal'),
        confirmCommand: $('#confirm-command'),
        btnConfirmApprove: $('#btn-confirm-approve'),
        btnConfirmReject: $('#btn-confirm-reject'),
        // Dashboard
        dashSuperMode: $('#dash-super-mode'),
        dashRunning: $('#dash-running'),
        dashQueued: $('#dash-queued'),
        dashCompleted: $('#dash-completed'),
        dashFailed: $('#dash-failed'),
        dashUptime: $('#dash-uptime'),
        dashMemoryBar: $('#dash-memory-bar'),
        dashMemoryText: $('#dash-memory-text'),
        dashPlatform: $('#dash-platform'),
        dashNode: $('#dash-node'),
        dashMaxConcurrent: $('#dash-max-concurrent'),
        dashTimeout: $('#dash-timeout'),
        cardSuperMode: $('#card-super-mode'),
        liveLog: $('#live-log'),
        // History
        historyList: $('#history-list'),
        historyFilter: $('#history-filter-status'),
        btnRefreshHistory: $('#btn-refresh-history'),
        // Settings
        settingRawJson: $('#settings-raw-json'),
        btnSaveSettings: $('#btn-save-settings'),
        btnReloadSettings: $('#btn-reload-settings'),
    };

    // ═══════════════════════════════════════════════════
    // TAB NAVIGATION
    // ═══════════════════════════════════════════════════
    $$('#main-nav .nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            $$('.nav-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            $$('.tab-content').forEach((t) => t.classList.remove('active'));
            $(`#tab-${tab}`).classList.add('active');

            if (tab === 'dashboard') refreshDashboard();
            if (tab === 'history') loadHistory();
            if (tab === 'settings') loadSettings();
        });
    });

    // ═══════════════════════════════════════════════════
    // WEBSOCKET
    // ═══════════════════════════════════════════════════
    function connectWebSocket() {
        if (state.ws && state.ws.readyState <= 1) return;

        try {
            state.ws = new WebSocket(WS_URL);
        } catch (err) {
            console.error('WebSocket connection error:', err);
            scheduleReconnect();
            return;
        }

        state.ws.onopen = () => {
            state.connected = true;
            updateConnectionStatus(true);
            toast('Connected to Control Ultra', 'success');
        };

        state.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleWsMessage(msg);
            } catch { /* ignore */ }
        };

        state.ws.onclose = () => {
            state.connected = false;
            updateConnectionStatus(false);
            scheduleReconnect();
        };

        state.ws.onerror = () => {
            state.connected = false;
            updateConnectionStatus(false);
        };
    }

    function scheduleReconnect() {
        setTimeout(connectWebSocket, 3000);
    }

    function sendWs(type, data = {}) {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({ type, ...data }));
        }
    }

    function updateConnectionStatus(connected) {
        if (connected) {
            els.wsDot.classList.add('connected');
            els.wsText.textContent = 'Connected';
        } else {
            els.wsDot.classList.remove('connected');
            els.wsText.textContent = 'Disconnected';
        }
    }

    // ═══════════════════════════════════════════════════
    // WS MESSAGE HANDLER
    // ═══════════════════════════════════════════════════
    function handleWsMessage(msg) {
        switch (msg.type) {
            case 'status':
                updateStatus(msg.data);
                break;

            case 'command:queued':
                appendTerminalLine(`Queued: ${msg.data.command}`, 'info');
                if (msg.data.requireConfirmation) {
                    showConfirmation(msg.data);
                }
                updateProcessLists();
                break;

            case 'command:started':
                appendTerminalLine(msg.data.command, 'command');
                appendTerminalLine(`PID: ${msg.data.pid}`, 'system');
                updateProcessLists();
                break;

            case 'command:stdout':
                appendTerminalLine(msg.data.data, 'stdout');
                break;

            case 'command:stderr':
                appendTerminalLine(msg.data.data, 'stderr');
                break;

            case 'command:finished':
                const icon = msg.data.status === 'completed' ? '✅' : '❌';
                appendTerminalLine(`${icon} ${msg.data.status} (exit: ${msg.data.exitCode})`,
                    msg.data.status === 'completed' ? 'success' : 'stderr');

                if (msg.data.status === 'completed') state.completedCount++;
                else state.failedCount++;

                updateProcessLists();
                updateDashCounters();
                break;

            case 'command:blocked':
                appendTerminalLine(`🚫 Blocked: ${msg.data.command} — ${msg.data.reason}`, 'warning');
                toast(`Blocked: ${msg.data.reason}`, 'warning');
                break;

            case 'command:killed':
                appendTerminalLine(`🔪 Killed: ${msg.data.command} (PID: ${msg.data.pid})`, 'warning');
                updateProcessLists();
                break;

            case 'command:timeout':
                appendTerminalLine(`⏰ Timeout: ${msg.data.command}`, 'warning');
                toast('Command timed out', 'warning');
                updateProcessLists();
                break;

            case 'process:hanging':
                toast(`⚠️ Process hanging: ${msg.data.command}`, 'warning');
                break;

            case 'process:autoKilled':
                appendTerminalLine(`🔪 Auto-killed hanging: ${msg.data.command}`, 'warning');
                toast(`Auto-killed: ${msg.data.command}`, 'error');
                break;

            case 'log':
                appendLogEntry(msg.data);
                break;
        }
    }

    // ═══════════════════════════════════════════════════
    // TERMINAL
    // ═══════════════════════════════════════════════════
    function appendTerminalLine(text, type = 'stdout') {
        // Remove welcome message on first output
        const welcome = els.terminalOutput.querySelector('.terminal-welcome');
        if (welcome) welcome.remove();

        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        line.textContent = text;
        els.terminalOutput.appendChild(line);

        // Limit terminal lines
        const lines = els.terminalOutput.querySelectorAll('.term-line');
        if (lines.length > 2000) {
            for (let i = 0; i < 500; i++) {
                lines[i].remove();
            }
        }

        // Auto-scroll
        scrollTerminalToBottom();
    }

    function scrollTerminalToBottom() {
        els.terminalOutput.scrollTop = els.terminalOutput.scrollHeight;
    }

    function clearTerminal() {
        els.terminalOutput.innerHTML = '';
        appendTerminalLine('Terminal cleared', 'system');
    }

    // Execute command
    function executeCommand() {
        const command = els.commandInput.value.trim();
        if (!command) return;

        const cwd = els.commandCwd.value.trim() || undefined;

        // Add to local history
        state.commandHistory.push(command);
        state.historyIndex = state.commandHistory.length;

        // Send via WebSocket
        sendWs('execute', { command, cwd });

        els.commandInput.value = '';
        els.commandInput.focus();
    }

    // Command input handlers
    els.commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (state.historyIndex > 0) {
                state.historyIndex--;
                els.commandInput.value = state.commandHistory[state.historyIndex] || '';
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (state.historyIndex < state.commandHistory.length - 1) {
                state.historyIndex++;
                els.commandInput.value = state.commandHistory[state.historyIndex] || '';
            } else {
                state.historyIndex = state.commandHistory.length;
                els.commandInput.value = '';
            }
        }
    });

    els.btnExecute.addEventListener('click', executeCommand);
    els.btnClearTerminal.addEventListener('click', clearTerminal);
    els.btnScrollBottom.addEventListener('click', scrollTerminalToBottom);

    // Kill all
    els.btnKillAll.addEventListener('click', () => {
        if (confirm('Kill all running processes?')) {
            sendWs('kill-all');
            toast('Kill all sent', 'warning');
        }
    });

    // ═══════════════════════════════════════════════════
    // SUPER MODE TOGGLE
    // ═══════════════════════════════════════════════════
    els.superToggle.addEventListener('click', async () => {
        try {
            const res = await fetch(`${API_BASE}/api/config/toggle-super`, { method: 'POST' });
            const data = await res.json();
            state.superMode = data.superMode;
            updateSuperModeUI();
            toast(`Super Mode: ${state.superMode ? 'ON ⚡' : 'OFF 🔒'}`,
                state.superMode ? 'success' : 'info');
        } catch (err) {
            toast('Failed to toggle super mode', 'error');
        }
    });

    function updateSuperModeUI() {
        if (state.superMode) {
            els.superToggle.classList.add('active');
            els.superIcon.textContent = '⚡';
            els.superText.textContent = 'ON';
            els.cardSuperMode?.classList.add('glow-card');
            if (els.dashSuperMode) els.dashSuperMode.textContent = 'ON ⚡';
        } else {
            els.superToggle.classList.remove('active');
            els.superIcon.textContent = '🔒';
            els.superText.textContent = 'OFF';
            els.cardSuperMode?.classList.remove('glow-card');
            if (els.dashSuperMode) els.dashSuperMode.textContent = 'OFF 🔒';
        }
    }

    // ═══════════════════════════════════════════════════
    // PROCESS LISTS (sidebar)
    // ═══════════════════════════════════════════════════
    function updateProcessLists() {
        sendWs('status');
    }

    function updateStatus(data) {
        // Running processes
        if (data.running && data.running.length > 0) {
            els.runningProcesses.innerHTML = data.running.map(proc => `
        <div class="process-item">
          <div class="process-item-header">
            <span class="process-command" title="${escapeHtml(proc.command)}">${escapeHtml(proc.command)}</span>
            <span class="process-pid">PID: ${proc.pid}</span>
          </div>
          <div class="process-actions">
            <button class="process-btn" onclick="killProcess('${proc.id}')">🔪 Kill</button>
          </div>
        </div>
      `).join('');
        } else {
            els.runningProcesses.innerHTML = '<div class="empty-state">No running processes</div>';
        }

        // Queue
        if (data.queue && data.queue.length > 0) {
            els.commandQueue.innerHTML = data.queue.map(cmd => `
        <div class="process-item">
          <div class="process-item-header">
            <span class="process-command" title="${escapeHtml(cmd.command)}">${escapeHtml(cmd.command)}</span>
            <span class="process-pid">${cmd.requireConfirmation && !cmd.confirmed ? '⚠️ Awaiting' : '⏳'}</span>
          </div>
          ${cmd.requireConfirmation && !cmd.confirmed ? `
            <div class="process-actions">
              <button class="process-btn confirm-btn" onclick="confirmCommand('${cmd.id}')">✔ Confirm</button>
              <button class="process-btn" onclick="rejectCommand('${cmd.id}')">✖ Reject</button>
            </div>
          ` : ''}
        </div>
      `).join('');
        } else {
            els.commandQueue.innerHTML = '<div class="empty-state">Queue is empty</div>';
        }

        // Update dashboard counters
        if (els.dashRunning) els.dashRunning.textContent = data.runningCount || 0;
        if (els.dashQueued) els.dashQueued.textContent = data.queueLength || 0;
    }

    // Global functions for onclick handlers
    window.killProcess = (id) => {
        sendWs('kill', { id });
        toast('Kill signal sent', 'warning');
    };

    window.confirmCommand = (id) => {
        sendWs('confirm', { id });
        toast('Command confirmed', 'success');
    };

    window.rejectCommand = (id) => {
        sendWs('reject', { id });
        toast('Command rejected', 'info');
    };

    // ═══════════════════════════════════════════════════
    // CONFIRMATION MODAL
    // ═══════════════════════════════════════════════════
    function showConfirmation(cmd) {
        state.pendingConfirmations.push(cmd);
        els.confirmCommand.textContent = cmd.command;
        els.confirmModal.style.display = 'flex';

        els.btnConfirmApprove.onclick = () => {
            sendWs('confirm', { id: cmd.id });
            els.confirmModal.style.display = 'none';
            toast('Command approved', 'success');
        };

        els.btnConfirmReject.onclick = () => {
            sendWs('reject', { id: cmd.id });
            els.confirmModal.style.display = 'none';
            toast('Command rejected', 'info');
        };
    }

    // ═══════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════
    function updateDashCounters() {
        if (els.dashCompleted) els.dashCompleted.textContent = state.completedCount;
        if (els.dashFailed) els.dashFailed.textContent = state.failedCount;
    }

    async function refreshDashboard() {
        try {
            const res = await fetch(`${API_BASE}/api/status`);
            const data = await res.json();

            state.superMode = data.superMode;
            updateSuperModeUI();

            if (els.dashRunning) els.dashRunning.textContent = data.engine.runningCount;
            if (els.dashQueued) els.dashQueued.textContent = data.engine.queueLength;
            if (els.dashPlatform) els.dashPlatform.textContent = data.platform;
            if (els.dashNode) els.dashNode.textContent = data.nodeVersion;
            if (els.dashMaxConcurrent) els.dashMaxConcurrent.textContent = data.engine.maxConcurrent;

            // Uptime
            if (els.dashUptime) {
                const secs = Math.floor(data.uptime);
                const mins = Math.floor(secs / 60);
                const hrs = Math.floor(mins / 60);
                if (hrs > 0) els.dashUptime.textContent = `${hrs}h ${mins % 60}m`;
                else if (mins > 0) els.dashUptime.textContent = `${mins}m ${secs % 60}s`;
                else els.dashUptime.textContent = `${secs}s`;
            }

            // Memory
            if (data.memoryUsage && els.dashMemoryBar) {
                const usedMB = Math.round(data.memoryUsage.rss / (1024 * 1024));
                const maxMB = 512; // Rough reference
                const pct = Math.min(100, (usedMB / maxMB) * 100);
                els.dashMemoryBar.style.width = `${pct}%`;
                els.dashMemoryText.textContent = `${usedMB} MB`;
            }
        } catch (err) {
            console.error('Dashboard refresh error:', err);
        }
    }

    function appendLogEntry(entry) {
        const logEmptyState = els.liveLog.querySelector('.empty-state');
        if (logEmptyState) logEmptyState.remove();

        const el = document.createElement('div');
        el.className = 'log-entry';

        const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
        el.innerHTML = `<span class="log-time">${time}</span> <span class="log-level ${entry.level}">${entry.level}</span> <span class="log-module">[${entry.module}]</span> <span class="log-message">${escapeHtml(entry.message)}</span>`;

        els.liveLog.appendChild(el);

        // Limit entries
        const entries = els.liveLog.querySelectorAll('.log-entry');
        if (entries.length > 500) {
            for (let i = 0; i < 100; i++) entries[i].remove();
        }

        els.liveLog.scrollTop = els.liveLog.scrollHeight;
    }

    // Auto-refresh dashboard
    setInterval(() => {
        if ($('#tab-dashboard').classList.contains('active')) {
            refreshDashboard();
        }
    }, 5000);

    // ═══════════════════════════════════════════════════
    // HISTORY
    // ═══════════════════════════════════════════════════
    async function loadHistory() {
        try {
            const res = await fetch(`${API_BASE}/api/history?limit=100`);
            const history = await res.json();
            renderHistory(history);
        } catch (err) {
            els.historyList.innerHTML = '<div class="empty-state">Failed to load history</div>';
        }
    }

    function renderHistory(history) {
        const filter = els.historyFilter.value;
        const filtered = filter === 'all' ? history : history.filter(h => h.status === filter);

        if (filtered.length === 0) {
            els.historyList.innerHTML = '<div class="empty-state">No commands match this filter</div>';
            return;
        }

        els.historyList.innerHTML = filtered.reverse().map(cmd => {
            const statusIcon = {
                completed: '✅',
                failed: '❌',
                blocked: '🚫',
                timeout: '⏰',
                killed: '🔪',
            }[cmd.status] || '❓';

            const duration = cmd.startedAt && cmd.finishedAt
                ? ((new Date(cmd.finishedAt) - new Date(cmd.startedAt)) / 1000).toFixed(2) + 's'
                : '—';

            const time = cmd.createdAt
                ? new Date(cmd.createdAt).toLocaleString()
                : '—';

            return `
        <div class="history-item" onclick="toggleHistoryItem(this)" data-id="${cmd.id}">
          <span class="history-status">${statusIcon}</span>
          <div class="history-info">
            <div class="history-command">${escapeHtml(cmd.command)}</div>
            <div class="history-meta">
              <span>${cmd.status}</span>
              <span>Exit: ${cmd.exitCode ?? '—'}</span>
              <span>${duration}</span>
              <span>${time}</span>
            </div>
          </div>
        </div>
      `;
        }).join('');
    }

    window.toggleHistoryItem = function (el) {
        const expanded = el.classList.contains('expanded');

        if (expanded) {
            el.classList.remove('expanded');
            const output = el.querySelector('.history-output');
            if (output) output.remove();
        } else {
            el.classList.add('expanded');
            const id = el.dataset.id;

            fetch(`${API_BASE}/api/commands/${id}`)
                .then(res => res.json())
                .then(cmd => {
                    if (cmd && (cmd.output || cmd.errors)) {
                        const outputDiv = document.createElement('div');
                        outputDiv.className = 'history-output';
                        const allOutput = [
                            ...(cmd.output || []),
                            ...(cmd.errors || []).map(e => `[stderr] ${e}`),
                        ];
                        outputDiv.textContent = allOutput.join('') || '(no output)';
                        el.appendChild(outputDiv);
                    }
                })
                .catch(() => { });
        }
    };

    els.historyFilter.addEventListener('change', loadHistory);
    els.btnRefreshHistory.addEventListener('click', loadHistory);

    // ═══════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════
    async function loadSettings() {
        try {
            const res = await fetch(`${API_BASE}/api/config`);
            state.config = await res.json();
            populateSettings(state.config);
        } catch (err) {
            toast('Failed to load settings', 'error');
        }
    }

    function populateSettings(config) {
        // Super Mode
        const superModeEl = $('#setting-super-mode');
        if (superModeEl) superModeEl.checked = config.superMode;

        // Permissions
        const perm = config.permissions || {};
        setChecked('#setting-allow-shell', perm.allowShellCommands);
        setChecked('#setting-allow-files', perm.allowFileOperations);
        setChecked('#setting-allow-network', perm.allowNetworkRequests);
        setChecked('#setting-allow-kill', perm.allowProcessKill);
        setChecked('#setting-allow-elevated', perm.allowElevated);

        // Safety
        const safety = config.safety || {};
        setValue('#setting-timeout', safety.commandTimeout);
        setValue('#setting-max-concurrent', safety.maxConcurrentProcesses);
        setValue('#setting-blocked-commands', (safety.blockedCommands || []).join('\n'));
        setValue('#setting-blocked-paths', (safety.blockedPaths || []).join('\n'));

        // Auto-Approve
        const autoApprove = config.autoApprove || {};
        setChecked('#setting-auto-approve', autoApprove.enabled);
        setValue('#setting-auto-patterns', (autoApprove.patterns || []).join('\n'));

        // Process Guard
        const guard = config.processGuard || {};
        setChecked('#setting-guard-enabled', guard.enabled);
        setValue('#setting-hang-timeout', guard.hangDetectionTimeout);
        setChecked('#setting-auto-kill', guard.autoKillHanging);

        // Timeout on dashboard
        if (els.dashTimeout) els.dashTimeout.textContent = `${(safety.commandTimeout || 0) / 1000}s`;

        // Raw JSON
        if (els.settingRawJson) {
            els.settingRawJson.value = JSON.stringify(config, null, 2);
        }
    }

    function setChecked(sel, value) {
        const el = $(sel);
        if (el) el.checked = !!value;
    }

    function setValue(sel, value) {
        const el = $(sel);
        if (el) el.value = value ?? '';
    }

    els.btnSaveSettings.addEventListener('click', async () => {
        try {
            // Collect from form
            const config = {
                superMode: $('#setting-super-mode')?.checked ?? false,
                permissions: {
                    allowShellCommands: $('#setting-allow-shell')?.checked ?? true,
                    allowFileOperations: $('#setting-allow-files')?.checked ?? true,
                    allowNetworkRequests: $('#setting-allow-network')?.checked ?? true,
                    allowProcessKill: $('#setting-allow-kill')?.checked ?? true,
                    allowElevated: $('#setting-allow-elevated')?.checked ?? false,
                },
                safety: {
                    commandTimeout: parseInt($('#setting-timeout')?.value) || 30000,
                    maxConcurrentProcesses: parseInt($('#setting-max-concurrent')?.value) || 5,
                    blockedCommands: textareaToArray('#setting-blocked-commands'),
                    blockedPaths: textareaToArray('#setting-blocked-paths'),
                },
                autoApprove: {
                    enabled: $('#setting-auto-approve')?.checked ?? true,
                    patterns: textareaToArray('#setting-auto-patterns'),
                },
                processGuard: {
                    enabled: $('#setting-guard-enabled')?.checked ?? true,
                    hangDetectionTimeout: parseInt($('#setting-hang-timeout')?.value) || 60000,
                    autoKillHanging: $('#setting-auto-kill')?.checked ?? true,
                },
            };

            const res = await fetch(`${API_BASE}/api/config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (res.ok) {
                toast('Settings saved! ✅', 'success');
                state.superMode = config.superMode;
                updateSuperModeUI();
            } else {
                toast('Failed to save settings', 'error');
            }
        } catch (err) {
            toast('Error saving settings', 'error');
        }
    });

    els.btnReloadSettings.addEventListener('click', loadSettings);

    function textareaToArray(sel) {
        const el = $(sel);
        if (!el) return [];
        return el.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    }

    // ═══════════════════════════════════════════════════
    // TOAST NOTIFICATIONS
    // ═══════════════════════════════════════════════════
    function toast(message, type = 'info', duration = 4000) {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        els.toastContainer.appendChild(el);

        setTimeout(() => {
            el.style.animation = 'toast-out 0.3s ease forwards';
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    // ═══════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════
    async function init() {
        // Connect WebSocket
        connectWebSocket();

        // Load initial status
        try {
            const res = await fetch(`${API_BASE}/api/status`);
            const data = await res.json();
            state.superMode = data.superMode;
            updateSuperModeUI();
        } catch { /* Server might not be ready yet */ }

        // Focus command input
        els.commandInput.focus();

        console.log('Control Ultra frontend initialized');
    }

    init();
})();
