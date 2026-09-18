import { describe, expect, it } from 'vitest';
import { clearDraft, MAX_BODY, ownPath, readDraft, writeDraft } from './report';

/** A Storage that remembers, or one that refuses. */
const memory = () => {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key)
	};
};
const broken = {
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	},
	removeItem: () => {
		throw new Error('blocked');
	}
};

describe('the page a report is about', () => {
	it('is a path within this site', () => {
		expect(ownPath('/openings/italian-game/explore')).toBe('/openings/italian-game/explore');
		expect(ownPath('/')).toBe('/');
		expect(ownPath('/settings?theme=night')).toBe('/settings?theme=night');
	});

	it('is never another site, however the slash is spelled', () => {
		expect(ownPath('//evil.example')).toBeNull();
		expect(ownPath('/\\evil.example')).toBeNull();
		expect(ownPath('https://evil.example/')).toBeNull();
		expect(ownPath('evil')).toBeNull();
		expect(ownPath('')).toBeNull();
		expect(ownPath(null)).toBeNull();
		expect(ownPath(undefined)).toBeNull();
		expect(ownPath('/' + 'a'.repeat(300))).toBeNull();
	});
});

describe('a half-written report', () => {
	it('is kept when the form closes and found when it opens', () => {
		const storage = memory();
		writeDraft(storage, { kind: 'idea', body: 'The map could', contact: 'me@example.com' });
		expect(readDraft(storage)).toEqual({ kind: 'idea', body: 'The map could', contact: 'me@example.com' });
	});

	it('is nothing once there is nothing in it', () => {
		const storage = memory();
		writeDraft(storage, { kind: 'bug', body: 'x', contact: '' });
		writeDraft(storage, { kind: 'bug', body: '', contact: '' });
		expect(storage.map.size).toBe(0);
		expect(readDraft(storage)).toBeNull();
	});

	it('goes when the report is sent', () => {
		const storage = memory();
		writeDraft(storage, { kind: 'bug', body: 'It broke', contact: '' });
		clearDraft(storage);
		expect(readDraft(storage)).toBeNull();
	});

	it('takes only what a draft can hold from whatever storage says', () => {
		const storage = memory();
		storage.setItem('lethal:report:draft', JSON.stringify({ kind: 'nonsense', body: 'a'.repeat(MAX_BODY + 50), contact: 7 }));
		const draft = readDraft(storage);
		expect(draft?.kind).toBe('bug');
		expect(draft?.body.length).toBe(MAX_BODY);
		expect(draft?.contact).toBe('');
		storage.setItem('lethal:report:draft', 'not json');
		expect(readDraft(storage)).toBeNull();
	});

	it('survives storage that is missing or refuses', () => {
		expect(readDraft(undefined)).toBeNull();
		expect(() => writeDraft(undefined, { kind: 'bug', body: 'x', contact: '' })).not.toThrow();
		expect(() => clearDraft(undefined)).not.toThrow();
		expect(readDraft(broken)).toBeNull();
		expect(() => writeDraft(broken, { kind: 'bug', body: 'x', contact: '' })).not.toThrow();
		expect(() => clearDraft(broken)).not.toThrow();
	});
});
