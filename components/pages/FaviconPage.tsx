import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import { FAVICON_COLORS, type FaviconColor } from "@/lib/contract";
import { cn } from "@/lib/utils";

const SWATCH: Record<FaviconColor, string> = {
  default: "bg-foreground/60",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function FaviconDot({ color, className }: { color: FaviconColor; className?: string }) {
  return <span aria-hidden className={cn("size-3 rounded-full", SWATCH[color], className)} />;
}

export function FaviconPage() {
  const api = usePaletteApi();
  const active = api.bootstrap?.theme.faviconColor ?? "default";
  return (
    <CommandGroup heading="Favicon color">
      {FAVICON_COLORS.map((color) => (
        <PaletteRow
          key={color}
          value={`favicon:${color}`}
          keywords={[color, "favicon", "icon"]}
          iconNode={<FaviconDot color={color} />}
          title={color[0]!.toUpperCase() + color.slice(1)}
          active={color === active}
          onSelect={async () => {
            try {
              await api.rpc.call("set_favicon", { faviconColor: color });
              api.record(`favicon:${color}`);
              await api.refreshBootstrap();
              toast.success(`Favicon: ${color}`);
              api.close();
            } catch (error) {
              api.reportError(error);
            }
          }}
        />
      ))}
    </CommandGroup>
  );
}
