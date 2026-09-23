"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "react-toastify"
import { Check, Copy, Loader2, Pencil, RotateCcw, Save, Sparkles, X } from "lucide-react"

type PromptRecord = {
  content: string
  isDefault: boolean
  updatedAt: string
  updatedBy: string
}

function formatStamp(value: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Clipboard write with a fallback for contexts where the async API is missing. */
async function writeToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const helper = document.createElement("textarea")
  helper.value = text
  helper.setAttribute("readonly", "")
  helper.style.position = "fixed"
  helper.style.top = "-1000px"
  document.body.appendChild(helper)
  helper.select()
  const copied = document.execCommand("copy")
  document.body.removeChild(helper)
  if (!copied) throw new Error("copy-failed")
}

/**
 * The "Blog Post Generation Prompt" master template: view, copy and edit it.
 * The template lives in Firestore (blogSettings/prompt) so an edit applies to
 * every admin immediately.
 */
export default function BlogPromptModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [content, setContent] = useState("")
  const [draft, setDraft] = useState("")
  const [meta, setMeta] = useState({ isDefault: true, updatedAt: "", updatedBy: "" })
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousActive = useRef<HTMLElement | null>(null)

  const applyPrompt = useCallback((prompt: PromptRecord) => {
    setContent(prompt.content)
    setDraft(prompt.content)
    setMeta({ isDefault: prompt.isDefault, updatedAt: prompt.updatedAt, updatedBy: prompt.updatedBy })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/blog-prompt")
      const json = await res.json()
      if (json.ok) applyPrompt(json.prompt)
      else toast.error(json.error || "Could not load the prompt")
    } catch {
      toast.error("Could not load the prompt")
    } finally {
      setLoading(false)
    }
  }, [applyPrompt])

  useEffect(() => {
    if (!open) return
    setEditing(false)
    setCopied(false)
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    previousActive.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    // Freeze the page behind the modal so long prompt text scrolls inside.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null || el.tabIndex >= 0)
      if (!focusable.length) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("keydown", onTab)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("keydown", onTab)
      document.body.style.overflow = previousOverflow
      previousActive.current?.focus()
    }
  }, [open, onClose])
  async function handleCopy() {
    try {
      await writeToClipboard(editing ? draft : content)
      setCopied(true)
      toast.success("Prompt copied to clipboard")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy automatically — select the text and press Ctrl+C.")
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/blog-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      })
      const json = await res.json()
      if (json.ok) {
        applyPrompt(json.prompt)
        setEditing(false)
        toast.success("Prompt saved — every admin now sees this version")
      } else {
        toast.error(json.error || "Could not save the prompt")
      }
    } catch {
      toast.error("Could not save the prompt")
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!window.confirm("Restore the shipped master template? Your edits will be replaced.")) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/blog-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      })
      const json = await res.json()
      if (json.ok) {
        applyPrompt(json.prompt)
        setEditing(false)
        toast.success("Master template restored")
      } else {
        toast.error(json.error || "Could not restore the template")
      }
    } catch {
      toast.error("Could not restore the template")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const busy = loading || saving
  const stamp = formatStamp(meta.updatedAt)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" aria-hidden="true" />
      <div ref={panelRef} className="relative z-[10000] flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl" onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eef2ee] bg-[#f8fbf7] px-6 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#68776d]">
              <Sparkles size={12} /> Prompt
            </p>
            <h2 className="mt-1 font-serif text-xl text-[#173c2d]">Blog Post Generation Prompt</h2>
            <p className="mt-0.5 text-[11px] text-[#718076]">
              Master template for every new post — copy it, or edit it here and the change is saved for the whole team.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close prompt" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#68776d] transition hover:bg-white hover:text-[#24563e]"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-[#68776d]">
              <Loader2 size={18} className="animate-spin text-[#24563e]" />
              <span className="text-sm font-medium">Loading prompt…</span>
            </div>
          ) : editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label="Blog post generation prompt"
              className="h-[58vh] min-h-[280px] w-full resize-y rounded-xl border border-[#d7e0d9] bg-white p-4 font-mono text-xs leading-relaxed outline-none ring-[#6f9878] transition focus:border-[#6f9878] focus:ring-2"
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-[#d7e0d9] bg-[#fafbf9] p-4 font-mono text-xs leading-relaxed text-[#33463b]">{content}</pre>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#eef2ee] bg-[#f8fbf7] px-6 py-4">
          <p className="text-[11px] font-semibold text-[#718076]">
            {editing
              ? `${draft.length.toLocaleString("en-IN")} characters`
              : meta.isDefault
                ? "Shipped master template"
                : meta.updatedBy
                  ? `Last edited ${stamp || "recently"} by ${meta.updatedBy}`
                  : `Last edited ${stamp || "recently"}`}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!meta.isDefault ? (
              <button type="button" onClick={() => void handleReset()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-[#f0e2e2] bg-white px-3.5 py-2.5 text-xs font-bold text-[#b3574e] transition hover:bg-[#fdf4f3] disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw size={12} /> Restore default
              </button>
            ) : null}
            <button type="button" onClick={() => void handleCopy()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e0d9] bg-white px-4 py-2.5 text-sm font-bold text-[#44584c] transition hover:border-[#24563e] hover:text-[#24563e] disabled:cursor-not-allowed disabled:opacity-50">
              {copied ? <Check size={14} className="text-[#256b3a]" /> : <Copy size={14} />} {copied ? "Copied" : "Copy prompt"}
            </button>
            {editing ? (
              <>
                <button type="button" onClick={() => { setDraft(content); setEditing(false) }} disabled={busy} className="rounded-xl border border-[#d7e0d9] bg-white px-4 py-2.5 text-sm font-bold text-[#44584c] transition hover:border-[#24563e] hover:text-[#24563e] disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void handleSave()} disabled={busy || !draft.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#24563e] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f4a35] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} className="rounded-xl border border-[#d7e0d9] bg-white px-4 py-2.5 text-sm font-bold text-[#44584c] transition hover:border-[#24563e] hover:text-[#24563e]">Close</button>
                <button type="button" onClick={() => setEditing(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#24563e] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f4a35] disabled:cursor-not-allowed disabled:opacity-50">
                  <Pencil size={14} /> Edit prompt
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
