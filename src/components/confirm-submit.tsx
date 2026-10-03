"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles, cx } from "./ui";

/**
 * Submit button that needs two taps: the first arms it ("Tap again to confirm"), the second submits.
 * Disarms itself after 4 seconds. For undoable-but-disruptive actions (undo/restart round).
 */
export function ConfirmSubmit({
  children,
  className,
  variant = "danger",
}: {
  children: ReactNode;
  className?: string;
  variant?: "danger" | "secondary";
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        } else {
          setArmed(false);
        }
      }}
      className={cx(buttonStyles[variant], armed && "border-danger bg-danger text-accent-fg", className)}
    >
      {pending ? "Working…" : armed ? "Tap again to confirm" : children}
    </button>
  );
}
