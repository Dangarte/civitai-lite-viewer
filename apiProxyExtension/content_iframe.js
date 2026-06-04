"use strict";

// Clean iframe
window.stop();
document.documentElement.innerHTML = '<!DOCTYPE html><html><head><title>Proxy Bridge</title></head><body></body></html>';

// Bridge thingy
const ORIGINS = [
    "https://dangarte.github.io"
];
const CIVITAI_ORIGIN = "https://civitai.red";
const CIVITAI_TRPC = "/api/trpc/";
const CIVITAI_TRPC_ROUTES = [
    'model.getAll',
    'model.getById',
    'model.getCollectionShowcase', // not used now
    'model.getAssociatedResourcesCardData', // not used now
    'modelVersion.getById',
    'collection.getById',
    'post.get',
    'post.getResources', // not used now
    'comment.getAll',
    'comment.getById',
    'commentv2.getInfinite',
    'tag.getVotableTags',
    'image.get',
    'image.getGenerationData',
    'image.getInfinite',
    'article.getInfinite',
    'article.getById',
];

window.addEventListener('message', async e => {
    if (!ORIGINS.includes(e.origin)) {
        console.log(`[API Bridge] Unknown origin "${e.origin}"`);
        return;
    }
    const { id, type, route, params } = e.data;
    if (type !== 'FETCH_REQUEST') return;

    const sendResponse = data => {
        window.parent.postMessage({ id, type: 'FETCH_RESPONSE', data }, e.origin);
    };

    if (!CIVITAI_TRPC_ROUTES.includes(route)) {
        console.log(`[API Bridge] The route "${route}" is not on the white list`);
        return sendResponse({ ok: false, error: "Forbidden route", route });
    }

    try {
        const url = new URL(`${CIVITAI_TRPC}${route}`, CIVITAI_ORIGIN);

        // tRPC
        if (params && params.input) {
            const inputData = params.input;
            if (inputData.json && typeof inputData.json === 'object') {
                // Cookies are forced into requests via SW, so there is authorization there.
                if (typeof inputData.json.authed !== 'boolean') inputData.json.authed = true;
            }
            // tRPC expects ?input={"json":{...}}
            url.searchParams.append('input', JSON.stringify(inputData));
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        const contentType = response.headers.get("content-type");

        let body;
        if (contentType?.includes("application/json")) body = await response.json();
        else body = await response.text();

        sendResponse({
            ok: response.ok,
            status: response.status,
            response: body
        });
    } catch (error) {
        sendResponse({ ok: false, error: error.message });
    }
});

window.parent.postMessage({ type: 'BRIDGE_READY' }, "*");
