/// <reference path="./_docs.d.ts" />

function setAttributes(element, attributes) {
    if (attributes === undefined) return;
    if (Array.isArray(attributes)) {
        for (const attr of attributes) element.setAttribute(attr, '');
    } else {
        for (const attr in attributes) element.setAttribute(attr, attributes[attr]);
    }
}

function createElement(type, attributes, text) {
    const element = document.createElement(type);
    setAttributes(element, attributes);
    if (text !== undefined) element.textContent = text;
    return element;
}

function insertElement(type, parent, attributes, text) {
    const element = createElement(type, attributes, text);
    parent.appendChild(element);
    return element;
}

function insertAfter(element, target) {
    target.parentNode.insertBefore(element, target.nextSibling);
}

function emptyElement(element) {
    element.textContent = '';
    return element;
}

function insertTextNode(text, parent) {
    parent.appendChild(document.createTextNode(text));
}

function animateElement(element, options) {
    const { keyframes, framescount, timing = {}, duration, delay, easing, fill, timeline = document.timeline } = options;
    if (framescount !== undefined) timing.number = framescount;
    if (duration !== undefined) timing.duration = duration;
    if (delay !== undefined) timing.delay = delay;
    if (easing !== undefined) timing.easing = easing;
    if (fill !== undefined) timing.fill = fill;
    const effect = new KeyframeEffect(element, keyframes, timing);
    const animation = new Animation(effect, timeline);
    return new Promise(r => {
        animation.addEventListener('finish', () => r());
        animation.play();
    });
}

function toClipBoard(text) {
    navigator.clipboard.writeText(text);
}

function filesizeToString(size) {
    const l = window.languagePack?.fileSize ?? {};
    const units = [
        { suffix: l['b'] ?? 'B', factor: 1 },
        { suffix: l['kb'] ?? 'KB', factor: 1024 },
        { suffix: l['mb'] ?? 'MB', factor: 1024 ** 2 },
        { suffix: l['gb'] ?? 'GB', factor: 1024 ** 3 },
        { suffix: l['tb'] ?? 'TB', factor: 1024 ** 4 }
    ];

    for (let i = units.length - 1; i >= 0; i--) {
        const { suffix, factor } = units[i];
        if (size >= factor) {
            const value = size / factor;
            const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
            return `${value.toFixed(decimals)} ${suffix}`;
        }
    }
    return `0 ${l['b'] ?? 'B'}`;
}

function safeParseHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('script, iframe, object, embed, style, link, meta').forEach(el => el.remove());

    const fragment = new DocumentFragment();
    Array.from(doc.body.childNodes).forEach(node => fragment.appendChild(node));

    return fragment;
}

function formatTime(seconds) {
    if (seconds < 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds - (hours * 3600)) / 60);
    const remainingSeconds = Math.floor(seconds - (hours * 3600) - (minutes * 60));
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}` : `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function isURL(string) {
    try {
        const url = new URL(string);
        if (url.host.includes('%20')) return false;
        return Boolean(url.host);
    } catch (_) {
        return false;
    }
}

function toURL(url, origin = null) {
    try {
        return origin ? new URL(url, origin) : new URL(url);
    } catch (_) {
        return null;
    }
}

function copyThis(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(copyThis);
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, copyThis(value)]));
}

async function fetchJSON(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) {
            // Try to extract the error message from the response
            let error;
            try { error = (await res.json()).error; } catch(_) {}
            if (typeof error !== 'string') console.log(`${error?.name ?? 'Error'}: `, error?.issues ?? error);
            throw new Error(error || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        console.warn('fetchJSON error:', err?.message ?? err);
        return { error: err?.message ?? err };
    }
}

function parseParams(paramString) {
    if (!paramString) return null;
    try {
        return Object.fromEntries(new URLSearchParams(paramString));
    } catch {
        return null;
    }
}

function timeAgo(seconds) {
    const ago = [
        [ 31536000, 'year' ],
        [ 2592000, 'month' ],
        [ 604800, 'week' ],
        [ 86400, 'day' ],
        [ 3600, 'hour' ],
        [ 60, 'minute' ],
        [ 1, 'second' ],
    ];
    const baseString = seconds < 0 ? (window.languagePack?.time?.unitAfter ?? 'in %n %unit') : (window.languagePack?.time?.unitAgo ?? '%n %unit ago');
    if (seconds < 0) seconds = Math.abs(seconds);
    const i = seconds > 31536000 ? 0 : seconds > 2592000 ? 1 : seconds > 604800 ? 2 : seconds > 86400 ? 3 : seconds > 3600 ? 4 : seconds > 60 ? 5 : 6;
    const n = Math.floor(seconds / ago[i][0]);
    if (n === 0) return window.languagePack?.time?.now ?? 'now';
    const unit = window.languagePack?.units?.[ago[i][1]]?.[(n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2)] ?? ago[i][1];
    return baseString.replace('%n', n).replace('%unit', unit);
}

function pluralize(count, [one, few, many]) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}

function formatNumber(number) {
    if (number >= 1000000) return (number / 1000000).toFixed(number % 1000000 < 100000 ? 1 : 0) + 'M';
    if (number >= 1000) return (number / 1000).toFixed(number % 1000 < 100 ? 1 : 0) + 'k';
    return number.toString();
}

const defaultNumberFormant = new Intl.NumberFormat();
function formatNumberIntl(number) {
    return defaultNumberFormant.format(number);
}

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
const HTML_ESCAPE_RE = /[&<>"']/g;
function escapeHtml(str) {
    return String(str).replace(HTML_ESCAPE_RE, (c) => HTML_ESCAPES[c]);
}

function bibtexToHtml(bibtex) {
    const entry = {};
    const typeMatch = bibtex.match(/^@(\w+)\s*{\s*([^,]+),/);
    if (!typeMatch) return '<div class="bib-entry"></div>';

    entry.entryType = typeMatch[1];
    entry.citationKey = typeMatch[2];

    // Delete the first line @type{key,
    const fieldsPart = bibtex.replace(/^@\w+\s*{[^,]+,\s*/, '').replace(/}\s*$/, '');

    // Break it down into key={value} or key="value"
    const fieldRegex = /(\w+)\s*=\s*({([^{}]*)}|\"([^\"]*)\")/g;
    let match;

    let attempt = 0;
    while ((match = fieldRegex.exec(fieldsPart)) !== null && attempt < 20) {
        attempt++;
        const key = match[1].toLowerCase();
        const rawValue = match[3] || match[4] || '';
        const cleanValue = rawValue
            .replace(/\\["{}]/g, '')         // \" → "
            .replace(/\{\\[a-z]+\}/g, '')    // {\\"e} → e
            .replace(/\\[a-z]+\s*/g, '')     // \textit, \and, ...
            .replace(/[{}]/g, '')            // remove remaining braces
            .trim();

        entry[key] = cleanValue;
    }

    // Forming HTML
    let html = `<div class="bib-entry" data-bibtex-type="${entry.entryType ?? 'unknown'}" data-bibtex-citationKey="${entry.citationKey ?? 'none'}">`;
    if (entry.author) html += `<strong>${entry.author}</strong>. `;
    if (entry.title) html += `<em>${entry.title}</em>. `;

    if (entry.journal) {
        html += `${entry.journal}`;
        if (entry.volume) html += ` <strong>${entry.volume}</strong>`;
        if (entry.number) html += `(${entry.number})`;
        html += '. ';
    }

    if (entry.booktitle) html += `In <em>${entry.booktitle}</em>. `;
    if (entry.institution) html += `${entry.institution}. `;
    if (entry.organization) html += `${entry.organization}. `;
    if (entry.publisher) html += `${entry.publisher}. `;
    if (entry.year) html += `${entry.year}. `;
    if (entry.pages) html += `pp. ${entry.pages}. `;
    if (entry.note) html += `${entry.note}. `;

    if (entry.doi) {
        html += `<a href="https://doi.org/${entry.doi}" target="_blank">DOI</a>. `;
    } else if (entry.url) {
        if (entry.url.indexOf('<a ') === 0 && entry.url.indexOf('href="') !== -1) {
            // Fix if there is an html link provided (it can only be there because of a crooked CivitAI parser)
            const hrefIndex = entry.url.indexOf('href="') + 'href="'.length;
            const hrefIndexEnd = entry.url.indexOf('"', hrefIndex);
            entry.url = entry.url.substring(hrefIndex, hrefIndexEnd !== -1 ? hrefIndexEnd : undefined);
        }
        html += `<a href="${entry.url}" target="_blank">Link</a>. `;
    }
    html += '</div>';

    return html;
}

function tryParseLocalStorageJSON(key, errorValue, fromSessionStorage = false) {
    try {
        return JSON.parse((fromSessionStorage ? sessionStorage : localStorage).getItem(key)) ?? errorValue;
    } catch(_) {
        return errorValue;
    }
}

class Color {
    static convert(color, toFormat) {
        // Input format check
        let rgba;
        if (typeof color === 'string') {
            if (color.indexOf('rgb') === 0) {
                // Support for "rgb(255, 0, 0)" and "rgb(255 0 0 / 1)"
                const match = color.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:\/\s*(\d*\.?\d+))?\s*\)/);
                if (!match) throw new Error("Incorrect RGB(A) format");

                rgba = {
                    r: parseInt(match[1], 10),
                    g: parseInt(match[2], 10),
                    b: parseInt(match[3], 10),
                    a: match[4] !== undefined ? parseFloat(match[4]) : 1
                };

                if (toFormat === 'rgba') return rgba;
            } else if (color.indexOf('hsl') === 0) {
                // Support "hsl(205deg 100% 50%)", "hsl(205, 100%, 50%)", "hsl(205 100% 50% / 0.5)"
                const match = color.match(/hsla?\(\s*(\d+)(?:deg)?\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%\s*(?:\/\s*(\d*\.?\d+))?\s*\)/);
                if (!match) throw new Error("Incorrect HSL(A) format");

                const hsla = {
                    h: parseInt(match[1], 10),
                    s: parseFloat(match[2]),
                    l: parseFloat(match[3]),
                    a: match[4] !== undefined ? parseFloat(match[4]) : 1
                };

                if (toFormat === 'hsla') return hsla;

                rgba = this.hslToRgba(hsla);
            } else {
                color = color.replace(/^#/, '');
                if (!/^[0-9a-fA-F]{3,4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(color)) throw new Error("Incorrect hex length or format");

                if (toFormat === 'hex') return `#${color}`;

                rgba = this.hexToRgba(color);
            }
        } else if ('r' in color && 'g' in color && 'b' in color) {
            rgba = { ...color, a: color.a ?? 1 };
            if (toFormat === 'rgba') return rgba;
        } else if ('h' in color && 's' in color && 'l' in color) {
            if (toFormat === 'hsla') return { ...color, a: color.a ?? 1 };
            rgba = this.hslToRgba(color);
        } else if ('l' in color && 'a' in color && 'b' in color) {
            if (toFormat === 'oklab') return { ...color };
            if (toFormat === 'oklch') return this.oklabToOklch(color);
            rgba = this.oklabToRgb(color);
        } else if ('l' in color && 'c' in color && 'h' in color) {
            if (toFormat === 'oklch') return { ...color };
            const lab = this.oklchToOklab(color);
            if (toFormat === 'oklab') return lab;
            rgba = this.oklabToRgb(lab);
        } else {
            throw new Error("Unsupported color format");
        }

        // Convert to requested format
        switch (toFormat?.toLowerCase()) {
            case 'hex':
                return this.rgbaToHex(rgba);
            case 'rgba':
                return rgba;
            case 'hsla':
                return this.rgbaToHsl(rgba);
            case 'oklab':
                return this.rgbToOklab(rgba);
            case 'oklch':
                const lab = this.rgbToOklab(rgba);
                return this.oklabToOklch(lab);
            default:
                throw new Error("Unsupported target color format");
        }
    }

    static rgbaToHex({ r, g, b, a = 1 }) {
        let hexArray = [ r, g, b ];
        if (a !== 1) hexArray.push(Math.round(a * 255));
        hexArray = hexArray.map(c => c.toString(16).padStart(2, '0'));
        if (!hexArray.some(c => c[0] !== c[1])) hexArray = hexArray.map(c => c[0]);
        return `#${hexArray.join('')}`;
    }

    static rgbaToHsl({ r, g, b, a = 1 }) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if(max === min){
            h = s = 0; // colorless
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100),
            a: a
        };
    }

    static hslToRgba({ h, s, l, a = 1 }) {
        s /= 100; l /= 100;

        const k = n => (n + h / 30) % 12;
        const d = s * Math.min(l, 1 - l);
        const f = n => l - d * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

        return {
            r: Math.round(f(0) * 255),
            g: Math.round(f(8) * 255),
            b: Math.round(f(4) * 255),
            a: a
        };
    }

    static hexToRgba(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(char => char + char).join('');
        if (hex.length === 6) hex += 'ff';
        const [r, g, b, a] = hex.match(/.{2}/g).map(val => parseInt(val, 16));
        return { r, g, b, a: +(a / 255).toFixed(2) };
    }

    static oklabToOklch(lab) {
        const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
        let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
        if (h < 0) h += 360;
        return { l: lab.l, c, h };
    }

    static oklchToOklab(lch) {
        const hr = lch.h * Math.PI / 180;
        return {
            l: lch.l,
            a: Math.cos(hr) * lch.c,
            b: Math.sin(hr) * lch.c
        };
    }

    static rgbToOklab(rgb) {
        const lr = this.#srgbToLinear(rgb.r);
        const lg = this.#srgbToLinear(rgb.g);
        const lb = this.#srgbToLinear(rgb.b);

        const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
        const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
        const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

        return {
            l: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
        };
    }

    static oklabToRgb(lab) {
        const l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
        const m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
        const s_ = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b;

        const L = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        const lr = +4.0767416621 * L - 3.3077115913 * m + 0.2309699292 * s;
        const lg = -1.2684380046 * L + 2.6097574011 * m - 0.3413193965 * s;
        const lb = -0.0041960863 * L - 0.7034186147 * m + 1.7076147010 * s;

        return {
            r: Math.max(0, Math.min(255, Math.round(this.#linearToSrgb(lr) * 255))),
            g: Math.max(0, Math.min(255, Math.round(this.#linearToSrgb(lg) * 255))),
            b: Math.max(0, Math.min(255, Math.round(this.#linearToSrgb(lb) * 255)))
        };
    }

    static #srgbToLinear(c) {
        c = c / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }

    static #linearToSrgb(c) {
        return c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055;
    }
}

class Blurhash {
    static #LOOKUP = (() => {
        const t = new Uint8Array(128);
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
        for (let i = 0; i < 83; i++) t[chars.charCodeAt(i)] = i;
        return t;
    })();

    static #HEX = '0123456789abcdef';

    // 0xRRGGBB
    static toRGB(hash) {
        const t = Blurhash.#LOOKUP;

        let v = 0;
        v = v * 83 + t[hash.charCodeAt(2)];
        v = v * 83 + t[hash.charCodeAt(3)];
        v = v * 83 + t[hash.charCodeAt(4)];
        v = v * 83 + t[hash.charCodeAt(5)];

        return v;
    }

    // #RRGGBB
    static toHex(hash) {
        const v = Blurhash.toRGB(hash);
        const h = Blurhash.#HEX;

        return (
            '#' +
            h[(v >> 20) & 15] + h[(v >> 16) & 15] +
            h[(v >> 12) & 15] + h[(v >> 8) & 15] +
            h[(v >> 4) & 15] + h[v & 15]
        );
    }
}


// TODO: Animate scroll to element (when navigating with the keyboard)
class MasonryLayout {
    #id;
    #container;
    #options;
    #isPassive;
    #allowUseElementFromAddItems = false; // A switch that allows elements to be reused when the number of columns changes

    #columns = [];
    #layers = [];
    #items = [];
    #itemsById = new Map();
    #inViewport = new Set();
    #focusedItem = null;

    #onScroll;
    #onResize;
    #readScroll;
    #readResize;
    #onKeydown;

    #onElementRemove;
    #getResizedOptions;

    windowHeight = 0;
    windowWidth = 0;
    containerWidth = 0;
    containerOffsetTop = 0;

    constructor(container, options) {
        this.#id = options.id || Date.now();
        this.#container = container;
        this.#isPassive = options.passive ?? false;
        this.#options = {
            itemWidth: options.itemWidth ?? 300,
            itemHeight: options.itemHeight ?? null,
            gap: options.gap ?? 8,
            maxOverscanScreens: options.maxOverscanScreens ?? 3,
            basePaddingFactor: options.basePaddingFactor ?? .7,
            lookAheadTime: options.lookAheadTime ?? 300,
            layerHeight: options.layerHeight ?? 1500,
            stopThreshold: options.stopThreshold ?? 0.1,
            cooldownTime: options.cooldownTime ?? 200,
        };
        this.#getResizedOptions = options.getResizedOptions;
        this.#onElementRemove = options.onElementRemove;

        if (options.progressiveGenerator) {
            this.#queueGenerators = options.progressiveGenerator.map(it => ({ generator: it.generator, weight: it.weight || 1 }));
        }

        this.#columns = [];
        this.#items = [];
        this.#inViewport = new Set();
        this.#itemsById = new Map();
        this.#focusedItem = null;

        this.#onScroll = this.#handleScroll.bind(this);
        this.#onResize = this.#handleResize.bind(this);
        this.#onKeydown = this.#handleKeydown.bind(this);
        this.#readScroll = this.#handleReadScroll.bind(this);
        this.#readResize = this.#handleReadResize.bind(this);

        this.#container.addEventListener('pointerdown', this.#handlerPointerDown.bind(this), { passive: true });

        this.#lastScrollTop = Number(options.state?.currentScrollTop || 0);

        this.#init();
    }

    // if "passive: true" - do not trigger style recalculations (do not scroll the page, do not stop animations if any)
    resize({ animate = false, passive = false, allowElementsReuse = true } = {}) {
        if (!allowElementsReuse) animate = false;
        const options = this.#options;
        this.#columns = [];
        const columnsCount = Math.floor((this.windowWidth - options.gap) / (options.itemWidth + options.gap)) || 1;
        this.containerWidth = columnsCount * (options.itemWidth + options.gap) - options.gap;
        for(let i = 0; i < columnsCount; i++) {
            this.#columns.push({
                height: 0,
                index: this.#columns.length
            });
        }

        // skip all if layout is empty
        if (!this.#items.length) {
            this.#container.style.width = `${this.containerWidth}px`;
            return;
        }

        // Calc current positions
        const startPositions = new Map();
        const startOffsetLeft = animate ? this.#container.offsetLeft : 0;
        if (animate) {
            const startScrollTop = this.#lastScrollTop;
            this.#inViewport.forEach(item => {
                startPositions.set(item.id, { left: item.boundLeft, top: item.boundTop - startScrollTop, height: item.boundHeight, width: item.boundWidth });
            });
        }

        // Clear layers
        this.#layers.forEach(layer => {
            layer.items = [];
            layer.inDOM = false;
            if (layer.element) {
                layer.element.remove();
                delete layer.element;
            }
        });
        this.#layers = [];

        // Recalculate the position of all elements
        const items = this.#items;
        if (items.length) {
            const lastFocusedItem = this.#itemsById.get(this.#focusedItem);
            lastFocusedItem?.element?.setAttribute('tabIndex', -1);
            this.#items = [];
            this.#inViewport = new Set();
            this.#itemsById = new Map();
            this.#allowUseElementFromAddItems = Boolean(allowElementsReuse);
            this.#focusedItem = null;
            this.addItems(items, true);
            this.#allowUseElementFromAddItems = false;

            const focusedItem = lastFocusedItem ? this.#itemsById.get(lastFocusedItem.id) : null;
            if (focusedItem) {
                const targetScrollOffset = this.#lastScrollTop - lastFocusedItem.boundTop;
                const targetScroll = focusedItem.boundTop + targetScrollOffset;
                this.#handleScroll({ scrollTopRelative: targetScroll });
                const autoFocusedItem = this.#itemsById.get(this.#focusedItem);
                if (autoFocusedItem?.id !== focusedItem.id) {
                    autoFocusedItem?.element?.setAttribute('tabIndex', -1);
                    this.#focusedItem = focusedItem?.id;
                    focusedItem?.element?.setAttribute('tabIndex', 0);
                }
                this.#lastScrollTop = this.#lastScrollTop + this.#container.offsetTop;
                if (!passive) document.documentElement.scrollTo({ top: this.#lastScrollTop, behavior: 'instant' });
            } else {
                this.#handleScroll({ scrollTopRelative: this.#lastScrollTop || 0 });
            }

            items.forEach(item => {
                if (!item.inDOM) return;
                const gridItem = this.#itemsById.get(item.id);
                if (!gridItem.element && item.element) {
                    this.#onElementRemove?.(item.element, item.data);
                    item.element.remove();
                    delete item.element;
                }
                if (this.#inViewport.has(gridItem)) {
                    if (!passive) gridItem.element.getAnimations().forEach(a => a.cancel());
                } else {
                    if (gridItem.element) this.#hideItem(gridItem);
                    else this.#queueRemove(gridItem); // If the element was visible on the previous screen, it could remain in the rendering queue
                }
            });
        }

        this.#container.style.width = `${this.containerWidth}px`;

        // Calc new positions and animate
        if (animate) {
            const animations = [];
            const vh = this.windowHeight;
            const endScrollTop = this.#lastScrollTop;
            const deltaOffsetLeft = startOffsetLeft - this.#container.offsetLeft;
            this.#inViewport.forEach(item => {
                const keyframes = {};
                const end = { left: item.boundLeft, top: item.boundTop - endScrollTop, height: item.boundHeight, width: item.boundWidth };
                if (startPositions.has(item.id)) {
                    const start = startPositions.get(item.id);
                    if (
                        (start.left === end.left && start.top === end.top && !deltaOffsetLeft)
                        || (start.top + start.height < 0 && end.top + end.height < 0)
                        || (start.top > vh && end.top > vh)
                    ) return;

                    keyframes.transform = [ `translate(${deltaOffsetLeft + start.left - end.left}px, ${start.top - end.top}px)`, 'translate(0, 0)' ];
                } else {
                    if (end.top + end.height < 0 || end.top > vh) return;
                    keyframes.transform = [ 'scale(0)', 'scale(1)' ];
                }
                animations.push({ element: item.element, keyframes });
            });

            const columnsStart = this.#columns.length;
            this.#container.classList.add('cards-animating');
            Promise.all(
                animations.map(({ element, keyframes }) => animateElement(element, { keyframes, duration: 300, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }))
            ).then(() => {
                if (columnsStart !== this.#columns.length) return;
                this.#container.classList.remove('cards-animating');
            });
        }
    }

    addItems(items, dryAdd = false) {
        const options = this.#options;
        const itemsToUpdate = new Map();

        const cardHeightMin = options.itemWidth * .6;
        const cardHeightMax = this.windowHeight * .8;
        const cardHeightClamp = cardHeight => Math.max(Math.min(cardHeight, cardHeightMax), cardHeightMin);

        items.forEach(item => {
            if (this.#itemsById.has(item.id)) {
                if (!itemsToUpdate.has(item.id)) itemsToUpdate.set(item.id, item);
                return;
            }

            const targetColumn = this.#columns.reduce((minCol, col) => col.height < minCol.height ? col : minCol, this.#columns[0]);
            const cardHeight = cardHeightClamp(options.itemHeight ?? (options.itemWidth / item.aspectRatio));

            const gridItem = {
                id: item.id,
                index: this.#items.length,
                data: item.data,
                aspectRatio: item.aspectRatio,
                boundLeft: targetColumn.index * (options.itemWidth + options.gap),
                boundTop: targetColumn.height,
                boundWidth: options.itemWidth,
                boundHeight: cardHeight,
                boundBottom: targetColumn.height + cardHeight,
                center: Math.round(targetColumn.height + cardHeight / 2),
                inDOM: false
            };

            gridItem.layer = this.#addToLayer(gridItem);

            if (this.#allowUseElementFromAddItems && item.element) {
                gridItem.element = item.element;
                if (item.stepIndex !== undefined && item.stepIndex < this.#queueGenerators.length) {
                    gridItem.stepIndex = item.stepIndex;
                    gridItem.renderCtx = item.renderCtx;
                }
            }

            targetColumn.height += cardHeight + options.gap;

            this.#items.push(gridItem);
            this.#itemsById.set(item.id, gridItem);
        });

        const largestColumn = this.#columns.reduce((maxCol, col) => col.height > maxCol.height ? col : maxCol, this.#columns[0]);
        const containerHeight = largestColumn.height > options.gap ? largestColumn.height - options.gap : 0;

        // Recreate elements with new data
        let resized = false;
        if (itemsToUpdate.size) {
            itemsToUpdate.forEach((item, id) => {
                const gridItem = this.#itemsById.get(id);
                if (gridItem.aspectRatio !== item.aspectRatio) {
                    gridItem.aspectRatio = item.aspectRatio;
                    resized = true;
                }
                gridItem.data = item.data;
                if (gridItem.inDOM) this.#hideItem(gridItem);
            });
        }

        // If any of the cards have changed size, then update the position of all cards
        if (!dryAdd) {
            if (resized) this.resize({ animate: false, passive: true });
            else this.#handleScroll({ scrollTopRelative: this.#lastScrollTop || 0, firstDraw: true });
        }

        this.#container.style.height = `${containerHeight}px`;
    }

    clear() {
        this.#items.forEach(item => {
            if (!item.element) return;
            item.element.remove();
            this.#onElementRemove?.(item.element, item.data, true);
            delete item.element;
        });

        this.#layers.forEach(layer => {
            layer.items = [];
            if (!layer.element) return;
            layer.element.remove();
            delete layer.element;
        });

        this.#queueClear();

        this.#items = [];
        this.#layers = [];
        this.#inViewport = new Set();
        this.#itemsById = new Map();
        this.#focusedItem = null;
        this.#container.textContent = '';
        this.resize();
    }

    destroy(options) {
        const preventRemoveItemsFromDOM = options?.preventRemoveItemsFromDOM ?? false;
        if (!this.#isPassive) {
            document.removeEventListener('scroll', this.#onScroll);
            document.removeEventListener('resize', this.#onResize);
        }
        this.#container.removeEventListener('keydown', this.#onKeydown);
        this.#queueClear();
        this.#items.forEach(item => {
            if (!item.element) return;
            item.inDOM = false;    
            if (!preventRemoveItemsFromDOM) item.element.remove();
            this.#onElementRemove?.(item.element, item.data, preventRemoveItemsFromDOM);
            delete item.element;
        });
        this.#layers.forEach(layer => {
            layer.items = [];
            if (!layer.element) return;
            layer.inDOM = false;
            if (!preventRemoveItemsFromDOM) layer.element.remove();
            delete layer.element;
        });
        this.#layers = null;
        this.#columns = null;
        this.#items = null;
        this.#inViewport = null;
        this.#itemsById = null;
        this.#focusedItem = null;
        this.#container = null;
    }

    getCallbacks() {
        if (this.#isPassive) return { onScroll: this.#onScroll, onResize: this.#onResize, readScroll: this.#readScroll, readResize: this.#readResize };
        else return {};
    }

    #init() {
        this.windowHeight = window.innerHeight;
        this.windowWidth = window.innerWidth;

        if (!this.#isPassive) {
            document.addEventListener('scroll', this.#onScroll, { passive: true });
            document.addEventListener('resize', this.#onResize, { passive: true });
        }
        this.#container.addEventListener('keydown', this.#onKeydown, { capture: true });

        this.resize();
    }

    #findStartIndex(overscanTop) {
        let low = 0;
        let high = this.#items.length - 1;
        let result = this.#items.length;

        while (low <= high) {
            const mid = (low + high) >> 1;
            if (this.#items[mid].boundBottom >= overscanTop) {
                result = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return result;
    }

    #findEndIndex(overscanBottom, startIndex = 0) {
        let low = startIndex;
        let high = this.#items.length - 1;
        let result = -1;

        while (low <= high) {
            const mid = (low + high) >> 1;
            if (this.#items[mid].boundTop <= overscanBottom) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return result;
    }

    #setTabIndex(item) {
        const prevFocusedItem = this.#itemsById.get(this.#focusedItem);
        prevFocusedItem?.element?.setAttribute('tabIndex', -1);
        this.#focusedItem = item?.id;
        item?.element?.setAttribute('tabIndex', 0);
    }

    #findNearestInDirection(currentItem, direction) {
        let best = null;
        let bestScore = Infinity;
        direction = [ 'up', 'down', 'left', 'right' ].findIndex(d => d === direction);

        this.#inViewport.forEach(item => {
            if (item.id === currentItem.id || (direction < 2 && item.boundLeft !== currentItem.boundLeft)) return;

            const dx = item.boundLeft - currentItem.boundLeft;
            const dy = item.boundTop - currentItem.boundTop;

            // Filter by direction
            if (
                (direction === 0 && dy >= 0) ||
                (direction === 1 && dy <= 0) ||
                (direction === 2 && dx >= 0) ||
                (direction === 3 && dx <= 0)
            ) {
                return;
            }

            // Metric: Priority to direction, then distance
            const score = direction < 2 ? Math.abs(dy) + Math.abs(dx) * 0.25 : Math.abs(dx) + Math.abs(dy) * 0.25;

            if (score < bestScore) {
                best = item;
                bestScore = score;
            }
        });

        return best;
    }

    #addToLayer(item) {
        const options = this.#options;

        const layerIndex = Math.floor(item.boundTop / (options.layerHeight ?? 1500));

        let layer = this.#layers[layerIndex];
        if (!layer) {
            this.#layers[layerIndex] = layer = {
                index: layerIndex,
                boundTop: item.boundTop,
                boundBottom: item.boundTop,
                boundHeight: 0,
                inDOM: false,
                visibleCount: 0,
                items: []
            };
        }

        layer.items.push(item);

        let changed = false;
        if (item.boundTop < layer.boundTop) {
            layer.boundTop = item.boundTop;
            layer.items.forEach(item => {
                if (!item.element) return;
                item.element.style.top = `${this.#round(item.boundTop - layer.boundTop)}px`; // Change the offset of the card relative to the layer
            });
            changed = true;
        }
        if (item.boundBottom > layer.boundBottom) {
            layer.boundBottom = item.boundBottom;
            changed = true;
        }

        if (changed) {
            layer.boundHeight = layer.boundBottom - layer.boundTop;

            if (layer.element) {
                layer.element.style.top = `${this.#round(layer.boundTop)}px`;
                layer.element.style.height = `${this.#round(layer.boundHeight)}px`;
                layer.element.style.containIntrinsicSize = `${this.containerWidth}px ${this.#round(layer.boundHeight)}px`;
            }
        }

        return layer;
    }

    #drawItem(item, isFirstDraw = false) {
        if (!item.element) {
            this.#queueAdd(item, isFirstDraw); // gen element

            item.element.setAttribute('tabIndex', -1);
            item.element.setAttribute('data-visc-id', item.id);
            item.element.style.containIntrinsicSize = `${item.boundWidth}px ${item.boundHeight}px`;
        }

        item.element.style.left = `${item.boundLeft}px`;
        item.element.style.top = `${this.#round(item.boundTop - item.layer.boundTop)}px`;

        if (!item.inDOM) {
            item.layer.visibleCount++;

            if (!item.layer.element) {
                const layer = item.layer;
                layer.element = createElement('div', { class: 'cards-layer', style: `top: ${this.#round(layer.boundTop)}px; width: ${this.containerWidth}px; height: ${this.#round(layer.boundHeight)}px; contain-intrinsic-size: ${this.containerWidth}px ${this.#round(layer.boundHeight)}px;` });
            }

            item.layer.element.appendChild(item.element);

            if (!item.layer.inDOM) {
                this.#container.appendChild(item.layer.element);
                item.layer.inDOM = true;
            }
            item.inDOM = true;
        }

        this.#inViewport.add(item);
    }

    #hideItem(item) {
        this.#queueRemove(item);

        if (item.element) {
            this.#onElementRemove?.(item.element, item.data);
            item.element.remove();
            delete item.element;
        }

        this.#inViewport.delete(item);
        if (!item.inDOM) return;
        item.inDOM = false;

        item.layer.visibleCount--;
        if (item.layer.visibleCount <= 0) {
            item.layer.visibleCount = 0;
            item.layer.element?.remove();
            delete item.layer.element;
            item.layer.inDOM = false;
        }
    }

    #handlerPointerDown(e) {
        const target = e.target.closest('[data-visc-id]');
        if (!target || !this.#container.contains(target)) return;
        
        const focusedItem = this.#itemsById.get(+target.getAttribute('data-visc-id'));
        if (focusedItem) this.#setTabIndex(focusedItem, true);
    }

    #handleReadScroll(e = {}) {
        this.containerOffsetTop = this.#container.offsetTop;
        const scrollTop = e?.scrollTop ?? document.documentElement.scrollTop;
        e.scrollTopRelative = scrollTop - this.containerOffsetTop;
        return e;
    }

    #handleReadResize(e = {}) {
        this.windowHeight = window.innerHeight;
        this.windowWidth = window.innerWidth;
        e.optionsChanged = false;

        const resizedOptions = this.#getResizedOptions?.() ?? {};
        ['itemWidth', 'itemHeight', 'gap'].forEach(k => {
            if (!resizedOptions[k] || resizedOptions[k] === this.#options[k]) return;
            this.#options[k] = resizedOptions[k];
            e.optionsChanged = true;
        });

        return e;
    }

    #handleKeydown(e) {
        let direction = null;

        switch (e.key) {
            case 'ArrowUp':
            case 'w': case 'W':
                direction = 'up';
                break;
            case 'ArrowDown':
            case 's': case 'S':
                direction = 'down';
                break;
            case 'ArrowLeft':
            case 'a': case 'A':
                direction = 'left';
                break;
            case 'ArrowRight':
            case 'd': case 'D':
                direction = 'right';
                break;
            default:
                return;
        }

        e.preventDefault();

        const current = this.#itemsById.get(this.#focusedItem);
        if (!current) return;

        const next = this.#findNearestInDirection(current, direction);
        if (next) {
            this.#setTabIndex(next);
            next.element?.focus?.({ preventScroll: false });
            // next.element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        }
    }

    #queueGenerators = [];  // [ { generator: func, weight: num }, ...]
    #queueList = new Set(); // id
    #queueActive = null;    // animationFrame
    #queueAdd(item, forceSync = false) {
        if (item.stepIndex === undefined) {
            item.stepIndex = 0;
            item.renderDelay = 0;
            item.renderCtx = { data: item.data, itemWidth: item.boundWidth, itemHeight: item.boundHeight };
        }

        if (forceSync) {
            while (item.stepIndex < this.#queueGenerators.length) this.#executeStep(item);
            this.#queueRemove(item); // Clear ctx and remove from queue
            return;
        }

        this.#queueList.add(item.id);

        this.#executeStep(item);

        if (!this.#queueActive) this.#queueActive = requestAnimationFrame(() => this.#queueRun());
    }
    #queueRemove(item) {
        this.#queueList.delete(item.id);
        delete item.stepIndex;
        delete item.renderDelay;
        delete item.renderCtx;
    }
    #queueSort() {
        if (this.#queueList.size < 6) return;

        const focusPoint = this.#lastScrollTop + (Math.abs(this.#scrollSpeed) > 8 ? this.#scrollDirection > 0 ? this.windowHeight : 0 : this.windowHeight / 2);
        const sorted = Array.from(this.#queueList).sort((aId, bId) => {
            const itemA = this.#itemsById.get(aId);
            const itemB = this.#itemsById.get(bId);
            const distA = Math.abs(itemA.center - focusPoint);
            const distB = Math.abs(itemB.center - focusPoint);
            return distA - distB;
        });
        this.#queueList = new Set(sorted);

        if (this.#scrollSpeed <= 2) return;

        const direction = this.#scrollDirection;
        const screenTop = this.#lastScrollTop;
        const screenBottom = screenTop + this.windowHeight;
        this.#queueList.forEach(id => {
            const item = this.#itemsById.get(id);
            item.renderDelay = 0;
            if (direction > 0) { // down
                if (item.boundBottom < screenTop) item.renderDelay = 3;
                return;
            }
            if (direction < 0) { // up
                if (item.boundTop > screenBottom) item.renderDelay = 3;
                return;
            }
        });
    }
    #executeStep(item) {
        const step = this.#queueGenerators[item.stepIndex];
        if (!step) return;

        const result = step.generator(item.renderCtx);
        if (result?.element) item.element = result.element;
        item.stepIndex++;
    }
    #queueRun() {
        if (this.#queueList.size === 0) {
            this.#queueActive = null;
            return;
        }

        const startTime = performance.now();
        const FRAME_BUDGET = 2; // 4 ms
        const MAX_WEIGHT_PER_FRAME = 100;

        // If the scrolling is too fast -> lower the maximum weight
        const weightLimit = startTime - this.#lastScrollTime < 10 && this.#scrollSpeed > (this.windowHeight / 50) ? this.#scrollSpeed > (this.windowHeight / 25) ? 4 : 9 : 100;

        let consumedWeight = 0;
        for (const itemId of this.#queueList) {
            if (performance.now() - startTime > FRAME_BUDGET || consumedWeight > MAX_WEIGHT_PER_FRAME) break;

            const item = this.#itemsById.get(itemId);
            if (!item) {
                this.#queueList.delete(itemId);
                continue;
            }

            const step = this.#queueGenerators[item.stepIndex];
            if (!step) {
                this.#queueRemove(item);
                continue;
            }

            if (step.weight > weightLimit) continue;

            if (item.renderDelay > 0) {
                item.renderDelay--;
                continue;
            }

            this.#executeStep(item);
            consumedWeight += (step.weight || 10);

            if (item.stepIndex >= this.#queueGenerators.length) this.#queueRemove(item);
        }

        if (this.#queueList.size > 0) this.#queueActive = requestAnimationFrame(() => this.#queueRun());
        else this.#queueActive = null;
    }
    #queueClear() {
        if (this.#queueActive) cancelAnimationFrame(this.#queueActive);
        this.#queueActive = null;
        this.#queueList.forEach(id => {
            const item = this.#itemsById.get(id);
            this.#queueRemove(item);
        });
        this.#queueList.clear();
    }

    #lastScrollTop = null;
    #lastScrollTime = performance.now();
    #scrollDirection = 1; // 1 down, -1 up
    #scrollSpeed = 0;
    #currentOverscan = 0; // smooth overscan that we will use
    #handleScroll(e) {
        const firstDraw = e?.firstDraw || !this.#inViewport.size; // Mark this as the first rendering (the generator can render everything at once, without delays)
        const now = performance.now();

        // Adjust scrolling if a target element is specified
        // (the expectation is that the function that called the scroll function will then take into account the difference and scroll the page accordingly)
        if (e?.focusedItem && this.#itemsById.has(e.focusedItem)) {
            const focusedItem = this.#itemsById.get(e.focusedItem);
            e.scrollTopRelative = focusedItem.boundTop + (e.focusedItemOffsetTop ?? (this.windowHeight / 2));
        }

        // scrollTopRelative - used to restore elements when moving through nav history, without causing a recalculation of styles
        const currentScrollTop = typeof e?.scrollTopRelative === 'number'
                                    ? e?.scrollTopRelative
                                    : this.#handleReadScroll(e).scrollTopRelative;

        if (this.#lastScrollTop === null) this.#lastScrollTop = currentScrollTop; // Reset delta to 0 when first render
        const delta = currentScrollTop - this.#lastScrollTop;
        const dt = now - this.#lastScrollTime;

        // Reset speed after stop
        if (dt > 400) this.#scrollSpeed = 0;

        // Calculation of instantaneous speed (px/ms)
        // Add a small filter (EMA) to avoid micro-jerks in the mouse delta
        const instantSpeed = dt > 0 ? Math.abs(delta) / dt : 0;
        this.#scrollSpeed = this.#scrollSpeed * .5 + instantSpeed * .5;

        if (delta > 0) this.#scrollDirection = 1;
        else if (delta < 0) this.#scrollDirection = -1;

        this.#lastScrollTop = currentScrollTop;
        this.#lastScrollTime = now;

        const options = this.#options;
        const vh = this.windowHeight;

        // "Dead zone" - at least half a screen on each side, so as not to fall apart during reversal
        const basePadding = vh * (options.basePaddingFactor ?? .7);

        // Look-ahead: How many pixels will the user fly through during the system's response time (e.g. 300 ms)
        const lookAheadTime = options.lookAheadTime ?? 300;
        const dynamicBenefit = this.#scrollSpeed * lookAheadTime;

        // We limit it from above so as not to inflate the DOM to infinity (e.g. maximum 3 screens)
        const maxDynamic = vh * (options.maxOverscanScreens ?? 3);
        const targetOverscan = basePadding + Math.min(dynamicBenefit, maxDynamic);

        // --- Smoothing ---
        // Use different coefficients for expansion and contraction
        // Expanding should be INSTANTLY (0.8), contracting slowly (0.05)
        const isExpanding = targetOverscan > (this.#currentOverscan || 0);
        const smooth = isExpanding ? .9 : .1;

        this.#currentOverscan = this.#lerp(this.#currentOverscan || basePadding, targetOverscan, smooth);

        // --- borders ---
        const leadFactor = .2; // 20% more "forward" than "backward" from current currentOverscan
        const forwardExtra = this.#currentOverscan * (1 + leadFactor);
        const backwardExtra = this.#currentOverscan * (1 - leadFactor);

        const overscanTop = currentScrollTop - (this.#scrollDirection < 0 ? forwardExtra : backwardExtra);
        const overscanBottom = currentScrollTop + vh + (this.#scrollDirection > 0 ? forwardExtra : backwardExtra);
        const screenTop = currentScrollTop;
        const screenBottom = currentScrollTop + vh;

        const newStartIndex = this.#findStartIndex(overscanTop);
        const newEndIndex = this.#findEndIndex(overscanBottom, newStartIndex);

        // Remove items that are no longer visible
        for (const item of this.#inViewport) {
            if (item.index < newStartIndex || item.index > newEndIndex) {
                this.#hideItem(item);
            }
        }

        // Insert elements that are now visible
        for (let i = newStartIndex; i <= newEndIndex; i++) {
            const item = this.#items[i];

            if (!item.inDOM) {
                const forceSync = firstDraw && item.boundTop < screenBottom && item.boundBottom > screenTop;
                this.#drawItem(item, forceSync);
            }
        }

        this.#queueSort();

        const focusedItem = this.#itemsById.get(this.#focusedItem);
        const marginTop = 100;
        const focusTop = screenTop + marginTop;
        const focusBottom = screenBottom - marginTop;
        if (!focusedItem || !focusedItem.inDOM || focusedItem.boundBottom < focusTop || focusedItem.boundTop > focusBottom) {
            let best = null;
            let bestScore = Infinity;

            if (e?.focusedItem && this.#itemsById.has(e.focusedItem)) {
                const focusedItem = this.#itemsById.get(e.focusedItem);
                best = focusedItem;
                bestScore = 0;
            }

            this.#inViewport.forEach(item => {
                if (item.boundBottom < focusTop || item.boundTop > focusBottom) return;

                const dx = item.boundLeft - (focusedItem?.boundLeft ?? 0);
                const dy = item.boundTop - (focusedItem?.boundTop ?? 0);
                const score = Math.abs(dy) + Math.abs(dx);

                if (score < bestScore) {
                    best = item;
                    bestScore = score;
                }
            });

            const newFocusedItem = best || this.#inViewport.values().next().value;
            this.#setTabIndex(newFocusedItem);
        }

        return currentScrollTop;
    }

    #handleResize(e) {
        const options = this.#options;
        if (!e) this.#handleReadResize();
        const columnsCount = Math.floor((this.windowWidth - options.gap) / (options.itemWidth + options.gap)) || 1;
        if (columnsCount !== this.#columns.length || e.optionsChanged) this.resize({ animate: true, allowElementsReuse: Boolean(!e.optionsChanged) });
    }

    #lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // 10000 - 10**4 - precision 4
    #round(v) {
        return Math.round(v * 10000) / 10000;
    }

    get id() {
        return this.#id;
    }

    get state() {
        const focusedItem = this.#itemsById.get(this.#focusedItem);
        return {
            currentScrollTop: this.#lastScrollTop,
            focusedItem: this.#focusedItem ?? null,
            focusedItemOffsetTop: focusedItem ? this.#lastScrollTop - focusedItem.boundTop : 0
        }
    }
}

class InfiniteCarousel {
    #currentIndex = 0;
    #generator;
    #isAnimating = false;
    #items = [];
    #visibleItems = new Set();
    #options = {};
    #carouselWrap;
    #itemsListWrap;
    #onScroll;
    #onElementRemove;
    #carouselCurrentIndexElement;

    constructor(list, options) {
        this.#options.itemWidth = options.itemWidth || 450;
        this.#options.visibleCount = options.visibleCount || 1;
        this.#options.gap = options.gap ?? 12;
        this.#currentIndex = options.active ?? 0;
        this.#onScroll = options.onScroll;
        this.#onElementRemove = options.onElementRemove;
        this.#generator = options.generator;

        list.forEach(({ id = this.#items.length, data, element, width, height, isWide = false }) => {
            const aspectRatio = width / height;
            const item = {
                id,
                data,
                aspectRatio,
                isWide,
                inDOM: false
            };

            if (element) {
                const itemWidth = item.isWide ? this.#options.itemWidth * 2 + this.#options.gap : this.#options.itemWidth;
                const itemHeight = itemWidth / aspectRatio;
                item.element = createElement('div', { class: 'carousel-item', style: `width: ${itemWidth}px; height: ${itemHeight}px; contain-intrinsic-size: ${itemWidth}px ${itemHeight}px;` });
                item.element.appendChild(element);
            }

            this.#items.push(item);
        });

        const carouselCells = this.#items.reduce((sum, item) => sum + (item.isWide ? 2 : 1), 0);
        const carouselWidth = Math.min(this.#options.visibleCount, carouselCells) * (this.#options.itemWidth + this.#options.gap) - this.#options.gap;
        this.#carouselWrap = createElement('div', { class: 'carousel', style: `width: ${carouselWidth}px;` });
        this.#itemsListWrap = insertElement('div', this.#carouselWrap, { class: 'carousel-items', style: `--gap: ${this.#options.gap}px;` });

        if (carouselCells > this.#options.visibleCount) {
            const carouselPrev = insertElement('button', this.#carouselWrap, { class: 'carousel-button', 'data-direction': 'prev' });
            const carouselNext = insertElement('button', this.#carouselWrap, { class: 'carousel-button', 'data-direction': 'next' });
            carouselPrev.appendChild(getIcon('arrow_left'));
            carouselNext.appendChild(getIcon('arrow_right'));
            carouselPrev.addEventListener('click', () => this.scrollTo(-1), { passive: true });
            carouselNext.addEventListener('click', () => this.scrollTo(1), { passive: true });
            const indexElementWrap = insertElement('div', this.#carouselWrap, { class: 'carousel-button carousel-current-index' });
            this.#carouselCurrentIndexElement = insertElement('span', indexElementWrap);
            this.#carouselCurrentIndexElement.textContent = this.#getVisibleIndexes(this.#currentIndex).map(i => i + 1).join(',');
            indexElementWrap.appendChild(document.createTextNode(' / '));
            insertElement('span', indexElementWrap, undefined, this.#items.length);
        }

        this.updateVisibleElements(this.#currentIndex, this.#options.visibleCount);

        return this.#carouselWrap;
    }

    updateVisibleElements(startIndex, itemsCount, direction = null) {
        const itemsToDisplay = [];
        const totalItems = this.#items.length;
        let displayedCells = 0;
        let i = 0;

        // Collect elements by number of cells
        while (displayedCells < itemsCount && i < totalItems * 2) {
            const index = (startIndex + i) % totalItems;
            const item = this.#items[index];

            if (!itemsToDisplay.includes(item)) {
                itemsToDisplay.push(item);
                displayedCells += item.isWide ? 2 : 1;
            }

            i++;
        }

        // Remove those that should no longer be there
        for (const item of this.#visibleItems) {
            if (!itemsToDisplay.includes(item)) {
                this.#removeItemFromDOM(item);
                this.#visibleItems.delete(item);
            }
        }

        // Add the missing ones in the correct order
        const usePrepend = direction && direction < 0;
        if (usePrepend) itemsToDisplay.reverse();

        itemsToDisplay.forEach(item => {
            if (!this.#visibleItems.has(item)) {
                this.#addItemToDOM(item, usePrepend);
                this.#visibleItems.add(item);
            }
        });
    }

    #addItemToDOM(item, usePrepend = false) {
        if (!item.element) {
            const itemWidth = item.isWide ? this.#options.itemWidth * 2 + this.#options.gap : this.#options.itemWidth;
            const itemHeight = itemWidth / item.aspectRatio;
            item.element = createElement('div', { class: 'carousel-item', style: `width: ${itemWidth}px; height: ${itemHeight}px; contain-intrinsic-size: ${itemWidth}px ${itemHeight}px;` });
            item.element.appendChild(this.#generator(item.data));
        }
        if (usePrepend) this.#itemsListWrap.prepend(item.element);
        else this.#itemsListWrap.appendChild(item.element);
        item.inDOM = true;
    }

    #removeItemFromDOM(item) {
        item.inDOM = false;
        item.element.remove();
        this.#onElementRemove?.(item.element, item.data);
        delete item.element;
    }

    #getVisibleIndexes(startIndex) {
        const visibleIndexes = [];
        const totalItems = this.#items.length;
        for (let i = 0; i < this.#options.visibleCount; i++) {
            const index = (startIndex + i) % totalItems;
            if (this.#items[index].isWide) i++;
            visibleIndexes.push(index);
        }
        return visibleIndexes;
    }

    scrollTo(direction, animation = true) {
        if (this.#isAnimating) return;

        const totalItems = this.#items.length;
        const newIndex = (totalItems + this.#currentIndex + direction) % totalItems;
        const visibleIndexes = this.#getVisibleIndexes(this.#currentIndex);
        const newVisibleIndexes = this.#getVisibleIndexes(newIndex);
        if (this.#carouselCurrentIndexElement) this.#carouselCurrentIndexElement.textContent = newVisibleIndexes.map(i => i + 1).join(',');

        if (animation) {
            this.#isAnimating = true;
            const startIndex = direction > 0 ? this.#currentIndex : newIndex;

            let addedCells = 0;
            let removedCells = 0;
            for (const i of visibleIndexes) {
                if (!newVisibleIndexes.includes(i)) removedCells += (this.#items[i].isWide ? 2 : 1);
            }
            for (const i of newVisibleIndexes) {
                if (!visibleIndexes.includes(i)) addedCells += (this.#items[i].isWide ? 2 : 1);
            }
            const shiftedCells = !addedCells || !removedCells ? Math.max(addedCells, removedCells) : Math.min(addedCells, removedCells);
            const shiftX = shiftedCells * (this.#options.itemWidth + this.#options.gap);

            this.updateVisibleElements(startIndex, this.#options.visibleCount + shiftedCells, direction);
            animateElement(this.#itemsListWrap, {
                keyframes: {
                    transform: direction > 0 ? [ 'translateX(0px)', `translateX(${- shiftX}px)` ] : [ `translateX(${- shiftX}px)`, 'translateX(0px)' ]
                },
                duration: 300,
                easing: 'cubic-bezier(0.33, 1, 0.68, 1)'
            }).then(() => {
                this.updateVisibleElements(newIndex, this.#options.visibleCount);
                this.#isAnimating = false;
            });
        } else {
            this.updateVisibleElements(newIndex, this.#options.visibleCount);
        }

        this.#currentIndex = newIndex;
        const newItem = this.#items[this.#currentIndex];
        this.#onScroll?.(newItem.id);
    }
}
