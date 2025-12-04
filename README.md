# Directus Assets by Filename Extension

A Directus endpoint extension that allows you to retrieve files by filename, title, or filename_download instead of requiring the file UUID. Perfect for creating human-readable URLs and simplifying file access in your applications.

## Why Use This Extension?

Instead of this:
```
/assets/550e8400-e29b-41d4-a716-446655440000?width=800
```

You can do this:
```
/assets/_/fd/product-photo.jpg?width=800
```
Or even shorter with custom endpoint:
```
/a/product-photo.jpg?width=800
```

## Features

- **Multiple Lookup Methods**: Query files by `filename_disk`, `title`, or `filename_download`
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
directus/extensions/endpoints/directus-endpoint-assets-by-filename/
```

3. Restart your Directus instance

## Usage

Once installed, the extension automatically adds new endpoints. No additional configuration is required, but you can customize the endpoint path using the environment variable above.

### Using the Endpoints

The extension provides short URL patterns:

**Default**:
- `/assets/_/fd/:filename_disk` - Lookup by `filename_disk`
- `/assets/_/t/:title` - Lookup by `title`
- `/assets/_/d/:filename_download` - Lookup by `filename_download`

**Custom** (when `ASSETS_FILENAME_ENDPOINT_PATH` is set, e.g., to `a`):
- `/a/:filename_disk` - Lookup by `filename_disk` (default route without `/fd`)
- `/a/t/:title` - Lookup by `title`
- `/a/d/:filename_donwload` - Lookup by `filename_download`

### Adding Transformations

All standard Directus transformation parameters work with these endpoints. Simply append them as query parameters:

```
/assets/_/t/my-image?width=800&height=600&fit=cover&quality=90&format=webp
```

**Custom:**
```
/a/t/my-image?width=800&height=600&fit=cover&quality=90&format=webp
```


## Configuration

### Environment Variables

You can customize the endpoint path using the `ASSETS_FILENAME_ENDPOINT_PATH` environment variable:
  
- **Set to custom value** (e.g., `ASSETS_FILENAME_ENDPOINT_PATH=mypath`): 
  - Endpoint ID becomes the custom value (e.g., `mypath`)
  - Routes have no prefix, making URLs even shorter
  - Example: `https://directus_domain/mypath/product-photo.jpg`
  - **Paths names not allowed** (reserved by Directus): 
    `items`, `users`, `roles`, `permissions`, `files`, `collections`, `relations`, `fields`, `settings`, `activity`, `revisions`, `presets`, `flows`, `operations`, `webhooks`, `dashboards`, `panels`, `translations`, `server`, `extensions`, `auth`, `graphql`, `static`, `folders`, `notifications`, `utils`, `schema`, `assets`
  
> **⚠️ Important:**  
> *Make sure your `ASSETS_FILENAME_ENDPOINT_PATH` does not overlap with any endpoint routes used by other endpoint extensions*:  
  

## Examples

```html
<!-- Using title -->
<img src="/assets/_/t/product-hero-image?width=800&height=600&format=webp" />

<!-- Using filename_download -->
<img src="/assets/_/d/product-photo.jpg?width=1920" />

<!-- Using filename_disk -->
<img src="/assets/_/fd/ccc1123d-a62a-454e-82d1-1c8a5dfc1acd.png" />
```

**Custom** (with `ASSETS_FILENAME_ENDPOINT_PATH=a`):
```html
<!-- Using title -->
<img src="/mypath/t/product-hero-image?width=800&height=600&format=webp" />

<!-- Using filename_download -->
<img src="/mypath/d/product-photo.jpg?width=1920" />

<!-- Using filename_disk (shortest) -->
<img src="/mypath/product-photo.jpg?width=1920" />
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
