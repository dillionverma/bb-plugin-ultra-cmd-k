// A project's artwork where Ultra Sidebar has cached some, else a folder.
// The sidebar plugin serves vetted image bytes from its own HTTP route and
// answers 404 when there is nothing; we simply try it and fall back.
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GLYPHS } from "@/lib/glyphs";
import { cn } from "@/lib/utils";

const SIDEBAR_ICON_URL = "/api/v1/plugins/workspace-sidebar/http/project-icon";
const failed = new Set<string>();

export function ProjectIcon({
  projectId,
  isPersonal = false,
  className,
}: {
  projectId: string;
  isPersonal?: boolean;
  className?: string;
}) {
  const [, rerender] = useState(0);
  if (!isPersonal && !failed.has(projectId)) {
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        className={cn("shrink-0 rounded-[3px] object-contain", className)}
        src={`${SIDEBAR_ICON_URL}?projectId=${encodeURIComponent(projectId)}`}
        onError={() => {
          failed.add(projectId);
          rerender((n) => n + 1);
        }}
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={isPersonal ? GLYPHS.personal : GLYPHS.folder}
      className={cn("shrink-0", className)}
      strokeWidth={1.75}
      aria-hidden
    />
  );
}
