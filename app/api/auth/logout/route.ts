import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear the session cookie
  response.cookies.delete('discord_session');
  
  return response;
}

export async function GET() {
  // Redirect to login page after clearing the session
  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  
  // Clear the session cookie
  response.cookies.delete('discord_session');
  
  return response;
}
