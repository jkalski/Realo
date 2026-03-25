import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .single()

  const { data: dncList } = await supabase
    .from('dnc_list')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage your account and preferences</p>
        </div>

        {/* Account */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Account</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Account name</p>
              <p className="text-sm text-slate-900 mt-0.5">{account?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Owner email</p>
              <p className="text-sm text-slate-900 mt-0.5">{account?.owner_email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Plan</p>
              <p className="text-sm text-slate-900 mt-0.5 capitalize">{account?.subscription_tier}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Trial ends</p>
              <p className="text-sm text-slate-900 mt-0.5">
                {account?.trial_ends_at
                  ? new Date(account.trial_ends_at).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Working hours */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Working hours</h2>
          <p className="text-xs text-slate-400 mb-4">
            Realo will only send messages during these hours
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Start</p>
              <div className="border border-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700 bg-slate-50">
                {account?.working_hours_start}:00 ({account?.working_hours_start < 12 ? 'AM' : 'PM'})
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">End</p>
              <div className="border border-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700 bg-slate-50">
                {account?.working_hours_end}:00 ({account?.working_hours_end < 12 ? 'AM' : 'PM'})
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Currently set to {account?.working_hours_start}am – {account?.working_hours_end - 12}pm {account?.timezone}. Contact support to update.
          </p>
        </div>

        {/* Cadence */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Follow-up cadence</h2>
          <p className="text-xs text-slate-400 mb-4">
            How aggressively Realo follows up with new leads
          </p>
          <div className="space-y-2">
            <div className={`border rounded-lg px-4 py-3 transition-colors ${
              account?.cadence_preset === 'conservative'
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-slate-100'
            }`}>
              <p className="text-sm font-medium text-slate-900">Conservative</p>
              <p className="text-xs text-slate-400 mt-0.5">SMS now, follow up at 24h, final at 72h</p>
            </div>
            <div className={`border rounded-lg px-4 py-3 transition-colors ${
              account?.cadence_preset === 'standard'
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-slate-100'
            }`}>
              <p className="text-sm font-medium text-slate-900">Standard</p>
              <p className="text-xs text-slate-400 mt-0.5">SMS now, follow up at 12h, 24h, and 72h</p>
            </div>
          </div>
        </div>

        {/* Alert phone */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Hot lead alerts</h2>
          <p className="text-xs text-slate-400 mb-4">
            Realo will text this number when a lead becomes hot
          </p>
          <div className="border border-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700 bg-slate-50">
            {process.env.NEXT_PUBLIC_AGENT_ALERT_PHONE || 'Not configured'}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Update AGENT_ALERT_PHONE in your environment to change this.
          </p>
        </div>

        {/* DNC List */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Do not contact</h2>
          <p className="text-xs text-slate-400 mb-4">
            These contacts will never receive messages from Realo
          </p>
          {dncList && dncList.length > 0 ? (
            <div className="space-y-2">
              {dncList.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-slate-900">{entry.phone || entry.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{entry.reason}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-lg px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No contacts on DNC list</p>
              <p className="text-xs text-slate-300 mt-1">Contacts who reply STOP are added here automatically</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
