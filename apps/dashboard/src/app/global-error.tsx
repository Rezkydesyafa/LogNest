'use client';

import './globals.css';

/**
 * Last-resort boundary. Replaces the whole document, so it cannot rely on the app shell,
 * the theme provider, or any component that might itself be the thing that failed.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              {error.message || 'The dashboard failed to load.'}
            </p>
            <button
              onClick={reset}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              Reload the dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
