import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders organizer-written Markdown. Raw HTML is never rendered (react-markdown default) and
 * unsafe link protocols are stripped, so page text cannot inject scripts. Images are not allowed
 * (they would load from other sites).
 */
const components: Components = {
  h1: ({ children }) => <h2 className="mt-6 mb-2 text-xl font-bold uppercase">{children}</h2>,
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 text-lg font-bold tracking-wide text-cyan uppercase">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1 font-mono text-sm tracking-widest text-magenta uppercase">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-warn bg-surface-2 px-3 py-1 text-muted">
      {children}
    </blockquote>
  ),
  code: ({ children }) => <code className="rounded bg-surface-2 px-1 font-mono text-sm">{children}</code>,
  a: ({ href, children }) => {
    const external = !!href && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="text-cyan underline underline-offset-2"
        {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      >
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Table (scrolls sideways)">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border p-2 text-left font-mono text-xs uppercase">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border p-2">{children}</td>,
  hr: () => <hr className="my-6 border-border" />,
};

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
        disallowedElements={["img"]}
        unwrapDisallowed
      >
        {source}
      </Markdown>
    </div>
  );
}
