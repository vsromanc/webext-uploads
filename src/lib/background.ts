import { FileMetadata } from "./types";

export function onFileUpload(
  callback: (
    files: FileMetadata[],
    sender: chrome.runtime.MessageSender
  ) => void
): void {
  chrome.runtime.onMessage.addListener(function (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): void {
    if (message.type === "fileUpload") {
      callback(message.files as FileMetadata[], sender);
    }
  });
}
