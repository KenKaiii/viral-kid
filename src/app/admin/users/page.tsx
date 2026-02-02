"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Shield,
  Users,
  UserCog,
  Crown,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { ShaderBackground } from "@/components/ui/shader-background";
import { Preloader } from "@/components/ui/preloader";
import {
  modalVariants,
  buttonHoverState,
  staggerContainer,
  staggerItem,
} from "@/lib/animations";

interface User {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
  createdAt: string;
  accountCount: number;
  connectedPlatforms: string[];
}

const platformIcons: Record<string, string> = {
  twitter: "𝕏",
  youtube: "▶",
  instagram: "📷",
  reddit: "🔴",
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isShaderLoaded, setIsShaderLoaded] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingAsId, setActingAsId] = useState<string | null>(null);

  const handleShaderLoad = useCallback(() => {
    setIsShaderLoaded(true);
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else if (response.status === 403) {
        toast.error("Access denied");
        router.push("/");
      }
    } catch {
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.push("/login");
      return;
    }

    if (session.user.role !== "ADMIN") {
      toast.error("Access denied");
      router.push("/");
      return;
    }

    fetchUsers();
  }, [session, status, router, fetchUsers]);

  const handleActAs = async (user: User) => {
    if (user.role === "ADMIN") {
      toast.error("Cannot act as another admin");
      return;
    }

    setActingAsId(user.id);

    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        toast.success(`Now acting as ${user.email}`);
        // Redirect to main dashboard
        router.push("/");
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to act as user");
      }
    } catch {
      toast.error("Failed to act as user");
    } finally {
      setActingAsId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (status === "loading" || (session?.user?.role === "ADMIN" && isLoading)) {
    return (
      <>
        <Preloader isLoaded={isShaderLoaded} />
        <main className="relative min-h-screen">
          <ShaderBackground onLoad={handleShaderLoad} />
          <div className="relative z-10 flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Preloader isLoaded={isShaderLoaded} />
      <main className="relative min-h-screen">
        <ShaderBackground onLoad={handleShaderLoad} />
        <div className="relative z-10 flex min-h-screen flex-col items-center p-8 pt-16 pb-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex w-full max-w-2xl items-center justify-between"
          >
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
              style={{
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-white/70">
                User Management
              </span>
            </div>
          </motion.div>

          {/* Main Card */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-2xl rounded-2xl border backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
            }}
          >
            {/* Card Header */}
            <div
              className="flex items-center justify-between border-b border-white/10 px-6 py-4"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(25,25,25,0.98) 100%)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white/70" />
                <h2 className="text-sm font-semibold tracking-wide text-white/90">
                  All Users
                </h2>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                {users.length} user{users.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Users List */}
            <div
              className="max-h-[60vh] overflow-y-auto p-4"
              data-lenis-prevent
            >
              {users.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Users className="h-8 w-8 text-white/20" />
                  <p className="text-sm text-white/40">No users found</p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  <AnimatePresence>
                    {users.map((user) => (
                      <motion.div
                        key={user.id}
                        variants={staggerItem}
                        className="flex items-center justify-between rounded-lg border p-4"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderColor: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-white/90">
                              {user.email}
                            </span>
                            {user.role === "ADMIN" && (
                              <div className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5">
                                <Crown className="h-3 w-3 text-purple-400" />
                                <span className="text-xs text-purple-400">
                                  Admin
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                            <span>Joined {formatDate(user.createdAt)}</span>
                            <span>
                              {user.accountCount} account
                              {user.accountCount !== 1 ? "s" : ""}
                            </span>
                            {user.connectedPlatforms.length > 0 && (
                              <span className="flex items-center gap-1">
                                {user.connectedPlatforms.map((platform) => (
                                  <span
                                    key={platform}
                                    title={platform}
                                    className="text-sm"
                                  >
                                    {platformIcons[platform] || "•"}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="ml-4">
                          {user.role !== "ADMIN" &&
                            user.id !== session?.user?.id && (
                              <motion.button
                                onClick={() => handleActAs(user)}
                                disabled={actingAsId === user.id}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                                style={{
                                  background: "rgba(147, 51, 234, 0.2)",
                                  color: "rgba(192, 132, 252, 1)",
                                }}
                                whileHover={
                                  actingAsId === user.id
                                    ? {}
                                    : {
                                        ...buttonHoverState,
                                        background: "rgba(147, 51, 234, 0.3)",
                                      }
                                }
                                whileTap={
                                  actingAsId === user.id ? {} : { scale: 0.95 }
                                }
                              >
                                {actingAsId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserCog className="h-4 w-4" />
                                )}
                                {actingAsId === user.id
                                  ? "Loading..."
                                  : "Act as"}
                              </motion.button>
                            )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Info text */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 max-w-md text-center text-sm text-white/40"
          >
            Click &quot;Act as&quot; to view and manage a user&apos;s dashboard
            on their behalf. A banner will appear when acting as another user.
          </motion.p>
        </div>
      </main>
    </>
  );
}
