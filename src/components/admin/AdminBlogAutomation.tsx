"use client";

import { useMemo, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Bot,
  Code2,
  Eye,
  Link2,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";

type GeneratedPost = {
  title: string;
  slug: string;
  metaDescription: string;
  content: string; // Markdown
  tags: string[];
};

type QueueItem = {
  id: string;
  topic: string;
  status: "pending" | "generating" | "ready" | "published" | "failed";
  error?: string;
  post?: GeneratedPost;
};

/** Minimal, safe Markdown → HTML renderer (no external deps; HTML is escaped first). */
function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = md.split(/\r?\n/);
  let html = "";
  let inCode = false;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  for (const raw of lines) {
    if (/^```/.test(raw.trim())) {
      closeList();
      html += inCode ? "</code></pre>" : "<pre><code>";
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html += esc(raw) + "\n";
      continue;
    }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      html += `<h${level} class="mt-5 mb-2 font-bold">${inline(h[2])}</h${level}>`;
      continue;
    }
    const ul = raw.match(/^\s*[-*]\s+(.*)$/);
    const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      const want = ul ? "ul" : "ol";
      if (listType !== want) {
        closeList();
        html += `<${want} class="my-3 space-y-1 pl-6 ${want === "ul" ? "list-disc" : "list-decimal"}">`;
        listType = want;
      }
      html += `<li>${inline((ul || ol)![1])}</li>`;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(raw)) {
      closeList();
      html += '<hr class="my-5 border-gray-200 dark:border-gray-700" />';
      continue;
    }
    if (!raw.trim()) {
      closeList();
      continue;
    }
    closeList();
    html += `<p class="my-3 leading-relaxed">${inline(raw)}</p>`;
  }
  closeList();
  if (inCode) html += "</code></pre>";
  return html;
}

function PreviewModal({
  post,
  publishing,
  onClose,
  onPublish,
}: {
  post: GeneratedPost;
  publishing: boolean;
  onClose: () => void;
  onPublish: () => void;
}) {
  const [mode, setMode] = useState<"rendered" | "raw">("rendered");
  const html = useMemo(() => renderMarkdown(post.content || ""), [post.content]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#edf0ed] bg-white shadow-2xl dark:border-[#2b3a30] dark:bg-[#182420]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf0ed] p-5 dark:border-[#2b3a30]">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#1c3328] dark:text-[#d7e4da]">
              {post.title || "Untitled"}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-[#68776d] dark:text-[#8fa396]">
              <Link2 size={12} /> /plant-care/{post.slug}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#68776d] hover:bg-[#f0f4f0] dark:text-[#8fa396] dark:hover:bg-[#243129]"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid gap-3 rounded-xl border border-[#edf0ed] bg-[#f8fbf7] p-4 sm:grid-cols-2 dark:border-[#2b3a30] dark:bg-[#1e2b25]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#68776d] dark:text-[#8fa396]">
                Meta Description
              </p>
              <p className="mt-1 text-sm text-[#243129] dark:text-[#c9d6cd]">
                {post.metaDescription || "—"}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#68776d] dark:text-[#8fa396]">
                <Tag size={11} /> Tags
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(post.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#e6f4e8] px-2.5 py-0.5 text-xs font-semibold text-[#256b3a] dark:bg-[#25402f] dark:text-[#9fd0ac]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setMode("rendered")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                mode === "rendered"
                  ? "bg-[#1f4a35] text-white"
                  : "border border-[#e2e8e2] text-[#68776d] hover:bg-[#f0f4f0] dark:border-[#2b3a30] dark:text-[#8fa396] dark:hover:bg-[#243129]"
              }`}
            >
              <Eye size={13} /> Rendered
            </button>
            <button
              onClick={() => setMode("raw")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                mode === "raw"
                  ? "bg-[#1f4a35] text-white"
                  : "border border-[#e2e8e2] text-[#68776d] hover:bg-[#f0f4f0] dark:border-[#2b3a30] dark:text-[#8fa396] dark:hover:bg-[#243129]"
              }`}
            >
              <Code2 size={13} /> Raw Markdown
            </button>
          </div>

          {mode === "rendered" ? (
            <article
              className="max-w-none text-[#243129] dark:text-[#c9d6cd]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl bg-[#f4f6f3] p-4 font-mono text-xs text-[#243129] dark:bg-[#121a16] dark:text-[#a9bcae]">
              {post.content}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#edf0ed] p-4 dark:border-[#2b3a30]">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#e2e8e2] px-4 py-2 text-sm font-bold text-[#68776d] hover:bg-[#f0f4f0] dark:border-[#2b3a30] dark:text-[#8fa396] dark:hover:bg-[#243129]"
          >
            Cancel
          </button>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="flex items-center gap-2 rounded-xl bg-[#1f4a35] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#2a5f45] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {publishing ? "Publishing…" : "Save & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlogAutomation() {
  const [topicInput, setTopicInput] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const previewItem = queue.find((q) => q.id === previewId) || null;

  /** Parse the textarea into queue items (one topic per line, deduped). */
  function addTopics() {
    const topics = topicInput
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!topics.length) {
      toast.error("Enter at least one topic.");
      return;
    }
    setQueue((prev) => {
      const existing = new Set(prev.map((p) => p.topic.toLowerCase()));
      const fresh = topics
        .filter((t) => !existing.has(t.toLowerCase()))
        .map((topic) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          topic,
          status: "pending" as const,
        }));
      if (fresh.length === 0) toast.info("Those topics are already in the queue.");
      return [...prev, ...fresh];
    });
    setTopicInput("");
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
    if (previewId === id) setPreviewId(null);
  }

  /** Step 1 — call Gemini for the given topic and open the preview. */
  async function generate(item: QueueItem) {
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: "generating", error: undefined } : q))
    );
    try {
      const res = await fetch("/api/admin/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: item.topic }),
      });
      const json = await res.json();
      if (!res.ok || !json?.data) {
        throw new Error(json?.error || `Generation failed (${res.status})`);
      }
      const data = json.data as GeneratedPost;
      if (!data.title || !data.content) {
        throw new Error("The AI response was incomplete — try again.");
      }
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "ready", post: data, error: undefined } : q
        )
      );
      setPreviewId(item.id);
      toast.success("Draft ready for review.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "failed", error: message } : q))
      );
      toast.error(message);
    }
  }

  /** Step 2 — save the reviewed draft via the existing admin articles API. */
  async function publish(item: QueueItem) {
    if (!item.post) return;
    setPublishingId(item.id);
    try {
      const res = await fetch("/api/admin/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.post.title,
          handle: item.post.slug,
          excerpt: item.post.metaDescription,
          seoTitle: item.post.title,
          seoDescription: item.post.metaDescription,
          contentHtml: renderMarkdown(item.post.content),
          contentMarkdown: item.post.content,
          tags: item.post.tags,
          status: "published",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Publishing failed (${res.status})`);
      }
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "published" } : q))
      );
      setPreviewId(null);
      toast.success(`Published "${item.post.title}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publishing failed.";
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "ready", error: message } : q))
      );
      toast.error(message);
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f4e8] text-[#1f4a35] dark:bg-[#25402f] dark:text-[#9fd0ac]">
            <Bot size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#1c3328] dark:text-[#d7e4da]">Blog Automation</h1>
            <p className="text-sm text-[#68776d] dark:text-[#8fa396]">
              Queue topics, generate drafts with Gemini, review, and publish.
            </p>
          </div>
        </div>
        <div className="rounded-full border border-[#e2e8e2] px-3 py-1 text-xs font-bold text-[#68776d] dark:border-[#2b3a30] dark:text-[#8fa396]">
          {pendingCount} pending · {queue.length} total
        </div>
      </div>

      {/* Topic input */}
      <section className="rounded-[22px] border border-[#edf0ed] bg-white p-5 shadow-[10px_12px_20px_rgba(65,84,70,.12)] dark:border-[#2b3a30] dark:bg-[#182420] dark:shadow-none">
        <label
          htmlFor="topic-input"
          className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1c3328] dark:text-[#d7e4da]"
        >
          <Sparkles size={15} className="text-[#1f4a35] dark:text-[#9fd0ac]" /> Add topics
        </label>
        <textarea
          id="topic-input"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder={"One topic per line, e.g.\nBest low-light succulents for Indian apartments\nHow to propagate Echeveria step by step"}
          rows={4}
          className="w-full resize-y rounded-xl border border-[#e2e8e2] bg-[#f8fbf7] p-3 text-sm text-[#243129] placeholder:text-[#a7b3aa] focus:border-[#1f4a35] focus:outline-none focus:ring-2 focus:ring-[#1f4a35]/20 dark:border-[#2b3a30] dark:bg-[#121a16] dark:text-[#c9d6cd] dark:placeholder:text-[#5c6b61] dark:focus:border-[#9fd0ac]"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={addTopics}
            className="flex items-center gap-2 rounded-xl bg-[#1f4a35] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#2a5f45]"
          >
            <Plus size={15} /> Add to queue
          </button>
        </div>
      </section>

      {/* Topic queue */}
      <section className="overflow-hidden rounded-[22px] border border-[#edf0ed] bg-white shadow-[10px_12px_20px_rgba(65,84,70,.12)] dark:border-[#2b3a30] dark:bg-[#182420] dark:shadow-none">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <Bot size={32} className="text-[#a7b3aa] dark:text-[#5c6b61]" />
            <p className="font-semibold text-[#68776d] dark:text-[#8fa396]">No topics in the queue</p>
            <p className="text-sm text-[#a7b3aa] dark:text-[#5c6b61]">
              Add one or more topics above to get started.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#edf0ed] dark:divide-[#2b3a30]">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 p-4 transition hover:bg-[#f8fbf7] sm:flex-row sm:items-center sm:justify-between dark:hover:bg-[#1e2b25]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#243129] dark:text-[#c9d6cd]">{item.topic}</p>
                  {item.status === "generating" ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#96691f] dark:text-[#d4a848]">
                      <Loader2 size={12} className="animate-spin" /> Generating with Gemini…
                    </p>
                  ) : item.status === "failed" && item.error ? (
                    <p className="mt-0.5 truncate text-xs text-[#b3574e] dark:text-[#e08a80]" title={item.error}>
                      {item.error}
                    </p>
                  ) : item.status === "published" ? (
                    <p className="mt-0.5 text-xs font-semibold text-[#256b3a] dark:text-[#9fd0ac]">Published ✓</p>
                  ) : item.status === "ready" ? (
                    <p className="mt-0.5 text-xs text-[#256b3a] dark:text-[#9fd0ac]">
                      Draft ready — preview &amp; publish
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {item.post && item.status !== "generating" ? (
                    <button
                      onClick={() => setPreviewId(item.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-[#e2e8e2] px-3 py-2 text-xs font-bold text-[#68776d] transition hover:bg-[#f0f4f0] dark:border-[#2b3a30] dark:text-[#8fa396] dark:hover:bg-[#243129]"
                    >
                      <Eye size={13} /> Preview
                    </button>
                  ) : null}
                  <button
                    onClick={() => generate(item)}
                    disabled={item.status === "generating" || item.status === "published"}
                    className="flex items-center gap-1.5 rounded-xl bg-[#1f4a35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2a5f45] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {item.status === "generating" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> {item.status === "ready" ? "Regenerate" : "Generate & Publish"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={item.status === "generating"}
                    className="rounded-xl border border-[#f0e2e2] p-2 text-[#b3574e] transition hover:bg-[#fdf4f3] disabled:opacity-40 dark:border-[#3d2a28] dark:hover:bg-[#2a1f1d]"
                    aria-label={`Remove "${item.topic}"`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewItem?.post ? (
        <PreviewModal
          post={previewItem.post}
          publishing={publishingId === previewItem.id}
          onClose={() => setPreviewId(null)}
          onPublish={() => publish(previewItem)}
        />
      ) : null}

      <ToastContainer position="bottom-right" />
    </div>
  );
}