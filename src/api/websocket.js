/**
 * Control Ultra — WebSocket Handler
 * Live-стриминг вывода команд и событий в реальном времени
 */

const WebSocket = require('ws');

function setupWebSocket(wss, engine, guard, logger) {
    const clients = new Set();

    wss.on('connection', (ws) => {
        clients.add(ws);
        logger.verbose('WS', `Client connected (total: ${clients.size})`);

        // Отправляем текущий статус при подключении
        send(ws, 'status', engine.getStatus());

        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                handleMessage(ws, msg);
            } catch (err) {
                send(ws, 'error', { message: 'Invalid JSON' });
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            logger.verbose('WS', `Client disconnected (total: ${clients.size})`);
        });

        ws.on('error', () => {
            clients.delete(ws);
        });
    });

    // Обработка входящих WS сообщений
    function handleMessage(ws, msg) {
        switch (msg.type) {
            case 'execute':
                if (msg.command) {
                    const result = engine.enqueue(msg.command, {
                        cwd: msg.cwd,
                        timeout: msg.timeout,
                        priority: msg.priority,
                    });
                    send(ws, 'command:result', result);
                }
                break;

            case 'kill':
                if (msg.id) {
                    engine.kill(msg.id);
                }
                break;

            case 'kill-all':
                engine.killAll();
                break;

            case 'confirm':
                if (msg.id) {
                    engine.confirm(msg.id);
                }
                break;

            case 'reject':
                if (msg.id) {
                    engine.reject(msg.id);
                }
                break;

            case 'input':
                if (msg.id && msg.input !== undefined) {
                    engine.sendInput(msg.id, msg.input);
                }
                break;

            case 'status':
                send(ws, 'status', engine.getStatus());
                break;

            case 'history':
                send(ws, 'history', engine.getHistory(msg.limit || 50));
                break;

            case 'ping':
                send(ws, 'pong', { time: Date.now() });
                break;
        }
    }

    // ═══════════════════════════════════════════
    // Подписка на события Engine
    // ═══════════════════════════════════════════

    engine.on('command:queued', (cmd) => {
        broadcast('command:queued', {
            id: cmd.id,
            command: cmd.command,
            status: cmd.status,
            requireConfirmation: cmd.requireConfirmation,
            autoApproved: cmd.autoApproved,
            createdAt: cmd.createdAt,
        });
    });

    engine.on('command:started', (cmd) => {
        broadcast('command:started', {
            id: cmd.id,
            command: cmd.command,
            pid: cmd.pid,
            startedAt: cmd.startedAt,
        });
    });

    engine.on('command:stdout', ({ id, data }) => {
        broadcast('command:stdout', { id, data });
    });

    engine.on('command:stderr', ({ id, data }) => {
        broadcast('command:stderr', { id, data });
    });

    engine.on('command:finished', (cmd) => {
        broadcast('command:finished', {
            id: cmd.id,
            command: cmd.command,
            status: cmd.status,
            exitCode: cmd.exitCode,
            startedAt: cmd.startedAt,
            finishedAt: cmd.finishedAt,
        });
    });

    engine.on('command:blocked', (cmd) => {
        broadcast('command:blocked', {
            id: cmd.id,
            command: cmd.command,
            reason: cmd.reason,
        });
    });

    engine.on('command:killed', (cmd) => {
        broadcast('command:killed', {
            id: cmd.id,
            command: cmd.command,
            pid: cmd.pid,
        });
    });

    engine.on('command:timeout', (cmd) => {
        broadcast('command:timeout', {
            id: cmd.id,
            command: cmd.command,
        });
    });

    // Подписка на события Guard
    guard.on('process:hanging', (info) => {
        broadcast('process:hanging', info);
    });

    guard.on('process:autoKilled', (info) => {
        broadcast('process:autoKilled', info);
    });

    // Подписка на логи
    logger.addListener((entry) => {
        broadcast('log', entry);
    });

    // ═══════════════════════════════════════════
    // Utility
    // ═══════════════════════════════════════════

    function send(ws, type, data) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
            } catch { /* ignore */ }
        }
    }

    function broadcast(type, data) {
        const msg = JSON.stringify({ type, data, timestamp: Date.now() });
        for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                try { client.send(msg); } catch { /* ignore */ }
            }
        }
    }

    return { clients, broadcast };
}

module.exports = setupWebSocket;
