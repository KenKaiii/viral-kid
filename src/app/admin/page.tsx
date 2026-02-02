"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Mail,
  Shield,
  Users,
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

interface Invite {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  invitedByEmail: string;
  status: "pending" | "used" | "expired";
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isShaderLoaded, setIsShaderLoaded] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShaderLoad = useCallback(() => {
    setIsShaderLoaded(true);
  }, []);

  // Fetch invites
  const fetchInvites = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/invites");
      if (response.ok) {
        const data = await response.json();
        setInvites(data);
      } else if (response.status === 403) {
        toast.error("Access denied");
        router.push("/");
      }
    } catch {
      toast.error("Failed to fetch invites");
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

    fetchInvites();
  }, [session, status, router, fetchInvites]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to create invite");
        return;
      }

      toast.success(data.renewed ? "Invite renewed" : "Invite created");
      setNewEmail("");
      fetchInvites();
    } catch {
      toast.error("Failed to create invite");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async (invite: Invite) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/signup?token=${invite.token}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      toast.success("Invite link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDeleteInvite = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/invites/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Invite deleted");
        setInvites((prev) => prev.filter((i) => i.id !== id));
      } else {
        toast.error("Failed to delete invite");
      }
    } catch {
      toast.error("Failed to delete invite");
    }
  };

  const getStatusIcon = (status: Invite["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-amber-400" />;
      case "used":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "expired":
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: Invite["status"]) => {
    switch (status) {
      case "pending":
        return "text-amber-400";
      case "used":
        return "text-green-400";
      case "expired":
        return "text-red-400";
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
        <main className="relative min-h-screen overflow-hidden">
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
      <main className="relative min-h-screen overflow-hidden">
        <ShaderBackground onLoad={handleShaderLoad} />
        <div className="relative z-10 flex min-h-screen flex-col items-center p-8 pt-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex w-full max-w-2xl items-center justify-between"
          >
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
              style={{
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/admin/users"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
                style={{
                  background: "rgba(147, 51, 234, 0.2)",
                }}
              >
                <Users className="h-4 w-4 text-purple-400" />
                <span className="text-purple-300">Manage Users</span>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-white/70">Admin</span>
              </div>
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
                <Mail className="h-4 w-4 text-white/70" />
                <h2 className="text-sm font-semibold tracking-wide text-white/90">
                  Invite Management
                </h2>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                {invites.length} invite{invites.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Create Invite Form */}
            <div className="border-b border-white/10 p-6">
              <form onSubmit={handleCreateInvite} className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter email to invite..."
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
                    disabled={isCreating}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium"
                  style={{
                    color: isCreating
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(255,255,255,0.9)",
                    backgroundColor: isCreating
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(34,197,94,0.2)",
                    cursor: isCreating ? "not-allowed" : "pointer",
                  }}
                  whileHover={isCreating ? {} : buttonHoverState}
                  whileTap={isCreating ? {} : { scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isCreating ? "Creating..." : "Invite"}
                </motion.button>
              </form>
            </div>

            {/* Invites List */}
            <div className="max-h-[400px] overflow-y-auto p-4">
              {invites.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Mail className="h-8 w-8 text-white/20" />
                  <p className="text-sm text-white/40">No invites yet</p>
                  <p className="text-xs text-white/30">
                    Create your first invite above
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  <AnimatePresence>
                    {invites.map((invite) => (
                      <motion.div
                        key={invite.id}
                        variants={staggerItem}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center justify-between rounded-lg border p-4"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderColor: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-white/90">
                              {invite.email}
                            </span>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(invite.status)}
                              <span
                                className={`text-xs capitalize ${getStatusColor(invite.status)}`}
                              >
                                {invite.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                            <span>Created {formatDate(invite.createdAt)}</span>
                            <span>Expires {formatDate(invite.expiresAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {invite.status === "pending" && (
                            <motion.button
                              onClick={() => handleCopyLink(invite)}
                              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                color: "rgba(255,255,255,0.7)",
                              }}
                              whileHover={{
                                background: "rgba(255,255,255,0.1)",
                                color: "rgba(255,255,255,1)",
                              }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {copiedId === invite.id ? (
                                <>
                                  <Check className="h-3 w-3 text-green-400" />
                                  <span className="text-green-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy Link
                                </>
                              )}
                            </motion.button>
                          )}
                          <motion.button
                            onClick={() => handleDeleteInvite(invite.id)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5"
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              color: "rgba(239,68,68,0.7)",
                            }}
                            whileHover={{
                              background: "rgba(239,68,68,0.2)",
                              color: "rgba(239,68,68,1)",
                            }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </motion.button>
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
            Invites expire after 7 days. Copy the invite link and share it with
            the person you want to invite.
          </motion.p>
        </div>
      </main>
    </>
  );
}
