import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  supabaseUrl,
  supabasePublicKey,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Allow login page
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Local preview convenience: with no Supabase project configured there is no
  // one to authenticate against, so the guard would lock the admin out
  // entirely. Restricted to development — in production a missing or misspelled
  // env var used to silently disable auth on the whole admin area, which fails
  // open exactly when it matters most.
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // `response` is reassigned by setAll below. getUser() refreshes an expired
  // access token, and the refreshed cookies are written onto whatever response
  // object is current at that moment — so it has to be captured, not fixed up
  // front.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/admin/login", request.url);
    // Send them back where they were headed once they sign in.
    loginUrl.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search
    );

    const redirect = NextResponse.redirect(loginUrl);
    // Carry any cookies Supabase just refreshed onto the redirect. Returning a
    // bare redirect discards them, which silently signs out a user whose token
    // was mid-refresh — the session looks invalid on the next request and they
    // get bounced to the login screen while genuinely logged in.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
