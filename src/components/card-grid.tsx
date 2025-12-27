"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { SettingsModal } from "./settings-modal";
import { AccountModal } from "./account-modal";
import { YouTubeAccountModal } from "./youtube-account-modal";
import { InstagramAccountModal } from "./instagram-account-modal";
import { ConfirmModal } from "./confirm-modal";
import { LogsModal } from "./logs-modal";
import { DatabaseModal } from "./database-modal";
import { iconButtonHoverState } from "@/lib/animations";

interface Account {
  id: string;
  platform: "twitter" | "youtube" | "instagram";
  name: string;
  displayName: string;
  isConnected: boolean;
}

interface PlatformCardProps {
  account: Account;
  onSettingsClick: () => void;
  onAccountClick: () => void;
  onLogsClick: () => void;
  onDatabaseClick: () => void;
  onDeleteClick: () => void;
  canDelete: boolean;
}

interface AddAccountCardProps {
  platform: "twitter" | "youtube" | "instagram";
  onClick: () => void;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
};

const dangerButtonHoverState = {
  color: "rgba(239,68,68,1)",
  backgroundColor: "rgba(239,68,68,0.15)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

function PlatformCard({
  account,
  onSettingsClick,
  onAccountClick,
  onLogsClick,
  onDatabaseClick,
  onDeleteClick,
  canDelete,
}: PlatformCardProps) {
  const icon =
    account.platform === "twitter" ? (
      <Twitter className="h-12 w-12" />
    ) : account.platform === "youtube" ? (
      <Youtube className="h-12 w-12" />
    ) : (
      <Instagram className="h-12 w-12" />
    );

  const iconColor =
    account.platform === "twitter"
      ? "text-sky-400"
      : account.platform === "youtube"
        ? "text-red-500"
        : "text-pink-500";

  const label = account.displayName || account.platform;

  return (
    <motion.div
      className="group relative flex h-48 w-72 cursor-pointer flex-col overflow-hidden rounded-2xl border backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        borderColor: "rgba(255,255,255,0.1)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={{ borderColor: "rgba(255,255,255,0.4)" }}
      transition={{ duration: 0.2 }}
    >
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
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className={iconColor}>{icon}</div>
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex items-center justify-center gap-1 border-t border-white/10 px-4 py-3">
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
    ) : (
      <Instagram className="h-8 w-8" />
    );

  const iconColor =
    platform === "twitter"
      ? "text-sky-400/50"
      : platform === "youtube"
        ? "text-red-500/50"
        : "text-pink-500/50";
  const iconColorHover =
    platform === "twitter"
      ? "text-sky-400"
      : platform === "youtube"
        ? "text-red-500"
        : "text-pink-500";

  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative flex h-48 w-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        borderColor: "rgba(255,255,255,0.1)",
        borderStyle: "dashed",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
      whileHover={{
        borderColor: "rgba(255,255,255,0.4)",
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2">
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
        className="mt-3 text-sm font-semibold tracking-wide"
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
            : "Instagram"}
      </motion.span>
    </motion.button>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <motion.button
      className="relative rounded-lg px-2 py-2"
      style={{
        color: "rgba(255,255,255,0.5)",
        backgroundColor: "rgba(255,255,255,0)",
      }}
      whileHover={
        variant === "danger" ? dangerButtonHoverState : iconButtonHoverState
      }
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </motion.button>
  );
}

function Logo() {
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
      <h1 className="logo-rainbow select-none font-[family-name:var(--font-sixtyfour)] text-4xl tracking-tight">
        Viral Kid
      </h1>
    </motion.div>
  );
}

export function CardGrid() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [settingsModal, setSettingsModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const [accountModal, setAccountModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    accountId: string;
    platform: "twitter" | "youtube" | "instagram";
  }>({ isOpen: false, accountId: "", platform: "twitter" });

  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const [databaseModal, setDatabaseModal] = useState<{
    isOpen: boolean;
    platform: "twitter" | "youtube" | "instagram";
    accountId: string;
  }>({ isOpen: false, platform: "twitter", accountId: "" });

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();

      // If no accounts exist, create default Twitter, YouTube, and Instagram accounts
      if (data.length === 0) {
        await Promise.all([
          fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "twitter" }),
          }),
          fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "youtube" }),
          }),
          fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "instagram" }),
          }),
        ]);
        // Refetch after creating defaults
        const refetchRes = await fetch("/api/accounts");
        const refetchData = await refetchRes.json();
        setAccounts(refetchData);
      } else {
        setAccounts(data);
      }
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
    platform: "twitter" | "youtube" | "instagram"
  ) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (!res.ok) throw new Error("Failed to create account");

      await fetchAccounts();
    } catch (error) {
      console.error("Failed to create account:", error);
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
    } catch (error) {
      console.error("Failed to delete account:", error);
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

  // Separate accounts by platform
  const twitterAccounts = accounts.filter((a) => a.platform === "twitter");
  const youtubeAccounts = accounts.filter((a) => a.platform === "youtube");
  const instagramAccounts = accounts.filter((a) => a.platform === "instagram");

  // Find the first account of each platform (these cannot be deleted)
  const firstTwitterId = twitterAccounts[0]?.id;
  const firstYoutubeId = youtubeAccounts[0]?.id;
  const firstInstagramId = instagramAccounts[0]?.id;

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
                    canDelete={account.id !== firstTwitterId}
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
                    canDelete={account.id !== firstYoutubeId}
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
                    canDelete={account.id !== firstInstagramId}
                  />
                ))}
            </AnimatePresence>
            <AddAccountCard
              platform="instagram"
              onClick={() => handleCreateAccount("instagram")}
            />
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={settingsModal.isOpen}
        onClose={closeSettings}
        platform={settingsModal.platform}
        accountId={settingsModal.accountId}
      />

      {accountModal.platform === "twitter" ? (
        <AccountModal
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          platform="twitter"
          accountId={accountModal.accountId}
        />
      ) : accountModal.platform === "youtube" ? (
        <YouTubeAccountModal
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          accountId={accountModal.accountId}
        />
      ) : (
        <InstagramAccountModal
          isOpen={accountModal.isOpen}
          onClose={closeAccount}
          accountId={accountModal.accountId}
        />
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message={`Are you sure you want to delete this ${deleteModal.platform === "twitter" ? "Twitter" : deleteModal.platform === "youtube" ? "YouTube" : "Instagram"} account? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      <LogsModal
        isOpen={logsModal.isOpen}
        onClose={closeLogs}
        accountId={logsModal.accountId}
        platform={logsModal.platform}
      />

      <DatabaseModal
        isOpen={databaseModal.isOpen}
        onClose={closeDatabase}
        accountId={databaseModal.accountId}
        platform={databaseModal.platform}
      />
    </>
  );
}
