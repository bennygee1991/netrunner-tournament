import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function PageTitle({ kicker, children }: { kicker?: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      {kicker && <p className="font-mono text-xs tracking-widest text-magenta uppercase">&gt; {kicker}</p>}
      <h1 className="text-2xl font-bold tracking-wide uppercase">{children}</h1>
    </div>
  );
}

export function Card({
  tone = "cyan",
  className,
  ...props
}: ComponentProps<"section"> & { tone?: "cyan" | "magenta" | "warn" | "danger" }) {
  const border = {
    cyan: "border-l-cyan",
    magenta: "border-l-magenta",
    warn: "border-l-warn",
    danger: "border-l-danger",
  }[tone];
  return (
    <section
      className={cx("my-3 rounded border border-l-4 border-border bg-surface p-4", border, className)}
      {...props}
    />
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-bold tracking-wide uppercase">{children}</h2>;
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded border px-4 py-2 font-mono text-sm font-bold tracking-wider uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: cx(buttonBase, "border-cyan bg-cyan text-accent-fg hover:opacity-90"),
  secondary: cx(buttonBase, "border-border bg-surface text-fg hover:border-cyan"),
  danger: cx(buttonBase, "border-danger bg-transparent text-danger hover:bg-danger hover:text-accent-fg"),
  link: "font-mono text-sm text-cyan underline-offset-4 hover:underline",
};

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: ComponentProps<"input"> & { label: string; name: string; error?: string; hint?: string }) {
  const id = input.id ?? `f-${name}`;
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");
  return (
    <div className="mb-4 flex flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs tracking-widest text-muted uppercase">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cx(
          "min-h-11 rounded border bg-bg px-3 py-2 font-mono text-base text-fg",
          error ? "border-danger" : "border-border focus:border-cyan",
        )}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "mb-4 rounded border px-3 py-2 text-sm",
        tone === "error" ? "border-danger text-danger" : "border-ok text-ok",
      )}
    >
      {children}
    </p>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "cyan" | "danger";
}) {
  const color = {
    muted: "border-border text-muted",
    cyan: "border-cyan text-cyan",
    danger: "border-danger text-danger",
  }[tone];
  return (
    <span
      className={cx(
        "inline-block rounded border px-2 py-0.5 font-mono text-[11px] tracking-widest uppercase",
        color,
      )}
    >
      {children}
    </span>
  );
}
