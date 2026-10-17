"use client";
import { useFormStatus } from "react-dom";

/**
 * Submit button for server-rendered <form action={serverAction}>: disables itself and sets aria-busy while its form
 * is submitting, so the press shows at once (globals.css draws the spinner on [aria-busy] after 150 ms).
 */
export function PendingButton({ children, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...rest} disabled={disabled || pending} aria-busy={pending || undefined}>
      {children}
    </button>
  );
}
