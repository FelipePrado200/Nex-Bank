"use client";

import { useState } from "react";
import { ProductIcon } from "@/components/store/ProductIcon";

/**
 * Product photo from /public/products/<slug>.webp (800x600, about 25 KB).
 * Falls back to the line icon if the file is missing, so a new product never shows a broken image.
 * The photo is decorative: the product name always sits next to it.
 */
export function ProductImage({
  slug,
  icon,
  className,
  iconClassName,
  eager = false,
}: {
  slug: string;
  icon: string;
  /** Classes for the <img>. The parent sets the size and clips it. */
  className?: string;
  iconClassName?: string;
  /** Load right away instead of lazily (use for the first row only) */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <ProductIcon name={icon} className={iconClassName} />;

  // A plain <img> on purpose: the files are already resized and compressed.
  return (
    <img
      src={`/products/${slug}.webp`}
      alt=""
      width={800}
      height={600}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
