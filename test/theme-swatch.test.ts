import { describe, expect, it } from "vitest";
import { BUILTIN_SWATCHES, parseThemeSwatch, resolveVar } from "@/lib/theme-swatch";

const TWO_BLOCK = `
/* A Nord-like theme, the documented shape. */
:root,
.light {
  --canvas: #eceff4;
  --ink: #2e3440;
  --primary: #5e81ac;
  --muted-foreground: color-mix(in oklch, var(--ink) 62%, var(--canvas));
}
.dark {
  --canvas: #2e3440;
  --ink: #d8dee9;
  --primary: #88c0d0 !important;
}
`;

describe("parseThemeSwatch", () => {
  it("reads light and dark anchors from the two-block shape", () => {
    expect(parseThemeSwatch(TWO_BLOCK)).toEqual({
      light: { canvas: "#eceff4", primary: "#5e81ac" },
      dark: { canvas: "#2e3440", primary: "#88c0d0" },
    });
  });

  it("carries :root values into dark mode unless the dark block re-sets them", () => {
    const css = `:root { --canvas: #ffffff; --primary: #ff0000; } .dark { --canvas: #000000; }`;
    expect(parseThemeSwatch(css)).toEqual({
      light: { canvas: "#ffffff", primary: "#ff0000" },
      dark: { canvas: "#000000", primary: "#ff0000" },
    });
  });

  it("resolves var() references and fallbacks, and accepts --background as the canvas", () => {
    const css = `
      :root, .light { --peach: #ffc799; --background: #101010; --primary: var(--peach); }
      .dark { --primary: var(--missing, oklch(82% 0 0)); }
    `;
    expect(parseThemeSwatch(css)).toEqual({
      light: { canvas: "#101010", primary: "#ffc799" },
      dark: { canvas: "#101010", primary: "oklch(82% 0 0)" },
    });
  });

  it("uses the one declared side for both when a theme is single-mode", () => {
    const css = `html.dark { --canvas: #111111; --primary: #eeeeee; }`;
    const swatch = parseThemeSwatch(css);
    expect(swatch?.light).toEqual({ canvas: "#111111", primary: "#eeeeee" });
    expect(swatch?.dark).toEqual({ canvas: "#111111", primary: "#eeeeee" });
  });

  it("ignores at-rules, nested selectors and rules scoped below the root", () => {
    const css = `
      @media (prefers-color-scheme: dark) { :root { --canvas: #bad000; --primary: #bad000; } }
      .dark .toast { --canvas: #bad000; --primary: #bad000; }
      :root { --canvas: #fafafa; --primary: #c2660f; }
    `;
    expect(parseThemeSwatch(css)).toEqual({
      light: { canvas: "#fafafa", primary: "#c2660f" },
      dark: { canvas: "#fafafa", primary: "#c2660f" },
    });
  });

  it("refuses values that are not plain colours", () => {
    expect(parseThemeSwatch(`:root { --canvas: url(x.png); --primary: #ffffff; }`)).toBeNull();
    expect(parseThemeSwatch(`:root { --canvas: #000; --primary: expression(alert(1)); }`)).toBeNull();
  });

  it("returns null for empty css or css without anchors", () => {
    expect(parseThemeSwatch(null)).toBeNull();
    expect(parseThemeSwatch("")).toBeNull();
    expect(parseThemeSwatch(`[data-sonner-toaster] { top: 24px; }`)).toBeNull();
    expect(parseThemeSwatch(`:root { --canvas: #000; }`)).toBeNull();
  });

  it("covers every built-in palette", () => {
    expect(Object.keys(BUILTIN_SWATCHES).sort()).toEqual(["catppuccin", "default", "dracula", "gruvbox", "nord", "solarized"]);
  });
});

describe("resolveVar", () => {
  it("gives up on cycles instead of looping", () => {
    const vars = new Map([
      ["a", "var(--b)"],
      ["b", "var(--a)"],
    ]);
    expect(resolveVar("var(--a)", vars)).toBeNull();
  });
});
