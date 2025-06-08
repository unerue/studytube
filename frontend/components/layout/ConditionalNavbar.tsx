'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  // LectureRoomPage에서는 Navbar를 숨김 (패턴: /lectures/[id])
  const isLectureRoom = pathname?.match(/^\/lectures\/[^\/]+$/);
  
  if (isLectureRoom) {
    return null;
  }
  
  return <Navbar />;
} 