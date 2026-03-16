# PWA Icons

This directory should contain the following icon files for PWA support:

- icon-72x72.png (72x72 pixels)
- icon-96x96.png (96x96 pixels)
- icon-128x128.png (128x128 pixels)
- icon-144x144.png (144x144 pixels)
- icon-152x152.png (152x152 pixels)
- icon-192x192.png (192x192 pixels) - Required
- icon-384x384.png (384x384 pixels)
- icon-512x512.png (512x512 pixels) - Required

## How to Generate Icons

You can use online tools like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator
- https://favicon.io/

Or use a tool like `pwa-asset-generator`:
```bash
npx pwa-asset-generator logo.png public/icons --icon-only
```

Replace `logo.png` with your app logo (at least 512x512 pixels).

