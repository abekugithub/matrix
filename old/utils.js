
/**
 * Matrix Minimal Client - Utility Functions
 * Common helper functions used throughout the application
 */

/**
 * Get initials from a display name or user ID
 * @param {string} name - Display name or user ID
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    if (!name) return '?';
    
    // Remove @ symbol and domain for user IDs
    const cleanName = name.replace(/^@/, '').split(':')[0];
    
    // Split by spaces and get first letter of each word
    const parts = cleanName.split(/[\s._-]+/).filter(part => part.length > 0);
    
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    
    // Get first letter of first two words
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }
    
    // Check if it's this year
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    // Full date for older messages
    return date.toLocaleDateString([], { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Format file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    if (i === 0) {
        return bytes + ' ' + units[i];
    }
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Check if a string is a valid Matrix user ID
 * @param {string} userId - User ID to validate
 * @returns {boolean} Whether the user ID is valid
 */
function isValidMatrixUserId(userId) {
    if (!userId || typeof userId !== 'string') return false;
    
    // Matrix user IDs have the format @localpart:domain
    const regex = /^@[a-z0-9._=\-\/]+:[a-z0-9.-]+\.[a-z]{2,}$/i;
    return regex.test(userId);
}

/**
 * Check if a string is a valid Matrix room ID
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} Whether the room ID is valid
 */
function isValidMatrixRoomId(roomId) {
    if (!roomId || typeof roomId !== 'string') return false;
    
    // Matrix room IDs have the format !localpart:domain
    const regex = /^![a-zA-Z0-9._=\-\/]+:[a-z0-9.-]+\.[a-z]{2,}$/;
    return regex.test(roomId);
}

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
function generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            } catch (error) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Show a toast notification
 * @param {string} message - Message to show
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    
    const colors = {
        success: 'var(--success-color)',
        error: 'var(--error-color)', 
        warning: 'var(--warning-color)',
        info: 'var(--accent-color)'
    };
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        max-width: 300px;
        font-size: 0.875rem;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-remove after specified duration
    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
                if (document.head.contains(style)) {
                    document.head.removeChild(style);
                }
            }, 300);
        }
    }, duration);
}

/**
 * Parse Matrix MXC URL to HTTP URL
 * @param {string} mxcUrl - Matrix MXC URL
 * @param {string} homeserverUrl - Homeserver base URL
 * @returns {string} HTTP URL
 */
function mxcToHttp(mxcUrl, homeserverUrl) {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return mxcUrl;
    
    const serverAndId = mxcUrl.substring(6); // Remove 'mxc://'
    const baseUrl = homeserverUrl.endsWith('/') ? homeserverUrl.slice(0, -1) : homeserverUrl;
    
    return `${baseUrl}/_matrix/media/r0/download/${serverAndId}`;
}

/**
 * Detect if device is mobile
 * @returns {boolean} Whether the device is mobile
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if device supports touch
 * @returns {boolean} Whether the device supports touch
 */
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get device type for responsive design
 * @returns {string} Device type (mobile, tablet, desktop)
 */
function getDeviceType() {
    const width = window.innerWidth;
    
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

/**
 * Smooth scroll to element
 * @param {string|Element} element - Element selector or element
 * @param {number} offset - Offset from top in pixels
 */
function smoothScrollTo(element, offset = 0) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    
    if (target) {
        const top = target.offsetTop - offset;
        window.scrollTo({
            top: top,
            behavior: 'smooth'
        });
    }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string
 */
function getRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
}

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {boolean} Whether the email is valid
 */
function isValidEmail(email) {
    if (!email) return false;
    
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Wait for specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the wait
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (i === maxRetries) {
                throw lastError;
            }
            
            const delay = baseDelay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
            await sleep(delay);
        }
    }
}

// Export utility functions for use in other modules
window.Utils = {
    getInitials,
    escapeHtml,
    formatTimestamp,
    formatFileSize,
    debounce,
    throttle,
    isValidMatrixUserId,
    isValidMatrixRoomId,
    generateRandomString,
    copyToClipboard,
    showToast,
    mxcToHttp,
    isMobile,
    isTouchDevice,
    getDeviceType,
    smoothScrollTo,
    getRelativeTime,
    isValidEmail,
    sleep,
    retryWithBackoff
};

console.log('Utility functions loaded');
