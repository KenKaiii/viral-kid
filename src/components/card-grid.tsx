"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Twitter,
  Youtube,
  Instagram,
  Database,
  Settings,
  FileText,
  User,
  Plus,
  Trash2,
  LogOut,
  Play,
  Square,
  FlaskConical,
  Loader2,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { SettingsModal } from "./settings-modal";
import { AccountModal } from "./account-modal";
import { YouTubeAccountModal } from "./youtube-account-modal";
import { InstagramAccountModal } from "./instagram-account-modal";
import { RedditAccountModal } from "./reddit-account-modal";

// Custom Reddit icon since lucide-react doesn't have one
function RedditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}
import { ConfirmModal } from "./confirm-modal";
import { LogsModal } from "./logs-modal";
import { DatabaseModal } from "./database-modal";
import {
  iconButtonHoverState,
  buttonHoverState,
  dangerIconButtonHoverState,
  playButtonHoverState,
  stopButtonHoverState,
  testButtonHoverState,
} from "@/lib/animations";

interface SetupStatus {
  oauth: boolean;
  apiKey: boolean;
  searchTerm: boolean;
  openRouter: boolean;
  llmModel: boolean;
}

interface Account {
  id: string;
  platform: "twitter" | "youtube" | "instagram" | "reddit";
  name: string;
  displayName: string;
  isConnected: boolean;
  setup: SetupStatus;
  isReady: boolean;
  isAutomationEnabled: boolean;
}

interface PlatformCardProps {
  account: Account;
  onSettingsClick: () => void;
  onAccountClick: () => void;
  onLogsClick: () => void;
  onDatabaseClick: () => void;
  onDeleteClick: () => void;
  onToggleAutomation: () => void;
  onTestPipeline: () => void;
  canDelete: boolean;
  isRunning: boolean;
  isToggling: boolean;
}

interface AddAccountCardProps {
  platform: "twitter" | "youtube" | "instagram" | "reddit";
  onClick: () => void;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: {
      type: "tween" as const,
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
};

function PlatformCard({
  account,
  onSettingsClick,
  onAccountClick,
  onLogsClick,
  onDatabaseClick,
  onDeleteClick,
  onToggleAutomation,
  onTestPipeline,
  canDelete,
  isRunning,
  isToggling,
}: PlatformCardProps) {
  const icon =
    account.platform === "twitter" ? (
      <Twitter className="h-12 w-12" />
    ) : account.platform === "youtube" ? (
      <Youtube className="h-12 w-12" />
    ) : account.platform === "instagram" ? (
      <Instagram className="h-12 w-12" />
    ) : (
      <RedditIcon className="h-12 w-12" />
    );

  const iconColor =
    account.platform === "twitter"
      ? "text-sky-400"
      : account.platform === "youtube"
        ? "text-red-500"
        : account.platform === "instagram"
          ? "text-pink-500"
          : "text-orange-500";

  const label = account.displayName || account.platform;

  // Get setup items based on platform
  const getSetupItems = () => {
    const items = [
      {
        label:
          account.platform === "twitter"
            ? "Twitter"
            : account.platform === "youtube"
              ? "YouTube"
              : account.platform === "instagram"
                ? "Instagram"
                : "Reddit",
        done: account.setup.oauth,
      },
    ];

    // Twitter-specific requirements
    if (account.platform === "twitter") {
      items.push(
        { label: "RapidAPI", done: account.setup.apiKey },
        { label: "Search Term", done: account.setup.searchTerm }
      );
    }

    // Reddit-specific requirements
    if (account.platform === "reddit") {
      items.push({ label: "Keywords", done: account.setup.searchTerm });
    }

    items.push(
      { label: "OpenRouter", done: account.setup.openRouter },
      { label: "LLM Model", done: account.setup.llmModel }
    );

    return items;
  };

  const setupItems = getSetupItems();
  const completedCount = setupItems.filter((item) => item.done).length;
  const allComplete = completedCount === setupItems.length;

  const [isSetupExpanded, setIsSetupExpanded] = useState(false);

  return (
    <motion.div
      className="group relative flex w-72 cursor-pointer flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: "rgba(255,255,255,0.15)",
        boxShadow:
          "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
      }}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={{
        borderColor: "rgba(255,255,255,0.3)",
        boxShadow:
          "0 8px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)",
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Glass background - static layer */}
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)",
        }}
      />
      {/* Label */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4">
        <h3 className="text-sm font-semibold capitalize tracking-wide text-white/90">
          {label}
        </h3>
        {account.isConnected && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400"
          >
            Connected
          </motion.span>
        )}
      </div>

      {/* Icon */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-3">
        <div className={iconColor}>{icon}</div>
      </div>

      {/* Setup Checklist - Collapsible */}
      <div className="relative z-10 mx-4 mb-3 rounded-xl border border-white/5 bg-white/[0.03] overflow-hidden">
        {/* Header - Always visible */}
        <button
          type="button"
          onClick={() => setIsSetupExpanded(!isSetupExpanded)}
          className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isSetupExpanded ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3 text-white/40" />
            </motion.div>
            <span
              className={`text-xs font-medium ${
                allComplete ? "text-green-400" : "text-amber-400"
              }`}
            >
              {allComplete ? "Ready" : "Not Ready"}
            </span>
          </div>
          <span className="text-[10px] font-medium text-white/40">
            {completedCount}/{setupItems.length}
          </span>
        </button>

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {isSetupExpanded && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="origin-top overflow-hidden"
            >
              <div className="space-y-1 px-3 pb-2 pt-1 border-t border-white/5">
                {setupItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.03 }}
                  >
                    <div
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                        item.done
                          ? "bg-green-500/20 text-green-400"
                          : "bg-white/5 text-white/20"
                      }`}
                    >
                      {item.done ? (
                        <Check className="h-2 w-2" strokeWidth={3} />
                      ) : (
                        <X className="h-2 w-2" strokeWidth={3} />
                      )}
                    </div>
                    <span
                      className={`text-xs ${
                        item.done ? "text-white/70" : "text-white/30"
                      }`}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex items-center justify-center gap-1 border-t border-white/10 px-4 py-3">
        {/* Play/Stop Toggle */}
        <ActionButton
          icon={
            isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : account.isAutomationEnabled ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )
          }
          label={
            isToggling
              ? "Toggling..."
              : account.isAutomationEnabled
                ? "Stop Automation"
                : "Start Automation"
          }
          onClick={onToggleAutomation}
          variant={account.isAutomationEnabled ? "stop" : "play"}
          disabled={isToggling || !account.isReady}
        />
        {/* Test Pipeline */}
        <ActionButton
          icon={
            isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )
          }
          label={isRunning ? "Testing..." : "Test Pipeline"}
          onClick={onTestPipeline}
          variant="test"
          disabled={isRunning || !account.isReady}
        />
        <ActionButton
          icon={<Database className="h-4 w-4" />}
          label="Database"
          onClick={onDatabaseClick}
        />
        <ActionButton
          icon={<FileText className="h-4 w-4" />}
          label="Logs"
          onClick={onLogsClick}
        />
        <ActionButton
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          onClick={onSettingsClick}
        />
        <ActionButton
          icon={<User className="h-4 w-4" />}
          label="Account"
          onClick={onAccountClick}
        />
        {canDelete && (
          <ActionButton
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete"
            onClick={onDeleteClick}
            variant="danger"
          />
        )}
      </div>
    </motion.div>
  );
}

function AddAccountCard({ platform, onClick }: AddAccountCardProps) {
  const icon =
    platform === "twitter" ? (
      <Twitter className="h-8 w-8" />
    ) : platform === "youtube" ? (
      <Youtube className="h-8 w-8" />
    ) : platform === "instagram" ? (
      <Instagram className="h-8 w-8" />
    ) : (
      <RedditIcon className="h-8 w-8" />
    );

  const iconColor =
    platform === "twitter"
      ? "text-sky-400/50"
      : platform === "youtube"
        ? "text-red-500/50"
        : platform === "instagram"
          ? "text-pink-500/50"
          : "text-orange-500/50";
  const iconColorHover =
    platform === "twitter"
      ? "text-sky-400"
      : platform === "youtube"
        ? "text-red-500"
        : platform === "instagram"
          ? "text-pink-500"
          : "text-orange-500";

  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative flex h-48 w-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border"
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        borderStyle: "dashed",
        boxShadow:
          "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.1)",
      }}
      whileHover={{
        borderColor: "rgba(255,255,255,0.3)",
        boxShadow:
          "0 8px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.1)",
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glass background - static layer */}
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
        }}
      />
      <div className="relative z-10 flex items-center gap-2">
        <motion.div
          className={isHovered ? iconColorHover : iconColor}
          animate={{ color: isHovered ? undefined : undefined }}
        >
          {icon}
        </motion.div>
        <motion.div
          animate={{
            color: isHovered
              ? "rgba(255,255,255,0.8)"
              : "rgba(255,255,255,0.3)",
          }}
          transition={{ duration: 0.2 }}
        >
          <Plus className="h-6 w-6" />
        </motion.div>
      </div>
      <motion.span
        className="relative z-10 mt-3 text-sm font-semibold tracking-wide"
        animate={{
          color: isHovered ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
        }}
        transition={{ duration: 0.2 }}
      >
        Add{" "}
        {platform === "twitter"
          ? "Twitter"
          : platform === "youtube"
            ? "YouTube"
            : platform === "instagram"
              ? "Instagram"
              : "Reddit"}
      </motion.span>
    </motion.button>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "danger" | "play" | "stop" | "test";
  disabled?: boolean;
}) {
  const getHoverState = () => {
    if (disabled) return {};
    if (variant === "danger") return dangerIconButtonHoverState;
    if (variant === "play") return playButtonHoverState;
    if (variant === "stop") return stopButtonHoverState;
    if (variant === "test") return testButtonHoverState;
    return iconButtonHoverState;
  };

  // Active state colors for enabled automation
  const getActiveColor = () => {
    if (variant === "stop") return "rgba(239,68,68,0.8)"; // Red when automation is on
    return disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)";
  };

  return (
    <motion.button
      className="relative rounded-lg px-2 py-2"
      style={{
        color: getActiveColor(),
        backgroundColor: "rgba(255,255,255,0)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      whileHover={getHoverState()}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onClick={disabled ? undefined : onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      {icon}
    </motion.button>
  );
}

function Logo() {
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mb-12 rounded-2xl border border-white/10 px-8 py-4 backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
      }}
    >
      <h1 className="logo-rainbow select-none font-[family-name:var(--font-logo)] text-4xl tracking-tight">
        Viral Kid
      </h1>
      {session?.user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-3 flex items-center justify-center gap-3 border-t border-white/10 pt-3"
        >
          <span className="text-sm text-white/50">
            Logged in as{" "}
            <span className="text-white/70">{session.user.email}</span>
          </span>
          <motion.button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{
              color: "rgba(255,255,255,0.5)",
              backgroundColor: "rgba(255,255,255,0)",
            }}
            whileHover={buttonHoverState}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Logout</span>
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

export function CardGrid() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningAccounts, setRunningAccounts] = useState<Set<string>>(
    new Set()
  );
  const [togglingAccounts, setTogglingAccounts] = useState<Set<string>>(
    new Set()
  );

  const [settingsModal, setSettingsModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram" | "reddit";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const [accountModal, setAccountModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram" | "reddit";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    accountId: string;
    platform: "twitter" | "youtube" | "instagram" | "reddit";
  }>({ isOpen: false, accountId: "", platform: "twitter" });

  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram" | "reddit";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const [databaseModal, setDatabaseModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram" | "reddit";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreateAccount = async (
    platform: "twitter" | "youtube" | "instagram" | "reddit"
  ) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (!res.ok) throw new Error("Failed to create account");

      await fetchAccounts();
      toast.success("Account created");
    } catch {
      toast.error("Failed to create account");
    }
  };

  const openDeleteModal = (account: Account) => {
    setDeleteModal({
      isOpen: true,
      accountId: account.id,
      platform: account.platform,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDeleteAccount = async () => {
    const accountId = deleteModal.accountId;

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete account");

      // Optimistically remove from accounts state (no refetch needed)
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast.success("Account deleted");
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const openSettings = (account: Account) => {
    setSettingsModal({
      isOpen: true,
      platform: account.platform,
      accountId: account.id,
    });
  };

  const closeSettings = () => {
    setSettingsModal((prev) => ({ ...prev, isOpen: false }));
    // Refresh accounts to update setup status (search term, etc.)
    fetchAccounts();
  };

  const openAccount = (account: Account) => {
    setAccountModal({
      isOpen: true,
      platform: account.platform,
      accountId: account.id,
    });
  };

  const closeAccount = () => {
    setAccountModal((prev) => ({ ...prev, isOpen: false }));
    // Refresh accounts to update connection status
    fetchAccounts();
  };

  const openLogs = (account: Account) => {
    setLogsModal({
      isOpen: true,
      platform: account.platform,
      accountId: account.id,
    });
  };

  const closeLogs = () => {
    setLogsModal((prev) => ({ ...prev, isOpen: false }));
  };

  const openDatabase = (account: Account) => {
    setDatabaseModal({
      isOpen: true,
      platform: account.platform,
      accountId: account.id,
    });
  };

  const closeDatabase = () => {
    setDatabaseModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleRunPipeline = async (account: Account) => {
    if (runningAccounts.has(account.id)) return;

    setRunningAccounts((prev) => new Set(prev).add(account.id));

    try {
      // Determine the API endpoint based on platform
      const endpoint =
        account.platform === "twitter"
          ? "/api/twitter/run"
          : account.platform === "youtube"
            ? "/api/youtube/run"
            : account.platform === "instagram"
              ? "/api/instagram/run"
              : "/api/reddit/run";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Pipeline failed");
      }

      if (data.replied) {
        const platformMessage =
          account.platform === "twitter"
            ? `Replied to tweet by @${data.repliedTo}`
            : account.platform === "youtube"
              ? `Replied to comment by ${data.repliedTo}`
              : account.platform === "instagram"
                ? `Replied to ${data.repliedTo}`
                : `Replied to u/${data.repliedTo}`;
        toast.success(platformMessage);
      } else if (data.message) {
        toast(data.message, { icon: "ℹ️" });
      } else {
        toast.success("Pipeline completed");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run pipeline"
      );
    } finally {
      setRunningAccounts((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  const handleToggleAutomation = async (account: Account) => {
    if (togglingAccounts.has(account.id)) return;

    setTogglingAccounts((prev) => new Set(prev).add(account.id));

    try {
      const endpoint =
        account.platform === "twitter"
          ? "/api/twitter/toggle"
          : account.platform === "youtube"
            ? "/api/youtube/toggle"
            : account.platform === "instagram"
              ? "/api/instagram/toggle"
              : "/api/reddit/toggle";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          enabled: !account.isAutomationEnabled,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle automation");
      }

      // Refresh accounts to get updated state
      await fetchAccounts();

      toast.success(data.enabled ? "Automation started" : "Automation stopped");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle automation"
      );
    } finally {
      setTogglingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  // Separate accounts by platform
  const twitterAccounts = accounts.filter((a) => a.platform === "twitter");
  const youtubeAccounts = accounts.filter((a) => a.platform === "youtube");
  const instagramAccounts = accounts.filter((a) => a.platform === "instagram");
  const redditAccounts = accounts.filter((a) => a.platform === "reddit");

  // Find the first account of each platform (these cannot be deleted)
  const firstTwitterId = twitterAccounts[0]?.id;
  const firstYoutubeId = youtubeAccounts[0]?.id;
  const firstInstagramId = instagramAccounts[0]?.id;
  const firstRedditId = redditAccounts[0]?.id;

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <Logo />

        {/* Three columns: Twitter, YouTube, Instagram */}
        <div className="flex gap-6">
          {/* Twitter Column */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLoading &&
                twitterAccounts.map((account) => (
                  <PlatformCard
                    key={account.id}
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onLogsClick={() => openLogs(account)}
                    onDatabaseClick={() => openDatabase(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    onToggleAutomation={() => handleToggleAutomation(account)}
                    onTestPipeline={() => handleRunPipeline(account)}
                    canDelete={account.id !== firstTwitterId}
                    isRunning={runningAccounts.has(account.id)}
                    isToggling={togglingAccounts.has(account.id)}
                  />
                ))}
            </AnimatePresence>
            <AddAccountCard
              platform="twitter"
              onClick={() => handleCreateAccount("twitter")}
            />
          </div>

          {/* YouTube Column */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLoading &&
                youtubeAccounts.map((account) => (
                  <PlatformCard
                    key={account.id}
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onLogsClick={() => openLogs(account)}
                    onDatabaseClick={() => openDatabase(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    onToggleAutomation={() => handleToggleAutomation(account)}
                    onTestPipeline={() => handleRunPipeline(account)}
                    canDelete={account.id !== firstYoutubeId}
                    isRunning={runningAccounts.has(account.id)}
                    isToggling={togglingAccounts.has(account.id)}
                  />
                ))}
            </AnimatePresence>
            <AddAccountCard
              platform="youtube"
              onClick={() => handleCreateAccount("youtube")}
            />
          </div>

          {/* Instagram Column */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLoading &&
                instagramAccounts.map((account) => (
                  <PlatformCard
                    key={account.id}
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onLogsClick={() => openLogs(account)}
                    onDatabaseClick={() => openDatabase(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    onToggleAutomation={() => handleToggleAutomation(account)}
                    onTestPipeline={() => handleRunPipeline(account)}
                    canDelete={account.id !== firstInstagramId}
                    isRunning={runningAccounts.has(account.id)}
                    isToggling={togglingAccounts.has(account.id)}
                  />
                ))}
            </AnimatePresence>
            <AddAccountCard
              platform="instagram"
              onClick={() => handleCreateAccount("instagram")}
            />
          </div>

          {/* Reddit Column */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLoading &&
                redditAccounts.map((account) => (
                  <PlatformCard
                    key={account.id}
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onLogsClick={() => openLogs(account)}
                    onDatabaseClick={() => openDatabase(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    onToggleAutomation={() => handleToggleAutomation(account)}
                    onTestPipeline={() => handleRunPipeline(account)}
                    canDelete={account.id !== firstRedditId}
                    isRunning={runningAccounts.has(account.id)}
                    isToggling={togglingAccounts.has(account.id)}
                  />
                ))}
            </AnimatePresence>
            <AddAccountCard
              platform="reddit"
              onClick={() => handleCreateAccount("reddit")}
            />
          </div>
        </div>
      </div>

      <SettingsModal
        key={`settings-${settingsModal.accountId}`}
        isOpen={settingsModal.isOpen}
        onClose={closeSettings}
        platform={settingsModal.platform}
        accountId={settingsModal.accountId}
      />

      {accountModal.platform === "twitter" ? (
        <AccountModal
          key={`account-${accountModal.accountId}`}
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          platform="twitter"
          accountId={accountModal.accountId}
        />
      ) : accountModal.platform === "youtube" ? (
        <YouTubeAccountModal
          key={`account-${accountModal.accountId}`}
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          accountId={accountModal.accountId}
        />
      ) : accountModal.platform === "instagram" ? (
        <InstagramAccountModal
          key={`account-${accountModal.accountId}`}
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          accountId={accountModal.accountId}
        />
      ) : (
        <RedditAccountModal
          key={`account-${accountModal.accountId}`}
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          accountId={accountModal.accountId}
        />
      )}

      <ConfirmModal
        key={`confirm-${deleteModal.accountId}`}
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message={`Are you sure you want to delete this ${deleteModal.platform === "twitter" ? "Twitter" : deleteModal.platform === "youtube" ? "YouTube" : deleteModal.platform === "instagram" ? "Instagram" : "Reddit"} account? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      <LogsModal
        key={`logs-${logsModal.accountId}`}
        isOpen={logsModal.isOpen}
        onClose={closeLogs}
        accountId={logsModal.accountId}
        platform={logsModal.platform}
      />

      <DatabaseModal
        key={`database-${databaseModal.accountId}`}
        isOpen={databaseModal.isOpen}
        onClose={closeDatabase}
        accountId={databaseModal.accountId}
        platform={databaseModal.platform}
      />
    </>
  );
}
