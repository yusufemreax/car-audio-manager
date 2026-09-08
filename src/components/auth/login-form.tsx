"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  nextPath: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
}

export function LoginForm({
  nextPath,
}: LoginFormProps) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Kullanıcı adı ve şifre zorunludur.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? "Giriş yapılamadı."
        );
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Giriş sırasında bir hata oluştu."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.08),transparent_30%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Box className="size-6" />
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Car Audio
            </h1>
            <p className="text-sm text-muted-foreground">
              Yönetim Sistemi
            </p>
          </div>
        </div>

        <Card className="border bg-background/95 shadow-xl shadow-black/5 backdrop-blur">
          <CardHeader className="space-y-2 pb-5 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl border bg-muted/40">
              <LockKeyhole className="size-5 text-muted-foreground" />
            </div>

            <CardTitle className="text-2xl">
              Giriş Yap
            </CardTitle>

            <CardDescription>
              Sisteme devam etmek için kullanıcı bilgilerinizi girin.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="username">
                  Kullanıcı Adı
                </Label>

                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                    placeholder="Kullanıcı adınız"
                    className="h-11 pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Şifre
                </Label>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Şifreniz"
                    className="h-11 px-10"
                    disabled={submitting}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={
                      showPassword
                        ? "Şifreyi gizle"
                        : "Şifreyi göster"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Giriş Yap
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Car Audio Manager • Yetkili kullanıcı erişimi
        </p>
      </div>
    </main>
  );
}
