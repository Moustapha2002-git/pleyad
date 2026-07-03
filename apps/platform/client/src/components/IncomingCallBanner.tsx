import { useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { trpc } from "../lib/trpc";
import { VideoCall } from "./VideoCall";

export function IncomingCallBanner() {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const incoming = trpc.calls.incoming.useQuery(undefined, {
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });
  const answer = trpc.calls.answer.useMutation();
  const decline = trpc.calls.decline.useMutation();
  const [active, setActive] = useState<{ room: string } | null>(null);

  const myName = me.data?.name ?? me.data?.email ?? "Me";

  // In an answered call — render the call overlay.
  if (active) {
    return (
      <VideoCall room={active.room} displayName={myName} onClose={() => setActive(null)} />
    );
  }

  const call = incoming.data;
  if (!call) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-navy-800 bg-navy-950 p-4 text-white shadow-[var(--shadow-pop)]">
        <div className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-gold/20 text-gold">
          <Phone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{call.fromName} is calling…</div>
          <div className="text-xs text-white/50">Incoming video call</div>
        </div>
        <button
          onClick={() =>
            decline.mutate(undefined, { onSuccess: () => utils.calls.incoming.invalidate() })
          }
          className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 transition hover:bg-red-600"
          aria-label="Decline"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            answer.mutate();
            setActive({ room: call.room });
          }}
          className="flex h-10 items-center gap-1.5 rounded-full bg-emerald-500 px-4 font-semibold transition hover:bg-emerald-600"
        >
          <Video className="h-4 w-4" /> Join
        </button>
      </div>
    </div>
  );
}
