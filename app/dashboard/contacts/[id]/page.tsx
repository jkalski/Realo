import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contact) redirect('/dashboard')

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: true })

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: workflow } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a href="/dashboard/contacts" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                Contacts
              </a>
              <span className="text-slate-300 text-xs">/</span>
              <span className="text-xs text-slate-600">{contact.first_name} {contact.last_name}</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {contact.first_name} {contact.last_name}
            </h1>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            contact.status === 'hot' ? 'bg-amber-50 text-amber-600' :
            contact.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
            contact.status === 'opted_out' ? 'bg-rose-50 text-rose-600' :
            'bg-slate-100 text-slate-500'
          }`}>
            {contact.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">

          {/* Left: Contact info — shown below conversation on mobile */}
          <div className="col-span-1 space-y-4 order-2 sm:order-1">

            {/* Contact details */}
            <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Details</h2>
              <div className="space-y-3">
                {contact.phone && (
                  <div>
                    <p className="text-xs text-slate-400">Phone</p>
                    <a href={`tel:${contact.phone}`} className="text-sm text-indigo-600 hover:underline mt-0.5 block">
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.email && (
                  <div>
                    <p className="text-xs text-slate-400">Email</p>
                    <a href={`mailto:${contact.email}`} className="text-sm text-indigo-600 hover:underline mt-0.5 block">
                      {contact.email}
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400">Source</p>
                  <p className="text-sm text-slate-700 capitalize mt-0.5">{contact.source || 'unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Lead score</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{contact.lead_score}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Added</p>
                  <p className="text-sm text-slate-700 mt-0.5">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </p>
                </div>
                {contact.notes && (
                  <div>
                    <p className="text-xs text-slate-400">Notes</p>
                    <p className="text-sm text-slate-700 mt-0.5">{contact.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick actions */}
            {contact.phone && (
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Actions</h2>
                <div className="space-y-2">
                  <a
                    href={`tel:${contact.phone}`}
                    className="block w-full text-center bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Call {contact.first_name}
                  </a>
                  <a
                    href={`sms:${contact.phone}`}
                    className="block w-full text-center border border-slate-200 text-slate-700 text-sm px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Text {contact.first_name}
                  </a>
                </div>
              </div>
            )}

            {/* Workflow status */}
            {workflow && (
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Workflow</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400">Type</p>
                    <p className="text-sm text-slate-700 mt-0.5">{workflow.workflow_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                      workflow.status === 'active' ? 'bg-indigo-50 text-indigo-600' :
                      workflow.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {workflow.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Step</p>
                    <p className="text-sm text-slate-700 mt-0.5">{workflow.current_step + 1} of 3</p>
                  </div>
                  {workflow.stopped_reason && (
                    <div>
                      <p className="text-xs text-slate-400">Stopped reason</p>
                      <p className="text-sm text-slate-700 mt-0.5">{workflow.stopped_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Conversation — shown first on mobile */}
          <div className="col-span-1 sm:col-span-2 order-1 sm:order-2">
            <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
                <p className="text-xs text-slate-400 mt-0.5">Full message history</p>
              </div>

              {messages && messages.length > 0 ? (
                <div className="p-5 space-y-3">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] sm:max-w-sm rounded-lg px-4 py-3 ${
                        message.direction === 'outbound'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.body}</p>
                        <div className={`flex items-center justify-between mt-1.5 gap-4 ${
                          message.direction === 'outbound' ? 'text-slate-400' : 'text-slate-400'
                        }`}>
                          <p className="text-xs">
                            {new Date(message.created_at).toLocaleDateString()} {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {message.direction === 'outbound' && (
                            <p className="text-xs capitalize">{message.status}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-16 text-center">
                  <p className="text-sm text-slate-400">No messages yet</p>
                  <p className="text-xs text-slate-300 mt-1">Messages will appear here once Realo starts outreach</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
