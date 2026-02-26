/**
 * Control Ultra — REST API Routes
 * API для управления командами, настройками и мониторингом
 */

const express = require('express');

function createApiRouter(engine, superFile, guard, logger, modules = {}) {
    const { fileOps, envDetector, chain, scaffolder } = modules;
    const router = express.Router();

    // ═══════════════════════════════════════════
    // COMMANDS
    // ═══════════════════════════════════════════

    /**
     * POST /api/commands — Выполнить команду
     * Body: { command: string, cwd?: string, timeout?: number, priority?: number, env?: object }
     */
    router.post('/commands', (req, res) => {
        const { command, cwd, timeout, priority, env, shell, metadata } = req.body;

        if (!command || typeof command !== 'string') {
            return res.status(400).json({ error: 'Command is required and must be a string' });
        }

        logger.info('API', `Execute: ${command}`);
        const result = engine.enqueue(command, { cwd, timeout, priority, env, shell, metadata });

        res.json({
            success: result.status !== 'blocked',
            command: result,
        });
    });

    /**
     * POST /api/commands/batch — Выполнить несколько команд
     * Body: { commands: Array<{ command, cwd?, timeout?, priority? }> }
     */
    router.post('/commands/batch', (req, res) => {
        const { commands } = req.body;

        if (!Array.isArray(commands) || commands.length === 0) {
            return res.status(400).json({ error: 'Commands array is required' });
        }

        logger.info('API', `Batch execute: ${commands.length} commands`);

        const results = commands.map(cmd => {
            return engine.enqueue(cmd.command, {
                cwd: cmd.cwd,
                timeout: cmd.timeout,
                priority: cmd.priority,
                env: cmd.env,
            });
        });

        res.json({
            success: true,
            commands: results,
        });
    });

    /**
     * GET /api/commands/:id — Получить информацию о команде
     */
    router.get('/commands/:id', (req, res) => {
        const cmd = engine.getCommand(req.params.id);
        if (!cmd) {
            return res.status(404).json({ error: 'Command not found' });
        }
        res.json(cmd);
    });

    /**
     * POST /api/commands/:id/confirm — Подтвердить команду
     */
    router.post('/commands/:id/confirm', (req, res) => {
        const success = engine.confirm(req.params.id);
        res.json({ success });
    });

    /**
     * POST /api/commands/:id/reject — Отклонить команду
     */
    router.post('/commands/:id/reject', (req, res) => {
        const success = engine.reject(req.params.id);
        res.json({ success });
    });

    /**
     * POST /api/commands/:id/kill — Убить процесс
     */
    router.post('/commands/:id/kill', (req, res) => {
        logger.warn('API', `Kill command: ${req.params.id}`);
        const success = engine.kill(req.params.id);
        res.json({ success });
    });

    /**
     * POST /api/commands/:id/input — Отправить ввод в stdin
     * Body: { input: string }
     */
    router.post('/commands/:id/input', (req, res) => {
        const { input } = req.body;
        if (typeof input !== 'string') {
            return res.status(400).json({ error: 'Input must be a string' });
        }
        const success = engine.sendInput(req.params.id, input);
        res.json({ success });
    });

    /**
     * POST /api/commands/kill-all — Убить все процессы
     */
    router.post('/commands/kill-all', (req, res) => {
        logger.warn('API', 'Kill all commands');
        const killed = engine.killAll();
        res.json({ success: true, killed });
    });

    // ═══════════════════════════════════════════
    // STATUS & MONITORING
    // ═══════════════════════════════════════════

    /**
     * GET /api/status — Полный статус системы
     */
    router.get('/status', (req, res) => {
        const engineStatus = engine.getStatus();
        const guardStats = guard.getStats();
        const config = superFile.getConfig();

        res.json({
            superMode: config.superMode,
            engine: engineStatus,
            guard: guardStats,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
        });
    });

    /**
     * GET /api/history — История команд
     */
    router.get('/history', (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const history = engine.getHistory(limit);
        res.json(history);
    });

    // ═══════════════════════════════════════════
    // CONFIG (SuperFile)
    // ═══════════════════════════════════════════

    /**
     * GET /api/config — Получить текущий конфиг
     */
    router.get('/config', (req, res) => {
        res.json(superFile.getConfig());
    });

    /**
     * PATCH /api/config — Обновить часть конфига
     * Body: partial config object
     */
    router.patch('/config', (req, res) => {
        logger.info('API', 'Config updated');
        const updated = superFile.update(req.body);
        res.json({ success: true, config: updated });
    });

    /**
     * PUT /api/config — Полностью заменить конфиг
     * Body: full config object
     */
    router.put('/config', (req, res) => {
        logger.warn('API', 'Config replaced');
        superFile.update(req.body);
        res.json({ success: true, config: superFile.getConfig() });
    });

    /**
     * POST /api/config/toggle-super — Переключить Super Mode
     */
    router.post('/config/toggle-super', (req, res) => {
        const config = superFile.getConfig();
        const newMode = !config.superMode;
        superFile.update({ superMode: newMode });
        logger.info('API', `Super Mode: ${newMode ? 'ON ⚡' : 'OFF 🔒'}`);
        res.json({ success: true, superMode: newMode });
    });

    // ═══════════════════════════════════════════
    // FILES
    // ═══════════════════════════════════════════

    /**
     * POST /api/files/read — Чтение файла
     * Body: { path: string }
     */
    router.post('/files/read', (req, res) => {
        const { path: filePath } = req.body;
        const fs = require('fs');

        const perm = superFile.isFileOperationAllowed(filePath);
        if (!perm.allowed) {
            return res.status(403).json({ error: perm.reason });
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            res.json({ success: true, content });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/files/write — Запись в файл
     * Body: { path: string, content: string }
     */
    router.post('/files/write', (req, res) => {
        const { path: filePath, content } = req.body;
        const fs = require('fs');
        const path = require('path');

        const perm = superFile.isFileOperationAllowed(filePath);
        if (!perm.allowed) {
            return res.status(403).json({ error: perm.reason });
        }

        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            logger.info('API', `File written: ${filePath}`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ═══════════════════════════════════════════
    // ADVANCED FILE OPS (Module)
    // ═══════════════════════════════════════════

    if (fileOps) {
        router.post('/files/create', (req, res) => {
            const { path: p, content } = req.body;
            if (!p) return res.status(400).json({ error: 'path required' });
            logger.info('API', 'File create: ' + p);
            res.json(fileOps.create(p, content || ''));
        });

        router.post('/files/append', (req, res) => {
            const { path: p, content } = req.body;
            res.json(fileOps.append(p, content || ''));
        });

        router.post('/files/replace', (req, res) => {
            const { path: p, search, replacement, options } = req.body;
            res.json(fileOps.replace(p, search, replacement, options));
        });

        router.post('/files/insert-line', (req, res) => {
            const { path: p, line, content } = req.body;
            res.json(fileOps.insertAtLine(p, line, content));
        });

        router.post('/files/delete-lines', (req, res) => {
            const { path: p, from, to } = req.body;
            res.json(fileOps.deleteLines(p, from, to));
        });

        router.post('/files/copy', (req, res) => {
            res.json(fileOps.copy(req.body.src, req.body.dest));
        });

        router.post('/files/move', (req, res) => {
            res.json(fileOps.move(req.body.src, req.body.dest));
        });

        router.post('/files/remove', (req, res) => {
            logger.warn('API', 'File remove: ' + req.body.path);
            res.json(fileOps.remove(req.body.path));
        });

        router.post('/files/search', (req, res) => {
            const { path: p, query, options } = req.body;
            res.json(fileOps.search(p, query, options));
        });

        router.post('/files/list', (req, res) => {
            res.json(fileOps.list(req.body.path, req.body.options));
        });

        router.post('/files/tree', (req, res) => {
            res.json(fileOps.tree(req.body.path, req.body.maxDepth));
        });

        router.post('/files/exists', (req, res) => {
            res.json(fileOps.exists(req.body.path));
        });
    }

    // ═══════════════════════════════════════════
    // ENVIRONMENT
    // ═══════════════════════════════════════════

    if (envDetector) {
        router.get('/env', async (req, res) => {
            const env = await envDetector.detect();
            res.json(env);
        });

        router.post('/env/analyze', (req, res) => {
            const { path: p } = req.body;
            if (!p) return res.status(400).json({ error: 'path required' });
            res.json(envDetector.analyzeProject(p));
        });

        router.post('/env/check', (req, res) => {
            const { path: p } = req.body;
            if (!p) return res.status(400).json({ error: 'path required' });
            res.json(envDetector.whatDoINeed(p));
        });
    }

    // ═══════════════════════════════════════════
    // SCAFFOLD
    // ═══════════════════════════════════════════

    if (scaffolder) {
        router.get('/scaffold/templates', (req, res) => {
            res.json(scaffolder.listTemplates());
        });

        router.post('/scaffold/create', (req, res) => {
            const { template, name, path: p } = req.body;
            if (!template || !name) return res.status(400).json({ error: 'template and name required' });
            logger.info('API', 'Scaffold: ' + template + ' -> ' + name);
            res.json(scaffolder.scaffold(template, name, p));
        });
    }

    // ═══════════════════════════════════════════
    // CHAIN EXECUTOR
    // ═══════════════════════════════════════════

    if (chain) {
        router.post('/chain', async (req, res) => {
            const { steps, options } = req.body;
            if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps array required' });
            logger.info('API', 'Chain: ' + steps.length + ' steps');
            const result = await chain.runChain(steps, options);
            res.json(result);
        });

        router.post('/parallel', async (req, res) => {
            const { commands, options } = req.body;
            if (!Array.isArray(commands)) return res.status(400).json({ error: 'commands array required' });
            logger.info('API', 'Parallel: ' + commands.length + ' commands');
            const result = await chain.runParallel(commands, options);
            res.json(result);
        });
    }

    // ═══════════════════════════════════════════
    // SERVER CONTROL
    // ═══════════════════════════════════════════

    router.post('/restart', (req, res) => {
        logger.warn('API', 'Server restart requested');
        res.json({ success: true, message: 'Restarting...' });
        setTimeout(() => process.exit(0), 500);
    });

    router.post('/shutdown', (req, res) => {
        logger.warn('API', 'Server shutdown requested');
        res.json({ success: true, message: 'Shutting down...' });
        setTimeout(() => process.exit(0), 500);
    });

    return router;
}

module.exports = createApiRouter;
