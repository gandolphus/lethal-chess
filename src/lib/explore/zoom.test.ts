/**
 * The map's zoom. A phone's chart is around 1400 × 3700 in a 390 × 600 frame, so at scale 1 the reader
 * sees four per cent of it — these are the rules that make it a map instead.
 */
import { describe, expect, it } from 'vitest';
import { centerOffset, clampScale, contentPoint, FLOOR_SCALE, MAX_SCALE, openingScale, scaleBounds, scrollFor } from './linemap';

const PHONE = { width: 388, height: 595 };
const DESKTOP = { width: 1116, height: 798 };
const CHART = { width: 1422, height: 3688 };

describe('where the map opens', () => {
	it('fits a phone to the width, because at 1 it would show four per cent of the chart', () => {
		const bounds = scaleBounds(PHONE, CHART);
		expect(openingScale(bounds, true)).toBe(bounds.fit);
		expect(openingScale(bounds, true)).toBeLessThan(1);
	});

	it('leaves a desktop at its natural size, where zoom is asked for rather than imposed', () => {
		const bounds = scaleBounds(DESKTOP, CHART);
		// `fit` would shrink it to 0.78 for no reason: a desktop window already holds enough to read.
		expect(bounds.fit).toBeLessThan(1);
		expect(openingScale(bounds, false)).toBe(1);
	});

	it('still never opens outside what a pinch could reach', () => {
		// A frame bigger than the chart cannot go below 1, so "natural size" and the floor agree.
		const bounds = scaleBounds({ width: 3000, height: 5000 }, CHART);
		expect(openingScale(bounds, false)).toBe(clampScale(1, bounds));
		expect(openingScale(bounds, true)).toBeGreaterThanOrEqual(bounds.min);
	});
});

describe('scaleBounds', () => {
	it('opens on the whole breadth of the opening, which is the axis that means something', () => {
		const { fit } = scaleBounds(PHONE, CHART);
		expect(fit).toBeCloseTo(388 / 1422, 5);
		expect(CHART.width * fit).toBeCloseTo(PHONE.width, 5);
		// The full width, and most of the height — "most of the map", not a corner of it.
		expect((PHONE.height / (CHART.height * fit)) * 100).toBeGreaterThan(50);
	});

	it('lets a pinch reach exactly the whole chart, and no further', () => {
		const { min } = scaleBounds(PHONE, CHART);
		expect(CHART.height * min).toBeCloseTo(PHONE.height, 5);
		expect(CHART.width * min).toBeLessThanOrEqual(PHONE.width + 0.001);
	});

	it('never shrinks to a smudge, however tall the chart', () => {
		const { min, fit } = scaleBounds(PHONE, { width: 1422, height: 400_000 });
		expect(min).toBe(FLOOR_SCALE);
		expect(fit).toBeGreaterThanOrEqual(min);
	});

	it('does not zoom past 1 to fill a frame bigger than the chart', () => {
		expect(scaleBounds({ width: 3000, height: 3000 }, { width: 800, height: 600 })).toEqual({ min: 1, fit: 1 });
	});

	it('is inert before the frame has been measured', () => {
		expect(scaleBounds({ width: 0, height: 0 }, CHART)).toEqual({ min: FLOOR_SCALE, fit: 1 });
	});
});

describe('clampScale', () => {
	const bounds = scaleBounds(PHONE, CHART);
	it('holds a pinch between "the whole chart" and "as close as is useful"', () => {
		expect(clampScale(99, bounds)).toBe(MAX_SCALE);
		expect(clampScale(0.0001, bounds)).toBe(bounds.min);
		expect(clampScale(1.5, bounds)).toBe(1.5);
	});
});

describe('centerOffset', () => {
	it('centres a chart narrower than its frame', () => {
		expect(centerOffset(388, 200)).toBe(94);
	});

	it('is nothing once the chart is the wider of the two, so no part of it sits left of the origin', () => {
		// The bug this replaced: a flex container centring 1164px of chart in a 388px frame put 388px of
		// it left of the scroll origin, where no scroll position could reach it.
		expect(centerOffset(388, 1164)).toBe(0);
	});
});

describe('zooming holds the point it was aimed at', () => {
	const frame = PHONE;
	const chart = CHART;
	const held = (px: number, py: number, scale: number, scrollLeft = 0, scrollTop = 0) =>
		contentPoint({ scrollLeft, scrollTop, px, py, scale, frameWidth: frame.width, chartWidth: chart.width });

	/** Where a chart point lands in the frame, given a scroll offset — the inverse of the two helpers. */
	const screenX = (x: number, scale: number, left: number) => x * scale + centerOffset(frame.width, chart.width * scale) - left;
	const screenY = (y: number, scale: number, top: number) => y * scale - top;

	it('keeps the grabbed point under the fingers while zooming in', () => {
		const from = 388 / 1422;
		const px = 194;
		const py = 300;
		// A scroll position the scroller can really be at: at `fit` the chart is 1006 tall in a 595 frame.
		const anchor = held(px, py, from, 0, 300);
		const to = from * 2.5;
		const at = scrollFor({ anchor, px, py, scale: to, frame, chart });
		expect(screenX(anchor.x, to, at.left)).toBeCloseTo(px, 6);
		expect(screenY(anchor.y, to, at.top)).toBeCloseTo(py, 6);
		// Zooming in about a point never lands on an end, so the clamp had nothing to say here.
		expect(at.left).toBeGreaterThan(0);
		expect(at.top).toBeGreaterThan(0);
	});

	it('keeps it under the fingers while zooming out, through the point where centring starts', () => {
		const from = 1;
		const px = 100;
		const py = 400;
		const anchor = held(px, py, from, 700, 2000);
		// Far enough out that the chart is narrower than the frame and the centre offset is non-zero.
		const to = scaleBounds(frame, chart).min * 0.999;
		expect(centerOffset(frame.width, chart.width * to)).toBeGreaterThan(0);
		const at = scrollFor({ anchor, px, py, scale: to, frame, chart });
		// At the far end there is nothing to scroll, so the answer is the clamp, not the anchor.
		expect(at).toEqual({ left: 0, top: 0 });
	});

	it('a gesture that only moves the fingers pans without zooming', () => {
		const scale = 0.5;
		const anchor = held(200, 300, scale, 120, 800);
		const moved = scrollFor({ anchor, px: 120, py: 220, scale, frame, chart });
		// The fingers went 80 left and 80 up, so the chart follows them: scroll increases by 80 in each.
		expect(moved.left).toBeCloseTo(200, 6);
		expect(moved.top).toBeCloseTo(880, 6);
	});

	it('never asks the scroller for a position it does not have', () => {
		const scale = 1;
		const at = scrollFor({ anchor: { x: 99_999, y: 99_999 }, px: 0, py: 0, scale, frame, chart });
		expect(at.left).toBe(chart.width - frame.width);
		expect(at.top).toBe(chart.height - frame.height);

		const back = scrollFor({ anchor: { x: -99_999, y: -99_999 }, px: 0, py: 0, scale, frame, chart });
		expect(back).toEqual({ left: 0, top: 0 });
	});

	it('the whole chart is reachable at every scale — nothing is cropped', () => {
		for (const scale of [scaleBounds(frame, chart).min, 0.4, 1, 2, MAX_SCALE]) {
			const drawnWidth = chart.width * scale;
			const drawnHeight = chart.height * scale;
			// Aim at the far bottom-right corner and ask to put it in the top-left of the frame.
			const at = scrollFor({ anchor: { x: chart.width, y: chart.height }, px: 0, py: 0, scale, frame, chart });
			// Which is exactly the scroller's own maximum: every pixel of the chart can be brought into view.
			expect(at.left).toBeCloseTo(Math.max(0, drawnWidth - frame.width), 6);
			expect(at.top).toBeCloseTo(Math.max(0, drawnHeight - frame.height), 6);
			// And the left edge is always reachable, which the flex-centred version could not manage.
			const origin = scrollFor({ anchor: { x: 0, y: 0 }, px: 0, py: 0, scale, frame, chart });
			expect(origin).toEqual({ left: 0, top: 0 });
		}
	});
});
