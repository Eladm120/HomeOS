"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ImageOff, X } from "lucide-react";
import { cachedSignedUrl, getSignedUrl, thumbPathFor } from "@/lib/media";
import { cn } from "@/lib/utils";

export function useSignedUrl(path: string | null | undefined, thumb = false): string | null {
  const target = path ? (thumb ? thumbPathFor(path) : path) : null;
  const [url, setUrl] = useState<string | null>(() => (target ? cachedSignedUrl(target) : null));
  useEffect(() => {
    let alive = true;
    if (!target) {
      setUrl(null);
      return;
    }
    const hit = cachedSignedUrl(target);
    if (hit) {
      setUrl(hit);
      return;
    }
    getSignedUrl(target).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [target]);
  return url;
}

/** Private-bucket image (signed URL). Falls back to the full image if no thumbnail exists. */
export function SignedImage({
  path,
  alt,
  thumb = true,
  className,
}: {
  path: string;
  alt: string;
  thumb?: boolean;
  className?: string;
}) {
  const thumbUrl = useSignedUrl(path, thumb);
  const fullUrl = useSignedUrl(path, false);
  const [failedThumb, setFailedThumb] = useState(false);
  const [broken, setBroken] = useState(false);
  const src = thumb && !failedThumb ? thumbUrl : fullUrl;

  if (broken) {
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-muted", className)}>
        <ImageOff className="size-1/3" />
      </div>
    );
  }
  if (!src) return <div className={cn("animate-pulse bg-surface-2", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URLs
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("object-cover", className)}
      onError={() => (thumb && !failedThumb ? setFailedThumb(true) : setBroken(true))}
    />
  );
}

export function ImageViewer({
  path,
  alt,
  open,
  onOpenChange,
}: {
  path: string | null;
  alt: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const url = useSignedUrl(open ? path : null, false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[60] flex items-center justify-center p-4 outline-none" onClick={() => onOpenChange(false)}>
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          <Dialog.Description className="sr-only">תמונה מוגדלת</Dialog.Description>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="max-h-full max-w-full rounded-2xl object-contain shadow-lift" />
          ) : (
            <div className="size-16 animate-pulse rounded-full bg-white/20" />
          )}
          <Dialog.Close className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/15 text-white" aria-label="סגירה">
            <X className="size-6" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
