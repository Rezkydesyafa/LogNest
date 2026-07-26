'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ActivityIcon, MailCheckIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const email = String(new FormData(event.currentTarget).get('email'));
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);

    setPending(false);
    // Always the same outcome: a different message for a known address would let anyone
    // probe which emails have accounts.
    setSent(true);
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <ActivityIcon className="size-5" />
            <span className="font-semibold">LogMind AI</span>
          </div>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We will send a reset link if an account exists for that email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <Alert>
              <MailCheckIcon />
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>
                If that email has an account, a reset link is on its way. The link expires in 30 minutes.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </Field>
              </FieldGroup>
              <Button type="submit" className="mt-5 w-full" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}Send reset link
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
