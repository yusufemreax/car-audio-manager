import {
  LoginForm,
} from "@/components/auth/login-form";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
  }>;
}

function getSafeNextPath(value: string | string[] | undefined) {
  const candidate =
    typeof value === "string" ? value : "/";

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/login")
  ) {
    return "/";
  }

  return candidate;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  return (
    <LoginForm
      nextPath={getSafeNextPath(params.next)}
    />
  );
}
