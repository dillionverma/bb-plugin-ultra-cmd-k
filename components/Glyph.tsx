// Draws lib/hugeicons.ts artwork with the markup @hugeicons/react's
// HugeiconsIcon renders, so rows look the same without that package.
import { createElement, type SVGProps } from "react";
import type { IconSvgElement } from "@/lib/hugeicons";

type GlyphProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  icon: IconSvgElement;
  /** Replaces the artwork's own 1.5 stroke on every element. */
  strokeWidth?: number;
};

export function Glyph({ icon, strokeWidth, className, ...rest }: GlyphProps) {
  const stroke = strokeWidth === undefined ? {} : { strokeWidth, stroke: "currentColor" };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      className={className}
      {...stroke}
      {...rest}
    >
      {icon.map(([tag, attrs]) => createElement(tag, { ...attrs, ...stroke }))}
    </svg>
  );
}
