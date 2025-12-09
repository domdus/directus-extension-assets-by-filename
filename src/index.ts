import type { Router, Request, Response } from 'express';

// HTTP request function using fetch
async function httpRequest(url: string, options?: { method?: string; headers?: Record<string, string> }): Promise<{
	status: number;
	statusText: string;
	headers: Record<string, string>;
	data: Buffer | string | any;
}> {
	const response = await fetch(url, {
		method: options?.method || 'GET',
		headers: options?.headers || {},
	});
	
	const arrayBuffer = await response.arrayBuffer();
	
	return {
		status: response.status,
		statusText: response.statusText,
		headers: Object.fromEntries(response.headers.entries()),
		data: Buffer.from(arrayBuffer)
	};
}

// Blacklist of Directus native endpoints that cannot be used as custom endpoint paths
const RESERVED_ENDPOINTS = [
	'items',
	'users',
	'roles',
	'permissions',
	'files',
	'collections',
	'relations',
	'fields',
	'settings',
	'activity',
	'revisions',
	'presets',
	'flows',
	'operations',
	'webhooks',
	'dashboards',
	'panels',
	'translations',
	'server',
	'extensions',
	'auth',
	'graphql',
	'static',
	'folders',
	'notifications',
	'utils',
	'schema',
	'assets', // Reserved as the default assets endpoint
] as const;

// Validate endpoint path against blacklist
function validateEndpointPath(endpointPath: string | undefined): void {
	if (!endpointPath) {
		return; // No custom path set, will use default 'assets' which is acceptable
	}
	
	const normalizedPath = endpointPath.toLowerCase().trim();
	
	if (RESERVED_ENDPOINTS.includes(normalizedPath as typeof RESERVED_ENDPOINTS[number])) {
		throw new Error(
			`The endpoint path "${endpointPath}" is reserved by Directus and cannot be used. ` +
			`Please choose a different value for ASSETS_FILENAME_ENDPOINT_PATH. ` +
			`Reserved endpoints: ${RESERVED_ENDPOINTS.join(', ')}`
		);
	}
}

interface EndpointContext {
	env: {
		PORT?: string | number;
		HOST?: string;
		[key: string]: string | number | undefined;
	};
	services: {
		FilesService: new (options: { schema: Record<string, any>; accountability?: any }) => any;
		[key: string]: any;
	};
	getSchema: () => Promise<Record<string, any>>;
}

interface DirectusRequest extends Request {
	accountability?: {
		user?: string | null;
		role?: string | null;
		[key: string]: unknown;
	};
}

export default {
	id: process.env.ASSETS_FILENAME_ENDPOINT_PATH || 'assetsf',
	handler: (router: Router, { env, services, getSchema }: EndpointContext) => {
		// Validate endpoint path on handler initialization
		const endpointPath = process.env.ASSETS_FILENAME_ENDPOINT_PATH;
		validateEndpointPath(endpointPath);
		
		// Proxy function that properly forwards all headers and status codes
		// This preserves the cache strategy from the default assets endpoint
		async function proxyToAssetsEndpoint(fileId: string, req: DirectusRequest, res: Response): Promise<void> {
			// Parse host and port from request or env vars
			// Since we're proxying internally, use the request's host or localhost
			let hostname = 'localhost';
			let port: number = typeof env.PORT === 'string' ? parseInt(env.PORT, 10) : (env.PORT || 8055);
			
			// Build path with query string to preserve transformation params (width, height, etc.)
			// req.url contains the full path including query string from the original request
			// We need to extract just the query string part and append it to our proxied path
			const queryString = req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
			const path = `/assets/${fileId}${queryString}`;
			
			// Try to get host from request first
			const hostHeader = req.get('host');
			if (hostHeader) {
				const [host, portStr] = hostHeader.split(':');
				hostname = host;
				if (portStr) {
					port = parseInt(portStr, 10);
				}
			} else if (env.HOST) {
				const [host, portStr] = env.HOST.split(':');
				hostname = host;
				if (portStr) {
					port = parseInt(portStr, 10);
				}
			}
			
			// Build the full URL for the sandbox request function
			const protocol = hostname === 'localhost' || hostname === '127.0.0.1' ? 'http' : 'https';
			const url = `${protocol}://${hostname}:${port}${path}`;
			
			// Create headers object, excluding host to avoid conflicts
			const headers: Record<string, string> = {};
			for (const [key, value] of Object.entries(req.headers)) {
				if (key.toLowerCase() !== 'host' && value !== undefined) {
					// Convert header values to strings (sandbox request expects string headers)
					if (Array.isArray(value)) {
						headers[key] = value.join(', ');
					} else {
						headers[key] = String(value);
					}
				}
			}
			
			try {
				// Use sandbox's request function (returns Promise with response object)
				const proxyRes = await httpRequest(url, {
					method: (req.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
					headers: headers,
				});
				
				// Forward status code
				res.statusCode = proxyRes.status || 200;
				res.statusMessage = proxyRes.statusText || 'OK';
				
				// Forward all headers (including cache headers)
				// This preserves the cache strategy from the default endpoint
				if (proxyRes.headers) {
					for (const [key, value] of Object.entries(proxyRes.headers)) {
						// Skip headers that shouldn't be forwarded
						if (value !== undefined && key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'transfer-encoding') {
							res.setHeader(key, String(value));
						}
					}
				}
				
				// Send response body
				// Note: sandbox request loads entire response in memory, which is fine for most assets
				if (proxyRes.data) {
					if (Buffer.isBuffer(proxyRes.data)) {
						res.send(proxyRes.data);
					} else if (typeof proxyRes.data === 'string') {
						res.send(proxyRes.data);
					} else {
						res.json(proxyRes.data);
					}
				} else {
					res.end();
				}
			} catch (err: unknown) {
				// Handle proxy request errors
				if (!res.headersSent) {
					console.log(`[directus-extension-assets-by-filename] Error proxying to assets endpoint: ${err instanceof Error ? err.message : String(err)}`);
					res.status(500).json({ 
						errors: [{ 
							message: 'Failed to proxy request to assets endpoint',
							extensions: { code: 'INTERNAL_SERVER_ERROR' }
						}] 
					});
				}
			}
		}

		// Shared handler function for file lookup by field
		async function handleFileLookup(
			req: DirectusRequest,
			res: Response,
			fieldName: 'filename_disk',
			value: string
		): Promise<void> {
			// Validate value is not empty
			if (!value || value.trim() === '') {
				res.sendStatus(404);
				return;
			}

			const { FilesService } = services;
			
			try {
				// Create FilesService with proper accountability to respect permissions
				const filesService = new FilesService({
					schema: await getSchema(),
					accountability: req.accountability,
				});
				
				// Query file by the specified field
				// Using readByQuery with accountability ensures permission checks are applied
				const files = await filesService.readByQuery({
					filter: {
						[fieldName]: {
							_eq: value
						}
					},
					limit: 1,
				});
				
				const file = files?.[0];
				
				if (!file) {
					res.sendStatus(404);
					return;
				}
				
				// Proxy to the default assets endpoint with the file ID
				// This ensures all default checks, caching, and behavior are preserved
				await proxyToAssetsEndpoint(file.id, req, res);
				
			} catch (err: unknown) {
				// Handle specific error types if needed
				const error = err as { status?: number; statusCode?: number };
				if (error.status === 403 || error.statusCode === 403) {
					res.sendStatus(403);
					return;
				}
				
				// Log error for debugging but don't expose internal details
				console.log(`[directus-extension-assets-by-filename] Error in endpoint: ${err instanceof Error ? err.message : String(err)}`);
				
				if (!res.headersSent) {
					res.sendStatus(404);
				}
			}
		}

		router.get(`/:filename`, async (req: DirectusRequest, res: Response) => {
			const filename = req.params['filename'] as string;
			await handleFileLookup(req, res, 'filename_disk', filename);
		});
	}
};

