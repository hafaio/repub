import { generateMHTML } from './generator';

console.log('[content] Content script loaded');

// Set up message listener
browser.runtime.onMessage.addListener((message: { type: string }, sender: any) => {
  console.log('[content] Received message', { type: message.type, sender });
  
  if (message.type === 'capture-mhtml') {
    try {
      console.log('[content] Starting MHTML capture...');
      console.log('[content] Document title:', document.title);
      console.log('[content] Document URL:', document.location.href);
      console.log('[content] Document has images:', document.getElementsByTagName('img').length);
      console.log('[content] Document has stylesheets:', document.styleSheets.length);
      
      return generateMHTML(document as any)  // Type assertion since Document implements our interface
        .then(mhtmlData => {
          console.log('[content] MHTML capture completed, size:', mhtmlData.byteLength);
          return { success: true, data: mhtmlData };
        })
        .catch(error => {
          console.error('[content] MHTML capture failed:', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        });
    } catch (error) {
      console.error('[content] MHTML capture failed (sync):', error);
      return Promise.resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log('[content] Unhandled message type:', message.type);
  return Promise.resolve(undefined);
});
