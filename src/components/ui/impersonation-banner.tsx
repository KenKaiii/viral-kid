"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserCog, X } from "lucide-react";
import toast from "react-hot-toast";

export function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();

  // Only show if admin is impersonating someone
  if (!session?.user?.impersonatingUserId || session.user.role !== "ADMIN") {
    return null;
  }

  const handleStopImpersonation = async () => {
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Stopped acting as user");
        // Refresh the session to clear impersonation data
        await update();
        router.push("/admin/users");
        router.refresh();
      } else {
        toast.error("Failed to stop acting as user");
      }
    } catch {
      toast.error("Failed to stop acting as user");
    }
  };

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2"
      style={{
        background:
          "linear-gradient(to right, rgba(147, 51, 234, 0.9), rgba(79, 70, 229, 0.9))",
        backdropFilter: "blur(8px)",
      }}
    >
      <UserCog className="h-4 w-4 text-white" />
      <span className="text-sm font-medium text-white">
        Acting as{" "}
        <span className="font-semibold">
          {session.user.impersonatingUserEmail}
        </span>
      </span>
      <motion.button
        onClick={handleStopImpersonation}
        className="ml-2 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white"
        style={{
          background: "rgba(255, 255, 255, 0.2)",
        }}
        whileHover={{
          background: "rgba(255, 255, 255, 0.3)",
        }}
        whileTap={{ scale: 0.95 }}
      >
        <X className="h-3 w-3" />
        Exit
      </motion.button>
    </motion.div>
  );
}
