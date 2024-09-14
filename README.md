# Chrome extension detecting file uploads (code by ChatGPT), including this README :)

## Overview

A Chrome extension that detects file and folder uploads on web pages from various sources:

- Standard `<input type="file">` elements
- Dynamically created inputs (even if not added to the DOM)
- Drag-and-drop uploads (including folders)
- Clipboard paste events
- The `showOpenFilePicker` API (including directories)

## Usage

### Content Script

To use the library in your content script, import the `startListeningForFileUploads` function from `fileUploadDetector` and call it with the desired options.

```typescript
import { startListeningForFileUploads } from './fileUploadDetector';

// Start listening for file uploads, patch the showOpenFilePicker API, and trace dynamic inputs
startListeningForFileUploads(true, true);
```

**Parameters:**

- `patchShowOpenFilePickerApi` (boolean): If `true`, the script will patch the `showOpenFilePicker` API to detect file uploads through it.
- `traceDynamicInputs` (boolean): If `true`, the script will trace dynamically created input elements that are not added to the DOM.

### Background Script

In your background script, import the `onFileUpload` function from `fileUploadDetector` and provide a callback function to handle file upload events.

```typescript
import { onFileUpload, FileMetadata } from './fileUploadDetector';

// Define a callback to handle file upload events
function handleFileUpload(files: FileMetadata[], sender: chrome.runtime.MessageSender): void {
    console.log('Files uploaded:', files);
    console.log('From tab:', sender.tab);
}

// Start listening for file upload events
onFileUpload(handleFileUpload);
```

The `handleFileUpload` function receives:

- `files`: An array of `FileMetadata` objects containing information about each uploaded file.
- `sender`: Information about the sender of the message, including the tab from which the upload originated.

### FileMetadata Interface

The `FileMetadata` interface defines the structure of the file information:

```typescript
export interface FileMetadata {
    name: string;
    size: number;
    type: string;
    lastModified: number;
    relativePath: string;
}
```

- `name`: The name of the file.
- `size`: The size of the file in bytes.
- `type`: The MIME type of the file.
- `lastModified`: The timestamp (in milliseconds since the epoch) when the file was last modified.
- `relativePath`: The relative path of the file, including directories if applicable.

## Testing

Run automated tests using Playwright:

```bash
npm run test
```