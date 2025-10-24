
/**
 * WebRTC Manager - Handles voice and video calls with Matrix signaling
 * Integrates with Matrix client for call signaling events
 */

class WebRTCManager {
    constructor(matrixClient) {
        this.matrixClient = matrixClient;
        this.client = matrixClient.getClient();
        this.currentCall = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isVideo = false;
        this.isInCall = false;
        
        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        this.setupCallHandlers();
        console.log('WebRTC Manager initialized');
    }

    /**
     * Set up Matrix call event handlers
     */
    setupCallHandlers() {
        if (!this.client) return;

        // Handle incoming call invites
        this.client.on('Call.incoming', (call) => {
            this.handleIncomingCall(call);
        });

        // Handle call state changes
        // this.client.on('call.state', (newState, oldState, call) => {
        //     console.log('Call state changed:', oldState, '->', newState);
        //     this.handleCallStateChange(newState, call);
        // });

        // // Handle call hangup
        // this.client.on('call.hangup', (call) => {
        //     console.log('Call hung up');
        //     this.handleCallHangup(call);
        // });

        // // Handle call replaced (call transfer)
        // this.client.on('call.replaced', (newCall, oldCall) => {
        //     console.log('Call replaced');
        //     this.currentCall = newCall;
        // });

        // console.log('Call event handlers set up');
    }


/**
 * Mute/unmute microphone
 */
setMicrophoneMuted(muted) {
    if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !muted;
        });
        console.log(`Microphone ${muted ? 'muted' : 'unmuted'}`);
    }
    
    if (this.currentCall) {
        this.currentCall.setMicrophoneMuted(muted);
    }
}

/**
 * Mute/unmute camera
 */
setVideoMuted(muted) {
    if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = !muted;
        });
        console.log(`Video ${muted ? 'muted' : 'unmuted'}`);
    }
    
    if (this.currentCall) {
        this.currentCall.setLocalVideoMuted(muted);
    }
}

/**
 * Check if microphone is muted
 */
isMicrophoneMuted() {
    return this.currentCall?.isMicrophoneMuted() ?? true;
}

/**
 * Check if video is muted
 */
isVideoMuted() {
    return this.currentCall?.isLocalVideoMuted() ?? true;
}


    /**
     * Make an outgoing call
     * @param {string} roomId - Room ID to call
     * @param {boolean} isVideo - Whether to include video
     * @returns {boolean} Success status
     */
    async makeCall(roomId, isVideo = false) {
        try {
            if (this.isInCall) {
                console.log('Already in a call');
                return false;
            }

            console.log(`Starting ${isVideo ? 'video' : 'voice'} call in room:`, roomId);
            this.isVideo = isVideo;

            // Get user media
            const stream = await this.getUserMedia(isVideo);
            if (!stream) {
                throw new Error('Failed to get user media');
            }

            this.localStream = stream;

            // Set up local video display
            if (isVideo) {
                this.setupLocalVideo();
            }

            // Create Matrix call
            const call = this.client.createCall(roomId);
            if (!call) {
                throw new Error('Failed to create call');
            }

            this.currentCall = call;
            this.isInCall = true;




// Set up call event handlers for this specific call
        this.setupCallEventHandlers(call);

        // Place the call WITH the local stream
        // await call.placeCallWithCallFeeds([
        //     new window.matrixcs.CallFeed({
        //         client: this.client,
        //         roomId: roomId,
        //         userId: this.matrixClient.getCurrentUserId(),
        //         stream: stream,
        //         purpose: window.matrixcs.SDPStreamMetadataPurpose.Usermedia,
        //         audioMuted: false,
        //         videoMuted: !isVideo
        //     })
        // ]);

        console.log('Call initiated successfully');
// Update UI
        if (window.MatrixApp) {
            window.MatrixApp.updateCallUI(true, isVideo);
        }
         


            // // Place the call
            await call.placeCall(true, isVideo);

            // console.log('Call initiated successfully');
            return true;

        } catch (error) {
            console.error('Error making call:', error);
            await this.cleanup();
            
            // Show user-friendly error
            this.showCallError(`Failed to start call: ${error.message}`);
            return false;
        }
    }

    /**
     * Handle incoming call
     * @param {Object} call - Matrix call object
     */
    async handleIncomingCall(call) {
        try {
            console.log('Incoming call from:', call.remoteUserId);

            if (this.isInCall) {
                console.log('Already in a call, rejecting incoming call');
                await call.reject();
                return;
            }


            // Determine if it's video from the call offer
        this.isVideo = call.hasRemoteUserMediaVideoTrack;




            // Show incoming call UI
            const accept = await this.showIncomingCallDialog(call);
            
            if (accept) {
                console.log('Accepting incoming call');
                
                this.currentCall = call;
                this.isVideo = call.type === 'video';
                this.isInCall = true;

                // Get user media
                const stream = await this.getUserMedia(this.isVideo);
                if (!stream) {
                    throw new Error('Failed to get user media');
                }

                this.localStream = stream;

                // Set up local video display
                if (this.isVideo) {
                    this.setupLocalVideo();
                }


// Set up call event handlers
            this.setupCallEventHandlers(call);

            // Answer the call WITH the local stream
            // await call.answerWithCallFeeds([
            //     new window.matrixcs.CallFeed({
            //         client: this.client,
            //         roomId: call.roomId,
            //         userId: this.matrixClient.getCurrentUserId(),
            //         stream: stream,
            //         purpose: window.matrixcs.SDPStreamMetadataPurpose.Usermedia,
            //         audioMuted: false,
            //         videoMuted: !this.isVideo
            //     })
            // ]);

                // Answer the call
        await call.answer(this.isVideo, this.isVideo);

                // Update UI
                if (window.MatrixApp) {
                    window.MatrixApp.updateCallUI(true, this.isVideo);
                }

            } else {
                console.log('Rejecting incoming call');
                await call.reject();
            }

        } catch (error) {
            console.error('Error handling incoming call:', error);
            await this.cleanup();
        }
    }

    /**
 * Set up event handlers for a specific call instance
 */
setupCallEventHandlers(call) {
    // Handle remote feeds (audio/video streams)
    call.on('feeds_changed', () => {
        console.log('Call feeds changed');
        const remoteFeeds = call.getRemoteFeeds();
        
        if (remoteFeeds.length > 0) {
            const remoteFeed = remoteFeeds[0];
            this.remoteStream = remoteFeed.stream;
            this.setupRemoteVideo();
        }
    });

    // Handle call state
    call.on('state', (state) => {
        console.log('Call state:', state);
        this.handleCallStateChange(state, call);
    });

    // Handle hangup
    call.on('hangup', () => {
        console.log('Call hangup event');
        this.handleCallHangup(call);
    });

    // Handle errors
    call.on('error', (err) => {
        console.error('Call error:', err);
        this.showCallError(`Call error: ${err.message || 'Unknown error'}`);
    });
}
    /**
     * Show incoming call dialog
     * @param {Object} call - Matrix call object
     * @returns {Promise<boolean>} Whether user accepted the call
     */
    async showIncomingCallDialog(call) {
        return new Promise((resolve) => {
            // Create incoming call modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            const callType = call.type === 'video' ? 'Video' : 'Voice';
            const callerName = call.remoteUserId; // Could be enhanced with display name
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Incoming ${callType} Call</h3>
                    </div>
                    <div class="modal-body" style="text-align: center; padding: 2rem;">
                        <div style="margin-bottom: 1rem;">
                            <div class="user-avatar" style="margin: 0 auto 1rem; width: 60px; height: 60px; font-size: 1.5rem;">
                                ${getInitials(callerName)}
                            </div>
                            <p><strong>${escapeHtml(callerName)}</strong></p>
                            <p>is calling you...</p>
                        </div>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <button id="accept-call" style="background: var(--success-color); color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; cursor: pointer;">
                                Accept
                            </button>
                            <button id="reject-call" style="background: var(--error-color); color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; cursor: pointer;">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle button clicks
            const acceptBtn = modal.querySelector('#accept-call');
            const rejectBtn = modal.querySelector('#reject-call');
            
            const cleanup = () => {
                document.body.removeChild(modal);
            };
            
            acceptBtn?.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            rejectBtn?.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            // Auto-reject after 30 seconds
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    cleanup();
                    resolve(false);
                }
            }, 30000);
        });
    }

    /**
     * Handle call state changes
     * @param {string} newState - New call state
     * @param {Object} call - Matrix call object
     */
    handleCallStateChange(newState, call) {
        switch (newState) {
            case 'connected':
                console.log('Call connected');
                // this.handleCallConnected(call);
                break;
                
            case 'ended':
                console.log('Call ended');
                this.handleCallEnded(call);
                break;
                
            case 'ringing':
                console.log('Call ringing');
                break;
                
            default:
                console.log('Call state:', newState);
        }
    }

    /**
     * Handle call connected
     * @param {Object} call - Matrix call object
     */
    handleCallConnected(call) {
        // Set up remote stream handling
        const pc = call.peerConnection;
        if (pc) {
            pc.ontrack = (event) => {
                console.log('Received remote stream');
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };
        }
    }

    /**
     * Handle call ended
     * @param {Object} call - Matrix call object
     */
    handleCallEnded(call) {
        this.cleanup();
        
        if (window.MatrixApp) {
            window.MatrixApp.updateCallUI(false, false);
        }
    }

    /**
     * Handle call hangup
     * @param {Object} call - Matrix call object
     */
    handleCallHangup(call) {
        this.handleCallEnded(call);
    }

    /**
     * Hang up the current call
     */
    async hangup() {
        try {
            if (this.currentCall) {
                console.log('Hanging up call');
                await this.currentCall.hangup();
            }
            
            await this.cleanup();
            
        } catch (error) {
            console.error('Error hanging up call:', error);
            await this.cleanup();
        }
    }

    /**
     * Get user media (camera/microphone)
     * @param {boolean} includeVideo - Whether to include video
     * @returns {Promise<MediaStream>} Media stream
     */
    async getUserMedia(includeVideo) {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: includeVideo ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 15 }
                } : false
            };

            console.log('Requesting user media:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('Got user media stream');
            return stream;

        } catch (error) {
            console.error('Error getting user media:', error);
            
            // Show user-friendly error based on error type
            let errorMessage = 'Failed to access camera/microphone';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera/microphone access denied. Please allow access and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera/microphone found. Please check your devices.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera/microphone is already in use by another application.';
            }
            
            this.showCallError(errorMessage);
            throw error;
        }
    }

    /**
     * Set up local video display
     */
    setupLocalVideo() {
        const localVideo = document.getElementById('local-video');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
            console.log('Local video stream set up');
        }
    }

    /**
     * Set up remote video display
     */
    setupRemoteVideo() {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
            console.log('Remote video stream set up');
        }
    }

    /**
     * Clean up call resources
     */
    async cleanup() {
        try {
            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Stopped track:', track.kind);
                });
                this.localStream = null;
            }

            // Clear video elements
            const localVideo = document.getElementById('local-video');
            const remoteVideo = document.getElementById('remote-video');
            
            if (localVideo) localVideo.srcObject = null;
            if (remoteVideo) remoteVideo.srcObject = null;

            // Reset state
            this.currentCall = null;
            this.remoteStream = null;
            this.isInCall = false;
            this.isVideo = false;

            console.log('Call cleanup completed');

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Show call error to user
     * @param {string} message - Error message
     */
    showCallError(message) {
        // Create error toast/notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--error-color);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            max-width: 300px;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 5000);
    }

    /**
     * Check if WebRTC is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.RTCPeerConnection);
    }

    /**
     * Get current call status
     */
    getCallStatus() {
        return {
            isInCall: this.isInCall,
            isVideo: this.isVideo,
            hasLocalStream: !!this.localStream,
            hasRemoteStream: !!this.remoteStream,
            currentCall: !!this.currentCall
        };
    }
}

// Export for use in other modules
window.WebRTCManager = WebRTCManager;

// Log WebRTC support status
if (WebRTCManager.isSupported()) {
    console.log('WebRTC is supported');
} else {
    console.warn('WebRTC is not fully supported in this browser');
}
