import { describe, expect, it } from 'vitest';
import { isPlainClick, layerAt, layerOfLink } from './layer';

const click = (over: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({
	button: 0,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	defaultPrevented: false,
	...over
});

const link = (href: string, over: Partial<{ target: string; download: string }> = {}) => ({
	href,
	target: '',
	download: '',
	...over
});

describe('which screens are layers', () => {
	it('names Settings and nothing else', () => {
		expect(layerAt('/settings')).toBe('settings');
		for (const page of ['/', '/settings/', '/settings/preview', '/privacy', '/credits', '/report', '/today']) {
			expect(layerAt(page)).toBeNull();
		}
	});
});

describe('which clicks a layer may take', () => {
	it('takes a plain left click', () => {
		expect(isPlainClick(click())).toBe(true);
	});

	it('leaves a new-tab click, a middle click and a handled click to the browser', () => {
		expect(isPlainClick(click({ metaKey: true }))).toBe(false);
		expect(isPlainClick(click({ ctrlKey: true }))).toBe(false);
		expect(isPlainClick(click({ shiftKey: true }))).toBe(false);
		expect(isPlainClick(click({ altKey: true }))).toBe(false);
		expect(isPlainClick(click({ button: 1 }))).toBe(false);
		expect(isPlainClick(click({ defaultPrevented: true }))).toBe(false);
	});
});

describe('which links open a layer', () => {
	const origin = 'https://lethalchess.com';

	it('opens Settings from a link to it, relative or absolute', () => {
		expect(layerOfLink(link('/settings'), origin)).toBe('settings');
		expect(layerOfLink(link('https://lethalchess.com/settings'), origin)).toBe('settings');
	});

	it('leaves other pages, other sites, downloads and links aimed at another tab alone', () => {
		expect(layerOfLink(link('/privacy'), origin)).toBeNull();
		expect(layerOfLink(link('https://example.com/settings'), origin)).toBeNull();
		expect(layerOfLink(link('/settings', { target: '_blank' }), origin)).toBeNull();
		expect(layerOfLink(link('/settings', { download: 'x' }), origin)).toBeNull();
		expect(layerOfLink(link('/settings', { target: '_self' }), origin)).toBe('settings');
	});
});
