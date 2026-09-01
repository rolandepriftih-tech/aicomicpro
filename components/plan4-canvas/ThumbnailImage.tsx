"use client";

import { memo, useEffect, useState } from "react";

const thumbnailCache = new Map<string, string>();
const pendingThumbnails = new Map<string, Promise<string>>();

function shouldGenerateThumbnail(src: string): boolean {
  if (!src.startsWith("data:image/")) return false;
  if (src.startsWith("data:image/svg")) return false;
  return src.length > 120_000;
}

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") return 0;
  const requestIdle = window.requestIdleCallback;
  if (requestIdle) {
    return requestIdle(callback, { timeout: 800 });
  }
  return window.setTimeout(callback, 60);
}

function cancelIdle(id: number) {
  if (typeof window === "undefined") return;
  if (window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
    return;
  }
  window.clearTimeout(id);
}

function buildThumbnail(src: string, maxEdge: number, quality: number): Promise<string> {
  const cached = thumbnailCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = pendingThumbnails.get(src);
  if (pending) return pending;

  const promise = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / Math.max(img.naturalHeight, 1);
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width >= height && width > maxEdge) {
        width = maxEdge;
        height = Math.round(maxEdge / ratio);
      } else if (height > width && height > maxEdge) {
        height = maxEdge;
        width = Math.round(maxEdge * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const thumb = canvas.toDataURL("image/jpeg", quality);
      thumbnailCache.set(src, thumb);
      resolve(thumb);
    };
    img.onerror = () => reject(new Error("Thumbnail image failed to load"));
    img.src = src;
  }).finally(() => {
    pendingThumbnails.delete(src);
  });

  pendingThumbnails.set(src, promise);
  return promise;
}

interface ThumbnailImageProps {
  src: string;
  alt: string;
  className?: string;
  maxEdge?: number;
  quality?: number;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

function ThumbnailImage({
  src,
  alt,
  className,
  maxEdge = 520,
  quality = 0.72,
  onLoad,
}: ThumbnailImageProps) {
  const [displaySrc, setDisplaySrc] = useState(() => {
    if (!shouldGenerateThumbnail(src)) return src;
    return thumbnailCache.get(src) || "";
  });

  useEffect(() => {
    let cancelled = false;
    if (!shouldGenerateThumbnail(src)) {
      setDisplaySrc(src);
      return;
    }

    const cached = thumbnailCache.get(src);
    if (cached) {
      setDisplaySrc(cached);
      return;
    }

    setDisplaySrc("");
    const idleId = scheduleIdle(() => {
      void buildThumbnail(src, maxEdge, quality)
        .then((thumb) => {
          if (!cancelled) setDisplaySrc(thumb);
        })
        .catch(() => {
          if (!cancelled) setDisplaySrc(src);
        });
    });

    return () => {
      cancelled = true;
      cancelIdle(idleId);
    };
  }, [maxEdge, quality, src]);

  if (!displaySrc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950/70 text-[10px] text-zinc-700">
        生成预览
      </div>
    );
  }

  return <img src={displaySrc} alt={alt} className={className} onLoad={onLoad} />;
}

export default memo(ThumbnailImage);
