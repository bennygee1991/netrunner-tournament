"use client";

import { useId, useState } from "react";
import { ROUND_MINUTES } from "@/engine";
import { cx } from "@/components/ui";

export interface EventFormat {
  matchFormat: string;
  swissRounds: number | null;
  cutSize: number;
  cutFormat: string;
}

const legendClass = "mb-2 font-mono text-xs tracking-widest text-muted uppercase";

/** A row of tick-style toggles (radio buttons styled as pills). */
function Toggle({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub?: string }[];
}) {
  return (
    <fieldset className="mb-4">
      <legend className={legendClass}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              "flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center rounded border px-3 py-2 text-sm",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan",
              value === o.value ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan",
            )}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="size-4 accent-cyan"
              />
              <span className="font-semibold">{o.label}</span>
            </span>
            {o.sub && <span className="mt-0.5 text-xs text-muted">{o.sub}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Format choices for any event (season or one-off): sides, Swiss rounds, top cut and cut matches.
 * `prefix` namespaces the field names when one form holds several events (season creation).
 */
export function EventFormatFields({
  initial,
  prefix = "",
  errors = {},
  autoRounds,
}: {
  initial: EventFormat;
  prefix?: string;
  errors?: Partial<Record<string, string>>;
  autoRounds?: number;
}) {
  const [matchFormat, setMatchFormat] = useState(initial.matchFormat);
  const [cutSize, setCutSize] = useState(String(initial.cutSize));
  const [cutFormat, setCutFormat] = useState(initial.cutFormat);
  const roundsId = useId();
  const n = (f: string) => `${prefix}${f}`;
  return (
    <>
      <Toggle
        legend="Match format"
        name={n("matchFormat")}
        value={matchFormat}
        onChange={setMatchFormat}
        options={[
          {
            value: "SINGLE",
            label: "Single-sided",
            sub: `1 game per round, the site assigns Corp or Runner · ${ROUND_MINUTES.single} min rounds`,
          },
          {
            value: "DOUBLE",
            label: "Double-sided",
            sub: `2 games per round, everyone plays both sides · ${ROUND_MINUTES.double} min rounds`,
          },
        ]}
      />
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor={roundsId} className={legendClass}>
          Swiss rounds
        </label>
        <input
          id={roundsId}
          name={n("swissRounds")}
          type="number"
          inputMode="numeric"
          min={1}
          max={9}
          defaultValue={initial.swissRounds ?? ""}
          placeholder={
            autoRounds ? `Auto (${autoRounds} for the current entrants)` : "Auto (by player count)"
          }
          aria-invalid={errors.swissRounds ? true : undefined}
          className="min-h-11 rounded border border-border bg-bg px-3 py-2 font-mono text-base text-fg focus:border-cyan"
        />
        {errors.swissRounds && <p className="text-sm text-danger">{errors.swissRounds}</p>}
      </div>
      <Toggle
        legend="Top cut"
        name={n("cutSize")}
        value={cutSize}
        onChange={setCutSize}
        options={[
          { value: "0", label: "None", sub: "Swiss only, points per win" },
          { value: "4", label: "Top 4" },
          { value: "8", label: "Top 8" },
        ]}
      />
      {cutSize !== "0" ? (
        <Toggle
          legend="Cut matches"
          name={n("cutFormat")}
          value={cutFormat}
          onChange={setCutFormat}
          options={[
            {
              value: "SERIES",
              label: "Higher seed picks sides",
              sub: `2 games, sides swap, coin-flip decider · ${ROUND_MINUTES.cutMatch} min + ${ROUND_MINUTES.cutDecider} min`,
            },
            {
              value: "SINGLE",
              label: "Single game",
              sub: `Sides set by the site · ${ROUND_MINUTES.cutSingle} min`,
            },
          ]}
        />
      ) : (
        <input type="hidden" name={n("cutFormat")} value={cutFormat} />
      )}
    </>
  );
}
