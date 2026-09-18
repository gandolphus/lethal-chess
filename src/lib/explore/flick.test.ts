/**
 * Throwing the map. Letting go mid-drag should keep it moving and let friction stop it, rather than
 * making the reader drag every pixel of a chart four screens tall.
 */
import { describe, expect, it } from 'vitest';
import { FLICK_MIN, FLICK_WINDOW_MS, GLIDE_STOP, GLIDE_TAU_MS, flickVelocity, glideStep, isFlick } from './linemap';

/** A drag sampled every `step` ms, moving `dx, dy` per sample. */
const drag = (n: number, dx: number, dy = 0, step = 16, from = 1000) =>
	Array.from({ length: n }, (_, i) => ({ x: i * dx, y: i * dy, t: from + i * step }));

describe('flickVelocity', () => {
	it('measures the speed the pointer was actually travelling', () => {
		// 16px every 16ms is 1px/ms.
		const v = flickVelocity(drag(10, 16));
		expect(v.x).toBeCloseTo(1, 6);
		expect(v.y).toBe(0);
	});

	it('reads only the end of the drag, so a flick after a slow haul still flies', () => {
		const slow = drag(20, 1, 0, 16, 1000); // 0.0625 px/ms for 320ms
		const last = slow[slow.length - 1];
		// …then three fast samples at the end.
		const fast = [1, 2, 3].map((i) => ({ x: last.x + i * 30, y: 0, t: last.t + i * 16 }));
		const v = flickVelocity([...slow, ...fast]);
		// Nothing outside the window counts, so the haul barely registers: the answer is an order of
		// magnitude above its 0.0625, and a throw.
		expect(v.x).toBeGreaterThan(0.9);
		expect(isFlick(v)).toBe(true);
		// It is still an average across the window, not the last frame alone — three fast frames out of
		// six should not fling as hard as a drag that was fast throughout.
		const sustained = flickVelocity(drag(20, 30));
		expect(v.x).toBeLessThan(sustained.x);
	});

	it('gives nothing for a drag that ended stationary, however fast it began', () => {
		const fast = drag(6, 40, 0, 16, 1000);
		const end = fast[fast.length - 1];
		// The finger rests on the spot for longer than the window before lifting.
		const still = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: end.x, y: end.y, t: end.t + i * 16 }));
		const v = flickVelocity([...fast, ...still]);
		expect(v.x).toBe(0);
		expect(isFlick(v)).toBe(false);
	});

	it('is stopped by the release point, which is the only sample a resting finger produces', () => {
		// A pointer that stops moving stops sending `pointermove`, so a finger held still leaves no
		// trace of having stopped — except where it was when it lifted.
		const moving = drag(6, 40, 0, 16, 1000);
		const end = moving[moving.length - 1];
		const thrown = flickVelocity(moving);
		expect(isFlick(thrown)).toBe(true);
		// The same trail, plus the lift 300ms later at the same spot.
		const released = [...moving, { x: end.x, y: end.y, t: end.t + 300 }];
		expect(flickVelocity(released)).toEqual({ x: 0, y: 0 });
	});

	it('is nothing at all without two samples to compare', () => {
		expect(flickVelocity([])).toEqual({ x: 0, y: 0 });
		expect(flickVelocity([{ x: 5, y: 5, t: 1 }])).toEqual({ x: 0, y: 0 });
		// Two samples in the same millisecond would divide by zero.
		expect(flickVelocity([{ x: 0, y: 0, t: 7 }, { x: 9, y: 9, t: 7 }])).toEqual({ x: 0, y: 0 });
	});

	it('carries both axes, since a map is thrown in any direction', () => {
		const v = flickVelocity(drag(8, 8, -16));
		expect(v.x).toBeCloseTo(0.5, 6);
		expect(v.y).toBeCloseTo(-1, 6);
	});

	it('uses a window long enough to hold several frames of a 60Hz drag', () => {
		expect(FLICK_WINDOW_MS).toBeGreaterThanOrEqual(3 * 16);
	});
});

describe('glideStep', () => {
	it('covers the same ground however the frames fall', () => {
		const run = (frame: number) => {
			let v = 2;
			let moved = 0;
			for (let t = 0; t < 2000; t += frame) {
				const step = glideStep(v, frame);
				moved += step.moved;
				v = step.velocity;
			}
			return moved;
		};
		// 120Hz, 60Hz, and a browser dropping to 20Hz all land within a pixel of each other.
		expect(run(8)).toBeCloseTo(run(16), 6);
		expect(run(16)).toBeCloseTo(run(50), 6);
	});

	it('throws a distance the reader can predict: speed × the time constant', () => {
		let v = 2;
		let moved = 0;
		for (let t = 0; t < 4000; t += 16) {
			const step = glideStep(v, 16);
			moved += step.moved;
			v = step.velocity;
		}
		expect(moved).toBeCloseTo(2 * GLIDE_TAU_MS, 1);
	});

	it('always slows down, and reaches a stop rather than creeping forever', () => {
		let v = 3;
		let frames = 0;
		while (Math.abs(v) >= GLIDE_STOP && frames < 1000) {
			const previous = Math.abs(v);
			v = glideStep(v, 16).velocity;
			expect(Math.abs(v)).toBeLessThan(previous);
			frames++;
		}
		expect(frames).toBeLessThan(200); // under ~3 seconds at 60Hz
	});

	it('does not move a map that was not thrown', () => {
		expect(glideStep(0, 16).moved).toBe(0);
		expect(glideStep(0, 16).velocity).toBe(0);
	});

	it('goes backwards just as far', () => {
		const forward = glideStep(1.5, 16);
		const back = glideStep(-1.5, 16);
		expect(back.moved).toBeCloseTo(-forward.moved, 9);
		expect(back.velocity).toBeCloseTo(-forward.velocity, 9);
	});
});

describe('isFlick', () => {
	it('separates a throw from placing the map somewhere', () => {
		expect(isFlick({ x: 0.02, y: 0.02 })).toBe(false);
		expect(isFlick({ x: FLICK_MIN, y: 0 })).toBe(true);
		// The threshold is a speed, not a per-axis one: a diagonal flick counts.
		expect(isFlick({ x: FLICK_MIN * 0.8, y: FLICK_MIN * 0.8 })).toBe(true);
	});

	it('is set low enough that an ordinary flick throws a useful distance', () => {
		// The slowest throw still travels far enough to be worth the animation.
		expect(FLICK_MIN * GLIDE_TAU_MS).toBeGreaterThan(30);
	});
});
