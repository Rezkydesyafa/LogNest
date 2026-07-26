'use client';

import { integrationSnippets } from '@/lib/snippets';
import { CodeBlock } from '@/components/code-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Shows how to send logs with a key that was just created, while it is still visible. */
export function IntegrationGuide({
  apiKey,
  serviceName,
  environment,
}: {
  apiKey: string;
  serviceName?: string;
  environment?: string;
}) {
  const endpoint =
    process.env.NEXT_PUBLIC_LOGMIND_API_URL ||
    (typeof window === 'undefined' ? 'http://localhost:3000' : `${window.location.origin}/backend`);
  const snippets = integrationSnippets({ apiKey, endpoint, serviceName, environment });

  return (
    <Tabs defaultValue={snippets[0].id}>
      <TabsList>
        {snippets.map((snippet) => (
          <TabsTrigger key={snippet.id} value={snippet.id}>
            {snippet.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {snippets.map((snippet) => (
        <TabsContent key={snippet.id} value={snippet.id} className="space-y-2">
          <p className="text-muted-foreground text-sm">{snippet.description}</p>
          <CodeBlock code={snippet.code} label={snippet.title} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
