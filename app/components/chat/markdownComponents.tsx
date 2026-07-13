import type { Components } from 'react-markdown';

// Shared renderer map for AI messages. Styled with semantic tokens so
// dark mode works without per-usage overrides.
export const markdownComponents: Components = {
    strong: ({ node, ...props }) => <span className="font-bold" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-2 my-2" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-2 my-2" {...props} />,
    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
    blockquote: ({ node, ...props }) => (
        <blockquote className="border-l-4 border-kesri/40 pl-3 py-1 my-2 text-ink-faint italic bg-surface rounded-r" {...props} />
    ),
    a: ({ node, ...props }) => (
        <a
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-text underline underline-offset-2 hover:opacity-80 break-words"
            {...props}
        />
    ),
    // react-markdown v10 removed the `inline` prop: style code as an inline
    // chip and neutralize it inside pre blocks via the [&_code] variant below.
    code: ({ node, ...props }) => (
        <code className="bg-surface text-ink rounded px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />
    ),
    pre: ({ node, ...props }) => (
        <pre
            className="bg-navy text-offwhite rounded-lg p-3 my-2 overflow-x-auto text-sm [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
            {...props}
        />
    ),
    // Descend from the page's sr-only <h1> without skipping a level
    h1: ({ node, ...props }) => <h2 className="font-bold text-lg mt-3 mb-1" {...props} />,
    h2: ({ node, ...props }) => <h3 className="font-bold text-base mt-3 mb-1" {...props} />,
    h3: ({ node, ...props }) => <h4 className="font-bold text-base mt-3 mb-1" {...props} />,
    table: ({ node, ...props }) => (
        <div className="overflow-x-auto my-2">
            <table className="w-full text-sm border-collapse" {...props} />
        </div>
    ),
    th: ({ node, ...props }) => (
        <th className="border border-edge bg-surface px-2 py-1 text-left font-semibold" {...props} />
    ),
    td: ({ node, ...props }) => <td className="border border-edge px-2 py-1" {...props} />,
};
