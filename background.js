// Add this at the top of the file to enable logging
const DEBUG = true;
function log(...args) {
	if (DEBUG) {
		console.log('🎬', ...args);
	}
}

async function getCurrentTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

async function isContentScriptInjected(tabId) {
	try {
		await chrome.tabs.sendMessage(tabId, { action: "ping" });
		return true;
	} catch {
		return false;
	}
}

async function injectContentScript(tabId) {
	log('Checking if content script needs to be injected...');
	
	// First check if already injected
	const isInjected = await isContentScriptInjected(tabId);
	if (isInjected) {
		log('Content script already present');
		return true;
	}
	
	log('Injecting content script into tab:', tabId);
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ['content.js']
		});
		log('Content script injected successfully');
		return true;
	} catch (error) {
		log('Failed to inject content script:', error);
		return false;
	}
}

async function checkPermission() {
	const { pulltube_always_allow } = await chrome.storage.local.get('pulltube_always_allow');
	if (pulltube_always_allow) {
		return true;
	}

	return new Promise((resolve) => {
		chrome.windows.create({
			url: 'permission.html',
			type: 'popup',
			width: 400,
			height: 250
		});

		chrome.runtime.onMessage.addListener(function listener(message) {
			if (message.action === 'permission_granted') {
				chrome.runtime.onMessage.removeListener(listener);
				resolve(true);
			} else if (message.action === 'permission_denied') {
				chrome.runtime.onMessage.removeListener(listener);
				resolve(false);
			}
		});
	});
}

// Interfaces
/**
 * @interface ILogger
 * log(message: string, ...args: any[]): void
 */

/**
 * @interface IContentCreator
 * create(data: any[]): string
 */

/**
 * @interface IFileDownloader
 * download(content: string, filename: string): Promise<number>
 */

/**
 * @interface IDownloadMonitor
 * waitForCompletion(downloadId: number): Promise<boolean>
 */

// Logger Implementation
const Logger = {
	log: (message, ...args) => {
		if (DEBUG) console.log('🎵', message, ...args);
	}
};

// Content Creator Implementation
class URLContentCreator {
	create(urls) {
		Logger.log('Creating content from URLs:', urls.length);
		return urls
			.map(url => url.trim())
			.filter(url => url)
			.join('\n');
	}
}

// File Name Generator Implementation
class TimestampFileNamer {
	generate() {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		return `pulltube-urls-${timestamp}.txt`;
	}
}

// Blob Creator Implementation
class TextBlobCreator {
	create(content) {
		return new Blob([content], { 
			type: 'text/plain;charset=utf-8' 
		});
	}
}

// Chrome Download Implementation
class ChromeDownloader {
	constructor(blobCreator) {
		this.blobCreator = blobCreator;
	}

	async download(content, filename) {
		Logger.log('Starting file download:', { filename, contentLength: content.length });
		
		const blob = this.blobCreator.create(content);
		const blobUrl = URL.createObjectURL(blob);
		
		try {
			return await this._initiateDownload(blobUrl, filename);
		} finally {
			URL.revokeObjectURL(blobUrl);
		}
	}

	_initiateDownload(blobUrl, filename) {
		return new Promise((resolve, reject) => {
			const options = {
				url: blobUrl,
				filename,
				saveAs: true,
				conflictAction: 'uniquify'
			};
			
			// Add error handling for downloads API
			if (!chrome.downloads) {
				reject(new Error('Downloads API not available'));
				return;
			}

			chrome.downloads.download(options, (downloadId) => {
				if (chrome.runtime.lastError) {
					Logger.log('Download error:', chrome.runtime.lastError);
					reject(chrome.runtime.lastError);
				} else if (downloadId === undefined) {
					Logger.log('Download failed: No download ID returned');
					reject(new Error('Download failed to start'));
				} else {
					Logger.log('Download initiated:', downloadId);
					resolve(downloadId);
				}
			});
		});
	}
}

// Download Monitor Implementation
class ChromeDownloadMonitor {
	async waitForCompletion(downloadId) {
		Logger.log('Monitoring download:', downloadId);
		return new Promise((resolve, reject) => {
			const listener = this._createListener(downloadId, resolve, reject);
			chrome.downloads.onChanged.addListener(listener);
		});
	}

	_createListener(downloadId, resolve, reject) {
		return (delta) => {
			if (delta.id === downloadId) {
				if (delta.state?.current === 'complete') {
					chrome.downloads.onChanged.removeListener(listener);
					Logger.log('Download completed successfully');
					resolve(true);
				} else if (delta.error) {
					chrome.downloads.onChanged.removeListener(listener);
					Logger.log('Download failed:', delta.error.current);
					reject(new Error(`Download failed: ${delta.error.current}`));
				}
			}
		};
	}
}

// File Saver Service
class FileSaverService {
	constructor(
		contentCreator = new URLContentCreator(),
		fileNamer = new TimestampFileNamer(),
		downloader = new ChromeDownloader(new TextBlobCreator()),
		monitor = new ChromeDownloadMonitor()
	) {
		this.contentCreator = contentCreator;
		this.fileNamer = fileNamer;
		this.downloader = downloader;
		this.monitor = monitor;
	}

	async save(urls) {
		if (!urls?.length) {
			Logger.log('No URLs provided to save');
			return false;
		}

		try {
			// Create content first to validate we have data
			const content = this.contentCreator.create(urls);
			if (!content) {
				Logger.log('No content generated from URLs');
				return false;
			}

			const filename = this.fileNamer.generate();
			
			// Attempt download with retries
			let attempts = 0;
			const maxAttempts = 3;
			
			while (attempts < maxAttempts) {
				try {
					const downloadId = await this.downloader.download(content, filename);
					await this.monitor.waitForCompletion(downloadId);
					Logger.log('File saved successfully');
					return true;
				} catch (error) {
					attempts++;
					Logger.log(`Download attempt ${attempts} failed:`, error);
					if (attempts === maxAttempts) throw error;
					await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
				}
			}
		} catch (error) {
			Logger.log('Error saving URLs to file:', error);
			throw error;
		}
	}
}

// Factory
const FileSaverFactory = {
	create: () => new FileSaverService()
};

// Public API
async function saveUrlsToFile(urls) {
	const fileSaver = FileSaverFactory.create();
	return fileSaver.save(urls);
}

// URL Processor Service
class URLProcessorService {
	constructor(fileSaver = FileSaverFactory.create()) {
		this.fileSaver = fileSaver;
	}

	async process(urlString) {
		Logger.log('Processing URLs:', urlString);
		
		const urls = this._parseUrls(urlString);
		Logger.log(`Processing ${urls.length} URLs`);
		
		try {
			await this.fileSaver.save(urls);
			Logger.log('URLs saved to file successfully');
			return urls;
		} catch (error) {
			Logger.log('Failed to save URLs to file:', error);
			return urls; // Continue even if save fails
		}
	}

	_parseUrls(urlString) {
		return urlString.split('\n')
			.map(url => {
				try {
					const urlObj = new URL(url);
					return `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`;
				} catch (e) {
					Logger.log('Error cleaning URL:', e);
					return url;
				}
			})
			.filter(url => url);
	}
}

async function openUrlsInPulltube(urlString) {
	log('Opening URLs in Pulltube:', urlString);
	
	const hasPermission = await checkPermission();
	if (!hasPermission) {
		log('Permission denied');
		return;
	}

	// Split URLs and clean them
	const urls = urlString.split('\n')
		.map(url => {
			try {
				const urlObj = new URL(url);
				return `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`;
			} catch (e) {
				log('Error cleaning URL:', e);
				return url;
			}
		})
		.filter(url => url);

	log(`Processing ${urls.length} URLs`);
	
	// Save URLs to file
	saveUrlsToFile(urls);

	// Create or get a dedicated tab for Pulltube URLs
	let pulltubeTabs = await chrome.tabs.query({ url: 'pulltube://*' });
	let pulltubeTab = pulltubeTabs[0];
	
	// Process each URL sequentially using the same tab
	for (let i = 0; i < urls.length; i++) {
		const action_url = `pulltube://${urls[i]}`;
		log(`Opening URL ${i + 1}/${urls.length}:`, action_url);
		
		if (pulltubeTab) {
			await chrome.tabs.update(pulltubeTab.id, { url: action_url });
		} else {
			// Create tab only for the first URL
			pulltubeTab = await chrome.tabs.create({
				url: action_url,
				active: false
			});
		}
		
		// Add a small delay between updates to ensure proper handling
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	// Return to YouTube tab
	const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
	await chrome.tabs.update(currentTab.id, { active: true });
}

async function storeExtractedUrls(urls) {
	try {
		await chrome.storage.local.set({
			pulltubePlaylists: {
					lastExtracted: urls,
					timestamp: new Date().toISOString()
			}
		});
		log('URLs stored successfully');
	} catch (error) {
		log('Error storing URLs:', error);
	}
}

async function handleUrl(url, tab) {
	log('Processing URL:', url);
	
	if (!url?.includes('youtube.com') || !tab?.id) {
		log('Invalid URL or tab:', { url, tab });
		return;
	}

	try {
		const urlParams = new URLSearchParams(new URL(url).search);
		const hasPlaylist = urlParams.has('list');
		log('Is playlist?', hasPlaylist);

		if (hasPlaylist) {
			log('Processing playlist URL');
			
			await chrome.tabs.update(tab.id, { active: true });
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			const injected = await injectContentScript(tab.id);
			if (!injected) {
				log('Failed to inject content script, falling back to single URL');
				openUrlsInPulltube(url);
				return;
			}

			try {
				const response = await chrome.tabs.sendMessage(tab.id, { 
					action: "getPlaylistUrls" 
				});
				
				log('Received response from content script:', response);
				if (response?.urls) {
					const extractedUrls = response.urls.split('\n');
					log('🎯 Extracted URLs:', {
						count: extractedUrls.length,
						urls: extractedUrls
					});
					
					await storeExtractedUrls(extractedUrls);
					
					openUrlsInPulltube(response.urls);
				} else {
					log('No URLs in response, falling back to single URL');
					openUrlsInPulltube(url);
				}
			} catch (error) {
				log('Error getting playlist URLs:', error);
				openUrlsInPulltube(url);
			}
		} else {
			log('Processing single video URL');
			openUrlsInPulltube(url);
		}
	} catch (error) {
		log('Error in handleUrl:', error);
		openUrlsInPulltube(url);
	}
}

// Initialize extension
chrome.action.onClicked.addListener(async (tab) => {
	log('Extension button clicked');
	if (tab.url?.includes('youtube.com')) {
		// If we're on YouTube, process the current page
		await handleUrl(tab.url, tab);
	} else {
		// If we're not on YouTube, try to open stored URLs
		const opened = await openStoredUrls();
		if (!opened) {
			log('No stored URLs to open');
			// Optionally show the popup for debugging
			chrome.windows.create({
				url: 'popup.html',
				type: 'popup',
				width: 400,
				height: 600
			});
		}
	}
});

// Add this function to get stored URLs
async function getStoredUrls() {
    try {
        const data = await chrome.storage.local.get('pulltubePlaylists');
        log('Retrieved stored URLs:', data.pulltubePlaylists);
        return data.pulltubePlaylists;
    } catch (error) {
        log('Error retrieving URLs:', error);
        return null;
    }
}

// Add message listener to handle URL requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStoredUrls") {
        getStoredUrls().then(urls => {
            sendResponse({ urls });
        });
        return true; // Will respond asynchronously
    }
});

async function openStoredUrls() {
    try {
        const data = await chrome.storage.local.get('pulltubePlaylists');
        if (data.pulltubePlaylists?.lastExtracted) {
            const urls = data.pulltubePlaylists.lastExtracted;
            const urlString = urls.join('\n');
            openUrlsInPulltube(urlString);
            return true;
        }
        return false;
    } catch (error) {
        log('Error opening stored URLs:', error);
        return false;
    }
}

log('Background script loaded and ready');