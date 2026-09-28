// App-wide overlay (app.slots.experimental_appOverlay): mounted once per
// window, outside any route. Owns the Ctrl/Cmd+K listener, the backdrop, and
// focus restore. The portal root stays mounted so opening is a style flip;
// while closed it is `inert` and marked data-state="closed" so bb's shortcut
// layer does not treat it as an open modal (which would suppress every
// app shortcut, including ours).
import { Component, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useBootstrapSync } from "@/components/BootstrapSync";
import { Palette } from "@/components/Palette";
import { errorMessage } from "@/components/PaletteContext";
import { isMacPlatform, isPaletteHotkey } from "@/lib/hotkey";
import { OPEN_EVENT, paletteStore, usePaletteState } from "@/lib/palette-store";
import { usePortalScopeProps } from "@/lib/portal-scope";
import { cn } from "@/lib/utils";

const CARD_SHADOW = "shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)]";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * bb hides a crashed overlay for good, and this overlay owns the Cmd+K
 * listener, so a render error in the palette must stop here: report it and
 * close. The boundary is keyed per open, so the next Cmd+K starts clean.
 */
class PaletteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("Ultra Cmd+K crashed", error);
    toast.error(`Ultra Cmd+K: ${errorMessage(error)}`);
    paletteStore.close();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function PaletteOverlay() {
  const { open, openNonce, initialQuery } = usePaletteState();
  const scopeProps = usePortalScopeProps();
  const restoreFocus = useRef<HTMLElement | null>(null);
  // Lives here, not in the palette, so server signals are heard while closed.
  useBootstrapSync();

  // Global toggle: Ctrl/Cmd+K (capture phase so editors and terminals cannot
  // swallow it) plus the bridge event used by the palette row and footer.
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteHotkey(event, isMac)) return;
      event.preventDefault();
      event.stopPropagation();
      paletteStore.toggle();
    };
    const onOpen = () => paletteStore.open();
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Remember where focus was and put it back on close.
  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      restoreFocus.current = active instanceof HTMLElement ? active : null;
      return;
    }
    const target = restoreFocus.current;
    restoreFocus.current = null;
    if (target && target.isConnected) target.focus({ preventScroll: true });
  }, [open]);

  return createPortal(
    <div
      {...scopeProps}
      role="dialog"
      aria-modal={open || undefined}
      aria-label="Ultra Cmd+K"
      data-state={open ? "open" : "closed"}
      inert={!open}
      className={cn("fixed inset-0 z-50", !open && "hidden")}
    >
      <div
        aria-hidden
        onPointerDown={() => paletteStore.close()}
        className={cn("absolute inset-0 bg-black/30", !prefersReducedMotion() && "animate-in fade-in-0 duration-150")}
      />
      <div
        className={cn(
          "absolute left-1/2 top-[14vh] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2",
          !prefersReducedMotion() && "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
      >
        <div className={cn("overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground", CARD_SHADOW)}>
          {open ? (
            <PaletteBoundary key={openNonce}>
              <Palette initialQuery={initialQuery} openNonce={openNonce} />
            </PaletteBoundary>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
