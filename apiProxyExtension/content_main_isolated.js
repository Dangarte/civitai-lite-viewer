"use strict";


const CIVITAI_ORIGIN = "https://civitai.red";

const pendingRequests = new Map();
let isBridgeReady = false;
const startTime = Date.now();
const TIMEOUT = 10000; // 10 sec
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Create an invisible iframe
const iframe = document.createElement('iframe');
iframe.style.cssText = 'display: none;';
iframe.referrerPolicy = 'no-referrer';

// Append iframe to page (after network rules applied)
chrome.runtime.sendMessage({ action: 'enableBridgeMode' }).then(() => insertIframe());

// Listening to responses from the iframe
window.addEventListener('message', e => {
    if (e.origin !== CIVITAI_ORIGIN) return;

    const { id, type, data } = e.data;

    if (type === 'FETCH_RESPONSE' && pendingRequests.has(id)) {
        const resolve = pendingRequests.get(id);
        resolve(data);
        pendingRequests.delete(id);
    }

    if (type === 'BRIDGE_READY') {
        console.log("[API Bridge] Bridge Handshake Complete!");
        isBridgeReady = true;
    }
});

window.addEventListener('CIV_REQUEST', async (e) => {
    const { id, route, params } = e.detail;

    if (!isBridgeReady) {
        while (!isBridgeReady && (Date.now() - startTime) < TIMEOUT) {
            await sleep(50);
        }
    }

    iframe.contentWindow.postMessage({ id, type: 'FETCH_REQUEST', route, params }, CIVITAI_ORIGIN);

    pendingRequests.set(id, data => {
        window.dispatchEvent(new CustomEvent('CIV_RESPONSE', { detail: { id, data } }));
    });
});

function insertIframe() {
    iframe.src = `${CIVITAI_ORIGIN}/?bridge=true`;

    if (document.body) document.body.appendChild(iframe);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(iframe), { once: true });
}
