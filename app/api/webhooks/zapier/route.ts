import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { enqueueWorkflow } from '@/worker/queue'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-realo-secret')
    if (authHeader !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const {
      account_id,
      first_name,
      last_name,
      email,
      phone,
      source = 'zapier',
      notes
    } = body

    if (!account_id || !first_name) {
      return NextResponse.json(
        { error: 'account_id and first_name are required' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('account_id', account_id)
      .or(`email.eq.${email},phone.eq.${phone}`)
      .maybeSingle()

    let contact

    if (existing) {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          first_name,
          last_name,
          email,
          phone,
          source,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      contact = data
    } else {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          account_id,
          first_name,
          last_name,
          email,
          phone,
          source,
          notes,
          status: 'new'
        })
        .select()
        .single()

      if (error) throw error
      contact = data
    }

    await supabase.from('events').insert({
      account_id,
      contact_id: contact.id,
      event_type: existing ? 'lead_updated' : 'lead_created',
      payload: { source, original_payload: body }
    })

    if (!existing) {
      const { data: workflowInstance, error: wfError } = await supabase
        .from('workflow_instances')
        .insert({
          account_id,
          contact_id: contact.id,
          workflow_type: 'new_lead_followup',
          status: 'active',
          current_step: 0,
          next_step_at: new Date().toISOString()
        })
        .select()
        .single()

      if (wfError) throw wfError

      await enqueueWorkflow({
        type: 'new_lead_followup',
        account_id,
        contact_id: contact.id,
        workflow_instance_id: workflowInstance.id,
        step: 0
      })
    }

    return NextResponse.json({
      success: true,
      contact_id: contact.id,
      action: existing ? 'updated' : 'created'
    })

  } catch (error: any) {
    console.error('Zapier webhook error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}