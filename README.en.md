# dsh-model-block-picker

English | [中文](README.md)

A DeepSeek Harness (DSH) plugin — a composer model selector that **groups models by provider**.

It replaces the stock selector (one long flat list of every model) with a **two-level structure**: pick a
provider block first, then drill into that block to choose a model. Search, Reasoning Effort and
model-availability handling are **fully preserved**.

---

## Preview

Clicking the model seat at the right of the composer no longer opens a long flat list — it opens a
**card grid grouped by provider**:

![Grouped panel, search and reasoning effort](docs/screenshot-panel.png)

- **① Global search** — type `v3` / `sonnet` / `r1` at the top to fuzzy-match across all 17 providers;
  Enter selects the first hit.
- **② Grouped by provider** — one card per channel, showing "N models" and an "Enter →" affordance.
- **③ "Current" badge** — the provider in use gets a highlighted outline and a corner badge.
- **④ Reasoning Effort** — when the selected model supports reasoning, the effort selector is kept at
  the bottom of the popover.

The trigger itself matches the neighbouring screenshot / microphone icons (dark surface + the theme's
off-white stroke and text):

![Composer model seat and neighbouring icons](docs/screenshot-composer.png)

---

## Features

- **Grouped by provider**: DeepSeek Account, DeepSeek API, and third-party channels (CodeBuddy / Qoder /
  TRAE …) each become a card showing the channel name, model count, and a "current" badge when active.
- **Two-level drill-down**: click a card → a list containing only that channel's models; `← All providers`
  or `Esc` goes back.
- **Global search**: type `v3` / `sonnet` / `r1` to fuzzy-match across *all* providers, Enter selects the
  first hit; clearing the box returns to the grouped view.
- **Reasoning Effort kept**: when the selected model supports reasoning, an effort selector (default /
  low / medium / high …) appears at the bottom of the popover.
- **Theme-aware**: light and dark both use real DSH theme tokens. In dark mode the trigger is a
  black surface with the theme's off-white stroke/text, matching the microphone and screenshot icons
  in the same toolbar row.

## Install

### From a local directory (development / personal use)

Tell the DSH Agent:

> Install the plugin located at `<path to this repo>`

The Agent runs `plugin_manager(action: 'install_bundle', target: '<absolute path>')`.

Then **fully quit and relaunch DSH Desktop** (the client bundle has a startup baseline cache; a page
refresh alone may not load the new code).

To uninstall: `plugin_manager(action: 'remove_bundle', target: 'dsh-model-block-picker')` — the stock
selector comes back.

## How it works

### 1. Shadowing the stock selector

The composer model seat is a public named slot: `conversation.input.model` (`kind: "single"`,
session scope).

- The stock implementation registers at priority `-10`;
- A dynamically installed plugin registering the same slot gets **a lower number = higher priority**;
- This plugin registers `priority: -20`, so it wins and shadows the built-in component. Uninstalling
  restores it automatically.

> A `single` slot requires a unique priority, so a **negative** priority is mandatory — otherwise it
> throws `single slot already has a registration`.

### 2. Reusing the official data service

No custom backend calls. It uses `ctx.modelDirectories`:

```js
const directory = models.directoryFor(sessionId);
directory.store   // snapshot: { groups: [{ id, name, models: [...] }], current: { provider, model, reasoningEffort } }
directory.load()  // fetch the catalog
directory.select({ provider, model, reasoningEffort })  // commit a selection
```

It shares **the same per-session directory** as the `/model` command popover, so a switch made in
either entry is immediately visible in the other.

### 3. Dark-mode white comes from the theme, not hardcoded values

Early versions hardcoded fallback colors like `#1c1f23`, which do not invert in dark mode and turned
text/arrows dark grey. Everything now uses real tokens:

| Purpose | Token | Dark value |
|---|---|---|
| Primary text | `--dsw-alias-label-primary` | `#f9fafb` (off-white, not pure white) |
| Border | `--dsw-alias-border-l1` | `#ffffff0f` |
| Background | `--dsw-alias-bg-layer-1/2`, `--dsw-alias-bg-overlay` | — |
| Brand | `--dsw-alias-brand-primary` | — |

In dark mode, `body[data-ds-dark-theme]` additionally sets the trigger to a `.5px` stroke with that
token — the same stroke weight as the screenshot plugin
(`color: var(--dsw-alias-label-primary)` + `fill:none stroke=currentColor stroke-width=1`).

> **Gotcha:** do **not** invent CSS variable names. These do **not** exist in DSH:
> `--dsw-alias-text-regular`, `--dsw-alias-border-subtle`, `--dsw-alias-surface-overlay`,
> `--dsw-alias-primary`. They silently fall back to whatever you wrote — fine in light mode, broken in
> dark. Query real tokens with
> `cordis_inspect_query(platform: 'client', provider: 'Theme', method: 'listTokens')`.

## Layout

```
dsh-model-block-picker/
├── package.json          # manifest: dsh.bundle.patch + dsh.client declaration
├── cordis.patch.yml      # Loader patch: inserts this package into the profile roster
├── index.js              # host half (mounts the /diag route)
├── client.js             # browser half: React component + styles + slot registration
├── LICENSE
└── README.md
```

## Diagnostics

- Host log prefix: `[dsh-model-block-picker]` (search your DSH log for it).
- The browser half reports lifecycle stages to `/plugins/dsh-model-block-picker/diag`:
  `module-evaluated` → `apply-called` → `slot-inject-triggered` → `registered-success`.
  Stopping at `register-error` means a slot/priority conflict; `apply-error` usually means a service was
  read without declaring it in `inject`.

> **Second gotcha:** the client sandbox whitelists service access. With
> `inject: ['slots','modelDirectories']` you must **not** read `ctx.sessions` directly — it throws
> `service "sessions" is not declared` and crashes the plugin on the spot.

## Known limitations

- It replaces the composer model seat only; the `/model` command popover keeps its stock look (they
  share one directory, so selections stay in sync).
- Addressed subagent sessions expose no model selection (same as stock behavior).
- Group order: DeepSeek Account → DeepSeek official → the rest sorted by name. Change the sorting logic
  in `client.js` if you need a custom order.

## License

MIT
