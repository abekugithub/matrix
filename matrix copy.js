
/**
 * Matrix Client Manager - Handles all Matrix protocol interactions
 * Manages authentication, messaging, presence, and room management
 */

class MatrixManager {
    constructor() {
        this.client = null;
        this.isLoggedIn = false;
        this.currentUserId = null;
        this.rooms = new Map();
        this.eventHandlers = new Map();
        this.pendingEchos = new Set(); // Track pending message echoes
    }

    /**
     * Login to Matrix homeserver
     * @param {string} homeserver - Homeserver URL
     * @param {string} username - Username (with or without @)
     * @param {string} password - User password
     * @returns {boolean} Success status
     */
    async login(homeserver, username, password) {
        try {
            console.log('Initializing Matrix client for:', homeserver);
            
            // Clean homeserver URL
            const baseUrl = homeserver.endsWith('/') ? homeserver.slice(0, -1) : homeserver;
            
            // Format username
            const userId = username.startsWith('@') ? username : `@${username}`;
            
            // Create Matrix client
            this.client = window.matrixcs.createClient({
                baseUrl: baseUrl,
                userId: userId
            });
             

            // Attempt login
            console.log('Attempting login for user:', userId);
            const loginResponse = await this.client.loginWithPassword(userId, password);
            
            if (loginResponse && loginResponse.access_token) {
                console.log('Login successful, access token received');
                
                this.isLoggedIn = true;
                this.currentUserId = loginResponse.user_id;
                
                  // Create Matrix client
                this.client = window.matrixcs.createClient({
                    baseUrl: baseUrl,
                    userId: userId,
                    accessToken: loginResponse.access_token,
                    timelineSupport: true,
                    deviceId: loginResponse.device_id,
                });

                await this.client.initCrypto();
                // Start the client
                await this.client.startClient({
                    initialSyncLimit: 20,
                    includeArchivedRooms: false,
                    resolveInvitesToProfiles: true
                });
                
                // Set up event handlers
                this.setupGlobalEventHandlers();
                
                // Wait for initial sync
                await this.waitForSync();
                
                // Set presence to online
                await this.setPresence('online');
                
                return true;
            } else {
                throw new Error('No access token received');
            }
            
        } catch (error) {
            console.error('Matrix login error:', error);
            this.isLoggedIn = false;
            throw error;
        }
    }

    /**
     * Wait for initial sync to complete
     */
    async waitForSync() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Sync timeout'));
            }, 30000); // 30 second timeout

            this.client.once('sync', (state) => {
                clearTimeout(timeout);
                if (state === 'PREPARED') {
                    console.log('Initial sync completed');
                    resolve();
                } else {
                    reject(new Error(`Sync failed with state: ${state}`));
                }
            });
        });
    }

    /**
     * Set up global Matrix event handlers
     */
    setupGlobalEventHandlers() {
        if (!this.client) return;

        // Room timeline events (messages)
        this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
            if (toStartOfTimeline) return; // Ignore historical events
            
            this.handleRoomTimelineEvent(event, room);
        });

        // Handle successful decryption of previously undecryptable events
    this.client.on('Event.decrypted', (event) => {
        console.log('Event decrypted:', event.getId());
        
        // Update UI if this event is in the current room
        if (window.MatrixApp && event.getRoomId() === window.MatrixApp.currentRoomId) {
            this.updateDecryptedMessageInUI(event);
        }
    });
        // Typing events
        this.client.on('RoomMember.typing', (event, member) => {
            console.log('Typing event:', member);
            this.handleTypingEvent(event, member);
        });

        // Presence events
        this.client.on('User.presence', (event, user) => {
            this.handlePresenceEvent(event, user);
        });

        // Call events
        this.client.on('Call.incoming', (call) => {
            this.handleIncomingCall(call);
        });

        // Sync state changes
        this.client.on('sync', (state, prevState, data) => {
            console.log('Sync state:', state,'prevstate',prevState,'data', data);
        });

        console.log('Global event handlers set up');
    }

    /**
 * Update a message in UI after successful decryption
 */
updateDecryptedMessageInUI(event) {
    const eventId = event.getId();
    const messageElement = document.querySelector(`[data-event-id="${eventId}"]`);
    
    if (messageElement) {
        const room = this.client.getRoom(event.getRoomId());
        if (room) {
            const message = this.formatEventToMessage(event, room);
            const newMessageElement = window.MatrixApp.createMessageElement(message);
            messageElement.replaceWith(newMessageElement);
            console.log('Updated decrypted message in UI:', eventId);
        }
    }
}

    /**
     * Handle room timeline events (messages)
     */
    handleRoomTimelineEvent(event, room) {

        const eventType = event.getType();

        // if (event.getType() !== 'm.room.message') return;
        // if (event.getSender() === this.currentUserId) return; // Ignore own messages

        if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') return;

        // Skip if this is a pending echo we just sent
    if (this.pendingEchos.has(event.getId())) {
        console.log('Skipping echo for event:', event.getId());
        return;
    }
        
        const roomId = room.roomId;
        console.log('New message in room:', roomId);
        
        // Update UI if this is the current room
        if (window.MatrixApp && window.MatrixApp.currentRoomId === roomId) {
            console.log('Adding message to UI');
            this.addMessageToUI(event, room);
        }
        
        // Update last message in DM list
        this.updateDMLastMessage(roomId, event);
    }

 

    /**
     * Add new message to UI
     */
    // addMessageToUI(event, room) {
    //     const message = this.formatEventToMessage(event, room);
    //     const messageElement = window.MatrixApp.createMessageElement(message);
        
    //     const messagesContainer = document.getElementById('messages-container');
    //     if (messagesContainer) {
    //         messagesContainer.appendChild(messageElement);
    //         console.log(messageElement);
    //         window.MatrixApp.scrollToBottom();
    //     }
    // }

    async addMessageToUI(event, room) {
    const msg = this.formatEventToMessage(event, room);
    if (!msg) return;

    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    // Build bubble
    const wrapper = document.createElement('div');
    wrapper.className = `message ${msg.isOwn ? 'own' : ''}`;
    wrapper.dataset.eventId = msg.eventId;

    // Sender and timestamp (optional)
    // ...

    const body = document.createElement('div');
    body.className = 'message-body';

    // Decide render
    const type = msg.type;

    // Helper to add caption/filename + size line
    const addMetaLine = () => {
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        const parts = [];
        if (msg.filename) parts.push(msg.filename);
        if (msg.filesize) parts.push(this.formatBytes(msg.filesize));
        if (msg.mimetype) parts.push(msg.mimetype);
        meta.textContent = parts.join(' • ');
        return meta;
    };

    // If encrypted media: download decrypted blob then preview
    const handleEncryptedMedia = async (fileObj, fallbackText, buildEl) => {
        try {
            const blob = await this.client.downloadEncryptedContent(fileObj);
            const url = URL.createObjectURL(blob);
            const el = buildEl(url, msg.mimetype);
            body.appendChild(el);
            body.appendChild(addMetaLine());
        } catch (e) {
            console.warn('Failed to decrypt media:', e);
            body.appendChild(document.createTextNode(fallbackText));
        }
    };

    if (type === 'm.text' || type === 'm.notice' || type === 'm.emote') {
        body.textContent = msg.content;

    } else if (type === 'm.image') {
        if (msg.file) {
            await handleEncryptedMedia(msg.file, '🔒 Encrypted image (failed to display)', (url) => {
                return this.createImageElement(url, msg.filename || 'Image');
            });
        } else {
            // Use thumbnail if available
            const thumb = this.resolveContentUrl(msg.thumbnail_url, 800, 800) || this.resolveContentUrl(msg.url, 1600, 1600);
            if (thumb) {
                body.appendChild(this.createImageElement(thumb, msg.filename || 'Image'));
                body.appendChild(addMetaLine());
            } else {
                body.appendChild(document.createTextNode('Image unavailable'));
            }
        }

    } else if (type === 'm.video') {
        if (msg.file) {
            await handleEncryptedMedia(msg.file, '🔒 Encrypted video (failed to display)', (url, mime) => {
                return this.createVideoElement(url, mime);
            });
        } else {
            const mediaUrl = this.resolveContentUrl(msg.url);
            if (mediaUrl) {
                body.appendChild(this.createVideoElement(mediaUrl, msg.mimetype));
                body.appendChild(addMetaLine());
            } else {
                body.appendChild(document.createTextNode('Video unavailable'));
            }
        }

    } else if (type === 'm.audio') {
        if (msg.file) {
            await handleEncryptedMedia(msg.file, '🔒 Encrypted audio (failed to play)', (url, mime) => {
                return this.createAudioElement(url, mime);
            });
        } else {
            const mediaUrl = this.resolveContentUrl(msg.url);
            if (mediaUrl) {
                body.appendChild(this.createAudioElement(mediaUrl, msg.mimetype));
                body.appendChild(addMetaLine());
            } else {
                body.appendChild(document.createTextNode('Audio unavailable'));
            }
        }

    } else if (type === 'm.file') {
        // For files, prefer a download link; no preview
        if (msg.file) {
            try {
                const blob = await this.client.downloadEncryptedContent(msg.file);
                const url = URL.createObjectURL(blob);
                body.appendChild(this.createDownloadLink(url, msg.filename || 'Download file', msg.filename));
                body.appendChild(addMetaLine());
            } catch (e) {
                body.appendChild(document.createTextNode('🔒 Encrypted file (failed to download)'));
            }
        } else {
            const mediaUrl = this.resolveContentUrl(msg.url);
            if (mediaUrl) {
                body.appendChild(this.createDownloadLink(mediaUrl, msg.filename || 'Download file', msg.filename));
                body.appendChild(addMetaLine());
            } else {
                body.appendChild(document.createTextNode('File unavailable'));
            }
        }

    } else {
        // Unknown type
        body.textContent = msg.content || `[${type}]`;
    }

    wrapper.appendChild(body);
    messagesContainer.appendChild(wrapper);
    window.MatrixApp?.scrollToBottom?.();
}

    /**
     * Update last message in DM list
     */
    updateDMLastMessage(roomId, event) {
        const dmItem = document.querySelector(`[data-room-id="${roomId}"]`);
        if (!dmItem) return;
        
        const lastMessageEl = dmItem.querySelector('.dm-last-message');
        if (lastMessageEl) {
            
            let lastMessage = 'New message';
            if (event.isEncrypted()) {
            if (event.isDecryptionFailure() || !event.isDecrypted()) {
                lastMessage = '🔒 Encrypted message';
            } else {
                const content = event.getContent();
                if (content.msgtype === 'm.text') {
                    lastMessage = content.body || 'New message';
                } else if (content.msgtype === 'm.image') {
                    lastMessage = '📷 Image';
                } else if (content.msgtype === 'm.file') {
                    lastMessage = '📎 File';
                } else if (content.msgtype === 'm.audio') {
                    lastMessage = '🎵 Audio';
                }
            }
        } else {
            const content = event.getContent();
            
            if (content.msgtype === 'm.text') {
                lastMessage = content.body || 'New message';
            } else if (content.msgtype === 'm.image') {
                lastMessage = '📷 Image';
            } else if (content.msgtype === 'm.file') {
                lastMessage = '📎 File';
            } else if (content.msgtype === 'm.audio') {
                lastMessage = '🎵 Audio';
            }
        }
            lastMessageEl.textContent = lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage;
        }
    }
    resolveContentUrl(url, width, height) {
    if (!url) return null;
    if (url.startsWith('mxc://')) {
        try {
            return this.client.mxcUrlToHttp(url, width, height, 'scale', false);
        } catch (e) {
            console.warn('mxcUrlToHttp failed:', e);
            return null;
        }
    }
    return url; // already http(s)
}

  parseMxc(mxcUrl) {
  if (!mxcUrl?.startsWith('mxc://')) return null;
  const rest = mxcUrl.slice(6);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  return { serverName: rest.slice(0, slash), mediaId: rest.slice(slash + 1) };
}

async   resolveMxcDownloadUrl(client, mxcUrl) {
  const parts = parseMxc(mxcUrl);
  if (!parts) return null;
  const base = client.getHomeserverUrl().replace(/\/$/, '');
  const v3 = `${base}/_matrix/media/v3/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}`;
  const r0 = `${base}/_matrix/media/r0/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}`;

  // Try v3 then r0 quickly (skip HEAD; let the media tag handle error)
  try {
    const res = await fetch(v3, { method: 'HEAD' });
    if (res.ok || res.type === 'opaque') return v3;
  } catch {}
  return r0;
}

async   resolveMxcThumbnailUrl(client, mxcUrl, width = 800, height = 800, method = 'scale') {
  const parts = parseMxc(mxcUrl);
  if (!parts) return null;
  const base = client.getHomeserverUrl().replace(/\/$/, '');
  const v3 = `${base}/_matrix/media/v3/thumbnail/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}?width=${width}&height=${height}&method=${method}`;
  const r0 = `${base}/_matrix/media/r0/thumbnail/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}?width=${width}&height=${height}&method=${method}`;
  try {
    const res = await fetch(v3, { method: 'HEAD' });
    if (res.ok || res.type === 'opaque') return v3;
  } catch {}
  return r0;
}

// async resolveContentUrl(mxcUrl, width,height, method = 'scale', allowDirect = false) {
//     if (!mxcUrl?.startsWith('mxc://')) return null;
//     const [serverAndId] = mxcUrl.slice(6).split('?'); // after mxc://
//     const [serverName, mediaId] = serverAndId.split('/');
//     // const { width, height, method = 'scale', allowDirect = false } = {width,height};

//     // Build v3 URLs
//     const base = this.client.getHomeserverUrl().replace(/\/$/, '');
//     const v3Thumb = `${base}/_matrix/media/v3/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}?width=${width||800}&height=${height||800}&method=${method}`;
//     const v3Download = `${base}/_matrix/media/v3/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;

//     // Build r0 URLs
//     const r0Thumb = `${base}/_matrix/media/r0/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}?width=${width||800}&height=${height||800}&method=${method}`;
//     const r0Download = `${base}/_matrix/media/r0/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;

//     // Try v3 thumbnail then r0 thumbnail, then v3 download then r0 download
//     const candidates = [v3Thumb, r0Thumb, v3Download, r0Download];
//     for (const url of candidates) {
//         try {
//             const res = await fetch(url, { method: 'HEAD', mode: allowDirect ? 'cors' : 'no-cors' });
//             // no-cors won’t expose status; treat opaque as maybe valid
//             if (!res || res.type === 'opaque' || res.ok) return url;
//         } catch (_) {}
//     }
//     return null;
// }

    /**
     * Handle typing events
     */
    handleTypingEvent(event, member) {
        const roomId = member.roomId;
        
        // Only show typing indicator for current room
        if (window.MatrixApp && window.MatrixApp.currentRoomId === roomId && member.userId !== this.currentUserId) {
            const typingIndicator = document.getElementById('typing-indicator');
            const typingText = document.querySelector('.typing-text');
            
            if (typingIndicator && typingText) {
                const isTyping = member.typing;
                
                if (isTyping) {
                    const displayName = member.name || member.userId;
                    typingText.textContent = `${displayName} is typing...`;
                    typingIndicator.style.display = 'block';
                } else {
                    typingIndicator.style.display = 'none';
                }
            }
        }
    }

    /**
     * Handle presence events
     */
    handlePresenceEvent(event, user) {
        const userId = user.userId;
        const presence = user.presence;
        
        console.log(`Presence update: ${userId} is ${presence}`);
        
        // Update UI if this user is in current conversation
        const chatUserPresence = document.getElementById('chat-user-presence');
        if (chatUserPresence && window.MatrixApp && window.MatrixApp.currentRoomId) {
            const room = this.client.getRoom(window.MatrixApp.currentRoomId);
            if (room && this.isDirectMessageWith(room, userId)) {
                chatUserPresence.textContent = presence;
                chatUserPresence.className = `chat-user-presence ${presence}`;
            }
        }
    }

    /**
     * Handle incoming calls
     */
    handleIncomingCall(call) {
        console.log('Incoming call from:', call.remoteUserId);
        
        // Let WebRTC manager handle the call
        if (window.MatrixApp && window.MatrixApp.rtcManager) {
            window.MatrixApp.rtcManager.handleIncomingCall(call);
        }
    }

    /**
     * Logout from Matrix
     */
    async logout() {
        try {
            if (this.client && this.isLoggedIn) {
                await this.client.logout();
                this.client.stopClient();
            }
            
            this.client = null;
            this.isLoggedIn = false;
            this.currentUserId = null;
            this.rooms.clear();
            this.eventHandlers.clear();
            
            console.log('Matrix logout completed');
        } catch (error) {
            console.error('Matrix logout error:', error);
        }
    }

    /**
     * Get current user information
     */
    getUser() {
        if (!this.client || !this.currentUserId) return null;
        
        const user = this.client.getUser(this.currentUserId);
        return {
            userId: this.currentUserId,
            displayName: user?.displayName,
            avatarUrl: user?.avatarUrl
        };
    }

    /**
     * Get current user presence
     */
    getPresence() {
        if (!this.client || !this.currentUserId) return 'offline';
        
        const user = this.client.getUser(this.currentUserId);
        return user?.presence || 'offline';
    }

    /**
     * Get presence for a specific user
     */
    getUserPresence(userId) {
        if (!this.client || !userId) return 'offline';
        
        const user = this.client.getUser(userId);
        return user?.presence || 'offline';
    }

    /**
     * Set user presence
     */
    async setPresence(presence) {
        try {
            if (this.client) {
                await this.client.setPresence({ presence });
                console.log('Presence set to:', presence);
            }
        } catch (error) {
            console.error('Error setting presence:', error);
        }
    }

    /**
     * Get all direct message rooms
     */
    async getDirectMessageRooms() {
        if (!this.client) return [];
        
        try {
            const rooms = this.client.getRooms();
            const directRooms = [];
            
            for (const room of rooms) {
                if (this.isDirectMessage(room)) {
                    const otherUser = this.getOtherUserInDM(room);
                    if (otherUser) {
                        const lastActivity = this.getRoomLastActivityTs(room);
                        directRooms.push({
                            roomId: room.roomId,
                            otherUser: {
                                userId: otherUser.userId,
                                displayName: otherUser.rawDisplayName || otherUser.userId
                            },
                            lastMessage: this.getLastMessage(room),
                            lastActivity: lastActivity //room.getLastActiveTs()
                        });
                    }
                }
            }
            
            // Sort by last activity
            directRooms.sort((a, b) => b.lastActivity - a.lastActivity);
            
            return directRooms;
        } catch (error) {
            console.error('Error getting direct message rooms:', error);
            return [];
        }
    }

getRoomLastActivityTs(room) {
    // Prefer live timeline
    const events = room.getLiveTimeline()?.getEvents?.() || [];
    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        // Any event timestamp qualifies as activity; you can filter by message types if desired
        const ts = ev?.getTs?.();
        if (typeof ts === 'number') return ts;
    }
    // Fallback: room.timeline (older API) if present
    if (Array.isArray(room.timeline) && room.timeline.length > 0) {
        const ts = room.timeline[room.timeline.length - 1]?.getTs?.();
        if (typeof ts === 'number') return ts;
    }
    // Fallback to summary if available
    const ts2 = room?.summary?.lastMessage?.ts;
    return typeof ts2 === 'number' ? ts2 : 0;
}

    /**
     * Check if room is a direct message
     */
    isDirectMessage(room) {
        // const members = room.getJoinedMembers();
        // return members.length === 2 && room.getDMInviter();
        // Check account data m.direct map first
    const directMap = this.client.getAccountData('m.direct')?.getContent?.() || {};
    const isInDirectMap = Object.values(directMap).some((roomIds) => Array.isArray(roomIds) && roomIds.includes(room.roomId));
    if (isInDirectMap) return true;

    // Heuristic fallback: 2 joined members and private history
    const members = room.getJoinedMembers?.() || [];
    const isTwoMember = members.length === 2;
    const isEncrypted = !!room.currentState?.getStateEvents?.('m.room.encryption', '') || !!room.hasEncryptionStateEvent?.();
    return isInDirectMap || (isTwoMember && (room.getDMInviter?.() || isEncrypted));
    }

    /**
     * Check if room is a DM with specific user
     */
    isDirectMessageWith(room, userId) {
        if (!this.isDirectMessage(room)) return false;
        
        const members = room.getJoinedMembers();
        return members.some(member => member.userId === userId);
    }

    /**
     * Get the other user in a DM room
     */
    getOtherUserInDM(room) {
        const members = room.getJoinedMembers();
        return members.find(member => member.userId !== this.currentUserId);
    }

    /**
     * Get last message text from room
     */
    getLastMessage(room) {
        const timeline = room.getLiveTimeline().getEvents();
        
        for (let i = timeline.length - 1; i >= 0; i--) {
            const event = timeline[i];
          const eventType = event.getType();
        
        if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
            // Handle encrypted messages
            if (event.isEncrypted()) {
                if (event.isDecryptionFailure() || !event.isDecrypted()) {
                    return '🔒 Encrypted message';
                }
            }
                const content = event.getContent();
                if (content.msgtype === 'm.text') {
                    return content.body;
                } else if (content.msgtype === 'm.image') {
                    return '📷 Image';
                } else if (content.msgtype === 'm.file') {
                    return '📎 File';
                } else if (content.msgtype === 'm.audio') {
                    return '🎵 Audio';
                }
            }
        }
        
        return 'No messages yet';
    }

    /**
     * Create a direct message room with user
     */
    async createDirectMessage(userId) {
        try {
            console.log('Creating DM with:', userId);
            
            // Check if DM already exists
            const existingRoom = this.findExistingDM(userId);
            if (existingRoom) {
                console.log('Existing DM found:', existingRoom.roomId);
                return existingRoom.roomId;
            }
            
            // Create new DM room
            const roomData = await this.client.createRoom({
                is_direct: true,
                invite: [userId],
                preset: 'private_chat'
            });
            
            if (roomData && roomData.room_id) {
                console.log('New DM created:', roomData.room_id);
                
                // Mark as direct message
                await this.client.setAccountData('m.direct', {
                    ...this.client.getAccountData('m.direct')?.getContent() || {},
                    [userId]: [roomData.room_id]
                });
                
                return roomData.room_id;
            }
            
            throw new Error('Failed to create room');
        } catch (error) {
            console.error('Error creating direct message:', error);
            throw error;
        }
    }

    /**
     * Find existing DM room with user
     */
    findExistingDM(userId) {
        if (!this.client) return null;
        
        const rooms = this.client.getRooms();
        return rooms.find(room => {
            return this.isDirectMessage(room) && this.isDirectMessageWith(room, userId);
        });
    }

    /**
     * Get room by ID
     */
    getRoom(roomId) {
        if (!this.client) return null;
        
        const room = this.client.getRoom(roomId);
        if (room && this.isDirectMessage(room)) {
            return {
                roomId: room.roomId,
                otherUser: this.getOtherUserInDM(room)
            };
        }
        
        return null;
    }

    /**
     * Set up room-specific event listeners
     */
    setupRoomListeners(roomId) {
        // Clear existing handlers for this room
        if (this.eventHandlers.has(roomId)) {
            const handlers = this.eventHandlers.get(roomId);
            handlers.forEach(handler => {
                this.client.removeListener(handler.event, handler.callback);
            });
        }
        
        // Set up new handlers
        const handlers = [];
        this.eventHandlers.set(roomId, handlers);
        
        console.log('Room listeners set up for:', roomId);
    }

    /**
     * Get messages from a room
     */
    async getRoomMessages(roomId, limit = 50) {
        try {
            const room = this.client.getRoom(roomId);
            if (!room) return [];
            
            const timeline = room.getLiveTimeline().getEvents();
            const messages = [];
            
            // Get last 'limit' message events
            // const messageEvents = timeline
            //     .filter(event => event.getType() === 'm.room.message')
            //     .slice(-limit);
            const messageEvents = timeline
            .filter(event => {
                const type = event.getType();
                return type === 'm.room.message' || type === 'm.room.encrypted';
            })
            .slice(-limit);
            
            for (const event of messageEvents) {
                const message = this.formatEventToMessage(event, room);
                if (message) {
                    messages.push(message);
                }
            }
            
            return messages;
        } catch (error) {
            console.error('Error getting room messages:', error);
            return [];
        }
    }

    /**
     * Format Matrix event to message object
     */
    // formatEventToMessage(event, room) {
    //     const content = event.getContent();
    //     const sender = event.getSender();
    //     const senderMember = room.getMember(sender);
        
    //     return {
    //         eventId: event.getId(),
    //         type: content.msgtype || 'm.text',
    //         content: content.body || '',
    //         senderId: sender,
    //         senderName: senderMember?.rawDisplayName || sender,
    //         timestamp: event.getTs(),
    //         isOwn: sender === this.currentUserId,
    //         url: content.url || null,
    //         filename: content.filename || null,
    //         filesize: content.info?.size || 0,
    //         mimetype: content.info?.mimetype || null
    //     };
    // }
/**
 * Format Matrix event to message object
 */
formatEventToMessage(event, room) {
    const sender = event.getSender();
    const senderMember = room.getMember(sender);

    if (event.isEncrypted() && (event.isDecryptionFailure() || !event.isDecrypted())) {
        const unsigned = event.getUnsigned?.() || {};
        const errText = unsigned.decryption_error || 'The sender’s device has not sent us the keys for this message.';
        return {
            eventId: event.getId(),
            type: 'm.notice',
            content: `🔒 Unable to decrypt: ${errText}`,
            senderId: sender,
            senderName: senderMember?.rawDisplayName || sender,
            timestamp: event.getTs(),
            isOwn: sender === this.currentUserId,
            isDecryptionFailure: true,
        };
    }

    const content = event.getContent?.() || {};
    return {
        eventId: event.getId(),
        type: content.msgtype || 'm.text',
        content: content.body || '',
        senderId: sender,
        senderName: senderMember?.rawDisplayName || sender,
        timestamp: event.getTs(),
        isOwn: sender === this.currentUserId,
        url: content.url || null,
        info: content.info || {},
        filename: content.filename || content.body || null,
        filesize: content.info?.size || 0,
        mimetype: content.info?.mimetype || null,
        file: content.file || null, // for encrypted media
        thumbnail_url: content.info?.thumbnail_url || null,
        thumbnail_file: content.info?.thumbnail_file || null,
    };
}
    /**
     * Send a text message to a room
     */
    async sendMessage(roomId, message) {
        try {
            if (!this.client || !roomId || !message.trim()) return;
            
          const response =  await this.client.sendTextMessage(roomId, message.trim());
          // Track this event ID to avoid duplicate display
        if (response?.event_id) {
            this.pendingEchos.add(response.event_id);
            // Remove from tracking after 5 seconds
            setTimeout(() => this.pendingEchos.delete(response.event_id), 5000);
        }
            console.log('Message sent to room:', roomId);
        } catch (error) {
if (error && error.name === "UnknownDeviceError") {
      // ack all unknown devices reported by the error
      const unknown = error.devices; // { userId: { deviceId: DeviceInfo, ... }, ... }
      for (const [userId, devices] of Object.entries(unknown)) {
        for (const deviceId of Object.keys(devices)) {
          await this.client.setDeviceKnown(userId, deviceId, true);
        }
      }
      // retry once
     const response = await this.client.sendTextMessage(roomId, message.trim());
     if (response?.event_id) {
                this.pendingEchos.add(response.event_id);
                setTimeout(() => this.pendingEchos.delete(response.event_id), 5000);
            }
    } else {
         console.error('Error sending message:', error);
            throw error;
    }
        }
    }

    /**
     * Send a file to a room
     */
    async sendFile(roomId, file) {
        try {
            if (!this.client || !roomId || !file) return;
            
            console.log('Uploading file:', file.name, file.size, 'bytes');
            
            // Upload file to Matrix content repository
            const uploadResponse = await this.client.uploadContent(file, {
                name: file.name,
                type: file.type
            });
            
            if (uploadResponse && uploadResponse.content_uri) {
                // Determine message type based on file type
                let msgtype = 'm.file';
                if (file.type.startsWith('image/')) {
                    msgtype = 'm.image';
                } else if (file.type.startsWith('audio/')) {
                    msgtype = 'm.audio';
                } else if (file.type.startsWith('video/')) {
                    msgtype = 'm.video';
                }
                
                // Send file message
                await this.client.sendMessage(roomId, {
                    msgtype: msgtype,
                    body: file.name,
                    filename: file.name,
                    info: {
                        size: file.size,
                        mimetype: file.type
                    },
                    url: uploadResponse.content_uri
                });
                
                console.log('File sent to room:', roomId);
            } else {
                throw new Error('File upload failed');
            }
        } catch (error) {
            console.error('Error sending file:', error);
            throw error;
        }
    }

    /**
     * Send typing indicator
     */
    async sendTyping(roomId, isTyping) {
        try {
            if (this.client && roomId) {
                await this.client.sendTyping(roomId, isTyping, isTyping ? 5000 : 0);
            }
        } catch (error) {
            console.error('Error sending typing indicator:', error);
        }
    }

    /**
     * Get Matrix client for WebRTC integration
     */
    getClient() {
        return this.client;
    }

    /**
     * Get current user ID
     */
    getCurrentUserId() {
        return this.currentUserId;
    }
    /**
 * Acknowledge all unknown devices in a room (for E2EE)
 */
async acknowledgeDevicesInRoom(roomId) {
    try {
        const room = this.client.getRoom(roomId);
        if (!room) return;
        
        const members = room.getJoinedMembers();
        for (const member of members) {
            const userId = member.userId;
            if (userId === this.currentUserId) continue; // skip self
            
            try {
                const devices = await this.client.getStoredDevicesForUser(userId);
                for (const device of devices) {
                    const isKnown = this.client.isDeviceKnown(userId, device.deviceId);
                    if (!isKnown) {
                        console.log(`Acknowledging device: ${userId} / ${device.deviceId}`);
                        await this.client.setDeviceKnown(userId, device.deviceId, true);
                    }
                }
            } catch (err) {
                console.warn(`Could not get devices for ${userId}:`, err);
            }
        }
        // mark unknown devices known (as you already do when sending)
    // then nudge key-share by requesting keys again for failing events:
    for (const ev of room.getLiveTimeline().getEvents()) {
        if (ev.isEncrypted() && (ev.isDecryptionFailure() || !ev.isDecrypted())) {
            try {
                // cancel and resend key request if available in your SDK version
                this.client.cancelAndResendEventRoomKeyRequest?.(ev.getId());
            } catch (e) {
                console.warn('Key re-request failed for', ev.getId(), e);
            }
        }
    }
        console.log('All devices acknowledged for room:', roomId);
    } catch (error) {
        console.error('Error acknowledging devices:', error);
    }
}
/**
 * Mark all unknown devices in a room as known (acknowledge risk).
 * Note: This does NOT verify devices, it only marks them known so encryption can proceed.
 */
async acknowledgeUnknownDevicesInRoom(roomId) {
    const room = this.client.getRoom(roomId);
    if (!room) return;

    // Get joined members
    const members = room.getJoinedMembers().map(m => m.userId);

    // Fetch latest devices for each member and mark unknown devices as known
    for (const userId of members) {
        try {
            // Download device list to ensure we have up-to-date device info
            await this.client.downloadKeys([userId], true);

            // Newer SDKs expose getStoredDevicesForUser; fallback to legacy lookup if needed
            const devices = this.client.getStoredDevicesForUser
                ? await this.client.getStoredDevicesForUser(userId)
                : (this.client.getCrypto()?.deviceList?.getUserDevices(userId) || []);

            // devices can be array or map-like depending on API; normalize to array of { deviceId }
            const deviceList = Array.isArray(devices)
                ? devices
                : Object.values(devices || {});

            for (const d of deviceList) {
                const deviceId = d.deviceId || d.device_id;
                if (!deviceId) continue;

                // Some SDKs have isDeviceKnown; if not, treat as unknown unless marked already
                const isKnown = this.client.isDeviceKnown
                    ? this.client.isDeviceKnown(userId, deviceId)
                    : (this.client.getCrypto()?.getDeviceVerificationStatus?.(userId, deviceId)?.known ?? false);

                if (!isKnown) {
                    console.warn(`Marking device known: ${userId} / ${deviceId}`);
                    await this.client.setDeviceKnown(userId, deviceId, true);
                }
            }
        } catch (e) {
            console.warn(`Could not process devices for ${userId}:`, e);
        }
    }
}


createImageElement(url, alt = 'Image') {
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.className = 'msg-image';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.replaceWith(this.createDownloadLink(url, alt)); };
    return img;
}

createVideoElement(url, mime) {
    const video = document.createElement('video');
    video.controls = true;
    video.className = 'msg-video';
    video.preload = 'metadata';
    video.onerror = () => { video.replaceWith(this.createDownloadLink(url, 'Video')); };
    const source = document.createElement('source');
    source.src = url;
    if (mime) source.type = mime;
    video.appendChild(source);
    return video;
}

createAudioElement(url, mime) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.className = 'msg-audio';
    audio.preload = 'metadata';
    audio.onerror = () => { audio.replaceWith(this.createDownloadLink(url, 'Audio')); };
    const source = document.createElement('source');
    source.src = url;
    if (mime) source.type = mime;
    audio.appendChild(source);
    return audio;
}

createDownloadLink(url, text, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text || 'Download';
    if (filename) a.download = filename;
    a.className = 'msg-download';
    return a;
}

formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B','KB','MB','GB','TB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
}

// Export for use in other modules
window.MatrixManager = MatrixManager;
