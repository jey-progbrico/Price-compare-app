import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = await createClient()

  // Sign out from Supabase
  await supabase.auth.signOut()

  // Redirect to the landing page (root) after sign out
  return NextResponse.redirect(`${requestUrl.origin}/`, {
    status: 301,
  })
}
