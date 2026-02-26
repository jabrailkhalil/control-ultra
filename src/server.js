/**
 * Control Ultra — Main Server
 * Запускает все компоненты: SuperFile, Engine, Guard, API, WebSocket, UI
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const SuperFileManager = require('./core/superfile');
const { CommandEngine } = require('./core/engine');
const ProcessGuard = require('./core/guard');
const Logger = require('./core/logger');
const createApiRouter = require('./api/routes');
const setupWebSocket = require('./api/websocket');
const FileOps = require('./modules/fileops');
const EnvDetector = require('./modules/envdetect');
const ChainExecutor = require('./modules/chain');
const { Scaffolder } = require('./modules/scaffold');

const PORT = process.env.PORT || 3777;
const HOST = process.env.HOST || '127.0.0.1';

// ═══════════════════════════════════════════════════
// 1. Инициализация SuperFile
// ═══════════════════════════════════════════════════
const superFile = new SuperFileManager();
const config = superFile.load();
superFile.watch(); // Hot-reload при изменении файла

// ═══════════════════════════════════════════════════
// 2. Логгер
// ═══════════════════════════════════════════════════
const logger = new Logger(config.logging);
logger.info('Server', '═══════════════════════════════════════');
logger.info('Server', '   Control Ultra v1.0');
logger.info('Server', '   AI Command Execution Engine');
logger.info('Server', '═══════════════════════════════════════');

// ═══════════════════════════════════════════════════
// 3. Command Engine
// ═══════════════════════════════════════════════════
const engine = new CommandEngine(superFile);

// Логируем все события движка
engine.on('command:queued', (cmd) => {
    logger.info('Engine', `📋 Queued: ${cmd.command} (id: ${cmd.id.slice(0, 8)})`);
});
engine.on('command:started', (cmd) => {
    logger.info('Engine', `▶️  Started: ${cmd.command} (PID: ${cmd.pid})`);
});
engine.on('command:finished', (cmd) => {
    const duration = cmd.finishedAt && cmd.startedAt
        ? ((new Date(cmd.finishedAt) - new Date(cmd.startedAt)) / 1000).toFixed(2)
        : '?';
    const icon = cmd.status === 'completed' ? '✅' : cmd.status === 'failed' ? '❌' : '⚠️';
    logger.info('Engine', `${icon} Finished: ${cmd.command} (${cmd.status}, ${duration}s, exit: ${cmd.exitCode})`);
});
engine.on('command:blocked', (cmd) => {
    logger.warn('Engine', `🚫 Blocked: ${cmd.command} — ${cmd.reason}`);
});
engine.on('command:killed', (cmd) => {
    logger.warn('Engine', `🔪 Killed: ${cmd.command} (PID: ${cmd.pid})`);
});
engine.on('command:timeout', (cmd) => {
    logger.warn('Engine', `⏰ Timeout: ${cmd.command}`);
});

// ═══════════════════════════════════════════════════
// 4. Process Guard
// ═══════════════════════════════════════════════════
const guard = new ProcessGuard(engine, superFile);
guard.start();

const fileOps = new FileOps(superFile);
const envDetector = new EnvDetector();
const chain = new ChainExecutor(engine);
const scaffolder = new Scaffolder(fileOps);
logger.info('Server', 'Modules loaded: FileOps, EnvDetector, Chain, Scaffold');

guard.on('process:hanging', (info) => {
    logger.warn('Guard', `Hanging: ${info.command} (silent ${Math.round(info.silentMs / 1000)}s)`);
});
guard.on('process:autoKilled', (info) => {
    logger.warn('Guard', `Auto-killed: ${info.command} — ${info.reason}`);
});

// ═══════════════════════════════════════════════════
// 5. Express + HTTP Server
// ═══════════════════════════════════════════════════
const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS для внешних клиентов
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// API routes
app.use('/api', createApiRouter(engine, superFile, guard, logger, { fileOps, envDetector, chain, scaffolder }));

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);

// ═══════════════════════════════════════════════════
// 6. WebSocket
// ═══════════════════════════════════════════════════
const wss = new WebSocketServer({ server });
setupWebSocket(wss, engine, guard, logger);

// ═══════════════════════════════════════════════════
// 7. Запуск
// ═══════════════════════════════════════════════════
server.listen(PORT, HOST, () => {
    logger.info('Server', `🚀 Control Ultra running at http://${HOST}:${PORT}`);
    logger.info('Server', `📡 WebSocket at ws://${HOST}:${PORT}`);
    logger.info('Server', `⚡ Super Mode: ${config.superMode ? 'ON' : 'OFF'}`);
    logger.info('Server', `🛡️  Max concurrent: ${config.safety.maxConcurrentProcesses}`);
    logger.info('Server', `⏰ Command timeout: ${config.safety.commandTimeout}ms`);
    logger.info('Server', ``);
    logger.info('Server', `Open the dashboard: http://${HOST}:${PORT}`);
});

// ═══════════════════════════════════════════════════
// 8. Graceful Shutdown
// ═══════════════════════════════════════════════════
function shutdown(signal) {
    logger.info('Server', `${signal} received. Shutting down...`);

    // Убиваем все процессы
    engine.killAll();

    // Останавливаем guard
    guard.stop();

    // Закрываем сервер
    wss.close();
    server.close(() => {
        logger.info('Server', 'Server closed');
        process.exit(0);
    });

    // Форсированный выход через 5 секунд
    setTimeout(() => {
        logger.error('Server', 'Forced exit');
        process.exit(1);
    }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
    logger.error('Server', 'Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    logger.error('Server', 'Unhandled rejection:', String(reason));
});
