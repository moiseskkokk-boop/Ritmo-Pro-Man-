export type AiExperience = "man" | "woman";
export function buildUserAiContext<T>(input: { experience: AiExperience; authorized: boolean; data?: T }) {
  return input.authorized ? { experience: input.experience, data: input.data ?? null } : { experience: input.experience };
}
