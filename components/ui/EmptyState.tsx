import Link from "next/link";

/** An empty slot in the archive: a mono header line, a condensed title, one hint, one action. */
export function EmptyState({ title, body, action }: { icon?: string; title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">{"// nothing filed"}</div>
      <div className="font-display text-3xl leading-none mt-1">{title}</div>
      {body && <p className="font-mono text-[11px] text-muted max-w-sm leading-relaxed">{body}</p>}
      {action && (
        <Link href={action.href} className="mt-4 h-10 px-5 bg-gold text-black font-mono text-[11px] font-bold uppercase tracking-[0.18em] flex items-center hover:bg-white transition">
          {action.label}
        </Link>
      )}
    </div>
  );
}
