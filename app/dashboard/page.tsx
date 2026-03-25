import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: hotLeads } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'hot')
    .order('lead_score', { ascending: false })
    .limit(10)

  const { data: needsAttention } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'active')
    .not('last_replied_at', 'is', null)
    .order('last_replied_at', { ascending: false })
    .limit(10)

  const { data: recentEvents } = await supabase
    .from('events')
    .select('*, contacts(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(20)

  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  const { count: activeWorkflows } = await supabase
    .from('workflow_instances')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: hotCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'hot')

  const eventLabels: Record<string, { label: string, color: string }> = {
    lead_became_hot: { label: 'became a hot lead', color: 'bg-amber-400' },
    sms_reply: { label: 'replied via SMS', color: 'bg-emerald-400' },
    message_sent: { label: 'was contacted by Realo', color: 'bg-indigo-400' },
    lead_created: { label: 'was added as a new lead', color: 'bg-violet-400' },
    sms_opt_out: { label: 'opted out', color: 'bg-rose-400' },
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
          Overview
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Here's what Realo has been doing for you.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4 sm:p-5">
          <p className="text-xs text-slate-400 mb-1">Contacts</p>
          <p className="text-2xl sm:text-3xl font-semibold text-slate-900">{totalContacts ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4 sm:p-5">
          <p className="text-xs text-slate-400 mb-1">Active</p>
          <p className="text-2xl sm:text-3xl font-semibold text-slate-900">{activeWorkflows ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-amber-100 shadow-sm p-4 sm:p-5">
          <p className="text-xs text-amber-500 mb-1">Hot leads</p>
          <p className="text-2xl sm:text-3xl font-semibold text-amber-500">{hotCount ?? 0}</p>
        </div>
      </div>

      {/* Hot leads + Needs attention */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

        {/* Hot leads */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Hot leads</h2>
              <p className="text-xs text-slate-400 mt-0.5">Ready for you to take over</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>
          </div>
          {hotLeads && hotLeads.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {hotLeads.map(contact => (
                <a
                  key={contact.id}
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-amber-600">
                        {contact.first_name[0]}{contact.last_name?.[0] || ''}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-xs text-slate-400">{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                      {contact.lead_score}pt
                    </span>
                    <span className="text-slate-300">›</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">No hot leads yet</p>
              <p className="text-xs text-slate-300 mt-1">They'll appear here when leads engage</p>
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
              <p className="text-xs text-slate-400 mt-0.5">Replied but waiting on you</p>
            </div>
            {needsAttention && needsAttention.length > 0 && (
              <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                {needsAttention.length}
              </span>
            )}
          </div>
          {needsAttention && needsAttention.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {needsAttention.map(contact => (
                <a
                  key={contact.id}
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-indigo-600">
                        {contact.first_name[0]}{contact.last_name?.[0] || ''}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Replied {new Date(contact.last_replied_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-300">›</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">All caught up</p>
              <p className="text-xs text-slate-300 mt-1">No leads waiting on a response</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
          <p className="text-xs text-slate-400 mt-0.5">Everything Realo has done recently</p>
        </div>
        {recentEvents && recentEvents.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {recentEvents.map(event => {
              const meta = eventLabels[event.event_type] || {
                label: event.event_type.replace(/_/g, ' '),
                color: 'bg-slate-300'
              }
              return (
                <div key={event.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.color}`}/>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-slate-900">
                        {event.contacts?.first_name} {event.contacts?.last_name}
                      </span>
                      {' '}{meta.label}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0 ml-4">
                    {new Date(event.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-400">No activity yet</p>
            <p className="text-xs text-slate-300 mt-1">
              Send your first lead through the webhook to see Realo in action
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
