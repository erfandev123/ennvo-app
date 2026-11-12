import React, { useEffect, useState } from 'react';
import { formatMediaUrl } from '../utils';

type Props = {
  src?: string | null;
  alt?: string;
  /** Extra classes for the <img> itself. */
  imgClassName?: string;
  /** Extra classes for the wrapping element. */
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
};

/**
 * Image inside a chat bubble.
 *
 * Three problems are solved here:
 *
 * 1. A stored "/uploads/..." path 404s inside the Android app, because the
 *    WebView origin is https://localhost. The URL is resolved against the
 *    real backend, so the preview always loads.
 * 2. If the image still fails, the raw path is tried once and after that a
 *    neutral placeholder is shown - never the tiny broken image icon.
 * 3. The natural height is kept (no forced square), so a portrait photo is
 *    not cropped into a small cut-out.
 */
export const ChatMediaImage = ({
  src,
  alt = '',
  imgClassName = '',
  className = '',
  onClick,
  style,
  referrerPolicy,
}: Props) => {
  const resolved = formatMediaUrl(src);
  const [current, setCurrent] = useState(resolved);
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 = resolved, 1 = raw, 2 = failed

  useEffect(() => {
    setCurrent(formatMediaUrl(src));
    setStage(0);
  }, [src]);

  const handleError = () => {
    if (stage === 0) {
      // Second chance with the untouched path (works on the web build).
      if (src && src !== current) {
        setCurrent(src);
        setStage(1);
        return;
      }
    }
    setStage(2);
  };

  if (stage === 2) {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-200/60 dark:bg-white/5 ${className}`}
        style={style}
        onClick={onClick}
      >
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8.5" cy="9.5" r="1.6" />
          <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L16 17" />
          <path d="m14 14 1.8-1.8a2 2 0 0 1 2.8 0L20 14" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      referrerPolicy={referrerPolicy}
      decoding="async"
      onError={handleError}
      onClick={onClick}
      className={imgClassName}
      style={style}
    />
  );
};

export default ChatMediaImage;
