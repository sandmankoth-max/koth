// Shared profanity list — mirrors public.is_profane in the database.
// Server enforces this via triggers; this client-side check gives an
// immediate, friendly error before the network round-trip.
export const PROFANITY_WORDS = [
  "fuck","shit","bitch","cunt","nigger","nigga","faggot","fag","retard",
  "rape","rapist","slut","whore","dick","pussy","cock","asshole","kike",
  "chink","spic","tranny","pedo","pedophile","molest",
] as const;

export function isProfane(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return PROFANITY_WORDS.some((w) => t.includes(w));
}
