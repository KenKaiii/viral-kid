"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { X, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import {
  backdropVariants,
  fadeInVariants,
  connectionStatusVariants,
} from "@/lib/animations";
import { ModalButton } from "@/components/ui/modal-button";
import { IconButton } from "@/components/ui/icon-button";
import { CredentialInput } from "@/components/ui/credential-input";

interface InstagramAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

type TokenStatus = "healthy" | "expiring_soon" | "expired" | "not_connected";

interface InstagramCredentialsState {
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  instagramUsername?: string;
  facebookPageName?: string;
  isConnected: boolean;
  tokenStatus: TokenStatus;
  tokenExpiresAt: string | null;
}

export function InstagramAccountModal({
  isOpen,
  onClose,
  accountId,
}: InstagramAccountModalProps) {
  const [credentials, setCredentials] = useState<InstagramCredentialsState>({
    appId: "",
    appSecret: "",
    webhookVerifyToken: "",
    isConnected: false,
    tokenStatus: "not_connected",
    tokenExpiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCallbackUrl(`${window.location.origin}/api/instagram/callback`);
      setWebhookUrl(`${window.location.origin}/api/instagram/webhook`);
    }
  }, []);

  useEffect(() => {
    if (isOpen && accountId) {
      setIsLoading(true);
      fetch(`/api/instagram/credentials?accountId=${accountId}`)
        .then((res) => {
          if (!res.ok) throw new Error("API error");
          return res.json();
        })
        .then((data) => {
          if (!data.error) {
            setCredentials({
              appId: data.appId || "",
              appSecret: data.appSecret || "",
              webhookVerifyToken: data.webhookVerifyToken || "",
              instagramUsername: data.instagramUsername,
              facebookPageName: data.facebookPageName,
              isConnected: !!data.isConnected,
              tokenStatus: data.tokenStatus || "not_connected",
              tokenExpiresAt: data.tokenExpiresAt || null,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch Instagram credentials:", err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, accountId]);

  const handleSave = async () => {
    if (!accountId) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/instagram/credentials?accountId=${accountId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: credentials.appId,
            appSecret: credentials.appSecret,
            webhookVerifyToken: credentials.webhookVerifyToken,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to save credentials");
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
      const res = await fetch(`/api/instagram/auth?accountId=${accountId}`);
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
        `/api/instagram/disconnect?accountId=${accountId}`,
        { method: "POST" }
      );

      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }

      setCredentials((prev) => ({
        ...prev,
        instagramUsername: undefined,
        facebookPageName: undefined,
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
    key: "appId" | "appSecret" | "webhookVerifyToken"
  ) => {
    return (value: string) => {
      setCredentials((prev) => ({ ...prev, [key]: value }));
    };
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
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
            className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border md:max-w-4xl"
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
                Instagram Account
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
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
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
                      variants={connectionStatusVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
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
                              <>
                                Token expiring soon - @
                                {credentials.instagramUsername}
                              </>
                            ) : (
                              <>
                                Connected as @{credentials.instagramUsername}
                                {credentials.facebookPageName &&
                                  ` (via ${credentials.facebookPageName})`}
                              </>
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

                {/* Requirements Info */}
                <div
                  className="mb-6 rounded-lg border px-4 py-3"
                  style={{
                    background: "rgba(251,191,36,0.1)",
                    borderColor: "rgba(251,191,36,0.3)",
                  }}
                >
                  <p className="text-sm text-white/80">
                    <strong>Requirements:</strong> Instagram Business or Creator
                    account linked to a Facebook Page. Personal accounts are not
                    supported by the Instagram API.
                  </p>
                </div>

                {/* Two Column Layout */}
                <div className="flex flex-col gap-6 md:flex-row">
                  {/* Left Column - Meta App Credentials */}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/90">
                      Meta App Credentials
                    </h3>
                    <p className="mb-4 text-xs text-white/50">
                      Create a Meta App at developers.facebook.com and add
                      &quot;Facebook Login for Business&quot; product.
                    </p>

                    {/* Callback URL */}
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-semibold tracking-wide text-white/70">
                        OAuth Redirect URI
                      </label>
                      <p className="mb-2 text-xs text-white/50">
                        Add this to your Facebook Login settings under Valid
                        OAuth Redirect URIs
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
                      id="appId"
                      label="App ID"
                      value={credentials.appId}
                      onChange={updateCredential("appId")}
                      placeholder="Enter Meta App ID..."
                    />

                    <CredentialInput
                      id="appSecret"
                      label="App Secret"
                      value={credentials.appSecret}
                      onChange={updateCredential("appSecret")}
                      placeholder="Enter App Secret..."
                      type="password"
                    />

                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300"
                      style={{ transition: "color 0.3s ease" }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Meta Developer Portal
                    </a>
                  </div>

                  {/* Divider */}
                  <div
                    className="hidden w-px self-stretch md:block"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />

                  {/* Right Column - Webhook Configuration */}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/90">
                      Webhook Configuration
                    </h3>
                    <p className="mb-4 text-xs text-white/50">
                      Add these to your Meta App → Webhooks → Instagram settings
                    </p>

                    {/* Webhook URL */}
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-semibold tracking-wide text-white/70">
                        Callback URL
                      </label>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 overflow-hidden rounded-lg border px-4 py-3"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          <code className="block truncate text-sm text-white/70">
                            {webhookUrl}
                          </code>
                        </div>
                        <IconButton
                          icon={
                            copiedWebhook ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )
                          }
                          onClick={handleCopyWebhook}
                          label="Copy webhook URL"
                        />
                      </div>
                    </div>

                    <CredentialInput
                      id="webhookVerifyToken"
                      label="Verify Token"
                      value={credentials.webhookVerifyToken}
                      onChange={updateCredential("webhookVerifyToken")}
                      placeholder="Enter any secret token..."
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Use the same token when configuring the webhook in Meta
                      Developer Portal
                    </p>
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
                  "Save"
                )}
              </ModalButton>
              <ModalButton
                onClick={handleConnect}
                disabled={
                  isConnecting || !credentials.appId || !credentials.appSecret
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
                  "Connect"
                )}
              </ModalButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
