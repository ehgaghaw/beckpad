/* eslint-disable @next/next/no-img-element */
export function CoinAvatar({
  emoji,
  hue,
  imageUrl,
  size = 48,
  className = "",
}: {
  emoji: string;
  hue: number;
  imageUrl?: string;
  size?: number;
  className?: string;
}) {
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.5,
    background: imageUrl
      ? undefined
      : `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 60) % 360} 85% 35%))`,
  } as const;
  return (
    <div
      className={`shrink-0 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 ${className}`}
      style={style}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : <span>{emoji}</span>}
    </div>
  );
}
