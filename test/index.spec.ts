// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const makeObject = (size: number, contentType?: string) => {
	const blob = new Blob([new Uint8Array(size)]);
	return {
		body: blob.stream(),
		size,
		httpMetadata: contentType ? { contentType } : undefined,
	};
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('image worker', () => {
	it('returns 404 when no image is found', async () => {
		const get = vi.fn().mockResolvedValue(null);
		const mockEnv: any = { ...env, imgBucket: { get } };

		const request = new IncomingRequest('http://example.com/unknown');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, mockEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('No matching route or image could be found.');
		expect(get).toHaveBeenNthCalledWith(1, 'unknown.jpg');
		expect(get).toHaveBeenNthCalledWith(2, 'unknown.jpeg');
		expect(get).toHaveBeenNthCalledWith(3, 'unknown.png');
		expect(get).toHaveBeenNthCalledWith(4, 'unknown.gif');
	});

	it('serves from manual route map (e.g., "muppet" -> "muppet.jpg")', async () => {
		const get = vi.fn(async (key: string) => (key === 'muppet.jpg' ? makeObject(3, 'image/jpeg') : null));
		const mockEnv: any = { ...env, imgBucket: { get } };

		const request = new IncomingRequest('http://example.com/muppet');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, mockEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(response.headers.get('Content-Length')).toBe('3');
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('muppet.jpg');
	});

	it('falls back to .jpg for unknown paths', async () => {
		const get = vi.fn(async (key: string) => (key === 'custom.jpg' ? makeObject(5, 'image/jpeg') : null));
		const mockEnv: any = { ...env, imgBucket: { get } };

		const request = new IncomingRequest('http://example.com/custom');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, mockEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(response.headers.get('Content-Length')).toBe('5');
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('custom.jpg');
	});

	it('falls back through .jpg -> .jpeg -> .png -> .gif and serves first hit', async () => {
		const get = vi.fn(async (key: string) => {
			if (key === 'photo.jpg' || key === 'photo.jpeg') return null;
			if (key === 'photo.png') return makeObject(8, 'image/png');
			return null;
		});
		const mockEnv: any = { ...env, imgBucket: { get } };

		const request = new IncomingRequest('http://example.com/photo');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, mockEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');
		expect(response.headers.get('Content-Length')).toBe('8');
		expect(get).toHaveBeenNthCalledWith(1, 'photo.jpg');
		expect(get).toHaveBeenNthCalledWith(2, 'photo.jpeg');
		expect(get).toHaveBeenNthCalledWith(3, 'photo.png');
		expect(get).not.toHaveBeenCalledWith('photo.gif');
	});

	it('defaults Content-Type to image/jpeg when httpMetadata is missing', async () => {
		const get = vi.fn().mockResolvedValue(makeObject(2));
		const mockEnv: any = { ...env, imgBucket: { get } };

		const request = new IncomingRequest('http://example.com/foo');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, mockEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(response.headers.get('Content-Length')).toBe('2');
		expect(get).toHaveBeenCalledWith('foo.jpg');
	});
});
