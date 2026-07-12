"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ActivityIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const register = mode === "register"
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })
    const payload = await response.json().catch(() => ({}))
    setPending(false)
    if (!response.ok) {
      const detail = payload.error?.message ?? payload.error ?? "Authentication failed"
      setError(Array.isArray(detail) ? detail.join(", ") : detail)
      return
    }
    router.replace("/overview"); router.refresh()
  }
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><div className="mb-2 flex items-center gap-2"><ActivityIcon /><span className="font-semibold">LogMind AI</span></div><CardTitle>{register ? "Create account" : "Welcome back"}</CardTitle><CardDescription>{register ? "Start monitoring your services." : "Sign in to your operations workspace."}</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-5">
            {error && <Alert variant="destructive"><AlertTitle>Unable to continue</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            <FieldGroup>
              {register && <Field><FieldLabel htmlFor="name">Name</FieldLabel><Input id="name" name="name" autoComplete="name" required minLength={2} /></Field>}
              <Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(error)} /></Field>
              <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="password">Password</FieldLabel><Input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={8} aria-invalid={Boolean(error)} />{error && <FieldError>Check your credentials and try again.</FieldError>}</Field>
            </FieldGroup>
            <Button type="submit" disabled={pending}>{pending && <Spinner data-icon="inline-start" />}{register ? "Create account" : "Sign in"}</Button>
            <p className="text-center text-sm text-muted-foreground">{register ? "Already have an account?" : "New to LogMind?"} <Link className="font-medium text-foreground underline underline-offset-4" href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create account"}</Link></p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
