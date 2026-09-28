// The palette input doubles as the message box; Enter sends via the server
// (`threads.send` mode "auto": starts an idle thread, queues on a busy one).
import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import { ThreadGlyph, threadTitle } from "@/components/ThreadRow";
import { GLYPHS } from "@/lib/glyphs";

export function SendMessagePage({ threadId, text }: { threadId: string; text: string }) {
  const api = usePaletteApi();
  const thread = api.threads.threads.find((entry) => entry.id === threadId);
  const title = thread ? threadTitle(thread) : threadId;
  const message = text.trim();
  const busy = thread?.indicator === "runtime";
  return (
    <CommandGroup
      heading={
        <span className="inline-flex items-center gap-1.5">
          {thread ? <ThreadGlyph thread={thread} /> : null}
          <span className="truncate">{title}</span>
        </span>
      }
    >
      <PaletteRow
        value="send"
        keywords={[]}
        glyph={GLYPHS.send}
        title={message === "" ? "Type a message and press Enter" : message}
        meta={message !== "" && busy ? "queued — the agent is running" : undefined}
        disabled={message === ""}
        shortcut={["↵"]}
        onSelect={async () => {
          if (message === "") return;
          try {
            await api.rpc.call("send_message", { threadId, text: message });
            api.record("thread:send");
            toast.success("Sent");
            api.close();
          } catch (error) {
            api.reportError(error);
          }
        }}
      />
    </CommandGroup>
  );
}
