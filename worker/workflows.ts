import { createClient } from '@supabase/supabase-js'
import { enqueueWorkflow, enqueueAlert } from './queue'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

  // Check working hours
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

  // Get contact info
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contact_id)
    .single()

  if (!contact) return

  // Message templates per step
  const messages = [
    `Hi ${contact.first_name}! I saw you were interested in finding a property. I'd love to help — when's a good time to chat?`,
    `Hey ${contact.first_name}, just following up! I have some great listings that might be perfect for you. Interested in taking a look?`,
    `Hi ${contact.first_name}, last follow up from me — if you're still looking for a property I'm here to help anytime. No pressure!`
  ]

  if (step >= messages.length) {
    await supabase
      .from('workflow_instances')
      .update({ status: 'completed', stopped_reason: 'sequence_complete' })
      .eq('id', workflow_instance_id)
    return
  }

  const dedup_key = `new_lead_${workflow_instance_id}_step_${step}`
  
  // Log the message (actual SMS sending comes when Twilio is connected)
  await logMessage(
    account_id,
    contact_id,
    workflow_instance_id,
    'sms',
    messages[step],
    dedup_key
  )

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
    // Update contact to hot
    await supabase
      .from('contacts')
      .update({ status: 'hot', lead_score: score })
      .eq('id', contact_id)

    // Fire alert
    await enqueueAlert({
      type: 'hot_lead_alert',
      account_id,
      contact_id
    })

    await supabase.from('events').insert({
      account_id,
      contact_id,
      event_type: 'lead_became_hot',
      payload: { score }
    })
  }
}