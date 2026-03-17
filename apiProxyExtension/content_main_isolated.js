window.addEventListener('ACTIVATE_CIVITAI_BRIDGE', () => {
    chrome.runtime.sendMessage({ action: 'enableBridgeMode' });
});
