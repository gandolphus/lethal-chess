/**
 * The map's zoom. A phone's chart is around 1400 × 3700 in a 390 × 600 frame, so at scale 1 the reader
 * sees four per cent of it — these are the rules that make it a map instead.
 */
import { describe, expect, it } from 'vitest';
import { clampScale, FLOOR_SCALE, MAX_SCALE, scaleBounds, zoomAnchor } from './linemap';

const PHONE = { width: 388, height: 595 };
const CHART = { width: 1422, height: 3688 };

describe('scaleBounds', () => {
	it('opens on the whole breadth of the opening, which is the axis that means something', () => {
		const { fit } = scaleBounds(PHONE, CHART);
		expect(fit).toBeCloseTo(388 / 1422, 5);
		// The full width, and most of the height — "most of the map", not a corner of it.
		expect(CHART.width * fit).toBeCloseTo(PHONE.width, 5);
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
		const { min, fit } = scaleBounds({ width: 3000, height: 3000 }, { width: 800, height: 600 });
		expect(fit).toBe(1);
		expect(min).toBe(1);
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

describe('zoomAnchor', () => {
	it('keeps the point under the fingers under the fingers', () => {
		const from = 0.273;
		const to = from * 2.5;
		const px = 194;
		const py = 300;
		const scrollLeft = 120;
		const scrollTop = 900;
		// The chart point that was under (px, py) before the pinch.
		const cx = (scrollLeft + px) / from;
		const cy = (scrollTop + py) / from;

		const at = zoomAnchor({ scrollLeft, scrollTop, px, py, from, to });

		// After the pinch the same chart point must land on the same place in the frame.
		expect(cx * to - at.left).toBeCloseTo(px, 6);
		expect(cy * to - at.top).toBeCloseTo(py, 6);
	});

	it('is an identity when the scale does not change', () => {
		const at = zoomAnchor({ scrollLeft: 40, scrollTop: 80, px: 10, py: 20, from: 0.5, to: 0.5 });
		expect(at).toEqual({ left: 40, top: 80 });
	});

	it('pulls the chart back towards its origin when zooming out', () => {
		const at = zoomAnchor({ scrollLeft: 500, scrollTop: 1200, px: 194, py: 300, from: 1, to: 0.5 });
		expect(at.left).toBeLessThan(500);
		expect(at.top).toBeLessThan(1200);
	});
});
