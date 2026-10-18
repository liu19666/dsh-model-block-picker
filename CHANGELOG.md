# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
