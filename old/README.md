
# Matrix Minimal Client

A lightweight, embeddable Matrix client built with pure HTML, CSS, and vanilla JavaScript. Features real-time messaging, file attachments, typing indicators, presence, and WebRTC voice/video calls.

## Features

- **Pure Web Technologies**: No frameworks, just HTML/CSS/JavaScript
- **Matrix Protocol**: Full integration with Matrix homeservers
- **Direct Messaging**: 1-to-1 conversations with real-time sync
- **File Attachments**: Support for images, documents, and audio files
- **WebRTC Calls**: Voice and video calls with Matrix signaling
- **Presence & Typing**: Real-time presence and typing indicators  
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Light/Dark Theme**: Toggle between light and dark modes
- **Embeddable**: Can be integrated into any web application
- **Minimal Size**: Total assets under 200KB

## Quick Start

### Local Development

1. **Clone or download the files** to your local directory:
   ```bash
   cd matrix-minimal
   ```

2. **Install the Matrix SDK**:
   ```bash
   npm install matrix-js-sdk
   ```

3. **Start a local server**:
   ```bash
   npx serve .
   ```
   
   Or using Python:
   ```bash
   python3 -m http.server 8000
   ```

4. **Open in browser**:
   ```
   http://localhost:8000
   ```

### Embedding in Your Application

To embed the Matrix client in your web application:

1. **Include the files in your project**:
   ```html
   <link rel="stylesheet" href="path/to/style.css">
   <script src="https://unpkg.com/matrix-js-sdk@32.5.0/lib/browser-matrix.min.js"></script>
   <script src="path/to/utils.js"></script>
   <script src="path/to/matrix.js"></script>
   <script src="path/to/rtc.js"></script>
   <script src="path/to/app.js"></script>
   ```

2. **Add the container HTML**:
   ```html
   <div id="matrix-client" class="matrix-client">
     <!-- The client will auto-initialize in this div -->
   </div>
   ```

3. **Auto-initialization**: The client automatically initializes when the DOM loads.

## Configuration

### Default Settings

- **Homeserver**: `https://matrix.orconssystems.net`
- **Theme**: Auto-detects system preference (light/dark)
- **No Persistence**: Credentials are not stored (no localStorage)

### Customization

You can customize the client by modifying:

- **Colors**: Edit CSS variables in `style.css`
- **Homeserver**: Change default in `index.html`
- **Features**: Enable/disable features in `app.js`

## Usage

### Login
1. Enter your Matrix homeserver URL (defaults to matrix.orconssystems.net)
2. Enter your full Matrix user ID (e.g., @user:server.com)
3. Enter your password
4. Click "Login"

### Direct Messages
1. Click the "+" button in the Direct Messages section
2. Enter the Matrix user ID you want to message
3. Click "Start Chat"
4. Begin messaging in real-time

### File Attachments
1. Click the attachment button (📎) in the message input
2. Select one or more files
3. Files are uploaded and shared automatically

### Voice/Video Calls
1. Open a direct message conversation
2. Click the voice (📞) or video (📹) call button
3. Allow camera/microphone access when prompted
4. The other user will receive a call invitation
5. Use the hang up button (❌) to end calls

### Theme Toggle
- Click the theme toggle button (🌓) to switch between light and dark modes
- The setting persists for the current session

## File Structure

```
matrix-minimal/
├── index.html          # Main HTML structure and UI components
├── style.css           # Responsive CSS with light/dark theme support
├── app.js             # Main application logic and event handling
├── matrix.js          # Matrix protocol integration and messaging
├── rtc.js             # WebRTC implementation for voice/video calls
├── utils.js           # Helper functions and utilities
├── package.json       # Dependencies and scripts
└── README.md          # This documentation
```

## Browser Support

### Required Features
- ES6+ JavaScript support
- WebRTC for voice/video calls  
- MediaDevices API for camera/microphone access
- Modern CSS (CSS Grid, Flexbox, CSS Variables)

### Supported Browsers
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

### Mobile Support
- Responsive design works on all screen sizes
- Touch-friendly interface
- Mobile camera/microphone access

## Security

### No Credential Storage
- Passwords are not stored locally
- No localStorage or sessionStorage usage
- Must login each session for security

### HTTPS Required
- WebRTC calls require HTTPS in production
- Microphone/camera access requires secure context
- Matrix homeservers typically use HTTPS

### Content Security
- All user input is HTML-escaped
- File uploads go through Matrix content repository
- XSS protection throughout the application

## API Integration

### Matrix SDK
The client uses the official `matrix-js-sdk` for all Matrix protocol interactions:
- Authentication and session management
- Real-time event synchronization  
- Message sending and receiving
- File upload and download
- Presence and typing indicators

### WebRTC
Native WebRTC APIs are used for voice/video calls:
- getUserMedia for local media access
- RTCPeerConnection for peer connections
- Matrix events for call signaling
- STUN servers for NAT traversal

## Development

### Adding Features
To extend the client:

1. **New UI Components**: Add HTML structure and CSS styling
2. **Event Handling**: Add event listeners in `app.js`  
3. **Matrix Integration**: Extend `MatrixManager` class in `matrix.js`
4. **WebRTC Features**: Extend `WebRTCManager` class in `rtc.js`
5. **Utilities**: Add helper functions to `utils.js`

### Code Style
- Use modern ES6+ JavaScript features
- Follow consistent naming conventions
- Add comprehensive comments for complex logic
- Handle errors gracefully with user feedback
- Maintain responsive design principles

### Testing
Test the client with:
- Different Matrix homeservers
- Various file types and sizes
- Multiple browsers and devices
- Network conditions (slow, offline)
- WebRTC capabilities

## Troubleshooting

### Common Issues

**Login Failed**
- Verify homeserver URL is correct
- Check username format (@user:server.com)
- Ensure password is correct
- Check network connectivity

**Camera/Microphone Not Working**
- Allow permissions when prompted
- Use HTTPS for security requirements
- Check device availability
- Verify browser WebRTC support

**Messages Not Syncing**
- Check internet connection
- Verify Matrix homeserver is online
- Clear browser cache and retry
- Check browser console for errors

**File Upload Failed**
- Check file size limits
- Verify file type support
- Ensure stable internet connection
- Check Matrix homeserver upload limits

### Browser Console
Check the browser console for detailed error messages and debugging information. The client logs all major operations and errors.

## Contributing

To contribute to the Matrix Minimal Client:

1. Fork the project
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

Please ensure your code follows the existing style and includes appropriate comments.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the browser console for errors
- Review this documentation
- Test with different Matrix homeservers
- Verify WebRTC browser support

## Changelog

### v1.0.0
- Initial release
- Core Matrix messaging functionality
- WebRTC voice/video calls
- File attachment support
- Responsive design with light/dark themes
- Direct message management
- Real-time presence and typing indicators
