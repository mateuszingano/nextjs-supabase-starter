'use client'

import { useState } from 'react'

export type Note = {
  id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

const inputCls =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-800'
const cardCls = 'rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900'

export function NotesClient({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function createNote(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) return setError(json.error ?? 'Failed to create note')
    setNotes([json.note, ...notes])
    setTitle('')
    setBody('')
  }

  async function saveEdit(id: string) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) return setError(json.error ?? 'Failed to save note')
    setNotes(notes.map((n) => (n.id === id ? json.note : n)))
    setEditingId(null)
  }

  async function deleteNote(id: string) {
    setError(null)
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? 'Failed to delete note')
      return
    }
    setNotes(notes.filter((n) => n.id !== id))
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Notes</h1>
        <form onSubmit={createNote} className={`space-y-3 ${cardCls}`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Title"
            className={inputCls}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write something…"
            rows={3}
            className={inputCls}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={busy}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Add note'}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-neutral-500">No notes yet. Create your first one above.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className={cardCls}>
            {editingId === n.id ? (
              <div className="space-y-2">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputCls} />
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} className={inputCls} />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(n.id)}
                    disabled={busy}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-medium text-neutral-900 dark:text-neutral-100">{n.title}</h2>
                  <div className="flex shrink-0 items-center gap-3 text-sm text-neutral-500">
                    {confirmingId === n.id ? (
                      <>
                        <span>Delete?</span>
                        <button
                          onClick={() => {
                            setConfirmingId(null)
                            deleteNote(n.id)
                          }}
                          className="font-medium text-red-600 hover:text-red-700"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="hover:text-neutral-900 dark:hover:text-neutral-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(n.id)
                            setEditTitle(n.title)
                            setEditBody(n.body)
                          }}
                          aria-label={`Edit note: ${n.title}`}
                          className="hover:text-neutral-900 dark:hover:text-neutral-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmingId(n.id)}
                          aria-label={`Delete note: ${n.title}`}
                          className="hover:text-red-600"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {n.body && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">{n.body}</p>
                )}
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
