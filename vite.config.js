var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/// <reference types="vitest/config" />
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Dev-only comment store: the browser can't write files, so the dev server
// owns ggg-viz/comments.json. GET returns all comments; POST appends one
// (id/at/status assigned here). The file is committed — comments are design
// artifacts a review session reads and replies to.
function commentsApi() {
    var file = fileURLToPath(new URL('./comments.json', import.meta.url));
    var load = function () { return (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []); };
    return {
        name: 'ggg-comments-api',
        configureServer: function (server) {
            server.middlewares.use('/api/comments', function (req, res) {
                res.setHeader('content-type', 'application/json');
                if (req.method === 'GET') {
                    res.end(JSON.stringify(load()));
                    return;
                }
                if (req.method === 'POST') {
                    var chunks_1 = [];
                    req.on('data', function (c) { return chunks_1.push(c); });
                    req.on('end', function () {
                        try {
                            var body = JSON.parse(Buffer.concat(chunks_1).toString('utf8'));
                            if (typeof (body === null || body === void 0 ? void 0 : body.text) !== 'string' || !body.text.trim() || typeof (body === null || body === void 0 ? void 0 : body.scenarioId) !== 'string') {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'text and scenarioId required' }));
                                return;
                            }
                            var all = load();
                            var comment = __assign(__assign({ id: "c-".concat(Date.now().toString(36), "-").concat(Math.random().toString(36).slice(2, 6)), at: new Date().toISOString(), status: 'open' }, body), { text: body.text.trim() });
                            all.push(comment);
                            writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
                            res.end(JSON.stringify(all));
                        }
                        catch (_a) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ error: 'bad json' }));
                        }
                    });
                    return;
                }
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'method not allowed' }));
            });
        },
    };
}
export default defineConfig({
    plugins: [react(), commentsApi()],
    resolve: { dedupe: ['react', 'react-dom'] },
    optimizeDeps: { exclude: ['@owebeeone/grip-react'] },
    test: { include: ['src/**/*.test.{ts,tsx}'] },
});
