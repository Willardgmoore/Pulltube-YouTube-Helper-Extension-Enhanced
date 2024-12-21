document.addEventListener('DOMContentLoaded', async () => {
    const data = await chrome.storage.local.get('pulltubePlaylists');
    const urlsElement = document.getElementById('urls');
    
    if (data.pulltubePlaylists) {
        const { lastExtracted, timestamp } = data.pulltubePlaylists;
        urlsElement.textContent = `Timestamp: ${timestamp}\n\nURLs:\n${lastExtracted.join('\n')}`;
    } else {
        urlsElement.textContent = 'No URLs stored yet';
    }
}); 