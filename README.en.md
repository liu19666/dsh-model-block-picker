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

![Grouped panel with search, reasoning slider, speed and output verbosity](docs/screenshot-panel.png)

- **① Global search** — type `v3` / `sonnet` / `r1` at the top to fuzzy-match across all providers;
  Enter selects the first hit.
- **② Grouped by provider** — one card per channel, showing "N models" and an "Enter →" affordance;
  hold a card to drag it into a new position (one gesture can cross several cards).
- **③ "Current" badge** — the provider in use gets a highlighted outline and a corner badge.
- **④ Reasoning effort colour slider** — a draggable Low → Max gradient slider; clicking a tick label
  jumps straight to that level.
- **⑤ Speed / output verbosity** — shown only when the selected model supports them; the whole row is
  hidden otherwise.

> Provider names in the screenshots are pixelated.

Dark mode uses the same theme tokens with `--dsw-alias-link` (`#7aaaff`) as the accent, so no more
white-on-white text:

![Grouped panel in dark mode](docs/screenshot-dark.png)

The ⚙ button left of the search box opens **display settings**: toggle whole providers or individual
models, rename a provider with the row's ✎, drag model rows to reorder them, and push the names into the
model registry with **sync everywhere**:

![Display settings panel](docs/screenshot-settings.png)

The trigger itself matches the neighbouring screenshot / microphone icons (theme stroke and text):

![Composer model seat and neighbouring icons](docs/screenshot-composer.png)

---

## Features

- **Grouped by provider**: DeepSeek Account, DeepSeek API, and third-party channels (CodeBuddy / Qoder /
  TRAE …) each become a card showing the channel name, model count, and a "current" badge when active.
- **Two-level drill-down**: click a card → a list containing only that channel's models; `← All providers`
  or `Esc` goes back.
- **Global search**: type `v3` / `sonnet` / `r1` to fuzzy-match across *all* providers, Enter selects the
  first hit; clearing the box returns to the grouped view.
- **Reasoning Effort as a colour slider**: when the selected model supports reasoning, a draggable
  gradient slider (Low → Max stops, glowing thumb, clickable tick labels) appears at the bottom of the
  popover in the style of the OpenAI Codex settings sliders, together with a "restore provider default"
  action.
- **Adaptive speed / output-verbosity rows**: providers that expose those preferences (for example
  `dsh-codex-subscription` / `openai-codex`) get `Speed` (standard / fast / ultrafast) and
  `Output verbosity` (default / concise / balanced / detailed) segmented controls. Each row is shown
  **only when the currently selected model actually supports it**, so no dead switches appear.
- **Visibility settings panel**: the round ⚙ button left of the search box opens a panel where whole
  providers and individual models can be toggled off; expanding a provider also exposes a ✎ rename button
  and lets you drag its model rows into your own order.
- **Provider renaming (aliases)**: hit ✎ on a provider row and type any name (for example, turn
  "ChatGPT subscription" into "ChatGPT sub"). The name is written into the **host model registry**, so the
  grouped panel, the drill-down list and the stock `/model` popover all show it — not just this plugin. It
  persists in `aliases.json` under the DSH state directory and is replayed whenever the registry
  re-registers its adapters and shortly after startup; the panel's top bar offers 同步到全部界面 (re-apply
  now) and 恢复默认 (drop the alias).
- **Drag reordering (providers and models)**: hold a card and drag — it can cross several cards in one
  gesture, the drop position is where it lands, and the cards in between shift over (dropping onto the
  neighbouring card is a plain swap). Inside an expanded provider in the settings panel, model rows drag
  the same way and their order is stored per provider. A 6 px threshold separates a drag from a tap, and
  a 260 ms post-drop cooldown keeps the release from also drilling down.
- **Preference persistence**: order, hidden providers and hidden models live in `localStorage`
  (`dsh-model-block-picker.prefs.v1`) and stale ids are pruned automatically.
- **Theme-aware**: light and dark both use real DSH theme tokens. Accent colour is `--dsw-alias-link`
  (`#7aaaff` in dark) — *not* `--dsw-alias-brand-primary`, which inverts to near-white in dark mode.

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
├── index.js              # host half (/diag diagnostics + /aliases rename persistence)
├── client.js             # browser half: React component + styles + slot registration
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Diagnostics

- Host log prefix: `[dsh-model-block-picker]` (search your DSH log for it).
- Aliases: `GET /plugins/dsh-model-block-picker/aliases` returns `{ ready, store, aliases, providers }`
  where `providers[].base` is the registry name and `name` is what is currently applied; `ready:false`
  means the model service is not up yet.
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
- Group order: defaults to DeepSeek Account → DeepSeek official → the rest by name; **drag the cards in
  the panel** to set your own order (persisted in `localStorage`).
- Speed / output verbosity depend on what the provider exposes: only providers implementing those
  preferences (currently `dsh-codex-subscription`'s `openai-codex`) are recognised; other providers
  simply do not show those rows.
- Renaming is a **global change to the model registry** (the stock `/model` popover renames too) stored in
  `state/dsh-model-block-picker/aliases.json` under the DSH home — not the browser profile — and it stops
  being replayed once the plugin is uninstalled.
- Preferences (order, hidden items) are stored in browser `localStorage`, so they are **per browser profile**
  and do not sync across machines.

## License

MIT
