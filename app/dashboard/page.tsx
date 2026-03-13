import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Realo</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <a
              href="/api/auth/signout"
              className="text-sm text-red-500 hover:underline"
            >
              Sign out
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total contacts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {contacts?.length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Active workflows</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Hot leads</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">0</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Plan</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 capitalize">
              {account?.subscription_tier ?? 'free'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Contacts</h2>
            <a
              href="/dashboard/contacts/new"
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Add contact
            </a>
          </div>

          {contacts && contacts.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Phone</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Score</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(contact => (
                  <tr key={contact.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      <a href={`/dashboard/contacts/${contact.id}`} className="hover:text-blue-600">
                        {contact.first_name} {contact.last_name}
                      </a>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{contact.phone ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{contact.email ?? '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        contact.status === 'hot' ? 'bg-orange-100 text-orange-700' :
                        contact.status === 'active' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{contact.lead_score}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-400 text-sm">No contacts yet.</p>
              <p className="text-gray-400 text-sm mt-1">
                Add one manually or connect Zapier to start importing leads.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}