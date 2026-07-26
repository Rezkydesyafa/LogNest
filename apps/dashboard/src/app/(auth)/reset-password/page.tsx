'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ActivityIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));

    if (password !== String(data.get('confirm'))) {
      setError('Both passwords must match');
      return;
    }

    setPending(true);
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const payload = await response.json().catch(() => ({}));
    setPending(false);

    if (!response.ok) {
      const detail = payload.error?.message ?? payload.error ?? 'Could not reset the password';
      setError(Array.isArray(detail) ? detail.join(', ') : detail);
      return;
    }

    toast.success('Password updated. Sign in with your new password.');
    router.replace('/login');
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <ActivityIcon className="size-5" />
            <span className="font-semibold">LogMind AI</span>
          </div>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Every existing session is signed out once you confirm.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>This link is incomplete</AlertTitle>
              <AlertDescription>Request a new reset link and open it directly.</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              </FieldGroup>
              <Button type="submit" className="mt-5 w-full" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}Update password
              </Button>
            </form>
          )}
          <p className="text-muted-foreground text-center text-sm">
            <Link href="/login" className="underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
