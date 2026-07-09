/**
 * Embedded 1:1 video via Jitsi Meet (public meet.jit.si — no account/keys needed).
 * A full-screen overlay hosting the call iframe.
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
  const params = [
    "config.prejoinPageEnabled=false",
    "config.prejoinConfig.enabled=false",
    "config.disableDeepLinking=true",
    "config.enableWelcomePage=false",
    "config.p2p.enabled=true",
    "config.requireDisplayName=false",
    "config.enableLobbyChat=false",
    "config.disableModeratorIndicator=true",
    `userInfo.displayName=%22${encodeURIComponent(displayName)}%22`,
  ].join("&");
  const src = `https://meet.jit.si/${encodeURIComponent(room)}#${params}`;

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
      <iframe
        title="Pleyad video call"
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="h-full w-full rounded-xl border-0 bg-black"
      />
    </div>
  );
}
