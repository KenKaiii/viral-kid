// Shared animation variants for Framer Motion
import type { Variants } from "framer-motion";

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

export const modalVariants: Variants = {
  hidden: {
    scale: 0.95,
    y: 20,
  },
  visible: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.15,
    },
  },
};

export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

export const connectionStatusVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Hover states for buttons
export const buttonHoverState = {
  color: "rgba(255,255,255,1)",
  backgroundColor: "rgba(255,255,255,0.15)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

export const iconButtonHoverState = {
  color: "rgba(255,255,255,1)",
  backgroundColor: "rgba(255,255,255,0.1)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

export const dangerButtonHoverState = {
  color: "rgba(255,255,255,1)",
  backgroundColor: "rgba(239,68,68,0.4)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

export const dangerIconButtonHoverState = {
  color: "rgba(239,68,68,1)",
  backgroundColor: "rgba(239,68,68,0.15)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

export const playButtonHoverState = {
  color: "rgba(34,197,94,1)",
  backgroundColor: "rgba(34,197,94,0.15)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

export const stopButtonHoverState = {
  color: "rgba(239,68,68,1)",
  backgroundColor: "rgba(239,68,68,0.15)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

export const testButtonHoverState = {
  color: "rgba(168,85,247,1)",
  backgroundColor: "rgba(168,85,247,0.15)",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)",
};

// Stagger children animation
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};
