import { Badge } from "@/components/ui";

export function EventStatusBadge({ status, round }: { status: string; round?: number }) {
  if (status === "DONE") return <Badge tone="cyan">Done</Badge>;
  if (status === "SIGNUP") return <Badge>Sign-up</Badge>;
  if (status === "CUT") return <Badge tone="danger">Top cut</Badge>;
  return <Badge tone="danger">{round ? `Swiss R${round}` : "Swiss"}</Badge>;
}

export function formatLine(matchFormat: string, cutSize: number): string {
  const fmt = matchFormat === "DOUBLE" ? "Double-sided Swiss" : "Single-sided Swiss";
  return cutSize ? `${fmt} → top ${cutSize} cut` : `${fmt}, no cut`;
}
