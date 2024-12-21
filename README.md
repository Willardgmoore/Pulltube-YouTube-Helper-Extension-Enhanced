# Pulltube YouTube Helper Extension (Enhanced)

An enhanced version of the [original Pulltube Chrome extension](https://mymixapps.com/pulltube-extensions), modified to add playlist support and improved URL handling. This extension helps download YouTube videos through Pulltube by extracting video URLs from both individual videos and entire playlists.

## Origin & Modifications

This is a modified version of the official Pulltube extension, with significant enhancements:
- Added support for playlist extraction
- Improved URL handling and validation
- Enhanced error handling and logging
- Added file download capabilities
- Implemented SOLID principles

Most modifications were made with assistance from [Cursor.com](https://cursor.com), focusing on extending the original functionality while maintaining compatibility with the Pulltube application.

## Key Enhancements

- **Playlist Support**: Unlike the original extension which only handled single videos, this version can:
  - Detect YouTube playlists automatically
  - Extract all video URLs from the current playlist
  - Filter out suggested videos (only processes actual playlist items)
  - Save playlist URLs to a text file

## Features

- Extract URLs from YouTube playlists
- Save playlist URLs to a text file
- Open videos in Pulltube
- Store recently extracted URLs for later use
- Support for single video and playlist processing
- Automatic content script injection
- Permission management for Pulltube integration

## How It Works

1. **URL Extraction**: 
   - For single videos: Extracts the current video URL
   - For playlists: Uses content scripts to extract all video URLs from the playlist

2. **File Management**:
   - Automatically saves extracted URLs to a text file
   - Uses timestamp-based naming for files
   - Implements retry logic for failed downloads

3. **Pulltube Integration**:
   - Opens extracted URLs in Pulltube
   - Manages Pulltube tabs efficiently
   - Handles permissions for Pulltube protocol

## Architecture

### Background Script (background.js)
- Handles extension initialization
- Manages tab operations
- Processes URLs
- Handles file downloads
- Manages Pulltube integration

### Content Script (content.js)
- Extracts playlist information
- Implements URL extraction logic
- Handles YouTube DOM interactions
- Manages message passing

### Popup Interface (popup.js)
- Displays recently extracted URLs
- Shows extraction timestamp
- Provides basic debugging information

## Code Structure

The codebase follows SOLID principles:
- Single Responsibility Principle
- Open/Closed Principle
- Liskov Substitution Principle
- Interface Segregation Principle
- Dependency Inversion Principle

### Key Components

1. **URL Processing**
   - `YouTubeURLExtractor`: Extracts clean video URLs from YouTube elements
   - `PlaylistCollector`: Manages playlist URL collection
   - Handles URL validation and cleaning
   - Supports both single video and playlist URLs

2. **Playlist Collection**
   - `YouTubePlaylistSelector`: Identifies playlist elements in the DOM
   - Implements retry logic for dynamic loading
   - Handles different YouTube playlist layouts
   - Supports multiple selector strategies

3. **File Management**
   - `ChromeDownloader`: Manages file downloads
   - `TextBlobCreator`: Creates downloadable content
   - `TimestampFileNamer`: Generates unique filenames
   - Implements proper cleanup and error handling

4. **Message Handling**
   - `ChromeMessageHandler`: Manages extension communication
   - Implements ping/pong health checks
   - Handles asynchronous responses
   - Provides clear logging for debugging

5. **Logging System**
   - Consistent logging interface
   - Debug mode toggle
   - Emoji-based log identification
   - Performance monitoring

## Error Handling

- Retry logic for playlist loading
- Graceful fallbacks for missing elements
- Clear error messages and logging
- Proper cleanup of resources
- Download verification

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Debugging

- Check the browser console for logs (🎵 prefix for content script, 🎬 prefix for background)
- Use the extension popup for recent URL history
- Monitor the Downloads API in chrome://downloads
- Check chrome://extensions for any loading errors

## Known Issues

- YouTube's dynamic loading may require multiple attempts
- Some playlist layouts might need additional selectors
- Download permissions must be granted manually

## Future Improvements

- Add support for more YouTube layouts
- Implement batch processing options
- Add download progress indicators
- Improve error recovery mechanisms
- Add user configuration options

## Support

For issues and feature requests, please use the GitHub issue tracker.

## License

[Add your license information here]

## Acknowledgments

- YouTube's DOM structure documentation
- Chrome Extensions API documentation
- Pulltube application developers

## Comparison with Original Extension

### Original Pulltube Extension:
- Handles single video URLs
- Sends URLs directly to Pulltube
- Basic URL extraction

### This Enhanced Version:
- Handles both single videos and playlists
- Saves URLs to organized text files
- Advanced URL validation and cleaning
- Improved error handling
- Better logging and debugging
- Maintains all original functionality

## Installation

Since this is a modified version of the original extension, it needs to be installed manually:

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

Note: This follows the same installation process as the [original Pulltube extension](https://mymixapps.com/pulltube-extensions), which also requires manual installation due to Chrome Web Store policies.

## Credits

- Original extension by [MyMixApps/Pulltube](https://mymixapps.com/pulltube-extensions)
- Enhanced with assistance from [Cursor.com](https://cursor.com)
- Community contributions and improvements