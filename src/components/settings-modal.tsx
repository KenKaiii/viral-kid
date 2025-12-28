"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  backdropVariants,
  modalVariants,
  dropdownVariants,
  iconButtonHoverState,
  buttonHoverState,
} from "@/lib/animations";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: "twitter" | "youtube" | "instagram" | "reddit";
  accountId: string;
}

const SCHEDULE_OPTIONS = [
  { value: "every_5_min", label: "Every 5 minutes" },
  { value: "every_10_min", label: "Every 10 minutes" },
  { value: "every_30_min", label: "Every 30 minutes" },
  { value: "every_hour", label: "Every hour" },
  { value: "every_3_hours", label: "Every 3 hours" },
  { value: "every_6_hours", label: "Every 6 hours" },
];

const TIME_RANGE_OPTIONS = [
  { value: "hour", label: "Last hour" },
  { value: "day", label: "Last 24 hours" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
];

function ModalButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium"
      style={{
        color: disabled
          ? "rgba(255,255,255,0.3)"
          : isPrimary
            ? "rgba(255,255,255,0.9)"
            : "rgba(255,255,255,0.5)",
        backgroundColor: disabled
          ? "rgba(255,255,255,0.02)"
          : isPrimary
            ? "rgba(255,255,255,0.1)"
            : "rgba(255,255,255,0.05)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      whileHover={disabled ? {} : buttonHoverState}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.button>
  );
}

function IconButton({
  icon,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="relative rounded-lg p-2"
      style={{
        color: "rgba(255,255,255,0.5)",
        backgroundColor: "rgba(255,255,255,0)",
      }}
      whileHover={iconButtonHoverState}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      title={label}
      aria-label={label}
    >
      {icon}
    </motion.button>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  platform,
  accountId,
}: SettingsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [schedule, setSchedule] = useState("every_hour");
  const [minimumLikesCount, setMinimumLikesCount] = useState(20);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reddit-specific state
  const [keywords, setKeywords] = useState("");
  const [timeRange, setTimeRange] = useState("day");
  const [minimumUpvotes, setMinimumUpvotes] = useState(10);
  const [isTimeRangeDropdownOpen, setIsTimeRangeDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeRangeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Close time range dropdown when clicking outside
  useEffect(() => {
    if (!isTimeRangeDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        timeRangeDropdownRef.current &&
        !timeRangeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTimeRangeDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTimeRangeDropdownOpen]);

  useEffect(() => {
    if (isOpen && accountId) {
      setIsLoading(true);
      const apiPath =
        platform === "twitter"
          ? `/api/twitter/configuration?accountId=${accountId}`
          : platform === "youtube"
            ? `/api/youtube/configuration?accountId=${accountId}`
            : platform === "reddit"
              ? `/api/reddit/configuration?accountId=${accountId}`
              : `/api/instagram/configuration?accountId=${accountId}`;

      fetch(apiPath)
        .then((res) => {
          if (!res.ok) throw new Error("API error");
          return res.json();
        })
        .then((data) => {
          // Twitter-specific
          if (data.searchTerm !== undefined) {
            setSearchTerm(data.searchTerm);
          }
          if (data.minimumLikesCount !== undefined) {
            setMinimumLikesCount(data.minimumLikesCount);
          }
          // Reddit-specific
          if (data.keywords !== undefined) {
            setKeywords(data.keywords);
          }
          if (data.timeRange !== undefined) {
            setTimeRange(data.timeRange);
          }
          if (data.minimumUpvotes !== undefined) {
            setMinimumUpvotes(data.minimumUpvotes);
          }
          // Common
          if (data.schedule) {
            setSchedule(data.schedule);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, platform, accountId]);

  const handleSave = async () => {
    if (!accountId) return;

    setIsSaving(true);
    try {
      const apiPath =
        platform === "twitter"
          ? `/api/twitter/configuration?accountId=${accountId}`
          : platform === "youtube"
            ? `/api/youtube/configuration?accountId=${accountId}`
            : platform === "reddit"
              ? `/api/reddit/configuration?accountId=${accountId}`
              : `/api/instagram/configuration?accountId=${accountId}`;

      let body: string;
      if (platform === "twitter") {
        body = JSON.stringify({ searchTerm, schedule, minimumLikesCount });
      } else if (platform === "reddit") {
        body = JSON.stringify({
          keywords,
          timeRange,
          minimumUpvotes,
          schedule,
        });
      } else {
        body = JSON.stringify({ schedule });
      }

      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        throw new Error("Failed to save configuration");
      }

      toast.success("Settings saved");
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedScheduleLabel =
    SCHEDULE_OPTIONS.find((opt) => opt.value === schedule)?.label ??
    "Select schedule";

  const selectedTimeRangeLabel =
    TIME_RANGE_OPTIONS.find((opt) => opt.value === timeRange)?.label ??
    "Select time range";

  const platformTitle =
    platform === "twitter"
      ? "Twitter"
      : platform === "youtube"
        ? "YouTube"
        : platform === "reddit"
          ? "Reddit"
          : "Instagram";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-md rounded-2xl border backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
            }}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">
                {platformTitle} Settings
              </h2>
              <IconButton
                icon={<X className="h-4 w-4" />}
                onClick={onClose}
                label="Close"
              />
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Loading overlay */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                animate={{ opacity: isLoading ? 0.3 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Search Term Input - Twitter only */}
                {platform === "twitter" && (
                  <div className="mb-5">
                    <label
                      htmlFor="searchTerm"
                      className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                    >
                      Search Term
                    </label>
                    <input
                      id="searchTerm"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Enter search term..."
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
                    />
                  </div>
                )}

                {/* Minimum Likes Count - Twitter only */}
                {platform === "twitter" && (
                  <div className="mb-5">
                    <label
                      htmlFor="minimumLikesCount"
                      className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                    >
                      Minimum Likes
                    </label>
                    <input
                      id="minimumLikesCount"
                      type="number"
                      min="0"
                      value={minimumLikesCount}
                      onChange={(e) =>
                        setMinimumLikesCount(
                          Math.max(0, parseInt(e.target.value) || 0)
                        )
                      }
                      placeholder="20"
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
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Only show tweets with at least this many likes
                    </p>
                  </div>
                )}

                {/* Keywords Input - Reddit only */}
                {platform === "reddit" && (
                  <div className="mb-5">
                    <label
                      htmlFor="keywords"
                      className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                    >
                      Keywords
                    </label>
                    <input
                      id="keywords"
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="protein powder, supplements, fitness"
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
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Separate multiple keywords with commas
                    </p>
                  </div>
                )}

                {/* Time Range Dropdown - Reddit only */}
                {platform === "reddit" && (
                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-semibold tracking-wide text-white/90">
                      Time Range
                    </label>
                    <div className="relative" ref={timeRangeDropdownRef}>
                      <motion.button
                        type="button"
                        onClick={() =>
                          setIsTimeRangeDropdownOpen(!isTimeRangeDropdownOpen)
                        }
                        className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left backdrop-blur-xl"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          borderColor: isTimeRangeDropdownOpen
                            ? "rgba(255,255,255,0.3)"
                            : "rgba(255,255,255,0.1)",
                        }}
                        whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="text-white/90">
                          {selectedTimeRangeLabel}
                        </span>
                        <motion.div
                          animate={{
                            rotate: isTimeRangeDropdownOpen ? 180 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-5 w-5 text-white/50" />
                        </motion.div>
                      </motion.button>

                      <AnimatePresence>
                        {isTimeRangeDropdownOpen && (
                          <motion.div
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border backdrop-blur-xl"
                            style={{
                              background:
                                "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.98) 100%)",
                              borderColor: "rgba(255,255,255,0.15)",
                              boxShadow:
                                "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
                            }}
                          >
                            {TIME_RANGE_OPTIONS.map((option, index) => (
                              <motion.button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setTimeRange(option.value);
                                  setIsTimeRangeDropdownOpen(false);
                                }}
                                className="w-full px-4 py-3 text-left"
                                style={{
                                  color:
                                    timeRange === option.value
                                      ? "rgba(255,255,255,1)"
                                      : "rgba(255,255,255,0.5)",
                                  backgroundColor:
                                    timeRange === option.value
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0)",
                                }}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.02 }}
                                whileHover={{
                                  backgroundColor: "rgba(255,255,255,0.08)",
                                  color: "rgba(255,255,255,1)",
                                }}
                              >
                                {option.label}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="mt-1 text-xs text-white/40">
                      Only search posts from this time period
                    </p>
                  </div>
                )}

                {/* Minimum Upvotes - Reddit only */}
                {platform === "reddit" && (
                  <div className="mb-5">
                    <label
                      htmlFor="minimumUpvotes"
                      className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                    >
                      Minimum Upvotes
                    </label>
                    <input
                      id="minimumUpvotes"
                      type="number"
                      min="0"
                      value={minimumUpvotes}
                      onChange={(e) =>
                        setMinimumUpvotes(
                          Math.max(0, parseInt(e.target.value) || 0)
                        )
                      }
                      placeholder="10"
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
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Only reply to posts with at least this many upvotes
                    </p>
                  </div>
                )}

                {/* Schedule Dropdown */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-semibold tracking-wide text-white/90">
                    Schedule
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <motion.button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left backdrop-blur-xl"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderColor: isDropdownOpen
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(255,255,255,0.1)",
                      }}
                      whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className="text-white/90">
                        {selectedScheduleLabel}
                      </span>
                      <motion.div
                        animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-white/50" />
                      </motion.div>
                    </motion.button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          variants={dropdownVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border backdrop-blur-xl"
                          style={{
                            background:
                              "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.98) 100%)",
                            borderColor: "rgba(255,255,255,0.15)",
                            boxShadow:
                              "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
                          }}
                        >
                          {SCHEDULE_OPTIONS.map((option, index) => (
                            <motion.button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setSchedule(option.value);
                                setIsDropdownOpen(false);
                              }}
                              className="w-full px-4 py-3 text-left"
                              style={{
                                color:
                                  schedule === option.value
                                    ? "rgba(255,255,255,1)"
                                    : "rgba(255,255,255,0.5)",
                                backgroundColor:
                                  schedule === option.value
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0)",
                              }}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.02 }}
                              whileHover={{
                                backgroundColor: "rgba(255,255,255,0.08)",
                                color: "rgba(255,255,255,1)",
                              }}
                            >
                              {option.label}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 border-t border-white/10 pt-6">
                  <ModalButton onClick={onClose} variant="secondary">
                    Cancel
                  </ModalButton>
                  <ModalButton
                    onClick={handleSave}
                    disabled={isSaving}
                    variant="primary"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </ModalButton>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
