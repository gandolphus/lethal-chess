// What a scene needs from the board that CSS cannot compute on its own.

const GOLDEN = 0.6180339887498949;

/**
 * Where in its sway cycle a piece starts, 0–1, from its square's index on the board. Pieces in a trance
 * should not move in step, and should not look random either: the golden-ratio sequence scatters the
 * phases evenly, so neighbours are always well apart and no two pieces on the board share one.
 */
export function swayPhase(index: number): number {
	const phase = (index * GOLDEN) % 1;
	return phase < 0 ? phase + 1 : phase;
}
