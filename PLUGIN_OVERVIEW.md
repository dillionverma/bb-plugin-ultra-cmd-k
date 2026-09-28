Press ⌘K and do anything in bb from the keyboard.

## What you get

- **One palette for everything.** Threads, projects, themes, light/dark, favicon color, every bb shortcut, plugins, skills, and the `bb` CLI.
- **Thread actions on →.** Open, open in split, send a message, stop, pin, mark read, rename, fork, compact, archive, copy id, delete.
- **Live theme preview.** Move the highlight to try a theme; Esc puts the original back; ↵ keeps it.
- **bb commands with their real shortcuts.** Open Settings, toggle the sidebar, open a terminal, cycle models, manage panes. Rows follow your rebinds.
- **`$` mode.** Run `bb thread list`, `bb plugin logs …`, anything, on your primary host, with output inline.
- **Prefix modes.** `>` commands · `@` threads · `#` projects · `/` skills · `$` bb · `?` shortcuts.

## How it works

The plugin relocates bb's quick palette to ⌘⇧P so ⌘K is free, and restores it when disabled. Actions run through the plugin server; `bb …` commands run through a host entry with no shell access. Its data is fetched once and kept fresh by a realtime signal from the server, and `@` mode windows the thread list, so it stays instant on large workspaces.

## For agents

`bb ultra-cmd-k status|claim|release`, `themes`, `theme <id>`, and `run <args…>`; the bundled skill explains each.

Source: https://github.com/dillionverma/bb-plugin-ultra-cmd-k
