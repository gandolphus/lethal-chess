import { describe, expect, it } from 'vitest';
import { addMove, createRoot, isAlternative, moveNumber, pathTo, promote, remove, segments } from './movetree';

/** 1.e4 e5 2.Nf3 with two alternatives to 2.Nf3, one of which has a reply of its own. */
function tree() {
	const root = createRoot();
	const e4 = addMove(root, 'e2e4', 'e4', 'book');
	const e5 = addMove(e4, 'e7e5', 'e5', 'book');
	const nf3 = addMove(e5, 'g1f3', 'Nf3', 'best');
	const bc4 = addMove(e5, 'f1c4', 'Bc4', 'good');
	const nc6 = addMove(bc4, 'b8c6', 'Nc6');
	const qh5 = addMove(e5, 'd1h5', 'Qh5', 'blunder');
	return { root, e4, e5, nf3, bc4, nc6, qh5 };
}

describe('move tree', () => {
	it('follows an existing move instead of branching twice', () => {
		const { e5, nf3 } = tree();
		expect(addMove(e5, 'g1f3', 'Nf3')).toBe(nf3);
		expect(e5.children).toHaveLength(3);
	});

	it('knows the path to a move and which moves are alternatives', () => {
		const { nc6, bc4, nf3 } = tree();
		expect(pathTo(nc6).map((m) => m.san)).toEqual(['e4', 'e5', 'Bc4', 'Nc6']);
		expect(isAlternative(nf3)).toBe(false);
		expect(isAlternative(bc4)).toBe(true);
	});

	it('reads as the line first, then each alternative under it', () => {
		const { root } = tree();
		expect(segments(root).map((s) => [s.depth, s.moves.map((m) => m.san).join(' ')])).toEqual([
			[0, 'e4 e5 Nf3'],
			[1, 'Bc4 Nc6'],
			[1, 'Qh5']
		]);
	});

	it('promotes a branch to the line and removes one with everything after it', () => {
		const { root, e5, bc4, qh5 } = tree();
		promote(bc4);
		expect(segments(root)[0].moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Bc4', 'Nc6']);
		expect(remove(qh5)).toBe(e5);
		expect(e5.children.map((m) => m.san)).toEqual(['Bc4', 'Nf3']);
	});

	it('numbers moves the way a reader expects', () => {
		expect(moveNumber(1)).toBe('1.');
		expect(moveNumber(2)).toBe('1…');
		expect(moveNumber(7)).toBe('4.');
	});
});
