import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { Spinner } from "./ui";

/**
 * Embedded 1:1 video. Uses a private, token-secured Daily.co room when the server
 * has Daily configured; otherwise falls back to the public Jitsi room.
 */
export function VideoCall({
  room,
  displayName,
  onClose,
}: {
  room: string;
  displayName: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const daily = trpc.calls.dailyUrl.useQuery({ room }, { refetchOnWindowFocus: false });

  const jitsiParams = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    "config.p2p.enabled=true",
    `userInfo.displayName=%22${encodeURIComponent(displayName)}%22`,
  ].join("&");
  const jitsiSrc = `https://meet.jit.si/${encodeURIComponent(room)}#${jitsiParams}`;

  // Daily URL when configured; Jitsi when the query resolved with url:null.
  const src =
    daily.data?.url ?? (daily.data && daily.data.url === null ? jitsiSrc : null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-3">
      <div className="mb-2 flex items-center justify-between text-white">
        <span className="text-sm opacity-80">Pleyad video call</span>
        <button
          onClick={onClose}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-navy transition hover:bg-gray-100"
        >
          Leave call
        </button>
      </div>
      {src ? (
        <iframe
          title={t("call.videoCallTitle")}
          src={src}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-full w-full rounded-xl border-0 bg-black"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-black text-white/70">
          {daily.error ? (
            <span className="px-6 text-center text-sm">
              Couldn't start the call: {daily.error.message}
            </span>
          ) : (
            <Spinner label={t("call.connecting")} />
          )}
        </div>
      )}
    </div>
  );
}
