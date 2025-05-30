const SW_CONFIG = {
    cache: 'civitai_light_cache_v2',
    // base_url: 'http://127.0.0.1:3000/',
    // origin: 'http://127.0.0.1:3000',
    base_url: 'https://dangarte.github.io/civitai-lite-viewer/',
    origin: 'https://dangarte.github.io',
    images_url: 'https://image.civitai.com/',
    api_url: 'https://civitai.com/api/v1/',
    local_urls: {},
    cacheTargets: {
        'model-preview': 2 * 24 * 60 * 60,  // Images in preview list on model page:    2 days
        'model-card': 4 * 24 * 60 * 60,     // Images in cards on models page:          4 days
        'user-image': 6 * 24 * 60 * 60,  // Images in creator profile:               6 days
        'full-image': 2 * 60 * 60,          // Images on full size image page:          2 hours
        'image-card': 2 * 60 * 60,          // Images images list:                      2 hours
        'unknown': 60 * 60,                 // Unknown target:                          1 hour
        'large-file': 15 * 60,              // Dont store large files (14+ mb) longer than 15 minutes
        'lite-viewer': 7 * 24 * 60 * 60,    // Files from repo
        'lite-viewer-core': 3 * 60,         // Main files from the repo (index.html, service_worker.js)
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
    cleanExpiredCache();
    caches.delete('civitai_light_cache_v1'); // Temporarily, remove old version, crooked, cache
    self.clients.claim();
});
self.addEventListener('fetch', onFetch);
self.addEventListener('message', onMessage);
  

function onMessage(e) { // Messages
    const sendSuccess = response => {
        console.log(response);
    };
    const sendError = error => {
        console.error(error);
    };

    if (!e.isTrusted || e.origin !== SW_CONFIG.origin || !e.source || e.source.url.indexOf(SW_CONFIG.base_url) !== 0) return sendError('Unknown sender.');

    if (!e.data || typeof e.data !== 'object' || Array.isArray(e.data)) {
        return sendError('Message Error. Invalid message format, must be an object.');
    }
    const { action, data } = e.data;

    if (currentTasks[action] !== undefined && currentTasks[action] + TASK_TIME_LIMIT > Date.now()) {
        return sendError(`Action '${action}' has already processing.`);
    }
    currentTasks[action] = Date.now();

    let actionPromise = null;
    if (action === 'Clear Cache') actionPromise = cleanExpiredCache(data);
    else actionPromise = Promise.reject(`Undefined action: '${action}'`);
    actionPromise.then(sendSuccess).catch(sendError).finally(() => delete currentTasks[action]);

    return true;

}

function onFetch(e) { // Request interception
    if (e.request.url.indexOf(SW_CONFIG.local_urls.base) === 0) return e.respondWith(cacheGet(e.request));
    if (e.request.url.indexOf('https') === -1) return; // Allow only from https
    e.respondWith(cacheGet(e.request));
}

async function cacheFetch(request, cacheControl) {
    if (request.url.indexOf(SW_CONFIG.local_urls.base) === 0) return localFetch(request);

    if (request.url.indexOf(SW_CONFIG.base_url) === 0 && !cacheControl) {
        const url = new URL(e.request.url);
        if ( // Cache for a 3 mins only
            url.pathname === '/civitai-lite-viewer/' ||
            url.pathname === '/civitai-lite-viewer/index.html' ||
            url.pathname.indexOf('service_worker.js') !== -1
        ) {
            cacheControl = `max-age=${SW_CONFIG.cacheTargets['lite-viewer-core']}`;
        } else {
            cacheControl = `max-age=${SW_CONFIG.cacheTargets['lite-viewer']}`;
        }
    }

    try {
        const fetchResponse = await fetch(request);
        if (!fetchResponse.ok) return fetchResponse; // Don't try to cache the response with an error

        let blob = await fetchResponse.blob();
        const qIndex = request.url.indexOf('?');
        const params = qIndex !== -1 ? Object.fromEntries(new URLSearchParams(request.url.substring(qIndex + 1))) : null;
        if (params && blob.type.indexOf('image/') === 0 && (params.width || params.height || params.type) && !([ 'image/gif', 'image/apng' ].includes(blob.type))) {
            const { width, height , format, quality, fit } = params;
            blob = (await resizeBlobImage(blob, { width, height, quality, format, fit })) || blob;
        }

        if (!cacheControl) {
            if (blob.type === 'application/json') cacheControl = request.method === 'GET' ? 'max-age=60' : 'no-cache'; // Agressive caching for 1 minute (only GET requests)
            else {
                const maxAge = blob.size < 15000000 ? SW_CONFIG.cacheTargets[params?.target] ?? SW_CONFIG.cacheTargets.unknown : SW_CONFIG.cacheTargets['large-file'];
                cacheControl = `max-age=${maxAge}`;
            }
        }

        const response = responseFromBlob(blob, cacheControl);
        if (params?.cache !== 'no-cache' && cacheControl !== 'no-cache') cachePut(request, response.clone());
        return response;
    } catch (_) {
        console.error(_);
        if (request.url.indexOf('transcode=true') !== -1 && request.url.indexOf('.jpeg') !== -1) {
            console.log('Trying to download an image without the transcode=true attribute (Probably a GIF)');
            const newREquest = cloneRequestWithModifiedUrl(request, `${request.url.replace(/transcode=true,?/, '')}&cache=no-cache`);
            const response = await cacheFetch(newREquest, cacheControl);
            cachePut(request, response.clone());
            return response;
        }
        return new Response('', { status: 500, statusText: 'Network Error' });
    }
}

async function localFetch(request) {
    if (request.url.indexOf(SW_CONFIG.local_urls.blurHash) === 0) {
        const { hash, width = 32, height = 32, punch = 1 } = Object.fromEntries(new URLSearchParams(request.url.substring(request.url.indexOf('?') + 1)));
        const blob = await blurhashToImageBlob(hash, Number(width), Number(height), Number(punch));
        const response = responseFromBlob(blob, `max-age=${5 * 24 * 60 * 60}`); // 5 days
        cachePut(request, response.clone());
        return response;
    }
    return new Response('', { status: 500, statusText: 'Unknown local URL' });
}

async function resizeBlobImage(blob, options) { // Resize image blob
    const { width: targetWidth, height: targetHeight, format: targetFormat, quality: targetQuality = 0.97, fit = 'crop', position = 'center', smoothing = 'low' } = options; // fit: contain|scale-up|fill|crop; smoothing: none|low|medium|high;
    const types = { jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png', avif: 'image/avif' };
    if (!targetFormat && (await isImageAnimated(blob))) return blob;
    try {
        const bmp = await createImageBitmap(blob);
        const { width, height } = bmp;
        const originalRatio = width / height;
        let cropWidth = width, cropHeight = height, offsetX = 0, offsetY = 0, newWidth = targetWidth ?? Math.round(targetHeight * originalRatio), newHeight = targetHeight ?? Math.round(targetWidth / originalRatio);

        if ((fit === 'scale-up' || fit === 'contain') && targetWidth && targetHeight) {
            const scaleX = targetWidth / width;
            const scaleY = targetHeight / height;
            const scale = fit === 'scale-up' ? Math.max(1, Math.min(scaleX, scaleY)) : Math.min(scaleX, scaleY);
            newWidth = Math.round(width * scale);
            newHeight = Math.round(height * scale);
        }

        const newRatio = newWidth / newHeight;
        if (fit !== 'fill' && (targetWidth || targetHeight) && originalRatio !== newRatio) {
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
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (blob.type === 'image/webp' && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') {
        for (let i = 12; i < bytes.length - 4; i++) {
            const chunk = String.fromCharCode(...bytes.slice(i, i + 4));
            if (chunk === "ANIM" || chunk === "ANMF") return true;
        }
        return false;
    }
    if (blob.type === 'image/avif' && new TextDecoder().decode(bytes.slice(0, 4)) === 'ftyp' && new TextDecoder().decode(bytes.slice(4, 8)) === 'avif') {
        const avifFlags = bytes.slice(12, 16);
        if (avifFlags[0] === 0x01) return true;
        return false;
    }
    if (blob.type === 'image/gif' && new TextDecoder().decode(bytes.slice(0, 3)) === 'GIF') {
        const gifHeader = new TextDecoder().decode(bytes.slice(3, 6));
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
    const signSqr = x => (x < 0 ? -1 : 1) * x * x;

    /**
     * Fast approximate cosine implementation
     * Based on FTrig https://github.com/netcell/FTrig
     */
    const fastCos = (x) => {
        x += PI / 2;
        while (x > PI) {
            x -= PI2;
        }
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

        const colors = new Float64Array(size * 3);

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

        const cosinesY = new Float64Array(numY * height);
        const cosinesX = new Float64Array(numX * width);
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
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob;
}

async function cleanExpiredCache({ mode = 'max-age-expired', urlMask = null } = {}) { // Check and remove all old data (max-age expired)
    const cache = await caches.open(SW_CONFIG.cache);
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

    const isResponseOk = mode === 'all'
                            ? r => false                        // Remove ALL
                            : mode === 'max-age-expired'
                            ? r => r && checkCacheMaxAge(r)     // Remove only with expired max-age (default)
                            : r => r && checkCacheMaxAge(r);    // Remove only with expired max-age (unknown)
    
    const promises = keys.map(async (request) => {
        const url = request.url;
        const matchesMask = regexps.length !== 0 && regexps.some(rx => rx.test(url));
        const response = await cache.match(request);
        if (!matchesMask && isResponseOk(response)) return;

        return cache.delete(request);
    });

    await Promise.all(promises);

    return 'Cache cleared';
}

function cloneRequestWithModifiedUrl(originalRequest, newUrl) {
    const { method, headers, mode, credentials, cache, redirect, referrer, integrity, keepalive } = originalRequest;
    const init = { method, headers, mode, credentials, cache, redirect, referrer, integrity, keepalive };
    if (method !== 'GET' && method !== 'HEAD') init.body = originalRequest.body;
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

async function cachePut(request, response) { // Put response in cache
    const cache = await caches.open(SW_CONFIG.cache);
    return await cache.put(request, response);
}
