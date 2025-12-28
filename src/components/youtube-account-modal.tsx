"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  backdropVariants,
  modalVariants,
  iconButtonHoverState,
  buttonHoverState,
} from "@/lib/animations";

interface YouTubeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

interface YouTubeCredentialsState {
  apiKey: string;
  clientId: string;
  clientSecret: string;
  channelTitle?: string;
  isConnected: boolean;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing?: string | null;
}

function formatModelPrice(pricing?: string | null): string {
  if (!pricing) return "Free";
  try {
    const parsed = JSON.parse(pricing);
    const promptPrice = parseFloat(parsed.prompt || "0");
    if (promptPrice === 0) return "Free";
    // Convert to price per 1M tokens
    const pricePerMillion = promptPrice * 1_000_000;
    if (pricePerMillion < 0.01) return "<$0.01/1M";
    return `$${pricePerMillion.toFixed(2)}/1M`;
  } catch {
    return "Free";
  }
}

function formatModelName(name: string): string {
  // Remove provider prefix like "Anthropic: ", "OpenAI: ", "Google: ", etc.
  return name.replace(/^[^:]+:\s*/, "");
}

function ModalButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const isPrimary = variant === "primary";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium ${className}`}
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

function CredentialInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "password";
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.1)",
          transition: "border-color 0.3s ease, background 0.3s ease",
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
  );
}

export function YouTubeAccountModal({
  isOpen,
  onClose,
  accountId,
}: YouTubeAccountModalProps) {
  const [credentials, setCredentials] = useState<YouTubeCredentialsState>({
    apiKey: "",
    clientId: "",
    clientSecret: "",
    isConnected: false,
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
  const [isSyncingModels, setIsSyncingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel | null>(
    null
  );
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);

  // Ref for click-outside handling
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCallbackUrl(`${window.location.origin}/api/youtube/callback`);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isModelDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModelDropdownOpen]);

  useEffect(() => {
    if (isOpen && accountId) {
      setIsLoading(true);
      fetch(`/api/youtube/credentials?accountId=${accountId}`)
        .then((res) => {
          if (!res.ok) throw new Error("API error");
          return res.json();
        })
        .then((data) => {
          if (!data.error) {
            setCredentials({
              apiKey: data.apiKey || "",
              clientId: data.clientId || "",
              clientSecret: data.clientSecret || "",
              channelTitle: data.channelTitle,
              isConnected: !!data.channelTitle,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch YouTube credentials:", err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, accountId]);

  // Fetch OpenRouter credentials and models
  useEffect(() => {
    if (isOpen && accountId) {
      // First fetch models, then credentials (so we can match selectedModel)
      fetch("/api/openrouter/models")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((models) => {
          if (!Array.isArray(models)) return;
          setOpenRouterModels(models);
          // Now fetch credentials and match the selected model
          fetch(`/api/openrouter/credentials?accountId=${accountId}`)
            .then((res) => {
              if (!res.ok) throw new Error("Failed to fetch");
              return res.json();
            })
            .then((data) => {
              if (data.hasApiKey) {
                setOpenRouterApiKey(data.apiKey);
              }
              // Set the selected model from saved credentials
              if (data.selectedModel) {
                const savedModel = models.find(
                  (m: OpenRouterModel) => m.id === data.selectedModel
                );
                if (savedModel) {
                  setSelectedModel(savedModel);
                }
              }
            });
        })
        .catch((err) => {
          console.error("Failed to fetch OpenRouter data:", err);
        });
    }
  }, [isOpen, accountId]);

  const handleSyncModels = async (apiKey?: string) => {
    const keyToUse = apiKey || openRouterApiKey;
    if (!keyToUse) return;

    setIsSyncingModels(true);
    try {
      const res = await fetch("/api/openrouter/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToUse }),
      });

      const data = await res.json();
      if (data.models) {
        setOpenRouterModels(data.models);
        toast.success("Models synced");
      }
    } catch {
      toast.error("Failed to sync models");
    } finally {
      setIsSyncingModels(false);
    }
  };

  const handleSave = async () => {
    if (!accountId) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/youtube/credentials?accountId=${accountId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: credentials.apiKey,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
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
    if (!accountId) return;

    setIsConnecting(true);
    try {
      const res = await fetch(`/api/youtube/auth?accountId=${accountId}`);
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
    if (!accountId) return;

    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/youtube/disconnect?accountId=${accountId}`,
        { method: "POST" }
      );

      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }

      setCredentials((prev) => ({
        ...prev,
        channelTitle: undefined,
        isConnected: false,
      }));
      toast.success("Account disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const updateCredential = (key: "apiKey" | "clientId" | "clientSecret") => {
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
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-5xl rounded-2xl border backdrop-blur-xl"
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
            <div
              className="flex items-center justify-between border-b border-white/10 px-6 py-4"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(25,25,25,0.98) 100%)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <h2 className="text-sm font-semibold tracking-wide text-white/90">
                YouTube Account
              </h2>
              <IconButton
                icon={<X className="h-4 w-4" />}
                onClick={onClose}
                label="Close"
              />
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Loading overlay with fade */}
              <div
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl"
                style={{
                  opacity: isLoading ? 1 : 0,
                  transition: "opacity 0.2s ease-out",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                <Loader2 className="h-6 w-6 animate-spin text-white/70" />
              </div>

              {/* Content with fade */}
              <div
                style={{
                  opacity: isLoading ? 0.3 : 1,
                  transition: "opacity 0.2s ease-out",
                }}
              >
                <>
                  {/* Connection Status */}
                  {credentials.isConnected && (
                    <div
                      className="mb-6 rounded-lg border px-4 py-3"
                      style={{
                        background: "rgba(34,197,94,0.1)",
                        borderColor: "rgba(34,197,94,0.3)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="text-sm text-white/90">
                            Connected as {credentials.channelTitle}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDisconnect}
                          disabled={isDisconnecting}
                          className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                          style={{
                            color: isDisconnecting
                              ? "rgba(255,255,255,0.3)"
                              : "rgba(239,68,68,0.9)",
                            backgroundColor: "rgba(239,68,68,0.1)",
                            cursor: isDisconnecting ? "not-allowed" : "pointer",
                          }}
                          onMouseEnter={(e) => {
                            if (!isDisconnecting) {
                              e.currentTarget.style.backgroundColor =
                                "rgba(239,68,68,0.2)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "rgba(239,68,68,0.1)";
                          }}
                        >
                          {isDisconnecting ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Disconnecting...
                            </span>
                          ) : (
                            "Disconnect"
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Three Column Layout */}
                  <div className="mb-6 flex gap-6">
                    {/* Left Column - API Key */}
                    <div className="flex-1">
                      <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/90">
                        YouTube Data API
                      </h3>
                      <p className="mb-4 text-xs text-white/50">
                        Required for reading comments and public data.
                      </p>

                      <CredentialInput
                        id="apiKey"
                        label="API Key"
                        value={credentials.apiKey}
                        onChange={updateCredential("apiKey")}
                        placeholder="Enter YouTube API Key..."
                        type="password"
                      />

                      {/* Callback URL */}
                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold tracking-wide text-white/70">
                          Redirect URI
                        </label>
                        <p className="mb-2 text-xs text-white/50">
                          Add this to your OAuth 2.0 Client ID settings
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
                            label="Copy redirect URI"
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
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                        style={{ transition: "color 0.3s ease" }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Google Cloud Console
                      </a>
                    </div>

                    {/* Divider */}
                    <div
                      className="w-px self-stretch"
                      style={{ background: "rgba(255,255,255,0.1)" }}
                    />

                    {/* Middle Column - OpenRouter */}
                    <div className="flex-1">
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
                                style={{ background: "rgba(255,255,255,0.1)" }}
                              >
                                {openRouterModels.length}
                              </span>
                            )}
                            <button
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
                              title="Sync models"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${isSyncingModels ? "animate-spin" : ""}`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Searchable Dropdown */}
                        <div className="relative" ref={modelDropdownRef}>
                          <button
                            type="button"
                            onClick={() =>
                              setIsModelDropdownOpen(!isModelDropdownOpen)
                            }
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
                            <ChevronDown
                              className="h-4 w-4 shrink-0 text-white/50"
                              style={{
                                transform: isModelDropdownOpen
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                              }}
                            />
                          </button>

                          {isModelDropdownOpen &&
                            openRouterModels.length > 0 && (
                              <div
                                className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border"
                                style={{
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
                                        borderColor: "rgba(255,255,255,0.1)",
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
                                    .map((model) => (
                                      <button
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
                                        className="w-full px-3 py-2.5 text-left text-sm transition-all duration-150"
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
                                        onMouseEnter={(e) => {
                                          if (selectedModel?.id !== model.id) {
                                            e.currentTarget.style.backgroundColor =
                                              "rgba(255,255,255,0.08)";
                                            e.currentTarget.style.color =
                                              "rgba(255,255,255,0.9)";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (selectedModel?.id !== model.id) {
                                            e.currentTarget.style.backgroundColor =
                                              "rgba(0,0,0,0)";
                                            e.currentTarget.style.color =
                                              "rgba(255,255,255,0.7)";
                                          }
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
                                      </button>
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
                              </div>
                            )}
                        </div>
                      </div>

                      {/* System Prompt Button */}
                      <button
                        type="button"
                        onClick={() => setIsSystemPromptModalOpen(true)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
                        style={{
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        System Prompt
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 border-t border-white/10 pt-6">
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
                </>
              </div>
            </div>
          </motion.div>

          {/* System Prompt Modal */}
          <SystemPromptModal
            isOpen={isSystemPromptModalOpen}
            onClose={() => setIsSystemPromptModalOpen(false)}
            accountId={accountId}
            platform="youtube"
          />
        </div>
      )}
    </AnimatePresence>
  );
}
