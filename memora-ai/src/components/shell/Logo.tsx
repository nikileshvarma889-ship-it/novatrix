import { cn } from "@/lib/utils";

/** MEMORA AI mark: a brain outline built from connected nodes, resting on an open book. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B6CFF" />
          <stop offset="1" stopColor="#38A0FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#mg)" />
      {/* book */}
      <path d="M14 46c6-2.4 12-2.4 18 0 6-2.4 12-2.4 18 0" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 46V41" stroke="#fff" strokeOpacity=".9" strokeWidth="2.6" strokeLinecap="round" />
      {/* brain as node network */}
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity=".95">
        <path d="M32 14c-4-3-11-1.5-12 4-4.5 1-6 6.5-3 10-1.5 4 1.5 8 6 8h9" />
        <path d="M32 14c4-3 11-1.5 12 4 4.5 1 6 6.5 3 10 1.5 4-1.5 8-6 8h-9" />
        <path d="M32 14v22M24 22l8 5 8-5M24 30l8-3" strokeOpacity=".7" />
      </g>
      <g fill="#fff">
        <circle cx="24" cy="22" r="2.4" /><circle cx="40" cy="22" r="2.4" /><circle cx="32" cy="27" r="2.6" />
        <circle cx="24" cy="30" r="2" /><circle cx="32" cy="36" r="2.4" />
      </g>
    </svg>
  );
}

export function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={34} className="shrink-0 drop-shadow-[0_6px_18px_rgba(124,92,255,0.45)]" />
      {!collapsed && (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-[0.14em]">MEMORA<span className="text-gradient"> AI</span></div>
          <div className="mt-1 whitespace-nowrap text-[9.5px] tracking-wide text-subtle">Your Memory. Your Studies. Your AI.</div>
        </div>
      )}
    </div>
  );
}
