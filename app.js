
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
let isLoadingOlder = false;
let canLoadMore = true;

async function loadMessages(roomId) {
    if (!matrixClient || !roomId) return;
    
    try {
        const messages = await matrixClient.getRoomMessages(roomId);
        const messagesContainer = document.getElementById('messages-container');
        
        if (!messagesContainer) return;
        
        // Clear existing messages
        messagesContainer.innerHTML = '';
        
        // Add top sentinel for infinite scroll
        const topSentinel = document.createElement('div');
        topSentinel.id = 'messages-top-sentinel';
        topSentinel.style.height = '1px';
        messagesContainer.appendChild(topSentinel);
        
        if (messages.length === 0) {
            messagesContainer.innerHTML += '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No messages yet. Start the conversation!</div>';
            return;
        }
        
        // Add each message
        for (const message of messages) {
            const messageElement = await createMessageElement(message);
            if (messageElement) messagesContainer.appendChild(messageElement);
        }
        
        // Scroll to bottom
        scrollToBottom();
        
        // Setup infinite scroll observer
        setupInfiniteScroll(roomId);
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function setupInfiniteScroll(roomId) {
    const topSentinel = document.getElementById('messages-top-sentinel');
    const messagesContainer = document.getElementById('messages-container');
    
    if (!topSentinel || !messagesContainer) return;
    
    const observer = new IntersectionObserver(async (entries) => {
        for (const entry of entries) {
            console.log('older sentinel',entry.isIntersecting , canLoadMore , !isLoadingOlder);
            if (entry.isIntersecting && canLoadMore && !isLoadingOlder) {
                await loadOlderMessages(roomId);
            }
        }
    }, {
        root: messagesContainer,
        threshold: 0.1
    });
    
    observer.observe(topSentinel);
}

async function loadOlderMessages(roomId) {
    if (isLoadingOlder || !canLoadMore) return;
    
    isLoadingOlder = true;
    const messagesContainer = document.getElementById('messages-container');
    const prevScrollHeight = messagesContainer.scrollHeight;
    const prevScrollTop = messagesContainer.scrollTop;
    
    try {
        const result = await matrixClient.loadOlderMessages(roomId, 10);
        canLoadMore = result.canLoadMore;
        
        // Find new messages (ones not already in DOM)
        const existingIds = new Set(
            Array.from(messagesContainer.querySelectorAll('[data-event-id]'))
                .map(el => el.dataset.eventId)
        );
        
        const newMessages = result.messages.filter(m => !existingIds.has(m.eventId));
        
        // Insert at top (after sentinel)
        const topSentinel = document.getElementById('messages-top-sentinel');
        for (const message of newMessages) {
            const messageElement = await createMessageElement(message);
            if (messageElement) {
                messagesContainer.insertBefore(messageElement, topSentinel.nextSibling);
            }
        }
        
        // Preserve scroll position
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        
    } catch (error) {
        console.error('Error loading older messages:', error);
    } finally {
        isLoadingOlder = false;
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
    messageDiv.className = `message ${message.isOwn ? 'own' : 'other-message'}`;
    messageDiv.dataset.eventId = message.eventId;
    const avatar = getInitials(message.senderName || message.senderId);

    // System messages
    if (message.kind === 'system') {
        messageDiv.className = 'message system-message';
        const text = formatSystemMessage(message);
        messageDiv.innerHTML = `<div class="system-text">${escapeHtml(text)}</div>`;
        return messageDiv;
    }

    // Reactions (aggregate and attach to target message later)
    if (message.kind === 'reaction') {
        // Handle reactions separately or aggregate them
        return null; // Skip rendering as standalone; attach to target message
    }

    // Edits (update the original message)
    if (message.kind === 'edit') {
        // Find and update the original message in DOM
        const original = document.querySelector(`[data-event-id="${message.targetEventId}"]`);
        if (original) {
            const bodyEl = original.querySelector('.message-body');
            if (bodyEl) {
                bodyEl.textContent = message.newContent.body || '';
                bodyEl.innerHTML += ' <span class="edited">(edited)</span>';
            }
        }
        return null; // Don't render as new message
    }

    // Header (sender + timestamp)
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = ` 
        <span class="sender-name">${escapeHtml(message.senderName)}</span>
        <span class="message-time">${formatTimestamp(message.timestamp)}</span>
    `;
     header.innerHTML = `
        <div class="message-avatar">${avatar}</div> 
    `;
    messageDiv.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'message-body';

    // Text messages
    if (message.kind === 'text' || message.kind === 'error') {
        if (message.html) {
            body.innerHTML = message.html;
        } else {
            body.textContent = message.content;
        }
        if (message.isDecryptionFailure) {
            body.classList.add('decryption-error');
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry';
            retryBtn.className = 'retry-decrypt-btn';
            retryBtn.onclick = async () => {
                // Trigger re-request and reload
                await matrixClient.retryDecryption(message.eventId);
                loadMessages(currentRoomId);
            };
            body.appendChild(retryBtn);
        }
    }

    // Media messages
    if (message.kind === 'media') {
        body.classList.add('message-media');
        const mediaEl = await createMediaElement(message);
        if (mediaEl) body.appendChild(mediaEl);
    }

    // Call events
    if (message.kind === 'call') {
        body.classList.add('message-call');
        body.textContent = formatCallEvent(message);
    }

    // Location
    if (message.kind === 'location') {
        body.innerHTML = `📍 <a href="${escapeHtml(message.geoUri)}" target="_blank">${escapeHtml(message.content)}</a>`;
    }

    // Unknown
    if (message.kind === 'unknown') {
        body.textContent = `[Unsupported: ${message.type}]`;
        body.classList.add('unsupported');
    }

    messageDiv.appendChild(body);
    return messageDiv;
}

async function createMediaElement(message) {
    const baseUrl = matrixClient.client.baseUrl;
    const client = matrixClient.client;

    if (message.mediaType === 'm.image') {
        const img = document.createElement('img');
        img.alt = message.filename;
        img.loading = 'lazy';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        
        const url = await getMediaUrl(client, baseUrl, message.url, message.file, { width: 800, height: 600 });
        if (url) img.src = url;
        else img.alt = 'Failed to load image';
        
        return img;
    }

    if (message.mediaType === 'm.video') {
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.style.maxWidth = '100%';
        video.style.borderRadius = '8px';
        
        const url = await getMediaUrl(client, baseUrl, message.url, message.file);
        if (url) video.src = url;
        
        return video;
    }

    if (message.mediaType === 'm.audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'metadata';
        
        const url = await getMediaUrl(client, baseUrl, message.url, message.file);
        if (url) audio.src = url;
        
        return audio;
    }

    if (message.mediaType === 'm.file') {
        const a = document.createElement('a');
        a.textContent = `📎 ${message.filename} (${formatFileSize(message.filesize)})`;
        a.className = 'file-download';
        
        const url = await getMediaUrl(client, baseUrl, message.url, message.file);
        if (url) {
            a.href = url;
            a.download = message.filename;
        }
        
        return a;
    }

    return null;
}

function formatSystemMessage(msg) {
    if (msg.subtype === 'member') {
        if (msg.membership === 'join') return `${msg.stateKey} joined`;
        if (msg.membership === 'leave') return `${msg.stateKey} left`;
        if (msg.membership === 'invite') return `${msg.stateKey} was invited`;
    }
    if (msg.subtype === 'm.room.name') return `Room name changed`;
    if (msg.subtype === 'm.room.topic') return `Room topic changed`;
    return 'System event';
}

function formatCallEvent(msg) {
    if (msg.callType === 'm.call.invite') return '📞 Incoming call';
    if (msg.callType === 'm.call.answer') return '📞 Call answered';
    if (msg.callType === 'm.call.hangup') return '📞 Call ended';
    return '📞 Call event';
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(ts) {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

   /**
 * Convert mxc:// URL to HTTP(S)
 */
function mxcToHttp(client, mxcUrl, thumbnail = null) {
    const match = mxcUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const [, server, mediaId] = match;
    
    if (thumbnail) {

            return client.mxcUrlToHttp(
    /*mxcUrl=*/ mxcUrl, // the MXC URI to download/thumbnail, typically from an event or profile
    /*width=*/ thumbnail.width, // part of the thumbnail API. Use as required.
    /*height=*/ thumbnail.height, // part of the thumbnail API. Use as required.
    /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
    /*allowDirectLinks=*/ false, // should generally be left `false`.
    /*allowRedirects=*/ true, // implied supported with authentication
    /*useAuthentication=*/ true, // the flag we're after in this example
);

        // return `${baseUrl}/_matrix/media/v3/thumbnail/${server}/${mediaId}?width=${thumbnail.width}&height=${thumbnail.height}&method=${thumbnail.method || 'scale'}`;
    }

          return client.mxcUrlToHttp(
    /*mxcUrl=*/ mxcUrl, // the MXC URI to download/thumbnail, typically from an event or profile
    /*width=*/ undefined, // part of the thumbnail API. Use as required.
    /*height=*/ undefined, // part of the thumbnail API. Use as required.
    /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
    /*allowDirectLinks=*/ false, // should generally be left `false`.
    /*allowRedirects=*/ true, // implied supported with authentication
    /*useAuthentication=*/ true, // the flag we're after in this example
);
    // return `${baseUrl}/_matrix/media/v3/download/${server}/${mediaId}`;
}

/**
 * Get media URL (handles encrypted and unencrypted)
 */
async function getMediaUrl(client, baseUrl, url, file, thumbnail = null) {
    try {
        // Encrypted media
        if (file) {
            const blob = await client.downloadEncryptedContent(file);
            return URL.createObjectURL(blob);
        }
        
        // Unencrypted media
        if (!url) return null;
        
        const httpUrl = mxcToHttp(client, url, thumbnail);
        if (!httpUrl) return null;
        
        const response = await fetch(httpUrl, {
            headers: {
                'Authorization': `Bearer ${client.getAccessToken?.()}`
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Error loading media:', error);
        return null;
    }
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
           const token = matrixClient.getClient().getAccessToken();
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
               // Unencrypted: fetch with Authorization -> blob (Element-style)
        const client = matrixClient.getClient();

        // Build URLs
        const parts = matrixClient.parseMxc(message.url);
        if (!parts) return `<span class="error-message">Invalid image URL</span>`;
        const base = client.getHomeserverUrl().replace(/\/$/, '');
        // const v3Download = `${base}/_matrix/media/v3/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}?allow_redirect=true`;
        const r0Download = `${base}/_matrix/media/r0/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}`;

                const v3Download = client.mxcUrlToHttp(
    /*mxcUrl=*/ message.url, // the MXC URI to download/thumbnail, typically from an event or profile
    /*width=*/ 1200, // part of the thumbnail API. Use as required.
    /*height=*/ 1200, // part of the thumbnail API. Use as required.
    /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
    /*allowDirectLinks=*/ false, // should generally be left `false`.
    /*allowRedirects=*/ true, // implied supported with authentication
    /*useAuthentication=*/ true, // the flag we're after in this example
);


        const authHeader = client.getAccessToken?.() ? { Authorization: `Bearer ${client.getAccessToken()}` } : {};

        async function fetchToBlob(url) {
            const res = await fetch(url, { headers: authHeader });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
        }

        try {
            // Prefer v3 download (matches Element)
            const blob = await fetchToBlob(v3Download);
            imageUrl = URL.createObjectURL(blob);
        } catch (e1) {
            console.warn('v3 download failed, trying r0:', e1);
            try {
                const blob = await fetchToBlob(r0Download);
                imageUrl = URL.createObjectURL(blob);
            } catch (e2) {
                console.error('r0 download also failed:', e2);
                return `<span class="error-message">Image unavailable</span>`;
            }
        }
    }

    if (!imageUrl) {
        return `<span class="error-message">Image unavailable</span>`;
    }

    return `
        <div class="image-message">
            <img src="${escapeHtml(imageUrl)}"
                 alt="${escapeHtml(message.filename || 'Image')}"
                 referrerPolicy="no-referrer"
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

                  const client = matrixClient.getClient();
                  const v3Download = client.mxcUrlToHttp(
    /*mxcUrl=*/ message.url, // the MXC URI to download/thumbnail, typically from an event or profile
    /*width=*/ undefined, // part of the thumbnail API. Use as required.
    /*height=*/ undefined, // part of the thumbnail API. Use as required.
    /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
    /*allowDirectLinks=*/ false, // should generally be left `false`.
    /*allowRedirects=*/ true, // implied supported with authentication
    /*useAuthentication=*/ true, // the flag we're after in this example
);


        const authHeader = client.getAccessToken?.() ? { Authorization: `Bearer ${client.getAccessToken()}` } : {};

        async function fetchToBlob(url) {
            const res = await fetch(url, { headers: authHeader });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
        }

        try {
            // Prefer v3 download (matches Element)
            const blob = await fetchToBlob(v3Download);
            videoUrl = URL.createObjectURL(blob);
        } catch (e1) {
            console.warn('v3 download failed, trying r0:', e1);
            try {
                const blob = await fetchToBlob(videoUrl);
                videoUrl = URL.createObjectURL(blob);
            } catch (e2) {
                console.error('r0 download also failed:', e2);
                return `<span class="error-message">Image unavailable</span>`;
            }
        }
    
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
                const client = matrixClient.getClient();
                  const v3Download = client.mxcUrlToHttp(
    /*mxcUrl=*/ message.url, // the MXC URI to download/thumbnail, typically from an event or profile
    /*width=*/ undefined, // part of the thumbnail API. Use as required.
    /*height=*/ undefined, // part of the thumbnail API. Use as required.
    /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
    /*allowDirectLinks=*/ false, // should generally be left `false`.
    /*allowRedirects=*/ true, // implied supported with authentication
    /*useAuthentication=*/ true, // the flag we're after in this example
);


        const authHeader = client.getAccessToken?.() ? { Authorization: `Bearer ${client.getAccessToken()}` } : {};

        async function fetchToBlob(url) {
            const res = await fetch(url, { headers: authHeader });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
        }

        try {
            // Prefer v3 download (matches Element)
            const blob = await fetchToBlob(v3Download);
            audioUrl = URL.createObjectURL(blob);
        } catch (e1) {
            console.warn('v3 download failed, trying r0:', e1);
            try {
                const blob = await fetchToBlob(audioUrl);
                audioUrl = URL.createObjectURL(blob);
            } catch (e2) {
                console.error('r0 download also failed:', e2);
                return `<span class="error-message">Image unavailable</span>`;
            }
        }
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
                  const client = matrixClient.getClient();
                  const v3Download = client.mxcUrlToHttp(
    /*mxcUrl=*/ message.url, // the MXC URI to download/thumbnail, typically from an event or profile
    /*width=*/ undefined, // part of the thumbnail API. Use as required.
    /*height=*/ undefined, // part of the thumbnail API. Use as required.
    /*resizeMethod=*/ undefined, // part of the thumbnail API. Use as required.
    /*allowDirectLinks=*/ false, // should generally be left `false`.
    /*allowRedirects=*/ true, // implied supported with authentication
    /*useAuthentication=*/ true, // the flag we're after in this example
);


        const authHeader = client.getAccessToken?.() ? { Authorization: `Bearer ${client.getAccessToken()}` } : {};

        async function fetchToBlob(url) {
            const res = await fetch(url, { headers: authHeader });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.blob();
        }

        try {
            // Prefer v3 download (matches Element)
            const blob = await fetchToBlob(v3Download);
            fileUrl = URL.createObjectURL(blob);
        } catch (e1) {
            console.warn('v3 download failed, trying r0:', e1);
            try {
                const blob = await fetchToBlob(fileUrl);
                fileUrl = URL.createObjectURL(blob);
            } catch (e2) {
                console.error('r0 download also failed:', e2);
                return `<span class="error-message">Image unavailable</span>`;
            }
        }
    
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
