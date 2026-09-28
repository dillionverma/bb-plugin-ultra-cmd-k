// Theme swatches. The two-tone dot next to a theme row shows the theme's own
// accent over its own canvas, read from the theme's CSS (`--primary` over
// `--canvas`, light and dark blocks) instead of a hand-kept colour table.
//
// bb's built-in palettes are template strings inside its renderer bundle, not
// CSS the server can resolve, so their anchors are recorded here verbatim from
// that bundle (app/dist/assets/index-*.js and the base stylesheet).
import type { Swatch, ThemeSwatch } from "./contract";

export const BUILTIN_SWATCHES: Readonly<Record<string, ThemeSwatch>> = {
  default: {
    light: { canvas: "oklch(100% 0 0)", primary: "oklch(27% 0 0)" },
    dark: { canvas: "oklch(19.5% 0 0)", primary: "oklch(82% 0 0)" },
  },
  nord: { light: { canvas: "#eceff4", primary: "#5e81ac" }, dark: { canvas: "#2e3440", primary: "#88c0d0" } },
  dracula: { light: { canvas: "#f8f8f2", primary: "#7d5bbe" }, dark: { canvas: "#282a36", primary: "#bd93f9" } },
  solarized: { light: { canvas: "#fdf6e3", primary: "#268bd2" }, dark: { canvas: "#002b36", primary: "#268bd2" } },
  gruvbox: { light: { canvas: "#fbf1c7", primary: "#076678" }, dark: { canvas: "#282828", primary: "#83a598" } },
  catppuccin: { light: { canvas: "#eff1f5", primary: "#8839ef" }, dark: { canvas: "#1e1e2e", primary: "#cba6f7" } },
};

type Vars = Map<string, string>;

/** Rules whose declarations apply at the root in light mode, dark mode, or both. */
const ROOT_SELECTOR = /^(:root|html|body)$/;
const LIGHT_SELECTOR = /^(:root|html)?\s*\.light$/;
const DARK_SELECTOR = /^(:root|html)?\s*\.dark$/;

/** A colour we are willing to put in an inline `background`: no urls, no expressions. */
const SAFE_COLOR =
  /^(#[0-9a-f]{3,8}|[a-z]+|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\([^;{}()]*(\([^;{}()]*\)[^;{}()]*)*\))$/i;

const MAX_VAR_DEPTH = 8;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Top-level `selector { body }` rules. At-rules and their nested blocks are skipped. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  let selector = "";
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") {
      if (depth === 0) {
        selector = css.slice(selectorStart, i).trim();
        bodyStart = i + 1;
      }
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (!selector.startsWith("@")) rules.push({ selector, body: css.slice(bodyStart, i) });
        selectorStart = i + 1;
      }
    }
  }
  return rules;
}

function declarations(body: string): Vars {
  const vars: Vars = new Map();
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) {
    vars.set(match[1]!, match[2]!.replace(/!important\s*$/i, "").trim());
  }
  return vars;
}

/** Expand `var(--x)` / `var(--x, fallback)` against `vars`; null if anything stays unresolved. */
export function resolveVar(value: string, vars: Vars): string | null {
  let current = value;
  for (let depth = 0; depth < MAX_VAR_DEPTH; depth += 1) {
    // Fallbacks may themselves be a function colour, e.g. `var(--x, oklch(82% 0 0))`.
    const match = /var\(\s*--([\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/.exec(current);
    if (!match) return current.includes("var(") ? null : current.trim();
    const replacement = vars.get(match[1]!) ?? match[2]?.trim();
    if (replacement === undefined) return null;
    current = current.slice(0, match.index) + replacement + current.slice(match.index + match[0].length);
  }
  return null;
}

function pick(vars: Vars, names: readonly string[]): string | null {
  for (const name of names) {
    const raw = vars.get(name);
    if (raw === undefined) continue;
    const resolved = resolveVar(raw, vars);
    if (resolved !== null && SAFE_COLOR.test(resolved)) return resolved;
  }
  return null;
}

function swatchOf(vars: Vars): Swatch | null {
  const canvas = pick(vars, ["canvas", "background"]);
  const primary = pick(vars, ["primary"]);
  return canvas !== null && primary !== null ? { canvas, primary } : null;
}

/**
 * Read a theme's light and dark anchors from its stylesheet. Follows the
 * documented two-block shape (`:root, .light { … }` then `.dark { … }`);
 * `:root` values carry into dark mode unless the dark block re-sets them.
 * A theme that only declares one side gets that side for both. Null when
 * neither side yields a usable `--canvas` (or `--background`) and `--primary`.
 */
export function parseThemeSwatch(css: string | null | undefined): ThemeSwatch | null {
  if (!css) return null;
  const base: Vars = new Map();
  const light: Vars = new Map();
  const dark: Vars = new Map();
  for (const rule of topLevelRules(stripComments(css))) {
    const decls = declarations(rule.body);
    if (decls.size === 0) continue;
    const parts = rule.selector.split(",").map((part) => part.trim());
    const targets = [
      ...(parts.some((part) => ROOT_SELECTOR.test(part)) ? [base] : []),
      ...(parts.some((part) => LIGHT_SELECTOR.test(part)) ? [light] : []),
      ...(parts.some((part) => DARK_SELECTOR.test(part)) ? [dark] : []),
    ];
    for (const target of targets) for (const [name, value] of decls) target.set(name, value);
  }
  const lightSwatch = swatchOf(new Map([...base, ...light]));
  const darkSwatch = swatchOf(new Map([...base, ...dark]));
  if (lightSwatch === null && darkSwatch === null) return null;
  return { light: lightSwatch ?? darkSwatch!, dark: darkSwatch ?? lightSwatch! };
}
