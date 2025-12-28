"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { ShaderBackground } from "@/components/ui/shader-background";
import { Preloader } from "@/components/ui/preloader";
import { modalVariants, buttonHoverState } from "@/lib/animations";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isShaderLoaded, setIsShaderLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState(false);

  const handleShaderLoad = useCallback(() => {
    setIsShaderLoaded(true);
  }, []);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError("No invite token provided");
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/signup?token=${token}`);
        const data = await response.json();

        if (data.valid) {
          setEmail(data.email);
          setTokenValid(true);
        } else {
          setTokenError(data.error || "Invalid invite token");
        }
      } catch {
        setTokenError("Failed to validate invite token");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, token }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to create account");
        return;
      }

      toast.success("Account created! Signing you in...");

      // Auto sign in after registration
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.error(
          "Account created but sign in failed. Please log in manually."
        );
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Preloader isLoaded={isShaderLoaded} />
      <main className="relative min-h-screen overflow-hidden">
        <ShaderBackground onLoad={handleShaderLoad} />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-8 rounded-2xl border border-white/10 px-8 py-4 backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
            }}
          >
            <h1 className="logo-rainbow select-none font-[family-name:var(--font-sixtyfour)] text-4xl tracking-tight">
              Viral Kid
            </h1>
          </motion.div>

          {/* Content */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md rounded-2xl border backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-center gap-2 border-b border-white/10 px-6 py-4"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(25,25,25,0.98) 100%)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/70" />
              ) : tokenValid ? (
                <UserPlus className="h-4 w-4 text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <h2 className="text-sm font-semibold tracking-wide text-white/90">
                {isValidating
                  ? "Validating Invite..."
                  : tokenValid
                    ? "Create Account"
                    : "Invalid Invite"}
              </h2>
            </div>

            {/* Body */}
            <div className="p-6">
              {isValidating ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                  <p className="text-sm text-white/50">
                    Validating your invite...
                  </p>
                </div>
              ) : tokenError ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div
                    className="flex items-center gap-2 rounded-lg px-4 py-3"
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                    }}
                  >
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <p className="text-sm text-red-400">{tokenError}</p>
                  </div>
                  <p className="text-center text-sm text-white/50">
                    Please contact the administrator for a valid invite.
                  </p>
                  <Link
                    href="/login"
                    className="mt-2 text-sm text-white/70 underline transition-colors hover:text-white"
                  >
                    Back to login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {/* Email (read-only) */}
                  <div className="mb-4">
                    <label
                      htmlFor="email"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90"
                    >
                      Email
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border px-4 py-3 text-white/60 outline-none backdrop-blur-xl"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    />
                    <p className="mt-1 text-xs text-white/40">
                      This email is linked to your invite
                    </p>
                  </div>

                  {/* Password */}
                  <div className="mb-4">
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password..."
                      className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none backdrop-blur-xl transition-all duration-200"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(255,255,255,0.3)";
                        e.target.style.background = "rgba(255,255,255,0.08)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(255,255,255,0.1)";
                        e.target.style.background = "rgba(255,255,255,0.05)";
                      }}
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Minimum 8 characters
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div className="mb-6">
                    <label
                      htmlFor="confirmPassword"
                      className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password..."
                      className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none backdrop-blur-xl transition-all duration-200"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "rgba(255,255,255,0.3)";
                        e.target.style.background = "rgba(255,255,255,0.08)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(255,255,255,0.1)";
                        e.target.style.background = "rgba(255,255,255,0.05)";
                      }}
                      disabled={isLoading}
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="relative flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium"
                    style={{
                      color: isLoading
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(255,255,255,0.9)",
                      backgroundColor: isLoading
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(34,197,94,0.2)",
                      cursor: isLoading ? "not-allowed" : "pointer",
                    }}
                    whileHover={isLoading ? {} : buttonHoverState}
                    whileTap={isLoading ? {} : { scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </motion.button>
                </form>
              )}
            </div>
          </motion.div>

          {/* Login link */}
          {tokenValid && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-sm text-white/40"
            >
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-white/70 underline transition-colors hover:text-white"
              >
                Sign in
              </Link>
            </motion.p>
          )}
        </div>
      </main>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
