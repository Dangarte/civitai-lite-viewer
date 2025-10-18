const SW_CONFIG = {
    cache: {
        api: 'civitai_light-api-cache-v1',
        blurhash: 'civitai_light-blurhash-cache-v1',
        static: 'civitai_light-static-cache-v1',
        media: 'civitai_light-media-cache-v1'
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
        'model-preview': 12 * 60 * 60,      // Images in preview list on model page:    12 hours
        'model-version': 2 * 24 * 60 * 60,  // Info about model version:                 2 days
        'model-card': 24 * 60 * 60,         // Images in cards on models page:           1 day
        'user-image': 2 * 24 * 60 * 60,     // Images in creator profile:                2 days
        'full-image': 15 * 60,              // Images on full size image page:          15 mins
        'image-card': 30 * 60,              // Images images list:                      30 mins
        'unknown': 60 * 60,                 // Unknown target:                           1 hour
        'large-file': 15 * 60,              // Large files (14+ mb)                     15 mins
        'lite-viewer': 5 * 24 * 60 * 60,    // Files from repo                           5 days
        'lite-viewer-core': 3 * 60,         // Main file from the repo (index.html)      3 mins
        'blur-hash': 30 * 60                // blurHash                                 30 mins
    },
    api_key: null,
    task_time_limit: 60000, // 1 minute
};
SW_CONFIG.local_urls = {
    base: `${SW_CONFIG.base_url}local`,
    blurHash: `${SW_CONFIG.base_url}local/blurhash`
};
const currentTasks = {};

self.addEventListener('activate', () => {
    Object.entries(SW_CONFIG.cache).forEach(([, cacheName]) => cleanExpiredCache({ cacheName }));
    caches.delete('civitai_light_cache_v2'); // Temporarily, remove old version
    self.clients.claim();
});
self.addEventListener('fetch', onFetch);
self.addEventListener('message', onMessage);


function onMessage(e) { // Messages
    const sendSuccess = response => {
        console.log(`${e?.data?.action ?? 'Unknown action'}: `, response);
    };
    const sendError = error => {
        console.error(`${e?.data?.action ?? 'Unknown action'}: `, error);
    };

    if (!e.isTrusted || e.origin !== SW_CONFIG.origin || !e.source || e.source.url.indexOf(SW_CONFIG.base_url) !== 0) {
        return sendError('Unknown sender.');
    }

    if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data)) {
        return sendError('Message Error. Invalid message format, must be an object.');
    }
    const { action, data } = e.data;

    if (currentTasks[action] !== undefined && currentTasks[action] + TASK_TIME_LIMIT > Date.now()) {
        return sendError(`Action '${action}' has already processing.`);
    }
    currentTasks[action] = Date.now();

    let actionPromise = null;
    if (action === 'Clear Cache') actionPromise = Promise.all(Object.entries(SW_CONFIG.cache).map(([, cacheName]) => cleanExpiredCache({ mode: data.mode,  urlMask: data.urlMask, cacheName })));
    else actionPromise = Promise.reject(`Undefined action: '${action}'`);
    actionPromise.then(sendSuccess).catch(sendError).finally(() => delete currentTasks[action]);

    return true;

}

function onFetch(e) { // Request interception
    if (e.request.url.indexOf(SW_CONFIG.local_urls.base) === 0) return e.respondWith(cacheGet(e.request));
    if (e.request.url.indexOf('https') === -1 || e.request.destination === 'video') return; // Allow only from https and skip video
    e.respondWith(cacheGet(e.request));
}

async function cacheFetch(request, cacheControl) {
    if (request.url.indexOf(SW_CONFIG.local_urls.base) === 0) return localFetch(request);

    let cacheName = SW_CONFIG.cache.media;
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    if (request.url.indexOf(SW_CONFIG.base_url) === 0) {
        if (!cacheControl) {
            if (url.pathname === '/civitai-lite-viewer/' || url.pathname === '/civitai-lite-viewer/index.html') {
                cacheControl = `max-age=${SW_CONFIG.ttl['lite-viewer-core']}`; // Cache for a 3 mins only 
            } else {
                cacheControl = `max-age=${SW_CONFIG.ttl['lite-viewer']}`;
            }
        }
        cacheName = SW_CONFIG.cache.static;
    } else if (request.url.indexOf(SW_CONFIG.api_url) === 0) {
        cacheName = SW_CONFIG.cache.api;
    } else if (request.url.indexOf(SW_CONFIG.images_url) === 0 || ['model-preview', 'model-card', 'user-image', 'full-image', 'image-card'].includes(params.target) ) {
        cacheName = SW_CONFIG.cache.media;
    }

    if (!cacheControl && url.pathname.indexOf('/model-versions/') !== -1) cacheControl = `max-age=${SW_CONFIG.ttl['model-version']}`;

    // if (params.original) {
    //     const u = new URL(url, self.location.origin);
    //     u.searchParams.delete("original");
    //     const editedRequest = cloneRequestWithModifiedUrl(request, u.toString());
    //     return cacheGet(editedRequest);
    // }

    try {
        const before = url.searchParams.size;
        for (const key of SW_CONFIG.local_params) url.searchParams.delete(key); // Removing unnecessary parameters
        const after = url.searchParams.size;
        const modified = before !== after;
        const requestWithoutLocalParams = modified ? cloneRequestWithModifiedUrl(request, url.toString()) : null;
        const fetchResponse = await fetch(modified ? requestWithoutLocalParams : request);
        if (!fetchResponse.ok) return fetchResponse; // Don't try to cache the response with an error

        let blob = await fetchResponse.blob();
        const customHeaders = [];

        if (!cacheControl) {
            if (blob.type === 'application/json') {
                cacheControl = request.method === 'GET' ? 'max-age=60' : 'no-cache'; // Agressive caching for 1 minute (only GET requests)
            }
            else {
                const maxAge = blob.size < 15000000 ? SW_CONFIG.ttl[params?.target] ?? SW_CONFIG.ttl.unknown : SW_CONFIG.ttl['large-file'];
                cacheControl = `max-age=${maxAge}`;
            }
        }

        const forceDisableAnimation = request.url.includes(',anim=false,');
        if (blob.type.indexOf('image/') === 0 && ((params && (params.width || params.height || params.format)) || forceDisableAnimation)) {
            // Store original
            // if (await isImageAnimated(blob)) {
            //     const originalResponse = responseFromBlob(blob, cacheControl);
            //     const editedUrl = request.url.includes('?') ? `${request.url}&original=true` : `${request.url}?original=true`;
            //     const editedRequest = cloneRequestWithModifiedUrl(request, editedUrl);
            //     if (params?.cache !== 'no-cache' && cacheControl !== 'no-cache') cachePut(editedRequest, originalResponse, cacheName);
            //     customHeaders.push([ 'X-Animated', true ]);
            // }

            const { width, height , format, quality, fit } = params;
            const resizedBlob = (await resizeBlobImage(blob, { width, height, quality, format: format || (forceDisableAnimation ? 'webp' : undefined), fit }));
            blob = resizedBlob || blob;
        }

        const response = responseFromBlob(blob, cacheControl);
        if (customHeaders.length) customHeaders.forEach(([k, v]) => response.headers.set(k, v));
        if (params?.cache !== 'no-cache' && cacheControl !== 'no-cache') cachePut(request, response.clone(), cacheName);
        return response;
    } catch (_) {
        console.error(_);
        if (request.url.indexOf('transcode=true') !== -1 && request.url.indexOf('.jpeg') !== -1) {
            console.log('Trying to download an image without the transcode=true attribute (Probably a GIF)');
            const newREquest = cloneRequestWithModifiedUrl(request, `${request.url.replace(/transcode=true,?/, '')}&cache=no-cache`);
            const response = await cacheFetch(newREquest, cacheControl);
            cachePut(request, response.clone(), cacheName);
            return response;
        }
        return new Response('', { status: 500, statusText: 'Network Error' });
    }
}

async function localFetch(request) {
    if (request.url.indexOf(SW_CONFIG.local_urls.blurHash) === 0) {
        const { hash, width = 32, height = 32, punch = 1 } = Object.fromEntries(new URLSearchParams(request.url.substring(request.url.indexOf('?') + 1)));
        const blob = await blurhashToImageBlob(hash, Number(width), Number(height), Number(punch));
        const response = responseFromBlob(blob, `max-age=${SW_CONFIG.ttl['blur-hash']}`);
        cachePut(request, response.clone(), SW_CONFIG.cache.blurhash);
        return response;
    }
    return new Response('', { status: 500, statusText: 'Unknown local URL' });
}

async function resizeBlobImage(blob, options) { // Resize image blob
    const { width: targetWidth, height: targetHeight, format: targetFormat, quality: targetQuality = 0.97, fit = 'crop', position = 'center', smoothing = 'low' } = options; // fit: contain|scale-up|fill|crop; smoothing: none|low|medium|high;
    const types = { jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png', avif: 'image/avif' };
    if (!targetFormat && (await isImageAnimated(blob))) return null;
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

function responseFromBlob(blob, cacheControl) {
    return new Response(blob, { headers: { 'Content-Type': blob.type, 'Content-Length': blob.size, ...(cacheControl ? { 'Cache-Control': cacheControl, 'Date': new Date().toUTCString() } : {}) } });
}

async function blurhashToImageBlob(blurhash, width = 32, height = 32, punch = 1) {
    // https://github.com/mad-gooze/fast-blurhash/blob/main/index.js
    const digitLookup = new Uint8Array(128);
    for (let i = 0; i < 83; i++) {
        digitLookup['0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'.charCodeAt(i)] = i;
    }
    const decode83 = (str, start, end) => {
        let value = 0;
        while (start < end) {
            value = value * 83 + digitLookup[str.charCodeAt(start++)];
        }
        return value;
    };

    const pow = Math.pow;
    const PI = Math.PI;
    const PI2 = PI * 2;
    const d = 3294.6;
    const e = 269.025;
    const sRGBToLinear = value => value > 10.31475 ? pow(value / e + 0.052132, 2.4) : value / d;
    const linearTosRGB = v => ~~(v > 0.00001227 ? e * pow(v, 0.416666) - 13.025 : v * d + 1);
    const signSqr = x => x < 0 ? - x * x : x * x;

    /**
     * Fast approximate cosine implementation
     * Based on FTrig https://github.com/netcell/FTrig
     */
    const fastCos = (x) => {
        x = ((x + PI * 1.5) % PI2 + PI2) % PI2 - PI;
        const cos = 1.27323954 * x - 0.405284735 * signSqr(x);
        return 0.225 * (signSqr(cos) - cos) + cos;
    };

    function getBlurHashAverageColor(blurHash) {
        const val = decode83(blurHash, 2, 6);
        return [val >> 16, (val >> 8) & 255, val & 255];
    }

    function decodeBlurHash(blurHash, width, height, punch) {
        const sizeFlag = decode83(blurHash, 0, 1);
        const numX = (sizeFlag % 9) + 1;
        const numY = ~~(sizeFlag / 9) + 1;
        const size = numX * numY;

        let i = 0,
            j = 0,
            x = 0,
            y = 0,
            r = 0,
            g = 0,
            b = 0,
            basis = 0,
            basisY = 0,
            colorIndex = 0,
            pixelIndex = 0,
            value = 0;

        const maximumValue = ((decode83(blurHash, 1, 2) + 1) / 13446) * (punch | 1);

        const colors = new Float32Array(size * 3);

        const averageColor = getBlurHashAverageColor(blurHash);
        for (i = 0; i < 3; i++) {
            colors[i] = sRGBToLinear(averageColor[i]);
        }

        for (i = 1; i < size; i++) {
            value = decode83(blurHash, 4 + i * 2, 6 + i * 2);
            colors[i * 3] = signSqr(~~(value / 361) - 9) * maximumValue;
            colors[i * 3 + 1] = signSqr((~~(value / 19) % 19) - 9) * maximumValue;
            colors[i * 3 + 2] = signSqr((value % 19) - 9) * maximumValue;
        }

        const cosinesY = new Float32Array(numY * height);
        const cosinesX = new Float32Array(numX * width);
        for (j = 0; j < numY; j++) {
            for (y = 0; y < height; y++) {
                cosinesY[j * height + y] = fastCos((PI * y * j) / height);
            }
        }
        for (i = 0; i < numX; i++) {
            for (x = 0; x < width; x++) {
                cosinesX[i * width + x] = fastCos((PI * x * i) / width);
            }
        }

        const bytesPerRow = width * 4;
        const pixels = new Uint8ClampedArray(bytesPerRow * height);

        for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
                r = g = b = 0;
                for (j = 0; j < numY; j++) {
                    basisY = cosinesY[j * height + y];
                    for (i = 0; i < numX; i++) {
                        basis = cosinesX[i * width + x] * basisY;
                        colorIndex = (i + j * numX) * 3;
                        r += colors[colorIndex] * basis;
                        g += colors[colorIndex + 1] * basis;
                        b += colors[colorIndex + 2] * basis;
                    }
                }

                pixelIndex = 4 * x + y * bytesPerRow;
                pixels[pixelIndex] = linearTosRGB(r);
                pixels[pixelIndex + 1] = linearTosRGB(g);
                pixels[pixelIndex + 2] = linearTosRGB(b);
                pixels[pixelIndex + 3] = 255; // alpha
            }
        }
        return pixels;
    }

    const pixels = decodeBlurHash(blurhash, width, height, punch);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(pixels, width, height);
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob;
}

async function cleanExpiredCache({ cacheName, mode = 'max-age-expired', urlMask = null } = {}) { // Check and remove all old data (max-age expired)
    if (mode === 'all') {
        await caches.delete(cacheName);
        return `Cache ${cacheName} removed`;
    }

    const cache = await caches.open(cacheName);
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
                        ? r => r && checkCacheMaxAge(r)     // Remove only with expired max-age (default)
                        : r => r && checkCacheMaxAge(r);    // Remove only with expired max-age (unknown)

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

    return `Cache ${cacheName} cleared, ${countRemoved} element(s) removed`;
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

function checkCacheMaxAge(cached) {
    const date = cached.headers.get('Date');
    const cacheControl = cached.headers.get('Cache-Control');
    if (!date) console.warn('No Date Header in cached response!');
    if (date && cacheControl && cacheControl !== 'no-cache') {
        const age = (Date.now() - new Date(date).getTime()) / 1000;
        const maxAge = parseInt(cacheControl.substring(cacheControl.indexOf('=') + 1));
        if (age <= maxAge) return true;
    }
    return false;
}

async function cacheGet(request) { // Get response from cache
    const cached = await caches.match(request);
    if (cached && checkCacheMaxAge(cached)) return cached;
    return cacheFetch(request);
}

async function cachePut(request, response, cacheName) { // Put response in cache
    const cache = await caches.open(cacheName);
    return await cache.put(request, response);
}
