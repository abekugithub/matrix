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
    const baseUrl = homeserver.endsWith('/') ? homeserver.slice(0, -1) : homeserver;
    const userId = username.startsWith('@') ? username : `@${username}`;

    // 1) Temp client for password login
    const temp = window.matrixcs.createClient({ baseUrl });
    const loginResponse = await temp.loginWithPassword(userId, password);
    if (!loginResponse?.access_token) throw new Error('No access token');

    this.isLoggedIn = true;
    this.currentUserId = loginResponse.user_id;

    // 2) Real client with creds
    this.client = window.matrixcs.createClient({
      baseUrl,
      userId: loginResponse.user_id,
      accessToken: loginResponse.access_token,
      deviceId: loginResponse.device_id,
      timelineSupport: true,
      useAuthorizationHeader: true,
    });

    // 3) Crypto init (no startCrypto() on your build)
    if (this.client.initCrypto) {
      await this.client.initCrypto();
    } else {
        if(this.client.initRustCrypto){
            await this.client.initRustCrypto();
        }else{
      console.warn('initCrypto not available; E2EE will not function.');
        }
    }

    // 4) Handlers + sync
    this.setupGlobalEventHandlers?.();
    this.setupCryptoHandlers?.();

    await this.client.startClient({ initialSyncLimit: 30 });
    await this.waitForSync();

    this.bootstrapSecurity?.().catch(() => {});
    await this.setPresence?.('online');
    return true;
  } catch (err) {
    console.error('Matrix login error:', err);
    this.isLoggedIn = false;
    throw err;
  }
}

setupCryptoHandlers() {
  const sdk = window.matrixcs;

  // When an event decrypts after initially failing, refresh it in UI.
  this.client.on('Event.decrypted', async (ev) => {
    try { await this.updateDecryptedMessageInUI(ev); } catch(e) {}
  });

  // Key requests from our other devices
  this.client.on(sdk.CryptoEvent?.RoomKeyRequest || 'crypto.roomKeyRequest', async (req) => {
    try {
      // Share keys with our verified own devices
      await this.client.shareRoomKeysWithDevice?.(req);
    } catch (e) {
      console.warn('RoomKeyRequest share failed:', e);
    }
  });

  // Device list updates (other user adds device)
  this.client.on(sdk.CryptoEvent?.DevicesUpdated || 'crypto.devicesUpdated', (users) => {
    console.log('Devices updated for users:', users);
  });
}

async bootstrapSecurity() {
  // Try to enable cross-signing and key backup where possible.
  try {
    if (this.client.bootstrapCrossSigning) {
      await this.client.bootstrapCrossSigning({
        // For password auth flows you can prompt; leaving empty will skip if HS requires auth
        authUploadDeviceSigningKeys: async (makeRequest) => {
          // Implement a prompt if your HS requires interactive auth to upload device signing keys.
          return; // no-op if you don’t have a password prompt here
        },
      }).catch(()=>{});
    }

    // Enable backup if available
    const version = await this.client.getKeyBackupVersion?.().catch(()=>null);
    if (version && !(await this.client.isKeyBackupEnabled?.())) {
      await this.client.enableKeyBackup?.(version);
    }
  } catch (e) {
    console.warn('Security bootstrap error:', e?.message || e);
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
            console.log('Sync state:', state);
        });

        console.log('Global event handlers set up');
    }

    /**
     * Update a message in UI after successful decryption
     */
    async updateDecryptedMessageInUI(event) {
        const eventId = event.getId();
        const messageElement = document.querySelector(`[data-event-id="${eventId}"]`);
        
        if (messageElement) {
            const room = this.client.getRoom(event.getRoomId());
            if (room) {
                // Re-render the message
                const wrapper = document.createElement('div');
                await this.addMessageToUI(event, room, wrapper);
                if (wrapper.firstChild) {
                    messageElement.replaceWith(wrapper.firstChild);
                    console.log('Updated decrypted message in UI:', eventId);
                }
            }
        }
    }

    /**
     * Handle room timeline events (messages)
     */
    handleRoomTimelineEvent(event, room) {
        const eventType = event.getType();

        if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') return;

        // Skip if this is a pending echo we just sent
        if (this.pendingEchos.has(event.getId())) {
            console.log('Skipping echo for event:', event.getId());
            return;
        }
        
        const roomId = room.roomId;
        console.log('New message in room:', roomId, 'type:', eventType);
        
        // Update UI if this is the current room
        if (window.MatrixApp && window.MatrixApp.currentRoomId === roomId) {
            this.addMessageToUI(event, room);
        }
        
        // Update last message in DM list
        this.updateDMLastMessage(roomId, event);
    }
// In MatrixManager class
async addMessageToUI(event, room, container = null) {
    const msg = await this.formatEventToMessage(event, room);
    if (!msg) return;

    const messagesContainer = container || document.getElementById('messages-container');
    if (!messagesContainer) return;

    // Use the global createMessageElement function (now async)
    if (window.MatrixApp && window.MatrixApp.createMessageElement) {
        const messageElement = await window.MatrixApp.createMessageElement(msg);
        messagesContainer.appendChild(messageElement);
        window.MatrixApp.scrollToBottom?.();
    }
}
    /**
     * Add new message to UI
     */
    // async addMessageToUI(event, room, container = null) {
    //     const msg = this.formatEventToMessage(event, room);
    //     if (!msg) return;

    //     const messagesContainer = container || document.getElementById('messages-container');
    //     if (!messagesContainer) return;

    //     // Build bubble
    //     const wrapper = document.createElement('div');
    //     wrapper.className = `message ${msg.isOwn ? 'own' : ''}`;
    //     wrapper.dataset.eventId = msg.eventId;

    //     const body = document.createElement('div');
    //     body.className = 'message-body';

    //     // Decide render
    //     const type = msg.type;

    //     // Helper to add caption/filename + size line
    //     const addMetaLine = () => {
    //         const meta = document.createElement('div');
    //         meta.className = 'message-meta';
    //         const parts = [];
    //         if (msg.filename) parts.push(msg.filename);
    //         if (msg.filesize) parts.push(this.formatBytes(msg.filesize));
    //         if (msg.mimetype) parts.push(msg.mimetype);
    //         meta.textContent = parts.join(' • ');
    //         return meta;
    //     };

    //     // If encrypted media: download decrypted blob then preview
    //     const handleEncryptedMedia = async (fileObj, fallbackText, buildEl) => {
    //         try {
    //             const blob = await this.client.downloadEncryptedContent(fileObj);
    //             const url = URL.createObjectURL(blob);
    //             const el = buildEl(url, msg.mimetype);
    //             body.appendChild(el);
    //             body.appendChild(addMetaLine());
    //         } catch (e) {
    //             console.warn('Failed to decrypt media:', e);
    //             body.appendChild(document.createTextNode(fallbackText));
    //         }
    //     };

    //     if (type === 'm.text' || type === 'm.notice' || type === 'm.emote') {
    //         body.textContent = msg.content;

    //     } else if (type === 'm.image') {
    //         if (msg.file) {
    //             await handleEncryptedMedia(msg.file, '🔒 Encrypted image (failed to display)', (url) => {
    //                 return this.createImageElement(url, msg.filename || 'Image');
    //             });
    //         } else {
    //             // Use thumbnail if available, fallback to download
    //             const thumbUrl = msg.thumbnail_url 
    //                 ? await this.resolveMxcThumbnailUrl(msg.thumbnail_url, 1600, 1600)
    //                 : null;
    //             const downloadUrl = msg.url 
    //                 ? await this.resolveMxcDownloadUrl(msg.url)
    //                 : null;
                
    //             if (thumbUrl || downloadUrl) {
    //                 const img = this.createImageElement(thumbUrl || downloadUrl, msg.filename || 'Image');
    //                 // Fallback to download if thumbnail fails
    //                 if (thumbUrl && downloadUrl && thumbUrl !== downloadUrl) {
    //                     img.onerror = () => {
    //                         img.src = downloadUrl;
    //                         img.onerror = () => { img.replaceWith(this.createDownloadLink(downloadUrl, msg.filename || 'Image')); };
    //                     };
    //                 }
    //                 body.appendChild(img);
    //                 body.appendChild(addMetaLine());
    //             } else {
    //                 body.appendChild(document.createTextNode('Image unavailable'));
    //             }
    //         }

    //     } else if (type === 'm.video') {
    //         if (msg.file) {
    //             await handleEncryptedMedia(msg.file, '🔒 Encrypted video (failed to display)', (url, mime) => {
    //                 return this.createVideoElement(url, mime);
    //             });
    //         } else {
    //             const mediaUrl = msg.url ? await this.resolveMxcDownloadUrl(msg.url) : null;
    //             if (mediaUrl) {
    //                 body.appendChild(this.createVideoElement(mediaUrl, msg.mimetype));
    //                 body.appendChild(addMetaLine());
    //             } else {
    //                 body.appendChild(document.createTextNode('Video unavailable'));
    //             }
    //         }

    //     } else if (type === 'm.audio') {
    //         if (msg.file) {
    //             await handleEncryptedMedia(msg.file, '🔒 Encrypted audio (failed to play)', (url, mime) => {
    //                 return this.createAudioElement(url, mime);
    //             });
    //         } else {
    //             const mediaUrl = msg.url ? await this.resolveMxcDownloadUrl(msg.url) : null;
    //             if (mediaUrl) {
    //                 body.appendChild(this.createAudioElement(mediaUrl, msg.mimetype));
    //                 body.appendChild(addMetaLine());
    //             } else {
    //                 body.appendChild(document.createTextNode('Audio unavailable'));
    //             }
    //         }

    //     } else if (type === 'm.file') {
    //         // For files, prefer a download link; no preview
    //         if (msg.file) {
    //             try {
    //                 const blob = await this.client.downloadEncryptedContent(msg.file);
    //                 const url = URL.createObjectURL(blob);
    //                 body.appendChild(this.createDownloadLink(url, msg.filename || 'Download file', msg.filename));
    //                 body.appendChild(addMetaLine());
    //             } catch (e) {
    //                 body.appendChild(document.createTextNode('🔒 Encrypted file (failed to download)'));
    //             }
    //         } else {
    //             const mediaUrl = msg.url ? await this.resolveMxcDownloadUrl(msg.url) : null;
    //             if (mediaUrl) {
    //                 body.appendChild(this.createDownloadLink(mediaUrl, msg.filename || 'Download file', msg.filename));
    //                 body.appendChild(addMetaLine());
    //             } else {
    //                 body.appendChild(document.createTextNode('File unavailable'));
    //             }
    //         }

    //     } else {
    //         // Unknown type
    //         body.textContent = msg.content || `[${type}]`;
    //     }

    //     wrapper.appendChild(body);
    //     messagesContainer.appendChild(wrapper);
    //     window.MatrixApp?.scrollToBottom?.();
    // }

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
                if (event.isDecryptionFailure() ) {
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
                    } else if (content.msgtype === 'm.video') {
                        lastMessage = '🎬 Video';
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
                } else if (content.msgtype === 'm.video') {
                    lastMessage = '🎬 Video';
                }
            }
            
            lastMessageEl.textContent = lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage;
        }
    }

    /**
     * Parse MXC URL into server and media ID
     */
    parseMxc(mxcUrl) {
        if (!mxcUrl?.startsWith('mxc://')) return null;
        const rest = mxcUrl.slice(6);
        const slash = rest.indexOf('/');
        if (slash === -1) return null;
        return { serverName: rest.slice(0, slash), mediaId: rest.slice(slash + 1) };
    }

    /**
     * Resolve MXC URL to HTTP download URL with v3/r0 fallback
     */
async resolveMxcDownloadUrl(mxcUrl) {
  const parts = this.parseMxc(mxcUrl);
  if (!parts) return null;
  const base = this.client.getHomeserverUrl().replace(/\/$/, '');
  const v3 = `${base}/_matrix/media/v3/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}?allow_redirect=true`;
  const r0 = `${base}/_matrix/media/r0/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}`;

  try {
      const authHeader = this.client.getAccessToken?.() ? { Authorization: `Bearer ${this.client.getAccessToken()}` } : {};
    // Try v3 GET quickly without downloading body fully
    const res = await fetch(v3, { method: 'GET' , headers: authHeader });
    if (res.ok) {
      // If you don’t need the blob here, just return URL and let <img> refetch it
      // Consume minimal to release the reader:
      res.body?.cancel?.();
      return v3;
    }
  } catch (e) { /* ignore and fallback */ 
  console.log('v3 download failed, using r0',e);
  return r0;
  }
}

async resolveMxcThumbnailUrl(mxcUrl, width = 800, height = 800, method = 'scale') {
  const parts = this.parseMxc(mxcUrl);
  if (!parts) return null;
  const base = this.client.getHomeserverUrl().replace(/\/$/, '');
  const v3 = `${base}/_matrix/media/v3/thumbnail/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}?width=${width}&height=${height}&method=${method}`;
  const r0 = `${base}/_matrix/media/r0/thumbnail/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}?width=${width}&height=${height}&method=${method}`;

  try {
    // Use GET instead of HEAD; some proxies don’t support HEAD correctly
    const res = await fetch(v3, { method: 'GET' });
    if (res.ok) {
      res.body?.cancel?.();
      return v3;
    }
  } catch (_) { /* ignore */ }
  return r0;
}
// Authenticated fetch of unencrypted media → blob URL (Element-like behavior)
async fetchMediaAsBlobUrl(mxcUrl) {
  const parts = this.parseMxc(mxcUrl);
  if (!parts) throw new Error('Invalid MXC URL');
  const base = this.client.getHomeserverUrl().replace(/\/$/, '');
  // Force r0; v3 isn’t working in your setup
  const downloadUrl = `${base}/_matrix/media/r0/download/${encodeURIComponent(parts.serverName)}/${encodeURIComponent(parts.mediaId)}`;

  const token = this.client.getAccessToken?.();
  const res = await fetch(downloadUrl, {
    method: 'GET',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Media fetch failed: ${res.status} ${txt}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

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
                this.client.stopClient();
                await this.client.logout(true);
                
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
                            lastActivity: lastActivity
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
                    if (event.isDecryptionFailure() ) {
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
                } else if (content.msgtype === 'm.video') {
                    return '🎬 Video';
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
    const existingRoom = this.findExistingDM(userId);
    if (existingRoom) return existingRoom.roomId;

    const roomData = await this.client.createRoom({
      is_direct: true,
      invite: [userId],
      preset: 'trusted_private_chat',
      initial_state: [{
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      }],
    });

    if (roomData?.room_id) {
      const directContent = this.client.getAccountData('m.direct')?.getContent() || {};
      const userRooms = directContent[userId] || [];
      if (!userRooms.includes(roomData.room_id)) {
        userRooms.push(roomData.room_id);
        directContent[userId] = userRooms;
        await this.client.setAccountData('m.direct', directContent);
      }
      return roomData.room_id;
    }
    throw new Error('Failed to create room');
  } catch (e) {
    console.error('Error creating direct message:', e);
    throw e;
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
    // async getRoomMessages(roomId, limit = 50) {
    //     try {
    //         const room = this.client.getRoom(roomId);
    //         if (!room) return [];
            
    //         const timeline = room.getLiveTimeline().getEvents();
    //         const messages = [];
            
    //         const messageEvents = timeline
    //             .filter(event => {
    //                 const type = event.getType();
    //                 return type === 'm.room.message' || type === 'm.room.encrypted';
    //             })
    //             .slice(-limit);
            
    //         for (const event of messageEvents) {
    //             const message = await this.formatEventToMessage(event, room);
    //             if (message) {
    //                 messages.push(message);
    //             }
    //         }
            
    //         return messages;
    //     } catch (error) {
    //         console.error('Error getting room messages:', error);
    //         return [];
    //     }
    // }

    async getRoomMessages(roomId, limit = 50) {
    try {
        const room = this.client.getRoom(roomId);
        if (!room) return [];
        
        const timeline = room.getLiveTimeline().getEvents();
        const messages = [];
        
        const messageEvents = timeline
            .filter(event => {
                const type = event.getType();
                // Include all relevant types
                return type === 'm.room.message' || 
                       type === 'm.room.encrypted' ||
                       type === 'm.reaction' ||
                       type.startsWith('m.call.') ||
                       type === 'm.room.member' ||
                       type === 'm.room.name' ||
                       type === 'm.room.topic';
            })
            .slice(-limit);
        
        for (const event of messageEvents) {
            const message = await this.formatEventToMessage(event, room);
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
 * Load older messages (pagination)
 */
async loadOlderMessages(roomId, limit = 30) {
    try {
        const room = this.client.getRoom(roomId);
        if (!room) return { messages: [], canLoadMore: false };

        const timeline = room.getLiveTimeline();
        
        // Paginate backwards
        const canLoadMore = await this.client.paginateEventTimeline(timeline, {
            backwards: true,
            limit: limit
        });

        // Get the newly loaded events
        const allEvents = timeline.getEvents();
        const messages = [];
        
        for (const event of allEvents) {
            const type = event.getType();
            if (type === 'm.room.message' || 
                type === 'm.room.encrypted' ||
                type === 'm.reaction' ||
                type.startsWith('m.call.') ||
                type === 'm.room.member' ||
                type === 'm.room.name' ||
                type === 'm.room.topic') {
                const message = await this.formatEventToMessage(event, room);
                if (message) messages.push(message);
            }
        }

        return { messages, canLoadMore };
    } catch (error) {
        console.error('Error loading older messages:', error);
        return { messages: [], canLoadMore: false };
    }
}

async retryDecryption(eventId) {
    try {
        const rooms = this.client.getRooms();
        for (const room of rooms) {
            const event = room.findEventById(eventId);
            if (event) {
                const crypto = this.client.getCrypto?.();
                if (crypto?.requestRoomKey) {
                    await crypto.requestRoomKey(event);
                } else if (this.client.requestRoomKeyForEvent) {
                    await this.client.requestRoomKeyForEvent(event);
                }
                await event.attemptDecryption?.(crypto, { isRetry: true });
                return true;
            }
        }
    } catch (e) {
        console.warn('Retry decryption failed', e);
    }
    return false;
}
    /**
     * Format Matrix event to message object
     */
//    async formatEventToMessage(event, room) {
//         const sender = event.getSender();
//         const senderMember = room.getMember(sender);
        
// if (event.isEncrypted() && event.isDecryptionFailure && event.isDecryptionFailure()) {
//   try { await this.client.requestRoomKeyForEvent?.(event); } catch(e) {}
//   // keep your existing fallback message
// }
//         if (event.isEncrypted() && (event.isDecryptionFailure() )) {
//             const unsigned = event.getUnsigned?.() || {};
//             const errText = unsigned.decryption_error || "The sender's device has not sent us the keys for this message.";
//             return {
//                 eventId: event.getId(),
//                 type: 'm.notice',
//                 content: `🔒 Unable to decrypt: ${errText}`,
//                 senderId: sender,
//                 senderName: senderMember?.rawDisplayName || sender,
//                 timestamp: event.getTs(),
//                 isOwn: sender === this.currentUserId,
//                 isDecryptionFailure: true,
//             };
//         }

//         const content = event.getContent?.() || {};
//         return {
//             eventId: event.getId(),
//             type: content.msgtype || 'm.text',
//             content: content.body || '',
//             senderId: sender,
//             senderName: senderMember?.rawDisplayName || sender,
//             timestamp: event.getTs(),
//             isOwn: sender === this.currentUserId,
//             url: content.url || null,
//             info: content.info || {},
//             filename: content.filename || content.body || null,
//             filesize: content.info?.size || 0,
//             mimetype: content.info?.mimetype || null,
//             file: content.file || null, // for encrypted media
//             thumbnail_url: content.info?.thumbnail_url || null,
//             thumbnail_file: content.info?.thumbnail_file || null,
//         };
//     }
async formatEventToMessage(event, room) {
    const sender = event.getSender();
    const senderMember = room.getMember(sender);
    const type = event.getType();
    const content = event.getContent?.() || {};
    const ts = event.getTs();
    const eventId = event.getId();

    // Decryption failure handling
    if (event.isEncrypted?.() && event.isDecryptionFailure?.()) {
        try {
            const crypto = this.client.getCrypto?.();
            if (crypto?.requestRoomKey) {
                await crypto.requestRoomKey(event);
            } else if (this.client.requestRoomKeyForEvent) {
                await this.client.requestRoomKeyForEvent(event);
            }
        } catch (e) {
            console.warn('Key request failed', e);
        }

        const unsigned = event.getUnsigned?.() || {};
        const errText = unsigned.decryption_error || event.decryptionFailureReason || 
                       "Unable to decrypt: keys not available.";
        return {
            eventId,
            kind: 'error',
            type: 'm.notice',
            content: `🔒 ${errText}`,
            senderId: sender,
            senderName: senderMember?.rawDisplayName || sender,
            timestamp: ts,
            isOwn: sender === this.currentUserId,
            isDecryptionFailure: true,
        };
    }

    // m.room.message (text, media, etc.)
    if (type === 'm.room.message') {
        const msgtype = content.msgtype;
        const relates = content['m.relates_to'] || {};

        // Handle edits
        if (relates.rel_type === 'm.replace' && content['m.new_content']) {
            return {
                eventId,
                kind: 'edit',
                targetEventId: relates.event_id,
                newContent: content['m.new_content'],
                senderId: sender,
                senderName: senderMember?.rawDisplayName || sender,
                timestamp: ts,
                isOwn: sender === this.currentUserId,
            };
        }

        // Handle replies
        const inReplyTo = relates['m.in_reply_to']?.event_id;

        // Text messages
        if (msgtype === 'm.text' || msgtype === 'm.notice' || msgtype === 'm.emote') {
            return {
                eventId,
                kind: 'text',
                type: msgtype,
                content: content.body || '',
                html: content.format === 'org.matrix.custom.html' ? content.formatted_body : null,
                inReplyTo,
                senderId: sender,
                senderName: senderMember?.rawDisplayName || sender,
                timestamp: ts,
                isOwn: sender === this.currentUserId,
            };
        }

        // Media messages
        if (msgtype === 'm.image' || msgtype === 'm.video' || msgtype === 'm.audio' || msgtype === 'm.file') {
            return {
                eventId,
                kind: 'media',
                mediaType: msgtype,
                content: content.body || 'file',
                url: content.url || null,
                file: content.file || null, // encrypted
                info: content.info || {},
                thumbnail_url: content.info?.thumbnail_url || null,
                thumbnail_file: content.info?.thumbnail_file || null,
                filename: content.filename || content.body || 'file',
                filesize: content.info?.size || 0,
                mimetype: content.info?.mimetype || null,
                inReplyTo,
                senderId: sender,
                senderName: senderMember?.rawDisplayName || sender,
                timestamp: ts,
                isOwn: sender === this.currentUserId,
            };
        }

        // Location
        if (msgtype === 'm.location') {
            return {
                eventId,
                kind: 'location',
                geoUri: content.geo_uri,
                content: content.body || 'Location',
                senderId: sender,
                senderName: senderMember?.rawDisplayName || sender,
                timestamp: ts,
                isOwn: sender === this.currentUserId,
            };
        }
    }

    // Reactions
    if (type === 'm.reaction') {
        const rel = content['m.relates_to'] || {};
        return {
            eventId,
            kind: 'reaction',
            key: rel.key,
            targetEventId: rel.event_id,
            senderId: sender,
            senderName: senderMember?.rawDisplayName || sender,
            timestamp: ts,
            isOwn: sender === this.currentUserId,
        };
    }

    // Call events
    if (type.startsWith('m.call.')) {
        return {
            eventId,
            kind: 'call',
            callType: type,
            content: content,
            senderId: sender,
            senderName: senderMember?.rawDisplayName || sender,
            timestamp: ts,
            isOwn: sender === this.currentUserId,
        };
    }

    // State events (member changes, name, topic)
    if (type === 'm.room.member') {
        const membership = content.membership;
        const stateKey = event.getStateKey();
        return {
            eventId,
            kind: 'system',
            subtype: 'member',
            membership,
            stateKey,
            displayName: content.displayname,
            senderId: sender,
            timestamp: ts,
        };
    }

    if (type === 'm.room.name' || type === 'm.room.topic' || type === 'm.room.avatar') {
        return {
            eventId,
            kind: 'system',
            subtype: type,
            content,
            senderId: sender,
            timestamp: ts,
        };
    }

    // Unknown/unsupported
    return {
        eventId,
        kind: 'unknown',
        type,
        content: JSON.stringify(content),
        senderId: sender,
        senderName: senderMember?.rawDisplayName || sender,
        timestamp: ts,
        isOwn: sender === this.currentUserId,
    };
}
    /**
     * Send a text message to a room
     */
   async sendMessage(roomId, message) {
  if (!this.client || !roomId || !message?.trim()) return;
  const body = message.trim();

  try {
    const resp = await this.client.sendTextMessage(roomId, body);
    if (resp?.event_id) {
      this.pendingEchos.add(resp.event_id);
      setTimeout(() => this.pendingEchos.delete(resp.event_id), 5000);
    }
  } catch (error) {
    if (error?.name === "UnknownDeviceError") {
      // Mark unknown devices known, then retry
      try {
        // Acknowledge devices from error.devices
        const unknown = error.devices || {};
        for (const [userId, devices] of Object.entries(unknown)) {
          for (const deviceId of Object.keys(devices)) {
            await this.client.setDeviceKnown(userId, deviceId, true);
          }
        }
        // Also sweep the room
        await this.acknowledgeUnknownDevicesInRoom(roomId);

        const resp = await this.client.sendTextMessage(roomId, body);
        if (resp?.event_id) {
          this.pendingEchos.add(resp.event_id);
          setTimeout(() => this.pendingEchos.delete(resp.event_id), 5000);
        }
      } catch (e2) {
        console.error('Retry after UnknownDeviceError failed:', e2);
        throw e2;
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

    // /**
    //  * Acknowledge all unknown devices in a room (for E2EE)
    //  */
    // async acknowledgeDevicesInRoom(roomId) {
    //     try {
    //         const room = this.client.getRoom(roomId);
    //         if (!room) return;
            
    //         const members = room.getJoinedMembers();
    //         for (const member of members) {
    //             const userId = member.userId;
    //             if (userId === this.currentUserId) continue; // skip self
                
    //             try {
    //                 const devices = await this.client.getStoredDevicesForUser(userId);
    //                 for (const device of devices) {
    //                     const isKnown = this.client.isDeviceKnown(userId, device.deviceId);
    //                     if (!isKnown) {
    //                         console.log(`Acknowledging device: ${userId} / ${device.deviceId}`);
    //                         await this.client.setDeviceKnown(userId, device.deviceId, true);
    //                     }
    //                 }
    //             } catch (err) {
    //                 console.warn(`Could not get devices for ${userId}:`, err);
    //             }
    //         }
            
    //         // Request keys again for failing events
    //         for (const ev of room.getLiveTimeline().getEvents()) {
    //             if (ev.isEncrypted() && (ev.isDecryptionFailure() )) {
    //                 try { await this.client.requestRoomKeyForEvent?.(ev); } catch {}
    //                 try {
    //                     this.client.cancelAndResendEventRoomKeyRequest?.(ev.getId());
    //                 } catch (e) {
    //                     console.warn('Key re-request failed for', ev.getId(), e);
    //                 }
    //             }
    //         }
            
    //         console.log('All devices acknowledged for room:', roomId);
    //     } catch (error) {
    //         console.error('Error acknowledging devices:', error);
    //     }
    // }

async acknowledgeDevicesInRoom(roomId) {
    try {
        const room = this.client.getRoom(roomId);
        if (!room) return;

        const crypto = this.client.getCrypto?.();
        if (!crypto) {
            console.warn('Crypto not available');
            return;
        }

        const members = room.getJoinedMembers();
        
        for (const member of members) {
            const userId = member.userId;
            if (userId === this.currentUserId) continue;
            
            try {
                // Get devices (no downloadKeys in your build, use cached)
                const deviceMap = await crypto.getUserDevices(userId);
                if (!deviceMap || deviceMap.size === 0) continue;

                for (const [deviceId] of deviceMap.entries()) {
                    const status = await await crypto.getDeviceVerificationStatus(userId, deviceId);
                    
                    // Check if device is trusted (any of these flags being true means it's "known")
                    const isTrusted = status.localVerified || status.crossSigningVerified || status.tofu;
                    
                    if (!isTrusted) {
                        console.log(`Marking device trusted (TOFU): ${userId} / ${deviceId}`);
                        
                        // Try multiple APIs to set trust
                        let marked = false;
                        
                        // Option 1: client.setDeviceVerified (legacy, may exist)
                        if (typeof crypto.setDeviceVerified === 'function') {
                            await crypto.setDeviceVerified(userId, deviceId, true);
                            marked = true;
                        }
                        // Option 2: crypto.setDeviceTrust (some Olm builds)
                        else if (typeof crypto.setDeviceTrust === 'function') {
                            await crypto.setDeviceTrust(userId, deviceId, { localVerified: true });
                            marked = true;
                        }
                        // Option 3: client.setDeviceKnown (older API)
                        else if (typeof this.client.setDeviceKnown === 'function') {
                            await this.client.setDeviceKnown(userId, deviceId, true);
                            marked = true;
                        }
                        
                        if (!marked) {
                            console.warn(`No API available to mark device trusted: ${userId}/${deviceId}`);
                            console.warn('User must verify devices manually in Element or another client.');
                        }
                    }
                }
            } catch (err) {
                console.warn(`Could not process devices for ${userId}:`, err);
            }
        }
        
        console.log('Device acknowledgement complete for room:', roomId);
    } catch (error) {
        console.error('Error acknowledging devices:', error);
    }
}

    /**
     * Create image element
     */
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

    /**
     * Create video element
     */
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

    /**
     * Create audio element
     */
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

    /**
     * Create download link
     */
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

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (!bytes && bytes !== 0) return '';
        const units = ['B','KB','MB','GB','TB'];
        let i = 0;
        let n = bytes;
        while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
        return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
    }
//     /**
//  * Mark all unknown devices in a room as known (acknowledge risk).
//  * Note: This does NOT verify devices, it only marks them known so encryption can proceed.
//  */
// async acknowledgeUnknownDevicesInRoom(roomId) {
//     const room = this.client.getRoom(roomId);
//     if (!room) return;

//     // Get joined members
//     const members = room.getJoinedMembers().map(m => m.userId);

//     // Fetch latest devices for each member and mark unknown devices as known
//     for (const userId of members) {
//         try {
//             // Download device list to ensure we have up-to-date device info
//             await this.client.downloadKeys([userId], true);

//             // Newer SDKs expose getStoredDevicesForUser; fallback to legacy lookup if needed
//             const devices = this.client.getStoredDevicesForUser
//                 ? await this.client.getStoredDevicesForUser(userId)
//                 : (this.client.getCrypto()?.deviceList?.getUserDevices(userId) || []);

//             // devices can be array or map-like depending on API; normalize to array of { deviceId }
//             const deviceList = Array.isArray(devices)
//                 ? devices
//                 : Object.values(devices || {});

//             for (const d of deviceList) {
//                 const deviceId = d.deviceId || d.device_id;
//                 if (!deviceId) continue;

//                 // Some SDKs have isDeviceKnown; if not, treat as unknown unless marked already
//                 const isKnown = this.client.isDeviceKnown
//                     ? this.client.isDeviceKnown(userId, deviceId)
//                     : (this.client.getCrypto()?.getDeviceVerificationStatus?.(userId, deviceId)?.known ?? false);

//                 if (!isKnown) {
//                     console.warn(`Marking device known: ${userId} / ${deviceId}`);
//                     await this.client.setDeviceKnown(userId, deviceId, true);
//                 }
//             }
//         } catch (e) {
//             console.warn(`Could not process devices for ${userId}:`, e);
//         }
//     }
// }
/**
 * Mark all unknown devices in a room as KNOWN (unverified) so you can send E2EE.
 * This is TOFU: not secure verification. Prefer interactive verification in UI later.
 */
/**
 * Acknowledge all unknown devices in a room (for E2EE)
 * Works with v28–v38, auto-detects available APIs
 */
async acknowledgeUnknownDevicesInRoom(roomId) {
    try {
        const room = this.client.getRoom(roomId);
        if (!room) return;

        const crypto = this.client.getCrypto?.();
        const members = room.getJoinedMembers();
        
        for (const member of members) {
            const userId = member.userId;
            if (userId === this.currentUserId) continue;
            
            try {
                // Download keys (try both APIs)
                if (crypto?.downloadKeys) {
                    await crypto.downloadKeys([userId]); // v38 rust-crypto
                } else if (this.client.downloadKeys) {
                    await this.client.downloadKeys([userId]); // v28/legacy
                }

                // Get devices (try multiple APIs)
                let devices = [];
                if (crypto?.getUserDevices) {
                    // v38 rust-crypto: returns Map<deviceId, Device>
                    const deviceMap = await crypto.getUserDevices(userId);
                    devices = deviceMap ? Array.from(deviceMap.entries()).map(([id, dev]) => ({ deviceId: id, device: dev })) : [];
                } else if (this.client.getStoredDevicesForUser) {
                    // v28/legacy: returns array
                    devices = (await this.client.getStoredDevicesForUser(userId) || []).map(d => ({ deviceId: d.deviceId, device: d }));
                } else if (crypto?.deviceList?.getStoredDevicesForUser) {
                    // Some intermediate builds
                    devices = (crypto.deviceList.getStoredDevicesForUser(userId) || []).map(d => ({ deviceId: d.deviceId, device: d }));
                }

                // Mark unknown devices as known
                for (const { deviceId } of devices) {
                    if (!deviceId) continue;

                    // Check if known (try multiple APIs)
                    let isKnown = false;
                    if (crypto?.getDeviceVerificationStatus) {
                        // v38 rust-crypto
                        const status = crypto.getDeviceVerificationStatus(userId, deviceId);
                        isKnown = status?.known === true;
                    } else if (this.client.isDeviceKnown) {
                        // v28/legacy
                        isKnown = this.client.isDeviceKnown(userId, deviceId);
                    }

                    if (!isKnown) {
                        console.log(`Acknowledging device: ${userId} / ${deviceId}`);
                        
                        // Set known (try multiple APIs)
                        if (crypto?.setDeviceVerification) {
                            // v38 rust-crypto
                            await crypto.setDeviceVerification(userId, deviceId, {
                                known: true,
                                verified: false,
                                blocked: false,
                            });
                        } else if (this.client.setDeviceKnown) {
                            // v28/legacy
                            await this.client.setDeviceKnown(userId, deviceId, true);
                        }
                    }
                }
            } catch (err) {
                console.warn(`Could not process devices for ${userId}:`, err);
            }
        }
        
        // Request keys for failed decryption events
        const timeline = room.getLiveTimeline();
        if (timeline) {
            for (const ev of timeline.getEvents()) {
                if (ev.isEncrypted?.() && ev.isDecryptionFailure?.()) {
                    try {
                        if (crypto?.requestRoomKey) {
                            await crypto.requestRoomKey(ev);
                        } else if (this.client.requestRoomKeyForEvent) {
                            await this.client.requestRoomKeyForEvent(ev);
                        }
                    } catch (e) {
                        console.warn('Key request failed for event', ev.getId(), e);
                    }
                }
            }
        }
        
        console.log('All devices acknowledged for room:', roomId);
    } catch (error) {
        console.error('Error acknowledging devices:', error);
    }
}

}

// Export for use in other modules
window.MatrixManager = MatrixManager;