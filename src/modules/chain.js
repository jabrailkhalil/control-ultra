/**
 * Control Ultra — Chain Executor
 * Sequential/parallel command chains with conditions, retries, variables
 */
const { EventEmitter } = require('events');

class ChainExecutor extends EventEmitter {
    constructor(commandEngine) {
        super();
        this.engine = commandEngine;
    }

    async runChain(steps, options = {}) {
        const results = [];
        const vars = { ...(options.vars || {}) };
        let aborted = false;
        this.emit('chain:start', { steps: steps.length });

        for (let i = 0; i < steps.length; i++) {
            if (aborted) break;
            const step = steps[i];
            const stepName = step.name || 'Step ' + (i + 1);
            let command = this._interpolate(step.command, vars);
            this.emit('chain:step', { index: i, name: stepName, command });

            const maxRetries = step.retry || 0;
            let attempt = 0;
            let result = null;

            while (attempt <= maxRetries) {
                if (attempt > 0) {
                    this.emit('chain:retry', { index: i, attempt });
                    await this._delay(step.retryDelay || 3000);
                }
                result = await this._execWait(command, { timeout: step.timeout, cwd: step.cwd });
                if (result.success || attempt >= maxRetries) break;
                attempt++;
            }

            if (step.saveAs) vars[step.saveAs] = (result.output || []).join('').trim();
            vars['step_' + i + '_exit'] = result.exitCode;
            results.push({ name: stepName, command, ...result, attempts: attempt + 1 });

            if (result.success && step.onSuccess) {
                const r = await this._execWait(this._interpolate(step.onSuccess, vars));
                results.push({ name: stepName + ' (onSuccess)', ...r });
            }
            if (!result.success) {
                if (step.onFail) {
                    const r = await this._execWait(this._interpolate(step.onFail, vars));
                    results.push({ name: stepName + ' (onFail)', ...r });
                }
                if (step.critical !== false && options.stopOnError !== false) {
                    aborted = true;
                    this.emit('chain:aborted', { index: i, name: stepName });
                }
            }
        }

        const summary = {
            total: results.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            aborted, results,
        };
        this.emit('chain:done', summary);
        return summary;
    }

    async runParallel(commands, options = {}) {
        const promises = commands.map(item => {
            const cmd = typeof item === 'string' ? { command: item } : item;
            return this._execWait(cmd.command, { timeout: cmd.timeout, cwd: cmd.cwd })
                .then(r => ({ command: cmd.command, ...r }));
        });
        const results = await Promise.all(promises);
        return {
            total: results.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        };
    }

    templateNodeInit(name, pkgs = []) {
        const s = [
            { name: 'mkdir', command: 'mkdir "' + name + '"', critical: false },
            { name: 'npm init', command: 'npm init -y', cwd: name },
        ];
        if (pkgs.length) s.push({ name: 'install', command: 'npm install ' + pkgs.join(' '), cwd: name, retry: 1 });
        return s;
    }

    templateGitInit() {
        return [
            { name: 'git init', command: 'git init' },
            { name: 'add', command: 'git add .' },
            { name: 'commit', command: 'git commit -m "Initial commit"' },
        ];
    }

    _execWait(command, opts = {}) {
        return new Promise(resolve => {
            const info = this.engine.enqueue(command, opts);
            if (info.status === 'blocked') {
                return resolve({ success: false, status: 'blocked', reason: info.reason, output: [], errors: [], exitCode: 1 });
            }
            const done = (f) => {
                if (f.id !== info.id) return;
                this.engine.removeListener('command:finished', done);
                resolve({ success: f.status === 'completed', status: f.status, exitCode: f.exitCode, output: f.output, errors: f.errors });
            };
            this.engine.on('command:finished', done);
            setTimeout(() => { this.engine.removeListener('command:finished', done); resolve({ success: false, status: 'timeout', output: [], errors: [], exitCode: -1 }); }, (opts.timeout || 300000) + 5000);
        });
    }

    _interpolate(str, vars) {
        if (!str || !vars) return str;
        return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
    }

    _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = ChainExecutor;
