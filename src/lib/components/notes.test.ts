import { expect, it } from 'vitest';
import { noNotes, toggleArrow, toggleSquare } from './board';

it('marks a square and unmarks it with the same gesture', () => {
	const once = toggleSquare(noNotes(), 'e4');
	expect(once.squares).toEqual(['e4']);
	expect(toggleSquare(once, 'e4').squares).toEqual([]);
});

it('keeps marks apart', () => {
	const two = toggleSquare(toggleSquare(noNotes(), 'e4'), 'd5');
	expect(toggleSquare(two, 'e4').squares).toEqual(['d5']);
});

it('draws an arrow and erases it with the same drag', () => {
	const once = toggleArrow(noNotes(), 'b1', 'c3');
	expect(once.arrows).toEqual([{ from: 'b1', to: 'c3' }]);
	expect(toggleArrow(once, 'b1', 'c3').arrows).toEqual([]);
});

it('treats an arrow drawn the other way round as a different arrow', () => {
	const back = toggleArrow(toggleArrow(noNotes(), 'b1', 'c3'), 'c3', 'b1');
	expect(back.arrows).toHaveLength(2);
});

it('leaves squares alone when arrows change, and the reverse', () => {
	const mixed = toggleArrow(toggleSquare(noNotes(), 'e4'), 'b1', 'c3');
	expect(toggleArrow(mixed, 'b1', 'c3').squares).toEqual(['e4']);
	expect(toggleSquare(mixed, 'e4').arrows).toHaveLength(1);
});
