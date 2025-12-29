"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Trash2,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { IconButton } from "@/components/ui/icon-button";

interface Log {
  id: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  metadata: string | null;
  createdAt: string;
}

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  platform: "twitter" | "youtube" | "instagram" | "reddit";
}

function LogLevelIcon({ level }: { level: Log["level"] }) {
  switch (level) {
    case "info":
      return <Info className="h-4 w-4 text-blue-400" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-400" />;
  }
}

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LogsModal({
  isOpen,
  onClose,
  accountId,
  platform,
}: LogsModalProps) {
  // Data states
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!accountId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/logs?accountId=${accountId}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchLogs();
    }
  }, [isOpen, accountId, fetchLogs]);

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/logs?accountId=${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear logs");
      setLogs([]);
      toast.success("Logs cleared");
    } catch {
      toast.error("Failed to clear logs");
    } finally {
      setIsClearing(false);
    }
  };

  const platformTitle =
    platform === "twitter"
      ? "Twitter"
      : platform === "youtube"
        ? "YouTube"
        : "Instagram";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border"
            style={{
              background:
                "linear-gradient(to bottom, rgba(30,30,35,0.98) 0%, rgba(20,20,25,0.99) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
              maxHeight: "80vh",
            }}
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-white/90">
                  {platformTitle} Logs
                </h2>
                {logs.length > 0 && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white/70"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    {logs.length}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {logs.length > 0 && (
                  <IconButton
                    icon={
                      isClearing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )
                    }
                    onClick={handleClearLogs}
                    label="Clear logs"
                    variant="danger"
                  />
                )}
                <IconButton
                  icon={<X className="h-4 w-4" />}
                  onClick={onClose}
                  label="Close"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4" data-lenis-prevent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                </div>
              ) : logs.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  <Info className="mb-2 h-8 w-8 text-white/30" />
                  <p className="text-sm text-white/50">No logs yet</p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="rounded-lg border border-white/5 p-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div className="mb-1 flex items-start gap-2">
                        <LogLevelIcon level={log.level} />
                        <p className="flex-1 text-sm leading-relaxed text-white/80">
                          {log.message}
                        </p>
                      </div>
                      <p className="ml-6 text-xs text-white/40">
                        {formatTimestamp(log.createdAt)}
                      </p>
                      {log.metadata && (
                        <pre className="mt-2 ml-6 overflow-x-auto rounded bg-black/30 p-2 text-xs text-white/50">
                          {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                        </pre>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
