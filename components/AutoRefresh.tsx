'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-runs the server component this is placed in, on an interval. */
export default function AutoRefresh({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const i = setInterval(() => router.refresh(), ms);
    return () => clearInterval(i);
  }, [router, ms]);
  return null;
}
