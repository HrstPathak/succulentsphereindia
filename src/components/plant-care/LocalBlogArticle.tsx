export default function LocalBlogArticle({ contentHtml }: { contentHtml: string }) {
  return (
    <article
      className="ss-local-blog-host"
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );
}