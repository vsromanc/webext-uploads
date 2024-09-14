import { startListeningForFileUploads } from './lib/content';

// Start listening for file uploads and patch the showOpenFilePicker API
startListeningForFileUploads(true, true);
