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

function replaceElement(newChild, oldChild) {
    oldChild.parentNode.replaceChild(newChild, oldChild);
    return newChild;
}

function insertTextNode(text, parent) {
    parent.appendChild(document.createTextNode(text));
}

function animateElement(element, options) {
    const { keyframes, framescount, timing = {}, duration, easing, fill, timeline = document.timeline } = options;
    if (framescount !== undefined) timing.number = framescount;
    if (duration !== undefined) timing.duration = duration;
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

function isEquals(obj1, obj2, options = {strict: true}) {
    let type1 = typeof(obj1),
        type2 = typeof(obj2);

    if(type1 === 'object') {
        if(Array.isArray(obj1)) type1 = 'array';
        if(Array.isArray(obj2)) type2 = 'array';
    }

    if(type1 !== type2) return false;

    switch(type1) {
        case 'boolean':
        case 'symbol':
        case 'number':
        case 'string': {
            return Boolean(obj1 === obj2);
        }
        case 'object': {
            if(obj1 === null || obj2 === null) return Boolean(obj1 === obj2);

            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);
            if(keys1.length !== keys2.length) return false;

            for(let i = 0; i < keys1.length; i++) {
                if(isEquals(obj1[keys1[i]], obj2[keys1[i]], options) === false) return false;
            }
            break;
        }
        case 'array': {
            if(obj1.length !== obj2.length) return false;

            if(options.strict === true) {
                for(let i = 0; i < obj1.length; i++) {
                    if(isEquals(obj1[i], obj2[i], options) === false) return false;
                }
            }
            else {
                for(let i = 0; i < obj1.length; i++) {
                    for(let j = 0; j < obj2.length; j++) {
                        if(isEquals(obj1[i], obj2[j], options) === false) return false;
                        delete obj2[j];
                    }
                }
            }
            break;
        }
        case 'undefined': {
            return false;
        }
        case 'function':
        default: {
            return false;
        }
    }

    return true;
}

function isURL(string) {
    try {
        const url = new URL(string);
        if (url.host.indexOf('%20') !== -1) return false;
        return Boolean(url.host);
    } catch (_) {
        return false;
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

// TODO: Animate scroll to element (when navigating with the keyboard)
class MasonryLayout {
    #container;
    #generator;
    #options;
    #isPassive;
    #allowUseElementFromAddItems = false; // A switch that allows elements to be reused when the number of columns changes

    #columns = [];
    #items = [];
    #itemsById = new Map();
    #inViewport = new Set();
    #focusedItem = null;

    #onScroll;
    #onResize;
    #onKeydown;

    #onElementRemove;

    constructor(container, options) {
        this.#container = container;
        this.#generator = options.generator;
        this.#isPassive = options.passive ?? false;
        this.#options = {
            itemWidth: options.itemWidth ?? 300,
            itemHeight: options.itemHeight ?? null,
            gap: options.gap ?? 8,
            minOverscan: options.minOverscan ?? 1,
            maxOverscan: options.maxOverscan ?? 3,
            speedFactor: options.speedFactor ?? 300,
            stopThreshold: options.stopThreshold ?? 0.1,
            cooldownTime: options.cooldownTime ?? 200,
            disableVirtualScroll: options.disableVirtualScroll ?? false,
        };
        this.#onElementRemove = options.onElementRemove;

        this.#columns = [];
        this.#items = [];
        this.#inViewport = new Set();
        this.#itemsById = new Map();
        this.#focusedItem = null;

        this.#onScroll = !this.#options.disableVirtualScroll ? this.#handleScroll.bind(this) : null;
        this.#onResize = this.#handleResize.bind(this);
        this.#onKeydown = this.#handleKeydown.bind(this);

        this.#init();
    }

    resize(animate = false) {
        const options = this.#options;
        this.#columns = [];
        const columnsCount = Math.floor((window.innerWidth - options.gap) / (options.itemWidth + options.gap)) || 1;
        for(let i = 0; i < columnsCount; i++) {
            this.#columns.push({
                height: 0,
                index: this.#columns.length
            });
        }

        // skip all if layout is empty
        if (!this.#items.length) {
            this.#container.style.width = `${columnsCount * (options.itemWidth + options.gap) - options.gap}px`;
            return;
        }

        // Calc current positions
        const currentPositions = new Map();
        if (animate) {
            this.#inViewport.forEach(item => {
                currentPositions.set(item.id, item.element.getBoundingClientRect());
            });
        }

        // Recalculate the position of all elements
        const items = this.#items;
        if (items.length) {
            this.#items = [];
            this.#inViewport = new Set();
            this.#itemsById = new Map();
            this.#allowUseElementFromAddItems = true;
            this.addItems(items);
            this.#allowUseElementFromAddItems = false;

            items.forEach(item => {
                const gridItem = this.#itemsById.get(item.id);
                if (item.inDOM && !this.#inViewport.has(gridItem)) {
                    gridItem.element.remove();
                    this.#onElementRemove?.(gridItem.element, gridItem.data);
                    delete gridItem.element;
                }
            });
        }

        this.#container.style.width = `${columnsCount * (options.itemWidth + options.gap) - options.gap}px`;

        // Calc new positions and animate
        if (animate) {
            const animations = [];
            const windowHeight = window.innerHeight;
            this.#inViewport.forEach(item => {
                const keyframes = {};
                const end = item.element.getBoundingClientRect();
                if (currentPositions.has(item.id)) {
                    const start = currentPositions.get(item.id);
                    if (
                        (start.left === end.left && start.top === end.top)
                        || (start.top + start.height < 0 && end.top + end.height < 0)
                        || (start.top > windowHeight && end.top > windowHeight)
                    ) return;

                    keyframes.transform = [ `translate(${start.left - end.left}px, ${start.top - end.top}px)`, 'translate(0, 0)' ];
                } else {
                    if (end.top + end.height < 0 || end.top > windowHeight) return;
                    keyframes.transform = [ 'scale(0)', 'scale(1)' ];
                }
                animations.push({ element: item.element, keyframes });
            });

            animations.forEach(({ element, keyframes }) => animateElement(element, { keyframes, duration: 300, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }));
        }
    }

    addItems(items, dryAdd = false) {
        const options = this.#options;
        const itemsToUpdate = new Map();
        items.forEach(item => {
            if (this.#itemsById.has(item.id)) {
                if (!itemsToUpdate.has(item.id)) itemsToUpdate.set(item.id, item.data);
                return;
            }

            const targetColumn = this.#columns.reduce((minCol, col) => col.height < minCol.height ? col : minCol, this.#columns[0]);
            const cardHeight = options.itemHeight ?? (options.itemWidth / item.aspectRatio);

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

            if (this.#allowUseElementFromAddItems && item.element) gridItem.element = item.element;

            targetColumn.height += cardHeight + options.gap;

            this.#items.push(gridItem);
            this.#itemsById.set(item.id, gridItem);
        });

        // Recreate elements with new data
        if (itemsToUpdate.size) {
            itemsToUpdate.forEach((data, id) => {
                const gridItem = this.#itemsById.get(id);
                this.#inViewport.delete(gridItem);
                if (!gridItem.inDOM) gridItem.data = data;
                else {
                    this.#onElementRemove?.(gridItem.element, gridItem.data);
                    gridItem.element.remove();
                    delete gridItem.element;
                    gridItem.data = data;
                    gridItem.inDOM = false;
                }
            });
        }

        if (!this.#options.disableVirtualScroll) {
            if (!dryAdd) this.#handleScroll();
        }
        else {
            const now = performance.now();
            this.#items.forEach(item => {
                if (item.inDOM) return;
                if (!item.element) {
                    item.element = this.#generator(item.data, { itemWidth: options.itemWidth, itemHeight: options.itemHeight, isVisible: false, timestump: now });
                    item.element.tabIndex = -1;
                    item.element.style.containIntrinsicSize = `${item.boundWidth}px ${item.boundHeight}px`;
                }
                item.element.style.left = `${item.boundLeft}px`;
                item.element.style.top = `${item.boundTop}px`;

                this.#container.appendChild(item.element);
                item.inDOM = true;
                this.#inViewport.add(item);
            });
        }

        const largestColumn = this.#columns.reduce((maxCol, col) => col.height > maxCol.height ? col : maxCol, this.#columns[0]);
        this.#container.style.height = largestColumn.height > options.gap ? `${largestColumn.height - options.gap}px` : '0px';
    }

    clear() {
        this.#items.forEach(item => {
            if (!item.inDOM) return;
            this.#onElementRemove?.(item.element, item.data, true);
        });

        this.#items = [];
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
        this.#items.forEach(item => {
            if (item.inDOM) {
                item.inDOM = false;    
                if (!preventRemoveItemsFromDOM) item.element.remove();
                this.#onElementRemove?.(item.element, item.data, preventRemoveItemsFromDOM);
                delete item.element;
            }
        });
        this.#columns = null;
        this.#items = null;
        this.#inViewport = null;
        this.#itemsById = null;
        this.#focusedItem = null;
    }

    getCallbacks() {
        if (this.#isPassive) return { onScroll: this.#onScroll, onResize: this.#onResize };
        else return {};
    }

    #init() {
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

    #setFocus(item, preventScroll = false) {
        if (this.#focusedItem?.element) {
            this.#focusedItem.element.tabIndex = -1;
        }

        this.#focusedItem = item;

        if (item?.element) {
            item.element.tabIndex = 0;
            item.element.focus?.({ preventScroll });
        }
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

        const current = this.#focusedItem;
        if (!current) return;

        const next = this.#findNearestInDirection(current, direction);
        if (next) {
            this.#setFocus(next);
            // this.#setFocus(next, true);
            // next.element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        }
    }

    #lastScrollTop = 0;
    #lastScrollTime = performance.now();
    #scrollDirection = 1; // 1 down, -1 up
    #scrollSpeed = 0;
    #overscanCooldown = 0; // timer before overscan collapse
    #currentOverscan = 0; // smooth overscan that we will use
    #handleScroll(e) {
        const firstDraw = !this.#inViewport.size; // Mark this as the first rendering (the generator can render everything at once, without delays)
        const now = performance.now();
        // scrollTopRelative - used to restore elements when moving through nav history, without causing a recalculation of styles
        const currentScrollTop = typeof e?.scrollTopRelative === 'number'
                                    ? e?.scrollTopRelative
                                    : (e?.scrollTop ?? document.documentElement.scrollTop) - this.#container.offsetTop;

        // --- speed calculation
        const delta = currentScrollTop - this.#lastScrollTop;
        const dt = now - this.#lastScrollTime;
        let speed = 0;
        if (dt > 0) speed = Math.abs(delta) / dt; // px/ms

        // --- direction determination
        let direction = this.#scrollDirection;
        if (delta > 0) direction = 1;
        else if (delta < 0) direction = -1;

        // --- save the state
        this.#scrollSpeed = speed;
        this.#scrollDirection = direction;
        this.#lastScrollTop = currentScrollTop;
        this.#lastScrollTime = now;

        const options = this.#options;
        const vh = window.innerHeight;

        // --- basic overscan parameters
        const minOverscan = vh * (options.minOverscan ?? 1); // minimum: 1 screens
        const maxOverscan = vh * (options.maxOverscan ?? 3); // maximum: 3 screens
        const speedFactor = options.speedFactor ?? 300; // px/s -> overscan

        // --- recalculate the desired overscan forward
        let targetOverscan = minOverscan + Math.min(
            speed * dt * (speedFactor / 1000), // scaling speed
            maxOverscan - minOverscan
        );

        // direction: forward = more, backward = less
        let overscanForward = targetOverscan;
        let overscanBackward = minOverscan;

        if (direction < 0) {
            // moving up
            overscanForward = minOverscan;
            overscanBackward = targetOverscan;
        }

        // --- hysteresis: if the speed is low, start the collapse timer
        const stopThreshold = options.stopThreshold ?? 0.1; // px/ms
        const cooldownTime = options.cooldownTime ?? 200; // ms

        if (speed < stopThreshold) {
            if (this.#overscanCooldown === 0) {
                this.#overscanCooldown = now + cooldownTime;
            }
        } else {
            this.#overscanCooldown = 0;
        }

        // if the collapse time has passed, we reset to a minimum
        if (this.#overscanCooldown && now > this.#overscanCooldown) {
            overscanForward = minOverscan;
            overscanBackward = minOverscan;
        }

        // --- smooth interpolation (so it doesn't jitter)
        const lerp = (a, b, t) => a + (b - a) * t;
        const smooth = options.smoothFactor ?? 0.2; // the smaller, the smoother
        this.#currentOverscan = lerp(this.#currentOverscan || minOverscan, Math.max(overscanForward, overscanBackward), smooth);

        // --- final screen boundaries
        const screenTop = currentScrollTop;
        const screenBottom = currentScrollTop + vh;
        const overscanTop = screenTop - (direction < 0 ? this.#currentOverscan : minOverscan / 2);
        const overscanBottom = screenBottom + (direction > 0 ? this.#currentOverscan : minOverscan / 2);

        let hasChanges = false;

        const newStartIndex = this.#findStartIndex(overscanTop);
        const newEndIndex = this.#findEndIndex(overscanBottom, newStartIndex);

        // Remove items that are no longer visible
        for (const item of this.#inViewport) {
            if (item.index < newStartIndex || item.index > newEndIndex) {
                item.inDOM = false;
                item.element?.remove();
                this.#inViewport.delete(item);
                this.#onElementRemove?.(item.element, item.data);
                delete item.element;
                hasChanges = true;
            }
        }

        // Insert elements that are now visible
        for (let i = newStartIndex; i <= newEndIndex; i++) {
            const item = this.#items[i];

            if (!item.inDOM) {
                item.inDOM = true;
                if (!item.element) {
                    item.element = this.#generator(item.data, {
                        itemWidth: options.itemWidth,
                        itemHeight: options.itemHeight,
                        isVisible: item.boundBottom > screenTop - 300 && item.boundTop < screenBottom + 300, // isVisible - disable lazy loading
                        firstDraw,
                        timestump: now
                    });
                    item.element.tabIndex = -1;
                    item.element.style.containIntrinsicSize = `${item.boundWidth}px ${item.boundHeight}px`;
                }
                item.element.style.left = `${item.boundLeft}px`;
                item.element.style.top = `${item.boundTop}px`;

                this.#inViewport.add(item);
                this.#container.appendChild(item.element);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            const focusedItem = this.#focusedItem;
            if (!focusedItem || !focusedItem.inDOM || focusedItem.boundBottom < screenTop || focusedItem.boundTop > screenBottom) {
                let best = null;
                let bestScore = Infinity;
                this.#inViewport.forEach(item => {
                    if (item.boundBottom < screenTop || item.boundTop > screenBottom) return;

                    const dx = item.boundLeft - (focusedItem?.boundLeft ?? 0);
                    const dy = item.boundTop - (focusedItem?.boundTop ?? 0);
                    const score = Math.abs(dy) + Math.abs(dx);

                    if (score < bestScore) {
                        best = item;
                        bestScore = score;
                    }
                });

                if (this.#focusedItem?.element) this.#focusedItem.element.tabIndex = -1;
                this.#focusedItem = best || this.#inViewport.values().next().value;
                if (this.#focusedItem?.element) this.#focusedItem.element.tabIndex = 0;
            }
        }

        return currentScrollTop;
    }

    #handleResize() {
        const options = this.#options;
        const columnsCount = Math.floor((window.innerWidth - options.gap) / (options.itemWidth + options.gap)) || 1;
        if (columnsCount !== this.#columns.length) this.resize(true);
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
