"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface Props {
  children: string;
  lang?: string;
  filename?: string;
}

export function CodeBlock({ children, lang, filename }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card/40">
      {(lang || filename) ? (
        <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{filename ?? lang}</span>
          {lang && filename ? (
            <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground/70">
              {lang}
            </span>
          ) : null}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-foreground">
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy"
        className="absolute right-2 top-2 rounded-md border border-border/60 bg-background/80 p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:border-foreground/30 hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3 w-3 text-signal-ok" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
