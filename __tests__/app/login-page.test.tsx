/**
 * Login page `?error=` banner (Phase 2, Task 8).
 *
 * The app sends people to /login with an error code when it signs them out
 * (session expired, profile setup failed, account disabled). The page used to
 * ignore it and say "Welcome back". Each known code must render its message
 * in the alert; anything else — the query string is attacker-controlled — must
 * render nothing at all.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LOGIN_ERROR_MESSAGES, loginErrorMessage } from "@/lib/auth/login-errors";

let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => search,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: vi.fn(), signInWithOAuth: vi.fn() },
  }),
}));

import LoginPage from "@/app/(auth)/login/page";

beforeEach(() => {
  cleanup();
  search = new URLSearchParams();
});

describe("loginErrorMessage", () => {
  it("maps every known code to copy", () => {
    for (const code of Object.keys(LOGIN_ERROR_MESSAGES)) {
      expect(loginErrorMessage(code)).toBe(
        LOGIN_ERROR_MESSAGES[code as keyof typeof LOGIN_ERROR_MESSAGES]
      );
    }
  });

  it("returns null for anything else, including prototype keys", () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
    expect(loginErrorMessage("<script>alert(1)</script>")).toBeNull();
    expect(loginErrorMessage("constructor")).toBeNull();
    expect(loginErrorMessage("__proto__")).toBeNull();
  });
});

describe("/login?error=", () => {
  it.each(Object.entries(LOGIN_ERROR_MESSAGES))(
    "renders the banner for %s",
    (code, message) => {
      search = new URLSearchParams({ error: code });

      render(<LoginPage />);

      expect(screen.getByRole("alert").textContent).toContain(message);
    }
  );

  it("renders no banner for an unknown code", () => {
    search = new URLSearchParams({ error: "<script>alert(1)</script>" });

    render(<LoginPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body.innerHTML).not.toContain("<script>");
  });

  it("renders no banner without a code", () => {
    render(<LoginPage />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
