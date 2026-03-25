import { createClient } from '@supabase/supabase-js'
import { enqueueWorkflow, enqueueAlert } from './queue'
import twilio from 'twilio'
import { generateSMS } from '@/lib/ai'
import { sendHotLeadAlert } from '@/lib/alerts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const HOURS_24 = 24 * 60 * 60 * 1000
const HOURS_72 = 72 * 60 * 60 * 1000

// Check if current time is within working hours for account
async function isWithinWorkingHours(account_id: string): Promise<{ allowed: boolean, msUntilOpen: number }> {
  const { data: account } = await supabase
    .from('accounts')
    .select('working_hours_start, working_hours_end, timezone')
    .eq('id', account_id)
    .single()

  if (!account) return { allowed: true, msUntilOpen: 0 }

  const now = new Date()
  const hour = now.getHours()

  if (hour >= account.working_hours_start && hour < account.working_hours_end) {
    return { allowed: true, msUntilOpen: 0 }
  }

  // Calculate ms until next working hours open
  const nextOpen = new Date()
  if (hour >= account.working_hours_end) {
    nextOpen.setDate(nextOpen.getDate() + 1)
  }
  nextOpen.setHours(account.working_hours_start, 0, 0, 0)
  
  return { 
    allowed: false, 
    msUntilOpen: nextOpen.getTime() - now.getTime() 
  }
}

// Check if contact is on DNC list
async function isDNC(account_id: string, contact_id: string): Promise<boolean> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('is_dnc, phone, email')
    .eq('id', contact_id)
    .single()

  if (!contact) return true
  if (contact.is_dnc) return true

  const { data: dnc } = await supabase
    .from('dnc_list')
    .select('id')
    .eq('account_id', account_id)
    .or(`phone.eq.${contact.phone},email.eq.${contact.email}`)
    .maybeSingle()

  return !!dnc
}

// Log a message record
async function logMessage(
  account_id: string,
  contact_id: string,
  workflow_instance_id: string,
  channel: 'sms' | 'email',
  body: string,
  dedup_key: string
) {
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('deduplication_key', dedup_key)
    .maybeSingle()

  if (existing) {
    console.log('Duplicate message skipped:', dedup_key)
    return null
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      account_id,
      contact_id,
      workflow_instance_id,
      channel,
      direction: 'outbound',
      status: 'pending',
      body,
      deduplication_key: dedup_key
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function sendSMS(to: string, body: string, messageSid?: string) {
  try {
    const message = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to
    })
    return message.sid
  } catch (error: any) {
    console.error('SMS send error:', error.message)
    throw error
  }
}

// Main new lead followup workflow
export async function handleNewLeadFollowup(
  account_id: string,
  contact_id: string,
  workflow_instance_id: string,
  step: number
) {
  console.log(`Running new_lead_followup step ${step} for contact ${contact_id}`)

  // Check DNC
  if (await isDNC(account_id, contact_id)) {
    console.log('Contact is DNC, stopping workflow')
    await supabase
      .from('workflow_instances')
      .update({ status: 'stopped', stopped_reason: 'dnc' })
      .eq('id', workflow_instance_id)
    return
  }

  // Check if workflow is still active
  const { data: instance } = await supabase
    .from('workflow_instances')
    .select('status')
    .eq('id', workflow_instance_id)
    .single()

  if (!instance || instance.status !== 'active') {
    console.log('Workflow no longer active, stopping')
    return
  }

  // Check working hours (skip in dev mode)
  if (process.env.NODE_ENV !== 'development') {
    const { allowed, msUntilOpen } = await isWithinWorkingHours(account_id)
    if (!allowed) {
      console.log(`Outside working hours, delaying ${msUntilOpen}ms`)
      await enqueueWorkflow({
        type: 'new_lead_followup',
        account_id,
        contact_id,
        workflow_instance_id,
        step
      }, msUntilOpen)
      return
    }
  }

  // Get contact info
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contact_id)
    .single()

  if (!contact) return

  // Get previous messages for context
  const { data: previousMessages } = await supabase
    .from('messages')
    .select('body')
    .eq('contact_id', contact_id)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: true })

  const previousBodies = previousMessages?.map(m => m.body) || []

  // Generate AI message
  const messageText = await generateSMS(
    {
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone: contact.phone,
      email: contact.email,
      source: contact.source,
      notes: contact.notes,
      lead_score: contact.lead_score,
      status: contact.status
    },
    {
      step,
      workflow_type: 'new_lead_followup',
      previous_messages: previousBodies
    }
  )

  const messages = [messageText, messageText, messageText]

  if (step >= messages.length) {
    await supabase
      .from('workflow_instances')
      .update({ status: 'completed', stopped_reason: 'sequence_complete' })
      .eq('id', workflow_instance_id)
    return
  }

  const dedup_key = `new_lead_${workflow_instance_id}_step_${step}`

  const message = await logMessage(
    account_id,
    contact_id,
    workflow_instance_id,
    'sms',
    messages[step],
    dedup_key
  )

  if (message && contact.phone) {
    try {
      const sid = await sendSMS(contact.phone, messages[step])
      await supabase
        .from('messages')
        .update({
          status: 'sent',
          twilio_sid: sid,
          delivered_at: new Date().toISOString()
        })
        .eq('id', message.id)

      await supabase
        .from('usage_counters')
        .upsert({
          account_id,
          month: new Date().toISOString().slice(0, 7),
          sms_sent: 1
        }, { onConflict: 'account_id,month' })

      console.log(`SMS sent to ${contact.phone}, SID: ${sid}`)
    } catch (smsError: any) {
      await supabase
        .from('messages')
        .update({ status: 'failed', failed_reason: smsError.message })
        .eq('id', message.id)
    }
  }

  // Log event
  await supabase.from('events').insert({
    account_id,
    contact_id,
    event_type: 'message_sent',
    payload: { step, channel: 'sms', workflow: 'new_lead_followup' }
  })

  // Update contact last contacted
  await supabase
    .from('contacts')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', contact_id)

  // Schedule next step
  const delays = [HOURS_24, HOURS_72]
  if (step < messages.length - 1) {
    await supabase
      .from('workflow_instances')
      .update({
        current_step: step + 1,
        next_step_at: new Date(Date.now() + delays[step]).toISOString()
      })
      .eq('id', workflow_instance_id)

    await enqueueWorkflow({
      type: 'new_lead_followup',
      account_id,
      contact_id,
      workflow_instance_id,
      step: step + 1
    }, delays[step])
  } else {
    await supabase
      .from('workflow_instances')
      .update({ status: 'completed', stopped_reason: 'sequence_complete' })
      .eq('id', workflow_instance_id)
  }

  console.log(`Step ${step} complete for contact ${contact.first_name}`)
}

// Hot lead scoring
export async function checkHotLead(account_id: string, contact_id: string) {
  const { data: recentEvents } = await supabase
    .from('events')
    .select('event_type, created_at')
    .eq('contact_id', contact_id)
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

  if (!recentEvents) return

  let score = 0
  for (const event of recentEvents) {
    if (event.event_type === 'email_opened') score += 1
    if (event.event_type === 'link_clicked') score += 3
    if (event.event_type === 'sms_reply') score += 10
    if (event.event_type === 'email_replied') score += 10
  }

  if (score >= 8) {
    await supabase
      .from('contacts')
      .update({ status: 'hot', lead_score: score })
      .eq('id', contact_id)

    // Get agent phone from account
    const { data: account } = await supabase
      .from('accounts')
      .select('owner_email')
      .eq('id', account_id)
      .single()

    // Get recent events for summary
    const { data: events } = await supabase
      .from('events')
      .select('event_type, created_at')
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single()

    if (contact && account) {
      await sendHotLeadAlert(
        process.env.AGENT_ALERT_PHONE!,
        contact,
        events || []
      )
    }

    await supabase.from('events').insert({
      account_id,
      contact_id,
      event_type: 'lead_became_hot',
      payload: { score }
    })
  }
}