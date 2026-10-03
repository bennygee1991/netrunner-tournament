"use client";

import { TypedConfirmForm } from "@/components/typed-confirm";
import { Card, CardTitle } from "@/components/ui";
import { archiveSeasonAction, resetAllAction } from "./actions";

export function ArchiveSeasonCard({
  seasonId,
  seasonName,
  unfinished,
}: {
  seasonId: string;
  seasonName: string;
  unfinished: number;
}) {
  return (
    <Card tone="warn">
      <CardTitle>End of season</CardTitle>
      <p className="mb-2 text-sm text-muted">
        After the final event: hand out the prizes, then archive. This saves the Month 1, Month 2 and Season
        boards (names, points and prizes) to Past seasons, awards the season podium trophies, and clears every
        event and sign-up for a fresh start. Player accounts, profiles and trophies are kept.
      </p>
      {unfinished > 0 && (
        <p className="mb-2 text-sm text-warn">
          {unfinished} event{unfinished === 1 ? " is" : "s are"} not finished and will not count.
        </p>
      )}
      <TypedConfirmForm
        id="archive-season"
        action={archiveSeasonAction}
        phrase={seasonName}
        fields={{ seasonId }}
        label={`Type "${seasonName}" to archive and reset`}
        buttonText="Archive season & reset"
      />
    </Card>
  );
}

export function ResetAllCard() {
  return (
    <Card tone="danger">
      <CardTitle>Reset everything</CardTitle>
      <p className="mb-3 text-sm text-muted">
        Wipes every season, event, result, past season, trophy and sign-up. This cannot be undone. The audit
        log is kept. Download a backup first.
      </p>
      <TypedConfirmForm
        id="reset-all"
        action={resetAllAction}
        phrase="RESET"
        label="Type RESET to unlock"
        buttonText="Wipe all data"
      >
        <label className="mb-4 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="deleteAccounts" className="size-5 accent-danger" />
          Also delete all player accounts (admin accounts are kept)
        </label>
      </TypedConfirmForm>
    </Card>
  );
}
