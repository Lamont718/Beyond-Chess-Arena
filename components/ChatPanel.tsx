'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string; emoji: string; role: string };
  mine: boolean;
}

export default function ChatPanel({
  scope,
  title = 'Chat',
  heightClass = 'h-80',
}: {
  scope: string;
  title?: string;
  heightClass?: string;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?scope=${encodeURIComponent(scope)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      setMessages(d.messages);
      setCanModerate(d.canModerate);
    } catch {
      /* transient */
    }
  }, [scope]);

  useEffect(() => {
    poll();
    const i = setInterval(poll, 2500);
    return () => clearInterval(i);
  }, [poll]);

  // Keep pinned to the newest message unless the user has scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    atBottomRef.current = true;
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, text: t }),
      });
      await poll();
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    setMessages((m) => m.filter((x) => x.id !== id));
    await fetch(`/api/chat/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-primary" /> {title}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className={cn('space-y-2 overflow-y-auto px-3 py-3', heightClass)}>
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Say hi! 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('group flex items-start gap-2', m.mine && 'flex-row-reverse')}>
              <span className="mt-0.5 text-lg" title={m.user.displayName}>
                {m.user.emoji}
              </span>
              <div className={cn('max-w-[78%] rounded-2xl px-3 py-1.5', m.mine ? 'bg-primary/20' : 'bg-muted')}>
                <div className={cn('flex items-center gap-1.5', m.mine && 'flex-row-reverse')}>
                  <span className="text-xs font-semibold text-foreground">{m.user.displayName}</span>
                  {m.user.role === 'COACH' && (
                    <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-400">COACH</span>
                  )}
                  {(m.mine || canModerate) && (
                    <button
                      onClick={() => remove(m.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete message"
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-rose-400" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{m.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
