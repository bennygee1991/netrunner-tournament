/** State returned by form server actions and rendered by useActionState. */
export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  message?: string;
  /** Echoed non-secret values so the form keeps what the user typed. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}
