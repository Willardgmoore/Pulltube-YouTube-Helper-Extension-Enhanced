// Interfaces
/**
 * @interface ILogger
 * log(...args: any[]): void
 */

/**
 * @interface IPlaylistSelector
 * getSelectors(): string[]
 * findItems(): Element[]
 */

/**
 * @interface IURLExtractor
 * extractURL(element: Element): string
 */

/**
 * @interface IMessageHandler
 * handleMessage(request: any, sender: any, sendResponse: Function): void | boolean
 */

// Logger Implementation
const Logger = {
    DEBUG: true,
    log: function(...args) {
        if (this.DEBUG) console.log('🎵', ...args);
    }
};

// Playlist Selectors Implementation
class YouTubePlaylistSelector {
    getSelectors() {
        return [
            'ytd-playlist-video-renderer',
            'ytd-playlist-panel-video-renderer',
            '#playlist-items'
        ];
    }

    findItems() {
        const selector = this.getSelectors().join(',');
        return document.querySelectorAll(selector);
    }
}

// URL Extractor Implementation
class YouTubeURLExtractor {
    getAnchorSelectors() {
        return [
            'a#video-title',
            'a#wc-endpoint',
            'a[href*="watch"]'
        ];
    }

    extractURL(item) {
        for (const selector of this.getAnchorSelectors()) {
            const anchor = item.querySelector(selector);
            if (anchor?.href) {
                return anchor.href.split('&')[0];
            }
        }
        return '';
    }
}

// Playlist Collector Implementation
class PlaylistCollector {
    constructor(
        selector = new YouTubePlaylistSelector(),
        extractor = new YouTubeURLExtractor(),
        logger = Logger
    ) {
        this.selector = selector;
        this.extractor = extractor;
        this.logger = logger;
    }

    async collectURLs(maxAttempts = 10) {
        this.logger.log('Starting to collect playlist URLs');
        
        return new Promise((resolve) => {
            let attempts = 0;
            const checkForPlaylist = () => {
                const playlistItems = this.selector.findItems();
                this.logger.log(`Attempt ${attempts + 1}: Found ${playlistItems.length} playlist items`);
                
                if (playlistItems.length > 0) {
                    const urls = this._extractURLs(playlistItems);
                    this.logger.log(`Extracted ${urls.length} valid URLs`);
                    resolve(urls);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkForPlaylist, 1000);
                } else {
                    this.logger.log('Could not find playlist items after maximum attempts');
                    resolve([]);
                }
            };
            
            checkForPlaylist();
        });
    }

    _extractURLs(items) {
        return Array.from(items)
            .map(item => this.extractor.extractURL(item))
            .filter(url => url);
    }
}

// Message Handler Implementation
class ChromeMessageHandler {
    constructor(
        playlistCollector = new PlaylistCollector(),
        logger = Logger
    ) {
        this.playlistCollector = playlistCollector;
        this.logger = logger;
    }

    async handleMessage(request, sender, sendResponse) {
        this.logger.log('Received message:', request);
        
        switch (request.action) {
            case 'ping':
                return this._handlePing(sendResponse);
            case 'getPlaylistUrls':
                return this._handleGetPlaylistUrls(sendResponse);
            default:
                this.logger.log('Unknown action:', request.action);
                return false;
        }
    }

    _handlePing(sendResponse) {
        sendResponse({ status: "ok" });
        return false; // No async response needed
    }

    async _handleGetPlaylistUrls(sendResponse) {
        const urls = await this.playlistCollector.collectURLs();
        const urlString = urls.join('\n');
        this.logger.log('Sending URLs back to background script');
        sendResponse({ urls: urlString });
        return true; // Will respond asynchronously
    }
}

// Initialize message handling
const messageHandler = new ChromeMessageHandler();

// Set up message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return messageHandler.handleMessage(request, sender, sendResponse);
});

Logger.log('Content script loaded and ready');