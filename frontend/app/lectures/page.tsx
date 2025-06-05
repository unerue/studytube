'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LecturesPage() {
  const router = useRouter();

  useEffect(() => {
    // /lectures 경로를 /lectures/new로 리다이렉트
    router.replace('/lectures/new');
  }, [router]);

  return null;
} 