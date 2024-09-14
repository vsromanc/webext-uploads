import { onFileUpload } from './lib/background';
import { FileMetadata } from './lib/types';

// Define a callback to handle file upload events
function handleFileUpload(files: FileMetadata[], sender: chrome.runtime.MessageSender): void {
    console.log('Files uploaded:', files);
    console.log('From tab:', sender.tab);
}

// Start listening for file upload events
onFileUpload(handleFileUpload);