'use client';

import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Catches a render error inside the dashboard shell.
 *
 * Without this a single failing component blanks the whole page; here the navigation stays
 * usable and the user can retry the segment rather than reloading the app.
 */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>This page could not be rendered</AlertTitle>
        <AlertDescription>{error.message || 'An unexpected error occurred.'}</AlertDescription>
      </Alert>
      <Button onClick={reset}>
        <RotateCcwIcon data-icon="inline-start" />
        Try again
      </Button>
    </div>
  );
}
