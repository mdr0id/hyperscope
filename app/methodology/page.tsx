import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QuickNodeLogo } from "@/components/brand/QuickNodeLogo";

export const dynamic = "force-static";

export const metadata = {
  title: "Methodology · Hyperscope",
};

export default async function MethodologyPage() {
  const filePath = path.join(process.cwd(), "methodology.md");
  const content = await fs.readFile(filePath, "utf-8");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          ←
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-quicknode-green text-quicknode-ink">
            <QuickNodeLogo className="h-3 w-3" />
          </span>
          Hyperscope
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center text-xs text-muted-foreground transition hover:text-foreground"
        >
          API & reports →
        </Link>
      </div>

      <article className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, ...props }) => (
              <h1
                className="mb-4 mt-2 text-3xl font-semibold tracking-tight text-foreground"
                {...props}
              >
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2
                className="mb-3 mt-8 text-xl font-semibold tracking-tight text-foreground"
                {...props}
              >
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3
                className="mb-2 mt-5 text-base font-medium text-foreground"
                {...props}
              >
                {children}
              </h3>
            ),
            p: ({ children, ...props }) => (
              <p {...props}>{children}</p>
            ),
            strong: ({ children, ...props }) => (
              <strong className="text-foreground" {...props}>
                {children}
              </strong>
            ),
            code: ({ children, ...props }) => (
              <code
                className="rounded border border-border/60 bg-card/60 px-1 py-0.5 font-mono text-[12px] text-foreground"
                {...props}
              >
                {children}
              </code>
            ),
            ul: ({ children, ...props }) => (
              <ul className="list-disc space-y-1 pl-6" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal space-y-1 pl-6" {...props}>
                {children}
              </ol>
            ),
            a: ({ children, href, ...props }) => (
              <a
                href={href}
                className="text-signal-info underline-offset-2 hover:underline"
                {...props}
              >
                {children}
              </a>
            ),
            table: ({ children, ...props }) => (
              <div className="my-4 overflow-x-auto">
                <table
                  className="w-full border-collapse text-[12px]"
                  {...props}
                >
                  {children}
                </table>
              </div>
            ),
            th: ({ children, ...props }) => (
              <th
                className="border-b border-border bg-card/50 px-3 py-2 text-left font-medium text-muted-foreground"
                {...props}
              >
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td
                className="border-b border-border/40 px-3 py-2 align-top"
                {...props}
              >
                {children}
              </td>
            ),
            hr: (props) => <hr className="my-6 border-border" {...props} />,
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="border-l-2 border-border pl-4 italic"
                {...props}
              >
                {children}
              </blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
