"use client";

import { motion } from "framer-motion";
import { iconButtonHoverState } from "@/lib/animations";

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  label: string;
}

export function IconButton({ icon, onClick, label }: IconButtonProps) {
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
