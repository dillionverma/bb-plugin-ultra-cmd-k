// `@` mode lists every thread, so rows are windowed with TanStack Virtual
// inside the cmdk list. cmdk only knows about mounted rows, so this component
// owns ↑ ↓ Home End PageUp PageDown while it is mounted (the palette shell
// forwards them, see Palette.onKeyDown): it moves the controlled cmdk value
// and scrolls the target row into the window, after which cmdk's own ↵ and →
// handling finds the row in the DOM as usual. Pointer hover still goes through
// cmdk, which reports it back through the same controlled value.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCommandState } from "cmdk";
import type { PluginSidebarProject, PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { CommandGroup } from "@/components/ui/command";
import { usePaletteApi, type VirtualNav } from "@/components/PaletteContext";
import { ThreadRow } from "@/components/ThreadRow";
import type { Action } from "@/lib/palette-types";

/** Row height: PaletteRow is `h-8`. Fixed, so no per-row measurement. */
const ROW_PX = 32;
const OVERSCAN = 12;
/** The list's max height before the first measure, so the first paint fills it. */
const INITIAL_VIEWPORT_PX = 440;

export function threadActionId(thread: Pick<PluginSidebarThread, "id">): string {
  return `thread:${thread.id}:open`;
}

export function VirtualThreadList({
  threads,
  projects,
  byId,
  query,
  heading = "Threads",
}: {
  threads: readonly PluginSidebarThread[];
  projects: ReadonlyMap<string, PluginSidebarProject>;
  byId: ReadonlyMap<string, Action>;
  /** The search text these rows were ranked by; a change resets to the top. */
  query: string;
  heading?: string;
}) {
  const api = usePaletteApi();
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const scroller = useMemo(() => list?.closest<HTMLElement>("[cmdk-list]") ?? null, [list]);
  const [scrollMargin, setScrollMargin] = useState(0);

  // The list's distance from the top of the scrolled content (the group
  // heading sits above it). Rects, not offsetTop: the offset parent is not
  // the scroll area.
  useLayoutEffect(() => {
    if (list === null || scroller === null) return;
    const next = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    setScrollMargin((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, [list, scroller]);

  const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: threads.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW_PX,
    getItemKey: (index) => threads[index]!.id,
    overscan: OVERSCAN,
    scrollMargin,
    initialRect: { width: 0, height: INITIAL_VIEWPORT_PX },
  });

  const selected = useCommandState((state) => state.value);
  const latest = useRef({ threads, selected });
  latest.current = { threads, selected };

  // A new query ranks a new list: start from the top with the best match lit.
  useEffect(() => {
    const first = latest.current.threads[0];
    if (!first) return;
    virtualizer.scrollToIndex(0);
    api.select(threadActionId(first));
    // Only the query should trigger this; live thread updates must not steal the highlight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const go = (index: number) => {
      const thread = latest.current.threads[index];
      if (!thread) return;
      api.select(threadActionId(thread));
      virtualizer.scrollToIndex(index, { align: "auto" });
    };
    const selectedIndex = () =>
      latest.current.threads.findIndex((thread) => threadActionId(thread) === latest.current.selected);
    const nav: VirtualNav = {
      move(delta) {
        const count = latest.current.threads.length;
        if (count === 0) return;
        const index = selectedIndex();
        let next = index === -1 ? (delta > 0 ? 0 : count - 1) : index + delta;
        // Wrap like cmdk's `loop`.
        if (next < 0) next = count - 1;
        else if (next >= count) next = 0;
        go(next);
      },
      page(direction) {
        const count = latest.current.threads.length;
        if (count === 0) return;
        const viewport = scroller?.clientHeight ?? INITIAL_VIEWPORT_PX;
        const step = Math.max(1, Math.floor(viewport / ROW_PX) - 1);
        const index = Math.max(0, selectedIndex());
        go(Math.min(count - 1, Math.max(0, index + direction * step)));
      },
      jump(edge) {
        const count = latest.current.threads.length;
        if (count === 0) return;
        go(edge === "first" ? 0 : count - 1);
      },
    };
    api.virtualNav.current = nav;
    return () => {
      if (api.virtualNav.current === nav) api.virtualNav.current = null;
    };
  }, [api, virtualizer, scroller]);

  const items = virtualizer.getVirtualItems();

  return (
    <CommandGroup heading={heading}>
      {threads.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No matches.</div>
      ) : (
        <div ref={setList} data-virtual-threads="" style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {items.map((item) => {
            const thread = threads[item.index]!;
            const id = threadActionId(thread);
            return (
              <div
                key={item.key}
                data-index={item.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: item.size,
                  transform: `translateY(${item.start - scrollMargin}px)`,
                }}
              >
                <ThreadRow
                  thread={thread}
                  project={projects.get(thread.projectId)}
                  actionId={id}
                  onSelect={() => void byId.get(id)?.run()}
                />
              </div>
            );
          })}
        </div>
      )}
    </CommandGroup>
  );
}
