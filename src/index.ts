import { request, IncomingMessage, ServerResponse } from 'http';
import type { Router, Request, Response } from 'express';
import type { Services, Schema } from '@directus/types';

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
	services: Services;
	getSchema: () => Promise<Schema>;
}

interface DirectusRequest extends Request {
	accountability?: {
		user?: string | null;
		role?: string | null;
		[key: string]: unknown;
	};
}

export default {
	id: process.env.ASSETS_FILENAME_ENDPOINT_PATH || 'assets',
	handler: (router: Router, { env, services, getSchema }: EndpointContext) => {
		// Validate endpoint path on handler initialization
		const endpointPath = process.env.ASSETS_FILENAME_ENDPOINT_PATH;
		validateEndpointPath(endpointPath);
		
		const assetsPathSeparator = process.env.ASSETS_FILENAME_ENDPOINT_PATH ? '' : '/_';
		
		// Proxy function that properly forwards all headers and status codes
		// This preserves the cache strategy from the default assets endpoint
		function proxyToAssetsEndpoint(fileId: string, req: DirectusRequest, res: Response): void {
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
			
			// Create headers object, excluding host to avoid conflicts
			const headers: Record<string, string | string[] | undefined> = { ...req.headers };
			delete headers.host;
			
			// Use options object format to avoid URL parsing issues
			const proxyReq = request(
				{
					hostname: hostname,
					port: port,
					path: path,
					method: req.method,
					headers: headers as Record<string, string>,
				},
				(proxyRes: IncomingMessage) => {
					// Forward status code
					res.statusCode = proxyRes.statusCode || 200;
					res.statusMessage = proxyRes.statusMessage;
					
					// Forward all headers (including cache headers)
					// This preserves the cache strategy from the default endpoint
					const responseHeaders = proxyRes.headers;
					for (const [key, value] of Object.entries(responseHeaders)) {
						// Skip headers that shouldn't be forwarded
						if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'transfer-encoding') {
							res.setHeader(key, value);
						}
					}
					
					// Pipe the response body
					proxyRes.pipe(res);
				}
			);
			
			// Handle proxy request errors
			proxyReq.on('error', (err: Error) => {
				if (!res.headersSent) {
					res.status(500).json({ 
						errors: [{ 
							message: 'Failed to proxy request to assets endpoint',
							extensions: { code: 'INTERNAL_SERVER_ERROR' }
						}] 
					});
				}
			});
			
			// Handle client abort
			req.on('aborted', () => {
				proxyReq.destroy();
			});
			
			proxyReq.end();
		}

		// Shared handler function for file lookup by field
		async function handleFileLookup(
			req: DirectusRequest,
			res: Response,
			fieldName: 'filename_disk' | 'title' | 'filename_download',
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
				proxyToAssetsEndpoint(file.id, req, res);
				
			} catch (err: unknown) {
				// Handle specific error types if needed
				const error = err as { status?: number; statusCode?: number };
				if (error.status === 403 || error.statusCode === 403) {
					res.sendStatus(403);
					return;
				}
				
				// Log error for debugging but don't expose internal details
				console.error(`Error in assets-by-${fieldName} endpoint:`, err);
				
				if (!res.headersSent) {
					res.sendStatus(404);
				}
			}
		}

		if (process.env.ASSETS_FILENAME_ENDPOINT_PATH) {
			// Endpoint: /a/fd/:filename
			router.get(`${assetsPathSeparator}/:filename`, async (req: DirectusRequest, res: Response) => {
				const filename = req.params['filename'] as string;
				await handleFileLookup(req, res, 'filename_disk', filename);
			});

			// Endpoint: /a/t/:filename
			router.get(`${assetsPathSeparator}/t/:filename`, async (req: DirectusRequest, res: Response) => {
				const filename = req.params['filename'] as string;
				await handleFileLookup(req, res, 'title', filename);
			});

			// Endpoint: /a/d/:filename
			router.get(`${assetsPathSeparator}/d/:filename`, async (req: DirectusRequest, res: Response) => {
				const filename = req.params['filename'] as string;
				await handleFileLookup(req, res, 'filename_download', filename);
			});
		} else {
			// Shorter variants: /_/ instead of /field/
			// Endpoint: /_/fd/:filename
			router.get(`${assetsPathSeparator}/fd/:filename`, async (req: DirectusRequest, res: Response) => {
				const filename = req.params['filename'] as string;
				await handleFileLookup(req, res, 'filename_disk', filename);
			});

			// Endpoint: /_/f/:filename
			router.get(`${assetsPathSeparator}/t/:filename`, async (req: DirectusRequest, res: Response) => {
				const filename = req.params['filename'] as string;
				await handleFileLookup(req, res, 'title', filename);
			});

			// Endpoint: /_/filename_download/:filename
			router.get(`${assetsPathSeparator}/d/:filename`, async (req: DirectusRequest, res: Response) => {
				const filename = req.params['filename'] as string;
				await handleFileLookup(req, res, 'filename_download', filename);
			});
		}
	}
};

