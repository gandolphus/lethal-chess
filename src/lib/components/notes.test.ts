import { expect, it } from 'vitest';
import { noNotes, penOf, toggleArrow, toggleSquare } from './board';

it('marks a square and unmarks it with the same gesture', () => {
	const once = toggleSquare(noNotes(), 'e4');
	expect(once.squares).toEqual([{ square: 'e4', pen: 1 }]);
	expect(toggleSquare(once, 'e4').squares).toEqual([]);
});

it('keeps marks apart', () => {
	const two = toggleSquare(toggleSquare(noNotes(), 'e4'), 'd5');
	expect(toggleSquare(two, 'e4').squares).toEqual([{ square: 'd5', pen: 1 }]);
});

it('draws an arrow and erases it with the same drag', () => {
	const once = toggleArrow(noNotes(), 'b1', 'c3');
	expect(once.arrows).toEqual([{ from: 'b1', to: 'c3', pen: 1 }]);
	expect(toggleArrow(once, 'b1', 'c3').arrows).toEqual([]);
});

it('treats an arrow drawn the other way round as a different arrow', () => {
	const back = toggleArrow(toggleArrow(noNotes(), 'b1', 'c3'), 'c3', 'b1');
	expect(back.arrows).toHaveLength(2);
});

it('leaves squares alone when arrows change, and the reverse', () => {
	const mixed = toggleArrow(toggleSquare(noNotes(), 'e4'), 'b1', 'c3');
	expect(toggleArrow(mixed, 'b1', 'c3').squares).toEqual([{ square: 'e4', pen: 1 }]);
	expect(toggleSquare(mixed, 'e4').arrows).toHaveLength(1);
});

it('recolours a mark rather than stacking a second one on it', () => {
	const orange = toggleSquare(noNotes(), 'e4');
	const violet = toggleSquare(orange, 'e4', 2);
	expect(violet.squares).toEqual([{ square: 'e4', pen: 2 }]);
	// And the same pen again still takes it away.
	expect(toggleSquare(violet, 'e4', 2).squares).toEqual([]);
});

it('recolours an arrow the same way', () => {
	const teal = toggleArrow(toggleArrow(noNotes(), 'b1', 'c3'), 'b1', 'c3', 3);
	expect(teal.arrows).toEqual([{ from: 'b1', to: 'c3', pen: 3 }]);
});

it('picks the pen from the modifiers held', () => {
	expect(penOf({ shiftKey: false, altKey: false })).toBe(1);
	expect(penOf({ shiftKey: true, altKey: false })).toBe(2);
	expect(penOf({ shiftKey: false, altKey: true })).toBe(3);
	expect(penOf({ shiftKey: true, altKey: true })).toBe(4);
});
