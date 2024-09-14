import { FileMetadata } from "./types";

export function startListeningForFileUploads(
    patchShowOpenFilePickerApi: boolean = false,
    traceDynamicInputs: boolean = false
): void {
    // Listen for change events on input[type="file"] elements
    document.addEventListener(
        'change',
        function (event: Event): void {
            const target = event.target as HTMLInputElement;
            if (target && target.tagName === 'INPUT' && target.type === 'file') {
                handleFileInputFiles(target.files);
            }
        },
        true // Use capture to intercept events before they are stopped
    );

    // Listen for drop events on the document
    document.addEventListener(
        'drop',
        function (event: DragEvent): void {
            const items = event.dataTransfer?.items;
            if (items && items.length > 0) {
                handleDataTransferItems(items);
            }
        },
        true // Use capture to intercept events before they are stopped
    );

    // Listen for paste events on the document
    document.addEventListener(
        'paste',
        function (event: ClipboardEvent): void {
            const items = event.clipboardData?.items;
            if (items && items.length > 0) {
                handleClipboardItems(items);
            }
        },
        true // Use capture to intercept events before they are stopped
    );

    // Inject scripts if necessary
    if (patchShowOpenFilePickerApi || traceDynamicInputs) {
        // Inject a script into the page to patch APIs
        const script = document.createElement('script');
        script.textContent = `(${injectedScript.toString()})(${patchShowOpenFilePickerApi}, ${traceDynamicInputs});`;
        document.documentElement.appendChild(script);
        script.parentNode?.removeChild(script);

        // Listen for messages from the page
        window.addEventListener('message', function (event: MessageEvent): void {
            if (event.source !== window) return;
            if (event.data && event.data.type === 'fileUploadFromPage') {
                const files: FileMetadata[] = event.data.files;
                // Send message to background script
                chrome.runtime.sendMessage({ type: 'fileUpload', files });
            }
        });
    }
}

function handleFileInputFiles(files: FileList | null): void {
    if (files && files.length > 0) {
        // Extract file information
        const fileList: FileMetadata[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Get the relative path (if any)
            const relativePath = (file as any).webkitRelativePath || file.name;
            fileList.push({
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                relativePath: relativePath,
            });
        }
        // Send message to background script
        chrome.runtime.sendMessage({ type: 'fileUpload', files: fileList });
    }
}

function handleDataTransferItems(items: DataTransferItemList): void {
    const fileList: FileMetadata[] = [];
    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry();
        if (entry) {
            entries.push(entry);
        }
    }
    // Process entries recursively
    const traverseFileTree = (entry: any, path: string): Promise<void> => {
        return new Promise((resolve) => {
            if (entry.isFile) {
                entry.file((file: File) => {
                    fileList.push({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                        relativePath: path + file.name,
                    });
                    resolve();
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                dirReader.readEntries((entries: any[]) => {
                    const promises = entries.map((ent) =>
                        traverseFileTree(ent, path + entry.name + '/')
                    );
                    Promise.all(promises).then(() => resolve());
                });
            } else {
                resolve();
            }
        });
    };

    const traversePromises = entries.map((entry) => traverseFileTree(entry, ''));
    Promise.all(traversePromises).then(() => {
        if (fileList.length > 0) {
            // Send message to background script
            chrome.runtime.sendMessage({ type: 'fileUpload', files: fileList });
        }
    });
}

function handleClipboardItems(items: DataTransferItemList): void {
    const fileList: FileMetadata[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                fileList.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    relativePath: file.name,
                });
            }
        }
    }
    if (fileList.length > 0) {
        // Send message to background script
        chrome.runtime.sendMessage({ type: 'fileUpload', files: fileList });
    }
}

// Script to be injected into the page
function injectedScript(patchShowOpenFilePickerApi: boolean, traceDynamicInputs: boolean): void {
    // Function to send file metadata to content script
    function sendFilesToContentScript(files: any[]): void {
        window.postMessage({ type: 'fileUploadFromPage', files }, '*');
    }

    // Patch showOpenFilePicker API
    if (patchShowOpenFilePickerApi) {
        const originalShowOpenFilePicker = (window as any).showOpenFilePicker;
        if (typeof originalShowOpenFilePicker === 'function') {
            (window as any).showOpenFilePicker = async function (...args: any[]): Promise<any> {
                const handles = await originalShowOpenFilePicker.apply(this, args);
                const fileList: any[] = [];

                const processHandle = async (handle: any, path: string) => {
                    if (handle.kind === 'file') {
                        const file = await handle.getFile();
                        fileList.push({
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            lastModified: file.lastModified,
                            relativePath: path + file.name,
                        });
                    } else if (handle.kind === 'directory') {
                        for await (const [name, childHandle] of (handle as any).entries()) {
                            await processHandle(childHandle, path + handle.name + '/');
                        }
                    }
                };

                for (const handle of handles) {
                    await processHandle(handle, '');
                }

                // Send message to content script
                sendFilesToContentScript(fileList);
                return handles;
            };
        }
    }

    // Trace dynamic input elements without overriding document.createElement
    if (traceDynamicInputs) {
        // Override addEventListener on HTMLInputElement.prototype
        const originalAddEventListener = HTMLInputElement.prototype.addEventListener;
        HTMLInputElement.prototype.addEventListener = function (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions
        ): void {
            if (type === 'change' && this.type === 'file') {
                const wrappedListener = function (event: Event): void {
                    const input = event.target as HTMLInputElement;
                    if (input.files && input.files.length > 0) {
                        const fileList: any[] = [];
                        for (let i = 0; i < input.files.length; i++) {
                            const file = input.files[i];
                            const relativePath = (file as any).webkitRelativePath || file.name;
                            fileList.push({
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                lastModified: file.lastModified,
                                relativePath: relativePath,
                            });
                        }
                        sendFilesToContentScript(fileList);
                    }
                    if (typeof listener === 'function') {
                        listener.call(this, event);
                    } else if (listener && typeof listener.handleEvent === 'function') {
                        listener.handleEvent(event);
                    }
                };
                originalAddEventListener.call(this, type, wrappedListener, options);
            } else {
                originalAddEventListener.call(this, type, listener, options);
            }
        };

        // Monitor setAttribute for type changes
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name: string, value: string): void {
            if (this instanceof HTMLInputElement && name === 'type' && value === 'file') {
                // The input type is being set to 'file', so we need to monitor it
                // Optionally, you can attach the change event here if needed
            }
            originalSetAttribute.call(this, name, value);
        };

        // Monitor direct property assignments for 'type'
        const originalTypeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'type'
        )?.set;
        if (originalTypeSetter) {
            Object.defineProperty(HTMLInputElement.prototype, 'type', {
                set: function (value: string) {
                    if (value === 'file') {
                        // The input type is being set to 'file', so we can attach the change event if needed
                    }
                    originalTypeSetter.call(this, value);
                },
                get: function () {
                    return originalTypeSetter?.call(this);
                },
                configurable: true,
                enumerable: true,
            });
        }
    }
}
