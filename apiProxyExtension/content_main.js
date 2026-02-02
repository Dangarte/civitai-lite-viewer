(function initCivitaiExtensionProxyAPI() {
    const CIVITAI_ORIGIN = "https://civitai.com";

    let isBridgeReady = false;
    window.extension_civitaiExtensionProxyAPI_vertsion = 2;

    // Create an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.referrerpolicy = 'no-referrer';
    document.addEventListener('DOMContentLoaded', () => {
        // Append iframe to page
        setTimeout(() => {
            iframe.src = `${CIVITAI_ORIGIN}/?bridge=true`;
            document.body.appendChild(iframe);
        }, 50);
    }, { once: true });

    const pendingRequests = new Map();

    // Listening to responses from the iframe
    window.addEventListener('message', e => {
        if (e.origin !== CIVITAI_ORIGIN) return;

        const { id, type, data } = e.data;
        if (type === 'FETCH_RESPONSE' && pendingRequests.has(id)) {
            const { resolve } = pendingRequests.get(id);
            resolve(data);
            pendingRequests.delete(id);
        }

        if (e.data.type === 'BRIDGE_READY') {
            console.log("[API Bridge] Bridge Handshake Complete!");
            isBridgeReady = true;
        }
    });

    const startTime = Date.now();
    const TIMEOUT = 10000; // 10 sec
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // Proxy function
    window.proxyFetchCivAPI = async function (route, params = {}) {
        while (!isBridgeReady && (Date.now() - startTime) < TIMEOUT) {
            await sleep(50);
        }

        if (!isBridgeReady) {
            console.log("[API Bridge] Bridge failed to respond");
            return Promise.resolve({ ok: false, error: "Bridge timeout" });
        }

        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            pendingRequests.set(id, { resolve, reject });

            iframe.contentWindow.postMessage({ id, type: 'FETCH_REQUEST', route, params }, CIVITAI_ORIGIN);
        });
    };
})();
