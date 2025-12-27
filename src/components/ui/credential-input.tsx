"use client";

interface CredentialInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "password";
}

export function CredentialInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: CredentialInputProps) {
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
        className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none backdrop-blur-xl transition-all duration-200"
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
    </div>
  );
}
