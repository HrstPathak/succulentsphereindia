"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

type ArticleRow = {
  id: string
  title: string
  handle: string
  status: string
  updatedAt: string
}

export default function BlogAdmin() {
  const router = useRouter()
  const [items, setItems] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/articles")
      const json = await res.json()
      if (json.ok) setItems(json.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleDelete(id: string) {
    if (!confirm("Delete this article?")) return
    const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" })
    const json = await res.json()
    if (json.ok) {
      toast.success("Deleted")
      setItems((prev) => prev.filter((i) => i.id !== id))
    } else {
      toast.error(json.error || "Delete failed")
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl text-[#173c2d]">Blog</h1>
        <button
          onClick={() => router.push("/admin/blog/new")}
          className="flex items-center gap-2 rounded-full bg-[#173c2d] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} /> New Article
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-black/50">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-black/40">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-black/40">No articles yet.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-black/5">
                  <td className="cursor-pointer px-4 py-3 font-medium" onClick={() => router.push(`/admin/blog/${item.id}`)}>
                    {item.title}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-black/50">{new Date(item.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => void handleDelete(item.id)} className="rounded p-1 text-black/40 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ToastContainer position="bottom-right" />
    </div>
  )
}