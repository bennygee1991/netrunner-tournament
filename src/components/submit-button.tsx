"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles, cx } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Working…",
  variant = "primary",
  className,
  disabled,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={cx(buttonStyles[variant], className)}>
      {pending ? pendingText : children}
    </button>
  );
}
