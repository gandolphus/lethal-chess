import type { ParamMatcher } from '@sveltejs/kit';

/** The ways of playing an opening that have a screen: /openings/[id]/<mode>. */
export const SESSION_MODES = ['explore', 'practice'] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

export const match: ParamMatcher = (param): param is SessionMode => (SESSION_MODES as readonly string[]).includes(param);
