import { emojiSrc } from "@/lib/fluent";
import { cn } from "@/lib/utils";

/** A 3D illustration for an emoji (bundled Fluent art), or the plain glyph when none exists. */
export function Emoji3D({ emoji, className, alt = "" }: { emoji: string; className?: string; alt?: string }) {
  const src = emojiSrc(emoji);
  if (!src)
    return (
      <span aria-hidden={!alt} className={cn("grid place-items-center leading-none", className)}>
        {emoji}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element -- tiny static asset, no optimisation needed
  return <img src={src} alt={alt} draggable={false} className={cn("object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]", className)} />;
}
