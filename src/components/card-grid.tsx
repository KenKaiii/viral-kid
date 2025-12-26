"use client";

import { useState } from "react";
import {
  Twitter,
  Youtube,
  Play,
  Database,
  Settings,
  FileText,
} from "lucide-react";

interface PlatformCardProps {
  icon?: React.ReactNode;
  label?: string;
  iconColor?: string;
}

function PlatformCard({ icon, label, iconColor }: PlatformCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative flex h-48 w-64 cursor-pointer flex-col overflow-hidden rounded-2xl border backdrop-blur-xl"
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
      {label && (
        <div className="relative z-10 px-5 pt-4">
          <h3 className="text-sm font-semibold tracking-wide text-white/90">
            {label}
          </h3>
        </div>
      )}

      {/* Icon */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        {icon && <div className={iconColor}>{icon}</div>}
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex items-center justify-center gap-1 border-t border-white/10 px-3 py-3">
        <ActionButton icon={<Play className="h-4 w-4" />} label="Run" />
        <ActionButton
          icon={<Database className="h-4 w-4" />}
          label="Database"
        />
        <ActionButton icon={<FileText className="h-4 w-4" />} label="Logs" />
        <ActionButton
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
        />
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Both states have same shadow structure: outer, inset-dark, inset-light
  const defaultShadow =
    "0 0px 0px rgba(0,0,0,0), inset 0 1px 2px rgba(0,0,0,0.2), inset 0 0px 0px rgba(255,255,255,0)";
  const hoverShadow =
    "0 2px 8px rgba(0,0,0,0.3), inset 0 0px 0px rgba(0,0,0,0), inset 0 1px 0 rgba(255,255,255,0.1)";

  return (
    <button
      className="relative rounded-lg px-3 py-2"
      style={{
        color: isHovered ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
        backgroundColor: isPressed
          ? "rgba(255,255,255,0.05)"
          : isHovered
            ? "rgba(255,255,255,0.1)"
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
      <h1 className="select-none text-4xl font-bold tracking-tight text-white">
        Viral Kid
      </h1>
    </div>
  );
}

export function CardGrid() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <Logo />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PlatformCard
          icon={<Twitter className="h-12 w-12" />}
          label="Twitter"
          iconColor="text-sky-400"
        />
        <PlatformCard
          icon={<Youtube className="h-12 w-12" />}
          label="YouTube"
          iconColor="text-red-500"
        />
        <PlatformCard label="Coming Soon" />
        <PlatformCard label="Coming Soon" />
      </div>
    </div>
  );
}
