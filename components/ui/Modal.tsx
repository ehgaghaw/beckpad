"use client";
import { useEffect } from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md card p-5 sm:p-6 animate-slide-in max-h-[92vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-3xl leading-none">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 border border-line font-mono text-muted hover:text-white hover:border-white/40 transition" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
