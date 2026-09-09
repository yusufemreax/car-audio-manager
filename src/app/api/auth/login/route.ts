import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isAuthSessionConfigured,
} from "@/lib/auth-session";
import { verifyPassword } from "@/lib/auth-password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function invalidLoginResponse() {
  await new Promise((resolve) => setTimeout(resolve, 650));

  return NextResponse.json(
    {
      success: false,
      message: "Kullanıcı adı veya şifre hatalı.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const configuredUsername =
      process.env.APP_LOGIN_USER?.trim();
    const configuredPasswordHash =
      process.env.APP_LOGIN_PASSWORD_HASH?.trim();

    if (
      !configuredUsername ||
      !configuredPasswordHash ||
      !isAuthSessionConfigured()
    ) {
      console.error(
        "Login configuration missing: APP_LOGIN_USER, APP_LOGIN_PASSWORD_HASH veya APP_SESSION_TOKEN tanımlı değil."
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Giriş sistemi yapılandırılmamış. Vercel Environment Variables ayarlarını kontrol edin.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          username?: unknown;
          password?: unknown;
        }
      | null;

    const username = cleanString(body?.username);
    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    if (!username || !password) {
      return invalidLoginResponse();
    }

    const usernameMatches =
      username === configuredUsername;
    const passwordMatches = verifyPassword(
      password,
      configuredPasswordHash
    );

    if (!usernameMatches || !passwordMatches) {
      return invalidLoginResponse();
    }

    const token = await createSessionToken(
      configuredUsername
    );

    const response = NextResponse.json(
      {
        success: true,
        message: "Giriş başarılı.",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Giriş sırasında bir hata oluştu.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}
