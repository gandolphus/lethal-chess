import type { Attempt } from '$lib/drill/session.svelte';
import type { Discovery } from '$lib/explore/book';

/** Client input that fails validation. Endpoints turn it into a 400. */
export class InvalidInput extends Error {}

/** A card state as it travels and is stored: ts-fsrs `Card` with its dates as ISO strings. */
export type CardJson = {
	due: string;
	stability: number;
	difficulty: number;
	elapsed_days: number;
	scheduled_days: number;
	learning_steps: number;
	reps: number;
	lapses: number;
	state: number;
	last_review?: string;
};

export type CardEntry = { bundleId: string; epd: string; state: CardJson };

const fail = (message: string): never => {
	throw new InvalidInput(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const BUNDLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RANK = '[pnbrqkPNBRQK1-8]{1,8}';
const EPD = new RegExp(`^${RANK}(?:/${RANK}){7} [wb] (?:-|(?=[KQkq])K?Q?k?q?) (?:-|[a-h][36])$`);
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_CP = 1_000_000;

export function parseBundleId(value: unknown): string {
	if (typeof value !== 'string' || value.length > 64 || !BUNDLE_ID.test(value)) fail('invalid bundleId');
	return value as string;
}

function parseEpd(value: unknown): string {
	if (typeof value !== 'string' || value.length > 100 || !EPD.test(value)) fail('invalid epd');
	return value as string;
}

function parseUci(value: unknown, field: string): string {
	if (typeof value !== 'string' || !UCI.test(value)) fail(`invalid ${field}`);
	return value as string;
}

function parseIso(value: unknown, field: string): string {
	if (typeof value !== 'string' || !ISO.test(value) || new Date(value).toISOString() !== value) fail(`invalid ${field}`);
	return value as string;
}

const isInt = (value: unknown, min: number, max: number): value is number =>
	Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseAttempt(value: unknown): Attempt {
	if (!isRecord(value)) return fail('attempt must be an object');
	const { mode, grade, costCp, attemptNo, responseMs } = value;
	if (mode !== 'learn' && mode !== 'practice') fail('invalid mode');
	if (grade !== 'pass' && grade !== 'soft' && grade !== 'fail') fail('invalid grade');
	if (costCp !== null && !isInt(costCp, -MAX_CP, MAX_CP)) fail('invalid costCp');
	if (!isInt(attemptNo, 1, 1000)) fail('invalid attemptNo');
	if (!isInt(responseMs, 0, 2 ** 31 - 1)) fail('invalid responseMs');
	return {
		bundleId: parseBundleId(value.bundleId),
		epd: parseEpd(value.epd),
		mode: mode as Attempt['mode'],
		played: parseUci(value.played, 'played'),
		expected: parseUci(value.expected, 'expected'),
		grade: grade as Attempt['grade'],
		costCp: costCp as number | null,
		attemptNo: attemptNo as number,
		responseMs: responseMs as number,
		at: parseIso(value.at, 'at')
	};
}

/** Validates a ts-fsrs card and keeps only its known fields. */
export function parseCardState(value: unknown): CardJson {
	if (!isRecord(value)) return fail('card state must be an object');
	const counts = ['elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses'] as const;
	for (const key of counts) if (!isInt(value[key], 0, 1_000_000)) fail(`invalid state.${key}`);
	if (!isFiniteNumber(value.stability) || value.stability < 0) fail('invalid state.stability');
	if (!isFiniteNumber(value.difficulty)) fail('invalid state.difficulty');
	if (!isInt(value.state, 0, 3)) fail('invalid state.state');

	const card: CardJson = {
		due: parseIso(value.due, 'state.due'),
		stability: value.stability as number,
		difficulty: value.difficulty as number,
		elapsed_days: value.elapsed_days as number,
		scheduled_days: value.scheduled_days as number,
		learning_steps: value.learning_steps as number,
		reps: value.reps as number,
		lapses: value.lapses as number,
		state: value.state as number
	};
	if (value.last_review !== undefined && value.last_review !== null) card.last_review = parseIso(value.last_review, 'state.last_review');
	return card;
}

export function parseCardEntry(value: unknown): CardEntry {
	if (!isRecord(value)) return fail('card must be an object');
	return { bundleId: parseBundleId(value.bundleId), epd: parseEpd(value.epd), state: parseCardState(value.state) };
}

export function parseDiscovery(value: unknown): Discovery {
	if (!isRecord(value)) return fail('discovery must be an object');
	if (value.stage !== 'entered' && value.stage !== 'discovered') fail('invalid stage');
	return {
		bundleId: parseBundleId(value.bundleId),
		line: parseEpd(value.line),
		stage: value.stage as Discovery['stage'],
		at: parseIso(value.at, 'at')
	};
}

export function parseList<T>(value: unknown, field: string, max: number, parse: (item: unknown) => T, min = 0): T[] {
	if (!Array.isArray(value)) return fail(`${field} must be an array`);
	if (value.length < min || value.length > max) fail(`${field} must have ${min}–${max} items`);
	return value.map((item, i) => {
		try {
			return parse(item);
		} catch (e) {
			if (e instanceof InvalidInput) throw new InvalidInput(`${field}[${i}]: ${e.message}`);
			throw e;
		}
	});
}

export function requireRecord(value: unknown): Record<string, unknown> {
	if (!isRecord(value)) fail('body must be a JSON object');
	return value as Record<string, unknown>;
}
