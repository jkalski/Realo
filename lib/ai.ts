import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export interface ContactContext {
  first_name: string
  last_name?: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  last_contacted_at?: string
  lead_score?: number
  status?: string
}

export interface MessageContext {
  agent_name?: string
  step: number
  workflow_type: 'new_lead_followup' | 'reengage_stale' | 'birthday' | 'life_event'
  previous_messages?: string[]
}

export async function generateSMS(
  contact: ContactContext,
  context: MessageContext
): Promise<string> {

  const stepDescriptions = {
    new_lead_followup: [
      'first contact with a new lead, warm and welcoming, curious about their needs',
      'second follow up, they have not responded yet, still friendly not pushy',
      'final follow up, last attempt, no pressure, leave the door open'
    ],
    reengage_stale: [
      'reconnecting with someone you have not spoken to in a while, casual and genuine'
    ],
    birthday: [
      'wishing them a happy birthday, warm and personal, do not mention real estate unless it feels natural'
    ],
    life_event: [
      'reaching out because of a life event you noticed, warm and congratulatory'
    ]
  }

  const stepDesc = stepDescriptions[context.workflow_type]?.[context.step] || 
    'following up with a real estate lead'

  const previousContext = context.previous_messages?.length 
    ? `Previous messages sent to this person:\n${context.previous_messages.join('\n')}\n\n`
    : ''

  const prompt = `You are writing an SMS message on behalf of a real estate agent named ${context.agent_name || 'the agent'}.

Contact info:
- Name: ${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}
- How they found us: ${contact.source || 'unknown source'}
${contact.notes ? `- Notes: ${contact.notes}` : ''}

${previousContext}

Your job: Write a single SMS message for this situation: ${stepDesc}

Rules:
- Sound like a real human texting, not a marketing email
- Maximum 2 sentences
- Use their first name once at the start
- Do not use exclamation points more than once
- Do not mention being an AI or automated system
- Do not use emojis
- Do not include a subject line
- Just write the message text, nothing else

Write the SMS now:`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' 
    ? response.content[0].text.trim()
    : ''

  return text
}

export async function generateHotLeadSummary(
  contact: ContactContext,
  recentEvents: { event_type: string, created_at: string }[]
): Promise<string> {

  const eventSummary = recentEvents
    .map(e => `- ${e.event_type} at ${new Date(e.created_at).toLocaleString()}`)
    .join('\n')

  const prompt = `A real estate lead just became hot based on their recent activity. Write a 2-3 sentence summary for the agent so they know exactly what happened and why this person is worth calling right now.

Contact: ${contact.first_name} ${contact.last_name || ''}
Source: ${contact.source || 'unknown'}
Recent activity:
${eventSummary}

Write a brief, direct summary for the agent. No fluff. Just what happened and why they should call now.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : ''

  return text
}