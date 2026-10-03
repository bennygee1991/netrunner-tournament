import Link from "next/link";

/** Profile link for account holders; plain text for walk-ins and deleted players. */
export function PlayerLink({ name, profile }: { name: string; profile: string | null }) {
  if (!profile) return <span>{name}</span>;
  return (
    <Link href={`/players/${encodeURIComponent(profile)}`} className="hover:text-cyan hover:underline">
      {name}
    </Link>
  );
}
