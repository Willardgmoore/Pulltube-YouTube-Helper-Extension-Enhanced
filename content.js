const DEBUG = true;
function log(...args) {
    if (DEBUG) console.log('🎵', ...args);
}

async function getAllPlaylistUrls() {
    log('Starting to collect playlist URLs');
    
    // Wait for playlist items to be available
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10;
        
        function checkForPlaylist() {
            // Try different YouTube selectors
            const playlistItems = document.querySelectorAll([
                'ytd-playlist-video-renderer',
                'ytd-playlist-panel-video-renderer',
                '#playlist-items'
            ].join(','));
            
            log(`Attempt ${attempts + 1}: Found ${playlistItems.length} playlist items`);
            
            if (playlistItems.length > 0) {
                const urls = Array.from(playlistItems)
                    .map(item => {
                        // Try different ways to get the URL
                        const anchor = item.querySelector('a#video-title') || 
                                     item.querySelector('a#wc-endpoint') ||
                                     item.querySelector('a[href*="watch"]');
                        return anchor?.href?.split('&')[0] || '';
                    })
                    .filter(url => url);
                
                log(`Extracted ${urls.length} valid URLs`);
                resolve(urls);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkForPlaylist, 1000);
            } else {
                log('Could not find playlist items after maximum attempts');
                resolve([]);
            }
        }
        
        checkForPlaylist();
    });
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('Received message:', request);
    
    if (request.action === "ping") {
        sendResponse({ status: "ok" });
        return;
    }
    
    if (request.action === "getPlaylistUrls") {
        getAllPlaylistUrls().then(urls => {
            const urlString = urls.join('\n');
            log('Sending URLs back to background script');
            sendResponse({ urls: urlString });
        });
        return true; // Will respond asynchronously
    }
});

log('Content script loaded and ready');