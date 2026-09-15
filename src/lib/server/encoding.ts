export function encodeBase64url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Throws on anything that is not unpadded or padded base64url. */
export function decodeBase64url(text: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]*={0,2}$/.test(text)) throw new Error('Invalid base64url');
	const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, ''));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export const randomBase64url = (byteCount: number) => encodeBase64url(crypto.getRandomValues(new Uint8Array(byteCount)));
