import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, email, userId } = await request.json()

    const supabase = await createClient()

    // Create the account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({ name, owner_email: email })
      .select()
      .single()

    if (accountError) throw accountError

    // Link the user to the account
    const { error: memberError } = await supabase
      .from('account_members')
      .insert({
        account_id: account.id,
        user_id: userId,
        role: 'owner'
      })

    if (memberError) throw memberError

    return NextResponse.json({ success: true, account })

  } catch (error: any) {
    console.error('Account creation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}