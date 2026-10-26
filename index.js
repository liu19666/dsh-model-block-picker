import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const name = 'dsh-model-block-picker';
export const inject = ['webServer'];

const DIAG_PATH = '/plugins/dsh-model-block-picker/diag';
const ALIAS_PATH = '/plugins/dsh-model-block-picker/aliases';
const MAX_NAME_LENGTH = 48;

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

function readBody(req, limit) {
  const cap = typeof limit === 'number' ? limit : 32 * 1024;
  return new Promise((resolve) => {
    let raw = '';
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    try {
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > cap) finish(raw.slice(0, cap));
      });
      req.on('end', () => finish(raw));
      req.on('error', () => finish(raw));
      req.on('close', () => finish(raw));
    } catch (e) {
      finish(raw);
    }
  });
}

function dshStateDir() {
  const configured = process.env.DSH_HOME;
  const home = typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim()
    : join(homedir(), '.dsh');
  return join(home, 'state', 'dsh-model-block-picker');
}

const STORE_PATH = join(dshStateDir(), 'aliases.json');

/** 用户设置过的显示名：provider id -> 名称。 */
const aliases = new Map();
/** 插件自己注册的名字，用于「恢复默认」。 */
const baseNames = new Map();

let llm = null;
let applying = false;

function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function loadStore() {
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.aliases && typeof parsed.aliases === 'object') {
      for (const [id, name] of Object.entries(parsed.aliases)) {
        const clean = sanitizeName(name);
        if (typeof id === 'string' && id.length > 0 && clean.length > 0) aliases.set(id, clean);
      }
    }
    if (parsed.base && typeof parsed.base === 'object') {
      for (const [id, name] of Object.entries(parsed.base)) {
        if (typeof id === 'string' && typeof name === 'string' && name.length > 0) baseNames.set(id, name);
      }
    }
    log('已载入别名存储:', aliases.size, '条别名 /', baseNames.size, '条原始名');
  } catch (error) {
    if (error && error.code !== 'ENOENT') log('读取别名存储失败:', error.message);
  }
}

function saveStore() {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    const payload = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      aliases: Object.fromEntries(aliases),
      base: Object.fromEntries(baseNames)
    }, null, 2);
    const temporary = STORE_PATH + '.tmp';
    writeFileSync(temporary, payload, 'utf8');
    renameSync(temporary, STORE_PATH);
  } catch (error) {
    log('保存别名存储失败:', error && error.message);
  }
}

/** llm 服务的注册表：普通 Map，条目形如 { adapter, provider: { id, name }, retryPolicy }。 */
function registry() {
  const map = llm && llm.adapters;
  return map instanceof Map ? map : null;
}

function describeProviders() {
  const map = registry();
  if (!map) return [];
  const rows = [];
  for (const registration of map.values()) {
    const provider = registration && registration.provider;
    if (!provider || typeof provider.id !== 'string') continue;
    if (!baseNames.has(provider.id)) baseNames.set(provider.id, provider.name);
    rows.push({
      id: provider.id,
      name: provider.name,
      base: baseNames.get(provider.id) || provider.name,
      alias: aliases.get(provider.id) || null
    });
  }
  rows.sort((left, right) => left.id.localeCompare(right.id));
  return rows;
}

function desiredName(provider) {
  const alias = aliases.get(provider.id);
  if (typeof alias === 'string' && alias.length > 0) return alias;
  const base = baseNames.get(provider.id);
  return typeof base === 'string' && base.length > 0 ? base : provider.name;
}

/**
 * 把用户设置的名称写进 llm 注册表，并广播 llm/adapters-updated 让所有界面刷新。
 * 注册表条目在 adapter 重新注册（commitRoutes）时会被重建，所以每次事件都重放一遍。
 */
function applyAliases(reason) {
  if (applying) return false;
  const map = registry();
  if (!map) return false;
  applying = true;
  let changed = false;
  const notes = [];
  try {
    for (const registration of map.values()) {
      const provider = registration && registration.provider;
      if (!provider || typeof provider.id !== 'string') continue;
      if (!baseNames.has(provider.id)) baseNames.set(provider.id, provider.name);
      const target = desiredName(provider);
      if (typeof target !== 'string' || target.length === 0 || provider.name === target) continue;
      try {
        provider.name = target;
      } catch (error) {
        try {
          map.set(provider.id, { ...registration, provider: { ...provider, name: target } });
        } catch (inner) {
          notes.push(provider.id + ': ' + (inner && inner.message));
          continue;
        }
      }
      changed = true;
    }
  } finally {
    applying = false;
  }
  if (changed) {
    try {
      llm.emitAdaptersUpdated();
    } catch (error) {
      notes.push('emit: ' + (error && error.message));
    }
  }
  if (aliases.size > 0 || changed) log('应用别名(' + reason + ') 变更=' + changed);
  if (notes.length > 0) log('应用别名备注:', notes.join('; '));
  return changed;
}

function restoreBaseNames() {
  const map = registry();
  if (!map) return;
  let changed = false;
  for (const registration of map.values()) {
    const provider = registration && registration.provider;
    if (!provider || typeof provider.id !== 'string') continue;
    const base = baseNames.get(provider.id);
    if (typeof base !== 'string' || base.length === 0 || provider.name === base) continue;
    try {
      provider.name = base;
      changed = true;
    } catch (error) {}
  }
  if (changed) {
    try {
      llm.emitAdaptersUpdated();
    } catch (error) {}
  }
}

function payload(extra) {
  return Object.assign({
    ok: true,
    ready: registry() !== null,
    store: STORE_PATH,
    aliases: Object.fromEntries(aliases),
    providers: describeProviders()
  }, extra || null);
}

async function handleAliases(req, res) {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      sendJson(res, 200, payload());
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method not allowed' });
      return;
    }
    const raw = await readBody(req);
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'invalid json' });
      return;
    }
    const op = body && typeof body.op === 'string' ? body.op : 'apply';
    const id = body && typeof body.id === 'string' ? body.id.trim() : '';

    if (op === 'set') {
      const clean = sanitizeName(body && body.name);
      if (id.length === 0) {
        sendJson(res, 400, { ok: false, error: '缺少提供方 id' });
        return;
      }
      if (clean.length === 0) {
        sendJson(res, 400, { ok: false, error: '名称不能为空' });
        return;
      }
      aliases.set(id, clean);
      saveStore();
      const changed = applyAliases('set:' + id);
      sendJson(res, 200, payload({ changed, message: changed ? '已同步到全部界面' : '已保存（该来源当前未注册）' }));
      return;
    }

    if (op === 'clear') {
      if (id.length > 0) {
        aliases.delete(id);
        saveStore();
        applyAliases('clear:' + id);
      }
      sendJson(res, 200, payload({ message: '已恢复默认名称' }));
      return;
    }

    if (op === 'apply') {
      const changed = applyAliases('manual');
      sendJson(res, 200, payload({ changed, message: changed ? '已同步到全部界面' : '所有名称已是最新' }));
      return;
    }

    sendJson(res, 400, { ok: false, error: '未知操作: ' + op });
  } catch (error) {
    log('别名路由异常:', error && error.message);
    try {
      sendJson(res, 500, { ok: false, error: 'internal error' });
    } catch (inner) {}
  }
}

export function apply(ctx) {
  log('Host half loaded');
  loadStore();

  try {
    ctx.inject(['llm'], (llmCtx) => {
      llm = llmCtx.llm;
      if (!llm) {
        log('llm 服务不可用，别名只保存不生效');
        return;
      }
      // 监听 llm/adapters-updated：cordis 的事件派发只会沿「发出方 → 根」冒泡，
      // 因此优先挂在 llm 服务自己的 ctx 上，再补插件 ctx 与根 ctx，避免漏事件。
      const sources = [];
      const addSource = (label, target) => {
        if (!target || typeof target.on !== 'function') return;
        if (sources.some((item) => item.target === target)) return;
        sources.push({ label: label, target: target });
      };
      addSource('llm.ctx', llm.ctx);
      addSource('plugin.ctx', ctx);
      addSource('root', ctx.root);

      const disposers = [];
      for (const source of sources) {
        try {
          const dispose = source.target.on('llm/adapters-updated', () => {
            applyAliases('adapters-updated<' + source.label + '>');
          });
          if (typeof dispose === 'function') disposers.push(dispose);
          log('已监听 llm/adapters-updated: ' + source.label);
        } catch (error) {
          log('监听 llm/adapters-updated 失败(' + source.label + '):', error && error.message);
        }
      }
      try {
        ctx.effect(() => () => {
          for (const dispose of disposers) {
            try {
              dispose();
            } catch (error) {}
          }
        });
      } catch (error) {
        log('注册监听清理失败:', error && error.message);
      }

      applyAliases('startup');
      // adapter 可能比本插件晚注册，补两次延迟重放。
      for (const delay of [600, 2000]) {
        try {
          const timer = setTimeout(() => {
            applyAliases('startup+' + delay + 'ms');
          }, delay);
          if (timer && typeof timer.unref === 'function') timer.unref();
        } catch (error) {}
      }
      try {
        ctx.effect(() => () => {
          restoreBaseNames();
        });
      } catch (error) {
        log('注册清理失败:', error && error.message);
      }
    });
  } catch (error) {
    log('注入 llm 失败:', error && error.message);
  }

  try {
    ctx.inject(['webServer'], (webCtx) => {
      const webServer = webCtx.webServer;
      if (!webServer || typeof webServer.register !== 'function') return;

      try {
        webServer.register({
          kind: 'prefix',
          path: DIAG_PATH,
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
        log('已挂载诊断路由 ' + DIAG_PATH);
      } catch (error) {
        log('挂载诊断路由异常:', error && error.message);
      }

      try {
        webServer.register({
          kind: 'prefix',
          path: ALIAS_PATH,
          handler: (req, res) => {
            void handleAliases(req, res);
          }
        });
        log('已挂载别名路由 ' + ALIAS_PATH);
      } catch (error) {
        log('挂载别名路由异常:', error && error.message);
      }
    });
  } catch (error) {
    log('Host apply error:', error && error.message);
  }
}
