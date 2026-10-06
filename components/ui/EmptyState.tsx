import Link from "next/link";

export function EmptyState({
  icon = "🫥",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-2">
      <div className="text-4xl">{icon}</div>
      <div className="font-display text-2xl tracking-wide">{title}</div>
      {body && <p className="text-sm text-muted max-w-sm">{body}</p>}
      {action && (
        <Link href={action.href} className="mt-3 h-10 px-4 rounded-lg bg-gold text-black font-display text-lg tracking-wider flex items-center">
          {action.label}
        </Link>
      )}
    </div>
  );
}
