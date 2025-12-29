"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Trash2,
  Database,
  Eye,
  Heart,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { IconButton } from "@/components/ui/icon-button";

interface TweetInteraction {
  id: string;
  tweetId: string;
  userTweet: string;
  username: string;
  views: number;
  hearts: number;
  replies: number;
  ourReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  platform: "twitter" | "youtube" | "instagram" | "reddit";
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TruncatedText({
  text,
  subtitle,
  className = "",
}: {
  text: string;
  subtitle?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // Check if text is actually truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollHeight, clientHeight } = textRef.current;
        setIsTruncated(scrollHeight > clientHeight);
      }
    };

    checkTruncation();

    const resizeObserver = new ResizeObserver(checkTruncation);
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [text]);

  const handleMouseEnter = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      top: rect.bottom + 4,
      left: rect.left,
    });
    setIsHovered(true);
  };

  const canRenderPortal = typeof document !== "undefined";

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      {subtitle && <div className="mb-1 text-xs text-white/40">{subtitle}</div>}
      <div ref={textRef} className="line-clamp-2 text-sm text-white/80">
        {text}
      </div>

      {/* Portal tooltip to body */}
      {canRenderPortal &&
        isHovered &&
        isTruncated &&
        createPortal(
          <div
            className="pointer-events-none rounded-lg border p-3"
            style={{
              position: "fixed",
              top: tooltipPos.top,
              left: Math.min(tooltipPos.left, window.innerWidth - 320),
              zIndex: 99999,
              maxWidth: 300,
              background: "rgba(0, 0, 0, 0.95)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            }}
          >
            {subtitle && (
              <div className="mb-1 text-xs text-white/40">{subtitle}</div>
            )}
            <div className="text-sm leading-relaxed text-white/90">{text}</div>
          </div>,
          document.body
        )}
    </div>
  );
}

function TweetCell({ text, username }: { text: string; username: string }) {
  return (
    <td className="relative max-w-xs px-3 py-3">
      <TruncatedText text={text} subtitle={`@${username}`} />
    </td>
  );
}

export function DatabaseModal({
  isOpen,
  onClose,
  accountId,
  platform,
}: DatabaseModalProps) {
  // Data states
  const [tweets, setTweets] = useState<TweetInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchTweets = useCallback(async () => {
    if (!accountId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/tweets?accountId=${accountId}`);
      if (!res.ok) throw new Error("Failed to fetch tweets");
      const data = await res.json();
      setTweets(data);
    } catch (error) {
      console.error("Failed to fetch tweets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchTweets();
    }
  }, [isOpen, accountId, fetchTweets]);

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/tweets?accountId=${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear tweets");
      setTweets([]);
      toast.success("Data cleared");
    } catch {
      toast.error("Failed to clear data");
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
            className="relative z-10 flex w-full max-w-4xl flex-col rounded-2xl border"
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
                  {platformTitle} Database
                </h2>
                {tweets.length > 0 && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white/70"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    {tweets.length}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {tweets.length > 0 && (
                  <IconButton
                    icon={
                      isClearing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )
                    }
                    onClick={handleClearAll}
                    label="Clear all"
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
            <div className="flex-1 overflow-auto p-4" data-lenis-prevent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                </div>
              ) : tweets.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  <Database className="mb-2 h-8 w-8 text-white/30" />
                  <p className="text-sm text-white/50">No data yet</p>
                </motion.div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/50">
                        <th className="px-3 py-3 font-medium">User Tweet</th>
                        <th className="w-20 px-3 py-3 text-center font-medium">
                          <Eye className="mx-auto h-4 w-4" />
                        </th>
                        <th className="w-20 px-3 py-3 text-center font-medium">
                          <Heart className="mx-auto h-4 w-4" />
                        </th>
                        <th className="w-20 px-3 py-3 text-center font-medium">
                          <MessageCircle className="mx-auto h-4 w-4" />
                        </th>
                        <th className="w-28 px-3 py-3 font-medium">Time</th>
                        <th className="px-3 py-3 font-medium">Our Reply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tweets.map((tweet, index) => (
                        <motion.tr
                          key={tweet.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-b border-white/5 transition-colors hover:bg-white/5"
                        >
                          <TweetCell
                            text={tweet.userTweet}
                            username={tweet.username}
                          />
                          <td className="px-3 py-3 text-center text-sm text-white/60">
                            {formatNumber(tweet.views)}
                          </td>
                          <td className="px-3 py-3 text-center text-sm text-white/60">
                            {formatNumber(tweet.hearts)}
                          </td>
                          <td className="px-3 py-3 text-center text-sm text-white/60">
                            {formatNumber(tweet.replies ?? 0)}
                          </td>
                          <td className="px-3 py-3 text-xs text-white/50">
                            {formatTimestamp(tweet.createdAt)}
                          </td>
                          <td className="relative max-w-xs px-3 py-3">
                            {tweet.ourReply ? (
                              <TruncatedText text={tweet.ourReply} />
                            ) : (
                              <span className="text-xs text-white/30">
                                No reply
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
