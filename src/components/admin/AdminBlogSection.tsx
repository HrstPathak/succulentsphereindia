"use client"

import { ComponentType, useEffect, useMemo, useState } from "react"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { MAX_PINNED_ARTICLES, comparePinnedOrder } from "@/lib/article-pinning"
import AdminArticleEditor from "./AdminArticleEditor"
import BlogPromptModal from "./BlogPromptModal"

type Article = {
  id: string
  title: string
  handle: string
  status: string
  updatedAt: string
  pinned?: boolean
  pinnedOrder?: number
  pinnedAt?: string
  image?: { url: string; altText?: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const published = status === "published"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${published ? "bg-[#e6f4e8] text-[#256b3a]" : "bg-[#faf0e0] text-[#96691f]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-[#256b3a]" : "bg-[#96691f]"}`} />
      {published ? "Published" : "Draft"}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  value: number
  tint: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/90 bg-white p-5 shadow-[10px_12px_20px_rgba(65,84,70,.12)]">
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full ${tint} opacity-70`} />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tint} text-[#1f4a35]`}>
          <Icon size={18} />
        </span>
        <div>
          <p className="text-2xl font-bold text-[#1c3328]">{value}</p>
          <p className="text-xs font-semibold text-[#68776d]">{label}</p>
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function AdminBlogSection({ query }: { query: string }) {
  const [view, setView] = useState<{ mode: "list" } | { mode: "new" } | { mode: "edit"; id: string }>({ mode: "list" })

  if (view.mode === "new") {
    return (
      <AdminArticleEditor
        onBack={() => { setView({ mode: "list" }); }}
        onCreated={(id) => { setView({ mode: "edit", id }); }}
      />
    )
  }
  if (view.mode === "edit") {
    return (
      <AdminArticleEditor
        key={view.id}
        id={view.id}
        onBack={() => { setView({ mode: "list" }); }}
      />
    )
  }
  return (
    <BlogList
      query={query}
      onNew={() => { setView({ mode: "new" }); }}
      onEdit={(id) => { setView({ mode: "edit", id }); }}
    />
  )
}

function BlogList({
  query,
  onNew,
  onEdit,
}: {
  query: string
  onNew: () => void
  onEdit:(id: string) => void
}) {
  const [items, setItems] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [pinBusyId, setPinBusyId] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true)
    try {
      const res = await fetch("/api/admin/articles")
      const json = await res.json()
      if (json.ok) setItems(json.items ?? [])
    } catch {
      toast.error("Failed to load articles")
    } finally {
      if (!options.silent) setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesQuery = !q || `${item.title} ${item.handle}`.toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
    // Pinned blogs always lead the table, in the exact order of the home page
    // rail, so the ▲/▼ arrange buttons line up with what visitors see.
    return [...matches].sort((a, b) => {
      const pinnedA = a.pinned ? 1 : 0
      const pinnedB = b.pinned ? 1 : 0
      if (pinnedA !== pinnedB) return pinnedB - pinnedA
      if (pinnedA === 1) return comparePinnedOrder(a, b)
      return 0 // stable sort keeps the server order (most recently updated first)
    })
  }, [items, query, statusFilter])

  // Canonical rail order (unfiltered) used for the pin/unpin + reorder calls.
  const pinnedItems = useMemo(
    () => items.filter((item) => item.pinned).sort(comparePinnedOrder),
    [items],
  )
  const pinnedCount = pinnedItems.length
  const pinnedRank = useMemo(
    () => new Map(pinnedItems.map((item, index) => [item.id, index + 1])),
    [pinnedItems],
  )

  const publishedCount = items.filter((i) => i.status === "published").length
  const draftCount = items.length - publishedCount

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (json.ok) {
        toast.success("Article deleted")
        setItems((prev) => prev.filter((i) => i.id !== id))
      } else {
        toast.error(json.error || "Delete failed")
      }
    } catch {
      toast.error("Delete failed")
    }
  }

  async function handleTogglePin(item: Article) {
    // Only published articles can be pinned (the home page rail only shows
    // published content). Draft articles must be published first.
    if (item.status !== "published") {
      toast.info("Publish the article first, then pin it to the home page.")
      return
    }

    const nextPinned = !item.pinned
    if (nextPinned && pinnedCount >= MAX_PINNED_ARTICLES) {
      toast.info(`You can pin up to ${MAX_PINNED_ARTICLES} blogs. Unpin one to free a slot.`)
      return
    }

    // Optimistic update — any number of blogs can be pinned together, so the
    // other rows keep their pin. A new pin is dropped at the top of the rail
    // (pinnedOrder -1) until the server replies with the authoritative order.
    const snapshot = items
    setPinBusyId(item.id)
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, pinned: nextPinned, pinnedOrder: nextPinned ? -1 : undefined }
          : i,
      ),
    )
    try {
      const res = await fetch(`/api/admin/articles/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(
          nextPinned
            ? "Pinned — now the first blog on the home page rail (arrange the order with the arrows)"
            : "Unpinned from the home page",
        )
        // Refetch from the server so the list reflects the authoritative order
        // (silent: keeps the table visible instead of flashing a loader).
        await load({ silent: true })
      } else {
        setItems(snapshot)
        toast.error(json.error || "Could not update pin")
      }
    } catch {
      setItems(snapshot)
      toast.error("Could not update pin")
    } finally {
      setPinBusyId(null)
    }
  }

  async function handleMovePin(item: Article, direction: -1 | 1) {
    const order = pinnedItems.map((entry) => entry.id)
    const from = order.indexOf(item.id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= order.length) return

    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved!)

    const snapshot = items
    setPinBusyId(item.id)
    setItems((prev) =>
      prev.map((i) => {
        const index = order.indexOf(i.id)
        return index >= 0 ? { ...i, pinnedOrder: index } : i
      }),
    )
    try {
      const res = await fetch("/api/admin/articles/pin-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: order }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success("Home page pin order updated")
      } else {
        setItems(snapshot)
        toast.error(json.error || "Could not reorder pinned blogs")
      }
    } catch {
      setItems(snapshot)
      toast.error("Could not reorder pinned blogs")
    } finally {
      setPinBusyId(null)
    }
  }

return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#6e826f]">Content Studio</p>
          <h1 className="mt-1 font-serif text-3xl text-[#173c2d]">Plant Care Blog</h1>
          <p className="mt-1 text-sm text-[#68776d]">Write care guides, save drafts, and publish stories for your plant parents.</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 rounded-2xl bg-[#24563e] px-5 py-3 text-sm font-bold text-white shadow-[0_6px_0_#173c2d] transition hover:bg-[#1f4a35] active:translate-y-1 active:shadow-none"
        >
          <Plus size={16} /> New Article
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={BookOpenText} label="Total articles" value={items.length} tint="bg-[#c9dfc9]" />
        <StatCard icon={CheckCircle2} label="Published" value={publishedCount} tint="bg-[#bcd9c2]" />
        <StatCard icon={FileText} label="Drafts" value={draftCount} tint="bg-[#e8bf92]" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-white bg-[linear-gradient(135deg,#f6fbf5,#e9f3e8)] p-5 shadow-[12px_14px_24px_rgba(65,84,70,.12)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#24563e] text-white">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#6e826f]">Prompt</p>
            <p className="mt-0.5 font-serif text-lg text-[#173c2d]">Blog Post Generation Prompt</p>
            <p className="mt-1 max-w-2xl text-xs text-[#68776d]">
              Master template for every new post — open it to copy the whole prompt, or edit it and the new version is
              saved for the whole team.
            </p>
          </div>
        </div>
        <button
          onClick={() => setPromptOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#24563e] bg-white px-4 py-2.5 text-sm font-bold text-[#24563e] transition hover:bg-[#f0f7f1]"
        >
          <Sparkles size={14} /> Open prompt
        </button>
      </div>

      <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2ee] bg-[#f5f8f4] px-4 py-3">
          {(["all", "published", "draft"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize ${statusFilter === filter ? "bg-[#24563e] text-white shadow-[0_2px_0_#173c2d]" : "bg-white text-[#526257] hover:bg-[#eef6ed]"}`}
            >
              {filter}
            </button>
          ))}
          <span className="ml-auto text-xs font-semibold text-[#718076]">
            {filtered.length} of {items.length}
          </span>
        </div>

        {pinnedCount > 0 ? (
          <p className="flex flex-wrap items-center gap-1.5 border-b border-[#eef2ee] bg-[#f9fcf8] px-4 py-2 text-[11px] font-semibold text-[#68776d]">
            <Pin size={11} className="rotate-45 text-[#256b3a]" />
            {pinnedCount} of {MAX_PINNED_ARTICLES} pin slots used — pinned blogs lead the list below and appear on the home page rail in this order. Use the arrows to arrange them.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-1.5 border-b border-[#eef2ee] bg-[#f9fcf8] px-4 py-2 text-[11px] font-semibold text-[#68776d]">
            <Pin size={11} className="rotate-45 text-[#256b3a]" />
            Pin up to {MAX_PINNED_ARTICLES} published blogs — they show on the home page rail in the order you arrange.
          </p>
        )}

<div className="max-h-[600px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-[#78887d]">
              <tr>
                <th className="p-4">Article</th>
                <th className="p-4">Status</th>
                <th className="p-4">Updated</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-[#718076]">
                    <Loader2 size={20} className="mx-auto mb-2 animate-spin text-[#24563e]" />
                    Loading articles…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-[#718076]">
                    No articles found. Click "New Article" to write your first care guide.

                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onEdit(item.id)}
                    className="group cursor-pointer border-t border-[#edf0ed] transition hover:bg-[#f8fbf7]"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.image?.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.image.url}
                            alt={item.image.altText || item.title}
                            loading="lazy"
                            className="h-12 w-14 rounded-xl object-cover ring-1 ring-[#d7e0d9]"
                          />
                        ) : (
                          <div className="flex h-12 w-14 items-center justify-center rounded-xl bg-[#eef6ed] text-[#7a8f80]">
                            <BookOpenText size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#243129]">{item.title || "Untitled article"}</p>
                          <p className="flex items-center gap-2 truncate font-mono text-xs text-[#718076]">
                            /plant-care/{item.handle}
                            {item.pinned ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4e8] px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wide text-[#256b3a]">
                                <Pin size={8} className="rotate-45" /> Pinned #{pinnedRank.get(item.id) ?? 1}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="p-4 text-xs text-[#718076]">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} /> {formatDate(item.updatedAt)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {item.pinned ? (
                          <div className="flex items-center gap-0.5 rounded-xl border border-[#d7e0d9] bg-white p-0.5">
                            <button
                              onClick={() => void handleMovePin(item, -1)}
                              disabled={pinBusyId !== null || (pinnedRank.get(item.id) ?? 1) <= 1}
                              title="Move earlier on the home page rail"
                              aria-label="Move earlier on the home page rail"
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#44584c] transition hover:bg-[#eef6ed] hover:text-[#24563e] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              onClick={() => void handleMovePin(item, 1)}
                              disabled={pinBusyId !== null || (pinnedRank.get(item.id) ?? 1) >= pinnedCount}
                              title="Move later on the home page rail"
                              aria-label="Move later on the home page rail"
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#44584c] transition hover:bg-[#eef6ed] hover:text-[#24563e] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        ) : null}
                        <button
                          onClick={() => void handleTogglePin(item)}
                          disabled={
                            item.status !== "published" ||
                            pinBusyId !== null ||
                            (!item.pinned && pinnedCount >= MAX_PINNED_ARTICLES)
                          }
                          title={
                            item.status !== "published"
                              ? "Publish the article to pin it to the home page"
                              : item.pinned
                                ? "Unpin from the home page"
                                : pinnedCount >= MAX_PINNED_ARTICLES
                                  ? `All ${MAX_PINNED_ARTICLES} pin slots are used — unpin a blog first`
                                  : "Pin to the home page — multiple blogs can be pinned, newest first"
                          }
                          className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            item.pinned
                              ? "border-[#24563e] bg-[#e6f4e8] text-[#24563e]"
                              : "border-[#d7e0d9] bg-white text-[#44584c] hover:border-[#24563e] hover:text-[#24563e]"
                          }`}
                        >
                          {item.pinned ? <PinOff size={12} /> : <Pin size={12} className="rotate-45" />}
                          {item.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => onEdit(item.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#d7e0d9] bg-white px-3 py-2 text-xs font-bold text-[#44584c] transition hover:border-[#24563e] hover:text-[#24563e]"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(item.id, item.title)}
                          className="rounded-xl border border-[#f0e2e2] p-2 text-[#b3574e] transition hover:bg-[#fdf4f3]"
                          title="Delete article"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BlogPromptModal open={promptOpen} onClose={() => setPromptOpen(false)} />
      <ToastContainer position="bottom-right" />
    </div>
  )
}