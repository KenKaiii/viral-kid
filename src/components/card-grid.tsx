"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Twitter,
  Youtube,
  Instagram,
  Play,
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
  onDeleteClick: () => void;
  canDelete: boolean;
  animationClass?: string;
}

interface AddAccountCardProps {
  platform: "twitter" | "youtube" | "instagram";
  onClick: () => void;
}

function PlatformCard({
  account,
  onSettingsClick,
  onAccountClick,
  onDeleteClick,
  canDelete,
  animationClass,
}: PlatformCardProps) {
  const [isHovered, setIsHovered] = useState(false);

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
    <div
      className={`group relative flex h-48 w-72 cursor-pointer flex-col overflow-hidden rounded-2xl border backdrop-blur-xl ${animationClass || ""}`}
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        borderColor: isHovered
          ? "rgba(255,255,255,0.4)"
          : "rgba(255,255,255,0.1)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        transition: "border-color 0.3s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Label */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4">
        <h3 className="text-sm font-semibold capitalize tracking-wide text-white/90">
          {label}
        </h3>
        {account.isConnected && (
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
            Connected
          </span>
        )}
      </div>

      {/* Icon */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className={iconColor}>{icon}</div>
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex items-center justify-center gap-1 border-t border-white/10 px-4 py-3">
        <ActionButton icon={<Play className="h-4 w-4" />} label="Run" />
        <ActionButton
          icon={<Database className="h-4 w-4" />}
          label="Database"
        />
        <ActionButton icon={<FileText className="h-4 w-4" />} label="Logs" />
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
    </div>
  );
}

function AddAccountCard({ platform, onClick }: AddAccountCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

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

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-48 w-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        borderColor: isHovered
          ? "rgba(255,255,255,0.4)"
          : "rgba(255,255,255,0.1)",
        borderStyle: "dashed",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        transform: isPressed ? "scale(0.98)" : "scale(1)",
        transition: "border-color 0.3s ease, transform 0.15s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      <div className="flex items-center gap-2">
        <div className={isHovered ? iconColorHover : iconColor}>{icon}</div>
        <Plus
          className="h-6 w-6"
          style={{
            color: isHovered
              ? "rgba(255,255,255,0.8)"
              : "rgba(255,255,255,0.3)",
            transition: "color 0.3s ease",
          }}
        />
      </div>
      <span
        className="mt-3 text-sm font-semibold tracking-wide"
        style={{
          color: isHovered ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
          transition: "color 0.3s ease",
        }}
      >
        Add{" "}
        {platform === "twitter"
          ? "Twitter"
          : platform === "youtube"
            ? "YouTube"
            : "Instagram"}
      </span>
    </button>
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
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const defaultShadow =
    "0 0px 0px rgba(0,0,0,0), inset 0 1px 2px rgba(0,0,0,0.2), inset 0 0px 0px rgba(255,255,255,0)";
  const hoverShadow =
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)";

  const hoverColor =
    variant === "danger" ? "rgba(239,68,68,1)" : "rgba(255,255,255,1)";
  const hoverBg =
    variant === "danger" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.1)";
  const pressedBg =
    variant === "danger" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)";

  return (
    <button
      className="relative rounded-lg px-2 py-2"
      style={{
        color: isHovered ? hoverColor : "rgba(255,255,255,0.5)",
        backgroundColor: isPressed
          ? pressedBg
          : isHovered
            ? hoverBg
            : "rgba(255,255,255,0)",
        boxShadow: isHovered ? hoverShadow : defaultShadow,
        transform: isPressed ? "scale(0.95)" : "scale(1)",
        transition:
          "color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease, transform 0.15s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function Logo() {
  return (
    <div
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
    </div>
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

  // Track which cards are animating out
  const [exitingCards, setExitingCards] = useState<Set<string>>(new Set());
  // Track newly added cards for enter animation
  const [newCards, setNewCards] = useState<Set<string>>(new Set());

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

      const newAccount = await res.json();
      // Mark the new card for enter animation
      setNewCards((prev) => new Set(prev).add(newAccount.id));
      // Remove from new cards after animation completes
      setTimeout(() => {
        setNewCards((prev) => {
          const next = new Set(prev);
          next.delete(newAccount.id);
          return next;
        });
      }, 300);

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

    // Start exit animation
    setExitingCards((prev) => new Set(prev).add(accountId));

    // Wait for animation to complete before actually deleting
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to delete account");

        // Optimistically remove from accounts state (no refetch needed)
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));

        // Remove from exiting set
        setExitingCards((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      } catch (error) {
        console.error("Failed to delete account:", error);
        // Remove from exiting set on error too
        setExitingCards((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      }
    }, 200);
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
          <div className="card-column">
            {!isLoading &&
              twitterAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`card-wrapper ${exitingCards.has(account.id) ? "exiting" : ""}`}
                >
                  <PlatformCard
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    canDelete={account.id !== firstTwitterId}
                    animationClass={
                      exitingCards.has(account.id)
                        ? "card-exit"
                        : newCards.has(account.id)
                          ? "card-enter"
                          : ""
                    }
                  />
                </div>
              ))}
            <div className="card-wrapper">
              <AddAccountCard
                platform="twitter"
                onClick={() => handleCreateAccount("twitter")}
              />
            </div>
          </div>

          {/* YouTube Column */}
          <div className="card-column">
            {!isLoading &&
              youtubeAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`card-wrapper ${exitingCards.has(account.id) ? "exiting" : ""}`}
                >
                  <PlatformCard
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    canDelete={account.id !== firstYoutubeId}
                    animationClass={
                      exitingCards.has(account.id)
                        ? "card-exit"
                        : newCards.has(account.id)
                          ? "card-enter"
                          : ""
                    }
                  />
                </div>
              ))}
            <div className="card-wrapper">
              <AddAccountCard
                platform="youtube"
                onClick={() => handleCreateAccount("youtube")}
              />
            </div>
          </div>

          {/* Instagram Column */}
          <div className="card-column">
            {!isLoading &&
              instagramAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`card-wrapper ${exitingCards.has(account.id) ? "exiting" : ""}`}
                >
                  <PlatformCard
                    account={account}
                    onSettingsClick={() => openSettings(account)}
                    onAccountClick={() => openAccount(account)}
                    onDeleteClick={() => openDeleteModal(account)}
                    canDelete={account.id !== firstInstagramId}
                    animationClass={
                      exitingCards.has(account.id)
                        ? "card-exit"
                        : newCards.has(account.id)
                          ? "card-enter"
                          : ""
                    }
                  />
                </div>
              ))}
            <div className="card-wrapper">
              <AddAccountCard
                platform="instagram"
                onClick={() => handleCreateAccount("instagram")}
              />
            </div>
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
    </>
  );
}
