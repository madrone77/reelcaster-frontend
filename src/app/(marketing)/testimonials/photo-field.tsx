'use client';

import { useRef, useState } from 'react';

// The photo picker on /testimonials.
//
// A plain file input that, once a picture is chosen, quietly swaps it for a
// smaller JPEG before the form posts: phones hand over 4 to 12 MB originals
// and HEICs, and the server action can take 4 MB at most. Without JavaScript
// the input still works as an ordinary file field; a huge original then fails
// at the size gate and the page says so.

const MAX_MB = 3;
const MAX_DIMENSION = 2400;

async function shrink(file: File): Promise<File> {
  let source = file;
  if (/image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const heic2any = (await import('heic2any')).default;
    const blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob;
    source = new File([blob], file.name.replace(/\.hei[cf]$/i, '') + '.jpg', {
      type: 'image/jpeg',
    });
  }
  if (source.size <= MAX_MB * 1024 * 1024 && source.type === 'image/jpeg') return source;
  const imageCompression = (await import('browser-image-compression')).default;
  const out = await imageCompression(source, {
    maxSizeMB: MAX_MB,
    maxWidthOrHeight: MAX_DIMENSION,
    fileType: 'image/jpeg',
    useWebWorker: true,
  });
  return new File([out], source.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', {
    type: 'image/jpeg',
  });
}

export default function PhotoField({ error }: { error?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'empty' | 'working' | 'ready' | 'failed'>('empty');
  const [label, setLabel] = useState('');

  async function onChange() {
    const input = ref.current;
    const file = input?.files?.[0];
    if (!input || !file) {
      setState('empty');
      return;
    }
    setState('working');
    try {
      const small = await shrink(file);
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
      setLabel(`${small.name} · ${(small.size / 1024 / 1024).toFixed(1)} MB`);
      setState('ready');
    } catch {
      // Leave the original in place; the server decides whether it fits.
      setLabel(file.name);
      setState('failed');
    }
  }

  return (
    <div>
      <label
        htmlFor="tm-photo"
        className="block font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute"
      >
        Add a fishing picture
      </label>
      <p className="mt-1 text-xs text-rc-ink-mute">
        Optional. We would love to share it on the site alongside your words.
      </p>
      <input
        ref={ref}
        id="tm-photo"
        name="photo"
        type="file"
        accept="image/*,.heic,.heif"
        onChange={onChange}
        className="mt-2 block w-full text-sm text-rc-ink file:mr-3 file:rounded-lg file:border file:border-rc-rule file:bg-rc-surface file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-rc-ink hover:file:bg-rc-panel"
      />
      {state === 'working' && (
        <p className="mt-2 text-xs text-rc-ink-mute">Getting the picture ready…</p>
      )}
      {state === 'ready' && <p className="mt-2 text-xs text-rc-ink-mute">{label}</p>}
      {error && <p className="mt-2 text-xs text-rc-poor-ink">{error}</p>}
    </div>
  );
}
