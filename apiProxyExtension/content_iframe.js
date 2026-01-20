// Clean iframe
window.stop();
document.documentElement.innerHTML = '<!DOCTYPE html><html><head><title>Proxy Bridge</title></head><body></body></html>';

// Bridge thingy
const ORIGINS = [
    "https://dangarte.github.io/civitai-lite-viewer"
];
const CIVITAI_ORIGIN = "https://civitai.com";
const CIVITAI_TRPC = "/api/trpc/";
const CIVITAI_TRPC_ROUTES = [
    'model.getAssociatedResourcesCardData', // not used now
    'image.getInfinite',
    'article.getInfinite',
    'article.getById',
];

window.addEventListener('message', async e => {
    if (!ORIGINS.includes(e.origin)) return;
    const { id, type, route, params } = e.data;

    if (!CIVITAI_TRPC_ROUTES.includes(route)) {
        console.log(`[API Bridge] The route "${route}" is not on the white list`);
        return Promise.resolve({ ok: false, error: "Wront route", route });
    }

    if (type === 'FETCH_REQUEST') {
        const options = {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        try {
            const url = new URL(`${CIVITAI_TRPC}${route}`, CIVITAI_ORIGIN);
            Object.keys(params).forEach(key => {
                const value = params[key];
                const type = typeof value;
                if (type === 'number' || type === 'string' || type === 'boolean') return url.searchParams.append(key, value);
                if (type === 'object') return url.searchParams.append(key, JSON.stringify(value));
            });

            const response = await fetch(url, options);
            const contentType = response.headers.get("content-type");

            let body;
            if (contentType && contentType.includes("application/json")) body = await response.json();
            else body = await response.text();

            window.parent.postMessage({
                id,
                type: 'FETCH_RESPONSE',
                data: {
                    ok: response.ok,
                    status: response.status,
                    response: body
                }
            }, e.origin);
        } catch (error) {
            window.parent.postMessage({
                id,
                type: 'FETCH_RESPONSE',
                data: { ok: false, error: error.message }
            }, e.origin);
        }
    }
});

window.parent.postMessage({ type: 'BRIDGE_READY' }, "*");
