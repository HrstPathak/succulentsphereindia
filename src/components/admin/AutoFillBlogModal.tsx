"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { X, RefreshCw, Check, Image as ImageIcon } from "lucide-react"
import { parseBlogContent, ParsedBlogContent } from "@/lib/blog-content-parser"

type Props = {
  open: boolean
  onClose: () => void
  initialHtml: string
  onAutoFill: (parsed: ParsedBlogContent, applyHero: boolean) => void
}

export default function AutoFillBlogModal({ open, onClose, initialHtml, onAutoFill }: Props) {
  const [html, setHtml] = useState(initialHtml)
  const [parsed, setParsed] = useState<ParsedBlogContent | null>(null)
  const [applyHero, setApplyHero] = useState(false)
  const [parsing, setParsing] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousActive = useRef<HTMLElement | null>(null)
  // Tracks the cover image we last auto-applied, so re-parsing while the author
  // keeps typing doesn't undo a manual "Use as cover image" toggle.
  const lastHeroRef = useRef<string>("")

  useEffect(() => { if (open) setHtml(initialHtml) }, [open, initialHtml])

  const doParse = useCallback(() => {
    setParsing(true)
    const r = parseBlogContent(html)
    setParsed(r)
    // A newly detected cover image is applied by default; the author can
    // uncheck it to keep the blog's current cover.
    const hero = r.heroImage || ""
    if (hero !== lastHeroRef.current) {
      lastHeroRef.current = hero
      setApplyHero(Boolean(hero))
    }
    setParsing(false)
  }, [html])

  useEffect(() => { if (open && html) doParse() }, [open, html, doParse])

  useEffect(() => {
    if (!open) return
    previousActive.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    // Freeze the page behind the modal so tall content scrolls inside the
    // panel instead of pushing the modal past the viewport.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    function onDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      const c = panelRef.current; if (!c) return
      const els = c.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
      const list = Array.from(els).filter((el) => el.offsetParent !== null || el.tabIndex >= 0)
      if (!list.length) return
      const first = list[0]!, last = list[list.length - 1]!
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey); document.addEventListener("keydown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("keydown", onDown); document.body.style.overflow = previousOverflow; previousActive.current?.focus() }
  }, [open, onClose])

  const handleClose = useCallback(() => onClose(), [onClose])
  const handleSubmit = useCallback(() => { if (!parsed) return; onAutoFill(parsed, applyHero); onClose() }, [parsed, applyHero, onAutoFill, onClose])

  if (!open) return null
  const hasAny = parsed && (parsed.title || parsed.excerpt || parsed.seoTitle || parsed.seoDescription || parsed.tags.length > 0)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={handleClose} role="presentation">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" aria-hidden="true" />
      <div ref={panelRef} className="relative z-[10000] flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl" onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#eef2ee] bg-[#f8fbf7] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#68776d]">Auto-fill from content</span>
            {parsed && parsed.hadMetadata && (<span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4e8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#256b3a]"><Check size={8} /> Detected</span>)}
          </div>
          <button type="button" onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#68776d] transition hover:bg-white hover:text-[#24563e]"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-6">
          <div className="mb-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#78887d]">Paste HTML with metadata comments</label>
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} onBlur={doParse} rows={8} className="w-full resize-y rounded-xl border border-[#d7e0d9] bg-white px-3 py-2.5 text-sm font-mono leading-relaxed outline-none ring-[#6f9878] transition focus:border-[#6f9878] focus:ring-2" placeholder="Paste the HTML blob here…"/>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-[#718076]">Supports <code className="rounded bg-[#f0f4f0] px-1 py-0.5 text-[10px] font-mono">&lt;!-- Key : value --&gt;</code> and <code className="rounded bg-[#f0f4f0] px-1 py-0.5 text-[10px] font-mono">//Key : value</code> comments.</p>
              <button type="button" onClick={doParse} disabled={parsing || !html} className="inline-flex items-center gap-1.5 rounded-full bg-[#24563e] px-3 py-1.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#1f4a35]">{parsing ? (<><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Parsing…</>) : (<><RefreshCw size={11} />Re-parse</>)}</button>
            </div>
          </div>
          {parsed && !hasAny && (
            <div className="mb-5 rounded-xl border border-dashed border-[#d7e0d9] bg-[#fafbf9] p-4">
              <p className="text-sm font-semibold text-[#68776d]">No metadata detected</p>
              <p className="mt-1 text-xs text-[#718076]">Add comments like <code className="rounded bg-[#eef2ee] px-1 py-0.5 text-[10px] font-mono">&lt;!-- Title : My title --&gt;</code> at the top of your HTML, then click Re-parse.</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono text-[#68776d]">{["Title","Excerpt","SEO title","SEO description","Tags","Hero image"].map((k) => (<span key={k} className="rounded bg-white border border-[#e0e7e1] px-2 py-1">{"<!-- "}<span className="text-[#24563e]">{k}</span> : value{" "}{"-->"}</span>))}</div>
            </div>
          )}
          {parsed && hasAny && (<div className="space-y-4">
            <Pv label="Title" value={parsed.title} empty="Not detected — the article title will stay as you typed it." />
            <Pv label="Excerpt" value={parsed.excerpt} empty="Not detected — the excerpt will stay as you typed it." />
            <Pv label="SEO title" value={parsed.seoTitle} empty="Not detected — falls back to the title above." />
            <Pv label="SEO description" value={parsed.seoDescription} empty="Not detected — falls back to the excerpt above." />
            <Pv label="Tags" value={parsed.tags.length > 0 ? parsed.tags.join(", ") : ""} empty="No tags detected." />
            {parsed.heroImage && (<div className="rounded-xl border border-[#d7e0d9] bg-[#fafbf9] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#78887d]"><ImageIcon size={12} className="mr-1.5 inline" />Suggested cover image</p><p className="mt-1 truncate text-sm text-[#44584c] font-mono">{parsed.heroImage}</p><p className="mt-1 text-[11px] text-[#718076]">Detected from an <code className="rounded bg-white px-1 py-0.5 text-[10px]">&lt;img&gt;</code> in the body — applied as the cover image unless you uncheck below. The image must be a public <code className="rounded bg-white px-1 py-0.5 text-[10px]">http(s)</code> URL.</p></div><label className="shrink-0 cursor-pointer rounded-xl border border-[#d7e0d9] bg-white px-3 py-2 text-xs font-bold text-[#44584c] transition hover:border-[#24563e] hover:text-[#24563e]"><input type="checkbox" checked={applyHero} onChange={(e) => setApplyHero(e.target.checked)} className="sr-only" /><span className="inline-flex items-center gap-1.5">{applyHero ? <Check size={12} className="text-[#24563e]" /> : <span className="h-3 w-3 rounded border border-[#9aa89c]" />}Use as cover image</span></label></div></div>)}
            <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#78887d]">Cleaned body HTML (metadata stripped)</p><div className="rounded-xl border border-[#d7e0d9] bg-[#fafbf9] p-3"><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs font-mono text-[#44584c] leading-relaxed">{parsed.contentHtml}</pre></div></div>
          </div>)}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#eef2ee] bg-[#f8fbf7] px-6 py-4">
          <button type="button" onClick={handleClose} className="rounded-xl border border-[#d7e0d9] bg-white px-5 py-2.5 text-sm font-bold text-[#44584c] transition hover:border-[#24563e] hover:text-[#24563e]">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={!hasAny} className="rounded-xl bg-[#24563e] px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#1f4a35]">Submit &amp; fill form</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Pv({ label, value, empty }: { label: string; value: string; empty: string }) {
  const present = value.trim().length > 0
  return (<div className="rounded-xl border border-[#d7e0d9] bg-[#fafbf9] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#78887d]">{label}</p>{present ? (<p className="mt-1.5 text-sm text-[#243129] font-medium leading-relaxed break-words">{value}</p>) : (<p className="mt-1.5 text-xs text-[#9aa89c] italic">{empty}</p>)}</div>)
}
