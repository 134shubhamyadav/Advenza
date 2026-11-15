/**
 * MarkdownMessage — Safe, styled Markdown renderer for Advenza AI chat.
 *
 * Uses react-markdown + remark-gfm (GitHub Flavored Markdown: tables, task lists,
 * strikethrough) + rehype-sanitize (DOMPurify-equivalent server-safe sanitizer).
 *
 * Security model:
 * - rehype-sanitize uses the defaultSchema which is based on GitHub's whitelist.
 * - Only safe HTML tags (p, ul, ol, li, strong, em, code, pre, table, a …) are allowed.
 * - Script tags, event handlers (onclick, onerror …), data: URIs, and javascript: hrefs
 *   are stripped before the HTML ever reaches the DOM.
 * - External links open in a new tab with rel="noopener noreferrer".
 *
 * Usage:
 *   <MarkdownMessage content={aiReplyText} />
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

// Merge defaultSchema to also allow `target` and `rel` on <a> tags,
// which the sanitizer normally strips (we set them in the renderer below
// and need to whitelist them so they survive sanitization).
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
};

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div
      className={cn(
        // prose-sm gives tight, chat-appropriate spacing
        "prose prose-sm dark:prose-invert max-w-none",
        // Colour overrides to match Advenza glass-panel text
        "prose-p:text-foreground prose-p:leading-relaxed prose-p:my-1.5",
        "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1",
        "prose-h1:text-base prose-h2:text-sm prose-h3:text-sm",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-em:text-foreground/80",
        "prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-foreground",
        "prose-ol:my-1.5 prose-ol:pl-4",
        "prose-code:bg-muted prose-code:text-foreground prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono",
        "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto",
        // Tables: slim, card-like appearance
        "prose-table:border prose-table:border-border/50 prose-table:rounded-lg prose-table:overflow-hidden prose-table:text-xs",
        "prose-th:bg-muted prose-th:text-foreground prose-th:font-semibold prose-th:px-3 prose-th:py-2 prose-th:border-b prose-th:border-border/50",
        "prose-td:px-3 prose-td:py-1.5 prose-td:border-b prose-td:border-border/30 prose-td:text-foreground/90",
        // Links: primary colour, safe external behaviour
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        // Horizontal rule
        "prose-hr:border-border/40 prose-hr:my-3",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          // Open all links in new tab with safe rel attribute
          a({ href, children, ...rest }) {
            const isSafe =
              href &&
              !href.startsWith("javascript:") &&
              !href.startsWith("data:");
            return isSafe ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...rest}
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            );
          },

          // Inline code — keep our compact style
          code({ className: cName, children, ...rest }) {
            const isBlock = cName?.includes("language-");
            if (isBlock) {
              // Block code: wrap in <pre> and preserve language class
              return (
                <code className={cName} {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="bg-muted text-foreground rounded px-1 py-0.5 text-xs font-mono"
                {...rest}
              >
                {children}
              </code>
            );
          },

          // Tables: add horizontal scroll wrapper for mobile
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 rounded-lg border border-border/50">
                <table className="w-full text-xs">{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

