import { useState, type FormEvent } from "react";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { ClockIcon } from "../components/icons";
import type { AccountStatus } from "../types";

interface LoginScreenProps {
  onLogin: (email: string, accountStatus: AccountStatus) => void;
}

const RESTRICTED_KEYWORDS: { keyword: string; status: AccountStatus }[] = [
  { keyword: "blocked", status: "blocked" },
  { keyword: "locked", status: "locked" },
  { keyword: "archived", status: "archived" },
  { keyword: "deleted", status: "session_deleted" },
];

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("ali@acme.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setError("");
    const match = RESTRICTED_KEYWORDS.find((r) => email.toLowerCase().includes(r.keyword));
    onLogin(email, match?.status ?? "active");
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="px-6 py-7">
        <div className="mb-7 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent bg-accent-dim">
            <ClockIcon className="h-[22px] w-[22px] text-accent" />
          </div>
          <div className="text-lg font-semibold tracking-tight">TrackDesk</div>
          <div className="text-xs text-muted">Time tracking for teams</div>
        </div>
        <FormField
          label="Work email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="mb-2 text-[11px] text-danger">{error}</div>}
        <Button type="submit">Sign in</Button>
        <div className="mt-3 text-center text-xs text-muted">
          or <span className="cursor-pointer text-blue">continue with SSO →</span>
        </div>
      </form>
    </Card>
  );
}
