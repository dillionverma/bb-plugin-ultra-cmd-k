// Two-tone dot: a theme's accent over its canvas, in whichever of its light or
// dark halves matches the window's current appearance, so the row hints at
// the palette before you try it. Swatches come from the server (lib/theme-swatch).
import type { ThemeSwatch } from "@/lib/contract";
import { cn } from "@/lib/utils";

function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function ThemeDot({ swatch, className }: { swatch: ThemeSwatch | null | undefined; className?: string }) {
  if (!swatch) {
    return (
      <span
        aria-hidden
        className={cn("size-3.5 rounded-full border border-foreground/40 opacity-70", className)}
        style={{ background: "conic-gradient(var(--foreground) 0 50%, transparent 50% 100%)" }}
      />
    );
  }
  const { canvas, primary } = isDarkMode() ? swatch.dark : swatch.light;
  return (
    <span
      aria-hidden
      className={cn("size-3.5 rounded-full border border-black/20 dark:border-white/15", className)}
      style={{ background: `linear-gradient(135deg, ${primary} 0 50%, ${canvas} 50% 100%)` }}
    />
  );
}
