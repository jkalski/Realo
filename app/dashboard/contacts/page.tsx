import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ContactsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Contacts</h1>
            <p className="text-slate-400 mt-1 text-sm">{contacts?.length ?? 0} total</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          {contacts && contacts.length > 0 ? (
            <>
              {/* Mobile: card list */}
              <div className="sm:hidden divide-y divide-slate-50">
                {contacts.map(contact => (
                  <a
                    key={contact.id}
                    href={`/dashboard/contacts/${contact.id}`}
                    className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-500">
                          {contact.first_name[0]}{contact.last_name?.[0] || ''}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{contact.phone ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        contact.status === 'hot' ? 'bg-amber-50 text-amber-600' :
                        contact.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                        contact.status === 'opted_out' ? 'bg-rose-50 text-rose-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {contact.status}
                      </span>
                      <span className="text-slate-300">›</span>
                    </div>
                  </a>
                ))}
              </div>

              {/* Desktop: table */}
              <table className="hidden sm:table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Phone</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Source</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Score</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(contact => (
                    <tr key={contact.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <a
                          href={`/dashboard/contacts/${contact.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {contact.first_name} {contact.last_name}
                        </a>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-400">{contact.phone ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-400 capitalize">{contact.source ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          contact.status === 'hot' ? 'bg-amber-50 text-amber-600' :
                          contact.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                          contact.status === 'opted_out' ? 'bg-rose-50 text-rose-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-400">{contact.lead_score}</td>
                      <td className="px-5 py-3 text-sm text-slate-400">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-slate-400">No contacts yet</p>
              <p className="text-xs text-slate-300 mt-1">Contacts will appear here when leads come in</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
