"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  FileText,
  Play,
  Check,
  ChevronDown,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  dropdownVariants,
  iconButtonHoverState,
  buttonHoverState,
} from "@/lib/animations";

const SAMPLE_CONTENT_OPTIONS = [
  {
    id: "1",
    label: "Product launch excitement",
    content:
      "Just launched my new app and it's already getting amazing feedback! Can't believe how far we've come. Check it out!",
  },
  {
    id: "2",
    label: "Asking for help",
    content:
      "Been stuck on this bug for 3 hours now. Anyone else dealt with async state updates in React? Nothing seems to work.",
  },
  {
    id: "3",
    label: "Hot take / opinion",
    content:
      "Unpopular opinion: AI is overrated and most people using it are just making their work worse, not better.",
  },
  {
    id: "4",
    label: "Sharing success",
    content:
      "Finally hit 10k followers! Thank you all for the support. This community has been incredible.",
  },
  {
    id: "5",
    label: "Tutorial appreciation",
    content:
      "This tutorial saved my life! I've been trying to figure this out for weeks. Subscribed immediately.",
  },
  {
    id: "6",
    label: "Controversial statement",
    content:
      "Why is everyone pretending crypto is dead? I just made 5x on my portfolio this month alone.",
  },
  {
    id: "7",
    label: "Complaint / frustration",
    content:
      "The new update completely ruined the app. Who approved these changes? Going back to the old version.",
  },
  {
    id: "8",
    label: "Question about content",
    content:
      "Great video but I'm confused about the part at 3:45. Can you explain what you meant by that?",
  },
  {
    id: "9",
    label: "Motivational post",
    content:
      "Remember: every expert was once a beginner. Keep pushing, keep learning. Your future self will thank you.",
  },
  {
    id: "10",
    label: "Sarcastic comment",
    content:
      "Oh wow another productivity app that's going to change my life. Can't wait to download it and never open it again.",
  },
];

interface SystemPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  platform: string;
}

interface StyleOptions {
  noHashtags: boolean;
  noEmojis: boolean;
  noCapitalization: boolean;
  badGrammar: boolean;
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

function StyleCheckbox({
  id,
  label,
  tooltip,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <motion.label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5"
      style={{ backgroundColor: "rgba(0,0,0,0)" }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      transition={{ duration: 0.15 }}
    >
      <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border transition-colors"
          style={{
            borderColor: checked
              ? "rgba(255,255,255,0.5)"
              : "rgba(255,255,255,0.2)",
            background: checked
              ? "rgba(255,255,255,0.15)"
              : "rgba(255,255,255,0.05)",
          }}
        />
        <AnimatePresence>
          {checked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.1 }}
              className="pointer-events-none absolute"
            >
              <Check className="h-3 w-3 text-white/90" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="text-sm font-medium text-white/80">{label}</span>
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="h-3.5 w-3.5 cursor-help text-white/30 hover:text-white/50" />
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-1/2 z-[70] mb-2 w-48 -translate-x-1/2 rounded-lg border px-3 py-2 text-xs"
              style={{
                background: "rgba(20,20,20,0.98)",
                borderColor: "rgba(255,255,255,0.15)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              <p className="text-white/70">{tooltip}</p>
              <div
                className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent"
                style={{ borderTopColor: "rgba(255,255,255,0.15)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.label>
  );
}

export function SystemPromptModal({
  isOpen,
  onClose,
  accountId,
  platform,
}: SystemPromptModalProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Style options
  const [styleOptions, setStyleOptions] = useState<StyleOptions>({
    noHashtags: false,
    noEmojis: false,
    noCapitalization: false,
    badGrammar: false,
  });

  // Test functionality
  const [selectedSampleId, setSelectedSampleId] = useState("1");
  const [isSampleDropdownOpen, setIsSampleDropdownOpen] = useState(false);
  const [testResponse, setTestResponse] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");

  const selectedSample =
    SAMPLE_CONTENT_OPTIONS.find((s) => s.id === selectedSampleId) ??
    SAMPLE_CONTENT_OPTIONS[0];

  // Ref for click-outside handling
  const sampleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isSampleDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        sampleDropdownRef.current &&
        !sampleDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSampleDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSampleDropdownOpen]);

  // Fetch system prompt and style options when modal opens
  useEffect(() => {
    if (isOpen && accountId) {
      setIsLoading(true);
      setTestResponse("");
      setTestError("");
      fetch(`/api/openrouter/credentials?accountId=${accountId}`)
        .then((res) => res.json())
        .then((data) => {
          setSystemPrompt(data.systemPrompt || "");
          setStyleOptions({
            noHashtags: data.noHashtags || false,
            noEmojis: data.noEmojis || false,
            noCapitalization: data.noCapitalization || false,
            badGrammar: data.badGrammar || false,
          });
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, accountId]);

  const handleSave = async () => {
    if (!accountId) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/openrouter/credentials?accountId=${accountId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt,
            ...styleOptions,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to save system prompt");
      }

      toast.success("System prompt saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!accountId || !selectedSample) return;

    setIsTesting(true);
    setTestError("");
    setTestResponse("");

    try {
      const res = await fetch(`/api/openrouter/test?accountId=${accountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          sampleContent: selectedSample.content,
          platform,
          ...styleOptions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTestError(data.error || "Failed to generate response");
        return;
      }

      setTestResponse(data.reply);
    } catch (err) {
      console.error("Failed to test:", err);
      setTestError("Failed to generate test response");
    } finally {
      setIsTesting(false);
    }
  };

  const updateStyleOption = (key: keyof StyleOptions) => (checked: boolean) => {
    setStyleOptions((prev) => ({ ...prev, [key]: checked }));
  };

  const platformTitle =
    platform === "twitter"
      ? "Twitter"
      : platform === "youtube"
        ? "YouTube"
        : "Instagram";

  const contentType = platform === "twitter" ? "tweet" : "comment";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-5xl rounded-2xl border"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/70" />
                <h2 className="text-sm font-semibold tracking-wide text-white/90">
                  {platformTitle} System Prompt
                </h2>
              </div>
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

              <div>
                {/* Two Column Layout */}
                <div className="flex gap-6">
                  {/* Left Column - System Prompt */}
                  <div className="flex-1">
                    <h3 className="mb-2 text-sm font-semibold tracking-wide text-white/90">
                      System Prompt
                    </h3>
                    <p className="mb-3 text-xs text-white/50">
                      Define how the AI should behave when replying to{" "}
                      {contentType}s.
                    </p>

                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder={`Enter system prompt for ${platformTitle} agent...

Example:
You are a helpful social media assistant. Your role is to engage with users in a friendly manner. Keep replies concise and relevant.`}
                      className="h-48 w-full resize-none rounded-lg border px-4 py-3 text-sm text-white/90 outline-none backdrop-blur-xl transition-all duration-200"
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

                    <div className="mt-2 text-right text-xs text-white/40">
                      {systemPrompt.length} characters
                    </div>

                    {/* Style Options */}
                    <div className="mt-4">
                      <h4 className="mb-2 text-sm font-semibold tracking-wide text-white/90">
                        Style Options
                      </h4>

                      <div className="grid grid-cols-2 gap-1">
                        <StyleCheckbox
                          id="noHashtags"
                          label="No Hashtags"
                          tooltip="Prevents the AI from using hashtags in responses"
                          checked={styleOptions.noHashtags}
                          onChange={updateStyleOption("noHashtags")}
                        />
                        <StyleCheckbox
                          id="noEmojis"
                          label="No Emojis"
                          tooltip="Prevents the AI from using emojis in responses"
                          checked={styleOptions.noEmojis}
                          onChange={updateStyleOption("noEmojis")}
                        />
                        <StyleCheckbox
                          id="noCapitalization"
                          label="No Caps"
                          tooltip="Writes entirely in lowercase letters, no capitalization"
                          checked={styleOptions.noCapitalization}
                          onChange={updateStyleOption("noCapitalization")}
                        />
                        <StyleCheckbox
                          id="badGrammar"
                          label="Bad Grammar"
                          tooltip="Casual style with imperfect grammar, like texting a friend"
                          checked={styleOptions.badGrammar}
                          onChange={updateStyleOption("badGrammar")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    className="w-px self-stretch"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />

                  {/* Right Column - Test */}
                  <div className="flex-1">
                    <h3 className="mb-2 text-sm font-semibold tracking-wide text-white/90">
                      Test Response
                    </h3>
                    <p className="mb-3 text-xs text-white/50">
                      Select a sample {contentType} to test how the AI will
                      respond.
                    </p>

                    {/* Sample Content Dropdown */}
                    <div className="relative" ref={sampleDropdownRef}>
                      <motion.button
                        type="button"
                        onClick={() =>
                          setIsSampleDropdownOpen(!isSampleDropdownOpen)
                        }
                        className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          borderColor: isSampleDropdownOpen
                            ? "rgba(255,255,255,0.3)"
                            : "rgba(255,255,255,0.1)",
                        }}
                        whileHover={{
                          borderColor: "rgba(255,255,255,0.2)",
                        }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="truncate text-sm text-white/90">
                          {selectedSample?.label || "Select a sample..."}
                        </span>
                        <motion.div
                          animate={{
                            rotate: isSampleDropdownOpen ? 180 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                        </motion.div>
                      </motion.button>

                      <AnimatePresence>
                        {isSampleDropdownOpen && (
                          <motion.div
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border"
                            style={{
                              background:
                                "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.98) 100%)",
                              borderColor: "rgba(255,255,255,0.15)",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                            }}
                          >
                            <div
                              className="max-h-48 overflow-y-auto"
                              data-lenis-prevent
                            >
                              {SAMPLE_CONTENT_OPTIONS.map((option, index) => (
                                <motion.button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSampleId(option.id);
                                    setIsSampleDropdownOpen(false);
                                  }}
                                  className="w-full px-3 py-2.5 text-left text-sm"
                                  style={{
                                    color:
                                      selectedSampleId === option.id
                                        ? "rgba(255,255,255,1)"
                                        : "rgba(255,255,255,0.7)",
                                    backgroundColor:
                                      selectedSampleId === option.id
                                        ? "rgba(255,255,255,0.1)"
                                        : "rgba(0,0,0,0)",
                                  }}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.02 }}
                                  whileHover={{
                                    backgroundColor: "rgba(255,255,255,0.08)",
                                    color: "rgba(255,255,255,0.9)",
                                  }}
                                >
                                  {option.label}
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Sample Content Preview */}
                    <AnimatePresence mode="wait">
                      {selectedSample && (
                        <motion.div
                          key={selectedSample.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                          className="mt-3 rounded-lg border p-3"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          <p className="mb-1 text-xs text-white/40">
                            Sample {contentType}:
                          </p>
                          <p className="text-sm italic text-white/70">
                            &quot;{selectedSample.content}&quot;
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="button"
                      onClick={handleTest}
                      disabled={isTesting}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium"
                      style={{
                        borderColor: isTesting
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(255,255,255,0.2)",
                        background: isTesting
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(255,255,255,0.1)",
                        color: isTesting
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(255,255,255,0.9)",
                        cursor: isTesting ? "not-allowed" : "pointer",
                      }}
                      whileHover={
                        isTesting
                          ? {}
                          : {
                              background: "rgba(255,255,255,0.15)",
                              borderColor: "rgba(255,255,255,0.3)",
                            }
                      }
                      whileTap={isTesting ? {} : { scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Test Response
                        </>
                      )}
                    </motion.button>

                    {/* Response Output */}
                    <div className="mt-4">
                      <h4 className="mb-2 text-sm font-semibold tracking-wide text-white/90">
                        AI Response
                      </h4>
                      <div
                        className="h-40 overflow-y-auto rounded-lg border p-4"
                        data-lenis-prevent
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderColor: testError
                            ? "rgba(239,68,68,0.3)"
                            : "rgba(255,255,255,0.1)",
                        }}
                      >
                        <AnimatePresence mode="wait">
                          {testError ? (
                            <motion.p
                              key="error"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-red-400"
                            >
                              {testError}
                            </motion.p>
                          ) : testResponse ? (
                            <motion.p
                              key="response"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="whitespace-pre-wrap text-sm text-white/80"
                            >
                              {testResponse}
                            </motion.p>
                          ) : (
                            <motion.p
                              key="placeholder"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-white/30"
                            >
                              Click &quot;Test Response&quot; to see the
                              AI&apos;s reply...
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3 border-t border-white/10 pt-6">
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
                      "Save System Prompt"
                    )}
                  </ModalButton>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
