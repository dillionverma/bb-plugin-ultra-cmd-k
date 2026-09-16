---
name: ultra-cmd-k
description: Use when the user asks who owns Cmd+K in bb, wants Ultra Cmd+K to take over or release the shortcut, wants to switch the bb theme from a shell, or wants to run a bb command through the plugin.
---

# Ultra Cmd+K

Ultra Cmd+K is a command palette plugin. In the app it opens on Ctrl/Cmd+K.
The `bb ultra-cmd-k` command exposes the parts an agent can act on.

## Commands

| Command | What it does |
| --- | --- |
| `bb ultra-cmd-k status [--json]` | Reports whether Ctrl/Cmd+K opens Ultra Cmd+K or bb's own quick palette. |
| `bb ultra-cmd-k claim` | Moves bb's `palette.open` binding to Mod+Shift+P so Ctrl/Cmd+K opens Ultra Cmd+K. Remembers any override it displaced. |
| `bb ultra-cmd-k release` | Restores bb's binding (and the displaced override, if any). |
| `bb ultra-cmd-k themes [--json]` | Lists built-in, custom and plugin themes with the active one marked. |
| `bb ultra-cmd-k theme <id>` | Activates a theme, preserving the favicon color. |
| `bb ultra-cmd-k run <args…>` | Runs `bb <args>` on the primary host and prints the bounded output. |

## Outcomes

- `status` prints one sentence such as "Ctrl/Cmd+K opens Ultra Cmd+K (bb's quick palette moved to Mod+Shift+P by this plugin)." With `--json` it prints `{ state, reason, description }` where `state` is `free` or `taken`.
- `claim` and `release` print the resulting status.
- `theme <id>` prints `Active theme: <id>`. Unknown ids fail with bb's own error.
- `run` exits with the wrapped command's exit code.

## Rules

- Prefer `bb theme set <id>` and `bb settings keyboard set …` when the user asks for the underlying bb behaviour; use this command when they ask about Ultra Cmd+K itself.
- `run` accepts arguments only; the executable is always `bb`, there is no shell, and output is truncated at 64 KB.
- Do not edit the keybinding override for `palette.open` by hand while the plugin is enabled; use `claim` / `release` so the plugin's record stays consistent.
