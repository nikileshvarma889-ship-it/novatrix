"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

/** Normalises \( \) and \[ \] math delimiters to $ / $$ so KaTeX renders them. */
function normaliseMath(s: string) {
  // short snippets (quiz options, flashcards): repair math the model forgot to delimit or left unclosed
  if (s.length < 300 && !s.includes("\n")) {
    const singles = s.replace(/\$\$/g, "").split("$").length - 1;
    if (singles === 0 && /\\(frac|text|sqrt|mathrm|times|cdot|pi|theta|alpha|beta|Delta|lambda|mu|omega|circ|rightarrow|le|ge)\b|\^\{|_\{/.test(s)) s = "$" + s + "$";
    else if (singles % 2 === 1) s = s + "$";
  }
  return s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => "\n$$" + m + "$$\n")
    // $$…$$ written mid-line: put it on its own lines so it renders as a display equation
    .replace(/([^\n])[ \t]*\$\$([^$\n]+?)\$\$[ \t]*/g, (_, before: string, m: string) => before + "\n\n$$" + m + "$$\n\n")
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => "$" + m + "$");
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-memora", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{ a: ({ href, children }) => <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{children}</a> }}
      >
        {normaliseMath(children)}
      </ReactMarkdown>
    </div>
  );
}

export function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  return <Markdown className="[&_p]:my-0">{block ? "$$" + tex + "$$" : "$" + tex + "$"}</Markdown>;
}
