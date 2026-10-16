import type { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'picomon_player';

export function readSessionSecret(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value || null;
}

export function setSessionCookie(res: NextResponse, secret: string): void {
  res.cookies.set(SESSION_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });
}
