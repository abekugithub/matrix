
/**
 * Matrix Minimal Client - Main Application Entry Point
 * Handles initialization, UI events, and coordination between components
 */

// Global application state
let matrixClient = null;
let rtcManager = null;
let currentRoomId = null;
let isLoggedIn = false;

/**
 * Initialize the Matrix client application
 * Auto-runs when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Matrix Minimal Client initializing...');
    
    // Initialize theme from system preference
    initializeTheme();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize UI state
    initializeUI();
    
    console.log('Matrix client ready for user interaction');
});

/**
 * Initialize theme system with light/dark mode support
 */
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = prefersDark ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButtons(theme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('matrix-theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeButtons(newTheme);
        }
    });
}

/**
 * Set up all event listeners for UI interactions
 */
function setupEventListeners() {
    const muteMicBtn = document.getElementById('mute-mic-btn');
const muteVideoBtn = document.getElementById('mute-video-btn');

muteMicBtn?.addEventListener('click', toggleMicrophone);
muteVideoBtn?.addEventListener('click', toggleVideo);
    // Login form submission
    const loginForm = document.getElementById('login');
    loginForm?.addEventListener('submit', handleLogin);
    
    // Theme toggle buttons
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleMain = document.getElementById('theme-toggle-main');
    
    themeToggle?.addEventListener('click', toggleTheme);
    themeToggleMain?.addEventListener('click', toggleTheme);
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', handleLogout);
    
    // New DM functionality
    const newDmBtn = document.getElementById('new-dm-btn');
    const newDmModal = document.getElementById('new-dm-modal');
    const closeDmModal = document.getElementById('close-dm-modal');
    const startDmBtn = document.getElementById('start-dm-btn');
    
    newDmBtn?.addEventListener('click', () => showModal('new-dm-modal'));
    closeDmModal?.addEventListener('click', () => hideModal('new-dm-modal'));
    startDmBtn?.addEventListener('click', handleStartNewDM);
    
    // Close modal when clicking outside
    newDmModal?.addEventListener('click', (e) => {
        if (e.target === newDmModal) hideModal('new-dm-modal');
    });
    
    // Message input and sending
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const fileBtn = document.getElementById('file-btn');
    const fileInput = document.getElementById('file-input');
    
    messageInput?.addEventListener('input', handleMessageInput);
    messageInput?.addEventListener('keydown', handleMessageKeydown);
    sendBtn?.addEventListener('click', handleSendMessage);
    fileBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', handleFileSelect);
    
    // Call control buttons
    const voiceCallBtn = document.getElementById('voice-call-btn');
    const videoCallBtn = document.getElementById('video-call-btn');
    const hangupBtn = document.getElementById('hangup-btn');
    
    voiceCallBtn?.addEventListener('click', () => initiateCall(false));
    videoCallBtn?.addEventListener('click', () => initiateCall(true));
    hangupBtn?.addEventListener('click', hangupCall);
}
function toggleMicrophone() {
    if (!rtcManager) return;
    
    const isMuted = rtcManager.isMicrophoneMuted();
    rtcManager.setMicrophoneMuted(!isMuted);
    
    const btn = document.getElementById('mute-mic-btn');
    if (btn) {
        btn.textContent = isMuted ? '🎤' : '🔇';
        btn.title = isMuted ? 'Mute microphone' : 'Unmute microphone';
    }
}

function toggleVideo() {
    if (!rtcManager) return;
    
    const isMuted = rtcManager.isVideoMuted();
    rtcManager.setVideoMuted(!isMuted);
    
    const btn = document.getElementById('mute-video-btn');
    if (btn) {
        btn.textContent = isMuted ? '📹' : '📷';
        btn.title = isMuted ? 'Turn off camera' : 'Turn on camera';
    }
}
/**
 * Initialize UI to default state
 */
function initializeUI() {
    // Hide main interface initially
    const mainInterface = document.getElementById('main-interface');
    const loginForm = document.getElementById('login-form');
    
    if (mainInterface) mainInterface.style.display = 'none';
    if (loginForm) loginForm.style.display = 'flex';
    
    // Clear any error messages
    clearErrorMessages();
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const homeserver = document.getElementById('homeserver')?.value;
    const username = document.getElementById('username')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!homeserver || !username || !password) {
        showError('login-error', 'Please fill in all fields');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;
    }
    
    try {
        console.log('Attempting to login to:', homeserver);
        
        // Initialize Matrix client
        matrixClient = new MatrixManager();
        const success = await matrixClient.login(homeserver, username, password);
        
        if (success) {
            console.log('Login successful');
            isLoggedIn = true;
            
            // Initialize WebRTC manager
            rtcManager = new WebRTCManager(matrixClient);
            
            // Switch to main interface
            showMainInterface();
            
            // Load user data and rooms
            await loadUserData();
            await loadDirectMessages();
            
        } else {
            showError('login-error', 'Login failed. Please check your credentials.');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('login-error', `Login error: ${error.message || 'Unknown error'}`);
    } finally {
        // Restore button state
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        console.log('Logging out...');
        
        // Stop any active calls
        if (rtcManager) {
            await rtcManager.hangup();
        }
        
        // Logout from Matrix
        if (matrixClient) {
            await matrixClient.logout();
        }
        
        // Reset state
        isLoggedIn = false;
        currentRoomId = null;
        matrixClient = null;
        rtcManager = null;
        
        // Show login form
        showLoginInterface();
        
        console.log('Logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

/**
 * Show main chat interface
 */
function showMainInterface() {
    const loginForm = document.getElementById('login-form');
    const mainInterface = document.getElementById('main-interface');
    
    if (loginForm) loginForm.style.display = 'none';
    if (mainInterface) mainInterface.style.display = 'flex';
}

/**
 * Show login interface
 */
function showLoginInterface() {
    const loginForm = document.getElementById('login-form');
    const mainInterface = document.getElementById('main-interface');
    
    if (mainInterface) mainInterface.style.display = 'none';
    if (loginForm) loginForm.style.display = 'flex';
    
    // Clear form data (no persistence)
    const form = document.getElementById('login');
    if (form) form.reset();
    
    // Reset homeserver to default
    const homeserver = document.getElementById('homeserver');
    if (homeserver) homeserver.value = 'https://matrix.orconssystems.net';
    
    // Clear error messages
    clearErrorMessages();
}

/**
 * Load user data and display in UI
 */
async function loadUserData() {
    if (!matrixClient) return;
    
    try {
        const user = matrixClient.getUser();
        const presence = matrixClient.getPresence();
        
        // Update user info in sidebar
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        const userPresence = document.getElementById('user-presence');
        
        if (userName && user) {
            userName.textContent = user.displayName || user.userId || 'Unknown User';
        }
        
        if (userAvatar && user) {
            userAvatar.textContent = getInitials(user.displayName || user.userId);
        }
        
        if (userPresence) {
            userPresence.textContent = presence || 'offline';
            userPresence.className = `user-presence ${presence || 'offline'}`;
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

/**
 * Load and display direct messages
 */
async function loadDirectMessages() {
    if (!matrixClient) return;
    
    try {
        const rooms = await matrixClient.getDirectMessageRooms();
        const dmList = document.getElementById('dm-list');
        
        if (!dmList) return;
        
        // Clear existing list
        dmList.innerHTML = '';
        
        if (rooms.length === 0) {
            dmList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No direct messages yet</div>';
            return;
        }
        
        // Add each DM room to the list
        for (const room of rooms) {
            const dmItem = createDMItem(room);
            dmList.appendChild(dmItem);
        }
        
    } catch (error) {
        console.error('Error loading direct messages:', error);
    }
}

/**
 * Create a DM list item element
 */
function createDMItem(room) {
    const dmItem = document.createElement('div');
    dmItem.className = 'dm-item';
    dmItem.dataset.roomId = room.roomId;
    
    // Get other user info
    const otherUser = room.otherUser;
    const displayName = otherUser?.displayName || otherUser?.userId || 'Unknown User';
    const lastMessage = room.lastMessage || 'No messages yet';
    
    dmItem.innerHTML = `
        <div class="dm-avatar">${getInitials(displayName)}</div>
        <div class="dm-info">
            <div class="dm-name">${escapeHtml(displayName)}</div>
            <div class="dm-last-message">${escapeHtml(lastMessage)}</div>
        </div>
    `;
    
    // Add click handler to open conversation
    dmItem.addEventListener('click', () => openConversation(room.roomId));
    
    return dmItem;
}

/**
 * Handle starting a new direct message
 */
async function handleStartNewDM() {
    const input = document.getElementById('dm-user-input');
    const userId = input?.value.trim();
    
    if (!userId) {
        showError('dm-error', 'Please enter a user ID');
        return;
    }
    
    if (!userId.startsWith('@') || !userId.includes(':')) {
        showError('dm-error', 'Please enter a valid user ID (e.g., @user:server.com)');
        return;
    }
    
    try {
        console.log('Starting new DM with:', userId);
        
        // Create or get existing DM room
        const roomId = await matrixClient.createDirectMessage(userId);
        
        if (roomId) {
            // Hide modal
            hideModal('new-dm-modal');
            
            // Clear input
            if (input) input.value = '';
            
            // Refresh DM list
            await loadDirectMessages();
            
            // Open the new conversation
            openConversation(roomId);
        }
        
    } catch (error) {
        console.error('Error starting new DM:', error);
        showError('dm-error', `Failed to start DM: ${error.message}`);
    }
}

/**
 * Open a conversation with the specified room
 */
// async function openConversation(roomId) {
//     if (!roomId || !matrixClient) return;
    
//     try {
//         console.log('Opening conversation:', roomId);
        
//         // Update current room
//         currentRoomId = roomId;
        
//         // Update UI to show active conversation
//         updateActiveConversation(roomId);
        
//         // Load and display messages
//         await loadMessages(roomId);
        
//         // Show chat interface elements
//         showChatInterface();
        
//         // Set up room event listeners
//         matrixClient.setupRoomListeners(roomId);
        
//     } catch (error) {
//         console.error('Error opening conversation:', error);
//     }
// }

/**
 * Open a conversation with the specified room
 */
async function openConversation(roomId) {
    if (!roomId || !matrixClient) return;
    
    try {
        console.log('Opening conversation:', roomId);
        
        // Update current room
        currentRoomId = roomId;
        window.MatrixApp.currentRoomId = roomId;
        
        // Update UI to show active conversation
        updateActiveConversation(roomId);
        
        // Acknowledge devices in this room to avoid UnknownDeviceError
        await matrixClient.acknowledgeDevicesInRoom(roomId);
        // Before loadMessages:
        await matrixClient.acknowledgeUnknownDevicesInRoom(roomId);
        // Load and display messages
        await loadMessages(roomId);
        
        // Show chat interface elements
        showChatInterface();
        
        // Set up room event listeners
        matrixClient.setupRoomListeners(roomId);
        
    } catch (error) {
        console.error('Error opening conversation:', error);
    }
}

/**
 * Update UI to show the active conversation
 */
function updateActiveConversation(roomId) {
    // Update DM list active state
    const dmItems = document.querySelectorAll('.dm-item');
    dmItems.forEach(item => {
        if (item.dataset.roomId === roomId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update chat header
    const room = matrixClient?.getRoom(roomId);
    if (room) {
        updateChatHeader(room);
    }
}

/**
 * Update chat header with conversation info
 */
function updateChatHeader(room) {
    const chatHeader = document.getElementById('chat-header');
    const chatUserName = document.getElementById('chat-user-name');
    const chatUserAvatar = document.getElementById('chat-user-avatar');
    const chatUserPresence = document.getElementById('chat-user-presence');
    
    if (!chatHeader) return;
    
    const otherUser = room.otherUser;
    const displayName = otherUser?.displayName || otherUser?.userId || 'Unknown User';
    
    if (chatUserName) {
        chatUserName.textContent = displayName;
    }
    
    if (chatUserAvatar) {
        chatUserAvatar.textContent = getInitials(displayName);
    }
    
    if (chatUserPresence) {
        const presence = matrixClient.getUserPresence(otherUser?.userId) || 'offline';
        chatUserPresence.textContent = presence;
        chatUserPresence.className = `chat-user-presence ${presence}`;
    }
    
    chatHeader.style.display = 'flex';
}

/**
 * Show chat interface elements
 */
function showChatInterface() {
    const chatHeader = document.getElementById('chat-header');
    const messageInputArea = document.getElementById('message-input-area');
    const messagesContainer = document.getElementById('messages-container');
    
    if (chatHeader) chatHeader.style.display = 'flex';
    if (messageInputArea) messageInputArea.style.display = 'block';
    
    // Hide welcome message
    const welcomeMessage = messagesContainer?.querySelector('.welcome-message');
    if (welcomeMessage) welcomeMessage.style.display = 'none';
}

/**
 * Load and display messages for a room
 */
// async function loadMessages(roomId) {
//     if (!matrixClient || !roomId) return;
    
//     try {
//         const messages = await matrixClient.getRoomMessages(roomId);
//         console.log('messages',messages);
//         const messagesContainer = document.getElementById('messages-container');
        
//         if (!messagesContainer) return;
        
//         // Clear existing messages
//         messagesContainer.innerHTML = '';
        
//         if (messages.length === 0) {
//             messagesContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No messages yet. Start the conversation!</div>';
//             return;
//         }
        
//         // Add each message
//         messages.forEach(message => {
//             const messageElement = createMessageElement(message);
//             messagesContainer.appendChild(messageElement);
//         });
        
//         // Scroll to bottom
//         scrollToBottom();
        
//     } catch (error) {
//         console.error('Error loading messages:', error);
//     }
// }

/**
 * Load and display messages for a room (updated to handle async message creation)
 */
async function loadMessages(roomId) {
    if (!matrixClient || !roomId) return;
    
    try {
        const messages = await matrixClient.getRoomMessages(roomId);
        console.log('messages', messages);
        const messagesContainer = document.getElementById('messages-container');
        
        if (!messagesContainer) return;
        
        // Clear existing messages
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No messages yet. Start the conversation!</div>';
            return;
        }
        
        // Add each message (now async)
        for (const message of messages) {
            const messageElement = await createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        }
        
        // Scroll to bottom
        scrollToBottom();
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

/**
 * Create a message element
 */
// function createMessageElement(message) {
//     const messageDiv = document.createElement('div');
//     messageDiv.className = `message ${message.isOwn ? 'own' : ''}`;
//     messageDiv.dataset.eventId = message.eventId;
    
//     const avatar = getInitials(message.senderName || message.senderId);
//     const timestamp = formatTimestamp(message.timestamp);
    
//     messageDiv.innerHTML = `
//         <div class="message-avatar">${avatar}</div>
//         <div class="message-content">
//             <div class="message-bubble">
//                 ${formatMessageContent(message)}
//             </div>
//             <div class="message-info">
//                 <span class="message-sender">${escapeHtml(message.senderName || message.senderId)}</span>
//                 <span class="message-time">${timestamp}</span>
//             </div>
//         </div>
//     `;
    
//     return messageDiv;
// }

/**
 * Create a message element (updated to handle async formatting)
 */
async function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.isOwn ? 'own' : ''}`;
    messageDiv.dataset.eventId = message.eventId;
    
    const avatar = getInitials(message.senderName || message.senderId);
    const timestamp = formatTimestamp(message.timestamp);
    
    // Format content (now async)
    const formattedContent = await formatMessageContent(message);
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-bubble">
                ${formattedContent}
            </div>
            <div class="message-info">
                <span class="message-sender">${escapeHtml(message.senderName || message.senderId)}</span>
                <span class="message-time">${timestamp}</span>
            </div>
        </div>
    `;
    
    return messageDiv;
}

/**
 * Format message content based on type
 */
// function formatMessageContent(message) {
//     switch (message.type) {
//         case 'm.text':
//             return escapeHtml(message.content);
            
//         case 'm.image':
//             return `
//                 <div class="image-message">
//                     <img src="${escapeHtml(message.url)}" alt="${escapeHtml(message.filename || 'Image')}" 
//                          onclick="window.open('${escapeHtml(message.url)}', '_blank')" />
//                 </div>
//             `;
            
//         case 'm.file':
//             return `
//                 <div class="file-message">
//                     <div class="file-icon">📎</div>
//                     <div class="file-info">
//                         <div class="file-name">${escapeHtml(message.filename || 'File')}</div>
//                         <div class="file-size">${formatFileSize(message.filesize || 0)}</div>
//                     </div>
//                     <button class="file-download" onclick="downloadFile('${escapeHtml(message.url)}', '${escapeHtml(message.filename)}')">
//                         Download
//                     </button>
//                 </div>
//             `;
            
//         case 'm.audio':
//             return `
//                 <div class="file-message">
//                     <div class="file-icon">🎵</div>
//                     <div class="file-info">
//                         <div class="file-name">${escapeHtml(message.filename || 'Audio')}</div>
//                         <div class="file-size">${formatFileSize(message.filesize || 0)}</div>
//                     </div>
//                     <audio controls>
//                         <source src="${escapeHtml(message.url)}" type="${escapeHtml(message.mimetype || 'audio/mpeg')}">
//                     </audio>
//                 </div>
//             `;
            
//         default:
//             return escapeHtml(message.content || 'Unsupported message type');
//     }
// }


/**
 * Format message content based on type
 */
async function formatMessageContent(message) {
    // Handle decryption failures
    if (message.isDecryptionFailure) {
        return `<span class="decryption-failure">${escapeHtml(message.content)}</span>`;
    }
    
    switch (message.type) {
        case 'm.text':
        case 'm.notice':
        case 'm.emote':
            return escapeHtml(message.content);
            
        case 'm.image':
            // Resolve MXC URL to HTTP
            let imageUrl = null;
            if (message.file) {
                // Encrypted image
                try {
                    const blob = await matrixClient.getClient().downloadEncryptedContent(message.file);
                    imageUrl = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('Failed to decrypt image:', e);
                    return `<span class="decryption-failure">🔒 Failed to decrypt image</span>`;
                }
            } else if (message.url) {
                // Unencrypted image - resolve MXC to HTTP
                imageUrl = await matrixClient.resolveMxcThumbnailUrl(message.url, 1200, 1200) 
                        || await matrixClient.resolveMxcDownloadUrl(message.url);
            }
            
            if (!imageUrl) {
                return `<span class="error-message">Image unavailable</span>`;
            }
            
            return `
                <div class="image-message">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(message.filename || 'Image')}" 
                         onclick="window.open('${escapeHtml(imageUrl)}', '_blank')" 
                         loading="lazy" />
                    ${message.filename ? `<div class="file-meta">${escapeHtml(message.filename)}</div>` : ''}
                </div>
            `;
            
        case 'm.video':
            let videoUrl = null;
            if (message.file) {
                // Encrypted video
                try {
                    const blob = await matrixClient.getClient().downloadEncryptedContent(message.file);
                    videoUrl = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('Failed to decrypt video:', e);
                    return `<span class="decryption-failure">🔒 Failed to decrypt video</span>`;
                }
            } else if (message.url) {
                // Unencrypted video - resolve MXC to HTTP
                videoUrl = await matrixClient.resolveMxcDownloadUrl(message.url);
            }
            
            if (!videoUrl) {
                return `<span class="error-message">Video unavailable</span>`;
            }
            
            return `
                <div class="video-message">
                    <video controls preload="metadata">
                        <source src="${escapeHtml(videoUrl)}" type="${escapeHtml(message.mimetype || 'video/mp4')}">
                        Your browser does not support the video tag.
                    </video>
                    ${message.filename ? `<div class="file-meta">${escapeHtml(message.filename)} • ${formatFileSize(message.filesize || 0)}</div>` : ''}
                </div>
            `;
            
        case 'm.audio':
            let audioUrl = null;
            if (message.file) {
                // Encrypted audio
                try {
                    const blob = await matrixClient.getClient().downloadEncryptedContent(message.file);
                    audioUrl = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('Failed to decrypt audio:', e);
                    return `<span class="decryption-failure">🔒 Failed to decrypt audio</span>`;
                }
            } else if (message.url) {
                // Unencrypted audio - resolve MXC to HTTP
                audioUrl = await matrixClient.resolveMxcDownloadUrl(message.url);
            }
            
            if (!audioUrl) {
                return `<span class="error-message">Audio unavailable</span>`;
            }
            
            return `
                <div class="audio-message">
                    <div class="file-icon">🎵</div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(message.filename || 'Audio')}</div>
                        <div class="file-size">${formatFileSize(message.filesize || 0)}</div>
                    </div>
                    <audio controls preload="metadata">
                        <source src="${escapeHtml(audioUrl)}" type="${escapeHtml(message.mimetype || 'audio/mpeg')}">
                        Your browser does not support the audio tag.
                    </audio>
                </div>
            `;
            
        case 'm.file':
            let fileUrl = null;
            if (message.file) {
                // Encrypted file
                try {
                    const blob = await matrixClient.getClient().downloadEncryptedContent(message.file);
                    fileUrl = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('Failed to decrypt file:', e);
                    return `<span class="decryption-failure">🔒 Failed to decrypt file</span>`;
                }
            } else if (message.url) {
                // Unencrypted file - resolve MXC to HTTP
                fileUrl = await matrixClient.resolveMxcDownloadUrl(message.url);
            }
            
            if (!fileUrl) {
                return `<span class="error-message">File unavailable</span>`;
            }
            
            return `
                <div class="file-message">
                    <div class="file-icon">📎</div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(message.filename || 'File')}</div>
                        <div class="file-size">${formatFileSize(message.filesize || 0)}</div>
                    </div>
                    <a href="${escapeHtml(fileUrl)}" download="${escapeHtml(message.filename || 'download')}" 
                       class="file-download" target="_blank">
                        Download
                    </a>
                </div>
            `;
            
        default:
            return escapeHtml(message.content || 'Unsupported message type');
    }
}

/**
 * Handle message input changes
 */
function handleMessageInput(event) {
    const input = event.target;
    const sendBtn = document.getElementById('send-btn');
    
    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    
    // Enable/disable send button
    if (sendBtn) {
        sendBtn.disabled = !input.value.trim();
    }
    
    // Send typing indicator
    if (currentRoomId && matrixClient) {
        matrixClient.sendTyping(currentRoomId, input.value.trim().length > 0);
    }
}

/**
 * Handle keydown events in message input
 */
function handleMessageKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
    }
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
    const input = document.getElementById('message-input');
    const message = input?.value.trim();
    
    if (!message || !currentRoomId || !matrixClient) return;
    
    try {
        // Send the message
        await matrixClient.sendMessage(currentRoomId, message);
        
        // Clear input
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
        
        // Update send button
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) sendBtn.disabled = true;
        
        // Stop typing indicator
        await matrixClient.sendTyping(currentRoomId, false);
        
    } catch (error) {
        console.error('Error sending message:', error);
        // TODO: Show error to user
    }
}

/**
 * Handle file selection for upload
 */
async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentRoomId || !matrixClient) return;
    
    // Process each selected file
    for (const file of files) {
        try {
            console.log('Uploading file:', file.name);
            await matrixClient.sendFile(currentRoomId, file);
        } catch (error) {
            console.error('Error uploading file:', error);
            // TODO: Show error to user
        }
    }
    
    // Clear file input
    event.target.value = '';
}

/**
 * Initiate a voice or video call
 */
async function initiateCall(isVideo) {
    if (!currentRoomId || !rtcManager) return;
    
    try {
        console.log(`Initiating ${isVideo ? 'video' : 'voice'} call...`);
        
        const success = await rtcManager.makeCall(currentRoomId, isVideo);
        if (success) {
            updateCallUI(true, isVideo);
        }
        
    } catch (error) {
        console.error('Error initiating call:', error);
    }
}

/**
 * Hang up the current call
 */
async function hangupCall() {
    if (!rtcManager) return;
    
    try {
        await rtcManager.hangup();
        updateCallUI(false, false);
    } catch (error) {
        console.error('Error hanging up call:', error);
    }
}

/**
 * Update call-related UI elements
 */
function updateCallUI(inCall, isVideo) {
    const voiceCallBtn = document.getElementById('voice-call-btn');
    const videoCallBtn = document.getElementById('video-call-btn');
    const hangupBtn = document.getElementById('hangup-btn');
    const muteMicBtn = document.getElementById('mute-mic-btn');
    const muteVideoBtn = document.getElementById('mute-video-btn');
    const videoContainer = document.getElementById('video-container');
    
    if (voiceCallBtn) voiceCallBtn.style.display = inCall ? 'none' : 'flex';
    if (videoCallBtn) videoCallBtn.style.display = inCall ? 'none' : 'flex';
    if (hangupBtn) hangupBtn.style.display = inCall ? 'flex' : 'none';
    if (muteMicBtn) muteMicBtn.style.display = inCall ? 'flex' : 'none';
    if (muteVideoBtn) muteVideoBtn.style.display = (inCall && isVideo) ? 'flex' : 'none';
    if (videoContainer) videoContainer.style.display = (inCall && isVideo) ? 'block' : 'none';
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeButtons(newTheme);
    
    console.log('Theme switched to:', newTheme);
}

/**
 * Update theme button icons
 */
function updateThemeButtons(theme) {
    const buttons = document.querySelectorAll('.theme-toggle');
    const icon = theme === 'dark' ? '☀️' : '🌓';
    
    buttons.forEach(btn => {
        if (btn) btn.textContent = icon;
    });
}

/**
 * Scroll messages container to bottom
 */
function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Show a modal dialog
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // Focus on first input
        const firstInput = modal.querySelector('input');
        if (firstInput) firstInput.focus();
    }
}

/**
 * Hide a modal dialog
 */
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        clearErrorMessages();
    }
}

/**
 * Show error message in specified element
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

/**
 * Clear all error messages
 */
function clearErrorMessages() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
}

/**
 * Download a file from URL
 */
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Export for use in other modules
window.MatrixApp = {
    matrixClient,
    rtcManager,
    currentRoomId,
    isLoggedIn,
    openConversation,
    updateCallUI,
    scrollToBottom,
    createMessageElement,
    loadMessages
};
