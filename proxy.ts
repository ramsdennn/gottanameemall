import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname !== 'www.gottanameemall.co.uk') return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.hostname = 'gottanameemall.co.uk';
  return NextResponse.redirect(destination, 301);
}

export const config = { matcher: '/:path*' };
