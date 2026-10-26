# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-26

### Added

- **Provider renaming (aliases)**: every row of the 显示设置 panel gained a ✎ button. The name you type is
  written into the host model registry through `/plugins/dsh-model-block-picker/aliases`, so it is what the
  grouped panel, the drill-down list **and** the stock `/model` popover display — not a plugin-local string
  table that only this popover would honour. Aliases persist in `aliases.json` inside the DSH state
  directory and are replayed on every `adapters-updated` event and shortly after startup, because provider
  entries are rebuilt each time the registry re-registers its adapters. The panel's top bar reports host
  readiness and offers 同步到全部界面 (re-apply now) and 恢复默认 (drop the alias, restore the registry name).
- **Model-level drag reorder**: inside an expanded provider in the settings panel, drag a model row to
  reorder that provider's models — across as many rows as you like. The order is stored per provider and
  drives the popover list, the search results and the drill-down alike.

### Changed

- **Provider dragging rewritten on pointer events** (the previous implementation was HTML5 drag and drop,
  where a drop only ever lands on the card under the cursor, so a card advanced one slot per drag). A card
  now follows the pointer and can cross several cards in one gesture; the drop position *is* the new
  position and the cards in between shift over. A 6 px threshold keeps taps distinct from drags, and a
  260 ms post-drop cooldown stops a drag from being read as a drill-down click.
- **Reasoning slider visual pass**: the track is 16 px with a soft aura under the filled part, each stop
  carries its own hue that tints the active tick label and the value pill, twinkling sparks appear over the
  fill while dragging, and the value pill shows a small glowing dot. The settings trigger is now a round
  icon button, and cards / model rows expose a grip affordance.
- **Preference schema**: `modelOrder` (per-provider model order) joined `order`, `hiddenProviders` and
  `hiddenModels` in `dsh-model-block-picker.prefs.v1`; existing payloads keep working unchanged.

### Fixed

- The "restore everything" action at the foot of the settings panel appeared only after some model had
  been hidden. It now also appears once an order (providers or models) has been customised.

## [1.1.0] - 2026-10-18

### Added

- **Per-model reasoning slider**: the reasoning effort drop-down was replaced by a draggable
  gradient range slider in the style of the OpenAI Codex settings sliders — segmented colour stops,
  a glowing thumb, clickable tick labels, the current level echoed on the right, and a
  "restore provider default" button.
- **Speed and output-verbosity controls**: for providers that expose these preferences
  (`dsh-codex-subscription` / `openai-codex`), the popover now also renders `速度` (standard / fast /
  ultrafast) and `输出详略` (default / concise / balanced / detailed) segmented controls, read and
  written through the provider's own `codex-subscription/preferences/*` RPC endpoints. Both rows
  appear only when the currently selected model actually supports them.
- **Visibility settings panel**: a ⚙ button to the left of the search box opens a panel where whole
  providers and individual models can be toggled on/off, with an expandable per-provider model list,
  a hidden-count indicator and a one-click "restore all" action.
- **Drag-to-reorder providers**: provider cards are draggable; the dragged card fades, the drop
  target gets an accent outline, and the new order is persisted.
- **Preference persistence**: provider order, hidden providers and hidden models are stored in
  `localStorage` under `dsh-model-block-picker.prefs.v1`, and stale provider/model ids are pruned
  automatically.

### Fixed

- **Dark-mode "current selection" was unreadable**: the accent colour used `--dsw-alias-brand-primary`,
  which inverts to near-white (`#f9fafb`) in dark mode, producing white-on-white text, badges and
  outlines. All accent uses (selected model name, active card, "current" badge, focus rings) now use
  `--dsw-alias-link` (`#7aaaff` in dark), and badges keep white glyphs on a saturated fill.
- **Effort slider ticks were misaligned**: tick labels are now absolutely positioned at each thumb
  stop (`left: calc(ratio% + thumbPad)`) instead of being spread by `space-between`, so the active
  label sits exactly under the thumb.
- **Accessibility**: model-level toggles in the settings panel were anonymous buttons; they now
  carry `aria-label` / `role="switch"` / `aria-checked`.

## [1.0.0] - 2026-10-14

### Added

- Composer model selector grouped by provider: provider cards → drill down into one provider's models.
- Global fuzzy search across all providers (Enter selects the first hit).
- Reasoning Effort selector preserved when the selected model supports it.
- Host + client lifecycle diagnostics (`/plugins/dsh-model-block-picker/diag`).
- MIT license, bilingual README.
- Annotated screenshots in both READMEs (`docs/`): the grouped panel with numbered callouts for search,
  grouping, the "current" badge and Reasoning Effort, plus the composer row comparing the trigger with
  the neighbouring native icons.

### Fixed

- **Plugin never loaded**: read `scope.sessions` without declaring it in `inject`, which the client
  sandbox rejects with `service "sessions" is not declared`, crashing before the slot registration ran.
- **Slot conflict**: registering the `single` slot `conversation.input.model` at the default priority
  `0` collided with the stock entry. Now registers at `priority: -20` (lower = wins).
- **Dark mode legibility**: styles used token names that do not exist in DSH
  (`--dsw-alias-text-regular`, `--dsw-alias-border-subtle`, `--dsw-alias-surface-overlay`,
  `--dsw-alias-primary`), so they silently fell back to hardcoded dark colors and never inverted.
  Replaced with real tokens (`--dsw-alias-label-primary`, `--dsw-alias-border-l1`,
  `--dsw-alias-bg-layer-1/2`, `--dsw-alias-brand-primary`).
- **Dark mode too bright**: pure `#ffffff` was too harsh. Switched to the theme's own off-white
  (`--dsw-alias-label-primary`, `#f9fafb` in dark) and reduced the trigger to a `.5px` stroke with a
  hollow chevron, matching the neighboring screenshot/microphone icons.
