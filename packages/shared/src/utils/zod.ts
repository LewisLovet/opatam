/**
 * Zod validation helpers.
 *
 * A raw `ZodError.message` is a JSON-stringified array of issues — never
 * something to show a human. These helpers turn validation failures into a
 * clean, user-readable message so toasts / inline errors never leak JSON.
 */
import { z } from 'zod';

/** First (most relevant) human-readable message from a ZodError. */
export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides';
}

/**
 * Validate `input` against `schema`, returning the parsed value. On failure
 * it throws a plain `Error` whose `.message` is the first issue's message
 * (e.g. "La description ne peut pas dépasser 2000 caractères") instead of a
 * `ZodError` whose `.message` is a raw JSON array.
 *
 * Use this in place of `schema.parse(input)` everywhere the error can reach
 * the UI (services consumed by forms). API routes that catch `ZodError`
 * explicitly keep working: a plain `Error` still carries the same readable
 * message through their `instanceof Error` branch.
 */
export function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(zodErrorMessage(result.error));
  }
  return result.data;
}
