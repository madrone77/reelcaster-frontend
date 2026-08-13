'use client';

import { useEffect, useState } from 'react';

/**
 * True once `open` has first been true, and true from then on.
 *
 * The companion to a `next/dynamic` dialog. Rendering such a dialog only while
 * it is open keeps its chunk out of page load, which is the point — but it
 * also unmounts the moment it closes, so the close animation never runs and
 * the next open re-mounts from scratch. Latching keeps it mounted after first
 * use while still never fetching it for someone who does not open it.
 *
 * Use with a controlled dialog:
 *
 *   const mounted = useMountedOnce(open);
 *   {mounted && <SomeDialog open={open} onOpenChange={setOpen} />}
 */
export function useMountedOnce(open: boolean): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return mounted;
}
