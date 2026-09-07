"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Image as TiptapImage } from "@tiptap/extension-image"
import { Placeholder } from "@tiptap/extension-placeholder"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import {
  ArrowLeft,
  Bold,
  Code,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Save,
} from "lucide-react"
import MediaLibrary from "./MediaLibrary"

type ArticleData = {
  id?: string
  title: string
  handle: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  authorName: string
  contentHtml: string
  status: "draft" | "published"
  tags: string[]
  image: { url: string; altText: string } | null
}

const EMPTY: ArticleData = {
  title: "",
  handle: "",
  excerpt: "",
  seoTitle: "",
  seoDescription: "",
  authorName: "Succulent Sphere Team",
  contentHtml: "<p></p>",
  status: "draft",
  tags: [],
  image: null,
}

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export default function BlogEditor({ articleId }: { articleId: string }) {
  const router = useRouter()
  const isNew = articleId === "new"
  const [data, setData] = useState<ArticleData>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [htmlMode, setHtmlMode] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [mediaTarget, setMediaTarget] = useState<"cover" | "inline">("cover")
  const [handleTouched, setHandleTouched] = useState(!isNew)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TiptapImage,
      Placeholder.configure({ placeholder: "Write your article…" }),
    ],
    content: data.contentHtml,
    onUpdate: ({ editor }) => {
      setData((prev) => ({ ...prev, contentHtml: editor.getHTML() }))
    },
  })

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/articles/${articleId}`)
        const json = await res.json()
        if (cancelled) return
        if (json.ok) {
          const a = json.article
          const next: ArticleData = {
            id: a.id,
            title: a.title || "",
            handle: a.handle || "",
            excerpt: a.excerpt || "",
            seoTitle: a.seoTitle || "",
            seoDescription: a.seoDescription || "",
            authorName: a.authorName || "Succulent Sphere Team",
            contentHtml: a.contentHtml || "<p></p>",
            status: a.status || "draft",
            tags: a.tags || [],
            image: a.image || null,
          }
          setData(next)
          editor?.commands.setContent(next.contentHtml)
        } else {
          toast.error(json.error || "Failed to load article")
        }
      } catch {
        if (!cancelled) toast.error("Failed to load article")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  async function handleSave(publish?: boolean) {
    setSaving(true)
    const payload = { ...data, status: publish === undefined ? data.status : publish ? "published" : "draft" }
    try {
      const res = await fetch(isNew ? "/api/admin/articles" : `/api/admin/articles/${articleId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error || "Save failed")
        return
      }
      toast.success(publish ? "Published!" : "Saved")
      if (isNew) router.replace(`/admin/blog/${json.article.id}`)
      else setData((prev) => ({ ...prev, status: payload.status as "draft" | "published" }))
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  function insertImageIntoEditor(url: string, alt: string) {
    editor?.chain().focus().setImage({ src: url, alt }).run()
  }

  if (loading) return <div className="p-8 text-black/50">Loading…</div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <button
        onClick={() => router.push("/admin/blog")}
        className="mb-4 flex items-center gap-1 text-sm text-black/60 hover:text-black"
      >
        <ArrowLeft size={16} /> Back to Blog
      </button>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl text-[#173c2d]">{isNew ? "New Article" : "Edit Article"}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => void handleSave(false)}
            disabled={saving}
            className="rounded-full border border-[#173c2d] px-4 py-2 text-sm font-semibold text-[#173c2d] disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            onClick={() => void handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-[#173c2d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={16} /> Publish
          </button>
        </div>
      </div>

<div className="space-y-4">
        <input
          value={data.title}
          onChange={(e) => {
            const title = e.target.value
            setData((prev) => ({ ...prev, title, handle: handleTouched ? prev.handle : slugify(title) }))
          }}
          placeholder="Article title"
          className="w-full rounded-xl border border-black/10 px-4 py-3 text-lg font-medium"
        />

        <div className="flex items-center gap-2 text-sm text-black/50">
          <span>/plant-care/</span>
          <input
            value={data.handle}
            onChange={(e) => { setHandleTouched(true); setData((prev) => ({ ...prev, handle: slugify(e.target.value) })) }}
            className="flex-1 rounded-lg border border-black/10 px-3 py-1.5"
          />
        </div>

        {/* Cover image */}
        <div className="rounded-xl border border-black/10 p-4">
          <div className="mb-2 text-sm font-semibold text-black/70">Cover image</div>
          {data.image?.url ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.image.url} alt={data.image.altText} className="h-24 w-24 rounded-lg object-cover" />
              <div className="flex flex-col gap-2">
                <button onClick={() => { setMediaTarget("cover"); setMediaOpen(true) }} className="text-sm text-[#AC4B2C]">Change image</button>
                <button onClick={() => setData((prev) => ({ ...prev, image: null }))} className="text-sm text-black/50">Remove</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setMediaTarget("cover"); setMediaOpen(true) }}
              className="rounded-lg border border-dashed border-black/20 px-4 py-6 text-sm text-black/50"
            >
              Choose from Media Library
            </button>
          )}
        </div>

        <textarea
          value={data.excerpt}
          onChange={(e) => setData((prev) => ({ ...prev, excerpt: e.target.value }))}
          placeholder="Short excerpt (shown on the blog listing)"
          rows={2}
          className="w-full rounded-xl border border-black/10 px-4 py-3"
        />

        {/* Editor toolbar */}
        <div className="rounded-xl border border-black/10">
          <div className="flex flex-wrap items-center gap-1 border-b border-black/10 p-2">
            <button onClick={() => editor?.chain().focus().toggleBold().run()} className="rounded p-2 hover:bg-black/5"><Bold size={16} /></button>
            <button onClick={() => editor?.chain().focus().toggleItalic().run()} className="rounded p-2 hover:bg-black/5"><Italic size={16} /></button>
            <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded p-2 hover:bg-black/5"><Heading2 size={16} /></button>
            <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="rounded p-2 hover:bg-black/5"><List size={16} /></button>
            <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="rounded p-2 hover:bg-black/5"><ListOrdered size={16} /></button>
            <button
              onClick={() => { const url = prompt("Link URL"); if (url) editor?.chain().focus().setLink({ href: url }).run() }}
              className="rounded p-2 hover:bg-black/5"
            ><LinkIcon size={16} /></button>
            <button onClick={() => { setMediaTarget("inline"); setMediaOpen(true) }} className="rounded p-2 hover:bg-black/5"><ImageIcon size={16} /></button>
            <div className="mx-2 h-5 w-px bg-black/10" />
            <button
              onClick={() => setHtmlMode((v) => !v)}
              className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold ${htmlMode ? "bg-[#173c2d] text-white" : "hover:bg-black/5"}`}
            >
              <Code size={14} /> HTML
            </button>
          </div>

{htmlMode ? (
            <textarea
              value={data.contentHtml}
              onChange={(e) => {
                setData((prev) => ({ ...prev, contentHtml: e.target.value }))
              }}
              onBlur={() => editor?.commands.setContent(data.contentHtml)}
              rows={16}
              className="w-full p-4 font-mono text-sm"
            />
          ) : (
            <EditorContent editor={editor} className="prose prose-lg max-w-none p-4 min-h-[300px]" />
          )}
        </div>

        {/* SEO */}
        <div className="rounded-xl border border-black/10 p-4">
          <div className="mb-3 text-sm font-semibold text-black/70">SEO</div>
          <input
            value={data.seoTitle}
            onChange={(e) => setData((prev) => ({ ...prev, seoTitle: e.target.value }))}
            placeholder="SEO title"
            className="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
          <textarea
            value={data.seoDescription}
            onChange={(e) => setData((prev) => ({ ...prev, seoDescription: e.target.value }))}
            placeholder="SEO description"
            rows={2}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
        </div>

        <input
          value={data.authorName}
          onChange={(e) => setData((prev) => ({ ...prev, authorName: e.target.value }))}
          placeholder="Author name"
          className="w-full rounded-xl border border-black/10 px-4 py-3"
        />

        <input
          value={data.tags.join(", ")}
          onChange={(e) => setData((prev) => ({ ...prev, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
          placeholder="Tags (comma separated)"
          className="w-full rounded-xl border border-black/10 px-4 py-3"
        />
      </div>

      <MediaLibrary
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={(url, altText) => {
          if (mediaTarget === "cover") {
            setData((prev) => ({ ...prev, image: { url, altText } }))
          } else {
            insertImageIntoEditor(url, altText)
          }
        }}
      />

      <ToastContainer position="bottom-right" />
    </div>
  )
}