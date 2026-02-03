"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Search,
  FileText,
} from "lucide-react";
import { SystemPromptModal } from "./system-prompt-modal";
import { dropdownVariants, backdropVariants } from "@/lib/animations";
import { ModalButton } from "@/components/ui/modal-button";
import { IconButton } from "@/components/ui/icon-button";
import { CredentialInput } from "@/components/ui/credential-input";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: "twitter" | "youtube";
  accountId: string;
}

type TokenStatus = "healthy" | "expiring_soon" | "expired" | "not_connected";

interface TwitterCredentialsState {
  clientId: string;
  clientSecret: string;
  rapidApiKey: string;
  username?: string;
  isConnected: boolean;
  tokenStatus: TokenStatus;
  tokenExpiresAt: string | null;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing?: string | null;
  supportsVision?: boolean;
}

function formatModelPrice(pricing?: string | null): string {
  if (!pricing) return "Free";
  try {
    const parsed = JSON.parse(pricing);
    const promptPrice = parseFloat(parsed.prompt || "0");
    if (promptPrice === 0) return "Free";
    const pricePerMillion = promptPrice * 1_000_000;
    if (pricePerMillion < 0.01) return "<$0.01/1M";
    return `$${pricePerMillion.toFixed(2)}/1M`;
  } catch {
    return "Free";
  }
}

function formatModelName(name: string): string {
  return name.replace(/^[^:]+:\s*/, "");
}

export function AccountModal({
  isOpen,
  onClose,
  platform,
  accountId,
}: AccountModalProps) {
  const [credentials, setCredentials] = useState<TwitterCredentialsState>({
    clientId: "",
    clientSecret: "",
    rapidApiKey: "",
    isConnected: false,
    tokenStatus: "not_connected",
    tokenExpiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");

  // OpenRouter state
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>(
    []
  );
  const [visionModels, setVisionModels] = useState<OpenRouterModel[]>([]);
  const [isSyncingModels, setIsSyncingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isVisionDropdownOpen, setIsVisionDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [visionSearchQuery, setVisionSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel | null>(
    null
  );
  const [selectedVisionModel, setSelectedVisionModel] =
    useState<OpenRouterModel | null>(null);
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);

  // Ref for click-outside handling
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const visionDropdownRef = useRef<HTMLDivElement>(null);
  const visionButtonRef = useRef<HTMLButtonElement>(null);
  const [modelDropdownPos, setModelDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [visionDropdownPos, setVisionDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCallbackUrl(`${window.location.origin}/api/twitter/callback`);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isModelDropdownOpen && !isVisionDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        isModelDropdownOpen &&
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
      if (
        isVisionDropdownOpen &&
        visionDropdownRef.current &&
        !visionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsVisionDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModelDropdownOpen, isVisionDropdownOpen]);

  useEffect(() => {
    if (isOpen && platform === "twitter" && accountId) {
      setIsLoading(true);
      fetch(`/api/twitter/credentials?accountId=${accountId}`)
        .then((res) => {
          if (!res.ok) throw new Error("API error");
          return res.json();
        })
        .then((data) => {
          if (!data.error) {
            setCredentials({
              clientId: data.clientId || "",
              clientSecret: data.clientSecret || "",
              rapidApiKey: data.rapidApiKey || "",
              username: data.username,
              isConnected: !!data.username,
              tokenStatus: data.tokenStatus || "not_connected",
              tokenExpiresAt: data.tokenExpiresAt || null,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch Twitter credentials:", err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, platform, accountId]);

  // Fetch OpenRouter credentials and models
  useEffect(() => {
    if (isOpen && accountId) {
      // Fetch all models and vision models in parallel
      Promise.all([
        fetch("/api/openrouter/models").then((res) =>
          res.ok ? res.json() : []
        ),
        fetch("/api/openrouter/models?vision=true").then((res) =>
          res.ok ? res.json() : []
        ),
      ])
        .then(([allModels, visionOnlyModels]) => {
          if (Array.isArray(allModels)) setOpenRouterModels(allModels);
          if (Array.isArray(visionOnlyModels))
            setVisionModels(visionOnlyModels);

          // Now fetch credentials and match the selected models
          fetch(`/api/openrouter/credentials?accountId=${accountId}`)
            .then((res) => {
              if (!res.ok) throw new Error("Failed to fetch");
              return res.json();
            })
            .then((data) => {
              if (data.hasApiKey) {
                setOpenRouterApiKey(data.apiKey);
              }
              // Set the selected LLM model
              if (data.selectedModel && Array.isArray(allModels)) {
                const savedModel = allModels.find(
                  (m: OpenRouterModel) => m.id === data.selectedModel
                );
                if (savedModel) setSelectedModel(savedModel);
              }
              // Set the selected vision model
              if (data.selectedVisionModel && Array.isArray(visionOnlyModels)) {
                const savedVisionModel = visionOnlyModels.find(
                  (m: OpenRouterModel) => m.id === data.selectedVisionModel
                );
                if (savedVisionModel) setSelectedVisionModel(savedVisionModel);
              }
            });
        })
        .catch((err) => {
          console.error("Failed to fetch OpenRouter data:", err);
        });
    }
  }, [isOpen, accountId]);

  const handleSyncModels = async (apiKey?: string) => {
    setIsSyncingModels(true);
    try {
      const res = await fetch("/api/openrouter/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          apiKey: apiKey || openRouterApiKey,
        }),
      });

      const data = await res.json();
      if (data.models) {
        setOpenRouterModels(data.models);
        // Also update vision models (filter from synced models)
        const visionOnly = data.models.filter(
          (m: OpenRouterModel) => m.supportsVision
        );
        setVisionModels(visionOnly);
        toast.success("Models synced");
      }
    } catch {
      toast.error("Failed to sync models");
    } finally {
      setIsSyncingModels(false);
    }
  };

  const handleSave = async () => {
    if (platform !== "twitter" || !accountId) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/twitter/credentials?accountId=${accountId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            rapidApiKey: credentials.rapidApiKey,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to save credentials");
      }

      // Only save/sync if a new API key was entered (not the masked placeholder)
      const isNewApiKey = openRouterApiKey && !openRouterApiKey.includes("•");
      if (isNewApiKey) {
        const openRouterRes = await fetch(
          `/api/openrouter/credentials?accountId=${accountId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: openRouterApiKey }),
          }
        );

        if (openRouterRes.ok) {
          await handleSyncModels(openRouterApiKey);
        }
      }

      toast.success("Credentials saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    if (platform !== "twitter" || !accountId) return;

    setIsConnecting(true);
    try {
      const res = await fetch(`/api/twitter/auth?accountId=${accountId}`);
      const data = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("Failed to get auth URL");
      }
    } catch {
      toast.error("Failed to connect");
      setIsConnecting(false);
    }
  };

  const handleCopyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDisconnect = async () => {
    if (platform !== "twitter" || !accountId) return;

    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/twitter/disconnect?accountId=${accountId}`,
        { method: "POST" }
      );

      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }

      setCredentials((prev) => ({
        ...prev,
        username: undefined,
        isConnected: false,
      }));
      toast.success("Account disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const updateCredential = (
    key: "clientId" | "clientSecret" | "rapidApiKey"
  ) => {
    return (value: string) => {
      setCredentials((prev) => ({ ...prev, [key]: value }));
    };
  };

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
            exit="exit"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border md:max-w-5xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(30,30,35,0.98) 0%, rgba(20,20,25,0.99) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
              maxHeight: "85vh",
            }}
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header - Fixed */}
            <div
              className="shrink-0 flex items-center justify-between border-b border-white/10 px-6 py-4"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(25,25,25,0.98) 100%)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <h2 className="text-sm font-semibold tracking-wide text-white/90">
                {platform === "twitter" ? "Twitter" : "YouTube"} Account
              </h2>
              <IconButton
                icon={<X className="h-4 w-4" />}
                onClick={onClose}
                label="Close"
              />
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6" data-lenis-prevent>
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

              <div>
                {/* Connection Status */}
                <AnimatePresence>
                  {credentials.isConnected && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mb-6 rounded-lg border px-4 py-3"
                      style={{
                        background:
                          credentials.tokenStatus === "expired"
                            ? "rgba(239,68,68,0.1)"
                            : credentials.tokenStatus === "expiring_soon"
                              ? "rgba(245,158,11,0.1)"
                              : "rgba(34,197,94,0.1)",
                        borderColor:
                          credentials.tokenStatus === "expired"
                            ? "rgba(239,68,68,0.3)"
                            : credentials.tokenStatus === "expiring_soon"
                              ? "rgba(245,158,11,0.3)"
                              : "rgba(34,197,94,0.3)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              credentials.tokenStatus === "expired"
                                ? "bg-red-500"
                                : credentials.tokenStatus === "expiring_soon"
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                            }`}
                          />
                          <span className="text-sm text-white/90">
                            {credentials.tokenStatus === "expired" ? (
                              <>Token expired - re-login required</>
                            ) : credentials.tokenStatus === "expiring_soon" ? (
                              <>Token expiring soon - @{credentials.username}</>
                            ) : (
                              <>Connected as @{credentials.username}</>
                            )}
                          </span>
                        </div>
                        <motion.button
                          type="button"
                          onClick={handleDisconnect}
                          disabled={isDisconnecting}
                          className="rounded-md px-3 py-1 text-xs font-medium"
                          style={{
                            color: isDisconnecting
                              ? "rgba(255,255,255,0.3)"
                              : "rgba(239,68,68,0.9)",
                            backgroundColor: "rgba(239,68,68,0.1)",
                            cursor: isDisconnecting ? "not-allowed" : "pointer",
                          }}
                          whileHover={
                            isDisconnecting
                              ? {}
                              : { backgroundColor: "rgba(239,68,68,0.2)" }
                          }
                          whileTap={isDisconnecting ? {} : { scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                        >
                          {isDisconnecting ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Disconnecting...
                            </span>
                          ) : credentials.tokenStatus === "expired" ? (
                            "Re-connect"
                          ) : (
                            "Disconnect"
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Three Column Layout - stacks on mobile */}
                <div className="mb-6 flex flex-col gap-6 md:flex-row">
                  {/* Left Column - Twitter OAuth */}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/90">
                      Twitter OAuth
                    </h3>
                    {/* Callback URL */}
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-semibold tracking-wide text-white/70">
                        Callback URL
                      </label>
                      <p className="mb-2 text-xs text-white/50">
                        Add this to your Twitter App&apos;s OAuth 2.0 settings
                      </p>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 overflow-hidden rounded-lg border px-4 py-3"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          <code className="block truncate text-sm text-white/70">
                            {callbackUrl}
                          </code>
                        </div>
                        <IconButton
                          icon={
                            copied ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )
                          }
                          onClick={handleCopyCallback}
                          label="Copy callback URL"
                        />
                      </div>
                    </div>

                    <CredentialInput
                      id="clientId"
                      label="Client ID"
                      value={credentials.clientId}
                      onChange={updateCredential("clientId")}
                      placeholder="Enter Client ID..."
                    />

                    <CredentialInput
                      id="clientSecret"
                      label="Client Secret"
                      value={credentials.clientSecret}
                      onChange={updateCredential("clientSecret")}
                      placeholder="Enter Client Secret..."
                      type="password"
                    />

                    <a
                      href="https://developer.twitter.com/en/portal/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm text-sky-400 transition-colors hover:text-sky-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Twitter Developer Portal
                    </a>
                  </div>

                  {/* Divider - hidden on mobile */}
                  <div
                    className="hidden w-px self-stretch md:block"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  />

                  {/* Middle Column - OpenRouter */}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/90">
                      OpenRouter API
                    </h3>
                    <p className="mb-4 text-xs text-white/50">
                      Connect to OpenRouter for LLM access.
                    </p>

                    <CredentialInput
                      id="openRouterApiKey"
                      label="API Key"
                      value={openRouterApiKey}
                      onChange={setOpenRouterApiKey}
                      placeholder="Enter OpenRouter API Key..."
                      type="password"
                    />

                    {/* LLM Models Section */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold tracking-wide text-white/90">
                          LLM Models
                        </span>
                        <div className="flex items-center gap-2">
                          {openRouterModels.length > 0 && (
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium text-white/70"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.1)",
                              }}
                            >
                              {openRouterModels.length}
                            </span>
                          )}
                          <motion.button
                            type="button"
                            onClick={() => handleSyncModels()}
                            disabled={isSyncingModels || !openRouterApiKey}
                            className="rounded-lg p-1.5"
                            style={{
                              color:
                                isSyncingModels || !openRouterApiKey
                                  ? "rgba(255,255,255,0.3)"
                                  : "rgba(255,255,255,0.5)",
                              background: "rgba(255,255,255,0.05)",
                              cursor:
                                isSyncingModels || !openRouterApiKey
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                            whileHover={
                              isSyncingModels || !openRouterApiKey
                                ? {}
                                : { backgroundColor: "rgba(255,255,255,0.1)" }
                            }
                            whileTap={
                              isSyncingModels || !openRouterApiKey
                                ? {}
                                : { scale: 0.95 }
                            }
                            title="Sync models"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${isSyncingModels ? "animate-spin" : ""}`}
                            />
                          </motion.button>
                        </div>
                      </div>

                      {/* Searchable Dropdown */}
                      <div className="relative" ref={modelDropdownRef}>
                        <motion.button
                          ref={modelButtonRef}
                          type="button"
                          onClick={() => {
                            if (
                              !isModelDropdownOpen &&
                              modelButtonRef.current
                            ) {
                              const rect =
                                modelButtonRef.current.getBoundingClientRect();
                              setModelDropdownPos({
                                top: rect.bottom + 4,
                                left: rect.left,
                                width: rect.width,
                              });
                            }
                            setIsModelDropdownOpen(!isModelDropdownOpen);
                          }}
                          disabled={openRouterModels.length === 0}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            borderColor: isModelDropdownOpen
                              ? "rgba(255,255,255,0.3)"
                              : "rgba(255,255,255,0.1)",
                            cursor:
                              openRouterModels.length === 0
                                ? "not-allowed"
                                : "pointer",
                          }}
                          whileHover={
                            openRouterModels.length === 0
                              ? {}
                              : { borderColor: "rgba(255,255,255,0.2)" }
                          }
                          transition={{ duration: 0.15 }}
                        >
                          <span
                            className="truncate text-sm"
                            style={{
                              color: selectedModel
                                ? "rgba(255,255,255,0.9)"
                                : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {selectedModel
                              ? formatModelName(selectedModel.name)
                              : openRouterModels.length === 0
                                ? "Sync models first..."
                                : "Select a model..."}
                          </span>
                          <motion.div
                            animate={{ rotate: isModelDropdownOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                          </motion.div>
                        </motion.button>

                        {typeof document !== "undefined" &&
                          createPortal(
                            <AnimatePresence>
                              {isModelDropdownOpen &&
                                openRouterModels.length > 0 && (
                                  <motion.div
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="overflow-hidden rounded-lg border"
                                    style={{
                                      position: "fixed",
                                      top: modelDropdownPos.top,
                                      left: modelDropdownPos.left,
                                      width: modelDropdownPos.width,
                                      zIndex: 99999,
                                      background:
                                        "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.98) 100%)",
                                      borderColor: "rgba(255,255,255,0.15)",
                                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                                    }}
                                  >
                                    {/* Search Input */}
                                    <div
                                      className="border-b p-2"
                                      style={{
                                        borderColor: "rgba(255,255,255,0.1)",
                                      }}
                                    >
                                      <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                                        <input
                                          type="text"
                                          value={modelSearchQuery}
                                          onChange={(e) =>
                                            setModelSearchQuery(e.target.value)
                                          }
                                          placeholder="Search models..."
                                          className="w-full rounded border bg-transparent py-1.5 pr-3 pl-8 text-sm text-white/90 outline-none"
                                          style={{
                                            borderColor:
                                              "rgba(255,255,255,0.1)",
                                          }}
                                          autoFocus
                                        />
                                      </div>
                                    </div>

                                    {/* Model List */}
                                    <div
                                      className="max-h-48 overflow-y-auto"
                                      data-lenis-prevent
                                    >
                                      {openRouterModels
                                        .filter(
                                          (model) =>
                                            model.name
                                              .toLowerCase()
                                              .includes(
                                                modelSearchQuery.toLowerCase()
                                              ) ||
                                            model.id
                                              .toLowerCase()
                                              .includes(
                                                modelSearchQuery.toLowerCase()
                                              )
                                        )
                                        .slice(0, 100)
                                        .map((model, index) => (
                                          <motion.button
                                            key={model.id}
                                            type="button"
                                            onClick={async () => {
                                              setSelectedModel(model);
                                              setIsModelDropdownOpen(false);
                                              setModelSearchQuery("");
                                              // Save the selected model immediately
                                              try {
                                                await fetch(
                                                  `/api/openrouter/credentials?accountId=${accountId}`,
                                                  {
                                                    method: "POST",
                                                    headers: {
                                                      "Content-Type":
                                                        "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                      selectedModel: model.id,
                                                    }),
                                                  }
                                                );
                                              } catch (err) {
                                                console.error(
                                                  "Failed to save model selection:",
                                                  err
                                                );
                                              }
                                            }}
                                            className="w-full px-3 py-2.5 text-left text-sm"
                                            style={{
                                              color:
                                                selectedModel?.id === model.id
                                                  ? "rgba(255,255,255,1)"
                                                  : "rgba(255,255,255,0.7)",
                                              backgroundColor:
                                                selectedModel?.id === model.id
                                                  ? "rgba(255,255,255,0.1)"
                                                  : "rgba(0,0,0,0)",
                                            }}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.01 }}
                                            whileHover={{
                                              backgroundColor:
                                                "rgba(255,255,255,0.08)",
                                              color: "rgba(255,255,255,0.9)",
                                            }}
                                          >
                                            <div className="truncate">
                                              {formatModelName(model.name)}
                                            </div>
                                            <div
                                              className="truncate text-xs"
                                              style={{
                                                color: "rgba(255,255,255,0.4)",
                                              }}
                                            >
                                              {formatModelPrice(model.pricing)}
                                            </div>
                                          </motion.button>
                                        ))}
                                      {openRouterModels.filter(
                                        (model) =>
                                          model.name
                                            .toLowerCase()
                                            .includes(
                                              modelSearchQuery.toLowerCase()
                                            ) ||
                                          model.id
                                            .toLowerCase()
                                            .includes(
                                              modelSearchQuery.toLowerCase()
                                            )
                                      ).length === 0 && (
                                        <p className="px-3 py-4 text-center text-xs text-white/40">
                                          No models found
                                        </p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                            </AnimatePresence>,
                            document.body
                          )}
                      </div>
                    </div>

                    {/* Vision Models Section */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold tracking-wide text-white/90">
                          Vision Model
                        </span>
                        {visionModels.length > 0 && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white/70"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.1)",
                            }}
                          >
                            {visionModels.length}
                          </span>
                        )}
                      </div>
                      <p className="mb-2 text-xs text-white/50">
                        For analyzing images in tweets
                      </p>

                      {/* Vision Model Dropdown */}
                      <div className="relative" ref={visionDropdownRef}>
                        <motion.button
                          ref={visionButtonRef}
                          type="button"
                          onClick={() => {
                            if (
                              !isVisionDropdownOpen &&
                              visionButtonRef.current
                            ) {
                              const rect =
                                visionButtonRef.current.getBoundingClientRect();
                              setVisionDropdownPos({
                                top: rect.bottom + 4,
                                left: rect.left,
                                width: rect.width,
                              });
                            }
                            setIsVisionDropdownOpen(!isVisionDropdownOpen);
                          }}
                          disabled={visionModels.length === 0}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            borderColor: isVisionDropdownOpen
                              ? "rgba(255,255,255,0.3)"
                              : "rgba(255,255,255,0.1)",
                            cursor:
                              visionModels.length === 0
                                ? "not-allowed"
                                : "pointer",
                          }}
                          whileHover={
                            visionModels.length === 0
                              ? {}
                              : { borderColor: "rgba(255,255,255,0.2)" }
                          }
                          transition={{ duration: 0.15 }}
                        >
                          <span
                            className="truncate text-sm"
                            style={{
                              color: selectedVisionModel
                                ? "rgba(255,255,255,0.9)"
                                : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {selectedVisionModel
                              ? formatModelName(selectedVisionModel.name)
                              : visionModels.length === 0
                                ? "Sync models first..."
                                : "Select a vision model..."}
                          </span>
                          <motion.div
                            animate={{ rotate: isVisionDropdownOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                          </motion.div>
                        </motion.button>

                        {typeof document !== "undefined" &&
                          createPortal(
                            <AnimatePresence>
                              {isVisionDropdownOpen &&
                                visionModels.length > 0 && (
                                  <motion.div
                                    variants={dropdownVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="overflow-hidden rounded-lg border"
                                    style={{
                                      position: "fixed",
                                      top: visionDropdownPos.top,
                                      left: visionDropdownPos.left,
                                      width: visionDropdownPos.width,
                                      zIndex: 99999,
                                      background:
                                        "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.98) 100%)",
                                      borderColor: "rgba(255,255,255,0.15)",
                                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                                    }}
                                  >
                                    {/* Search Input */}
                                    <div
                                      className="border-b p-2"
                                      style={{
                                        borderColor: "rgba(255,255,255,0.1)",
                                      }}
                                    >
                                      <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                                        <input
                                          type="text"
                                          value={visionSearchQuery}
                                          onChange={(e) =>
                                            setVisionSearchQuery(e.target.value)
                                          }
                                          placeholder="Search vision models..."
                                          className="w-full rounded border bg-transparent py-1.5 pr-3 pl-8 text-sm text-white/90 outline-none"
                                          style={{
                                            borderColor:
                                              "rgba(255,255,255,0.1)",
                                          }}
                                          autoFocus
                                        />
                                      </div>
                                    </div>

                                    {/* Vision Model List */}
                                    <div
                                      className="max-h-48 overflow-y-auto"
                                      data-lenis-prevent
                                    >
                                      {visionModels
                                        .filter(
                                          (model) =>
                                            model.name
                                              .toLowerCase()
                                              .includes(
                                                visionSearchQuery.toLowerCase()
                                              ) ||
                                            model.id
                                              .toLowerCase()
                                              .includes(
                                                visionSearchQuery.toLowerCase()
                                              )
                                        )
                                        .slice(0, 100)
                                        .map((model, index) => (
                                          <motion.button
                                            key={model.id}
                                            type="button"
                                            onClick={async () => {
                                              setSelectedVisionModel(model);
                                              setIsVisionDropdownOpen(false);
                                              setVisionSearchQuery("");
                                              // Save the selected vision model immediately
                                              try {
                                                await fetch(
                                                  `/api/openrouter/credentials?accountId=${accountId}`,
                                                  {
                                                    method: "POST",
                                                    headers: {
                                                      "Content-Type":
                                                        "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                      selectedVisionModel:
                                                        model.id,
                                                    }),
                                                  }
                                                );
                                              } catch (err) {
                                                console.error(
                                                  "Failed to save vision model selection:",
                                                  err
                                                );
                                              }
                                            }}
                                            className="w-full px-3 py-2.5 text-left text-sm"
                                            style={{
                                              color:
                                                selectedVisionModel?.id ===
                                                model.id
                                                  ? "rgba(255,255,255,1)"
                                                  : "rgba(255,255,255,0.7)",
                                              backgroundColor:
                                                selectedVisionModel?.id ===
                                                model.id
                                                  ? "rgba(255,255,255,0.1)"
                                                  : "rgba(0,0,0,0)",
                                            }}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.01 }}
                                            whileHover={{
                                              backgroundColor:
                                                "rgba(255,255,255,0.08)",
                                              color: "rgba(255,255,255,0.9)",
                                            }}
                                          >
                                            <div className="truncate">
                                              {formatModelName(model.name)}
                                            </div>
                                            <div
                                              className="truncate text-xs"
                                              style={{
                                                color: "rgba(255,255,255,0.4)",
                                              }}
                                            >
                                              {formatModelPrice(model.pricing)}
                                            </div>
                                          </motion.button>
                                        ))}
                                      {visionModels.filter(
                                        (model) =>
                                          model.name
                                            .toLowerCase()
                                            .includes(
                                              visionSearchQuery.toLowerCase()
                                            ) ||
                                          model.id
                                            .toLowerCase()
                                            .includes(
                                              visionSearchQuery.toLowerCase()
                                            )
                                      ).length === 0 && (
                                        <p className="px-3 py-4 text-center text-xs text-white/40">
                                          No vision models found
                                        </p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                            </AnimatePresence>,
                            document.body
                          )}
                      </div>
                    </div>

                    {/* System Prompt Button */}
                    <motion.button
                      type="button"
                      onClick={() => setIsSystemPromptModalOpen(true)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium"
                      style={{
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.7)",
                      }}
                      whileHover={{
                        backgroundColor: "rgba(255,255,255,0.1)",
                        borderColor: "rgba(255,255,255,0.2)",
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                    >
                      <FileText className="h-4 w-4" />
                      System Prompt
                    </motion.button>
                  </div>

                  {/* Divider - hidden on mobile */}
                  <div
                    className="hidden w-px self-stretch md:block"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  />

                  {/* Right Column - Rapid API */}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/90">
                      Rapid API
                    </h3>
                    <p className="mb-4 text-xs text-white/50">
                      Required for Twitter search features.
                    </p>

                    <CredentialInput
                      id="rapidApiKey"
                      label="API Key"
                      value={credentials.rapidApiKey}
                      onChange={updateCredential("rapidApiKey")}
                      placeholder="Enter Rapid API Key..."
                      type="password"
                    />

                    <a
                      href="https://rapidapi.com/viperscores-viperscores-default/api/twitter-aio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm text-sky-400 transition-colors hover:text-sky-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Get RapidAPI Key
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Fixed */}
            <div className="shrink-0 flex gap-3 border-t border-white/10 px-6 py-4">
              <ModalButton
                onClick={onClose}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </ModalButton>
              <ModalButton
                onClick={handleSave}
                disabled={isSaving}
                variant="primary"
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Credentials"
                )}
              </ModalButton>
              <ModalButton
                onClick={handleConnect}
                disabled={
                  isConnecting ||
                  !credentials.clientId ||
                  !credentials.clientSecret
                }
                variant="primary"
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : credentials.isConnected ? (
                  "Reconnect"
                ) : (
                  "Connect Account"
                )}
              </ModalButton>
            </div>
          </motion.div>

          {/* System Prompt Modal */}
          <SystemPromptModal
            isOpen={isSystemPromptModalOpen}
            onClose={() => setIsSystemPromptModalOpen(false)}
            accountId={accountId}
            platform={platform}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
