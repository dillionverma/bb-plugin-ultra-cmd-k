# Ultra Cmd+K

A keyboard-first command palette for [bb](https://getbb.app). Press **⌘K** (Ctrl+K on Windows/Linux) anywhere and reach threads, projects, themes, light/dark, every bb shortcut, plugins, skills, and the `bb` CLI without leaving the keyboard.

## Highlights

- **Takes over ⌘K.** bb's own quick palette moves to ⌘⇧P (its documented default) and stays reachable. Turn the takeover off in Settings → Ultra Cmd+K and the original binding comes back, including any override you had set yourself.
- **Threads and projects.** Pinned, unread, then recent. ↵ opens, ⌘↵ opens in a split, → shows actions: pin, mark read, rename, fork, compact, archive, stop, send a message, copy id, delete.
- **Appearance.** A theme picker that previews live as you move the highlight and restores on Esc; light / dark / system; favicon color.
- **Every bb command.** Open Settings, toggle the sidebar, open a terminal, toggle the diff, cycle model/provider/reasoning, panes, panels… each row shows its live shortcut and follows your rebinds in Settings → Keyboard.
- **Agent & CLI.** New thread (hands off to Ultra Launcher when installed), plugins (enable, disable, reload, logs), skills, and a `$` mode that runs any `bb …` command on your primary host and shows the output inline.
- **Prefix modes.** `>` commands, `@` threads, `#` projects, `/` skills, `$` bb, `?` shortcuts.
- **Recents.** Frequently used rows float to the top with a recency decay.

## Install

```sh
bb plugin install https://github.com/dillionverma/bb-plugin-ultra-cmd-k
```

Or from a local checkout: `bb plugin install /path/to/bb-plugin-ultra-cmd-k`.

On install the plugin claims ⌘K. If bb's quick palette is still bound to ⌘K (for example when the setting is off), run `bb ultra-cmd-k claim`.

## Use

| Keys | Action |
| --- | --- |
| ⌘K | Open / close the palette |
| ↑ ↓ | Move |
| ↵ | Run the row |
| ⌘↵ | Secondary action (open in split, send skill to the current thread, …) |
| → or Tab | Open the row's sub-page |
| Esc | Clear the query, then go back, then close |
| ⌫ on an empty query | Go back |
| ⌘⇧P | bb's own quick palette |

CLI, for agents and shells:

```
bb ultra-cmd-k status | claim | release
bb ultra-cmd-k themes [--json]
bb ultra-cmd-k theme <id>
bb ultra-cmd-k run <bb args…>
```

## How it works

- The palette is an `experimental_appOverlay` built on bb's vendored shadcn `command` (cmdk). It stays mounted and goes `inert` while closed so bb's shortcut layer keeps working.
- bb exposes no API to invoke its built-in commands, but its shortcut layer is a plain `window` keydown listener. Rows like "Open Settings" close the palette, wait for it to go inert, and dispatch a synthetic keydown carrying the command's live binding from `system.config()`.
- Theme selection and thread/plugin mutations go through the plugin server (`bb.sdk.*`). `$` mode runs the fixed `bb` executable through the plugin's host entry: arguments only, no shell, output capped at 64 KB.
- Light/dark/system is a client-local bb preference; the palette writes it and dispatches the storage event bb listens for.

## Development

```sh
npm ci
npm run typecheck
npm test
bb plugin build .
bb plugin reload ultra-cmd-k
```

## Compatibility

Requires bb ≥ 0.43 and plugin SDK 0.4.87. The runtime id is `ultra-cmd-k`; the repository name may change, the id will not.

## The Ultra suite

[Ultra Launcher](https://github.com/dillionverma/bb-plugin-ultra-launcher) · [Ultra Sidebar](https://github.com/dillionverma/bb-plugin-ultra-sidebar) · [Ultra Topbar](https://github.com/dillionverma/bb-plugin-ultra-topbar) · Ultra Cmd+K

## License

MIT
