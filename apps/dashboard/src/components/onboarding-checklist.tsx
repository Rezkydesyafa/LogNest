'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';
import { api, queryString } from '@/lib/api';
import { onboardingComplete, onboardingSteps } from '@/lib/snippets';
import type { ApiKey, Log, Page } from '@/lib/types';
import { CreateProjectDialog, useProject } from '@/components/project-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * First-run checklist.
 *
 * Registering leaves someone on an empty dashboard with no obvious next move; this names the
 * three steps, marks them off from real data, and disappears once logs are arriving.
 */
export function OnboardingChecklist() {
  const { projectId, projects, can } = useProject();

  const keys = useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => api<ApiKey[]>(`/projects/${projectId}/api-keys`),
    // Only admins may list keys; for everyone else the step is assumed done.
    enabled: Boolean(projectId) && can('manageApiKeys'),
  });
  const logs = useQuery({
    queryKey: ['logs', 'onboarding', projectId],
    queryFn: () => api<Page<Log>>(`/logs${queryString({ projectId, limit: 1 })}`),
    enabled: Boolean(projectId),
  });

  const steps = onboardingSteps({
    hasProject: projects.length > 0,
    hasServerKey: !can('manageApiKeys') || (keys.data ?? []).some((key) => !key.revokedAt),
    hasLogs: (logs.data?.total ?? 0) > 0,
  });

  // Never flash the checklist while the answer is still loading.
  if (logs.isLoading || onboardingComplete(steps)) return null;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Finish setting up</CardTitle>
        <CardDescription>Three steps until this project is receiving logs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-label="Done" />
              ) : (
                <CircleIcon className="text-muted-foreground/50 mt-0.5 size-5 shrink-0" aria-label="To do" />
              )}
              <div className="min-w-0">
                <p
                  className={step.done ? 'text-muted-foreground text-sm line-through' : 'text-sm font-medium'}
                >
                  {step.title}
                </p>
                <p className="text-muted-foreground text-xs">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          {!projects.length && <CreateProjectDialog />}
          {projects.length > 0 && can('manageApiKeys') && (
            <Button asChild variant={steps[1].done ? 'outline' : 'default'}>
              <Link href="/api-keys">{steps[1].done ? 'View API keys' : 'Create an API key'}</Link>
            </Button>
          )}
          {steps[1].done && (
            <Button asChild variant="outline">
              <Link href="/logs">Open Logs</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
