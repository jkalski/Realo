'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function Nav({ accountName }: { accountName?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Home' },
    { href: '/dashboard/contacts', label: 'Contacts' },
    { href: '/dashboard/settings', label: 'Settings' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-slate-900 tracking-tight text-base">realo</span>
              {accountName && (
                <span className="text-xs text-slate-400 hidden sm:inline border-l border-slate-200 pl-2.5">{accountName}</span>
              )}
            </div>

            {/* Desktop links */}
            <div className="hidden sm:flex items-center gap-1">
              {links.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                    isActive(link.href)
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <div className="w-px h-4 bg-slate-200 mx-2"/>
              <a
                href="/api/auth/signout"
                className="px-3 py-1.5 rounded-md text-sm text-rose-500 hover:bg-rose-50 transition-all"
              >
                Sign out
              </a>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="sm:hidden p-2 rounded-md hover:bg-slate-50"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-0.5 bg-slate-900 transition-all ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`}/>
                <span className={`block h-0.5 bg-slate-900 transition-all ${mobileOpen ? 'opacity-0' : ''}`}/>
                <span className={`block h-0.5 bg-slate-900 transition-all ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`}/>
              </div>
            </button>

          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-slate-100 px-4 py-3 space-y-1 bg-white">
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`block px-3 py-2.5 rounded-md text-sm transition-all ${
                  isActive(link.href)
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/api/auth/signout"
              className="block px-3 py-2.5 rounded-md text-sm text-rose-500 hover:bg-rose-50"
            >
              Sign out
            </a>
          </div>
        )}
      </nav>
    </>
  )
}
