"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import {
  type TempPasswordState,
  deleteAction,
  issueTempPasswordAction,
  renameAction,
  setDisabledAction,
} from "./actions";

type Player = { id: string; runnerName: string; disabled: boolean; isSelf: boolean };

export function PlayerActions({ player }: { player: Player }) {
  const [temp, tempAction] = useActionState(issueTempPasswordAction, {} as TempPasswordState);
  const [rename, renameFormAction] = useActionState(renameAction, initialFormState);
  const [toggle, toggleAction] = useActionState(setDisabledAction, initialFormState);
  const [del, delAction] = useActionState(deleteAction, initialFormState);

  return (
    <div className="mt-3 space-y-5 border-t border-border pt-3">
      <form action={tempAction}>
        <input type="hidden" name="userId" value={player.id} />
        {temp.error && <FormMessage tone="error">{temp.error}</FormMessage>}
        {temp.tempPassword && (
          <div role="status" className="mb-3 rounded border border-warn p-3">
            <p className="mb-2 text-sm">{temp.message}</p>
            <output
              className="block font-mono text-lg tracking-wider text-warn select-all"
              aria-label="Temporary password"
            >
              {temp.tempPassword}
            </output>
          </div>
        )}
        <SubmitButton variant="secondary" pendingText="Issuing…">
          Issue temporary password
        </SubmitButton>
      </form>

      <form action={renameFormAction}>
        <input type="hidden" name="userId" value={player.id} />
        {rename.error && <FormMessage tone="error">{rename.error}</FormMessage>}
        <Field
          label="Rename runner"
          name="runnerName"
          id={`rename-${player.id}`}
          defaultValue={rename.values?.runnerName ?? player.runnerName}
          autoCapitalize="none"
        />
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save name
        </SubmitButton>
      </form>

      {!player.isSelf && (
        <form action={toggleAction}>
          <input type="hidden" name="userId" value={player.id} />
          <input type="hidden" name="disabled" value={player.disabled ? "0" : "1"} />
          {toggle.error && <FormMessage tone="error">{toggle.error}</FormMessage>}
          <SubmitButton variant={player.disabled ? "secondary" : "danger"} pendingText="Saving…">
            {player.disabled ? "Enable account" : "Disable account"}
          </SubmitButton>
        </form>
      )}

      {!player.isSelf && (
        <form action={delAction}>
          <input type="hidden" name="userId" value={player.id} />
          {del.error && <FormMessage tone="error">{del.error}</FormMessage>}
          <Field
            label={`Type "${player.runnerName}" to delete this account`}
            name="confirm"
            id={`delete-${player.id}`}
            autoComplete="off"
            autoCapitalize="none"
            hint="Their results stay in past events under an anonymous name. This cannot be undone."
          />
          <SubmitButton variant="danger" pendingText="Deleting…">
            Delete account
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
