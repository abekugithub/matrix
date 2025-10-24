# Matrix JS SDK Bundle with Full Crypto Support

A ready-to-use, standalone bundle of the Matrix JavaScript SDK (v38.4.0) with complete end-to-end encryption support, including WASM files. This bundle can be directly included in HTML projects via a simple `<script>` tag.

## 📦 What's Included

- **matrix-sdk.min.js** - Minified bundle of the complete Matrix JS SDK (884 KB)
- **481.matrix-sdk.min.js** - Additional vendor chunk (216 KB)
- **matrix_sdk_crypto_wasm_bg.wasm** - WebAssembly module for cryptographic operations (5.26 MB)
- **Example HTML files** - Ready-to-run demonstrations
- **Full crypto support** - End-to-end encryption capabilities

## 🚀 Quick Start

### 1. Include the Bundle in Your HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Matrix App</title>
</head>
<body>
    <h1>Matrix JS SDK Example</h1>
    
    <!-- Include the Matrix SDK bundle -->
    <script src="dist/matrix-sdk.min.js"></script>
    
    <script>
        // The SDK is now available as window.matrixcs
        console.log('Matrix SDK loaded:', matrixcs);
        
        // Create a Matrix client
        const client = matrixcs.createClient({
            baseUrl: "https://matrix.org"
        });
        
        console.log('Client created:', client);
    </script>
</body>
</html>
```

### 2. File Structure

Organize your project like this:

```
your-project/
├── index.html          # Your main HTML file
└── dist/               # Copy these files from the bundle
    ├── matrix-sdk.min.js
    ├── 481.matrix-sdk.min.js
    └── matrix_sdk_crypto_wasm_bg.wasm
```

**Important:** All three files in the `dist/` folder must be in the same directory for crypto support to work properly!

### 3. Create Your First Client

```html
<script src="dist/matrix-sdk.min.js"></script>
<script>
    // Create a client without authentication (for public homeserver info)
    const client = matrixcs.createClient({
        baseUrl: "https://matrix.org"
    });
    
    // Or create with user credentials
    const authenticatedClient = matrixcs.createClient({
        baseUrl: "https://matrix.org",
        accessToken: "your_access_token",
        userId: "@username:matrix.org"
    });
</script>
```

## 📚 Examples

### Basic Client Creation

```javascript
// Simple client for a Matrix homeserver
const client = matrixcs.createClient({
    baseUrl: "https://matrix.example.com",
    timelineSupport: true
});
```

### Login with Password

```javascript
const client = matrixcs.createClient({
    baseUrl: "https://matrix.org"
});

// Login
client.loginWithPassword("username", "password")
    .then((response) => {
        console.log("Logged in as:", response.user_id);
        console.log("Access token:", response.access_token);
        console.log("Device ID:", response.device_id);
    })
    .catch((error) => {
        console.error("Login failed:", error);
    });
```

### Start Syncing

```javascript
// Start the client and begin syncing
client.startClient({ initialSyncLimit: 10 });

// Listen for sync state changes
client.on('sync', (state, prevState, data) => {
    console.log('Sync state:', state);
    
    if (state === 'PREPARED') {
        console.log('Client is ready to use!');
    }
});
```

### Send a Message

```javascript
const roomId = "!roomid:matrix.org";
const content = {
    body: "Hello, Matrix!",
    msgtype: "m.text"
};

client.sendEvent(roomId, "m.room.message", content, "")
    .then((response) => {
        console.log("Message sent! Event ID:", response.event_id);
    })
    .catch((error) => {
        console.error("Failed to send message:", error);
    });
```

### Listen for Incoming Messages

```javascript
client.on('Room.timeline', (event, room, toStartOfTimeline) => {
    // Only process messages, not other events
    if (event.getType() === 'm.room.message') {
        const sender = event.getSender();
        const content = event.getContent();
        
        console.log(`Message from ${sender}: ${content.body}`);
    }
});
```

### Initialize Crypto Support

```javascript
// Create client with crypto support
const client = matrixcs.createClient({
    baseUrl: "https://matrix.org",
    accessToken: "your_access_token",
    userId: "@username:matrix.org",
    deviceId: "your_device_id",
    cryptoStore: new matrixcs.MemoryCryptoStore()
});

// Initialize crypto
client.initCrypto()
    .then(() => {
        console.log("Crypto initialized successfully!");
        return client.startClient();
    })
    .catch((error) => {
        console.error("Crypto initialization failed:", error);
    });
```

## 🔐 Crypto Support Details

### WASM File Requirements

The bundle includes full cryptographic support through WebAssembly:

- **File**: `matrix_sdk_crypto_wasm_bg.wasm` (5.26 MB)
- **Purpose**: Provides high-performance cryptographic operations
- **Requirements**: Must be in the same directory as the main bundle file

### Features Available

- ✅ End-to-end encryption (E2EE)
- ✅ Device verification
- ✅ Key backup and recovery
- ✅ Cross-signing support
- ✅ Message encryption/decryption
- ✅ Secure room key sharing

### Browser Compatibility

The crypto WASM module works in all modern browsers:
- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

## 🎮 Interactive Examples

This bundle includes two interactive HTML examples in the `examples/` folder:

### 1. Basic Usage Example (`basic-usage.html`)

Features:
- SDK information display
- Client creation
- Crypto support verification
- Beautiful, modern UI

Open in browser:
```bash
# Navigate to the examples folder
cd examples
# Open in your default browser
open basic-usage.html    # macOS
xdg-open basic-usage.html # Linux
start basic-usage.html    # Windows
```

### 2. Advanced Usage Example (`advanced-usage.html`)

Features:
- User authentication (login/logout)
- Real-time sync
- Send messages to rooms
- Event listeners
- Console logging

## 🛠️ Development

### Building from Source

If you want to rebuild the bundle:

```bash
# Install dependencies
npm install

# Build the bundle
npm run build

# Output will be in dist/ folder
```

### Project Structure

```
matrix_js_sdk_bundle/
├── dist/                           # Built bundle files (ready to use)
│   ├── matrix-sdk.min.js          # Main SDK bundle
│   ├── 481.matrix-sdk.min.js      # Vendor chunk
│   └── matrix_sdk_crypto_wasm_bg.wasm  # Crypto WASM module
├── examples/                       # Example HTML files
│   ├── basic-usage.html           # Basic example
│   └── advanced-usage.html        # Advanced example with login
├── src/                           # Source files
│   └── index.js                   # Entry point
├── node_modules/                  # Dependencies (not included in distribution)
├── package.json                   # NPM configuration
├── webpack.config.js              # Webpack build configuration
└── README.md                      # This file
```

## 📖 API Documentation

### Global Object

The SDK is available as `window.matrixcs` after including the script.

### Main Methods

#### `matrixcs.createClient(options)`

Creates a new Matrix client instance.

**Parameters:**
- `baseUrl` (string, required): The homeserver URL
- `accessToken` (string, optional): Access token for authenticated requests
- `userId` (string, optional): The user ID
- `deviceId` (string, optional): The device ID
- `timelineSupport` (boolean, optional): Enable timeline support
- `cryptoStore` (object, optional): Crypto store for E2EE

**Returns:** Matrix client instance

#### `client.loginWithPassword(username, password)`

Login with username and password.

**Returns:** Promise with login response

#### `client.startClient(options)`

Start the client and begin syncing.

**Parameters:**
- `initialSyncLimit` (number, optional): Number of events to sync initially

#### `client.stopClient()`

Stop the client and cease syncing.

#### `client.sendEvent(roomId, eventType, content, txnId)`

Send an event to a room.

**Parameters:**
- `roomId` (string): The room ID
- `eventType` (string): Event type (e.g., "m.room.message")
- `content` (object): Event content
- `txnId` (string): Transaction ID (can be empty string)

**Returns:** Promise with event response

### Events

Listen to events using `client.on(eventName, callback)`:

- `'sync'` - Sync state changes
- `'Room.timeline'` - New events in rooms
- `'Room.message'` - New messages (shorthand)
- `'error'` - Client errors
- `'RoomMember.membership'` - Membership changes

## 🔒 Security Considerations

### Production Use

1. **Never hardcode credentials**: Use secure authentication methods
2. **Use HTTPS**: Always connect to homeservers over HTTPS
3. **Access tokens**: Store securely, never in plain text
4. **CORS**: Ensure your homeserver allows CORS from your domain
5. **CSP**: Configure Content Security Policy to allow WASM

### Content Security Policy

If you use CSP headers, include:

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' 'unsafe-eval'; 
               worker-src 'self' blob:;
               child-src 'self' blob:;">
```

Note: `'unsafe-eval'` is required for WASM support in some browsers.

## 🌐 Hosting Considerations

### Local Development

You can open the HTML files directly in your browser, but some features may require a local server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Then open http://localhost:8000
```

### Production Deployment

1. Copy the entire `dist/` folder to your web server
2. Ensure WASM MIME type is configured: `application/wasm`
3. Enable gzip/brotli compression for better performance
4. Consider CDN for faster delivery

### WASM MIME Type Configuration

**Apache (.htaccess):**
```apache
AddType application/wasm .wasm
```

**Nginx:**
```nginx
types {
    application/wasm wasm;
}
```

## 📊 Bundle Size

- **matrix-sdk.min.js**: 884 KB (minified)
- **481.matrix-sdk.min.js**: 216 KB (vendor chunk)
- **matrix_sdk_crypto_wasm_bg.wasm**: 5.26 MB (WASM module)
- **Total**: ~6.4 MB

The WASM file is loaded on-demand when crypto features are used.

## 🐛 Troubleshooting

### Issue: "matrixcs is not defined"

**Solution:** Ensure the script tag is included before your code:
```html
<script src="dist/matrix-sdk.min.js"></script>
<script>
    // Your code here
</script>
```

### Issue: "Failed to load WASM file"

**Solution:** 
1. Ensure `matrix_sdk_crypto_wasm_bg.wasm` is in the same directory as the JS files
2. Check browser console for CORS errors
3. Serve files from a web server (not file://)

### Issue: "CORS error when connecting to homeserver"

**Solution:** 
1. Use a homeserver that allows CORS from your origin
2. Or proxy requests through your backend
3. Check homeserver CORS configuration

### Issue: "Cannot read property 'createClient' of undefined"

**Solution:** Wait for the script to load:
```html
<script src="dist/matrix-sdk.min.js"></script>
<script>
    window.addEventListener('load', () => {
        const client = matrixcs.createClient({...});
    });
</script>
```

## 🔗 Useful Links

- [Matrix.org](https://matrix.org/) - Matrix protocol homepage
- [Matrix JS SDK GitHub](https://github.com/matrix-org/matrix-js-sdk) - Official repository
- [Matrix Spec](https://spec.matrix.org/) - Matrix specification
- [Matrix Client-Server API](https://spec.matrix.org/latest/client-server-api/) - API documentation

## 📝 License

This bundle includes the Matrix JS SDK which is licensed under the Apache License 2.0.

The Matrix JS SDK is developed by the Matrix.org Foundation.

## 🤝 Contributing

This is a bundled distribution of the Matrix JS SDK. For issues with the SDK itself, please report to the [official repository](https://github.com/matrix-org/matrix-js-sdk).

## 💡 Tips & Best Practices

1. **Always check sync state** before sending messages
2. **Use event listeners** for real-time updates
3. **Handle errors gracefully** with try-catch blocks
4. **Store access tokens securely** (consider localStorage with encryption)
5. **Test crypto features** with the WASM module loaded
6. **Use timeline support** for better message history
7. **Implement proper error handling** for network issues
8. **Rate limit your requests** to avoid homeserver throttling

## 🎯 Next Steps

1. ✅ Open `examples/basic-usage.html` to see the SDK in action
2. ✅ Try `examples/advanced-usage.html` for authentication and messaging
3. ✅ Read the Matrix Client-Server API documentation
4. ✅ Build your own Matrix-powered application!

## 📞 Support

For questions about:
- **This bundle**: Check the examples and this README
- **Matrix JS SDK**: Visit the [official documentation](https://matrix-org.github.io/matrix-js-sdk/)
- **Matrix protocol**: Join [#matrix:matrix.org](https://matrix.to/#/#matrix:matrix.org)

---

**Happy coding with Matrix! 🚀**
