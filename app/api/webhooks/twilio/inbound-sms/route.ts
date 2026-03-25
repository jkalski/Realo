import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STOP_KEYWORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']
const HELP_KEYWORDS = ['help', 'info']

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const to = formData.get('To') as string

    if (!from || !body) {
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }

    const messageText = body.trim().toLowerCase()
    const isStop = STOP_KEYWORDS.includes(messageText)
    const isHelp = HELP_KEYWORDS.includes(messageText)

    // Find contact by phone number
    const { data: contact } = await supabase
      .from('contacts')
      .select('*, accounts(*)')
      .eq('phone', from)
      .maybeSingle()

    if (!contact) {
      console.log(`Inbound SMS from unknown number: ${from}`)
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }

    const account_id = contact.account_id

    // Handle STOP
    if (isStop) {
      await supabase
        .from('contacts')
        .update({ is_dnc: true, status: 'opted_out' })
        .eq('id', contact.id)

      await supabase
        .from('dnc_list')
        .insert({
          account_id,
          phone: from,
          reason: 'sms_stop_keyword'
        })

      await supabase.from('events').insert({
        account_id,
        contact_id: contact.id,
        event_type: 'sms_opt_out',
        payload: { keyword: body.trim(), from }
      })

      // Stop all active workflows for this contact
      await supabase
        .from('workflow_instances')
        .update({ status: 'stopped', stopped_reason: 'opt_out' })
        .eq('contact_id', contact.id)
        .eq('status', 'active')

      console.log(`Contact ${contact.first_name} opted out via STOP`)

      return new Response(
        '<Response><Message>You have been unsubscribed and will not receive further messages.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Handle HELP
    if (isHelp) {
      return new Response(
        '<Response><Message>Reply STOP to unsubscribe. For assistance contact your agent directly.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Regular reply - stop workflows and mark as replied
    await supabase
      .from('contacts')
      .update({
        status: 'active',
        last_replied_at: new Date().toISOString(),
        lead_score: (contact.lead_score || 0) + 10
      })
      .eq('id', contact.id)

    // Stop active workflows
    await supabase
      .from('workflow_instances')
      .update({ status: 'stopped', stopped_reason: 'contact_replied' })
      .eq('contact_id', contact.id)
      .eq('status', 'active')

    // Log the inbound message
    await supabase.from('messages').insert({
      account_id,
      contact_id: contact.id,
      direction: 'inbound',
      channel: 'sms',
      status: 'received',
      body: body.trim(),
      deduplication_key: `inbound_sms_${from}_${Date.now()}`
    })

    // Log the event
    await supabase.from('events').insert({
      account_id,
      contact_id: contact.id,
      event_type: 'sms_reply',
      payload: { body: body.trim(), from }
    })

    // Check if now a hot lead
    const newScore = (contact.lead_score || 0) + 10
    if (newScore >= 8) {
      await supabase
        .from('contacts')
        .update({ status: 'hot' })
        .eq('id', contact.id)

      await supabase.from('events').insert({
        account_id,
        contact_id: contact.id,
        event_type: 'lead_became_hot',
        payload: { score: newScore, trigger: 'sms_reply' }
      })

      console.log(`HOT LEAD: ${contact.first_name} ${contact.last_name} replied via SMS`)
    }

    console.log(`Inbound SMS from ${contact.first_name}: "${body.trim()}"`)

    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })

  } catch (error: any) {
    console.error('Inbound SMS webhook error:', error)
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }
}