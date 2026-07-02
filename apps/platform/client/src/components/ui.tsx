import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg bg-navy px-4 py-2.5 font-medium text-white transition hover:bg-navy-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
      />
    </label>
  );
}
