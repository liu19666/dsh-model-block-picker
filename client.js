window.__ModuleLoader__.load({
  id: "dsh-model-block-picker",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    let ReactDOM = null;
    try { ReactDOM = require("react-dom"); } catch (e) {}
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    function report(state, detail) {
      try {
        fetch("/plugins/dsh-model-block-picker/diag?state=" + encodeURIComponent(state) + "&detail=" + encodeURIComponent(detail || ""));
      } catch (e) {}
    }

    report("module-evaluated", "v1.1.0");

    /* ------------------------------------------------------------------ *
     * 本地偏好：提供方顺序 / 隐藏的来源 / 隐藏的模型
     * ------------------------------------------------------------------ */

    const PREFS_KEY = "dsh-model-block-picker.prefs.v1";

    const EMPTY_PREFS = { order: [], hiddenProviders: [], hiddenModels: {}, modelOrder: {} };

    function readPrefs() {
      try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        if (!raw) return { ...EMPTY_PREFS };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return { ...EMPTY_PREFS };
        const order = Array.isArray(parsed.order) ? parsed.order.filter((v) => typeof v === "string") : [];
        const hiddenProviders = Array.isArray(parsed.hiddenProviders)
          ? parsed.hiddenProviders.filter((v) => typeof v === "string")
          : [];
        const hiddenModels = {};
        if (parsed.hiddenModels && typeof parsed.hiddenModels === "object") {
          for (const [key, value] of Object.entries(parsed.hiddenModels)) {
            if (Array.isArray(value)) {
              hiddenModels[key] = value.filter((v) => typeof v === "string");
            }
          }
        }
        const modelOrder = {};
        if (parsed.modelOrder && typeof parsed.modelOrder === "object") {
          for (const [key, value] of Object.entries(parsed.modelOrder)) {
            if (Array.isArray(value)) {
              const ids = value.filter((v) => typeof v === "string");
              if (ids.length > 0) modelOrder[key] = ids;
            }
          }
        }
        return { order, hiddenProviders, hiddenModels, modelOrder };
      } catch (e) {
        return { ...EMPTY_PREFS };
      }
    }

    function writePrefs(prefs) {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      } catch (e) {}
    }

    /* ------------------------------------------------------------------ *
     * Codex（ChatGPT 订阅）偏好桥：速度 / 输出详略
     * 走 provider 插件自己的 RPC，核心 catalog 并不暴露这两个维度。
     * ------------------------------------------------------------------ */

    const CODEX_PROVIDER = "openai-codex";
    const CODEX_ENDPOINT = "codex-subscription/preferences/";
    const ALIAS_ENDPOINT = "/plugins/dsh-model-block-picker/aliases";
    let PROVIDER_ALIASES = {};


    /* 推理强度滑条配色：按档位换色（青 → 蓝 → 靛 → 紫 → 品红 → 橙），与 Codex 原生近似 */
    const EFFORT_PALETTE = ["#22d3ee", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f97316"];

    function hexToRgba(hex, alpha) {
      const value = String(hex).replace("#", "");
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    }

    function effortTone(ratio) {
      const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
      const index = Math.round(clamped * (EFFORT_PALETTE.length - 1));
      const color = EFFORT_PALETTE[index];
      return { color: color, tint: hexToRgba(color, 0.16), ring: hexToRgba(color, 0.46) };
    }

    function rpcId() {
      const hex = "0123456789abcdef";
      let out = "";
      for (let i = 0; i < 32; i += 1) out += hex[Math.floor(Math.random() * 16)];
      return out.slice(0, 8) + "-" + out.slice(8, 12) + "-" + out.slice(12, 16) + "-" + out.slice(16, 20) + "-" + out.slice(20);
    }

    function unwrap(response) {
      if (!response || typeof response !== "object") throw new Error("empty response");
      if (response.ok !== true) {
        throw new Error((response.error && response.error.message) || "codex rpc failed");
      }
      return response.value;
    }

    function createCodexBridge(getContext) {
      function transport() {
        try {
          const ctx = getContext();
          const connection = ctx && typeof ctx.get === "function" ? ctx.get("connection") : null;
          const rpc = connection && connection.rpc;
          if (rpc && typeof rpc.call === "function") return rpc;
        } catch (e) {}
        return null;
      }

      async function call(endpoint, payload) {
        const target = CODEX_ENDPOINT + endpoint;
        const rpc = transport();
        if (rpc) return unwrap(await rpc.call("/api", target, payload));
        // 退路：直接按 Connection 的信封格式打同源 /api 路由。
        const id = rpcId();
        const response = await fetch("api/" + target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "client-request", rpcId: id, method: target, payload: payload === undefined ? null : payload })
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const body = await response.json();
        return unwrap(body && body.result);
      }

      return { call };
    }

    const EMPTY_CODEX = {
      available: false,
      loading: false,
      error: null,
      speedMode: "standard",
      outputVerbosity: "default",
      fastModels: [],
      ultrafastModels: [],
      verbosityModels: [],
      writable: false
    };

    function pickCodexState(value) {
      if (!value || typeof value !== "object") return { ...EMPTY_CODEX };
      const list = (input) => (Array.isArray(input) ? input.filter((v) => typeof v === "string") : []);
      return {
        available: true,
        loading: false,
        error: null,
        speedMode: typeof value.speedMode === "string" ? value.speedMode : "standard",
        outputVerbosity: typeof value.outputVerbosity === "string" ? value.outputVerbosity : "default",
        fastModels: list(value.fastModels),
        ultrafastModels: list(value.ultrafastModels),
        verbosityModels: list(value.verbosityModels),
        writable: value.writable === true
      };
    }

    /* ------------------------------------------------------------------ *
     * 样式
     * ------------------------------------------------------------------ */

    const CSS = `
      .dsh-mbp-scope {
        --mbp-accent: #4176e6;
        --mbp-accent-text: #2f5fd0;
        --mbp-accent-soft: rgba(65, 118, 230, 0.12);
        --mbp-accent-ring: rgba(65, 118, 230, 0.34);
        --mbp-surface: #ffffff;
        --mbp-surface-2: #f5f6f7;
        --mbp-surface-3: #ebeef2;
        --mbp-border: rgba(15, 17, 21, 0.10);
        --mbp-border-strong: rgba(15, 17, 21, 0.18);
        --mbp-text: #0f1115;
        --mbp-text-2: #61666b;
        --mbp-text-3: #8d939b;
        --mbp-track: rgba(15, 17, 21, 0.10);
        --mbp-shadow: 0 18px 48px rgba(15, 17, 21, 0.16), 0 4px 12px rgba(15, 17, 21, 0.08);
        --mbp-gradient: linear-gradient(90deg, #22d3ee 0%, #3b82f6 22%, #6366f1 42%, #a855f7 62%, #ec4899 82%, #f97316 100%);
      }
      body[data-ds-dark-theme] .dsh-mbp-scope {
        --mbp-accent: #7aaaff;
        --mbp-accent-text: #a9c6ff;
        --mbp-accent-soft: rgba(122, 170, 255, 0.16);
        --mbp-accent-ring: rgba(122, 170, 255, 0.42);
        --mbp-surface: #232324;
        --mbp-surface-2: #2c2c2e;
        --mbp-surface-3: #353638;
        --mbp-border: rgba(255, 255, 255, 0.10);
        --mbp-border-strong: rgba(255, 255, 255, 0.20);
        --mbp-text: #f9fafb;
        --mbp-text-2: #adb2b8;
        --mbp-text-3: #8d939b;
        --mbp-track: rgba(255, 255, 255, 0.14);
        --mbp-shadow: 0 20px 56px rgba(0, 0, 0, 0.58), 0 4px 14px rgba(0, 0, 0, 0.42);
      }
      .dsh-mbp-scope,
      .dsh-mbp-scope * {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",
          "Microsoft YaHei", Helvetica, Arial, sans-serif;
      }

      /* 触发按钮 ------------------------------------------------------- */
      .dsh-mbp-root { display: inline-block; }
      .dsh-mbp-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        max-width: 320px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface-2);
        color: var(--mbp-text);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        transition: border-color 0.15s ease, background 0.15s ease;
        user-select: none;
      }
      .dsh-mbp-trigger:hover:not(:disabled) {
        border-color: var(--mbp-border-strong);
        background: var(--mbp-surface-3);
      }
      .dsh-mbp-trigger[aria-expanded="true"] {
        border-color: var(--mbp-accent);
        box-shadow: 0 0 0 2px var(--mbp-accent-soft);
      }
      .dsh-mbp-trigger:disabled { opacity: 0.55; cursor: not-allowed; }
      .dsh-mbp-trigger-icon {
        display: inline-flex;
        align-items: center;
        color: var(--mbp-accent-text);
      }
      .dsh-mbp-trigger-icon svg { display: block; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
      .dsh-mbp-trigger-label {
        max-width: 230px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--mbp-text);
      }
      .dsh-mbp-trigger-arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: transform 0.2s ease, opacity 0.15s ease;
        color: var(--mbp-text-2);
      }
      .dsh-mbp-trigger-arrow svg { display: block; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
      .dsh-mbp-trigger-arrow.open { transform: rotate(180deg); opacity: 1; }

      /* 弹层 ----------------------------------------------------------- */
      .dsh-mbp-popover {
        position: fixed;
        z-index: 2147483000;
        width: 460px;
        max-width: calc(100vw - 24px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: var(--mbp-text);
        background: var(--mbp-surface);
        border: 1px solid var(--mbp-border);
        border-radius: 14px;
        box-shadow: var(--mbp-shadow);
        animation: dshMbpFadeIn 0.14s ease-out;
      }
      @keyframes dshMbpFadeIn {
        from { opacity: 0; transform: translateY(4px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .dsh-mbp-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--mbp-border);
        background: var(--mbp-surface-2);
      }
      .dsh-mbp-icon-btn {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 50%;
        border: 1px solid transparent;
        background: transparent;
        color: var(--mbp-text-2);
        cursor: pointer;
        transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
      }
      .dsh-mbp-icon-btn:hover { background: var(--mbp-surface-3); color: var(--mbp-text); }
      .dsh-mbp-icon-btn.on {
        color: var(--mbp-accent-text);
        border-color: var(--mbp-accent);
        background: var(--mbp-accent-soft);
      }
      .dsh-mbp-icon-btn svg { display: block; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
      .dsh-mbp-search-box {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        height: 30px;
        padding: 0 8px;
        border-radius: 8px;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .dsh-mbp-search-box:focus-within {
        border-color: var(--mbp-accent);
        box-shadow: 0 0 0 2px var(--mbp-accent-soft);
      }
      .dsh-mbp-search-box svg { display: block; width: 13px; height: 13px; fill: none; stroke: var(--mbp-text-3); stroke-width: 1.4; stroke-linecap: round; }
      .dsh-mbp-search-input {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        background: transparent;
        color: var(--mbp-text);
        font-size: 12px;
      }
      .dsh-mbp-search-input::placeholder { color: var(--mbp-text-3); }
      .dsh-mbp-clear-btn {
        border: none;
        background: none;
        padding: 2px 3px;
        border-radius: 4px;
        color: var(--mbp-text-3);
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
      }
      .dsh-mbp-clear-btn:hover { color: var(--mbp-text); }

      .dsh-mbp-body {
        flex: 1;
        min-height: 140px;
        max-height: min(56vh, 420px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 12px;
      }
      .dsh-mbp-body::-webkit-scrollbar { width: 8px; }
      .dsh-mbp-body::-webkit-scrollbar-thumb { background: var(--mbp-track); border-radius: 4px; }
      .dsh-mbp-body::-webkit-scrollbar-thumb:hover { background: var(--mbp-border-strong); }

      .dsh-mbp-list-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 8px;
        margin-bottom: 8px;
        border-bottom: 1px solid var(--mbp-border);
      }
      .dsh-mbp-list-title { font-size: 13px; font-weight: 600; color: var(--mbp-text); }
      .dsh-mbp-list-count { font-size: 11px; color: var(--mbp-text-3); }

      /* 来源分块 ------------------------------------------------------- */
      .dsh-mbp-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .dsh-mbp-card {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 4px;
        min-height: 62px;
        padding: 10px 11px;
        border-radius: 10px;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface-2);
        cursor: pointer;
        transition: background 0.14s ease, border-color 0.14s ease, transform 0.14s ease, opacity 0.14s ease;
      }
      .dsh-mbp-card:hover {
        background: var(--mbp-surface-3);
        border-color: var(--mbp-border-strong);
      }
      .dsh-mbp-card.current {
        border-color: var(--mbp-accent);
        background: var(--mbp-accent-soft);
      }
      .dsh-mbp-card.dragging { opacity: 0.55; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
      .dsh-mbp-card.dragging, .dsh-mbp-card-grip:active, .dsh-mbp-setting-grip:active { cursor: grabbing; }
      .dsh-mbp-card-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .dsh-mbp-card-grip {
        flex: none;
        color: var(--mbp-text-3);
        cursor: grab;
        opacity: 0;
        transition: opacity 0.14s ease;
        line-height: 0;
        touch-action: none;
      }
      .dsh-mbp-card:hover .dsh-mbp-card-grip { opacity: 1; }
      .dsh-mbp-card-grip svg { display: block; width: 10px; height: 10px; fill: currentColor; }
      .dsh-mbp-card-title {
        flex: 1;
        min-width: 0;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--mbp-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-badge {
        flex: none;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        line-height: 15px;
        color: #ffffff;
        background: var(--mbp-accent);
      }
      body[data-ds-dark-theme] .dsh-mbp-badge { color: #10141c; }
      .dsh-mbp-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        font-size: 11px;
        color: var(--mbp-text-2);
      }
      .dsh-mbp-card-enter { color: var(--mbp-text-3); }

      /* 模型列表 ------------------------------------------------------- */
      .dsh-mbp-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      .dsh-mbp-row + .dsh-mbp-row { margin-top: 2px; }
      .dsh-mbp-row:hover { background: var(--mbp-surface-2); }
      .dsh-mbp-row.selected {
        background: var(--mbp-accent-soft);
        border-color: var(--mbp-accent-ring);
      }
      .dsh-mbp-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .dsh-mbp-row-name {
        font-size: 12.5px;
        font-weight: 500;
        color: var(--mbp-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-row.selected .dsh-mbp-row-name { font-weight: 650; color: var(--mbp-accent-text); }
      .dsh-mbp-row-sub {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--mbp-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-dot { flex: none; width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: 0.6; }
      .dsh-mbp-check { flex: none; color: var(--mbp-accent-text); line-height: 0; }
      .dsh-mbp-check svg { display: block; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .dsh-mbp-empty { padding: 28px 12px; text-align: center; font-size: 12px; color: var(--mbp-text-3); }

      /* 设置面板 ------------------------------------------------------- */
      .dsh-mbp-settings-hint {
        margin: 0 0 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--mbp-surface-2);
        color: var(--mbp-text-2);
        font-size: 11px;
        line-height: 1.5;
      }
      .dsh-mbp-setting {
        border-radius: 9px;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface);
        overflow: hidden;
      }
      .dsh-mbp-setting + .dsh-mbp-setting { margin-top: 6px; }
      .dsh-mbp-setting-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: var(--mbp-surface-2);
      }
      .dsh-mbp-setting-name {
        flex: 1;
        min-width: 0;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--mbp-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-setting-count { flex: none; font-size: 11px; color: var(--mbp-text-3); }
      .dsh-mbp-expand {
        flex: none;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--mbp-text-2);
        cursor: pointer;
        transition: transform 0.16s ease, background 0.14s ease;
      }
      .dsh-mbp-expand:hover { background: var(--mbp-surface-3); color: var(--mbp-text); }
      .dsh-mbp-expand.open { transform: rotate(180deg); }
      .dsh-mbp-expand svg { display: block; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
      .dsh-mbp-alias-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
      }
      .dsh-mbp-alias-note {
        flex: 1;
        min-width: 0;
        font-size: 11px;
        color: var(--mbp-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-alias-apply {
        flex: none;
        height: 24px;
        padding: 0 10px;
        font-size: 11px;
        border-radius: 999px;
        border: 1px solid var(--mbp-accent);
        background: var(--mbp-accent-soft);
        color: var(--mbp-accent-text);
        cursor: pointer;
        transition: opacity 0.14s ease;
      }
      .dsh-mbp-alias-apply:disabled { opacity: 0.45; cursor: default; }
      .dsh-mbp-rename {
        flex: none;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--mbp-text-3);
        cursor: pointer;
        transition: background 0.14s ease, color 0.14s ease;
      }
      .dsh-mbp-rename:hover { background: var(--mbp-surface-3); color: var(--mbp-text); }
      .dsh-mbp-rename.on { color: var(--mbp-accent-text); }
      .dsh-mbp-rename svg { display: block; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
      .dsh-mbp-rename-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-top: 1px solid var(--mbp-border);
      }
      .dsh-mbp-rename-input {
        flex: 1;
        min-width: 0;
        height: 26px;
        padding: 0 8px;
        font-size: 12px;
        border-radius: 6px;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface);
        color: var(--mbp-text);
        outline: none;
      }
      .dsh-mbp-rename-input:focus { border-color: var(--mbp-accent); }
      .dsh-mbp-rename-save,
      .dsh-mbp-rename-reset {
        flex: none;
        height: 26px;
        padding: 0 10px;
        font-size: 11.5px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface-2);
        color: var(--mbp-text-2);
      }
      .dsh-mbp-rename-save {
        border-color: var(--mbp-accent);
        background: var(--mbp-accent-soft);
        color: var(--mbp-accent-text);
      }
      .dsh-mbp-setting-models { padding: 4px 6px 6px; max-height: 208px; overflow-y: auto; }
      .dsh-mbp-setting-models::-webkit-scrollbar { width: 8px; }
      .dsh-mbp-setting-models::-webkit-scrollbar-thumb { background: var(--mbp-track); border-radius: 4px; }
      .dsh-mbp-setting-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 6px;
        border-radius: 6px;
        cursor: pointer;
      }
      .dsh-mbp-setting-row:hover { background: var(--mbp-surface-2); }
      .dsh-mbp-setting-label {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        color: var(--mbp-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-setting-row.off .dsh-mbp-setting-label { color: var(--mbp-text-3); text-decoration: line-through; }
      .dsh-mbp-setting-row.dragging { opacity: 0.55; background: var(--mbp-accent-soft); }
      .dsh-mbp-setting-grip {
        flex: none;
        color: var(--mbp-text-3);
        opacity: 0;
        transition: opacity 0.14s ease;
        line-height: 0;
        touch-action: none;
        cursor: grab;
      }
      .dsh-mbp-setting-row:hover .dsh-mbp-setting-grip { opacity: 1; }
      .dsh-mbp-setting-grip svg { display: block; width: 10px; height: 10px; fill: currentColor; }
      .dsh-mbp-switch {
        flex: none;
        position: relative;
        width: 30px;
        height: 17px;
        padding: 0;
        border: 1px solid var(--mbp-border-strong);
        border-radius: 999px;
        background: var(--mbp-surface-3);
        cursor: pointer;
        transition: background 0.16s ease, border-color 0.16s ease;
      }
      .dsh-mbp-switch.on { background: var(--mbp-accent); border-color: var(--mbp-accent); }
      .dsh-mbp-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: var(--mbp-surface);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
        transition: transform 0.16s ease;
      }
      .dsh-mbp-switch.on::after { transform: translateX(13px); background: #ffffff; }

      /* 底部参数区 ------------------------------------------------------ */
      .dsh-mbp-footer {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--mbp-border);
        background: var(--mbp-surface-2);
      }
      .dsh-mbp-param { display: flex; flex-direction: column; gap: 8px; }
      .dsh-mbp-param + .dsh-mbp-param { padding-top: 12px; border-top: 1px dashed var(--mbp-border); }
      .dsh-mbp-param-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .dsh-mbp-param-label { font-size: 12px; font-weight: 600; color: var(--mbp-text-2); letter-spacing: 0.2px; }
      .dsh-mbp-param-value { font-size: 12px; font-weight: 600; color: var(--mbp-accent-text); }
      .dsh-mbp-param-value.muted { color: var(--mbp-text-3); font-weight: 500; }

      /* Codex 风格彩色拖动条：加粗 2.7 倍 + 六段渐变 + 光晕 + 高档位星尘 */
      .dsh-mbp-eff-value {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 10px 3px 8px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        color: var(--mbp-eff-color, var(--mbp-accent-text));
        background: var(--mbp-eff-tint, var(--mbp-accent-soft));
        box-shadow: inset 0 0 0 1px var(--mbp-eff-ring, var(--mbp-accent-ring));
      }
      .dsh-mbp-eff-value.muted { color: var(--mbp-text-3); background: rgba(127, 132, 141, 0.12); box-shadow: inset 0 0 0 1px var(--mbp-border); }
      .dsh-mbp-eff-bolt { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }
      .dsh-mbp-slider-shell { position: relative; display: flex; align-items: center; height: 36px; margin: 1px 0 -1px; isolation: isolate; }
      .dsh-mbp-aura {
        position: absolute;
        left: 5px;
        right: 5px;
        top: 50%;
        height: 22px;
        transform: translateY(-50%);
        border-radius: 999px;
        background-image: var(--mbp-gradient);
        background-repeat: no-repeat;
        background-size: var(--mbp-fill, 0%) 100%;
        filter: blur(10px) saturate(1.35);
        opacity: 0.72;
        pointer-events: none;
        z-index: 0;
      }
      .dsh-mbp-sparkle {
        position: absolute;
        left: 8px;
        right: 8px;
        top: 0;
        bottom: 0;
        z-index: 2;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease;
      }
      .dsh-mbp-sparkle.hot { opacity: 1; }
      .dsh-mbp-sparkle i {
        position: absolute;
        top: 50%;
        width: 4px;
        height: 4px;
        margin: -2px 0 0 -2px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 0 6px rgba(255, 255, 255, 0.95), 0 0 12px var(--mbp-eff-color, #a855f7);
        animation: dsh-mbp-twinkle 1.9s ease-in-out infinite;
      }
      @keyframes dsh-mbp-twinkle {
        0%, 100% { opacity: 0; transform: scale(0.35); }
        45% { opacity: 0.95; transform: scale(1); }
      }
      .dsh-mbp-range {
        position: relative;
        z-index: 1;
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 36px;
        margin: 0;
        background: transparent;
        cursor: pointer;
        outline: none;
      }
      .dsh-mbp-range::-webkit-slider-runnable-track {
        height: 16px;
        border-radius: 999px;
        background-image: var(--mbp-gradient);
        background-repeat: no-repeat;
        background-size: var(--mbp-fill, 0%) 100%;
        background-color: var(--mbp-track);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42), inset 0 -1px 1px rgba(0, 0, 0, 0.14), 0 1px 2px rgba(0, 0, 0, 0.10);
      }
      .dsh-mbp-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        margin-top: -4px;
        border-radius: 50%;
        border: 3px solid #ffffff;
        background: var(--mbp-eff-color, var(--mbp-accent));
        box-shadow: 0 0 0 1px rgba(15, 17, 21, 0.16), 0 3px 10px var(--mbp-eff-ring, rgba(65, 118, 230, 0.34)), 0 2px 6px rgba(0, 0, 0, 0.22);
        transition: box-shadow 0.16s ease, transform 0.16s ease;
      }
      .dsh-mbp-range:hover::-webkit-slider-thumb { transform: scale(1.07); box-shadow: 0 0 0 5px var(--mbp-eff-tint, var(--mbp-accent-soft)), 0 3px 12px var(--mbp-eff-ring, rgba(65, 118, 230, 0.34)); }
      .dsh-mbp-range:active::-webkit-slider-thumb { transform: scale(1.11); box-shadow: 0 0 0 8px var(--mbp-eff-tint, var(--mbp-accent-soft)), 0 3px 14px var(--mbp-eff-ring, rgba(65, 118, 230, 0.34)); }
      .dsh-mbp-range:disabled { opacity: 0.55; cursor: not-allowed; }
      .dsh-mbp-ticks { position: relative; height: 17px; margin: 5px 0 0; }
      .dsh-mbp-tick {
        position: absolute;
        top: 0;
        transform: translateX(-50%);
        max-width: 96px;
        font-size: 11.5px;
        line-height: 17px;
        font-weight: 600;
        color: var(--mbp-text-3);
        text-align: center;
        cursor: pointer;
        transition: color 0.14s ease, opacity 0.14s ease, transform 0.14s ease;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-tick.active { color: var(--mbp-eff-color, var(--mbp-accent-text)); font-weight: 800; transform: translateX(-50%) scale(1.06); }
      .dsh-mbp-tick:hover { opacity: 1; color: var(--mbp-text); }
      .dsh-mbp-param-hint { font-size: 10.5px; color: var(--mbp-text-3); }
      .dsh-mbp-reset {
        border: none;
        background: none;
        padding: 0;
        color: var(--mbp-text-3);
        font-size: 10.5px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .dsh-mbp-reset:hover { color: var(--mbp-accent-text); }

      /* 分段控件 */
      .dsh-mbp-segmented {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px;
        border-radius: 8px;
        border: 1px solid var(--mbp-border);
        background: var(--mbp-surface);
      }
      .dsh-mbp-seg {
        flex: 1;
        padding: 4px 8px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--mbp-text-2);
        font-size: 11.5px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.14s ease, color 0.14s ease;
        white-space: nowrap;
      }
      .dsh-mbp-seg:hover:not(:disabled) { background: var(--mbp-surface-2); color: var(--mbp-text); }
      .dsh-mbp-seg.active {
        background: var(--mbp-accent);
        color: #ffffff;
        font-weight: 600;
      }
      body[data-ds-dark-theme] .dsh-mbp-seg.active { color: #10141c; }
      .dsh-mbp-seg:disabled { opacity: 0.45; cursor: not-allowed; }
      .dsh-mbp-notice {
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--mbp-surface);
        border: 1px dashed var(--mbp-border-strong);
        color: var(--mbp-text-2);
        font-size: 11px;
        line-height: 1.5;
      }
    `;

    let styleEl = null;
    function injectStylesOnce() {
      if (styleEl || typeof document === "undefined") return;
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-plugin", "dsh-model-block-picker");
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }

    function getProviderDisplayName(groupId, groupName) {
      const renamed = PROVIDER_ALIASES[groupId];
      if (typeof renamed === "string" && renamed.trim().length > 0) return renamed.trim();
      if (groupId === "deepseek-account") return "DeepSeek 账号";
      if (groupId === "deepseek-official") return "DeepSeek (API)";
      if (groupId === CODEX_PROVIDER) return (groupName && groupName.trim()) || "ChatGPT 订阅";
      if (groupName && groupName.trim()) return groupName.trim();
      return groupId;
    }

    /* ------------------------------------------------------------------ *
     * 图标
     * ------------------------------------------------------------------ */

    function icon(paths, extra) {
      return h("svg", Object.assign({ viewBox: "0 0 16 16", "aria-hidden": true }, extra || null),
        paths.map((d, i) => h("path", { key: i, d }))
      );
    }

    const ICON_CHEVRON = icon(["M4 6.5L8 10.5L12 6.5"]);
    const ICON_BACK = icon(["M10 4L6 8L10 12"]);
    const ICON_GEAR = h("svg", { viewBox: "0 0 24 24", "aria-hidden": true, style: { strokeWidth: 1.9 } },
      h("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }),
      h("circle", { cx: 12, cy: 12, r: 3 })
    );
    const ICON_SEARCH = icon(["M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4z", "M11.2 11.2L14 14"]);
    const ICON_CHECK = icon(["M3.5 8.4L6.6 11.5L12.5 5"]);
    const ICON_BOLT = icon(["M8.6 1.8L3.4 9.1h3.7l-.6 5.1 5.2-7.3H7.9z"]);
    const ICON_PENCIL = icon([
      "M3.2 12.8l8.4-8.4 1.9 1.9-8.4 8.4-2.4.5z",
      "M11.7 2.9l.6-.6a1.1 1.1 0 0 1 1.6 1.6l-.6.6z"
    ]);
    const ICON_GRIP = h("svg", { viewBox: "0 0 8 12", "aria-hidden": true },
      [0, 1, 2, 3, 4, 5].map((i) => h("circle", { key: i, cx: i % 2 === 0 ? 2 : 6, cy: 2 + Math.floor(i / 2) * 4, r: 1, fill: "currentColor" }))
    );

    /* ------------------------------------------------------------------ *
     * 主组件
     * ------------------------------------------------------------------ */

    const SPEED_OPTIONS = [
      { id: "standard", label: "标准" },
      { id: "fast", label: "快速" },
      { id: "ultrafast", label: "极速" }
    ];

    const VERBOSITY_OPTIONS = [
      { id: "default", label: "默认" },
      { id: "low", label: "简洁" },
      { id: "medium", label: "均衡" },
      { id: "high", label: "详细" }
    ];

    function BlockModelSelect({ locked, available, directory, load, select, context }) {
      useEffect(() => {
        injectStylesOnce();
      }, []);

      /* ---- 模型目录 -------------------------------------------------- */

      const [snapshot, setSnapshot] = useState(() =>
        directory ? directory.getSnapshot() : { groups: [], current: null, status: "idle" }
      );

      useEffect(() => {
        if (!directory) return;
        setSnapshot(directory.getSnapshot());
        return directory.subscribe(() => setSnapshot(directory.getSnapshot()));
      }, [directory]);

      /* ---- 本地偏好 -------------------------------------------------- */

      const [prefs, setPrefs] = useState(readPrefs);

      const persistPrefs = useCallback((mutate) => {
        setPrefs((previous) => {
          const next = mutate(previous);
          writePrefs(next);
          return next;
        });
      }, []);

      /* ---- UI 状态 --------------------------------------------------- */

      const [open, setOpen] = useState(false);
      const [view, setView] = useState("browse");
      const [query, setQuery] = useState("");
      const [drilledGroupId, setDrilledGroupId] = useState(null);
      const [expandedProviders, setExpandedProviders] = useState([]);
      const [popoverPos, setPopoverPos] = useState({ left: 0, top: 0, ready: false });
      const dragRef = useRef(null);
      const [dragInfo, setDragInfo] = useState(null);
      const [sliderIndex, setSliderIndex] = useState(null);
      const [codex, setCodex] = useState({ ...EMPTY_CODEX });
      const [nameState, setNameState] = useState({ providers: [], aliases: {}, ready: false, loaded: false, busy: false, error: null });
      const [renamingId, setRenamingId] = useState(null);
      const [renameDraft, setRenameDraft] = useState("");
      PROVIDER_ALIASES = nameState.aliases;

      const triggerRef = useRef(null);
      const popoverRef = useRef(null);
      const searchInputRef = useRef(null);
      const dragCooldownRef = useRef(0);
      const commitTimerRef = useRef(null);
      const loadAliases = useCallback(async () => {
        try {
          const response = await fetch(ALIAS_ENDPOINT);
          const body = await response.json().catch(() => null);
          if (!response.ok || !body) throw new Error("HTTP " + response.status);
          setNameState({
            providers: Array.isArray(body.providers) ? body.providers : [],
            aliases: body.aliases && typeof body.aliases === "object" ? body.aliases : {},
            ready: body.ready === true,
            loaded: true,
            busy: false,
            error: null
          });
        } catch (error) {
          setNameState((previous) => ({
            ...previous,
            loaded: true,
            busy: false,
            error: String((error && error.message) || error)
          }));
        }
      }, []);

      const reloadCatalog = useCallback(async () => {
        if (!load) return;
        try {
          const pending = load();
          if (pending && typeof pending.then === "function") await pending;
        } catch (error) {}
      }, [load]);

      const postAlias = useCallback(async (op, id, rawName) => {
        const name = typeof rawName === "string" ? rawName.trim() : "";
        const actualOp = op === "set" && name.length === 0 ? "clear" : op;
        setNameState((previous) => ({ ...previous, busy: true, error: null }));
        try {
          const response = await fetch(ALIAS_ENDPOINT, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ op: actualOp, id, name })
          });
          const body = await response.json().catch(() => null);
          if (!response.ok || !body || body.ok !== true) {
            throw new Error((body && body.error) || "HTTP " + response.status);
          }
          setNameState({
            providers: Array.isArray(body.providers) ? body.providers : [],
            aliases: body.aliases && typeof body.aliases === "object" ? body.aliases : {},
            ready: body.ready !== false,
            loaded: true,
            busy: false,
            error: null
          });
          await reloadCatalog();
        } catch (error) {
          setNameState((previous) => ({
            ...previous,
            busy: false,
            error: String((error && error.message) || error)
          }));
        }
      }, [reloadCatalog]);

      useEffect(() => {
        if (!open || view !== "settings" || nameState.loaded) return;
        void loadAliases();
      }, [open, view, nameState.loaded, loadAliases]);

      const bridge = useMemo(() => createCodexBridge(() => context), [context]);

      /* ---- 排序与过滤 ------------------------------------------------ */

      const rankOf = (groupId) => (groupId === "deepseek-account" ? 0 : groupId === "deepseek-official" ? 1 : 2);

      const orderedGroups = useMemo(() => {
        const raw = Array.isArray(snapshot?.groups) ? snapshot.groups.slice() : [];
        const order = prefs.order;
        const modelOrder = prefs.modelOrder || {};
        const indexOf = (id) => {
          const at = order.indexOf(id);
          return at === -1 ? Number.MAX_SAFE_INTEGER : at;
        };
        raw.sort((a, b) => {
          const ia = indexOf(a.id);
          const ib = indexOf(b.id);
          if (ia !== ib) return ia - ib;
          const ra = rankOf(a.id);
          const rb = rankOf(b.id);
          if (ra !== rb) return ra - rb;
          return String(a.name || a.id).localeCompare(String(b.name || b.id));
        });
        return raw.map((group) => {
          const models = Array.isArray(group.models) ? group.models.slice() : [];
          const custom = Array.isArray(modelOrder[group.id]) ? modelOrder[group.id] : null;
          if (custom && custom.length > 0) {
            const modelRank = (id) => {
              const at = custom.indexOf(id);
              return at === -1 ? Number.MAX_SAFE_INTEGER : at;
            };
            models.sort((a, b) => modelRank(a.id) - modelRank(b.id));
            return { ...group, models };
          }
          return group;
        });
      }, [snapshot?.groups, prefs.order, prefs.modelOrder]);

      const isModelHidden = useCallback(
        (groupId, modelId) => (prefs.hiddenModels[groupId] || []).includes(modelId),
        [prefs.hiddenModels]
      );

      const visibleGroups = useMemo(() => {
        return orderedGroups
          .filter((group) => !prefs.hiddenProviders.includes(group.id))
          .map((group) => ({
            id: group.id,
            name: group.name,
            models: (group.models || []).filter((model) => !isModelHidden(group.id, model.id))
          }))
          .filter((group) => group.models.length > 0);
      }, [orderedGroups, prefs.hiddenProviders, isModelHidden]);

      const hiddenModelCount = useMemo(() => {
        let total = 0;
        for (const ids of Object.values(prefs.hiddenModels)) total += ids.length;
        return total;
      }, [prefs.hiddenModels]);

      const hiddenCount = prefs.hiddenProviders.length + hiddenModelCount;
      const hasCustomOrder = prefs.order.length > 0 || Object.keys(prefs.modelOrder || {}).length > 0;

      /* ---- 当前选择 -------------------------------------------------- */

      const currentProvider = snapshot?.current?.provider;
      const currentModel = snapshot?.current?.model;
      const currentEffort = snapshot?.current?.reasoningEffort;

      const allGroups = Array.isArray(snapshot?.groups) ? snapshot.groups : [];
      const currentGroupObj = allGroups.find((g) => g.id === currentProvider);
      const currentModelObj = currentGroupObj?.models?.find((m) => m.id === currentModel);
      const reasoning = currentModelObj?.reasoning;
      const efforts = Array.isArray(reasoning?.efforts) ? reasoning.efforts : [];

      const effortIndex = (() => {
        if (efforts.length === 0) return 0;
        if (sliderIndex !== null) return Math.min(sliderIndex, efforts.length - 1);
        const explicit = efforts.findIndex((effort) => effort.id === currentEffort);
        if (explicit >= 0) return explicit;
        const fallback = efforts.findIndex((effort) => effort.id === reasoning?.defaultEffort);
        return fallback >= 0 ? fallback : 0;
      })();

      const triggerLabel = useMemo(() => {
        if (snapshot?.status === "loading" && !snapshot?.current) return "加载模型中…";
        if (!snapshot?.current) return "选择模型";
        const providerName = currentGroupObj
          ? getProviderDisplayName(currentGroupObj.id, currentGroupObj.name)
          : currentProvider;
        const modelName = currentModelObj?.name || currentModel;
        return `${providerName} / ${modelName}`;
      }, [snapshot?.status, snapshot?.current, currentGroupObj, currentModelObj, currentProvider, currentModel]);

      /* ---- 定位 ------------------------------------------------------ */

      const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const popover = popoverRef.current;
        const width = popover ? popover.offsetWidth : 460;
        const height = popover ? popover.offsetHeight : 400;
        const margin = 12;

        let left = rect.left;
        if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
        if (left < margin) left = margin;

        let top = rect.top - height - 8;
        if (top < margin) {
          const below = rect.bottom + 8;
          top = below + height > window.innerHeight - margin ? Math.max(margin, window.innerHeight - height - margin) : below;
        }

        setPopoverPos({ left, top, ready: true });
      }, []);

      /* ---- 打开 / 关闭 ------------------------------------------------ */

      const closeAll = useCallback(() => {
        setOpen(false);
        setView("browse");
        setDrilledGroupId(null);
        setQuery("");
        dragRef.current = null;
        setDragInfo(null);
      }, []);

      useEffect(() => {
        if (!open) return;
        updatePosition();
        const raf = window.requestAnimationFrame(updatePosition);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
          window.cancelAnimationFrame(raf);
          window.removeEventListener("resize", updatePosition);
          window.removeEventListener("scroll", updatePosition, true);
        };
      }, [open, updatePosition, view, drilledGroupId]);

      useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event) => {
          if (triggerRef.current?.contains(event.target)) return;
          if (popoverRef.current?.contains(event.target)) return;
          closeAll();
        };
        const handleKeyDown = (event) => {
          if (event.key !== "Escape") return;
          if (view === "settings") {
            setView("browse");
            return;
          }
          if (drilledGroupId && !query) {
            setDrilledGroupId(null);
            return;
          }
          closeAll();
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("mousedown", handlePointerDown);
          document.removeEventListener("keydown", handleKeyDown);
        };
      }, [open, view, drilledGroupId, query, closeAll]);

      useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => searchInputRef.current?.focus(), 30);
        return () => window.clearTimeout(timer);
      }, [open, view]);

      useEffect(() => () => {
        if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
      }, []);

      /* ---- Codex 偏好 ------------------------------------------------ */

      const codexSupported = currentProvider === CODEX_PROVIDER;

      const refreshCodex = useCallback(async () => {
        setCodex((previous) => ({ ...previous, loading: true, error: null }));
        try {
          const value = await bridge.call("status", null);
          setCodex(pickCodexState(value));
        } catch (error) {
          setCodex({ ...EMPTY_CODEX, error: String((error && error.message) || error) });
        }
      }, [bridge]);

      useEffect(() => {
        if (!open || !codexSupported) return;
        if (codex.available || codex.loading || codex.error) return;
        refreshCodex();
      }, [open, codexSupported, codex.available, codex.loading, codex.error, refreshCodex]);

      const updateCodex = useCallback(async (patch) => {
        setCodex((previous) => ({ ...previous, loading: true, error: null }));
        try {
          const value = await bridge.call("update", patch);
          setCodex(pickCodexState(value));
        } catch (error) {
          setCodex((previous) => ({
            ...previous,
            loading: false,
            error: String((error && error.message) || error)
          }));
        }
      }, [bridge]);

      /* ---- 选择模型 -------------------------------------------------- */

      const applySelection = useCallback((group, model, reasoningEffort) => {
        if (!select) return;
        const payload = { provider: group.id, model: model.id };
        if (reasoningEffort !== undefined) payload.reasoningEffort = reasoningEffort;
        else if (model?.reasoning?.defaultEffort !== undefined) payload.reasoningEffort = model.reasoning.defaultEffort;
        try {
          const result = select(payload);
          if (result && typeof result.then === "function") result.then(() => {}, () => {});
        } catch (e) {}
      }, [select]);

      const handleModelSelect = useCallback((group, model) => {
        applySelection(group, model, undefined);
        closeAll();
      }, [applySelection, closeAll]);

      const applyEffort = useCallback((effortId) => {
        if (!select || !snapshot?.current) return;
        try {
          const result = select({
            provider: snapshot.current.provider,
            model: snapshot.current.model,
            reasoningEffort: effortId
          });
          if (result && typeof result.then === "function") result.then(() => {}, () => {});
        } catch (e) {}
      }, [select, snapshot?.current]);

      const scheduleEffort = useCallback((effortId) => {
        if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = window.setTimeout(() => {
          commitTimerRef.current = null;
          applyEffort(effortId);
        }, 180);
      }, [applyEffort]);

      const flushEffort = useCallback((effortId) => {
        if (commitTimerRef.current) {
          window.clearTimeout(commitTimerRef.current);
          commitTimerRef.current = null;
        }
        applyEffort(effortId);
      }, [applyEffort]);

      /* ---- 显隐 / 排序 ----------------------------------------------- */

      const toggleProvider = useCallback((groupId) => {
        persistPrefs((previous) => {
          const hidden = previous.hiddenProviders.includes(groupId)
            ? previous.hiddenProviders.filter((id) => id !== groupId)
            : previous.hiddenProviders.concat([groupId]);
          return { ...previous, hiddenProviders: hidden };
        });
      }, [persistPrefs]);

      const toggleModel = useCallback((groupId, modelId) => {
        persistPrefs((previous) => {
          const list = previous.hiddenModels[groupId] || [];
          const nextList = list.includes(modelId) ? list.filter((id) => id !== modelId) : list.concat([modelId]);
          const hiddenModels = { ...previous.hiddenModels };
          if (nextList.length === 0) delete hiddenModels[groupId];
          else hiddenModels[groupId] = nextList;
          return { ...previous, hiddenModels };
        });
      }, [persistPrefs]);

      const toggleExpanded = useCallback((groupId) => {
        setExpandedProviders((previous) =>
          previous.includes(groupId) ? previous.filter((id) => id !== groupId) : previous.concat([groupId])
        );
      }, []);

      const moveProvider = useCallback((fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return;
        const ids = orderedGroups.map((group) => group.id);
        const fromIndex = ids.indexOf(fromId);
        if (fromIndex < 0) return;
        ids.splice(fromIndex, 1);
        const toIndex = ids.indexOf(toId);
        if (toIndex < 0) {
          ids.push(fromId);
        } else {
          ids.splice(toIndex, 0, fromId);
        }
        persistPrefs((previous) => ({ ...previous, order: ids }));
      }, [orderedGroups, persistPrefs]);

      const moveModel = useCallback((providerId, fromId, toId) => {
        if (!providerId || !fromId || !toId || fromId === toId) return;
        const group = orderedGroups.find((entry) => entry.id === providerId);
        const ids = (group?.models || []).map((model) => model.id);
        const fromIndex = ids.indexOf(fromId);
        if (fromIndex < 0) return;
        ids.splice(fromIndex, 1);
        const toIndex = ids.indexOf(toId);
        if (toIndex < 0) ids.push(fromId);
        else ids.splice(toIndex, 0, fromId);
        persistPrefs((previous) => {
          const modelOrder = { ...(previous.modelOrder || {}) };
          modelOrder[providerId] = ids;
          return { ...previous, modelOrder };
        });
      }, [orderedGroups, persistPrefs]);

      const beginDrag = useCallback((event, kind, id, providerId) => {
        if (event.button !== undefined && event.button !== 0 && event.button !== -1) return;
        const target = event.target;
        if (target && target.closest && target.closest("button")) return;
        dragRef.current = {
          kind,
          id,
          providerId: providerId || null,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
          lastAt: 0
        };
      }, []);

      useEffect(() => {
        const handlePointerMove = (event) => {
          const pending = dragRef.current;
          if (!pending) return;
          if (!pending.active) {
            const dx = event.clientX - pending.startX;
            const dy = event.clientY - pending.startY;
            if (dx * dx + dy * dy < 36) return;
            pending.active = true;
            setDragInfo({ kind: pending.kind, id: pending.id, providerId: pending.providerId });
          }
          if (event.cancelable) event.preventDefault();
          const now = Date.now();
          if (now - pending.lastAt < 70) return;
          pending.lastAt = now;
          const element = document.elementFromPoint(event.clientX, event.clientY);
          const node = element && element.closest ? element.closest("[data-mbp-drag]") : null;
          if (!node) return;
          const id = node.getAttribute("data-mbp-id");
          if (!id || id === pending.id) return;
          const kind = node.getAttribute("data-mbp-drag");
          if (pending.kind === "provider" && kind === "provider") {
            moveProvider(pending.id, id);
            return;
          }
          if (pending.kind === "model" && kind === "model") {
            const providerId = node.getAttribute("data-mbp-provider") || "";
            if (!providerId || providerId !== pending.providerId) return;
            moveModel(providerId, pending.id, id);
          }
        };
        const stopDrag = () => {
          const pending = dragRef.current;
          dragRef.current = null;
          if (pending && pending.active) dragCooldownRef.current = Date.now();
          setDragInfo(null);
        };
        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", stopDrag);
        window.addEventListener("pointercancel", stopDrag);
        return () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", stopDrag);
          window.removeEventListener("pointercancel", stopDrag);
        };
      }, [moveProvider, moveModel]);

      const resetPrefs = useCallback(() => {
        persistPrefs(() => ({ ...EMPTY_PREFS }));
      }, [persistPrefs]);

      /* ---- 搜索 ------------------------------------------------------ */

      const searchMatches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return null;
        const matches = [];
        for (const group of visibleGroups) {
          for (const model of group.models) {
            const haystack = [model.name, model.id, group.name, group.id].filter(Boolean).join(" ").toLowerCase();
            if (haystack.includes(needle)) matches.push({ group, model });
          }
        }
        return matches;
      }, [query, visibleGroups]);

      const activeDrillGroup = visibleGroups.find((group) => group.id === drilledGroupId)
        || allGroups.find((group) => group.id === drilledGroupId);

      if (!available) return null;

      /* ---- 渲染片段 -------------------------------------------------- */

      const renderModelRow = (group, model) => {
        const isSelected = currentProvider === group.id && currentModel === model.id;
        const sub = [];
        if (model.id !== model.name) sub.push(h("span", { key: "id" }, model.id));
        if (model.reasoning) sub.push(h("span", { key: "r" }, "支持推理强度"));
        return h("div", {
          key: `${group.id}:${model.id}`,
          className: "dsh-mbp-row" + (isSelected ? " selected" : ""),
          role: "option",
          "aria-selected": isSelected,
          title: model.description || model.name || model.id,
          onClick: () => handleModelSelect(group, model)
        },
          h("div", { className: "dsh-mbp-row-main" },
            h("div", { className: "dsh-mbp-row-name" }, model.name || model.id),
            sub.length > 0
              ? h("div", { className: "dsh-mbp-row-sub" },
                  sub.map((node, index) => [index > 0 ? h("span", { key: `d${index}`, className: "dsh-mbp-dot" }) : null, node]))
              : null
          ),
          isSelected ? h("span", { className: "dsh-mbp-check" }, ICON_CHECK) : null
        );
      };

      const renderSearchResults = () => {
        const matches = searchMatches || [];
        if (matches.length === 0) {
          return h("div", { className: "dsh-mbp-empty" }, `未找到与 “${query.trim()}” 匹配的模型`);
        }
        return h("div", null,
          h("div", { className: "dsh-mbp-list-header" },
            h("span", { className: "dsh-mbp-list-title" }, "搜索结果"),
            h("span", { className: "dsh-mbp-list-count" }, `共 ${matches.length} 个`)
          ),
          matches.map(({ group, model }) => {
            const isSelected = currentProvider === group.id && currentModel === model.id;
            return h("div", {
              key: `${group.id}:${model.id}`,
              className: "dsh-mbp-row" + (isSelected ? " selected" : ""),
              title: model.description || model.name || model.id,
              onClick: () => handleModelSelect(group, model)
            },
              h("div", { className: "dsh-mbp-row-main" },
                h("div", { className: "dsh-mbp-row-name" }, model.name || model.id),
                h("div", { className: "dsh-mbp-row-sub" },
                  h("span", null, getProviderDisplayName(group.id, group.name)),
                  model.reasoning ? h("span", { className: "dsh-mbp-dot" }) : null,
                  model.reasoning ? h("span", null, "推理") : null
                )
              ),
              isSelected ? h("span", { className: "dsh-mbp-check" }, ICON_CHECK) : null
            );
          })
        );
      };

      const renderDrillDown = () => {
        if (!activeDrillGroup) return h("div", { className: "dsh-mbp-empty" }, "该来源不可用");
        const models = (activeDrillGroup.models || []).filter((model) => !isModelHidden(activeDrillGroup.id, model.id));
        const available2 = (orderedGroups.find((g) => g.id === activeDrillGroup.id)?.models || []).filter(
          (model) => !isModelHidden(activeDrillGroup.id, model.id)
        );
        const list = models.length > 0 ? models : available2;
        return h("div", null,
          h("div", { className: "dsh-mbp-list-header" },
            h("span", { className: "dsh-mbp-list-title" }, getProviderDisplayName(activeDrillGroup.id, activeDrillGroup.name)),
            h("span", { className: "dsh-mbp-list-count" }, `${list.length} 个模型`)
          ),
          list.length === 0
            ? h("div", { className: "dsh-mbp-empty" }, "该来源暂无可显示的模型，可在设置中恢复")
            : list.map((model) => renderModelRow(activeDrillGroup, model))
        );
      };

      const renderBrowse = () => {
        if (visibleGroups.length === 0) {
          const message = allGroups.length === 0
            ? "暂无可用的模型来源"
            : "所有来源或模型都被隐藏了，点左上角设置按钮恢复";
          return h("div", null,
            h("div", { className: "dsh-mbp-list-header" },
              h("span", { className: "dsh-mbp-list-title" }, "模型来源渠道"),
              h("span", { className: "dsh-mbp-list-count" }, `共 ${allGroups.length} 个来源`)
            ),
            h("div", { className: "dsh-mbp-empty" }, message)
          );
        }
        return h("div", null,
          h("div", { className: "dsh-mbp-list-header" },
            h("span", { className: "dsh-mbp-list-title" }, "模型来源渠道"),
            h("span", { className: "dsh-mbp-list-count" }, `共 ${visibleGroups.length} 个来源`)
          ),
          h("div", { className: "dsh-mbp-grid" },
            visibleGroups.map((group) => {
              const isCurrentSource = currentProvider === group.id;
              const name = getProviderDisplayName(group.id, group.name);
              const draggingThis = Boolean(dragInfo)
                && dragInfo.kind === "provider"
                && dragInfo.id === group.id;
              return h("div", {
                key: group.id,
                className: "dsh-mbp-card"
                  + (isCurrentSource ? " current" : "")
                  + (draggingThis ? " dragging" : ""),
                "data-mbp-drag": "provider",
                "data-mbp-id": group.id,
                onPointerDown: (event) => beginDrag(event, "provider", group.id, null),
                onClick: () => {
                  if (Date.now() - dragCooldownRef.current < 260) return;
                  setDrilledGroupId(group.id);
                  setQuery("");
                },
                title: "按住拖动可调整来源顺序（可一次跨过多个卡片），点击进入选择模型"
              },
                h("div", { className: "dsh-mbp-card-head" },
                  h("span", { className: "dsh-mbp-card-grip" }, ICON_GRIP),
                  h("span", { className: "dsh-mbp-card-title" }, name),
                  isCurrentSource ? h("span", { className: "dsh-mbp-badge" }, "当前") : null
                ),
                h("div", { className: "dsh-mbp-card-meta" },
                  h("span", null, `${group.models.length} 个模型`),
                  h("span", { className: "dsh-mbp-card-enter" }, "进入 →")
                )
              );
            })
          )
        );
      };

      const renderSettings = () => {
        return h("div", null,
          h("div", { className: "dsh-mbp-list-header" },
            h("span", { className: "dsh-mbp-list-title" }, "显示设置"),
            h("span", { className: "dsh-mbp-list-count" }, hiddenCount > 0 ? `已隐藏 ${hiddenCount} 项` : "全部显示")
          ),
          h("p", { className: "dsh-mbp-settings-hint" },
            "关闭某个来源会隐藏它的全部模型；展开后可以逐个模型开关，拖动模型行可调整该来源内部的排列顺序（可一次跨多行）。来源卡片的先后顺序在列表页按住卡片拖动即可调整。此处的选择仅影响本机界面，不影响模型本身是否可用。"
          ),
          h("div", { className: "dsh-mbp-alias-bar" },
            h("span", { className: "dsh-mbp-alias-note", title: nameState.error || "" },
              nameState.error
                ? "宿主未就绪：" + nameState.error
                : nameState.loaded
                  ? (nameState.ready ? "改名会写入模型注册表，并同步到全部界面" : "已保存名称，等待模型服务就绪")
                  : "正在读取来源…"
            ),
            h("button", {
              type: "button",
              className: "dsh-mbp-alias-apply",
              disabled: nameState.busy || !nameState.loaded || Boolean(nameState.error),
              title: "把已保存的名称重新写入注册表，并刷新全部界面",
              onClick: () => {
                void postAlias("apply");
              }
            }, nameState.busy ? "同步中…" : "同步到全部界面")
          ),
          orderedGroups.length === 0
            ? h("div", { className: "dsh-mbp-empty" }, "暂无可配置的来源")
            : orderedGroups.map((group) => {
                const providerHidden = prefs.hiddenProviders.includes(group.id);
                const hiddenModels = prefs.hiddenModels[group.id] || [];
                const models = group.models || [];
                const visibleCount = providerHidden ? 0 : models.length - hiddenModels.length;
                const expanded = expandedProviders.includes(group.id);
                return h("div", { key: group.id, className: "dsh-mbp-setting" },
                  h("div", { className: "dsh-mbp-setting-head" },
                    h("span", { className: "dsh-mbp-setting-name" }, getProviderDisplayName(group.id, group.name)),
                    h("button", {
                      type: "button",
                      className: "dsh-mbp-rename" + (renamingId === group.id ? " on" : ""),
                      title: "重命名这个来源",
                      "aria-label": "重命名 " + getProviderDisplayName(group.id, group.name),
                      onClick: (event) => {
                        event.stopPropagation();
                        if (renamingId === group.id) {
                          setRenamingId(null);
                          return;
                        }
                        setRenamingId(group.id);
                        setRenameDraft(nameState.aliases[group.id] || "");
                      }
                    }, ICON_PENCIL),
                    h("span", { className: "dsh-mbp-setting-count" }, `${Math.max(0, visibleCount)}/${models.length}`),
                    h("button", {
                      type: "button",
                      className: "dsh-mbp-switch" + (providerHidden ? "" : " on"),
                      role: "switch",
                      "aria-checked": !providerHidden,
                      "aria-label": `显示 ${getProviderDisplayName(group.id, group.name)}`,
                      onClick: (event) => {
                        event.stopPropagation();
                        toggleProvider(group.id);
                      }
                    }),
                    h("button", {
                      type: "button",
                      className: "dsh-mbp-expand" + (expanded ? " open" : ""),
                      "aria-label": expanded ? "收起模型列表" : "展开模型列表",
                      onClick: () => toggleExpanded(group.id)
                    }, ICON_CHEVRON)
                  ),
                  renamingId === group.id
                    ? h("div", { className: "dsh-mbp-rename-row" },
                        h("input", {
                          type: "text",
                          className: "dsh-mbp-rename-input",
                          autoFocus: true,
                          maxLength: 48,
                          spellCheck: false,
                          placeholder: (nameState.providers.find((entry) => entry.id === group.id) || {}).base || group.name || group.id,
                          value: renameDraft,
                          onChange: (event) => setRenameDraft(event.target.value),
                          onKeyDown: (event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void postAlias("set", group.id, renameDraft);
                              setRenamingId(null);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setRenamingId(null);
                            }
                          }
                        }),
                        h("button", {
                          type: "button",
                          className: "dsh-mbp-rename-save",
                          onClick: () => {
                            void postAlias("set", group.id, renameDraft);
                            setRenamingId(null);
                          }
                        }, "保存"),
                        h("button", {
                          type: "button",
                          className: "dsh-mbp-rename-reset",
                          onClick: () => {
                            void postAlias("clear", group.id);
                            setRenamingId(null);
                            setRenameDraft("");
                          }
                        }, "恢复默认")
                      )
                    : null,
                  expanded
                    ? h("div", { className: "dsh-mbp-setting-models" },
                        models.length === 0
                          ? h("div", { className: "dsh-mbp-empty", style: { padding: "14px 8px" } }, "该来源没有模型")
                          : models.map((model) => {
                              const hidden = hiddenModels.includes(model.id);
                              const dragActive = Boolean(dragInfo)
                                && dragInfo.kind === "model"
                                && dragInfo.providerId === group.id
                                && dragInfo.id === model.id;
                              return h("div", {
                                key: model.id,
                                className: "dsh-mbp-setting-row" + (hidden || providerHidden ? " off" : "") + (dragActive ? " dragging" : ""),
                                "data-mbp-drag": "model",
                                "data-mbp-id": model.id,
                                "data-mbp-provider": group.id,
                                onPointerDown: (event) => beginDrag(event, "model", model.id, group.id),
                                onClick: () => {
                                  if (Date.now() - dragCooldownRef.current < 260) return;
                                  toggleModel(group.id, model.id);
                                },
                                title: "上下拖动可调整该来源内部模型顺序，点击切换显示"
                              },
                                h("span", { className: "dsh-mbp-setting-grip", "aria-hidden": "true" }, ICON_GRIP),
                                h("span", { className: "dsh-mbp-setting-label", title: model.id }, model.name || model.id),
                                h("button", {
                                  type: "button",
                                  className: "dsh-mbp-switch" + (hidden || providerHidden ? "" : " on"),
                                  role: "switch",
                                  "aria-checked": !(hidden || providerHidden),
                                  "aria-label": `显示 ${model.name || model.id}`,
                                  disabled: providerHidden,
                                  onClick: (event) => {
                                    event.stopPropagation();
                                    toggleModel(group.id, model.id);
                                  }
                                })
                              );
                            })
                      )
                    : null
                );
              }),
          hiddenCount > 0 || hasCustomOrder
            ? h("div", { style: { marginTop: "10px", textAlign: "right" } },
                h("button", { type: "button", className: "dsh-mbp-reset", onClick: resetPrefs }, "恢复全部显示与默认顺序")
              )
            : null
        );
      };

      const renderEffort = () => {
        if (efforts.length === 0) return null;
        const active = efforts[effortIndex];
        const isExplicit = currentEffort !== undefined && currentEffort !== null;
        const ratio = efforts.length > 1 ? effortIndex / (efforts.length - 1) : 1;
        const pct = Math.max(2, Math.min(100, efforts.length > 1 ? ratio * 100 : 100));
        const tone = effortTone(ratio);
        const hot = efforts.length > 2 && ratio >= 0.66;
        const shellStyle = { "--mbp-fill": pct.toFixed(2) + "%" };
        return h("div", {
          className: "dsh-mbp-param",
          style: { "--mbp-eff-color": tone.color, "--mbp-eff-tint": tone.tint, "--mbp-eff-ring": tone.ring }
        },
          h("div", { className: "dsh-mbp-param-head" },
            h("span", { className: "dsh-mbp-param-label" }, "推理强度"),
            h("span", { className: "dsh-mbp-eff-value" + (active ? "" : " muted") },
              h("span", { className: "dsh-mbp-eff-bolt", "aria-hidden": "true" }),
              active ? (active.name || active.id) : "默认")
          ),
          h("div", { className: "dsh-mbp-slider-shell" },
            h("div", { className: "dsh-mbp-aura", style: shellStyle }),
            h("div", { className: "dsh-mbp-sparkle" + (hot ? " hot" : "") },
              [14, 28, 41, 55, 69, 84].map((pos, index) =>
                h("i", { key: pos, style: { left: pos + "%", animationDelay: (index * 0.31).toFixed(2) + "s" } })
              )
            ),
            h("input", {
              type: "range",
              className: "dsh-mbp-range",
              min: 0,
              max: Math.max(0, efforts.length - 1),
              step: 1,
              value: effortIndex,
              disabled: locked,
              style: shellStyle,
              "aria-label": "推理强度",
              onChange: (event) => {
                const index = Number(event.target.value);
                setSliderIndex(index);
                scheduleEffort(efforts[index] && efforts[index].id);
              },
              onPointerUp: () => {
                const index = sliderIndex === null ? effortIndex : sliderIndex;
                flushEffort(efforts[index] && efforts[index].id);
              },
              onKeyUp: () => {
                const index = sliderIndex === null ? effortIndex : sliderIndex;
                flushEffort(efforts[index] && efforts[index].id);
              }
            })
          ),
          h("div", { className: "dsh-mbp-ticks" },
            efforts.map((effort, index) => {
              const tickRatio = efforts.length > 1 ? index / (efforts.length - 1) : 0.5;
              const tickTone = effortTone(tickRatio);
              const isActive = index === effortIndex;
              return h("span", {
                key: effort.id,
                className: "dsh-mbp-tick" + (isActive ? " active" : ""),
                title: effort.description || effort.name || effort.id,
                style: {
                  left: "calc(" + (tickRatio * 100).toFixed(4) + "% + " + (12 * (1 - tickRatio * 2)).toFixed(2) + "px)",
                  color: tickTone.color,
                  opacity: isActive ? 1 : 0.62
                },
                onClick: () => {
                  setSliderIndex(index);
                  flushEffort(effort.id);
                }
              }, effort.name || effort.id);
            })
          ),
          isExplicit
            ? h("div", { className: "dsh-mbp-param-hint" },
                h("button", {
                  type: "button",
                  className: "dsh-mbp-reset",
                  onClick: () => {
                    setSliderIndex(null);
                    applyEffort(undefined);
                  }
                }, "恢复模型默认" + (reasoning && reasoning.defaultEffort ? "（" + reasoning.defaultEffort + "）" : ""))
              )
            : h("div", { className: "dsh-mbp-param-hint" }, "当前跟随模型默认值")
        );
      };

      const renderCodexParams = () => {
        if (!codexSupported) return null;
        if (codex.error && !codex.available) {
          return h("div", { className: "dsh-mbp-param" },
            h("div", { className: "dsh-mbp-param-head" },
              h("span", { className: "dsh-mbp-param-label" }, "订阅参数"),
              h("span", { className: "dsh-mbp-param-value muted" }, "不可用")
            ),
            h("div", { className: "dsh-mbp-notice" },
              "没有读到 ChatGPT 订阅插件的偏好接口，速度与输出详略暂时无法在此调整。",
              h("br"),
              h("span", { style: { opacity: 0.75 } }, String(codex.error).slice(0, 160))
            )
          );
        }

        const supportsFast = codex.fastModels.includes(currentModel);
        const supportsUltrafast = codex.ultrafastModels.includes(currentModel);
        const supportsVerbosity = codex.verbosityModels.includes(currentModel);
        const disabled = locked || codex.writable !== true || codex.loading;

        const rows = [];

        if (supportsFast || supportsUltrafast) {
          const options = SPEED_OPTIONS.filter(
            (option) => option.id === "standard" || (option.id === "fast" && supportsFast) || (option.id === "ultrafast" && supportsUltrafast)
          );
          const activeSpeed = options.some((option) => option.id === codex.speedMode) ? codex.speedMode : "standard";
          rows.push(h("div", { key: "speed", className: "dsh-mbp-param" },
            h("div", { className: "dsh-mbp-param-head" },
              h("span", { className: "dsh-mbp-param-label" }, "速度"),
              h("span", { className: "dsh-mbp-param-value muted" }, "订阅级设置")
            ),
            h("div", { className: "dsh-mbp-segmented" },
              options.map((option) => h("button", {
                key: option.id,
                type: "button",
                className: "dsh-mbp-seg" + (option.id === activeSpeed ? " active" : ""),
                disabled,
                onClick: () => updateCodex({ speedMode: option.id })
              }, option.label))
            )
          ));
        }

        if (supportsVerbosity) {
          rows.push(h("div", { key: "verbosity", className: "dsh-mbp-param" },
            h("div", { className: "dsh-mbp-param-head" },
              h("span", { className: "dsh-mbp-param-label" }, "输出详略"),
              h("span", { className: "dsh-mbp-param-value muted" }, "订阅级设置")
            ),
            h("div", { className: "dsh-mbp-segmented" },
              VERBOSITY_OPTIONS.map((option) => h("button", {
                key: option.id,
                type: "button",
                className: "dsh-mbp-seg" + (option.id === codex.outputVerbosity ? " active" : ""),
                disabled,
                onClick: () => updateCodex({ outputVerbosity: option.id })
              }, option.label))
            )
          ));
        }

        if (rows.length === 0) {
          if (codex.loading) return null;
          return h("div", { className: "dsh-mbp-param" },
            h("div", { className: "dsh-mbp-param-head" },
              h("span", { className: "dsh-mbp-param-label" }, "订阅参数"),
              h("span", { className: "dsh-mbp-param-value muted" }, "该模型不支持")
            )
          );
        }

        if (codex.error) {
          rows.push(h("div", { key: "err", className: "dsh-mbp-param-hint" }, String(codex.error).slice(0, 160)));
        }

        return rows;
      };

      const renderFooter = () => {
        const blocks = [];
        const effort = renderEffort();
        if (effort) blocks.push(effort);
        const codexBlocks = renderCodexParams();
        if (codexBlocks) {
          if (Array.isArray(codexBlocks)) blocks.push(...codexBlocks);
          else blocks.push(codexBlocks);
        }
        if (blocks.length === 0) return null;
        return h("div", { className: "dsh-mbp-footer" }, blocks);
      };

      const renderPortal = () => {
        if (!open) return null;

        const header = h("div", { className: "dsh-mbp-header" },
          view === "browse" && drilledGroupId
            ? h("button", {
                type: "button",
                className: "dsh-mbp-icon-btn",
                title: "返回所有来源",
                onClick: () => {
                  setDrilledGroupId(null);
                  setQuery("");
                }
              }, ICON_BACK)
            : null,
          view === "settings"
            ? h("button", {
                type: "button",
                className: "dsh-mbp-icon-btn",
                title: "返回",
                onClick: () => setView("browse")
              }, ICON_BACK)
            : null,
          h("button", {
            type: "button",
            className: "dsh-mbp-icon-btn" + (view === "settings" ? " on" : ""),
            title: view === "settings" ? "关闭设置" : "显示设置：选择要显示的来源与模型",
            "aria-pressed": view === "settings",
            onClick: () => {
              setView((previous) => (previous === "settings" ? "browse" : "settings"));
              setQuery("");
            }
          }, ICON_GEAR),
          view === "settings"
            ? h("div", { className: "dsh-mbp-search-box", style: { opacity: 0.9 } },
                h("span", { style: { flex: 1, fontSize: "12px", color: "var(--mbp-text-2)" } }, "显示设置"))
            : h("div", { className: "dsh-mbp-search-box" },
                ICON_SEARCH,
                h("input", {
                  ref: searchInputRef,
                  type: "text",
                  className: "dsh-mbp-search-input",
                  placeholder: drilledGroupId
                    ? `在 ${getProviderDisplayName(activeDrillGroup?.id, activeDrillGroup?.name)} 中搜索…`
                    : "搜索模型名称或来源（如 v3、r1、sonnet 等）…",
                  value: query,
                  onChange: (event) => setQuery(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" && searchMatches && searchMatches.length > 0) {
                      handleModelSelect(searchMatches[0].group, searchMatches[0].model);
                    }
                  }
                }),
                query
                  ? h("button", {
                      type: "button",
                      className: "dsh-mbp-clear-btn",
                      title: "清除",
                      onClick: () => {
                        setQuery("");
                        searchInputRef.current?.focus();
                      }
                    }, "✕")
                  : null
              )
        );

        const body = h("div", { className: "dsh-mbp-body" },
          view === "settings"
            ? renderSettings()
            : searchMatches !== null
              ? renderSearchResults()
              : drilledGroupId
                ? renderDrillDown()
                : renderBrowse()
        );

        const content = h("div", {
          ref: popoverRef,
          className: "dsh-mbp-popover dsh-mbp-scope",
          style: {
            left: `${popoverPos.left}px`,
            top: `${popoverPos.top}px`,
            visibility: popoverPos.ready ? "visible" : "hidden"
          }
        }, header, body, view === "settings" ? null : renderFooter());

        if (ReactDOM?.createPortal && typeof document !== "undefined" && document.body) {
          return ReactDOM.createPortal(content, document.body);
        }
        return content;
      };

      return h("div", { className: "dsh-mbp-root dsh-mbp-scope", style: { display: "inline-block" } },
        h("button", {
          ref: triggerRef,
          type: "button",
          className: "dsh-mbp-trigger",
          disabled: locked,
          title: triggerLabel,
          "aria-expanded": open,
          "aria-haspopup": "dialog",
          onClick: () => {
            if (open) {
              closeAll();
              return;
            }
            if (load) {
              try {
                const result = load();
                if (result && typeof result.then === "function") result.then(() => {}, () => {});
              } catch (e) {}
            }
            setPopoverPos((previous) => ({ ...previous, ready: false }));
            setOpen(true);
          }
        },
          h("span", { className: "dsh-mbp-trigger-icon" }, ICON_BOLT),
          h("span", { className: "dsh-mbp-trigger-label" }, triggerLabel),
          h("span", { className: "dsh-mbp-trigger-arrow" + (open ? " open" : "") }, ICON_CHEVRON)
        ),
        renderPortal()
      );
    }

    /* ------------------------------------------------------------------ *
     * 插件装配
     * ------------------------------------------------------------------ */

    const inject = ["slots", "modelDirectories"];

    function apply(ctx) {
      report("apply-called", "starting slot inject");

      try {
        ctx.slots.inject("conversation.input.model", () => {
          report("slot-inject-triggered", "conversation.input.model");
          try {
            const dispose = ctx.slots.register({
              name: "conversation.input.model",
              priority: -20,
              inject: (sessionId) => {
                const models = ctx.modelDirectories;
                let directory = null;
                if (models && sessionId !== void 0) {
                  try {
                    directory = models.directoryFor(sessionId);
                  } catch (e) {
                    report("directoryFor-error", String(e));
                  }
                }
                return {
                  available: true,
                  context: ctx,
                  directory: directory ? directory.store : null,
                  load: () => (directory ? directory.load().catch(() => {}) : Promise.resolve()),
                  select: (selection) => (directory ? directory.select(selection) : Promise.resolve())
                };
              }
            }, BlockModelSelect);

            report("registered-success", "priority=-20");
            return () => {
              report("slot-disposed", "");
              try { dispose(); } catch (e) {}
            };
          } catch (err) {
            report("register-error", String(err && err.message ? err.message : err));
          }
        });
      } catch (e) {
        report("apply-error", String(e));
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
