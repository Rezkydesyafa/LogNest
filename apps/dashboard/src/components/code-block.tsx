'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Read-only code with a copy button. Wide snippets scroll inside the block, not the page. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <pre className="bg-muted max-h-80 overflow-auto rounded-md p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="outline"
        className="absolute top-2 right-2"
        onClick={copy}
        title={label ? `Copy ${label}` : 'Copy'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span className="sr-only">{copied ? 'Copied' : `Copy ${label ?? 'snippet'}`}</span>
      </Button>
    </div>
  );
}
