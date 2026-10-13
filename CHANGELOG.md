# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
