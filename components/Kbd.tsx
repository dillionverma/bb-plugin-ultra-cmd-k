import { cn } from "@/lib/utils";

/** Keycap group like the host's shortcut badges: ⌘ ⇧ P. */
export function Kbd({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span className={cn("ml-auto flex shrink-0 items-center gap-0.5", className)} aria-hidden>
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/70 bg-background px-1 font-sans text-[11px] font-medium leading-none text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
