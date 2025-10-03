# App Icons

This directory contains the app icons for different platforms.

## Required Icon Files

To complete the packaging setup, you need to provide the following icon files:

### For macOS (.icns)
- `app.icns` - macOS icon bundle containing multiple resolutions
  - Required sizes: 16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024
  - You can create this from a high-resolution PNG using tools like:
    - `iconutil` (macOS built-in): Convert from `.iconset` folder
    - Online converters like CloudConvert
    - Design tools like Sketch, Figma, or Photoshop

### For Windows (.ico)
- `app.ico` - Windows icon file containing multiple resolutions
  - Required sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
  - You can create this from PNG files using tools like:
    - Online converters like ConvertICO
    - GIMP with ICO plugin
    - ImageMagick: `convert app.png -resize 256x256 app.ico`

### For Linux (.png)
- `app.png` - PNG icon file
  - Recommended size: 512x512 or 1024x1024
  - Should be a high-quality PNG with transparency if needed

## Quick Setup

1. Start with a high-resolution square image (preferably 1024x1024 PNG)
2. Use online converters or tools to generate the required formats:
   - Convert to .icns for macOS
   - Convert to .ico for Windows
   - Keep original as .png for Linux (resize to 512x512 if needed)
3. Name them `app.icns`, `app.ico`, and `app.png` respectively
4. Place them in this directory

## Testing

After adding the icons, test the packaging:
```bash
npm run package
```

The icons should appear in the packaged application and installers.