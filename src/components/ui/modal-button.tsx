"use client";

import { motion } from "framer-motion";
import { buttonHoverState } from "@/lib/animations";

interface ModalButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}

export function ModalButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  className = "",
}: ModalButtonProps) {
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
