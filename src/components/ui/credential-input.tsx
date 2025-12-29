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
        className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none transition-colors duration-200"
        style={{
          background: "var(--bg-input)",
          borderColor: "var(--border-light)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--border-focus)";
          e.target.style.background = "var(--bg-input-hover)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--border-light)";
          e.target.style.background = "var(--bg-input)";
        }}
      />
    </div>
  );
}
