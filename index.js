import { existsSync } from 'node:fs';

export const name = 'dsh-model-block-picker';
export const inject = ['webServer'];

function log(...args) {
  try {
    console.log('[dsh-model-block-picker]', ...args);
  } catch (e) {}
}

function sendJson(res, statusCode, data) {
  try {
    const payload = JSON.stringify(data);
    res.writeHead(statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'cache-control': 'no-store'
    });
    res.end(payload);
  } catch (e) {}
}

export function apply(ctx) {
  log('Host half loaded');
  try {
    ctx.inject(['webServer'], (webCtx) => {
      const webServer = webCtx.webServer;
      if (!webServer || typeof webServer.register !== 'function') return;

      try {
        webServer.register({
          kind: 'prefix',
          path: '/plugins/dsh-model-block-picker/diag',
          handler: (req, res) => {
            try {
              const url = new URL(req.url, 'http://127.0.0.1');
              const state = url.searchParams.get('state') || '';
              const detail = url.searchParams.get('detail') || '';
              log('客户端汇报: state=' + state + ' detail=' + detail);
            } catch (e) {}
            sendJson(res, 200, { ok: true });
          }
        });
        log('已挂载诊断路由 /plugins/dsh-model-block-picker/diag');
      } catch (err) {
        log('挂载诊断路由异常:', err.message);
      }
    });
  } catch (e) {
    log('Host apply error:', e);
  }
}
