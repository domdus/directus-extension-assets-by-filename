# Directus Assets by Filename Extension

A Directus endpoint extension that allows you to retrieve files by filename, title, or filename_download instead of requiring the file UUID. Perfect for creating human-readable URLs and simplifying file access in your applications.

## Why Use This Extension?

Instead of this:
```
/assets/550e8400-e29b-41d4-a716-446655440000?width=800
```

You can do this:
```
/assets/field/title/my-product-image?width=800
```
Or shorter:
```
/assets/_/t/product-photo.jpg?width=800
```

## Features

- **Multiple Lookup Methods**: Query files by `filename_disk`, `title`, or `filename_download`
- **Full Compatibility**: All transformation parameters (width, height, presets, etc.) work exactly like the default assets endpoint
- **Permission Respect**: Uses Directus's accountability system to ensure proper permission checks
- **Cache Preservation**: Inherits complete caching behavior from Directus's default assets endpoint
- **Short URLs**: Provides both full (`/field/`) and short (`/_/`) endpoint paths

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
directus/extensions/endpoints/directus-endpoint-assets-by-filename/
```

3. Restart your Directus instance

## Usage

Once installed, the extension automatically adds new endpoints under `/assets/`. No additional configuration is required.

### Using the Endpoints

The extension provides two URL patterns:

1. **Full paths**: `/assets/field/{field_name}/{value}`
   - More descriptive and self-documenting
   - Example: `/assets/field/title/my-product-image`

2. **Short paths**: `/assets/_/{short_code}/{value}`
   - Shorter URLs for cleaner code
   - Example: `/assets/_/t/my-product-image`

### Adding Transformations

All standard Directus transformation parameters work with these endpoints. Simply append them as query parameters:

```
/assets/_/t/my-image?width=800&height=600&fit=cover&quality=90&format=webp
```

## Quick Start

### Available Endpoints

| Field | Full Path | Short Path |
|-------|-----------|------------|
| `filename_disk` | `/assets/field/filename_disk/:filename` | `/assets/_/fd/:filename` |
| `title` | `/assets/field/title/:filename` | `/assets/_/t/:filename` |
| `filename_download` | `/assets/field/filename_download/:filename` | `/assets/_/d/:filename` |

### Examples

```html
<!-- Using title -->
<img src="/assets/_/t/product-hero-image?width=800&height=600&format=webp" />

<!-- Using filename_download -->
<img src="/assets/_/d/product-photo.jpg?width=1920" />

<!-- Using filename_disk -->
<img src="/assets/_/fd/ccc1123d-a62a-454e-82d1-1c8a5dfc1acd.png" />
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
