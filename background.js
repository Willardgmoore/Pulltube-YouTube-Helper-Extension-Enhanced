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

// File handling module
const FileHandler = {
	createBlob: (content) => {
		return new Blob([content], { type: 'text/plain;charset=utf-8' });
	},

	generateFilename: () => {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		return `pulltube-urls-${timestamp}.txt`;
	},

	createDownload: async (blob, filename) => {
		const blobUrl = URL.createObjectURL(blob);
		try {
			const downloadId = await new Promise((resolve, reject) => {
				chrome.downloads.download({
					url: blobUrl,
					filename: filename,
					saveAs: true,
					conflictAction: 'uniquify'
				}, (downloadId) => {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else {
						resolve(downloadId);
					}
				});
			});
			return downloadId;
		} finally {
			URL.revokeObjectURL(blobUrl);
		}
	}
};

// Download monitoring module
const DownloadMonitor = {
	watchDownload: (downloadId) => {
		return new Promise((resolve, reject) => {
			const listener = (delta) => {
				if (delta.id === downloadId) {
					if (delta.state?.current === 'complete') {
						chrome.downloads.onChanged.removeListener(listener);
						resolve(true);
					} else if (delta.error) {
						chrome.downloads.onChanged.removeListener(listener);
						reject(new Error(`Download failed: ${delta.error.current}`));
					}
				}
			};
			chrome.downloads.onChanged.addListener(listener);
		});
	}
};

// Main file saving function
async function saveUrlsToFile(urls) {
	log('Starting saveUrlsToFile with', urls.length, 'URLs');
	
	try {
		// Create content
		const content = urls.join('\n');
		log('Content prepared:', { urlCount: urls.length });
		
		// Generate filename
		const filename = FileHandler.generateFilename();
		log('Generated filename:', filename);
		
		// Create blob
		const blob = FileHandler.createBlob(content);
		log('Blob created');
		
		// Initiate download
		const downloadId = await FileHandler.createDownload(blob, filename);
		log('Download initiated:', downloadId);
		
		// Monitor download
		await DownloadMonitor.watchDownload(downloadId);
		log('Download completed successfully');
		
		return true;
	} catch (error) {
		log('Error in saveUrlsToFile:', error);
		throw error;
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