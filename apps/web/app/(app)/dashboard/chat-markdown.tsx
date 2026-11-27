import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const REMARK_PLUGINS = [remarkGfm];

// The assistant answers in Markdown: mostly paragraphs, lists and tables of documents. Raw HTML in its output is not rendered.
const COMPONENTS: Components = {
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  td: ({ children }) => (
    <td className="border-t px-3 py-2 align-top tabular-nums">{children}</td>
  ),
  th: ({ children }) => (
    <th className="bg-muted/50 px-3 py-2 font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
};

export function ChatMarkdown({ text }: { readonly text: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
}
