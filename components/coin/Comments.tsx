"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAsync, useTick } from "@/lib/hooks";
import { useIdentity } from "@/lib/wallet";
import { RowSkeleton } from "@/components/ui/Skeleton";
import { shortAddr, timeAgo } from "@/lib/format";

export function Comments({ mint }: { mint: string }) {
  const id = useIdentity();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, setData } = useAsync(() => api.getComments(mint), [mint]);
  useTick(10_000);

  const post = async () => {
    if (!id.address) return toast.error("Connect or enable a demo wallet to post");
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      const c = await api.postComment(mint, id.address, text);
      setData((prev) => [c, ...(prev ?? [])]);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg tracking-[0.2em]">💬 COMMENTS</span>
        <span className="text-[10px] text-muted tracking-widest">{data?.length ?? 0}</span>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
          placeholder={id.address ? "say something degen" : "connect a wallet to post"}
          maxLength={280}
          className="flex-1 h-10 px-3 rounded-lg bg-black/60 border border-line text-sm focus:outline-none focus:border-gold"
        />
        <button onClick={post} disabled={busy || !text.trim()} className="h-10 px-4 rounded-lg bg-gold text-black font-display text-lg tracking-wider disabled:opacity-50">
          POST
        </button>
      </div>
      {loading ? (
        <RowSkeleton rows={4} />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No comments yet. Say something.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((c) => (
            <li key={c.id} className="text-sm animate-slide-in">
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <Link href={`/profile/${c.wallet}`} className="font-mono text-gold hover:underline">
                  {shortAddr(c.wallet, 4)}
                </Link>
                <span>{timeAgo(c.ts)}</span>
              </div>
              <p className="mt-0.5">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
