/** "● VISION · 1 FISH DETECTED" chip overlaid on the review photo. */
export default function VisionBadge({ fishDetected }: { fishDetected: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-rc-ink/85 px-2.5 py-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${fishDetected ? "bg-rc-good" : "bg-rc-fair"}`}
      />
      <span className="rc-label text-[10px] text-white tracking-wider">
        VISION · {fishDetected ? "1 FISH DETECTED" : "NO FISH DETECTED"}
      </span>
    </div>
  );
}
