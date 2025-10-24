# Matrix JS SDK Bundle - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Copy the `dist` folder
Copy the entire `dist` folder to your project directory.

### Step 2: Include in your HTML
```html
<script src="dist/matrix-sdk.min.js"></script>
```

### Step 3: Use the SDK
```javascript
// Create a Matrix client
const client = matrixcs.createClient({
    baseUrl: "https://matrix.org"
});

console.log('Matrix client ready!', client);
```

## 📦 What You Get

- **matrix-sdk.min.js** (884 KB) - The complete Matrix SDK
- **481.matrix-sdk.min.js** (216 KB) - Vendor chunk (loaded automatically)
- **matrix_sdk_crypto_wasm_bg.wasm** (5.26 MB) - Crypto WASM module

## ⚡ Live Examples

1. **Basic Usage**: Open `examples/basic-usage.html` in your browser
2. **Advanced Usage**: Open `examples/advanced-usage.html` for login/messaging examples
3. **Quick Test**: Open `dist/test.html` for a minimal test

## 🔐 Crypto Support

The bundle includes **full end-to-end encryption support** via WebAssembly:

- All files in `dist/` must stay together
- WASM file is loaded automatically when needed
- No additional configuration required!

## 📚 Learn More

See **README.md** for:
- Complete API documentation
- Security best practices
- Deployment guidelines
- Troubleshooting tips

## 🎯 Example: Login & Send Message

```javascript
const client = matrixcs.createClient({
    baseUrl: "https://matrix.org"
});

// Login
await client.loginWithPassword("username", "password");

// Start syncing
await client.startClient();

// Send a message
await client.sendEvent(
    "!roomId:matrix.org", 
    "m.room.message", 
    { body: "Hello!", msgtype: "m.text" },
    ""
);
```

## ✅ Browser Support

- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

## 🆘 Need Help?

1. Check the examples in `examples/` folder
2. Read the full README.md
3. Visit the Matrix JS SDK docs: https://matrix-org.github.io/matrix-js-sdk/

---

**Version:** Matrix JS SDK v38.4.0  
**Bundle Created:** October 2025
