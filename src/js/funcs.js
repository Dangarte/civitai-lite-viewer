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

const FILESIZE_UNITS = [
    [1024 ** 4, 'tb'],
    [1024 ** 3, 'gb'],
    [1024 ** 2, 'mb'],
    [1024, 'kb'],
    [1, 'b'],
];
function filesizeToString(size) {
    const l = window.languagePack?.fileSize ?? {};
    for (let i = 0; i < FILESIZE_UNITS.length; i++) {
        const [factor, key] = FILESIZE_UNITS[i];
        if (size >= factor) {
            const value = size / factor;
            const roundTo = value < 10 ? 100 : value < 100 ? 10 : 1;
            return `${Math.round(value*roundTo)/roundTo} ${l[key] ?? key}`;
        }
    }
    return `0 ${l.b ?? 'b'}`;
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

const TIME_UNITS = [
    [31536000, 'year'],
    [2592000,  'month'],
    [604800,   'week'],
    [86400,    'day'],
    [3600,     'hour'],
    [60,       'minute'],
    [1,        'second'],
];
function pluralIndex(n) {
    const n10 = n % 10;
    const n100 = n % 100;
    return (n10 === 1 && n100 !== 11) ? 0 : (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) ? 1 : 2;
}
function timeAgo(seconds) {
    const lang = window.languagePack?.time;

    if (seconds === 0) return lang?.now ?? 'now';

    const future = seconds < 0;
    let s = future ? -seconds : seconds;

    const base = future ? (lang?.unitAfter ?? 'in %n %unit') : (lang?.unitAgo ?? '%n %unit ago');

    for (let i = 0; i < TIME_UNITS.length; i++) {
        const [step, key] = TIME_UNITS[i];
        if (s >= step) {
            const n = Math.floor(s / step);
            const forms = window.languagePack?.units?.[key];
            const unit = forms?.[pluralIndex(n)] ?? key;

            return base.replace('%n', n).replace('%unit', unit);
        }
    }

    return lang?.now ?? 'now';
}

function pluralize(count, [one, few, many]) {
    const i = pluralIndex[count];
    if (i === 0) return one;
    if (i === 1) return few;
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

class Ticker {
    static #heap = [];
    static #timer = null;
    static #paused = false;
    static #next = null;

    // ---------- public API ----------

    static add(callback, options) {
        const item = this.#createItem(callback, options);
        this.#heapPush(item);
        if (!this.#paused) this.#schedule();
        return item;
    }

    static remove(item) {
        item.cancelled = true;
        delete item.callback;
    }

    static update(item, options) {
        options = this.#parseOptions(options);
        if (!options) throw new Error("Ticker: invalid options");

        const { step, next } = options;
        const newItem = { callback: item.callback, step, next, cancelled: false };

        this.remove(item);
        this.#heapPush(newItem);
        if (!this.#paused) this.#schedule();
        return newItem;
    }

    static pause() {
        if (this.#paused) return;
        this.#paused = true;
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }

    static resume() {
        if (!this.#paused) return;
        this.#paused = false;
        this.#run(Date.now()); // catch-up
    }

    // ---------- internal ----------

    static #parseOptions(options) {
        if (!options || typeof options !== "object") return null;

        const now = Date.now();

        let next;
        if ("every" in options) {
            const step = options.every;
            if ( typeof step !== "number" || !Number.isFinite(step) || step <= 0) return null;

            next = now - (now % step) + step;
            return { step, next };
        }

        if ("at" in options) {
            next = options.at;
            if (typeof next !== "number" || !Number.isFinite(next)) return null;

            return { step: 0, next };
        }

        return null;
    }

    static #createItem(callback, options) {
        options = this.#parseOptions(options);
        if (!options) throw new Error("Ticker: invalid options");

        const { step, next } = options;
        return { callback, step, next, cancelled: false };
    }

    static #schedule() {
        if (this.#paused) return;

        const item = this.#heapPeek();
        if (!item) return;

        if (this.#timer !== null) {
            if (item.next >= this.#next) return;
            clearTimeout(this.#timer)
            this.#timer = null;
        }

        this.#next = item.next;

        const now = Date.now();
        const delay = Math.max(100, item.next - now);

        this.#timer = setTimeout(() => {
            this.#timer = null;
            this.#run(Date.now());
        }, delay);
    }

    static #run(now) {
        while (true) {
            const item = this.#heapPeek();
            if (!item || item.next > now) break;

            this.#heapPop();

            if (item.cancelled) continue;

            let next = item.callback(now) ?? null;

            if (next === null && item.step > 0) {
                // interval: recalculation taking into account the missed
                const missed = Math.floor((now - item.next) / item.step) + 1;
                next = item.next + missed * item.step;
            }

            if (next !== null) {
                item.next = Math.max(next, now + 1);
                this.#heapPush(item);
            }
        }

        this.#schedule();
    }

    // ---------- min-heap ----------

    static #heapPeek() {
        return this.#heap[0];
    }

    static #heapPush(item) {
        const h = this.#heap;
        h.push(item);
        let i = h.length - 1;

        while (i > 0) {
            const p = (i - 1) >> 1;
            if (h[p].next <= item.next) break;
            h[i] = h[p];
            i = p;
        }

        h[i] = item;
    }

    static #heapPop() {
        const h = this.#heap;
        const top = h[0];
        const last = h.pop();
        if (!h.length) return top;

        let i = 0;
        while (true) {
            let l = i * 2 + 1;
            let r = l + 1;
            if (l >= h.length) break;

            let c = r < h.length && h[r].next < h[l].next ? r : l;
            if (h[c].next >= last.next) break;

            h[i] = h[c];
            i = c;
        }

        h[i] = last;
        return top;
    }
}

class Color {
    static #COLORS_STRING = {
        aliceblue:'#f0f8ff',antiquewhite:'#faebd7',aqua:'#00ffff',aquamarine:'#7fffd4',azure:'#f0ffff',beige:'#f5f5dc',bisque:'#ffe4c4',black:'#000000',blanchedalmond:'#ffebcd',blue:'#0000ff',blueviolet:'#8a2be2',
        brown:'#a52a2a',burlywood:'#deb887',cadetblue:'#5f9ea0',chartreuse:'#7fff00',chocolate:'#d2691e',coral:'#ff7f50',cornflowerblue:'#6495ed',cornsilk:'#fff8dc',crimson:'#dc143c',cyan:'#00ffff',darkblue:'#00008b',
        darkcyan:'#008b8b',darkgoldenrod:'#b8860b',darkgray:'#a9a9a9',darkgrey:'#a9a9a9',darkgreen:'#006400',darkkhaki:'#bdb76b',darkmagenta:'#8b008b',darkolivegreen:'#556b2f',darkorange:'#ff8c00',darkorchid:'#9932cc',
        darkred:'#8b0000',darksalmon:'#e9967a',darkseagreen:'#8fbc8f',darkslateblue:'#483d8b',darkslategray:'#2f4f4f',darkslategrey:'#2f4f4f',darkturquoise:'#00ced1',darkviolet:'#9400d3',deeppink:'#ff1493',
        deepskyblue:'#00bfff',dimgray:'#696969',dimgrey:'#696969',dodgerblue:'#1e90ff',firebrick:'#b22222',floralwhite:'#fffaf0',forestgreen:'#228b22',fuchsia:'#ff00ff',gainsboro:'#dcdcdc',ghostwhite:'#f8f8ff',
        gold:'#ffd700',goldenrod:'#daa520',gray:'#808080',grey:'#808080',green:'#008000',greenyellow:'#adff2f',honeydew:'#f0fff0',hotpink:'#ff69b4',indianred:'#cd5c5c',indigo:'#4b0082',ivory:'#fffff0',khaki:'#f0e68c',
        lavender:'#e6e6fa',lavenderblush:'#fff0f5',lawngreen:'#7cfc00',lemonchiffon:'#fffacd',lightblue:'#add8e6',lightcoral:'#f08080',lightcyan:'#e0ffff',lightgoldenrodyellow:'#fafad2',lightgray:'#d3d3d3',lightgrey:'#d3d3d3',
        lightgreen:'#90ee90',lightpink:'#ffb6c1',lightsalmon:'#ffa07a',lightseagreen:'#20b2aa',lightskyblue:'#87cefa',lightslategray:'#778899',lightslategrey:'#778899',lightsteelblue:'#b0c4de',lightyellow:'#ffffe0',lime:'#00ff00',
        limegreen:'#32cd32',linen:'#faf0e6',magenta:'#ff00ff',maroon:'#800000',mediumaquamarine:'#66cdaa',mediumblue:'#0000cd',mediumorchid:'#ba55d3',mediumpurple:'#9370db',mediumseagreen:'#3cb371',mediumslateblue:'#7b68ee',
        mediumspringgreen:'#00fa9a',mediumturquoise:'#48d1cc',mediumvioletred:'#c71585',midnightblue:'#191970',mintcream:'#f5fffa',mistyrose:'#ffe4e1',moccasin:'#ffe4b5',navajowhite:'#ffdead',navy:'#000080',oldlace:'#fdf5e6',
        olive:'#808000',olivedrab:'#6b8e23',orange:'#ffa500',orangered:'#ff4500',orchid:'#da70d6',palegoldenrod:'#eee8aa',palegreen:'#98fb98',paleturquoise:'#afeeee',palevioletred:'#db7093',papayawhip:'#ffefd5',peachpuff:'#ffdab9',
        peru:'#cd853f',pink:'#ffc0cb',plum:'#dda0dd',powderblue:'#b0e0e6',purple:'#800080',rebeccapurple:'#663399',red:'#ff0000',rosybrown:'#bc8f8f',royalblue:'#4169e1',saddlebrown:'#8b4513',salmon:'#fa8072',sandybrown:'#f4a460',
        seagreen:'#2e8b57',seashell:'#fff5ee',sienna:'#a0522d',silver:'#c0c0c0',skyblue:'#87ceeb',slateblue:'#6a5acd',slategray:'#708090',slategrey:'#708090',snow:'#fffafa',springgreen:'#00ff7f',steelblue:'#4682b4',tan:'#d2b48c',
        teal:'#008080',thistle:'#d8bfd8',tomato:'#ff6347',transparent:'#00000000',turquoise:'#40e0d0',violet:'#ee82ee',wheat:'#f5deb3',white:'#ffffff',whitesmoke:'#f5f5f5',yellow:'#ffff00',yellowgreen:'#9acd32'
    };

    static #REGEX = {
        rgbaMatch: /rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:\/\s*(\d*\.?\d+))?\s*\)/,
        hslaMatch: /hsla?\(\s*(\d+)(?:deg)?\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%\s*(?:\/\s*(\d*\.?\d+))?\s*\)/,
        hexTest: /^[0-9a-fA-F]{3,4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/,
    };

    static convert(color, toFormat, silent = false) {
        // Input format check
        let rgba;
        if (typeof color === 'string') {
            if (color.startsWith('rgb')) {
                // Support for "rgb(255, 0, 0)" and "rgb(255 0 0 / 1)"
                const match = color.match(this.#REGEX.rgbaMatch);
                if (!match) {
                    if (silent) return null;
                    else throw new Error("Incorrect RGB(A) format");
                }

                rgba = {
                    r: parseInt(match[1], 10),
                    g: parseInt(match[2], 10),
                    b: parseInt(match[3], 10),
                    a: match[4] !== undefined ? parseFloat(match[4]) : 1
                };

                if (toFormat === 'rgba') return rgba;
            } else if (color.startsWith('hsl')) {
                // Support "hsl(205deg 100% 50%)", "hsl(205, 100%, 50%)", "hsl(205 100% 50% / 0.5)"
                const match = color.match(this.#REGEX.hslaMatch);
                if (!match) {
                    if (silent) return null;
                    else throw new Error("Incorrect HSL(A) format");
                }

                const hsla = {
                    h: parseInt(match[1], 10),
                    s: parseFloat(match[2]),
                    l: parseFloat(match[3]),
                    a: match[4] !== undefined ? parseFloat(match[4]) : 1
                };

                if (toFormat === 'hsla') return hsla;

                rgba = this.hslToRgba(hsla);
            } else {
                if (this.#COLORS_STRING[color]) color = this.#COLORS_STRING[color];
                color = color[0] === '#' ? color.substring(1) : color;
                if (!this.#REGEX.hexTest.test(color)) {
                    if (silent) return null;
                    else throw new Error("Incorrect hex length or format");
                }

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
            if (silent) return null;
            else throw new Error("Unsupported color format");
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
                if (silent) return null;
                else throw new Error("Unsupported target color format");
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
        return { r, g, b, a: Math.round((a / 255) * 100) / 100 };
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

    #drawItem(item, forceSync = false) {
        if (!item.element) {
            this.#queueAdd(item, forceSync); // gen element

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
        const FRAME_BUDGET = 2;             // 2 ms
        const MAX_WEIGHT_PER_FRAME = 60;    // 6 large images or 12 blurhashes

        // If the scrolling is too fast -> lower the maximum weight
        const weightLimit = startTime - this.#lastScrollTime < 10 && this.#scrollSpeed > (this.windowHeight / 50) ? this.#scrollSpeed > (this.windowHeight / 25) ? 4 : 9 : 100;

        let consumedWeight = 0;
        for (const itemId of this.#queueList) {
            if (performance.now() - startTime > FRAME_BUDGET || consumedWeight >= MAX_WEIGHT_PER_FRAME) break;

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
        // Expanding should be INSTANTLY (.9), contracting slowly (.1)
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
    #options;
    #currentIndex;
    #len;
    #items;
    #renderedItems;
    #height;
    #totalWidth;
    #widths;
    #prefix;
    #offsetCorrection;
    #container;
    #track;
    #counter;

    constructor(list, options) {
        this.#options = {
            gap: options.gap ?? 12,
            viewportWidth: options.viewportWidth ?? 800,
            viewportMaxHeight: options.viewportMaxHeight ?? 1000,
            visibleCount: options.visibleCount ?? 3,
            onElementRemove: options.onElementRemove,
            onScroll: options.onScroll,
            generator: options.generator
        };
        this.#currentIndex = options.active ?? 0;
        this.#renderedItems = new Map();
        this.#items = list.map(item => {
            const ratio = Math.max(0.5, Math.min(2.0, item.aspectRatio));
            return { ...item, ratio };
        });
        this.#len = this.#items.length;

        const n = this.#options.visibleCount;
        const gap = this.#options.gap;
        const vw = this.#options.viewportWidth;
        const wideAspectRatio = 1.25;

        let minHeight = this.#options.viewportMaxHeight;
        for (let i = 0; i < this.#len; i++) {
            let sumRatio = 0;
            let occupiedSlots = 0;
            let itemsInWindow = 0;

            while (occupiedSlots < n) {
                const item = this.#items[(i + itemsInWindow) % this.#len];
                const itemSlots = (n > 1 && item.ratio >= wideAspectRatio) ? 2 : 1;

                if (occupiedSlots + itemSlots > n) break;

                sumRatio += item.ratio;
                occupiedSlots += itemSlots;
                itemsInWindow++;

                if (itemsInWindow === this.#len) break;
            }

            if (itemsInWindow > 0) {
                const currentGapsWidth = (itemsInWindow - 1) * gap;
                const currentHeight = (vw - currentGapsWidth) / sumRatio;
                if (currentHeight < minHeight) minHeight = currentHeight;
            }
        }
        this.#height = Math.round(minHeight);

        this.#widths = this.#items.map(it => Math.round(this.#height * it.ratio));
        this.#prefix = [0];
        for (let i = 0; i < this.#len; i++) {
            this.#prefix[i + 1] = this.#prefix[i] + this.#widths[i] + this.#options.gap;
        }
        this.#totalWidth = this.#prefix[this.#len];

        this.#items.forEach((item, i) => {
            item.width = this.#widths[i];
            item.height = this.#height;
        });

        // init
        this.#container = createElement('div', { class: 'carousel' });
        this.#container.style.width = this.#options.viewportWidth + 'px';
        this.#container.style.height = this.#height + 'px';
        this.#container.style.setProperty('--gap', this.#options.gap + 'px');

        this.#track = insertElement('div', this.#container, { class: 'carousel-items' });
        this.#counter = insertElement('div', this.#container, { class: 'carousel-counter' });

        const prev = insertElement('button', this.#container, { class: 'carousel-button prev' });
        prev.appendChild(getIcon('arrow_left'));
        prev.onclick = () => this.move(-1);

        const next = insertElement('button', this.#container, { class: 'carousel-button next' });
        next.appendChild(getIcon('arrow_right'));
        next.onclick = () => this.move(1);

        this.update(true);
    }

    get element() {
        return this.#container;
    }

    #getCircularIndex(i) {
        return ((i % this.#len) + this.#len) % this.#len;
    }

    #getX(i) {
        const cycle = Math.floor(i / this.#len);
        const idx = this.#getCircularIndex(i);
        return cycle * this.#totalWidth + this.#prefix[idx];
    }

    move(step) {
        this.#currentIndex += step;

        // normalization
        if (Math.abs(this.#currentIndex) > this.#len * 10) {
            const posBefore = this.#getX(this.#currentIndex);

            this.#currentIndex = this.#getCircularIndex(this.#currentIndex);

            const posAfter = this.#getX(this.#currentIndex);
            const delta = posBefore - posAfter;

            this.#track.style.transition = 'none';
            this.#offsetCorrection = (this.#offsetCorrection || 0) + delta;

            this.#track.offsetHeight; // reflow
            this.#track.style.transition = '';
        }

        this.update();
    }

    update(initial = false) {
        const options = this.#options;
        const baseOffset = -this.#getX(this.#currentIndex);

        const offset = baseOffset + (this.#offsetCorrection || 0);
        this.#track.style.transform = `translateX(${Math.round(offset)}px)`;

        const visible = new Set();

        // --- right ---
        let x = 0, i = this.#currentIndex;
        while (x < options.viewportWidth * 2) {
            visible.add(i);
            x += this.#widths[this.#getCircularIndex(i)] + options.gap;
            i++;
        }

        // --- left ---
        x = 0; i = this.#currentIndex - 1;
        while (x < options.viewportWidth) {
            visible.add(i);
            x += this.#widths[this.#getCircularIndex(i)] + options.gap;
            i--;
        }

        // --- remove ---
        for (const [idx, item] of this.#renderedItems) {
            if (!visible.has(idx)) {
                options.onElementRemove?.(item.element, item.data);
                item.wrapper.remove();
                this.#renderedItems.delete(idx);
            }
        }

        // --- render ---
        for (const idx of visible) {
            if (!this.#renderedItems.has(idx)) {
                this.#renderItem(idx);
            }
        }

        // --- counter ---
        const visibleReal = [];
        const viewportStart = this.#getX(this.#currentIndex);
        const viewportEnd = viewportStart + options.viewportWidth;
        for (const idx of visible) {
            const realIndex = this.#getCircularIndex(idx);
            const itemStart = this.#getX(idx);
            const itemEnd = itemStart + this.#widths[realIndex];
            const isVisible = itemEnd > viewportStart && itemStart < viewportEnd;
            if (isVisible) visibleReal.push(realIndex);
        }

        const parts = [];
        let segmentStart = visibleReal[0];
        let prev = visibleReal[0];
        for (let i = 1; i < visibleReal.length; i++) {
            const curr = visibleReal[i];
            if (curr !== prev + 1) {
                parts.push([segmentStart, prev]);
                segmentStart = curr;
            }
            prev = curr;
        }
        parts.push([segmentStart, prev]);
        const format = ([s, e]) => s === e ? `${s + 1}` : `${s + 1}–${e + 1}`;

        this.#counter.textContent = parts.map(format).join(', ') + ` / ${this.#len}`;

        // --- onScroll ---
        const realIndex = this.#getCircularIndex(this.#currentIndex);
        options.onScroll?.(this.#items[realIndex]?.id);
    }

    #renderItem(virtualIndex) {
        const realIndex = this.#getCircularIndex(virtualIndex);
        const item = this.#items[realIndex];
        const x = this.#getX(virtualIndex);

        const wrapper = createElement('div', { class: 'carousel-item' });
        wrapper.style.width = this.#widths[realIndex] + 'px';
        wrapper.style.height = this.#height + 'px';
        wrapper.style.containIntrinsicSize = `${this.#widths[realIndex]}px ${this.#height}px`;
        wrapper.style.left = `${Math.round(x)}px`;
        const content = this.#options.generator(item);
        wrapper.appendChild(content);
        this.#track.appendChild(wrapper);

        this.#renderedItems.set(virtualIndex, { wrapper, element: content, data: item });
    }
}

// ========================
//     Custom elements
// ========================

class RelativeTime extends HTMLElement {
    static observedAttributes = ["datetime"];

    #target;
    #tickHandle;

    constructor(datetime = null) {
        super();
        this.#target = null;
        if (datetime !== null) this.setAttribute('datetime', datetime);
    }

    #tick(now) {
        if (!this.isConnected) {
            this.#clear();
            return null;
        }

        return this.#update(now);
    }

    #clear() {
        if (this.#tickHandle) Ticker.remove(this.#tickHandle);
        this.#tickHandle = null;
    }

    connectedCallback() {
        this.#parse();
        this.#clear();
        this.#tickHandle = Ticker.add(now => this.#tick(now), { every: 1000 });
    }

    disconnectedCallback() {
        this.#clear();
    }

    attributeChangedCallback(name) {
        if (name === "datetime") {
            this.#parse();
            const next = this.#update(Date.now());
            if (this.#tickHandle) {
                if (next !== null && this.#tickHandle.next !== next) this.#tickHandle = Ticker.update(this.#tickHandle, { at: next });
                else if (next === null && this.#tickHandle.step !== 1000) this.#tickHandle = Ticker.update(this.#tickHandle, { every: 1000 });
            } if (this.isConnected) {
                this.#tickHandle = Ticker.add(now => this.#tick(now), next !== null ? { at: next } : { every: 1000 });
            }
        }
    }

    #parse() {
        const value = this.getAttribute("datetime");
        const t = value ? Date.parse(value) : NaN;
        this.#target = Number.isFinite(t) ? t : null;
    }

    #update(now) {
        if (this.#target === null) {
            this.textContent = "—";
            this.#clear();
            return null;
        }

        const diffMs = this.#target - now;
        const absMs = Math.abs(diffMs);
        const nowSec = (now / 1000) | 0;
        const targetSec = (this.#target / 1000) | 0;
        const s = targetSec - nowSec;
        this.textContent = timeAgo(-s);

        // <= 1 minute -> refresh every second
        if (absMs <= 60000) return null;

        if (absMs >= 86400000) {
            this.#clear();
            return null;
        }

        const unitMs = absMs >= 86400000 ? 86400000 : absMs >= 3600000 ? 3600000 : 60000;
        const rem = absMs % unitMs;
        const stepMs = rem === 0 ? unitMs : rem;
        const next = now + stepMs;

        return next > now ? next : now + 1000;
    }

    get datetimeAsNumber() {
        return this.#target;
    }
}

customElements.define('relative-time', RelativeTime);
