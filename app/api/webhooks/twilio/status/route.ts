import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string

    if (!messageSid) {
      return NextResponse.json({ error: 'Missing MessageSid' }, { status: 400 })
    }

    console.log(`Twilio status update: ${messageSid} -> ${messageStatus}`)

    // Find message by Twilio SID
    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('twilio_sid', messageSid)
      .maybeSingle()

    if (!message) {
      console.log(`Message not found for SID: ${messageSid}`)
      return NextResponse.json({ received: true })
    }

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      queued: 'pending',
      sending: 'pending',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed'
    }

    const newStatus = statusMap[messageStatus] || messageStatus

    await supabase
      .from('messages')
      .update({
        status: newStatus,
        ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(newStatus === 'failed' && { failed_reason: errorCode || messageStatus })
      })
      .eq('id', message.id)

    // Log delivery event
    await supabase.from('events').insert({
      account_id: message.account_id,
      contact_id: message.contact_id,
      message_id: message.id,
      event_type: `sms_${newStatus}`,
      payload: { twilio_status: messageStatus, error_code: errorCode }
    })

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Twilio status webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}