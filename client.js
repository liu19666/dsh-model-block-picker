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

    report("module-evaluated", "start");

    const CSS = `
      .dsh-mbp-portal-root {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .dsh-mbp-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.12));
        background: var(--dsw-alias-bg-layer-1, rgba(0, 0, 0, 0.02));
        color: var(--dsw-alias-label-primary, #1c1f23);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.15s ease;
        user-select: none;
      }
      .dsh-mbp-trigger:hover:not(:disabled) {
        background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.06));
        border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.2));
      }
      .dsh-mbp-trigger:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      /* 深色外观：对齐麦克风 / 截图图标。
         依据 dsh-screen-capture-record-desktop 的原始实现：图标用
         color:var(--dsw-alias-label-primary)，且是 1px 细描边的「空心」svg
         （fill="none" stroke="currentColor" stroke-width="1"）。
         所以这里同用该 token，并把边框降到 .5px 描边级重量，避免实心大色块显得更亮。 */
      body[data-ds-dark-theme] .dsh-mbp-trigger {
        border: 0.5px solid var(--dsw-alias-label-primary, #f9fafb);
        color: var(--dsw-alias-label-primary, #f9fafb);
        background: transparent;
      }
      body[data-ds-dark-theme] .dsh-mbp-trigger:hover:not(:disabled) {
        border-color: var(--dsw-alias-label-primary, #f9fafb);
        background: var(--dsw-alias-interactive-bg-hover-solid, rgba(127, 127, 127, 0.18));
      }
      body[data-ds-dark-theme] .dsh-mbp-trigger-arrow {
        color: var(--dsw-alias-label-primary, #f9fafb);
        opacity: 1;
      }
      .dsh-mbp-trigger-icon {
        font-size: 13px;
        display: flex;
        align-items: center;
      }
      .dsh-mbp-trigger-label {
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* 空心细描边箭头：与邻居图标同款笔画（fill:none + stroke-width:1） */
      .dsh-mbp-trigger-arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.75;
        transition: transform 0.2s ease;
      }
      .dsh-mbp-trigger-arrow svg {
        display: block;
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .dsh-mbp-trigger-arrow.open {
        transform: rotate(180deg);
      }
      .dsh-mbp-popover {
        position: fixed;
        z-index: 999999;
        width: 440px;
        max-height: 520px;
        background: var(--dsw-alias-bg-overlay, #ffffff);
        color: var(--dsw-alias-label-primary, #1c1f23);
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.12));
        border-radius: 14px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        backdrop-filter: blur(24px);
        animation: dshMbpFadeIn 0.15s ease-out;
      }
      @keyframes dshMbpFadeIn {
        from { opacity: 0; transform: translateY(4px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .dsh-mbp-header {
        padding: 10px 14px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--dsw-alias-bg-layer-1, rgba(0, 0, 0, 0.02));
      }
      .dsh-mbp-back-btn {
        background: var(--dsw-alias-bg-layer-1, rgba(0, 0, 0, 0.05));
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
        cursor: pointer;
        color: var(--dsw-alias-label-primary, #1c1f23);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s ease;
        white-space: nowrap;
      }
      .dsh-mbp-back-btn:hover {
        background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.1));
      }
      .dsh-mbp-search-box {
        flex: 1;
        display: flex;
        align-items: center;
        background: var(--dsw-alias-bg-overlay, #ffffff);
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.12));
        border-radius: 8px;
        padding: 0 8px;
        height: 30px;
        transition: border-color 0.15s ease;
      }
      .dsh-mbp-search-box:focus-within {
        border-color: var(--dsw-alias-brand-primary, #1e80ff);
      }
      .dsh-mbp-search-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        color: inherit;
        font-size: 12px;
      }
      .dsh-mbp-clear-btn {
        background: none;
        border: none;
        color: var(--dsw-alias-label-secondary, #70757d);
        cursor: pointer;
        padding: 2px 4px;
        font-size: 12px;
        border-radius: 4px;
      }
      .dsh-mbp-clear-btn:hover {
        color: var(--dsw-alias-label-primary, #1c1f23);
      }
      .dsh-mbp-body {
        padding: 12px;
        overflow-y: auto;
        flex: 1;
        min-height: 180px;
        max-height: 380px;
      }
      .dsh-mbp-body::-webkit-scrollbar {
        width: 6px;
      }
      .dsh-mbp-body::-webkit-scrollbar-thumb {
        background: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.15));
        border-radius: 3px;
      }
      /* 分块网格 */
      .dsh-mbp-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .dsh-mbp-block-card {
        padding: 12px;
        border-radius: 10px;
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
        background: var(--dsw-alias-bg-layer-1, rgba(0, 0, 0, 0.02));
        cursor: pointer;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 6px;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }
      .dsh-mbp-block-card:hover {
        background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.05));
        border-color: var(--dsw-alias-brand-primary, #1e80ff);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      .dsh-mbp-block-card.active {
        border-color: var(--dsw-alias-brand-primary, #1e80ff);
        background: rgba(30, 128, 255, 0.1);
      }
      .dsh-mbp-block-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
      }
      .dsh-mbp-block-title {
        font-weight: 600;
        font-size: 13px;
        color: var(--dsw-alias-label-primary, #1c1f23);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-active-badge {
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 10px;
        background: var(--dsw-alias-brand-primary, #1e80ff);
        color: #ffffff;
        font-weight: 500;
        white-space: nowrap;
      }
      .dsh-mbp-block-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: var(--dsw-alias-label-secondary, #70757d);
      }
      .dsh-mbp-block-arrow {
        font-size: 11px;
        opacity: 0.6;
      }
      /* 模型列表 */
      .dsh-mbp-list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
        margin-bottom: 6px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
      }
      .dsh-mbp-list-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary, #1c1f23);
      }
      .dsh-mbp-list-count {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary, #70757d);
      }
      .dsh-mbp-model-item {
        padding: 9px 12px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 3px;
        border: 1px solid transparent;
        transition: background 0.12s ease;
      }
      .dsh-mbp-model-item:hover {
        background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.04));
      }
      .dsh-mbp-model-item.selected {
        background: rgba(30, 128, 255, 0.14);
        border-color: var(--dsw-alias-border-l1, rgba(30, 128, 255, 0.2));
      }
      .dsh-mbp-model-main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
      }
      .dsh-mbp-model-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--dsw-alias-label-primary, #1c1f23);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-mbp-model-item.selected .dsh-mbp-model-name {
        color: var(--dsw-alias-brand-primary, #1e80ff);
        font-weight: 600;
      }
      .dsh-mbp-model-sub {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary, #70757d);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dsh-mbp-model-check {
        font-size: 14px;
        color: var(--dsw-alias-brand-primary, #1e80ff);
        font-weight: bold;
        padding-left: 8px;
      }
      .dsh-mbp-empty {
        text-align: center;
        color: var(--dsw-alias-label-secondary, #70757d);
        padding: 32px 12px;
        font-size: 12px;
      }
      /* 底部区域 */
      .dsh-mbp-footer {
        padding: 8px 14px;
        border-top: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--dsw-alias-bg-layer-1, rgba(0, 0, 0, 0.02));
        font-size: 11px;
      }
      .dsh-mbp-footer-label {
        color: var(--dsw-alias-label-secondary, #70757d);
        font-weight: 500;
      }
      .dsh-mbp-effort-select {
        background: var(--dsw-alias-bg-overlay, #ffffff);
        border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.15));
        border-radius: 6px;
        color: var(--dsw-alias-label-primary, #1c1f23);
        font-size: 11px;
        padding: 3px 8px;
        cursor: pointer;
        outline: none;
      }
      .dsh-mbp-effort-select:focus {
        border-color: var(--dsw-alias-brand-primary, #1e80ff);
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
      if (groupId === "deepseek-account") return "DeepSeek 账号";
      if (groupId === "deepseek-official") return "DeepSeek (API)";
      if (groupName && groupName.trim()) return groupName.trim();
      return groupId;
    }

    function BlockModelSelect({ locked, available, directory, load, select }) {
      useEffect(() => {
        injectStylesOnce();
      }, []);

      const [state, setState] = useState(() => directory ? directory.getSnapshot() : { groups: [], current: null, status: "idle" });

      useEffect(() => {
        if (!directory) return;
        setState(directory.getSnapshot());
        const unsubscribe = directory.subscribe(() => {
          setState(directory.getSnapshot());
        });
        return unsubscribe;
      }, [directory]);

      const [open, setOpen] = useState(false);
      const [query, setQuery] = useState("");
      const [drilledGroupId, setDrilledGroupId] = useState(null);
      const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

      const triggerRef = useRef(null);
      const popoverRef = useRef(null);
      const searchInputRef = useRef(null);

      const groups = useMemo(() => {
        const raw = state?.groups || [];
        return raw.toSorted((a, b) => {
          const rankA = a.id === "deepseek-account" ? 0 : a.id === "deepseek-official" ? 1 : 2;
          const rankB = b.id === "deepseek-account" ? 0 : b.id === "deepseek-official" ? 1 : 2;
          if (rankA !== rankB) return rankA - rankB;
          return (a.name || a.id).localeCompare(b.name || b.id);
        });
      }, [state?.groups]);

      const currentProvider = state?.current?.provider;
      const currentModel = state?.current?.model;

      const currentGroupObj = groups.find(g => g.id === currentProvider);
      const currentModelObj = currentGroupObj?.models?.find(m => m.id === currentModel);
      const reasoning = currentModelObj?.reasoning;

      const triggerLabel = useMemo(() => {
        if (state?.status === "loading" && !state?.current) return "加载模型中...";
        if (!state?.current) return "选择模型";
        const pName = currentGroupObj ? getProviderDisplayName(currentGroupObj.id, currentGroupObj.name) : currentProvider;
        const mName = currentModelObj?.name || currentModel;
        const effort = state.current.reasoningEffort;
        return `${pName} / ${mName}${effort ? ` (${effort})` : ""}`;
      }, [state?.status, state?.current, currentGroupObj, currentModelObj]);

      const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const popoverWidth = 440;
        const popoverHeight = 480;

        let left = rect.left;
        if (left + popoverWidth > window.innerWidth - 16) {
          left = window.innerWidth - popoverWidth - 16;
        }
        if (left < 16) left = 16;

        let top = rect.top - popoverHeight - 8;
        if (top < 16) {
          top = rect.bottom + 8;
        }

        setPopoverPos({ left, top });
      }, []);

      useEffect(() => {
        if (!open) return;
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
          window.removeEventListener("resize", updatePosition);
          window.removeEventListener("scroll", updatePosition, true);
        };
      }, [open, updatePosition]);

      useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
          if (triggerRef.current?.contains(e.target)) return;
          if (popoverRef.current?.contains(e.target)) return;
          setOpen(false);
        };
        const handleKeyDown = (e) => {
          if (e.key === "Escape") {
            if (drilledGroupId && !query) {
              setDrilledGroupId(null);
            } else {
              setOpen(false);
            }
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
          document.removeEventListener("keydown", handleKeyDown);
        };
      }, [open, drilledGroupId, query]);

      const searchMatches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return null;
        const matches = [];
        for (const g of groups) {
          for (const m of g.models) {
            const mName = m.name.toLowerCase();
            const mId = m.id.toLowerCase();
            const gName = (g.name || g.id).toLowerCase();
            if (mName.includes(q) || mId.includes(q) || gName.includes(q)) {
              matches.push({ group: g, model: m });
            }
          }
        }
        return matches;
      }, [query, groups]);

      const handleModelSelect = (group, model) => {
        const payload = {
          provider: group.id,
          model: model.id,
          ...(model.reasoning?.defaultEffort !== undefined ? { reasoningEffort: model.reasoning.defaultEffort } : {})
        };
        if (select) {
          select(payload);
        }
        setOpen(false);
      };

      const handleEffortChange = (e) => {
        const nextEffort = e.target.value;
        if (!state?.current || !select) return;
        select({
          provider: state.current.provider,
          model: state.current.model,
          reasoningEffort: nextEffort === "default" ? undefined : nextEffort
        });
      };

      if (!available) return null;

      const activeDrillGroup = groups.find(g => g.id === drilledGroupId);

      const renderPortal = () => {
        if (!open) return null;
        const content = h("div", {
          ref: popoverRef,
          className: "dsh-mbp-popover",
          style: { left: `${popoverPos.left}px`, top: `${popoverPos.top}px` }
        },
          h("div", { className: "dsh-mbp-header" },
            drilledGroupId && !query ? h("button", {
              type: "button",
              className: "dsh-mbp-back-btn",
              onClick: () => {
                setDrilledGroupId(null);
                setQuery("");
              }
            }, "← 所有来源") : null,
            h("div", { className: "dsh-mbp-search-box" },
              h("input", {
                ref: searchInputRef,
                type: "text",
                className: "dsh-mbp-search-input",
                placeholder: drilledGroupId && !query
                  ? `在 ${getProviderDisplayName(activeDrillGroup?.id, activeDrillGroup?.name)} 中搜索...`
                  : "搜索模型名称或来源（如 v3、r1、sonnet 等）...",
                value: query,
                onChange: (e) => setQuery(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter" && searchMatches && searchMatches.length > 0) {
                    handleModelSelect(searchMatches[0].group, searchMatches[0].model);
                  }
                }
              }),
              query ? h("button", {
                type: "button",
                className: "dsh-mbp-clear-btn",
                onClick: () => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }
              }, "✕") : null
            )
          ),
          h("div", { className: "dsh-mbp-body" },
            searchMatches !== null ? (
              searchMatches.length === 0 ? (
                h("div", { className: "dsh-mbp-empty" }, `未找到与 "${query}" 匹配的模型`)
              ) : (
                h("div", null,
                  h("div", { className: "dsh-mbp-list-header" },
                    h("span", { className: "dsh-mbp-list-title" }, "搜索结果"),
                    h("span", { className: "dsh-mbp-list-count" }, `共 ${searchMatches.length} 个结果`)
                  ),
                  searchMatches.map(({ group, model }) => {
                    const isSelected = currentProvider === group.id && currentModel === model.id;
                    return h("div", {
                      key: `${group.id}:${model.id}`,
                      className: `dsh-mbp-model-item ${isSelected ? "selected" : ""}`,
                      onClick: () => handleModelSelect(group, model)
                    },
                      h("div", { className: "dsh-mbp-model-main" },
                        h("div", { className: "dsh-mbp-model-name" }, model.name || model.id),
                        h("div", { className: "dsh-mbp-model-sub" },
                          h("span", null, getProviderDisplayName(group.id, group.name)),
                          model.reasoning ? h("span", { style: { color: "var(--dsw-alias-brand-primary, #1e80ff)" } }, "· 思考") : null
                        )
                      ),
                      isSelected ? h("span", { className: "dsh-mbp-model-check" }, "✓") : null
                    );
                  })
                )
              )
            ) : drilledGroupId && activeDrillGroup ? (
              h("div", null,
                h("div", { className: "dsh-mbp-list-header" },
                  h("span", { className: "dsh-mbp-list-title" }, getProviderDisplayName(activeDrillGroup.id, activeDrillGroup.name)),
                  h("span", { className: "dsh-mbp-list-count" }, `${activeDrillGroup.models?.length || 0} 个模型`)
                ),
                activeDrillGroup.models?.length === 0 ? (
                  h("div", { className: "dsh-mbp-empty" }, "该来源暂无可用的模型")
                ) : (
                  activeDrillGroup.models.map(model => {
                    const isSelected = currentProvider === activeDrillGroup.id && currentModel === model.id;
                    return h("div", {
                      key: model.id,
                      className: `dsh-mbp-model-item ${isSelected ? "selected" : ""}`,
                      onClick: () => handleModelSelect(activeDrillGroup, model)
                    },
                      h("div", { className: "dsh-mbp-model-main" },
                        h("div", { className: "dsh-mbp-model-name" }, model.name || model.id),
                        h("div", { className: "dsh-mbp-model-sub" },
                          model.id !== model.name ? h("span", null, model.id) : null,
                          model.reasoning ? h("span", { style: { color: "var(--dsw-alias-brand-primary, #1e80ff)" } }, "· 支持思考强度") : null
                        )
                      ),
                      isSelected ? h("span", { className: "dsh-mbp-model-check" }, "✓") : null
                    );
                  })
                )
              )
            ) : (
              h("div", null,
                h("div", { className: "dsh-mbp-list-header" },
                  h("span", { className: "dsh-mbp-list-title" }, "模型来源渠道"),
                  h("span", { className: "dsh-mbp-list-count" }, `共 ${groups.length} 个来源渠道`)
                ),
                groups.length === 0 ? (
                  h("div", { className: "dsh-mbp-empty" }, "暂无可用的模型来源")
                ) : (
                  h("div", { className: "dsh-mbp-grid" },
                    groups.map(group => {
                      const isCurrentSource = currentProvider === group.id;
                      const count = group.models?.length || 0;
                      const dName = getProviderDisplayName(group.id, group.name);
                      return h("div", {
                        key: group.id,
                        className: `dsh-mbp-block-card ${isCurrentSource ? "active" : ""}`,
                        onClick: () => {
                          setDrilledGroupId(group.id);
                          setQuery("");
                        }
                      },
                        h("div", { className: "dsh-mbp-block-card-header" },
                          h("span", { className: "dsh-mbp-block-title", title: dName }, dName),
                          isCurrentSource ? h("span", { className: "dsh-mbp-active-badge" }, "当前") : null
                        ),
                        h("div", { className: "dsh-mbp-block-meta" },
                          h("span", null, `${count} 个模型`),
                          h("span", { className: "dsh-mbp-block-arrow" }, "进入 →")
                        )
                      );
                    })
                  )
                )
              )
            )
          ),
          reasoning && reasoning.efforts && reasoning.efforts.length > 0 ? (
            h("div", { className: "dsh-mbp-footer" },
              h("span", { className: "dsh-mbp-footer-label" }, "思考程度 (Reasoning Effort)"),
              h("select", {
                className: "dsh-mbp-effort-select",
                value: state?.current?.reasoningEffort || "default",
                onChange: handleEffortChange
              },
                h("option", { value: "default" }, `默认 (${reasoning.defaultEffort || "自适应"})`),
                reasoning.efforts.map(eff => h("option", { key: eff.id, value: eff.id }, eff.name || eff.id))
              )
            )
          ) : null
        );

        if (ReactDOM?.createPortal && typeof document !== "undefined" && document.body) {
          return ReactDOM.createPortal(content, document.body);
        }
        return content;
      };

      return h("div", { className: "dsh-mbp-portal-root", style: { display: "inline-block" } },
        h("button", {
          ref: triggerRef,
          type: "button",
          className: "dsh-mbp-trigger",
          disabled: locked,
          title: triggerLabel,
          onClick: () => {
            if (!open && load) load();
            setOpen(prev => !prev);
            setQuery("");
            setDrilledGroupId(null);
          }
        },
          h("span", { className: "dsh-mbp-trigger-icon" }, "⚡"),
          h("span", { className: "dsh-mbp-trigger-label" }, triggerLabel),
          h("span", { className: `dsh-mbp-trigger-arrow ${open ? "open" : ""}` },
            h("svg", { viewBox: "0 0 16 16", "aria-hidden": true },
              h("path", { d: "M4 6.5L8 10.5L12 6.5" })
            )
          )
        ),
        renderPortal()
      );
    }

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
                  directory: directory ? directory.store : null,
                  load: () => {
                    if (directory) directory.load().catch(() => {});
                  },
                  select: (selection) => {
                    return directory ? directory.select(selection) : Promise.resolve(void 0);
                  }
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
