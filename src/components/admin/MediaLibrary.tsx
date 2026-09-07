"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Upload, X } from "lucide-react"

type MediaItem = {
  id: string
  url: string
  altText: string
  filename: string
  uploadedAt: string
}

export default function MediaLibrary({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  onSelect: (url: string, altText: string) => void
}) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadItems() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/media")
      const data = await res.json()
      if (data.ok) setItems(data.items)

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) void loadItems()
  }, [isOpen])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body: form })
      const data = await res.json()
      if (data.ok) {
        setItems((prev) => [data.media, ...prev])
      } else {
        alert(data.error || "Upload failed")
      }
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-serif text-xl text-[#173c2d]">Media Library</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5">
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-black/10 px-6 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ""
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-full bg-[#173c2d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "Uploading…" : "Upload new image"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12 text-black/40">Loading…</div>
          ) : items.length === 0 ? (
            <div className="flex justify-center py-12 text-black/40">No images uploaded yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item.url, item.altText || item.filename)
                    onClose()
                  }}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 hover:border-[#AC4B2C]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.altText || item.filename} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                    <Check size={24} className="text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}