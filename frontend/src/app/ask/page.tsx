'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AskPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
