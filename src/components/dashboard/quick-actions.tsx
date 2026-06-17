'use client';

import Link from 'next/link';
import { Bot, BookOpen, MessageSquare, Package } from 'lucide-react';
import type { ComponentType } from 'react';

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tint: string;
}

const ACTIONS: Action[] = [
  {
    label: 'Conversations',
    href: '/inbox',
    icon: MessageSquare,
    tint: 'text-primary',
  },
  {
    label: 'Products & Services',
    href: '/products',
    icon: Package,
    tint: 'text-blue-400',
  },
  {
    label: 'FAQs / Knowledge',
    href: '/knowledge',
    icon: BookOpen,
    tint: 'text-amber-400',
  },
  {
    label: 'Test Bot Reply',
    href: '/ai-test',
    icon: Bot,
    tint: 'text-primary',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-800/60"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 ${a.tint}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-white">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
