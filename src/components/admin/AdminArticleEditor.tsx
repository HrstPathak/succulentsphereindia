"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Image as TiptapImage } from "@tiptap/extension-image"
import { Placeholder } from "@tiptap/extension-placeholder"
import { useEffect, useState } from "react"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import {
  ArrowLeft,
  Bold,
  BookOpenText,
  Camera,
  Code,
  Eye,
  FileText,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  PenLine,
  Save,
  Search,
} from "lucide-react"
import MediaLibrary from "./MediaLibrary"

type ArticleForm = {
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

const EMPTY_FORM: ArticleForm = {
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

function isFullHtmlDoc(html: string | undefined | null): boolean {
  const value = String(html || "")
  return /<!doctype html|<html[\s>]|<head[\s>]|<style[\s>]/i.test(value)
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

export default function AdminArticleEditor({
  id,
  onBack,
  onCreated,
}: {
  id?: string
  onBack: () => void
  onCreated?: (id: string) => void
}) {
  const isNew = !id
  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [htmlMode, setHtmlMode] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [mediaTarget, setMediaTarget] = useState<"cover" | "inline">("cover")
  const [handleTouched, setHandleTouched] = useState(!isNew)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TiptapImage,
      Placeholder.configure({ placeholder: "Write your article…" }),
    ],
    content: form.contentHtml,
    onUpdate: ({ editor }) => {
      setForm((prev) => ({ ...prev, contentHtml: editor.getHTML() }))
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const pasted = event.clipboardData?.getData("text/html") || ""
        if (isFullHtmlDoc(pasted)) {
          event.preventDefault()
          setForm((prev) => ({ ...prev, contentHtml: pasted }))
          setHtmlMode(true)
          setPreviewMode(false)
          toast.info("Full HTML document pasted — switched to HTML mode")
          return true
        }
        return false
      },
    },
  })

  function toggleHtmlMode() {
    if (htmlMode && isFullHtmlDoc(form.contentHtml)) {
      toast.info("Full HTML documents are edited in HTML mode")
      return
    }
    if (htmlMode) {
      editor?.commands.setContent(form.contentHtml)
      setPreviewMode(false)
    }
    setHtmlMode((v) => !v)
  }

async function loadArticle() {
    try {
      const res = await fetch(`/api/admin/articles/${id}`)
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error || "Failed to load article")
        return
      }
      const a = json.article
      const rawHtml = a.contentHtml || "<p></p>"
      setForm({
        title: a.title || "",
        handle: a.handle || "",
        excerpt: a.excerpt || "",
        seoTitle: a.seoTitle || "",
        seoDescription: a.seoDescription || "",
        authorName: a.authorName || "Succulent Sphere Team",
        contentHtml: rawHtml,
        status: a.status === "published" ? "published" : "draft",
        tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
        image: a.image && a.image.url ? { url: String(a.image.url), altText: String(a.image.altText || a.title || "") } : null,
      })
      setHtmlMode(isFullHtmlDoc(a.contentHtml))
      if (!isFullHtmlDoc(a.contentHtml)) editor?.commands.setContent(rawHtml)
    } catch {
      toast.error("Failed to load article")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isNew) void loadArticle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSave(publish: boolean) {
    setSaving(true)
    try {
      const payload = { ...form, status: publish ? "published" : "draft" }
      const url = isNew ? "/api/admin/articles" : `/api/admin/articles/${id}`
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error || "Save failed")
        return
      }
      toast.success(publish ? "Published!" : "Saved as draft")
      if (isNew && json.article?.id) onCreated?.(json.article.id)
      else setForm((prev) => ({ ...prev, status: publish ? "published" : "draft" }))
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  function insertImageIntoEditor(url: string, alt: string) {
    editor?.chain().focus().setImage({ src: url, alt }).run()
  }

  const fieldClass = "w-full rounded-xl border border-[#d7e0d9] bg-[#fafbf9] px-3 py-2.5 text-sm outline-none ring-[#6f9878] transition focus:border-[#6f9878] focus:ring-2"

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[26px] border border-white bg-white p-12 text-[#68776d] shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
        <Loader2 size={18} className="animate-spin text-[#24563e]" />
        <span className="text-sm font-medium">Loading article…</span>
      </div>
    )
  }

return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-2xl border border-[#d5dfd5] bg-white px-4 py-2.5 text-sm font-bold text-[#44584c] shadow-[0_4px_0_#d4ddd4] transition hover:text-[#173c2d] active:translate-y-1 active:shadow-none"
        >
          <ArrowLeft size={16} /> Blog
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={form.status} />
          <button
            onClick={() => void handleSave(false)}
            disabled={saving}
            className="rounded-2xl border border-[#24563e] px-4 py-2.5 text-sm font-bold text-[#24563e] transition hover:bg-[#f0f7f1] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={() => void handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-[#24563e] px-4 py-2.5 text-sm font-bold text-white shadow-[0_5px_0_#173c2d] transition hover:bg-[#1f4a35] active:translate-y-1 active:shadow-none disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <div className="rounded-[26px] border border-white bg-white p-6 shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
            <input
              value={form.title}
              onChange={(e) => {
                const title = e.target.value
                setForm((prev) => ({ ...prev, title, handle: handleTouched ? prev.handle : slugify(title) }))
              }}
              placeholder="Article title"
              className="w-full rounded-2xl border border-[#d7e0d9] bg-[#fafbf9] px-4 py-3.5 font-serif text-2xl text-[#173c2d] outline-none ring-[#6f9878] transition focus:border-[#6f9878] focus:ring-2"
            />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#718076]">
              <span className="rounded-lg bg-[#eef6ed] px-2.5 py-1.5 font-semibold text-[#2c633c]">/plant-care/</span>
              <input
                value={form.handle}
                onChange={(e) => {
                  setHandleTouched(true)
                  setForm((prev) => ({ ...prev, handle: slugify(e.target.value) }))
                }}
                placeholder="article-slug"
                className="min-w-0 flex-1 rounded-xl border border-[#d7e0d9] bg-[#fafbf9] px-3 py-2 font-mono text-sm outline-none ring-[#6f9878] transition focus:ring-2"
              />
            </div>
            <p className="mt-2 text-xs text-[#9aa89f]">Public URL: /plant-care/{form.handle || "article-slug"}</p>
          </div>

<div className="rounded-[26px] border border-white bg-white p-6 shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
            <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78887d]">
              <FileText size={13} /> Excerpt
            </label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
              placeholder="Short summary shown on the blog listing…"
              rows={3}
              className="w-full rounded-2xl border border-[#d7e0d9] bg-[#fafbf9] px-4 py-3 text-sm leading-6 outline-none ring-[#6f9878] transition focus:ring-2"
            />
          </div>

          <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
            <div className="mb-3 flex items-center justify-between px-6 pt-5">
              <h2 className="flex items-center gap-2 font-serif text-lg text-[#173c2d]">
                <BookOpenText size={16} /> Content
              </h2>
              <button
                onClick={toggleHtmlMode}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${htmlMode ? "bg-[#24563e] text-white" : "bg-[#f0f4f0] text-[#526257] hover:bg-[#e5ece6]"}`}
              >
                <Code size={13} /> HTML
              </button>
              {htmlMode ? (
                <button
                  onClick={() => setPreviewMode((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${previewMode ? "bg-[#24563e] text-white" : "bg-[#f0f4f0] text-[#526257] hover:bg-[#e5ece6]"}`}
                >
                  <Eye size={13} /> Preview
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1 border-y border-[#eef2ee] bg-[#f5f8f4] p-2">
              <button onClick={() => editor?.chain().focus().toggleBold().run()} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Bold"><Bold size={16} /></button>
              <button onClick={() => editor?.chain().focus().toggleItalic().run()} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Italic"><Italic size={16} /></button>
              <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Heading"><Heading2 size={16} /></button>
              <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Bullet list"><List size={16} /></button>
              <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Numbered list"><ListOrdered size={16} /></button>
              <button onClick={() => { const url = prompt("Link URL"); if (url) editor?.chain().focus().setLink({ href: url }).run() }} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Add link"><LinkIcon size={16} /></button>
              <button onClick={() => { setMediaTarget("inline"); setMediaOpen(true) }} className="rounded-xl p-2 text-[#44584c] transition hover:bg-white" title="Insert image"><ImageIcon size={16} /></button>
            </div>
            {htmlMode ? (
              <>
                <textarea
                  value={form.contentHtml}
                  onChange={(e) => setForm((prev) => ({ ...prev, contentHtml: e.target.value }))}
                  rows={16}
                  className="w-full p-5 font-mono text-sm outline-none"
                />
                {previewMode ? (
                  <div className="border-t border-[#eef2ee] bg-[#f5f8f4] p-3">
                    <iframe
                      title="Article preview"
                      sandbox="allow-same-origin"
                      srcDoc={form.contentHtml}
                      className="h-[520px] w-full rounded-xl border border-[#d7e0d9] bg-white"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <EditorContent editor={editor} className="prose prose-lg max-w-none min-h-[340px] p-6 outline-none" />
            )}
          </div>
        </div>

<div className="space-y-5">
          <div className="rounded-[26px] border border-white bg-white p-5 shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78887d]">
              <Camera size={13} /> Cover image
            </h3>
            {form.image?.url ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image.url}
                  alt={form.image.altText || form.title}
                  className="h-20 w-24 rounded-xl object-cover ring-1 ring-[#d7e0d9]"
                />
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => { setMediaTarget("cover"); setMediaOpen(true) }} className="rounded-xl bg-[#24563e] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1f4a35]">Change</button>
                  <button onClick={() => setForm((prev) => ({ ...prev, image: null }))} className="rounded-xl border border-[#d7e0d9] px-3 py-1.5 text-xs font-bold text-[#718076] transition hover:text-[#b3574e]">Remove</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setMediaTarget("cover"); setMediaOpen(true) }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c9d6cc] bg-[#fafbf9] px-4 py-8 text-sm font-semibold text-[#718076] transition hover:border-[#24563e] hover:text-[#24563e]"
              >
                <ImageIcon size={20} />
                Choose from Media Library
              </button>
            )}
          </div>

          <div className="rounded-[26px] border border-white bg-white p-5 shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78887d]">
              <PenLine size={13} /> Author
            </h3>
            <input
              value={form.authorName}
              onChange={(e) => setForm((prev) => ({ ...prev, authorName: e.target.value }))}
              placeholder="Author name"
              className={fieldClass}
            />
            <h3 className="mb-3 mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78887d]">
              <BookOpenText size={13} /> Tags
            </h3>
            <input
              value={form.tags.join(", ")}
              onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
              placeholder="care, watering, soil"
              className={fieldClass}
            />
          </div>

          <div className="rounded-[26px] border border-white bg-white p-5 shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78887d]">
              <Search size={13} /> SEO
            </h3>
            <input
              value={form.seoTitle}
              onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
              placeholder="SEO title"
              className={fieldClass}
            />
            <textarea
              value={form.seoDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
              placeholder="SEO description"
              rows={3}
              className={`${fieldClass} mt-3 leading-6`}
            />
          </div>
        </div>
      </div>

      <MediaLibrary
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={(url, altText) => {
          if (mediaTarget === "cover") {
            setForm((prev) => ({ ...prev, image: { url, altText } }))
          } else {
            insertImageIntoEditor(url, altText)
          }
        }}
      />
      <ToastContainer position="bottom-right" />
    </div>
  )
}