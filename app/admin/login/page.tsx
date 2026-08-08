"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-baseline justify-center gap-0.5 mb-2">
            <span className="font-display text-[14px] font-bold text-dark-brown tracking-[3px] uppercase">
              VIS
            </span>
            <span className="font-display text-[14px] font-bold text-dark-brown tracking-[3px] uppercase italic">
              LASHES
            </span>
          </div>
          <h1 className="font-display text-[28px] font-bold text-dark-brown">
            Admin Login
          </h1>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-lg p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="admin@vislashes.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p className="text-danger text-[13px] font-sans">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
