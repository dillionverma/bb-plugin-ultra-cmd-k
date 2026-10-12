// One palette row, styled after Ultra Sidebar's thread rows: a 16px glyph in
// a fixed slot, a title, muted meta on the right, and a keycap when the row
// has a shortcut. Anything absent renders nothing — no placeholders.
import type { ReactNode } from "react";
import { experimental_Icon as Icon } from "@get-bb/plugin-sdk/app";
import { CommandItem } from "@/components/ui/command";
import { Glyph } from "@/components/Glyph";
import { Kbd } from "@/components/Kbd";
import type { IconSvgElement } from "@/lib/hugeicons";
import { cn } from "@/lib/utils";

type PaletteRowProps = {
  /** Unique cmdk value; never shown, never matched (see Palette's filter). */
  value: string;
  /** Text the filter matches against: title plus keywords. */
  keywords: readonly string[];
  glyph?: IconSvgElement;
  icon?: string;
  iconNode?: ReactNode;
  iconClassName?: string;
  title: string;
  /** Muted text after the title, e.g. the thread's project. */
  meta?: ReactNode;
  shortcut?: readonly string[];
  trailing?: ReactNode;
  disabled?: boolean;
  active?: boolean;
  hasPage?: boolean;
  onSelect: () => void;
  "data-action-id"?: string;
};

function RowGlyph({ glyph, icon, className }: { glyph?: IconSvgElement; icon?: string; className?: string }) {
  if (glyph) return <Glyph icon={glyph} strokeWidth={1.75} className={cn("size-4", className)} aria-hidden />;
  if (icon) return <Icon name={icon} className={cn("size-4", className)} aria-hidden />;
  return null;
}

export function PaletteRow({
  value,
  keywords,
  glyph,
  icon,
  iconNode,
  iconClassName,
  title,
  meta,
  shortcut,
  trailing,
  disabled,
  active,
  hasPage,
  onSelect,
  ...rest
}: PaletteRowProps) {
  return (
    <CommandItem
      value={value}
      keywords={[...keywords]}
      disabled={disabled}
      onSelect={onSelect}
      data-action-id={rest["data-action-id"]}
      className={cn(
        "group/row h-8 gap-2.5 rounded-md px-2 text-[13px] text-foreground",
        "data-[selected=true]:bg-state-hover",
        "data-[disabled=true]:opacity-40",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center text-muted-foreground",
          "group-data-[selected=true]/row:text-foreground",
          iconClassName,
        )}
      >
        {iconNode ?? <RowGlyph glyph={glyph} icon={icon} />}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={cn("truncate", active && "font-medium")}>{title}</span>
        {meta ? <span className="min-w-0 truncate text-xs text-muted-foreground">{meta}</span> : null}
      </span>
      {trailing}
      {active ? <RowGlyph icon="Check" className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      {shortcut && shortcut.length > 0 ? <Kbd keys={shortcut} /> : null}
      {hasPage ? (
        <Icon
          name="ChevronRight"
          className="size-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-data-[selected=true]/row:opacity-100"
          aria-hidden
        />
      ) : null}
    </CommandItem>
  );
}
