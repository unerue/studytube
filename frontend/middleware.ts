import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요한 경로들
const protectedPaths = [
  '/dashboard',
  '/profile',
  '/study',
  '/lectures',
  '/video'
];

// 인증된 사용자가 접근하면 안되는 경로들 (로그인, 회원가입)
const authPaths = [
  '/login',
  '/register'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 정적 파일들은 제외
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 쿠키에서 토큰 확인 (HttpOnly 쿠키는 서버에서만 접근 가능)
  const cookieToken = request.cookies.get('access_token')?.value;
  
  // 보호된 경로 체크
  const isProtectedPath = protectedPaths.some(path => 
    pathname.startsWith(path)
  );
  
  // 인증 경로 체크
  const isAuthPath = authPaths.some(path => 
    pathname.startsWith(path)
  );

  // 인증이 필요한 페이지인데 토큰이 없는 경우
  if (isProtectedPath && !cookieToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 이미 인증된 사용자가 로그인/회원가입 페이지에 접근하는 경우
  if (isAuthPath && cookieToken) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/';
    const redirectUrl = new URL(callbackUrl, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 