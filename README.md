# Directus Assets by Filename Extension

A Directus endpoint extension that allows you to retrieve files by filename instead of requiring the file UID. Perfect for creating human-readable URLs and simplifying file access.

## Why Use This Extension?

Instead of requesting via file uid:
```
/assets/550e8400-e29b-41d4-a716-446655440000?width=800
```

You can request with filename_disk:
```
/assets/_/_/product-photo.jpg?width=800
```
And make it even shorter with a custom env variable:
```
/a/product-photo.jpg?width=800
```

## Features

- **Filename Lookup**: Query files by `filename_disk`
- **Full Compatibility**: All transformation parameters (width, height, presets, etc.) work exactly like the default assets endpoint
- **Permission Respect**: Uses Directus's accountability system to ensure proper permission checks
- **Cache Preservation**: Inherits complete caching behavior from Directus's default assets endpoint
- **Configurable Endpoint**: Customize the base endpoint path via environment variable for even shorter URLs

## Installation

### Via Directus Marketplace

1. Open your Directus project
2. Navigate to **Settings** → **Extensions**
3. Click **Browse Marketplace**
4. Search for "Assets by Filename"
5. Click **Install**

### Manual Installation

1. Build the extension:
```bash
npm run build
```

2. Copy the `dist` folder to your Directus extensions directory:
```
directus/extensions/directus-extension-assets-by-filename/
```

3. Restart your Directus instance

## Usage

Once installed, the extension automatically adds new endpoints. No additional configuration is required, but you can customize the endpoint path using a custom environment variable.

### Using the Endpoints

The extension provides short URL patterns:

- `/assets/_/_/:filename_disk` - Lookup by `filename_disk`

**Custom** (when `ASSETS_FILENAME_ENDPOINT_PATH` is set, e.g., to `a`):
- `/a/:filename_disk` - Lookup by `filename_disk`

### Adding Transformations

All standard Directus transformation parameters work with these endpoints. Simply append them as query parameters:

```
/assets/_/_/my-image.jpg?width=800&height=600&fit=cover&quality=90&format=webp
```

**Custom:**
```
/a/my-image.jpg?width=800&height=600&fit=cover&quality=90&format=webp
```


## Configuration

### Environment Variables

You can customize the endpoint path using the `ASSETS_FILENAME_ENDPOINT_PATH` environment variable:
  
- **Set to custom value** (e.g., `ASSETS_FILENAME_ENDPOINT_PATH=mypath`): 
  - Endpoint becomes available under `/mypath`
  - Routes have no prefix, making URLs even shorter
  - Example: `https://directus_domain/mypath/product-photo.jpg`
  - **Path names not allowed** (reserved by Directus): 
    `items`, `users`, `roles`, `permissions`, `files`, `collections`, `relations`, `fields`, `settings`, `activity`, `revisions`, `presets`, `flows`, `operations`, `webhooks`, `dashboards`, `panels`, `translations`, `server`, `extensions`, `auth`, `graphql`, `static`, `folders`, `notifications`, `utils`, `schema`, `assets`
  
> **⚠️ Important:**  
> *Make sure your `ASSETS_FILENAME_ENDPOINT_PATH` does not overlap with any endpoint routes used by other endpoint extensions*:  
  

## Examples

```html
<!-- Using filename_disk -->
<img src="/assets/_/_/ccc1123d-a62a-454e-82d1-1c8a5dfc1acd.png" />
```

**Custom** (with `ASSETS_FILENAME_ENDPOINT_PATH=a`):
```html
<!-- Using filename_disk -->
<img src="/a/product-photo.jpg?width=1920" />
```

All standard Directus transformation parameters work:
- `width`, `height`, `fit`, `quality`, `format`, `preset`, `transforms`, `key`, `download`

## How It Works

1. Looks up the file in `directus_files` by the specified field
2. Checks permissions using Directus's FilesService
3. Proxies to the default `/assets/:id` endpoint with all query parameters preserved
4. Forwards all headers, status codes, and response body (preserving cache behavior)

## Error Handling

- **File Not Found**: Returns `404 Not Found`
- **Permission Denied**: Returns `403 Forbidden`


## License

MIT
