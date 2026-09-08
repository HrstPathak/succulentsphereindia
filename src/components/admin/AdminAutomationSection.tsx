"use client"

import { ComponentType, Fragment, useEffect, useMemo, useState } from "react"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  Plus,
  TriangleAlert,
  Wand2,
} from "lucide-react"

type Topic = {
  id: string
  topic: string
  notes: string
  featuredImageUrl: string | null
  source: "manual" | "ai"
  status: "pending" | "published" | "failed"
  createdAt: string
  publishedArticleId: string | null
  failureReason: string | null
  modelUsed: string | null
}

type StatusFilter = "all" | "pending" | "published" | "failed"

function StatusBadge({ status }: { status: Topic["status"] }) {
  const classes: Record<Topic["status"], string> = {
    pending: "bg-[#faf0e0] text-[#96691f]",
    published: "bg-[#e6f4e8] text-[#256b3a]",
    failed: "bg-[#fbe9e7] text-[#b3574e]",
  }
  const labels: Record<Topic["status"], string> = {
    pending: "Pending",
    published: "Published",
    failed: "Failed",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${classes[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "published" ? "bg-[#256b3a]" : status === "failed" ? "bg-[#b3574e]" : "bg-[#96691f]"}`}
      />
      {labels[status]}
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

export default function AdminAutomationSection({ query }: { query: string }) {
  const [items, setItems] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({
    topic: "",
    notes: "",
    featuredImageUrl: "",
    source: "manual" as "manual" | "ai",
  })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/automation/topics", { cache: "no-store" })
      const json = await res.json()
      if (json.ok) setItems(json.items ?? [])
      else toast.error(json.error || "Failed to load topics")
    } catch {
      toast.error("Failed to load topics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate() {
    if (!form.topic.trim()) {
      toast.error("Topic is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/automation/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success("Topic queued — the next automation run will pick it up")
        setForm({ topic: "", notes: "", featuredImageUrl: "", source: "manual" })
        await load()
      } else {
        toast.error(json.error || "Failed to queue topic")
      }
    } catch {
      toast.error("Failed to queue topic")
    } finally {
      setSaving(false)
    }
  }

  async function handleRunNow() {
    setRunning(true)
    try {
      // Same-origin POST with the admin session cookie — the cron route's
      // requireAdmin() fallback authorises this, no CRON_SECRET needed.
      const res = await fetch("/api/cron/blog-automation", { method: "POST" })
      const json = await res.json()
      if (json.ok) {
        if (json.published) {
          toast.success(`Published “${json.handle}” via ${json.modelUsed ?? "unknown model"}`)
        } else {
          toast.info(json.message || "No pending topics")
        }
        await load()
      } else {
        toast.error(json.error || "Automation run failed")
        await load()
      }
    } catch {
      toast.error("Automation run failed")
    } finally {
      setRunning(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesQuery = !q || `${item.topic} ${item.source}`.toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [items, query, statusFilter])

  const pendingCount = items.filter((i) => i.status === "pending").length
  const publishedCount = items.filter((i) => i.status === "published").length
  const failedCount = items.filter((i) => i.status === "failed").length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#6e826f]">Content Studio</p>
          <h1 className="mt-1 font-serif text-3xl text-[#173c2d]">Automation</h1>
          <p className="mt-1 text-sm text-[#68776d]">Queue topics and let AI write fully inline-styled plant-care articles for you.</p>
        </div>
        <button
          onClick={() => void handleRunNow()}
          disabled={running}
          className="flex items-center gap-2 rounded-2xl bg-[#24563e] px-5 py-3 text-sm font-bold text-white shadow-[0_6px_0_#173c2d] transition hover:bg-[#1f4a35] active:translate-y-1 active:shadow-none disabled:opacity-60"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Running…" : "Run automation now"}
        </button>
      </div>

      <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="text-sm font-bold text-[#243129]">New topic</p>
          <span className="ml-auto text-xs text-[#718076]">
            Tip: keep topics specific, e.g. “Monsoon care for Echeveria”
          </span>
        </div>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={form.topic}
            onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
            placeholder="Topic, e.g. Monsoon care for Echeveria"
            className="min-w-0 w-full rounded-xl border border-[#d7e0d9] bg-[#fafbf9] px-3 py-2 text-sm outline-none ring-[#6f9878] transition focus:ring-2"
          />
          <input
            value={form.featuredImageUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, featuredImageUrl: e.target.value }))}
            placeholder="Featured image URL (optional — paste your Hostinger link)"
            className="min-w-0 w-full rounded-xl border border-[#d7e0d9] bg-[#fafbf9] px-3 py-2 font-mono text-xs outline-none ring-[#6f9878] transition focus:ring-2"
          />
          <div className="flex rounded-xl border border-[#d7e0d9] bg-[#fafbf9] p-1">
            {(["manual", "ai"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, source }))}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold capitalize ${form.source === source ? "bg-[#24563e] text-white" : "text-[#526257]"}`}
              >
                {source === "ai" ? "AI" : "Manual"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#24563e] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_0_#173c2d] transition hover:bg-[#1f4a35] active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Queue topic
          </button>
        </div>
        <div className="px-4 py-2">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes / context for the writer (optional) — hooks, product mentions, region, season…"
            rows={2}
            className="w-full rounded-xl border border-[#d7e0d9] bg-[#fafbf9] px-3 py-2 text-sm outline-none ring-[#6f9878] transition focus:ring-2"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={FileText} label="Queued" value={pendingCount} tint="bg-[#f5e3c0]" />
        <StatCard icon={CheckCircle2} label="Published via AI" value={publishedCount} tint="bg-[#bcd9c2]" />
        <StatCard icon={TriangleAlert} label="Failed" value={failedCount} tint="bg-[#f3cfc8]" />
      </div>

      <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2ee] bg-[#f5f8f4] px-4 py-3">
          {(["all", "pending", "published", "failed"] as const).map((filter) => (
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

        <div className="max-h-[600px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-[#78887d]">
              <tr>
                <th className="p-4">Topic</th>
                <th className="p-4">Source</th>
                <th className="p-4">Status</th>
                <th className="p-4">Queued</th>
                <th className="p-4">Result</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#718076]">
                    <Loader2 size={20} className="mx-auto mb-2 animate-spin text-[#24563e]" />
                    Loading topics…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#718076]">
                    No topics here yet. Queue one above and it’ll appear as “pending”.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <Fragment key={item.id}>
                    <tr className="border-t border-[#edf0ed] transition hover:bg-[#f8fbf7]">
                      <td className="p-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#243129]">{item.topic}</p>
                          {item.modelUsed ? (
                            <p className="truncate text-xs text-[#718076]">via {item.modelUsed}</p>
                          ) : null}
                          {item.notes ? (
                            <p className="truncate text-xs text-[#718076]">{item.notes}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-xs text-[#718076]">
                          {item.source === "ai" ? <Bot size={13} /> : null}
                          {item.source === "ai" ? "AI" : "Manual"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={item.status} />
                          {item.status === "failed" && item.failureReason ? (
                            <button
                              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                              title={item.failureReason}
                              className="rounded-lg border border-[#f0e2e2] px-2 py-0.5 text-[10px] font-bold text-[#b3574e] hover:bg-[#fdf4f3]"
                            >
                              Why?
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-[#718076]">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={13} /> {formatDate(item.createdAt)}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-[#718076]">
                        {item.status === "published" && item.publishedArticleId ? (
                          <span
                            className="flex items-center gap-1.5 font-mono"
                            title="Published article id — find it in the Blog tab"
                          >
                            <CheckCircle2 size={13} className="text-[#256b3a]" />
                            {item.publishedArticleId.slice(0, 12)}…
                          </span>
                        ) : (
                          <span className="text-[#a7b3aa]">—</span>
                        )}
                      </td>
                    </tr>
                    {item.status === "failed" && item.failureReason && expanded === item.id ? (
                      <tr className="border-t border-[#f3e2e0] bg-[#fdf7f5]">
                        <td colSpan={5} className="p-4 text-xs text-[#b3574e]">
                          <span className="font-bold uppercase tracking-wide">Failure reason:</span>{" "}
                          {item.failureReason}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ToastContainer position="bottom-right" />
    </div>
  )
}