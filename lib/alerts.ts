import twilio from 'twilio'
import { generateHotLeadSummary } from './ai'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export interface AlertContact {
  first_name: string
  last_name?: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  lead_score?: number
  status?: string
}

export async function sendHotLeadAlert(
  agentPhone: string,
  contact: AlertContact,
  recentEvents: { event_type: string, created_at: string }[]
) {
  try {
    // Generate AI summary of why this lead is hot
    const summary = await generateHotLeadSummary(contact, recentEvents)

    const alertMessage = `REALO ALERT: ${contact.first_name} ${contact.last_name || ''} is a hot lead!

${summary}

Reply or call them now: ${contact.phone || 'no phone on file'}`

    await twilioClient.messages.create({
      body: alertMessage,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: agentPhone
    })

    console.log(`Hot lead alert sent to agent at ${agentPhone}`)
  } catch (error: any) {
    console.error('Failed to send hot lead alert:', error.message)
  }
}