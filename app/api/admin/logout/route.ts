import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete('oma-admin-token');
  return NextResponse.json({ success: true });
}
