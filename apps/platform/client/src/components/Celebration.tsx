import { PartyPopper } from "lucide-react";
import { Button } from "./ui";

/**
 * A lightweight, dependency-free celebration overlay shown when a learner completes
 * a path. Pure CSS animation — a scale-in card plus a few drifting emoji.
 */
export function Celebration({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  const confetti = ["🎉", "✨", "🎊", "⭐", "🏅", "🎈", "💫", "🥳"];
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Drifting emoji */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="animate-confetti absolute text-2xl"
            style={{
              left: `${(i / confetti.length) * 100 + 4}%`,
              animationDelay: `${i * 0.12}s`,
            }}
          >
            {c}
          </span>
        ))}
      </div>

      <div
        className="animate-pop relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15 text-gold">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-navy-900">{title}</h2>
        <p className="mt-2 text-sm text-ink/60">{message}</p>
        <Button className="mt-6 w-full" onClick={onClose}>
          Keep going 🚀
        </Button>
      </div>
    </div>
  );
}
