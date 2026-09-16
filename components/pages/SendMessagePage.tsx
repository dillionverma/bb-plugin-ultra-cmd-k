// The palette input doubles as the message box; Enter sends via the server
// (`threads.send` mode "auto": starts an idle thread, queues on a busy one).
import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import { threadTitle } from "@/components/ThreadRow";

export function SendMessagePage({ threadId, text }: { threadId: string; text: string }) {
  const api = usePaletteApi();
  const thread = api.threads.threads.find((entry) => entry.id === threadId);
  const title = thread ? threadTitle(thread) : threadId;
  const message = text.trim();
  return (
    <CommandGroup heading={`Message → ${title}`}>
      <PaletteRow
        value="send"
        keywords={[]}
        icon="Sent"
        title={message === "" ? "Type a message, then press Enter" : `Send: ${message}`}
        subtitle={thread?.indicator === "runtime" ? "Thread is running; the message will be queued" : undefined}
        disabled={message === ""}
        shortcut={["↵"]}
        onSelect={async () => {
          if (message === "") return;
          try {
            await api.rpc.call("send_message", { threadId, text: message });
            api.record("thread:send");
            toast.success("Message sent");
            api.close();
          } catch (error) {
            api.reportError(error);
          }
        }}
      />
    </CommandGroup>
  );
}
