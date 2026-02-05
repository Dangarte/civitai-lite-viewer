const SW_CONFIG = {
    cache: {
        api: 'civitai_light-api-cache-v1',
        blurhash: 'civitai_light-blurhash-cache-v1',
        static: 'civitai_light-static-cache-v1',
        media: 'civitai_light-media-cache-v1',
        mediafull: 'civitai_light-mediafull-cache-v1',
        mediathumbs: 'civitai_light-mediathumbs-cache-v1'
    },
    immutableCaches: [
        'media', 'mediathumbs', 'blurhash'
    ],
    cacheByTarget: {
        'model-preview': 'media',
        'model-card': 'mediathumbs',
        'user-image': 'media',
        'full-image': 'mediafull',
        'image-card': 'mediathumbs'
    },
    // base_url: 'http://127.0.0.1:3000/',
    // origin: 'http://127.0.0.1:3000',
    base_url: 'https://dangarte.github.io/civitai-lite-viewer/',
    origin: 'https://dangarte.github.io',
    images_url: 'https://image.civitai.com/',
    api_url: 'https://civitai.com/api/v1/',
    local_urls: {},
    local_params: [ 'target', 'original', 'cache', 'width', 'height', 'fit', 'format', 'quality', 'smoothing', 'position' ], // Parameters to remove when fetching (they were added only for passing parameters from the page to the sw)
    ttl: {
        'model-preview': 6 * 60 * 60,       // Images in preview list on model page:     6 hours
        'model-version': 2 * 24 * 60 * 60,  // Info about model version:                 2 days
        'image-meta': 30 * 60,              // Info about image (loaded separately):    30 mins
        'model-card': 12 * 60 * 60,         // Images in cards on models page:          12 hours
        'user-image': 24 * 60 * 60,         // Images in creator profile:                1 day
        'full-image': 60 * 60,              // Images on full size image page:           1 hour
        'image-card': 30 * 60,              // Images images list:                      30 mins
        'unknown': 60 * 60,                 // Unknown target:                           1 hour
        'large-file': 15 * 60,              // Large files (14+ mb)                     15 mins
        'lite-viewer': 5 * 24 * 60 * 60,    // Files from repo                           5 days
        'lite-viewer-core': 3 * 60,         // Main file from the repo (index.html)      3 mins
        'blurhash': 30 * 60                 // blurhash                                 30 mins
    },
    api_key: null,
    task_time_limit: 60000, // 1 minute
};
SW_CONFIG.local_urls = {
    base: `${SW_CONFIG.base_url}local`,
    blurhash: `${SW_CONFIG.base_url}local/blurhash`
};
SW_CONFIG.immutableCaches = SW_CONFIG.immutableCaches.map(k => SW_CONFIG.cache[k]);
SW_CONFIG.validTargets = new Set([...Object.keys(SW_CONFIG.cacheByTarget), ...Object.keys(SW_CONFIG.ttl)]);

self.addEventListener('activate', () => {
    Object.entries(SW_CONFIG.cache).forEach(([, cacheName]) => CacheManager.cleanExpiredCache({ cacheName }));
    self.clients.claim();
});
self.addEventListener('fetch', onFetch);
self.addEventListener('message', onMessage);


class TaskController {
    constructor() {
        this.taskQueues = new Map();
    }

    runTask(name, taskFn, timeoutMs) {
        if (typeof taskFn !== 'function') return Promise.reject(new Error('taskFn must be a function'));

        // The last task from the queue or an empty promise
        const lastPromise = this.taskQueues.get(name) || Promise.resolve();

        // A new task that will be executed after lastPromise
        const newPromise = lastPromise.catch(() => {}).then(() => this.#runWithTimeout(taskFn, name, timeoutMs));

        const trackedPromise = newPromise.finally(() => {
            // If the current promise is still the last one in the queue, delete it
            if (this.taskQueues.get(name) === trackedPromise) this.taskQueues.delete(name);
        });

        // Updating the queue
        this.taskQueues.set(name, trackedPromise);

        return trackedPromise;
    }

    #runWithTimeout(taskFn, name, timeoutMs) {
        const taskPromise = Promise.resolve().then(() => taskFn());

        const timeoutPromise = new Promise((_, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Task "${name}" timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            taskPromise.finally(() => clearTimeout(timer));
        });

        return Promise.race([taskPromise, timeoutPromise]);
    }
}

const taskController = new TaskController();

function onMessage(e) { // Messages
    const sendSuccess = response => {
        if (e.ports?.[0]) e.ports[0].postMessage({ ok: true, response });
    };
    const sendError = error => {
        console.error(`${e?.data?.action ?? 'Unknown action'}: `, error);
        if (e.ports?.[0]) e.ports[0].postMessage({ ok: false, error });
    };

    if (!e.isTrusted || e.origin !== SW_CONFIG.origin || !e.source || e.source.url.indexOf(SW_CONFIG.base_url) !== 0) {
        return sendError('Unknown sender.');
    }

    if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data)) {
        return sendError('Message Error. Invalid message format, must be an object.');
    }
    const { action, data } = e.data;

    let actionCallback = null;
    if (action === 'clear_cache') actionCallback = () => actionClearCache(data);
    else actionCallback = () => Promise.reject(`Undefined action: '${action}'`);

    const promise = taskController.runTask(action, actionCallback, SW_CONFIG.task_time_limit);
    promise.then(sendSuccess).catch(sendError);

    return true;
}

function onFetch(e) { // Request interception
    if (e.request.url.startsWith(SW_CONFIG.local_urls.base)) {
        const cacheName = e.request.url.startsWith(SW_CONFIG.local_urls.blurhash) ? SW_CONFIG.cache.blurhash : null;
        const response = CacheManager.get(e.request, cacheName);
        return e.respondWith(response);
    }
    if (!e.request.url.startsWith('https:') || e.request.destination === 'video') return; // Allow only from https and skip video

    // search in specific cache
    let response;
    if (e.request.url.startsWith(SW_CONFIG.base_url)) response = CacheManager.get(e.request, SW_CONFIG.cache.static, { event: e, SWR: true });
    else if (e.request.url.startsWith(SW_CONFIG.api_url)) response = CacheManager.get(e.request, SW_CONFIG.cache.api);
    else if (e.request.url.startsWith(SW_CONFIG.images_url)) {
        const target = getTargetFromUrl(e.request.url);
        const cacheName = SW_CONFIG.validTargets.has(target) ? SW_CONFIG.cache[SW_CONFIG.cacheByTarget[target] ?? 'media'] : SW_CONFIG.cache.media;
        response = CacheManager.get(e.request, cacheName);
    } else response = CacheManager.get(e.request);

    e.respondWith(response);
}

function actionClearCache(data) {
    const cacheKeys = Object.values(SW_CONFIG.cache);
    const promises = cacheKeys.map(cacheName => CacheManager.cleanExpiredCache({ mode: data.mode,  urlMask: data.urlMask, cacheName }));
    return Promise.all(promises).then(result => ({ countRemoved: result.reduce((c, response) => c + response.countRemoved, 0) }));
}

async function cacheFetch(request, cacheControl = { public: true }) {
    if (request.url.startsWith(SW_CONFIG.local_urls.base)) return localFetch(request);

    let cacheName = SW_CONFIG.cache.media;
    const url = new URL(request.url);
    const sParams = url.searchParams;
    const params = Object.fromEntries(url.searchParams.entries());
    let specialFetch = fetch;

    if (request.url.startsWith(SW_CONFIG.base_url)) {
        cacheName = SW_CONFIG.cache.static;
        if (!cacheControl.maxAge) {
            const isCore = url.pathname === '/civitai-lite-viewer/' || url.pathname === '/civitai-lite-viewer/index.html';
            cacheControl.maxAge = isCore ? SW_CONFIG.ttl['lite-viewer-core'] : SW_CONFIG.ttl['lite-viewer'];
        }
    } else if (request.url.startsWith(SW_CONFIG.api_url)) {
        cacheName = SW_CONFIG.cache.api;
        if (!cacheControl.maxAge) {
            if (url.pathname.includes('/model-versions/')) cacheControl.maxAge = SW_CONFIG.ttl['model-version'];
            else if (url.pathname.endsWith('/images') && params.imageId) {
                cacheControl.maxAge = SW_CONFIG.ttl['image-meta'];
                if (!params.nsfw) specialFetch = fetchImageWithUnknownNSFW;
            }
        }
    } else if (request.url.startsWith(SW_CONFIG.images_url)) {
        cacheName = SW_CONFIG.validTargets.has(params.target) ? SW_CONFIG.cache[SW_CONFIG.cacheByTarget[params.target] ?? 'media'] : SW_CONFIG.cache.media;
    }

    // if (params.original) {
    //     const u = new URL(url, self.location.origin);
    //     u.searchParams.delete("original");
    //     const editedRequest = cloneRequestWithModifiedUrl(request, u.toString());
    //     return CacheManager.get(editedRequest);
    // }

    try {
        const before = sParams.size;
        for (const key of SW_CONFIG.local_params) sParams.delete(key); // Removing unnecessary parameters
        const after = sParams.size;
        const modified = before !== after;
        const requestWithoutLocalParams = modified ? cloneRequestWithModifiedUrl(request, url.toString()) : null;
        const fetchResponse = await specialFetch(modified ? requestWithoutLocalParams : request);
        if (!fetchResponse.ok) return fetchResponse; // Don't try to cache the response with an error

        let blob = await fetchResponse.blob();
        const customHeaders = [];

        if (!cacheControl.maxAge) {
            if (blob.type === 'application/json') {
                if (request.method === 'GET') cacheControl.maxAge = 'max-age=60'; // Agressive caching for 1 minute (only GET requests)
                else cacheControl.noCache = true;
            }
            else if (blob.size < 15000000) {
                const maxAge = SW_CONFIG.validTargets.has(params.target) ? SW_CONFIG.ttl[params.target] ?? SW_CONFIG.ttl.unknown : SW_CONFIG.ttl.unknown;
                cacheControl.maxAge = maxAge;
            } else cacheControl.maxAge = SW_CONFIG.ttl['large-file'];
        }

        const forceDisableAnimation = request.url.includes(',anim=false,');
        if (blob.type.startsWith('image/') && (params.width || params.height || params.format || forceDisableAnimation)) {
            // Store original
            // if (await isImageAnimated(blob)) {
            //     const originalResponse = responseFromBlob(blob, cacheControl);
            //     const editedUrl = request.url.includes('?') ? `${request.url}&original=true` : `${request.url}?original=true`;
            //     const editedRequest = cloneRequestWithModifiedUrl(request, editedUrl);
            //     if (params.cache !== 'no-cache' && !cacheControl.noCache) CacheManager.put(editedRequest, originalResponse, cacheName);
            //     customHeaders.push([ 'X-Animated', true ]);
            // }

            const { width, height , format, quality, fit } = params;
            const forceFormat = forceDisableAnimation && !format ? await isImageAnimated(blob) : false;
            const options = { width, height, quality, format: format || (forceFormat ? 'webp' : undefined), fit };
            const resizedBlob = (await ImageResizeQueue.run(blob, options));
            // const resizedBlob = (await resizeBlobImage(blob, options));
            blob = resizedBlob || blob;
        }

        if (!cacheControl.noCache) cacheControl.immutable = SW_CONFIG.immutableCaches.includes(cacheName);
        const response = responseFromBlob(blob, cacheControl);
        if (customHeaders.length) customHeaders.forEach(([k, v]) => response.headers.set(k, v));
        if (params.cache !== 'no-cache' && !cacheControl.noCache) CacheManager.put(request, response.clone(), cacheName);
        return response;
    } catch (_) {
        console.error(_);
        if (request.url.indexOf('transcode=true') !== -1 && request.url.indexOf('.jpeg') !== -1) {
            console.log('Trying to download an image without the transcode=true attribute (Probably a GIF)');
            const newREquest = cloneRequestWithModifiedUrl(request, `${request.url.replace(/transcode=true,?/, '')}&cache=no-cache`);
            const response = await cacheFetch(newREquest, cacheControl);
            CacheManager.put(request, response.clone(), cacheName);
            return response;
        }
        return new Response('', { status: 500, statusText: 'Network Error' });
    }
}

// bs:
    //   to get an image you need to know its nsfw level,
    //   but to find out this level you need to get an image...
    //   result: you need to spam requests with all possible options...
    //   what nonsense...
async function fetchImageWithUnknownNSFW(request) {
    // const nsfwLevels = [ 'None', 'Soft', 'Mature', 'X' ];
    const nsfwLevels = ['None', 'X'];

    const fetches = nsfwLevels.map(nsfw => {
        const url = new URL(request.url);
        url.searchParams.set('nsfw', nsfw);

        const req = cloneRequestWithModifiedUrl(request, url.toString());

        return fetch(req)
            .then(async response => {
                let body = null;
                try { body = await response.clone().json(); } catch(_) {}
                return { response, body };
            });
    });

    const results = await Promise.all(fetches);
    const hit = results.find(r => r.body?.items?.length);
    if (!hit) throw new Error('Image not found for any NSFW level');

    return hit.response;
}


async function localFetch(request) {
    if (request.url.startsWith(SW_CONFIG.local_urls.blurhash)) {
        const { hash, width = 32, height = 32, punch = 1 } = Object.fromEntries(new URLSearchParams(request.url.substring(request.url.indexOf('?') + 1)));

        const response = createBlurhashResponse(hash, +width, +height, punch);

        CacheManager.put(request, response.clone(), SW_CONFIG.cache.blurhash);
        return response;
    }
    return new Response('', { status: 500, statusText: 'Unknown local URL' });
}

function createBlurhashResponse(hash, width, height, punch) {
    const pixels = blurhashToPixelsBGRA(hash, width, height, punch);

    const size = pixels.length;
    const totalSize = 54 + size;
    const buffer = new ArrayBuffer(totalSize);
    const v = new DataView(buffer);

    v.setUint16(0, 0x4D42, true); v.setUint32(2, totalSize, true); v.setUint32(10, 54, true);
    v.setUint32(14, 40, true); v.setInt32(18, width, true); v.setInt32(22, -height, true);
    v.setUint16(26, 1, true); v.setUint16(28, 32, true); v.setUint32(30, 0, true); v.setUint32(34, size, true);

    new Uint8Array(buffer, 54).set(pixels);
    return new Response(buffer, { headers: { 'Content-Type': 'image/bmp', 'Content-Length': totalSize, 'Cache-Control': `public, max-age=${SW_CONFIG.ttl['blurhash']}, immutable`, 'Date': new Date().toUTCString() } });
}

async function resizeBlobImage(blob, options) { // Resize image blob
    const { width: targetWidth, height: targetHeight, format: targetFormat, quality: targetQuality = 0.97, fit = 'crop', position = 'center', smoothing = 'low' } = options; // fit: contain|scale-up|fill|crop; smoothing: none|low|medium|high;
    const types = { jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png', avif: 'image/avif' };
    if (
        blob.type === 'image/svg+xml'
        || (
            !targetFormat
            && ((await isImageAnimated(blob)) || (!targetWidth && !targetHeight))
        )
    ) return null;
    try {
        const bmp = await createImageBitmap(blob);
        const { width, height } = bmp;
        const originalRatio = width / height;
        let cropWidth = width, cropHeight = height, offsetX = 0, offsetY = 0, newWidth = targetWidth ?? (targetHeight ? Math.round(targetHeight * originalRatio) : width), newHeight = targetHeight ?? (targetWidth ? Math.round(targetWidth / originalRatio) : height);

        if ((fit === 'scale-up' || fit === 'contain') && targetWidth && targetHeight) {
            const scaleX = targetWidth / width;
            const scaleY = targetHeight / height;
            const scale = fit === 'scale-up' ? Math.max(1, Math.min(scaleX, scaleY)) : Math.min(scaleX, scaleY);
            newWidth = Math.round(width * scale);
            newHeight = Math.round(height * scale);
        }

        const newRatio = newWidth / newHeight;
        if (fit !== 'fill' && (targetWidth || targetHeight) && Math.abs(originalRatio - newRatio) >= .001) {
            cropWidth = Math.min(width, Math.round(height * newRatio));
            cropHeight = Math.min(height, Math.round(width / newRatio));
            offsetX = Math.round((width - cropWidth) / 2);
            offsetY = Math.round((height - cropHeight) / 2);
        }

        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext('2d');
        if (smoothing === 'none') {
            ctx.imageSmoothingEnabled = false;
        } else {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = [ 'low', 'medium', 'high' ].includes(smoothing) ? smoothing : 'low';
        }
        ctx.drawImage(bmp, offsetX, offsetY, cropWidth, cropHeight, 0, 0, newWidth, newHeight);
        bmp.close();

        return await canvas.convertToBlob({ type: types[targetFormat] ?? blob.type, quality: targetQuality });
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function isImageAnimated(blob) {
    if (blob.type === 'image/apng') return true;
    if (!([ 'image/avif', 'image/gif', 'image/webp' ].includes(blob.type))) return false;
    const buffer = await blob.slice(0, 512).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();

    if (blob.type === 'image/webp' && decoder.decode(bytes.slice(0, 4)) === 'RIFF' && decoder.decode(bytes.slice(8, 12)) === 'WEBP') {
        for (let i = 12; i < bytes.length - 4; i++) {
            const chunk = String.fromCharCode(...bytes.slice(i, i + 4));
            if (chunk === "ANIM" || chunk === "ANMF") return true;
        }
        return false;
    }
    if (blob.type === 'image/avif' && decoder.decode(bytes.slice(0, 4)) === 'ftyp' && decoder.decode(bytes.slice(4, 8)) === 'avif') {
        const avifFlags = bytes.slice(12, 16);
        if (avifFlags[0] === 0x01) return true;
        return false;
    }
    if (blob.type === 'image/gif' && decoder.decode(bytes.slice(0, 3)) === 'GIF') {
        const gifHeader = decoder.decode(bytes.slice(3, 6));
        if (gifHeader === '89a') {
            const logicalScreenDescriptor = bytes.slice(6, 13);
            const gifFlags = logicalScreenDescriptor[4];
            if ((gifFlags & 0b10000000) !== 0) return true;
        }
        return false;
    }
    return false;
}

function getTargetFromUrl(url) {
    const start = url.indexOf('target=');
    if (start === -1) return null;

    const sub = url.substring(start + 7);
    const end = sub.indexOf('&');
    return end === -1 ? sub : sub.substring(0, end);
}

function responseFromBlob(blob, cacheControl) {
    const headers = { 'Content-Type': blob.type, 'Content-Length': blob.size, 'Date': new Date().toUTCString() };
    if (cacheControl) {
        if (cacheControl.noCache) headers['Cache-Control'] = cacheControl;
        else {
            const v = [];
            if (cacheControl.public) v.push('public');
            if (cacheControl.maxAge) v.push(`max-age=${cacheControl.maxAge}`);
            if (cacheControl.immutable) v.push('immutable');
            headers['Cache-Control'] = v.join(', ');
        }
    }
    return new Response(blob, { headers });
}

function blurhashToPixelsBGRA(hash, width = 32, height = 32, punch = 1) {
    const lookup = new Uint8Array(128);
    for (let i = 0; i < 83; i++) {
        lookup['0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'.charCodeAt(i)] = i;
    }

    const decode83 = (str, start, end) => {
        let val = 0;
        while (start < end) val = val * 83 + lookup[str.charCodeAt(start++)];
        return val;
    };

    const sizeFlag = decode83(hash, 0, 1);
    const numX = (sizeFlag % 9) + 1;
    const numY = ~~(sizeFlag / 9) + 1;
    const size = numX * numY;
    const maxVal = ((decode83(hash, 1, 2) + 1) / 13446) * (punch | 1);

    const colors = new Float32Array(size * 3);
    const avg = decode83(hash, 2, 6);

    const sRGBToLinear = v => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };

    const linearTosRGB = v => {
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        return ~~(v > 0.0031308 ? 255 * (1.055 * Math.pow(v, 0.416666) - 0.055) : v * 3294.6 + 0.5);
    };

    colors[0] = sRGBToLinear(avg >> 16);
    colors[1] = sRGBToLinear((avg >> 8) & 255);
    colors[2] = sRGBToLinear(avg & 255);

    for (let i = 1; i < size; i++) {
        const v = decode83(hash, 4 + i * 2, 6 + i * 2);
        const i3 = i * 3;
        const x = ~~(v / 361) - 9;
        const y = (~~(v / 19) % 19) - 9;
        const z = (v % 19) - 9;
        colors[i3] = (x < 0 ? -x * x : x * x) * maxVal;
        colors[i3 + 1] = (y < 0 ? -y * y : y * y) * maxVal;
        colors[i3 + 2] = (z < 0 ? -z * z : z * z) * maxVal;
    }

    const cosX = new Float32Array(width * numX);
    for (let i = 0; i < numX; i++) {
        for (let x = 0; x < width; x++) {
            cosX[i * width + x] = Math.cos((Math.PI * x * i) / width);
        }
    }

    const cosY = new Float32Array(height * numY);
    for (let j = 0; j < numY; j++) {
        for (let y = 0; y < height; y++) {
            cosY[j * height + y] = Math.cos((Math.PI * y * j) / height);
        }
    }

    const tmp = new Float32Array(width * numY * 3);
    for (let j = 0; j < numY; j++) {
        const jOffset = j * width * 3;
        const colorOffset = j * numX * 3;
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < numX; i++) {
                const basisX = cosX[i * width + x];
                const cIdx = colorOffset + i * 3;
                r += colors[cIdx] * basisX;
                g += colors[cIdx + 1] * basisX;
                b += colors[cIdx + 2] * basisX;
            }
            const tIdx = jOffset + x * 3;
            tmp[tIdx] = r;
            tmp[tIdx + 1] = g;
            tmp[tIdx + 2] = b;
        }
    }

    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        const pixelRowOffset = y * width * 4;
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let j = 0; j < numY; j++) {
                const basisY = cosY[j * height + y];
                const tIdx = (j * width + x) * 3;
                r += tmp[tIdx] * basisY;
                g += tmp[tIdx + 1] * basisY;
                b += tmp[tIdx + 2] * basisY;
            }

            // BMP expects Little-Endian order for 32-bit: Blue, Green, Red, Alpha
            const pIdx = pixelRowOffset + x * 4;
            pixels[pIdx] = linearTosRGB(b);
            pixels[pIdx + 1] = linearTosRGB(g);
            pixels[pIdx + 2] = linearTosRGB(r);
            pixels[pIdx + 3] = 255;
        }
    }

    return pixels;
}

function cloneRequestWithModifiedUrl(originalRequest, newUrl) {
    const { method, headers, credentials, cache, redirect, referrer, integrity, keepalive } = originalRequest;
    let { mode } = originalRequest;
    if (mode === 'navigate') mode = 'same-origin'; // fix: Cannot construct a Request with a RequestInit whose mode member is set as 'navigate'.

    const init = { method, headers, mode, credentials, cache, redirect, referrer, integrity, keepalive };
    if (method !== 'GET' && method !== 'HEAD') {
        init.body = originalRequest.body;
        init.duplex = 'half';
    }
    return new Request(newUrl, init);
}

class ImageResizeQueue {
    static #queue = [];
    static #activeCount = 0;
    static #MAX_CONCURRENT = 2;

    static run(blob, options = {}) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ blob, options, size: blob.size, resolve, reject });
            this.#next();
        });
    }

    static async #next() {
        if (this.#activeCount >= this.#MAX_CONCURRENT || this.#queue.length === 0) return;

        // (Shortest Job First)
        let smallestIdx = 0;
        for (let i = 1; i < this.#queue.length; i++) {
            if (this.#queue[i].size < this.#queue[smallestIdx].size) {
                smallestIdx = i;
            }
        }

        const task = this.#queue.splice(smallestIdx, 1)[0];
        this.#activeCount++;

        try {
            const result = await resizeBlobImage(task.blob, task.options);
            task.resolve(result);
        } catch (error) {
            task.reject(error);
        } finally {
            this.#activeCount--;
            this.#next();
        }
    }
}

class CacheManager {
    static #cacheMap = new Map(); // stores open Cache objects
    static #hotCaches = [ SW_CONFIG.cache.blurhash, SW_CONFIG.cache.static ]; // cacheName
    static #hotCache = new Map(); // RAM cache (only for blurhash)

    // Get cache by name, open if not already open
    static async #getCache(cacheName) {
        if (!this.#cacheMap.has(cacheName)) {
            const cache = await caches.open(cacheName);
            this.#cacheMap.set(cacheName, cache);
        }
        return this.#cacheMap.get(cacheName);
    }

    // Get response from cache
    static async get(request, cacheName = null, options = { event: null, SWR: false, silent: false }) {
        let response;

        request = this.#clearRequest(request);

        const isHotCache = this.#isHotCache(cacheName);
        if (isHotCache) {
            const cached = this.#hotCache.get(request.url);
            if (cached) {
                if (Date.now() < cached.expireTime) {
                    return cached.response.clone();
                } else {
                    this.#hotCache.delete(request.url);
                }
            }
        }

        if (cacheName) {
            const cache = this.#cacheMap.get(cacheName) ?? await this.#getCache(cacheName);
            response = await cache.match(request);
        } else {
            response = await caches.match(request);
        }

        if (!response) response = await cacheFetch(request);
        else if (!this.#checkCacheMaxAge(response)) {
            if (!options?.SWR) response = await cacheFetch(request);
            else {
                (async () => {
                    const responseOld = response.clone();
                    const responseNew = await cacheFetch(request);
                    const clientId = options?.event?.clientId ?? null;
                    if (options?.silent || clientId === null) return;
                    if (await this.#compareResponses(responseOld, responseNew)) return;

                    const client = await self.clients.get(clientId);
                    if (!client) return;
                    client.postMessage({ type: 'CACHE_UPDATED', url: request.url });
                })();
                return response;
            }
        }

        if (isHotCache) this.#putInHotCache(request.url, response);

        return response;
    }

    // Cache the answer
    static async put(request, response, cacheName) {
        if (!cacheName) throw new Error('cacheName required for put');

        request = this.#clearRequest(request);

        if (this.#isHotCache(cacheName)) this.#putInHotCache(request.url, response);

        const cache = await this.#getCache(cacheName);
        await cache.put(request, response);

        return response;
    }

    static #clearRequest(request) {
        if (!request.url.includes('#')) return request;
        const url = new URL(request.url);
        if (!url.hash) return request;
        url.hash = '';
        return cloneRequestWithModifiedUrl(request, url.toString());
    }


    static async #compareResponses(responseOld, responseNew) {
        // Content-Length
        const lenOld = responseOld.headers.get('Content-Length');
        const lenNew = responseNew.headers.get('Content-Length');
        if (lenOld !== null && lenNew !== null && lenOld !== lenNew) return false;

        // arrayBuffer
        try {
            const bufferOld = await responseOld.clone().arrayBuffer();
            const bufferNew = await responseNew.clone().arrayBuffer();

            if (bufferOld.byteLength !== bufferNew.byteLength) return false;

            const viewOld = new Uint8Array(bufferOld);
            const viewNew = new Uint8Array(bufferNew);

            for (let i = 0; i < viewOld.length; i++) {
                if (viewOld[i] !== viewNew[i]) return false;
            }

            return true;
        } catch (error) {
            console.error('Error comparing responses:', error);
            return false;
        }
    }

    static #getMaxAge(cached) {
        const date = cached.headers.get('Date');
        const cacheControl = cached.headers.get('Cache-Control');
        if (!date) console.warn('No Date Header in cached response!');
        if (date && cacheControl && cacheControl !== 'no-cache') {
            return {
                maxAge: parseInt(cacheControl.substring(cacheControl.indexOf('=') + 1)),
                age: (Date.now() - new Date(date).getTime()) / 1000
            };
        }
        return { age: 1, maxAge: - 1 };
    }

    // Check ttl
    static #checkCacheMaxAge(cached) {
        const { age, maxAge } = this.#getMaxAge(cached);
        return age <= maxAge;
    }

    // Checking whether this URL should be cached in RAM
    static #isHotCache(cacheName) {
        return this.#hotCaches.includes(cacheName);
    }

    // Place the answer in RAM
    static #putInHotCache(url, response) {
        // Limit the Map size to avoid overflowing the SW memory
        if (this.#hotCache.size > 800) {
            const firstKey = this.#hotCache.keys().next().value;
            this.#hotCache.delete(firstKey);
        }

        const { age, maxAge } = this.#getMaxAge(response);

        this.#hotCache.set(url, {
            response: response.clone(),
            expireTime: Date.now() + (maxAge - age)
        });
    }

    // Check and remove all old data (max-age expired)
    static async cleanExpiredCache({ cacheName, mode = 'max-age-expired', urlMask = null } = {}) {
        if (mode === 'all') {
            const cache = await this.#getCache(cacheName);
            const keys = await cache.keys();
            const countRemoved = keys.length;
            await caches.delete(cacheName);
            this.#cacheMap.delete(cacheName);
            return {
                message: `Cache ${cacheName} removed`,
                cacheName,
                countRemoved
            };
        }

        const cache = await this.#getCache(cacheName);
        const keys = await cache.keys();

        const masks = Array.isArray(urlMask) ? urlMask : urlMask ? [urlMask] : [];
        const regexps = masks.map(mask => {
            if (/\\d|\[\w/.test(mask) || mask.startsWith('^')) {
                return new RegExp(mask);
            }

            const escaped = mask.replace(/[.+^${}()|[\]\\]/g, '\\$&');
            const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
            return new RegExp(regexStr);
        });

        const isResponseOk = mode === 'max-age-expired'
                            ? r => r && this.#checkCacheMaxAge(r)     // Remove only with expired max-age (default)
                            : r => r && this.#checkCacheMaxAge(r);    // Remove only with expired max-age (unknown)

        let countRemoved = 0;
        const promises = keys.map(async (request) => {
            const url = request.url;
            const matchesMask = regexps.length !== 0 && regexps.some(rx => rx.test(url));
            const response = await cache.match(request);
            if (!matchesMask && isResponseOk(response)) return;

            countRemoved++;
            return cache.delete(request);
        });

        await Promise.all(promises);

        return {
            message: `Cache ${cacheName} cleared, ${countRemoved} element(s) removed`,
            cacheName,
            countRemoved
        };
    }
}
