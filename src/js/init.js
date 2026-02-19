/// <reference path="./_docs.d.ts" />

const CONFIG = {
    version: 33,
    extensionVertsion: 3,
    logo: 'src/icons/logo.svg',
    title: 'CivitAI Lite Viewer',
    civitai_url: 'https://civitai.com',
    api_url: 'https://civitai.com/api/v1',
    images_url: 'https://image.civitai.com',
    api_status_url: 'https://status.civitai.com/status/public',
    local_params: [ 'target', 'original', 'cache', 'width', 'height', 'fit', 'format', 'quality', 'smoothing', 'position' ], // Parameters to remove when dragging (they were added only for passing parameters from the page to the sw)
    local_urls: {
        local: 'local',
        blurHash: 'local/blurhash'
    },
    langauges: [ 'en', 'ru', 'zh', 'uk' ],
    appearance_normal: {
        appWidth: 1200,
        appWidth_small: 800,
        descriptionMaxWidth: 800,
        imageCard: {
            width: 360,
            gap: 16
        },
        modelCard: {
            width: 300,
            height: 450,
            gap: 16
        },
        modelPage: {
            carouselItemWidth: 450,
            carouselItemsCount: 2,
            carouselGap: 16
        },
        blurHashSize: 30, // minimum size of blur preview
    },
    appearance_small: {
        appWidth: 1200,
        appWidth_small: 800,
        descriptionMaxWidth: 800,
        imageCard: {
            width: 360,
            gap: 10
        },
        modelCard: {
            width: 300,
            height: 450,
            gap: 10
        },
        modelPage: {
            carouselItemWidth: 380,
            carouselItemsCount: 1,
            carouselGap: 10
        },
        blurHashSize: 30, // minimum size of blur preview
    },
    appearance: {},
    perRequestLimits: {
        models: 60,
        images: 180,
        articles: 60,
    },
    filters: {
        minPromptLength: 10,
        tagBlacklistPresetKeys: [ 'hideFurry', 'hideExtreme', 'hideGay' ],
        tagBlacklistPresets: {
            hideFurry: [
                "+5140" // furry
            ],
            hideExtreme: [
                "+2637|5219|5510", // "huge ass" or "huge breasts" or "gigantic breasts" (aka inflation)
                "+2561" // "vore"
            ],
            hideGay: [
                "+3822", // "yaoi"
                "+114923+304|2013", // "male focus" and "nude" or "nudity"
                "+279", // "futanari"
                "+308+1788-111991", // "penis" and "close-up" and not "sexual activity"
                "+3485" // "femboy"
            ],
            hideGay_nsfw: [ // Soft+ (Mature+ doesn't work because the tags aren't always accurate, and the "futanari" tag might not be in the list at all, and you need to filter it somehow even if the level is only "soft")
                "+114923+5262|3852", // "male focus" and "solo"
                // "+5262|3852+112481" // "solo" or "solo focus" and "graphic male nudity"
            ]
        }
    },
    userGroups: {
        // civbot = civitai bot (challanges, contest, etc.)
        6235605: 'civbot' // "CivBot"
    },
    minDateForNewBadge: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days model "new" (Dates are in ISO format, so they can be compared as strings)
    timeOut: 20000, // 20 sec (ms)
};

CONFIG.appearance = CONFIG.appearance_normal;

const SETTINGS = {
    api_key: null,
    language: 'en',
    theme: 'default',
    autoplay: false,
    checkpointType: 'All',
    types: [ 'Checkpoint' ],
    sort: 'Highest Rated',
    sort_images: 'Newest',
    sort_articles: 'Newest',
    period: 'Month',
    period_images: 'AllTime',
    period_articles: 'AllTime',
    baseModels: [],
    baseModels_images: [],
    blackListTags: [], // Doesn't work on images (pictures don't have tags)
    blackListTagIds: [], // With the extension from the "apiProxyExtension" folder, you can filter images by tag ID
    nsfw: true,
    nsfwLevel: 'Mature',
    browsingLevel: 4,
    groupImagesByPost: true,
    showCurrentModelVersionStats: true,
    hideFurry: false,
    hideGay: false,
    hideExtreme: false,
    hideImagesWithoutPositivePrompt: true,
    hideImagesWithoutNegativePrompt: false,
    hideImagesWithoutResources: false,
    colorCorrection: true,
    showLogs: true,
    civitaiLinksAltClickByDefault: false,
    disableRemixAutoload: false,    // Completely disables automatic loading of remix image
    disablePromptFormatting: false, // Completely disable formatting of blocks with prompts (show original content)
    assumeListSameAsModel: false,   // When opening a model from a list, use the value from the list (instead of loading it separately), (assume that when loading a list and a separate model, the data is the same)
    assumeListSameAsImage: true,    // When opening a image from a list, use the value from the list (instead of loading it separately), (assume that when loading a list and a separate image, the data is the same)
};

// Some tagIds
// TODO: List of tags in a JSON file?
//  304: nude
//  2013: nudity
//  5262: solo
//  3852: solo focus
//  5231: male
//  5232: man
//  5133: woman
//  114923: male focus
//  308: penis
//  3822: yaoi
//  5140: furry
//  1723: fat
//  2636: plump
//  122803: big belly
//  2637: huge ass
//  5219: huge breasts
//  5510: gigantic breasts
//  279: futanari
//  882: bdsm
//  511: bondage
//  2561: vore
//  122803: big belly
//  3485: femboy
//  112481: graphic male nudity
//  112683: graphic female nudity
//  1788: close-up
//  111991: sexual activity
//
// To get tags and tagIds from image
//  https://civitai.com/api/trpc/tag.getVotableTags?input=%7B%22json%22%3A%7B%22id%22%3A{imageId}%2C%22type%22%3A%22image%22%2C%22authed%22%3Atrue%7D%7D


const DEVMODE = Boolean(localStorage.getItem('civitai-lite-viewer--devmode'));
const EXTENSION_INSTALLED = Boolean(window.proxyFetchCivAPI);

Object.entries(tryParseLocalStorageJSON('civitai-lite-viewer--settings')?.settings ?? {}).forEach(([ key, value ]) => SETTINGS[key] = value);

// Check extension version
if (EXTENSION_INSTALLED) {
    if (CONFIG.extensionVertsion > window.extension_civitaiExtensionProxyAPI_vertsion) {
        document.addEventListener('DOMContentLoaded', () => {
            notify('Outdated version of the extension', 'warning');
        }, { once: true });
    }
}

// Reasons for some old code snippets
// Snippet_1:
//   The presence of a `modelId` or `imageId` in the request forces the
//   civitai api to use the old method for retrieving images,
//   and it, unlike the new one (probably a bug? But all the stats there are 0),
//   returns a response with stats.

// =================================

navigator.serviceWorker.register(`service_worker.js?v=${Number(CONFIG.version)}`, { scope: './' });

class CivitaiPublicAPI {
    // https://github.com/civitai/civitai/tree/main/src/pages/api/v1

    constructor(baseURL = CONFIG.api_url) {
        this.baseURL = baseURL;
    }

    async #getJSON({ url, target }) {
        try {
            const headers = {
                'Accept': 'application/json'
            };

            const data = await fetchJSON(url.toString(), { method: 'GET', headers });
            if (data.error) throw new Error(data.error);

            return data;
        } catch (error) {
            console.error(`Failed to fetch ${target ?? 'something'}:`, error?.message ?? error);
            throw error;
        }
    }

    async fetchModels(options = {}) {
        const {
            limit = 20, // 0 ... 100
            cursor,
            query = '',
            tag = '',
            username = '',
            status = '',
            types = [],
            baseModels = [],
            checkpointType = 'All',
            browsingLevel = 0, // ERROR: The server expects a number... but always gets a string from the url as output... as a result it returns an error that the input type is incorrect...
            sort = '',
            period = '',
            rating = '',
            favorites = false,
            hidden = false,
            primaryFileOnly = false, // Doesn't do anything without a token
            nsfw = false
        } = options;

        const url = new URL(`${this.baseURL}/models`);
        url.searchParams.append('limit', limit);
        if (cursor) url.searchParams.append('cursor', cursor);

        if (query) url.searchParams.append('query', query);
        if (tag) url.searchParams.append('tag', tag);
        if (username) url.searchParams.append('username', username);
        if (types.length > 0) url.searchParams.append('types', types.join(','));
        if (baseModels.length > 0) url.searchParams.append('baseModels', baseModels);
        if (checkpointType !== 'All') url.searchParams.append('checkpointType', checkpointType);
        if (sort) url.searchParams.append('sort', sort);
        if (period) url.searchParams.append('period', period);
        if (rating) url.searchParams.append('rating', rating);
        if (favorites) url.searchParams.append('favorites', 'true');
        if (hidden) url.searchParams.append('hidden', 'true');
        if (nsfw) url.searchParams.append('nsfw', nsfw);
        // if (primaryFileOnly) url.searchParams.append('primaryFileOnly', 'true'); // (see above)
        // if (browsingLevel) url.searchParams.append('browsingLevel', browsingLevel); // ERROR: (see above)
        if (status) url.searchParams.append('status', status);

        const data = await this.#getJSON({ url, target: 'models' });
        return data;
    }

    async fetchImages(options = {}) {
        const {
            limit = 20, // 0 ... 200
            cursor,
            modelVersionId,
            postId,
            username = '',
            userId = null,
            modelId = null, // Snippet_1
            type = '',
            nsfw = false,
            hidden = false,
            withMeta = false,
            requiringMeta = false,
            sort = '',
            period = '',
        } = options;

        const url = new URL(`${this.baseURL}/images`);
        url.searchParams.append('limit', limit);
        if (cursor) url.searchParams.append('cursor', cursor);

        if (username) url.searchParams.append('username', username);
        if (modelId) url.searchParams.append('modelId', modelId); // Snippet_1
        if (userId) url.searchParams.append('userId', userId);
        if (modelVersionId) url.searchParams.append('modelVersionId', modelVersionId);
        if (postId) url.searchParams.append('postId', postId);
        if (sort) url.searchParams.append('sort', sort);
        if (period) url.searchParams.append('period', period);
        if (hidden) url.searchParams.append('hidden', 'true');
        if (type) url.searchParams.append('type', type);
        if (nsfw) url.searchParams.append('nsfw', nsfw);
        if (withMeta) url.searchParams.append('withMeta', 'true');
        if (requiringMeta) url.searchParams.append('requiringMeta', 'true');

        const data = await this.#getJSON({ url, target: 'images' });
        return data;
    }

    async fetchImageMeta(id, nsfwLevel) {
        const url = new URL(`${this.baseURL}/images`);
        url.searchParams.append('limit', 1);

        if (id) url.searchParams.append('imageId', id);
        if (nsfwLevel) url.searchParams.append('nsfw', nsfwLevel);

        const data = await this.#getJSON({ url, target: `image meta (id: ${id}; nsfwLevel: ${nsfwLevel})` });
        return data?.items?.[0] ?? null;
    }

    async fetchModelInfo(id) {
        const url = new URL(`${this.baseURL}/models/${id}`);

        const data = await this.#getJSON({ url, target: 'model info' });
        return data;
    }

    async fetchModelVersionInfo(id, byHash = false) {
        const url = `${this.baseURL}/model-versions/${byHash ? `by-hash/${encodeURIComponent(id)}` : id}`;

        const data = await this.#getJSON({ url, target: 'model version info' });
        return data;
    }
}

// WIP
/**
 * The original API class with modified requests via an iframe proxy
 * (with responses converted to the original format)
 */
class CivitaiExtensionProxyAPI extends CivitaiPublicAPI {
    constructor(baseURL) {
        super(baseURL);
        this.IMAGE_CDN_ROOT = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA";
        console.log(`[API Bridge] Uses the civitai.com original API instead of the public one`);
    }

    async #getJSON({ route, params, target }) {
        try {
            const data = await window.proxyFetchCivAPI(route, params);
            // console.log(`[API Bridge] (${target}) Raw Data`, data);

            if (data.error) throw new Error(data.error);

            return data.response?.result?.data ?? data.response;
        } catch (error) {
            console.log(`Failed to fetch ${target ?? 'something'}:`, error?.message ?? error);
            throw error;
        }
    }

    // "1de4c2db-54a0-4fed-994f-45604bbdf0bc" --> url
    #convertUrlIdToUrl({ urlId, itemId, type = 'image', width = 450 }) {
        if (!urlId) return '';
        if (urlId.startsWith('http')) return urlId;
        return `${this.IMAGE_CDN_ROOT}/${urlId}/width=${width}/${itemId}${type === 'image' ? '.jpeg' : '.mp4'}`; // .jpeg or .mp4 - otherwise cf will return "cf-cache-status DYNAMIC"
    }

    #prepareUserBlock(user = {}) {
        if (!user || typeof user !== 'object') return {};

        if (user.deletedAt) {
            return {
                userId: user.id,
                isModerator: user.isModerator || false,
                deletedAt: user.deletedAt,
                username: '[deleted]'
            };
        }

        const urlId = user.profilePicture?.url || user.image;

        return {
            userId: user.id,
            isModerator: user.isModerator || false,
            username: user.username || '[username]',
            image: !urlId || urlId?.startsWith('https:') ? urlId : this.#convertUrlIdToUrl({ urlId: urlId, type: 'image', itemId: user.username ? encodeURIComponent(user.username) : user.id, width: 96 }),
            imageMeta: user.profilePicture ? {
                hash: user.profilePicture.hash ?? null,
                width: user.profilePicture.width ?? null,
                height: user.profilePicture.height ?? null,
            } : null,
        };
    }

    #prepareStats(rawStats) {
        if (!rawStats || typeof rawStats !== 'object') return {};

        return Object.keys(rawStats).reduce((acc, key) => {
            const normalizedKey = key.endsWith('AllTime') ? key.substring(0, key.length - 7) : key; // 'AllTime'.length = 7
            const value = rawStats[key];
            if (typeof value === 'number' && !isNaN(value)) acc[normalizedKey] = value;
            return acc;
        }, {});
    }

    #prepareMedia(media) {
        if (!media || typeof media !== 'object') return null;

        return {
            url: !media.url || media.url?.startsWith('https:') ? media.url : this.#convertUrlIdToUrl({ urlId: media.url, type: media.type, width: 450, itemId: media.id }),
            hash: media.hash,
            width: media.width,
            height: media.height,
            nsfwLevel: media.nsfwLevel,
            id: media.id,
            tags: [],
            tagIds: media.tags,
            type: media.type,
            createdAt: media.createdAt
        };
    }

    #MARK_RULES = {
        bold: t => `<strong>${t}</strong>`,
        italic: t => `<em>${t}</em>`,
        underline: t => `<u>${t}</u>`,
        strike: t => `<del>${t}</del>`,
        code: t => `<code>${t}</code>`,
        highlight: t => `<mark>${t}</mark>`,
        textStyle: (t, attrs) => {
            const styles = [];
            if (attrs.color) styles.push(`color: ${attrs.color}`);
            if (attrs.backgroundColor) styles.push(`background-color: ${attrs.backgroundColor}`);
            if (attrs.fontFamily) styles.push(`font-family: ${attrs.fontFamily}`);
            if (attrs.fontSize) styles.push(`font-size: ${attrs.fontSize}`);
            if (attrs.lineHeight) styles.push(`line-height: ${attrs.lineHeight}`);
            return styles.length > 0 ? `<span style="${styles.join('; ')}">${t}</span>` : t;
        },
        link: (t, attrs) => {
            const href = attrs.href || '#';
            const safeHref = href.startsWith('javascript:') ? '#' : escapeHtml(href);
            return `<a href="${safeHref}" target="_blank" rel="nofollow noopener">${t}</a>`;
        }
    };
    #BLOCK_RULES = {
        doc: ctx => ctx.children,
        paragraph: ctx => `<p>${ctx.children}</p>`,
        heading: ctx => {
            const level = Math.min(Math.max(ctx.node.attrs?.level || 1, 1), 6);
            return `<h${level}>${ctx.children}</h${level}>`;
        },
        bulletList: ctx => `<ul>${ctx.children}</ul>`,
        orderedList: ctx => `<ol>${ctx.children}</ol>`,
        listItem: ctx => `<li>${ctx.children}</li>`,
        blockquote: ctx => `<blockquote>${ctx.children}</blockquote>`,
        codeBlock: ctx => `<pre><code>${ctx.children}</code></pre>`,
        horizontalRule: () => `<hr />`,
        hardBreak: () => `<br />`,
        image: ctx => {
            const { src, alt } = ctx.node.attrs || {};
            return `<img src="${escapeHtml(src || '')}" alt="${escapeHtml(alt || '')}" style="max-width: 100%;" />`;
        },
        video: ctx => `<video controls src="${escapeHtml(ctx.node.attrs?.src || '')}" style="max-width: 100%;"></video>`,
        media: ctx => {
            const { type, url: urlId, filename } = ctx.node.attrs || {};
            const url = this.#convertUrlIdToUrl({ urlId, itemId: encodeURIComponent(filename || ''), width: 525 });
            if (type === 'video') return `<video controls src="${escapeHtml(url)}" style="max-width: 100%;"></video>`;
            return `<img src="${escapeHtml(url)}" alt="${escapeHtml(filename || '')}" style="max-width: 100%;" />`; // if (type === 'image')
        }
    };
    #convertContentToHtml(node) {
        if (!node) return '';

        // text
        if (node.type === 'text') {
            let text = escapeHtml(node.text || '');
            if (node.marks) {
                for (const mark of node.marks) {
                    const rule = this.#MARK_RULES[mark.type];
                    if (rule) text = rule(text, mark.attrs || {});
                }
            }
            return text;
        }

        // parse
        const childrenHtml = node.content ? node.content.map(child => this.#convertContentToHtml(child)).join('') : '';

        // blocks
        const renderer = this.#BLOCK_RULES[node.type];
        if (renderer) return renderer({ children: childrenHtml, node });

        console.warn('Unknown node type:', node.type);
        return childrenHtml;
    }

    #convertImages(items, browsingLevel) {
        return items.map(item => {
            if (browsingLevel >= 2 && item.minor) return null; // 2 = Soft. Hide all minors if browsingLevel is Soft+
            if (item.nsfwLevel > browsingLevel) return null; // Hide all above current browsingLevel level

            // Hide broken images
            if (!item.width || !item.height) {
                console.warn('The API returned a broken image, it has no dimensions...', item);
                return null;
            }

            return {
                id: item.id,
                hash: item.hash,
                meta: item.hasMeta ? item.meta || {
                    prompt: item.hasPositivePrompt ? `[Fake prompt, the API says there should be something here, but it didn't return anything]` : null,
                    negativePrompt: `[Fake prompt, API returned nothing]`,
                    civitaiResources: [
                        ...(item.modelVersionIds || []),
                        ...(item.modelVersionIdsManual || []),
                        item.modelVersionId || null
                    ].filter(Boolean).map(id => ({ modelVersionId: id })),
                } : null,
                postId: item.postId,
                userId: item.user?.id,
                username: item.user?.username || '[username]',
                tags: [],
                tagIds: item.tagIds || item.tags || [],
                url: !item.url || item.url?.startsWith('https:') ? item.url : this.#convertUrlIdToUrl({ urlId: item.url, type: item.type, itemId: item.id, width: 450 }),
                width: item.width,
                height: item.height,
                nsfwLevel: item.nsfwLevel,
                browsingLevel: item.nsfwLevel,
                type: item.type,
                createdAt: item.createdAt,
                publishedAt: item.publishedAt,
                stats: item.stats ? this.#prepareStats(item.stats) : {}
            };
        }).filter(Boolean);
    }

    #convertFiles(files, type) {
        if (!files || !Array.isArray(files) || !files.length) return [];
        return files.map(file => {
            const metadata = file.metadata ? {
                format: file.metadata.format,
                size: file.metadata.size,
                fp: file.metadata.fp,
            } : null;
            return {
                id: file.id,
                modelVersionId: file.modelVersionId,
                sizeKB: file.sizeKB,
                name: file.name,
                type: file.type,
                pickleScanResult: file.pickleScanResult,
                pickleScanMessage: file.pickleScanMessage,
                virusScanResult: file.virusScanResult,
                virusScanMessage: file.virusScanMessage,
                scannedAt: file.scannedAt,
                metadata: metadata || {},
                hashes: file.hashes ? Object.fromEntries(file.hashes.map(h => ([ h.type, h.hash ]))) : {},
                url: file.url,
                downloadUrl: `${CONFIG.civitai_url}/api/download/${type}/${file.id}?type=${file.type}${metadata ? `&format=${metadata.format}&size=${metadata.size}&fp=${metadata.fp}` : ''}`,
            }
        });
    }

    async fetchImages(options = {}) {
        const {
            limit = 20, // 0 ... 100
            cursor,
            modelVersionId,
            collectionId,
            postId,
            username = '',
            baseModels = [],
            browsingLevel,
            sort = '',
            period = '',
        } = options;

        const disableIndex = Boolean(collectionId); // Due to index, collection parameter is ignored

        const input = {
            json: {
                periodMode: 'published',
                useIndex: !disableIndex,
                include: ["cosmetics", "meta"],
                excludedTagIds: [],
                // authed: true,
                cursor
            }
        };

        if (period) input.json.period = period;
        if (sort) input.json.sort = sort;
        // if (browsingLevel) input.json.browsingLevel = browsingLevel; // Error: Strict limitation: i.e. if you specify Mature, it will be ONLY Mature, instead of Soft + Mature
        if (limit) input.json.limit = Math.min(limit, 100);
        if (modelVersionId) input.json.modelVersionId = +modelVersionId;
        if (collectionId) input.json.collectionId = +collectionId;
        if (postId) input.json.postId = +postId;
        if (username) input.json.username = username;
        if (baseModels?.length > 0) input.json.baseModels = baseModels;

        const data = (await this.#getJSON({ route: 'image.getInfinite', params: { input }, target: 'images' })).json;

        return {
            items: this.#convertImages(data.items, browsingLevel),
            metadata: {
                nextCursor: data.nextCursor
            }
        };
    }

    async fetchArticles(options = {}) {
        const {
            limit = 20, // 0 ... 100
            cursor,
            username = '',
            tags = [],
            browsingLevel,
            collectionId,
            sort = '',
            period = '',
        } = options;

        const input = {
            json: {
                periodMode: 'published',
                include: ["cosmetics", "meta"],
                excludedTagIds: [],
                // authed: true,
                cursor,
            }
        };

        if (period) input.json.period = period;
        if (sort) input.json.sort = sort;
        // if (browsingLevel) json.browsingLevel = browsingLevel; // Error: Strict limitation: i.e. if you specify Mature, it will be ONLY Mature, instead of Soft + Mature
        if (limit) input.json.limit = Math.min(limit, 100);
        if (collectionId) input.json.collectionId = +collectionId;
        if (username) input.json.username = String(username);
        if (tags.length > 0 && !tags.some(t => typeof t !== 'number' || isNaN(t))) input.json.tags = tags;

        const data = (await this.#getJSON({ route: 'article.getInfinite', params: { input }, target: 'articles' })).json;

        const items = data.items.map(item => {
            if (browsingLevel >= 2 && item.minor) return null; // 2 = Soft. Hide all minors if browsingLevel is Soft+
            if (item.nsfwLevel > browsingLevel) return null; // Hide all above current browsingLevel level

            return {
                id: item.id,
                title: item.title,
                category: item.tags?.find(t => t.isCategory)?.name || 'misc',
                availability: item.availability,
                userId: item.user?.id,
                coverImage: this.#prepareMedia(item.coverImage),
                user: this.#prepareUserBlock(item.user),
                tags: item.tags?.map(t => t.name) ?? [],
                tagIds: item.tags?.map(t => t.id) ?? [],
                nsfwLevel: item.nsfwLevel,
                publishedAt: item.publishedAt,
                stats: this.#prepareStats(item.stats)
            };
        }).filter(Boolean);

        return {
            items,
            metadata: {
                nextCursor: data.nextCursor
            }
        };
    }

    async fetchArticle(id) {
        const input = {
            json: {
                // authed: true,
                id: Number(id)
            }
        };

        const article = (await this.#getJSON({ route: 'article.getById', params: { input }, target: `article (id: ${id})` })).json;

        return {
            id: article.id,
            availability: article.availability,
            title: article.title,
            user: this.#prepareUserBlock(article.user),
            content: article.contentJson ? this.#convertContentToHtml(article.contentJson) : article.content,
            category: article.tags?.find(t => t.isCategory)?.name || 'misc',
            attachments: this.#convertFiles(article.attachments, 'attachments'),
            createdAt: article.createdAt,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            nsfwLevel: article.nsfwLevel,
            tags: article.tags?.map(t => t.name) ?? [],
            tagIds: article.tags?.map(t => t.id) ?? [],
            coverImage: this.#prepareMedia(article.coverImage),
            stats: this.#prepareStats(article.stats)
        };
    }

    // This is necessary because the public API does not include tags, and here you also need to sort the models (at least by cover images)
    async fetchModels(options) {
        const {
            limit = 20, // 0 ... 100
            cursor,
            query = '',
            tag = '',
            collectionId,
            username = '',
            types = [],
            baseModels = [],
            checkpointType = 'All',
            browsingLevel,
            sort = '',
            period = '',
        } = options;

        const input = {
            json: {
                periodMode: 'published',
                include: ["cosmetics"],
                excludedTagIds: [],
                // authed: true,
                browsingLevel: 9999, // get all lvls (otherwise, there will be the same error as with the images)
                cursor
            }
        };

        if (period) input.json.period = period;
        if (sort) input.json.sort = sort;
        if (limit) input.json.limit = Math.min(limit, 100); // useless (dont work)
        // if (browsingLevel) input.json.browsingLevel = browsingLevel;
        if (checkpointType !== 'All') input.json.checkpointType = checkpointType;
        if (types?.length > 0) input.json.types = types;
        if (collectionId) input.json.collectionId = +collectionId;
        if (username) input.json.username = username;
        if (query) input.json.query = query;
        if (tag) input.json.tag = tag;
        if (baseModels?.length > 0) input.json.baseModels = baseModels;

        const data = (await this.#getJSON({ route: 'model.getAll', params: { input }, target: 'models' })).json;

        const items = data.items.map(item => {
            if (browsingLevel >= 2 && item.minor) return null; // 2 = Soft. Hide all minors if browsingLevel is Soft+
            if (Math.round(item.nsfwLevel/2) > browsingLevel) return null; // Hide all above current browsingLevel level // kinda strange lvls in models (60? what?)

            const version = item.version;
            return {
                id: item.id,
                name: item.name,
                type: item.type,
                nsfwLevel: item.nsfwLevel,
                availability: item.availability,
                creator: this.#prepareUserBlock(item.user),
                description: '',
                modelVersions: [
                    {
                        id: version.id,
                        name: version.name,
                        images: this.#convertImages(item.images, browsingLevel),
                        availability: version.availability,
                        earlyAccessDeadline: item.earlyAccessDeadline,
                        baseModel: version.baseModel,
                        createdAt: version.createdAt,
                        publishedAt: version.publishedAt,
                        nsfwLevel: version.nsfwLevel,
                        trainedWords: version.trainedWords || [],
                    },
                    item.publishedAt === item.lastVersionAt ? null : {
                        publishedAt: item.publishedAt,
                        name: `[Fake name, the API says there should be something here, but it didn't return anything]`
                    }
                ].filter(Boolean),
                userId: item.user?.id,
                tagIds: item.tags ?? [],
                stats: this.#prepareStats(item.rank)
            };
        }).filter(Boolean);

        return {
            items,
            metadata: {
                nextCursor: data.nextCursor
            }
        };
    }

    // No images... lol...
    async fetchModelInfo_no_image_DISABLED(id) {
        const input = {
            json: {
                // authed: true,
                id: Number(id)
            }
        };

        const model = (await this.#getJSON({ route: 'model.getById', params: { input }, target: `model (id: ${id})` })).json;

        return {
            id: model.id,
            availability: model.availability,
            checkpointType: model.checkpointType,
            earlyAccessDeadline: model.earlyAccessDeadline,
            hasSuggestedResources: model.hasSuggestedResources,
            name: model.name,
            creator: this.#prepareUserBlock(model.user),
            description: model.description,
            publishedAt: model.publishedAt,
            updatedAt: model.updatedAt,
            nsfwLevel: model.nsfwLevel,
            modelVersions: model.modelVersions.map(version => {

                return {
                    id: version.id,
                    modelId: version.modelId,
                    name: version.name,
                    files: this.#convertFiles(version.files, 'models'),
                    // images: this.#convertImages(version.images, browsingLevel),
                    description: version.description,
                    availability: version.earlyAccessConfig ? 'EarlyAccess' : version.availability,
                    earlyAccessConfig: version.earlyAccessConfig,
                    earlyAccessDeadline: version.earlyAccessDeadline,
                    baseModel: version.baseModel,
                    createdAt: version.createdAt,
                    publishedAt: version.publishedAt,
                    nsfwLevel: version.nsfwLevel,
                    trainedWords: version.trainedWords || [],
                    stats: this.#prepareStats(version.rank)
                };
            }),
            tags: model.tagsOnModels?.map(t => t.name ?? t.tag?.name) ?? [],
            tagIds: model.tagsOnModels?.map(t => t.id ?? t.tag?.id) ?? [],
            stats: this.#prepareStats(model.rank)
        };
    }

    async fetchCollectionInfo(id) {
        const input = {
            json: {
                // authed: true,
                id: Number(id)
            }
        };

        const data = (await this.#getJSON({ route: 'collection.getById', params: { input }, target: `collection (id: ${id})` })).json;
        const collection = data.collection;

        return {
            id: collection.id,
            availability: collection.availability,
            name: collection.name,
            user: this.#prepareUserBlock(collection.user),
            description: collection.description,
            mode: collection.mode,
            type: collection.type,
            metadata: { ...collection.metadata },
            nsfwLevel: collection.nsfwLevel,
            image: this.#prepareMedia(collection.image),
        };
    }

    async fetchPostInfo(id) {
        const input = {
            json: {
                // authed: true,
                id: Number(id)
            }
        };

        const post = (await this.#getJSON({ route: 'post.get', params: { input }, target: `post (id: ${id})` })).json;

        return {
            id: post.id,
            availability: post.availability,
            title: post.title,
            user: this.#prepareUserBlock(post.user),
            description: post.detail,
            category: post.tags?.find(t => t.isCategory)?.name || 'misc',
            publishedAt: post.publishedAt,
            nsfwLevel: post.nsfwLevel,
            collectionId: post.collectionId,
            tags: post.tags?.map(t => t.name) ?? [],
            tagIds: post.tags?.map(t => t.id) ?? [],
        };
    }

    // model.getCollectionShowcase -> {"json":{"id":MODEL_ID,"authed":true}}
    // post.getResources -> {"json":{"id":POST_ID,"authed":true}}
}

// TODO: Prerender pages when pointerdown, and show on click
class Controller {
    static api = EXTENSION_INSTALLED ? new CivitaiExtensionProxyAPI(CONFIG.api_url) : new CivitaiPublicAPI(CONFIG.api_url);
    static appElement = document.getElementById('app');
    static #devicePixelRatio = window.devicePixelRatio;
    static #errorTimer = null;
    static #emptyImage = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>";
    static #pageNavigation = null; // This is necessary to ignore events that are no longer related to the current page (for example, after a long API load from an old page)
    static #activeVirtualScroll = [];
    static #page = null;
    static #state = {};

    static windowWidth = 0;
    static windowHeight = 0;

    static #preClickResults = {};
    static #cachedUserImages = new Map(); // try to reuse user profile images

    static #cache = {
        images: new Map(),          // images
        posts: new Map(),           // posts (in Set)
        postsInfo: new Map(),       // posts info
        models: new Map(),          // models
        articles: new Map(),        // articles
        collections: new Map(),     // collections
        modelVersions: new Map(),   // model versions
        history: new Map()          // History cache (for fast back and forth)
    };
    static #models = {
        options: [
            'AuraFlow',
            'Chroma',
            'CogVideoX',
            'Flux.1 D',
            'Flux.1 Kontext',
            'Flux.1 Krea',
            'Flux.1 S',
            'Flux.2 D',
            'Flux.2 Klein 9B',
            'Flux.2 Klein 9B-base',
            'Flux.2 Klein 4B',
            'Flux.2 Klein 4B-base',
            'HiDream',
            'Hunyuan 1',
            'Hunyuan Video',
            'Illustrious',
            'Imagen4',
            'Kolors',
            'LTXV',
            'LTXV2',
            'Lumina',
            'Mochi',
            'Nano Banana',
            'NoobAI',
            'ODOR',
            'OpenAI',
            'PixArt E',
            'PixArt a',
            'Playground v2',
            'Pony',
            'Pony V7',
            'Qwen',
            'SD 1.4',
            'SD 1.5',
            'SD 1.5 Hyper',
            'SD 1.5 LCM',
            'SD 2.0',
            'SD 2.0 768',
            'SD 2.1',
            'SD 2.1 768',
            'SD 2.1 Unclip',
            'SD 3',
            'SD 3.5',
            'SD 3.5 Large',
            'SD 3.5 Large Turbo',
            'SD 3.5 Medium',
            'SDXL 0.9',
            'SDXL 1.0',
            'SDXL 1.0 LCM',
            'SDXL Distilled',
            'SDXL Hyper',
            'SDXL Lightning',
            'SDXL Turbo',
            'SVD',
            'SVD XT',
            'Seedream',
            'Seedance',
            'Seedance 1.5',
            'Seedance 2.0',
            'Sora 2',
            'Stable Cascade',
            'Veo 3',
            'Vidu Q1',
            'Wan Video',
            'Wan Video 1.3B t2v',
            'Wan Video 14B i2v 480p',
            'Wan Video 14B i2v 720p',
            'Wan Video 14B t2v',
            'Wan Video 2.2 I2V-A14B',
            'Wan Video 2.2 T2V-A14B',
            'Wan Video 2.2 TI2V-5B',
            'Wan Video 2.5 I2V',
            'Wan Video 2.5 T2V',
            'ZImageTurbo',
            'ZImageBase',
            'Anima',
            'Kling',
            'Other'
        ],
        labels: {
            AuraFlow: 'Aura Flow',
            ZImageTurbo: 'Z-Image Turbo',
            ZImageBase: 'Z-Image Base',
            'PixArt a': 'PixArt α',
            'PixArt E': 'PixArt Σ',
            'Wan Video 2.2 I2V-A14B': 'Wan 2.2 I2V A14B',
            'Wan Video 2.2 T2V-A14B': 'Wan 2.2 T2V A14B',
            'Wan Video 2.2 TI2V-5B': 'Wan 2.2 TI2V 5B',
            'Flux.2 Klein 9B-base': 'Flux.2 Klein 9B Base',
            'Flux.2 Klein 4B-base': 'Flux.2 Klein 4B Base',
        },
        labels_short: {
            'SD 1.5 LCM': 'SD 1.5 LCM',
            'SD 1.5 Hyper': 'SD 1.5 H',
            'SD 2.1': 'SD 2.1',
            'SD 2.1 768': 'SD 2.1 768',
            'SD 3.5 Medium': 'SD 3.5 M',
            'SD 3.5 Large': 'SD 3.5 L',
            'SD 3.5 Large Turbo': 'SD 3.5 L T',
            'Flux.1 S': 'F1 S',
            'Flux.1 D': 'F1',
            'Flux.1 Krea': 'F1 Krea',
            'Flux.1 Kontext': 'F1 Ktxt',
            'Flux.2 D': 'F2',
            'Flux.2 Klein 9B': 'F2 Klein 9B',
            'Flux.2 Klein 9B-base': 'F2 Klein 9B',
            'Flux.2 Klein 4B': 'F2 Klein 4B',
            'Flux.2 Klein 4B-base': 'F2 Klein 4B',
            'Aura Flow': 'Aura',
            'SDXL 1.0': 'XL',
            'SDXL Turbo': 'XL T',
            'SDXL Lightning': 'XL Light',
            'SDXL Hyper': 'XL H',
            'PixArt α': 'PA α',
            'PixArt Σ': 'PA Σ',
            'Hunyuan 1': 'HY 1',
            'Hunyuan Video': 'HY Vid',
            'Illustrious': 'IL',
            'CogVideoX': 'Cog',
            'NoobAI': 'Noob',
            'Wan Video': 'Wan',
            'Wan Video 1.3B t2v': 'Wan 1.3B t2v',
            'Wan Video 14B t2v': 'Wan 14B t2v',
            'Wan Video 14B i2v 480p': 'Wan 14B i2v 480p',
            'Wan Video 14B i2v 720p': 'Wan 14B i2v 720p',
            'Wan Video 2.2 TI2V-5B': 'Wan 2.2 TI2V 5B',
            'Wan Video 2.2 I2V-A14B': 'Wan 2.2 I2V A14B',
            'Wan Video 2.2 T2V-A14B': 'Wan 2.2 T2V A14B',
            'Wan Video 2.5 T2V': 'Wan 2.5 T2V',
            'Wan Video 2.5 I2V': 'Wan 2.5 I2V',
            'HiDream': 'HiD',
            'ZImageTurbo': 'ZIT',
            'ZImageBase': 'ZI',
        },
        tags: {
            'AuraFlow': ['image', 'weights', 'fal-ai', 'multilingual'],
            'Chroma': ['image', 'weights', 'multilingual'],
            'CogVideoX': ['video', 'weights', 'zhipu-ai', 'multilingual'],
            'Flux.1 D': ['image', 'weights', 'black-forest-labs', 'multilingual', 'dev'],
            'Flux.1 Kontext': ['image', 'weights', 'black-forest-labs', 'multilingual'],
            'Flux.1 Krea': ['image', 'weights', 'black-forest-labs', 'multilingual'],
            'Flux.1 S': ['image', 'weights', 'black-forest-labs', 'multilingual', 'schnell'],
            'Flux.2 D': ['image', 'weights', 'black-forest-labs', 'multilingual', 'dev'],
            'Flux.2 Klein 9B': ['image', 'weights', 'black-forest-labs', 'multilingual'],
            'Flux.2 Klein 9B-base': ['image', 'weights', 'black-forest-labs', 'multilingual'],
            'Flux.2 Klein 4B': ['image', 'weights', 'black-forest-labs', 'multilingual'],
            'Flux.2 Klein 4B-base': ['image', 'weights', 'black-forest-labs', 'multilingual'],
            'HiDream': ['image', 'weights', 'chinese'],
            'Hunyuan 1': ['image', 'weights', 'tencent', 'multilingual'],
            'Hunyuan Video': ['video', 'weights', 'tencent', 'multilingual'],
            'Illustrious': ['image', 'weights', 'sdxl', 'community', 'uncensored'],
            'NoobAI': ['image', 'weights', 'sdxl', 'community', 'uncensored'],
            'Pony': ['image', 'weights', 'sdxl', 'community', 'uncensored'],
            'Pony V7': ['image', 'weights', 'sdxl', 'community', 'uncensored'],
            'Imagen4': ['image', 'closed', 'google', 'censored'],
            'Nano Banana': ['image', 'closed', 'google', 'censored'],
            'Kolors': ['image', 'weights', 'sdxl', 'kuaishou', 'chinese'],
            'LTXV': ['video', 'weights', 'lightricks', 'multilingual'],
            'Lumina': ['image', 'weights', 'multilingual'],
            'Mochi': ['video', 'weights', 'genmo', 'multilingual'],
            'ODOR': ['image', 'weights', 'multilingual'],
            'OpenAI': ['image', 'closed', 'openai', 'dalle', 'censored', 'multilingual'],
            'PixArt E': ['image', 'weights', 'multilingual'],
            'PixArt a': ['image', 'weights', 'multilingual'],
            'Playground v2': ['image', 'weights', 'sdxl', 'playground-ai', 'multilingual'],
            'Qwen': ['image', 'weights', 'alibaba', 'multilingual'],
            'SD 1.4': ['image', 'weights', 'sd15', 'stability-ai', 'legacy'],
            'SD 1.5': ['image', 'weights', 'sd15', 'stability-ai'],
            'SD 1.5 Hyper': ['image', 'weights', 'sd15', 'stability-ai'],
            'SD 1.5 LCM': ['image', 'weights', 'sd15', 'stability-ai'],
            'SD 2.0': ['image', 'weights', 'sd2', 'stability-ai', 'legacy', 'censored'],
            'SD 2.0 768': ['image', 'weights', 'sd2', 'stability-ai', 'legacy', 'censored'],
            'SD 2.1': ['image', 'weights', 'sd2', 'stability-ai', 'legacy', 'censored'],
            'SD 2.1 768': ['image', 'weights', 'sd2', 'stability-ai', 'legacy', 'censored'],
            'SD 2.1 Unclip': ['image', 'weights', 'sd2', 'stability-ai', 'legacy', 'censored'],
            'SD 3': ['image', 'weights', 'sd3', 'stability-ai', 'censored'],
            'SD 3.5': ['image', 'weights', 'sd3', 'stability-ai', 'multilingual'],
            'SD 3.5 Large': ['image', 'weights', 'sd3', 'stability-ai', 'multilingual'],
            'SD 3.5 Large Turbo': ['image', 'weights', 'sd3', 'stability-ai'],
            'SD 3.5 Medium': ['image', 'weights', 'sd3', 'stability-ai'],
            'SDXL 0.9': ['image', 'weights', 'sdxl', 'stability-ai', 'legacy'],
            'SDXL 1.0': ['image', 'weights', 'sdxl', 'stability-ai'],
            'SDXL 1.0 LCM': ['image', 'weights', 'sdxl', 'stability-ai'],
            'SDXL Distilled': ['image', 'weights', 'sdxl', 'stability-ai'],
            'SDXL Hyper': ['image', 'weights', 'sdxl', 'stability-ai'],
            'SDXL Lightning': ['image', 'weights', 'sdxl', 'stability-ai'],
            'SDXL Turbo': ['image', 'weights', 'sdxl', 'stability-ai'],
            'SVD': ['video', 'weights', 'stability-ai', 'legacy'],
            'SVD XT': ['video', 'weights', 'stability-ai'],
            'Seedream': ['image', 'weights', 'multilingual'],
            'Sora 2': ['video', 'closed', 'openai', 'censored', 'multilingual'],
            'Stable Cascade': ['image', 'weights', 'cascade', 'stability-ai'],
            'Veo 3': ['video', 'closed', 'google', 'censored', 'multilingual'],
            'Wan Video': ['video', 'weights', 'alibaba', 'multilingual', 'uncensored'],
            'Wan Video 1.3B t2v': ['video', 'weights', 'alibaba', 't2v', 'multilingual', 'uncensored'],
            'Wan Video 14B i2v 480p': ['video', 'weights', 'alibaba', 'i2v', 'multilingual', 'uncensored'],
            'Wan Video 14B i2v 720p': ['video', 'weights', 'alibaba', 'i2v', 'multilingual', 'uncensored'],
            'Wan Video 14B t2v': ['video', 'weights', 'alibaba', 't2v', 'multilingual', 'uncensored'],
            'Wan Video 2.2 I2V-A14B': ['video', 'weights', 'alibaba', 'i2v', 'multilingual', 'uncensored'],
            'Wan Video 2.2 T2V-A14B': ['video', 'weights', 'alibaba', 't2v', 'multilingual', 'uncensored'],
            'Wan Video 2.2 TI2V-5B': ['video', 'weights', 'alibaba', 'i2v', 'multilingual', 'uncensored'],
            'Wan Video 2.5 I2V': ['video', 'weights', 'alibaba', 'i2v', 'multilingual', 'uncensored'],
            'Wan Video 2.5 T2V': ['video', 'weights', 'alibaba', 't2v', 'multilingual', 'uncensored'],
            'ZImageTurbo': ['image', 'weights', 'multilingual'],
            'ZImageBase': ['image', 'weights', 'multilingual'],
            'Anima': ['image', 'weights', 'cosmos', 'circlestone-labs', 'uncensored'],
            'Kling': ['video', 'closed', 'kuaishou', 'multilingual', 'censored'],
            'Vidu Q1': ['video', 'closed', 'shengshu', 'multilingual', 'censored'],
            'Seedance': ['video', 'closed', 'seedance-ai', 'multilingual', 'censored'],
            'Seedance 1.5': ['video', 'closed', 'seedance-ai', 'multilingual', 'censored'],
            'Seedance 2.0': ['video', 'closed', 'seedance-ai', 'multilingual', 'censored'],
            'LTXV2': ['video', 'weights', 'lightricks', 'multilingual'],
            'Other': ['misc']
        }
    };
    static #types = {
        options: [
            'Checkpoint',
            'TextualInversion',
            'Hypernetwork',
            'AestheticGradient',
            'LORA',
            'LoCon',
            'DoRA',
            'Controlnet',
            'Upscaler',
            'MotionModule',
            'VAE',
            'Poses',
            'Wildcards',
            'Workflows',
            'Detection',
            'Other'
        ],
        labels: {
            TextualInversion: 'Textual Inversion',
            AestheticGradient: 'Aesthetic Gradient',
            MotionModule: 'Motion',
            Controlnet: 'ControlNet'
        },
    };
    static #nsfwLevels = {
        sort: [
            { minLevel: 32, string: 'Blocked' },
            { minLevel: 16, string: 'X' },
            { minLevel: 8, string: 'X' },
            { minLevel: 4, string: 'Mature' },
            { minLevel: 2, string: 'Soft' },
            { minLevel: 0, string: 'None' }
        ],
        string: {
            32: 'Blocked',
            16: 'X',
            8: 'X',
            4: 'Mature',
            2: 'Soft',
            0: 'None'
        }
    };
    static #listFilters = {
        nsfwOptions: [ 'None', 'Soft', 'Mature', 'X', 'true' ],
        periodOptions: [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ],
        browsingLevels: {
            'None': 1,
            'Soft': 2,
            'Mature': 4,
            'X': 16,
            'true': 32
        },
        genLabels: (options, langPath, fallbackLabels = {}) => {
            const lang = langPath ? window.languagePack?.text?.[langPath] ?? {} : {};
            return Object.fromEntries(options.map(v => [ v, lang[v] ?? fallbackLabels[v] ?? v ]));
        }
    };

    static #regex = {
        urlModels: /\/models\/(\d+)/i,              // get model id from civ url
        urlImages: /\/images\/(\d+)/i,              // get image id from civ url
        urlPosts: /\/posts\/(\d+)/i,                // get post id from civ url
        urlArticles: /\/articles\/(\d+)/i,          // get article id from civ url
        urlCollections: /\/collections\/(\d+)/i,    // get collection id from civ url
        urlParamWidth: /\/width=\d+\//,             // /width=NUMBER/
        urlParamAnimFalse: /anim=false,?/,          // anim=false, or anim=false
    };

    static #pages = [
        { // #home
            match: ({ pageId }) => pageId === '#home',
            goto: ({ params }) => {
                if (params.url) return this.openFromCivitUrl(params.url);
                return this.gotoHome();
            }
        },
        { // #models
            match: ({ pageId }) => pageId === '#models',
            goto: ({ params = {} }) => {
                if (params.hash) return this.gotoModelByHash(params.hash);
                if (params.model) return this.gotoModel(params.model, params.version);
                return this.gotoModels({
                    tag: params.tag,
                    query: params.query,
                    collectionId: params.collection,
                    username: params.username || params.user
                });
            },
            prepare: ({ params = {} }) => {
                if (params.hash) {
                    if (this.#cache.modelVersions.has(params.hash)) return { key: null, promise: null };
                    return {
                        key: params.hash,
                        promise: this.api.fetchModelVersionInfo(params.hash, true)
                    };
                }

                if (params.model) {
                    if (this.#cache.models.has(`${params.model}`)) return { key: null, promise: null };
                    return {
                        key: params.model,
                        promise: this.api.fetchModelInfo(params.model)
                    };
                }

                const forcedPeriod = params.collection ? 'AllTime' : null;
                const forcedType = params.collection ? [] : null;
                const forcedCheckpountType = params.collection ? 'All' : null;
                const forcedBaseModel = params.collection ? [] : null;
                const query = {
                    limit: CONFIG.perRequestLimits.models,
                    tag: params.tag ?? '',
                    query: params.query,
                    collectionId: params.collection,
                    username: params.username || params.user,
                    types: forcedType || SETTINGS.types,
                    sort: SETTINGS.sort,
                    period: forcedPeriod || SETTINGS.period,
                    checkpointType: forcedCheckpountType || SETTINGS.checkpointType,
                    baseModels: forcedBaseModel || SETTINGS.baseModels,
                    browsingLevel: SETTINGS.browsingLevel,
                    nsfw: SETTINGS.nsfw,
                };

                return {
                    key: JSON.stringify(query),
                    promise: this.api.fetchModels(query)
                };
            }
        },
        { // #articles
            match: ({ pageId }) => pageId === '#articles',
            goto: ({ params = {} }) => {
                if (params.article) return this.gotoArticle(params.article);
                return this.gotoArticles({
                    tag: params.tag,
                    username: params.username,
                    collectionId: params.collection,
                });
            }
        },
        { // #images
            match: ({ pageId }) => pageId === '#images',
            goto: ({ params = {} }) => {
                if (params.collection) return this.gotoCollection(params.collection);

                if (params.image) return this.gotoImage(params.image, params.nsfw);

                if (EXTENSION_INSTALLED && params.post) return this.gotoPost(params.post);

                if (
                    params.model ||
                    params.modelversion ||
                    params.collection ||
                    params.username ||
                    params.userId ||
                    params.user ||
                    params.post
                ) {
                    return this.gotoImages({
                        userId: params.userId,
                        modelId: params.model,
                        modelVersionId: params.modelversion,
                        collectionId: params.collection,
                        username: params.username || params.user,
                        postId: params.post
                    });
                }

                return this.gotoImages();
            },
            prepare: ({ params = {} }) => {
                if (params.collection && !this.#cache.collections.has(`${params.collection}`)) {
                    return {
                        key: params.collection,
                        promise: this.api.fetchCollectionInfo(params.collection)
                    };
                }

                if (EXTENSION_INSTALLED && params.post && !this.#cache.postsInfo.has(`${params.post}`)) {
                    return {
                        key: params.post,
                        promise: this.api.fetchPostInfo(params.post)
                    };
                }

                if (params.image && !this.#cache.images.has(`${params.image}`)) {
                    return {
                        key: params.image,
                        promise: this.api.fetchImageMeta(params.image, params.nsfw)
                    };
                }


                return { key: null, promise: null };
            }
        }
    ];
    static #civUrlRules = [
        { // models
            match: ({ url }) => url.pathname.startsWith('/models/'),
            parse: ({ url, params }) => {
                params.modelId = url.pathname.match(this.#regex.urlModels)?.[1] ?? null;
            },
            toLocal: ({ url, params }) => {
                if (!params.modelId) return null;
                let localUrl = `#models?model=${params.modelId}`;
                if (params.modelVersionId) localUrl += `&version=${params.modelVersionId}`;
                return localUrl;
            }
        },
        { // images
            match: ({ url }) => url.pathname.startsWith('/images/'),
            parse: ({ url, params }) => {
                params.imageId = url.pathname.match(this.#regex.urlImages)?.[1] ?? null;
            },
            toLocal: ({ url, params }) => params.imageId ? `#images?image=${params.imageId}` : null
        },
        { // posts
            match: ({ url }) => url.pathname.startsWith('/posts/'),
            parse: ({ url, params }) => {
                params.postId = url.pathname.match(this.#regex.urlPosts)?.[1] ?? null;
            },
            toLocal: ({ url, params }) => params.postId ? `#images?post=${params.postId}` : null
        },
        { // articles
            match: ({ url }) => url.pathname.startsWith('/articles/'),
            parse: ({ url, params }) => {
                params.articleId = url.pathname.match(this.#regex.urlArticles)?.[1] ?? null;
            },
            toLocal: ({ url, params }) => EXTENSION_INSTALLED && params.articleId ? `#articles?article=${params.articleId}` : null
        },
        { // collections
            match: ({ url }) => url.pathname.startsWith('/collections/'),
            parse: ({ url, params }) => {
                params.collectionId = url.pathname.match(this.#regex.urlCollections)?.[1] ?? null;
            },
            toLocal: ({ url, params }) => EXTENSION_INSTALLED && params.collectionId ? `#images?collection=${params.collectionId}` : null
        }
    ];

    static updateMainMenu() {
        const menu = document.querySelector('#main-menu .menu');

        menu.querySelector('a[href="#home"]').textContent = window.languagePack?.text?.home ?? 'Home';
        menu.querySelector('a[href="#models"]').textContent = window.languagePack?.text?.models ?? 'Models';
        menu.querySelector('a[href="#articles"]').textContent = window.languagePack?.text?.articles ?? 'Articles';
        menu.querySelector('a[href="#images"]').textContent = window.languagePack?.text?.images ?? 'Images';
    }

    static gotoPage(page, savedState) {
        // Do nothing if the transition was processed somewhere else
        if (this.#state.id && this.#state.id === savedState?.id) return;

        if (!page || page[0] !== '#') page = '#home';
        this.#page = page;

        const [ pageId, paramString ] = page.split('?') ?? [];
        this.#setTitle();

        // Clear cache records created after the current new transition
        if (this.#state && (!savedState || Date.now() - savedState.id < 10)) this.#cache.history.keys().forEach(id => {
            if (id > this.#state.id) this.#cache.history.delete(id);
        });

        if (typeof savedState === 'object' && !Array.isArray(savedState)) this.#state = {...savedState};
        else this.#state = {};
        if (!this.#state.id) this.#state.id = Date.now();
        if (!this.#cache.history.has(this.#state.id)) this.#cache.history.set(this.#state.id, {});

        const navigationState = {...this.#state};

        this.#clearVirtualScroll();
        this.#cachedUserImages = new Map(); // Clear the avatar pool during navigation (it is only needed when scrolling through the list of models)
        this.#pageNavigation = Date.now();
        this.#devicePixelRatio = Math.round(window.devicePixelRatio * 100) / 100;

        this.appElement.querySelectorAll('video').forEach(el => el.pause());
        this.appElement.querySelectorAll('.autoplay-observed').forEach(disableAutoPlayOnVisible);
        this.appElement.querySelectorAll('.inviewport-observed').forEach(onTargetInViewportClearTarget);
        document.getElementById('tooltip')?.remove();
        document.getElementById('page-loading-bar')?.remove();
        this.appElement.classList.add('page-loading');
        insertElement('div', document.body, { id: 'page-loading-bar' });
        this.appElement.setAttribute('data-page', pageId);
        if (paramString) this.appElement.setAttribute('data-params', paramString);
        else this.appElement.removeAttribute('data-params');
        document.querySelector('#main-menu .menu a.active')?.classList.remove('active');
        if (pageId) document.querySelector(`#main-menu .menu a[href="${pageId}"]`)?.classList.add('active');

        // TODO: add transition animation
        const processNavigation = (result, loaded = false) => {
            if (result.element) {
                this.appElement.textContent = '';
                this.appElement.appendChild(result.element);

                const header = document.getElementsByTagName('header')[0];
                const dataFormatStart = header?.getAttribute('data-format') ?? null;
                if (result.headerFormat === 'mini') header?.setAttribute('data-format', 'mini');
                else header?.removeAttribute('data-format');

                if (header && dataFormatStart !== (result.headerFormat ?? null) && !document.body.classList.contains('page-scrolled')) {
                    const keyframes = result.headerFormat === 'mini' ? { transform: [ 'translateY(1em)', 'translateY(0)' ] } : { transform: [ 'translateY(-1em)', 'translateY(0)' ] };
                    animateElement(header, {
                        keyframes,
                        duration: 200,
                        easing: 'ease-out'
                    });
                }

                const footer = document.getElementsByTagName('footer')[0];
                if (result.footerBehavior === 'static') footer?.setAttribute('data-behavior', 'static');
                else footer?.removeAttribute('data-behavior');
            }
            if (result.title !== undefined) this.#setTitle(result.title);

            if (!loaded) return;

            hideTimeError();
            cleanupDetachedObservers();

            document.getElementById('page-loading-bar')?.remove();
            this.appElement.classList.remove('page-loading');
            this.onScrollFromNavigation(navigationState);
        };

        const finishPageLoading = (result = {}) => {
            if (navigationState.id === this.#state.id) {
                processNavigation(result, true);
                this.#preClickResults = {};
            } else hideTimeError();
        };

        // Clear all errors and prepare new timer
        if (this.#errorTimer) clearTimeout(this.#errorTimer);
        document.getElementById('error-timeout')?.remove();
        const showTimeOutError = () => {
            this.#errorTimer = null;
            const errorContainer = createElement('div', { id: 'error-timeout' });
            const textTemplate = window.languagePack?.errors?.no_response ?? "Something is wrong, loading shouldn't take so long... You can check the developer console (Ctrl + Shift + I) and the API status: {{api-status}}";
            const parts = textTemplate.split('{{api-status}}');

            if (parts[0]) errorContainer.appendChild(document.createTextNode(parts[0]));
            insertElement('a', errorContainer, { href: CONFIG.api_status_url, target: '_blank' }, 'CivitaAI API Status');
            if (parts[1]) errorContainer.appendChild(document.createTextNode(parts[0]));

            document.querySelector('body header').appendChild(errorContainer);
        };

        const hideTimeError = () => {
            if (this.#errorTimer) {
                clearTimeout(this.#errorTimer);
                this.#errorTimer = null;
            }
            document.getElementById('error-timeout')?.remove();
        };

        this.#errorTimer = setTimeout(showTimeOutError, CONFIG.timeOut);

        let result;
        const params = parseParams(paramString) || {};
        for (const page of this.#pages) {
            if (page.match({ pageId, params })) {
                try {
                    result = page.goto({ pageId, params });
                } catch (error) {
                    console.error(error);
                    result = this.#gotoError(error);
                }
                break;
            }
        }

        if (!result) return finishPageLoading();

        if (result.promise instanceof Promise) {
            processNavigation(result);
            result.promise.then(finishPageLoading).catch(error => this.#gotoError(error));
        } else finishPageLoading(result);
    }

    static preparePage(page) {
        // Start downloading or retrieving from cache in advance,
        // because after pressing it is highly likely that a click will occur... 
        const [ pageId, paramString ] = page?.split('?') ?? [];
        this.#preClickResults = {};

        let key = null, promise = null;
        const params = parseParams(paramString) || {};
        for (const page of this.#pages) {
            if (page.match({ pageId, params })) {
                ({ key, promise } = page.prepare?.({ pageId, params }) ?? { key: null, promise: null });
                break;
            }
        }

        if (key !== null) {
            this.#preClickResults[key] = promise;
            promise.then(result => {
                if (this.#preClickResults[key] === promise) {
                    this.#preClickResults[`${key}-result`] = result;
                }
            });
        }
    }

    static #gotoError(error, fallbackMessage = 'Error') {
        console.error('Error:', error?.message ?? error);
        const appContent = createElement('div', { class: 'app-content error-page' });
        appContent.appendChild(this.#genErrorPage(error?.message ?? fallbackMessage));

        // Open in CivitAI
        const civitaiUrl = this.createCivitUrl();
        if (civitaiUrl) insertElement('a', element, { href: civitaiUrl, target: '_blank', class: 'link-button link-open-civitai'}, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        return { element: appContent, title: window.languagePack?.errors?.error ?? 'Error' };
    }

    static #addVirtualScroll(virtualScroll) {
        const { onScroll = null, onResize = null, readScroll = null, readResize = null } = virtualScroll.getCallbacks();
        this.#activeVirtualScroll.push({
            id: virtualScroll.id,
            virtualScroll,
            readScroll,
            readResize,
            onScroll,
            onResize
        });
    }

    static #clearVirtualScroll() {
        this.#activeVirtualScroll.forEach(item => {
            item.virtualScroll.destroy({ preventRemoveItemsFromDOM: true });
        });
        this.#activeVirtualScroll = [];
    }

    static gotoHome() {
        const fragment = new DocumentFragment();
        const searchLang = window.languagePack?.temp?.home?.search ?? {};
        const searchWrap = insertElement('div', fragment, { class: 'app-content main-search-container' });
        const searchContainer = insertElement('div', searchWrap, { class: 'main-search' });
        const searchInput = insertElement('input', searchContainer, { id: 'main-search-input', type: 'text', placeholder: searchLang.placeholder ?? 'Search using CivitAI API...', role: 'search', autocomplete: 'off' });
        const searchButton = insertElement('button', searchContainer, { class: 'search-button' });
        searchButton.appendChild(getIcon('search'));
        insertElement('div', searchContainer, { class: 'main-search-bar' });
        const searchResultsContainer = insertElement('div', searchContainer, { class: 'search-results' });

        let searchTimer = null, searchQuery = null;
        const hashSizes = [ 8, 10, 12, 64 ];
        const renderResults = results => {
            if (!results.length && searchQuery) results.push({ icon: 'cross', title: searchLang.noResults ?? 'No results found' });

            const fragment = new DocumentFragment();
            results.forEach(item => {
                const el = insertElement((item.href ? 'a' : 'div'), fragment, { class: 'search-result-item' });
                if (item.href) el.setAttribute('href', item.href);
                if (item.media) {
                    const mediaElement = this.#genMediaElement({ media: item.media, width: 96, target: 'model-preview', decoding: 'auto', loading: 'auto' });
                    el.appendChild(mediaElement);
                } else if (item.image) insertElement('img', el, { alt: ' ', src: item.image });
                else if (item.icon) el.appendChild(getIcon(item.icon));
                insertElement('span', el, undefined, item.title);
                if (item.typeBadge) insertElement('div', el, { class: 'badge' }, item.typeBadge);
            });

            hideLoading();
            searchResultsContainer.textContent = '';
            searchResultsContainer.appendChild(fragment);
            searchResultsContainer.style.setProperty('--count', results.length);
        };
        const showLoading = () => {
            searchContainer.classList.add('search-loading');
        };
        const hideLoading = () => {
            searchContainer.classList.remove('search-loading');
        };
        const doSearch = () => {
            searchTimer = null;

            const q = searchInput.value.trim();
            if (q === searchQuery) return;
            searchQuery = q;

            const results = [];
            const promises = [];

            // try convert url
            const qUrl = toURL(q);
            if (qUrl) {
                if (qUrl.origin !== CONFIG.civitai_url) {
                    results.push({ icon: 'cross', title: searchLang.linkNotSupported ?? 'This link is not supported' });
                    renderResults(results);
                    return;
                }

                const { localUrl: redirectUrl, params } = this.parseCivUrl(qUrl);
                if (!redirectUrl) throw new Error('Unknown url');
                let promise;

                if (qUrl.pathname.startsWith('/models/')) {
                    if (!params.modelId) throw new Error('There is no model id in the link');
                    if (params.modelVersionId) {
                        promise = this.api.fetchModelVersionInfo(params.modelVersionId).then(version => {
                            const previewMedia = version?.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
                            const title = version.model?.name ? `${version.model?.name} (${version.name})` : version.name ?? redirectUrl;
                            results.push({ media: previewMedia, image: CONFIG.logo, href: redirectUrl, title, typeBadge: version.model?.type ?? window.languagePack?.text?.model ?? 'Model' });
                        });
                    } else {
                        promise = this.api.fetchModelInfo(params.modelId).then(model => {
                            const previewMedia = model?.modelVersions?.[0]?.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
                            const title = model.name ?? redirectUrl;
                            results.push({ media: previewMedia, image: CONFIG.logo, href: redirectUrl, title, typeBadge: model.type ?? window.languagePack?.text?.model ?? 'Model' });
                        });
                    }
                } else if (qUrl.pathname.startsWith('/images/')) {
                    if (!params.imageId) throw new Error('There is no image id in the link');
                    promise = this.api.fetchImageMeta(params.imageId).then(media => {
                        const title = window.languagePack?.text?.image ?? 'Image';
                        results.push({ media, image: CONFIG.logo, href: redirectUrl, title, typeBadge: title });
                    });
                } else if (qUrl.pathname.startsWith('/posts/')) {
                    if (!params.postId) throw new Error('There is no post id in the link');
                    const title = window.languagePack?.text?.post ?? 'Post';
                    results.push({ image: CONFIG.logo, href: redirectUrl, title, typeBadge: title });
                }
                if (promise) promises.push(promise);

                if (!promises.length && !results.length) results.push({ icon: 'cross', title: searchLang.linkNotSupported ?? 'This link is not supported' });

                if (promises.length) {
                    showLoading();
                    Promise.allSettled(promises).then(() => q === searchQuery ? renderResults(results) : null);
                } else renderResults(results);

                return;
            }

            // try search by hash
            if (!q.includes(':') && hashSizes.some(n => q.length === n)) {
                const baseHash = q.toUpperCase();
                const processVersion = version => {
                    if (!version) return;
                    const url = `#models?model=${version.modelId}&version=${version.id}`;
                    const title = version.model?.name ? `${version.model?.name} (${version.name})` : version.name ?? url;
                    const previewMedia = version.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
                    results.push({ media: previewMedia, image: CONFIG.logo, href: url, title, typeBadge: version.model?.type });
                };
                if (this.#cache.modelVersions.has(baseHash)) processVersion(this.#cache.modelVersions.get(baseHash));
                else {
                    const promise = this.api.fetchModelVersionInfo(q, true)
                    .then(processVersion)
                    .catch(() => {
                        if (q.length < 10) return;
                        const AutoV2 = q.substring(0, 10);
                        if (this.#cache.modelVersions.has(AutoV2)) {
                            processVersion(this.#cache.modelVersions.get(AutoV2));
                            return;
                        }

                        return this.api.fetchModelVersionInfo(AutoV2, true).then(info => {
                            if (!info.files?.some(file => file.hashes?.SHA256?.toUpperCase().startsWith(baseHash))) return;

                            if (!this.#cache.modelVersions.has(AutoV2)) this.#cache.modelVersions.set(AutoV2, info);
                            processVersion(info);
                        }).catch(() => null);
                    });
                    promises.push(promise);
                }
            }

            // try search via query (if normal length)
            if (q.length > 1 && (q.length < 64 || q.indexOf(':') !== -1)) {
                // TODO
                if (!promises.length && !results.length) results.push({ icon: 'wrench', title: searchLang.wipPlaceholder ?? '[WIP] In development, so far only link conversion and hash search' })
            }

            if (promises.length) {
                showLoading();
                Promise.allSettled(promises).then(() => q === searchQuery ? renderResults(results) : null);
            }
            else renderResults(results);
        };
        searchInput.addEventListener('input', () => {
            if (searchTimer) clearTimeout(searchTimer);
            else {
                searchResultsContainer.textContent = '';
                searchResultsContainer.style.setProperty('--count', 0);
            }
            searchTimer = setTimeout(doSearch, 400);
        });


        // This is a temporary description, so whatever
        const appContent = insertElement('div', fragment, { class: 'app-content' });
        const tempHome =  window.languagePack?.temp?.home ?? {};
        insertElement('h1', appContent, undefined, window.languagePack?.text?.home);
        insertElement('p', appContent, undefined, tempHome.p1?.description);
        insertElement('p', appContent, undefined, tempHome.p1?.tipsListTitle);
        if (tempHome.p1?.tipsList) {
            const ul = insertElement('ul', appContent);
            insertElement('li', ul, undefined, tempHome.p1?.tipsList[0]);
            const itemWithIconText = tempHome.p1?.tipsList[1];
            if (itemWithIconText) {
                const start = itemWithIconText.indexOf(':civitai:');
                if (start < 0) insertElement('li', ul, undefined, itemWithIconText);
                else {
                    const li = insertElement('li', ul, undefined, itemWithIconText.substring(0, start >= 0 ? start : undefined));
                    const icon = getIcon('civitai');
                    icon.style.display = 'inline';
                    li.appendChild(icon);
                    li.appendChild(document.createTextNode(itemWithIconText.substring(start + ':civitai:'.length)));
                }
            }
            insertElement('li', ul, undefined, tempHome.p1?.tipsList[2]);
        }
        insertElement('p', appContent, undefined, tempHome.p1?.goodluck);

        insertElement('br', appContent);
        insertElement('hr', appContent);
        insertElement('br', appContent);

        insertElement('h2', appContent, undefined, tempHome.settingsDescription ?? 'Settings');

        // Settings
        const settingsContainer = insertElement('div', appContent);
        const addSetting = ({ description, blockquote, toggleElement }) => {
            try {
                const container = createElement('div', { class: 'config-container' });
                container.appendChild(toggleElement);
                const descriptionContainer = insertElement('div', container, { class: 'config-description' });
                insertElement('p', descriptionContainer, undefined, description);
                if (blockquote) insertElement('blockquote', descriptionContainer, undefined, blockquote);
                settingsContainer.appendChild(container);
            } catch (_) {
                console.error(_);
                insertElement('p', settingsContainer, { class: 'error-text' }, `Error: ${_?.message ?? _}`);
            }
        };

        // Blacklist tagIds and presets (only if extension installed)
        if (EXTENSION_INSTALLED) {
            try {
                const container = createElement('div', { class: 'config-container' });
                const hideByTagsToggles = insertElement('div', container, { class: 'config-boolean-list' });

                CONFIG.filters.tagBlacklistPresetKeys.forEach(key => {
                    const { element } = this.#genBoolean({
                        onchange: ({ newValue }) => {
                            SETTINGS[key] = newValue;
                            savePageSettings();
                        },
                        value: SETTINGS[key],
                        label: tempHome[key] ?? key
                    });
                    hideByTagsToggles.appendChild(element);
                });

                const descriptionContainer = insertElement('div', container, { class: 'config-description' });
                insertElement('p', descriptionContainer, undefined, 'Images filter (WIP)');
                // insertElement('blockquote', descriptionContainer, undefined, '...');
                settingsContainer.appendChild(container);
            } catch (_) {
                console.error(_);
                insertElement('p', settingsContainer, { class: 'error-text' }, `Error: ${_?.message ?? _}`);
            }

            // Blacklist tagIds
            if (DEVMODE) {
                addSetting({
                    description: 'List of tagIds to hide (separated by commas) (WIP)',
                    blockquote: 'A list of numeric ID tags, used to hide images with these tags (only works if the extension (located in the "apiProxyExtension" folder in the project repository) is installed to use the original API, since the public API does not return any tags)',
                    toggleElement: this.#genStringInput({
                        onchange: ({ newValue }) => {
                            SETTINGS.blackListTagIds = newValue.split(',').map(tag => tag.trim()).filter(tag => tag) ?? [];
                            savePageSettings();
                        },
                        value: SETTINGS.blackListTagIds.join(', '),
                        placeholder: 'tagIds separated by commas'
                    }).element
                });
            }
        }

        // Blacklist tags
        addSetting({
            description: tempHome.blackListTagsDescription ?? 'List of tags to hide (separated by commas)',
            blockquote: tempHome.blackListTagsNote ?? 'This works only on the model list, since the image API does not return a list of tags.',
            toggleElement: this.#genStringInput({
                onchange: ({ newValue }) => {
                    SETTINGS.blackListTags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag) ?? [];
                    savePageSettings();
                },
                value: SETTINGS.blackListTags.join(', '),
                placeholder: 'tags separated by commas'
            }).element
        });

        // Autoplay
        addSetting({
            description: tempHome.autoplayDescription ?? 'If autoplay is disabled, cards won’t show GIFs, and videos on all pages will be paused by default, only playing on hover.',
            blockquote: tempHome.autoplayNote ?? '⚠ Strong impact on performance.',
            toggleElement: this.#genBoolean({
                onchange: ({ newValue }) => {
                    SETTINGS.autoplay = newValue;
                    localStorage.setItem('civitai-lite-viewer--time:nextCacheClearTime', new Date(Date.now() + 3 * 60 * 1000).toISOString());
                    savePageSettings();
                },
                value: SETTINGS.autoplay,
                label: tempHome.autoplay ?? 'Autoplay'
            }).element,
        });

        // Color correction
        addSetting({
            description: tempHome.colorCorrectionDescription ?? 'If enabled, the text color in the model descriptions will be adjusted to improve readability.',
            toggleElement: this.#genBoolean({
                onchange: ({ newValue }) => {
                    SETTINGS.colorCorrection = newValue;
                    savePageSettings();
                },
                value: SETTINGS.colorCorrection,
                label: tempHome.colorCorrection ?? 'Color adjustment'
            }).element,
        });

        // Cache usage
        const cachesWrap = insertElement('div', appContent);
        navigator.storage.estimate().then(info => {
            const caches = info.usageDetails?.caches ?? info.usage;
            if (caches > 200000000) { // 191 Mb
                insertElement('h2', cachesWrap, undefined, tempHome.cachesTitle ?? 'Cache information');
                insertElement('p', cachesWrap, undefined, tempHome.cachesDescription ?? 'This is information about the size of the cache of this site on disk. If you changed DPR (Change page scale, change interface scale in OS), or SW scaling setting, then there could be outdated image sizes left, will be deleted automatically after some time, but you can delete them manually.');
                const cachesSizeWrap = insertElement('p', cachesWrap, undefined, `${tempHome.cachesSize ?? 'The size occupied by the cache on disk'}: `);
                const cacheFileSize = insertElement('span', cachesSizeWrap, { class: 'error-text' }, filesizeToString(caches));

                const updateCacheSize = () => {
                    if (!this.appElement.contains(cacheFileSize)) return;
                    navigator.storage.estimate().then(info => {
                        const caches = info.usageDetails?.caches ?? info.usage;
                        if (caches < 200000000) cacheFileSize.classList.remove('error-text');
                        cacheFileSize.textContent = filesizeToString(caches);
                    });
                };

                const buttonsWrap = insertElement('div', cachesWrap, { style: 'display: flex; gap: 1em;' });
                const buttonRemoveOld = insertElement('button', buttonsWrap, undefined, tempHome?.removeCacheOld ?? 'Delete old cache');
                const buttonRemoveAll = insertElement('button', buttonsWrap, undefined, tempHome?.removeCacheAll ?? 'Delete all cache');

                // Timers are needed because it updates with a delay
                buttonRemoveOld.addEventListener('click', () => {
                    clearCache('old').then(response => {
                        updateCacheSize();
                        setTimeout(updateCacheSize, 500);
                        setTimeout(updateCacheSize, 2500);
                        notify(`Removed ${response?.countRemoved ?? -1} item(s)`);
                    });
                });
                buttonRemoveAll.addEventListener('click', () => {
                    clearCache('all').then(response => {
                        updateCacheSize();
                        setTimeout(updateCacheSize, 500);
                        setTimeout(updateCacheSize, 2500);
                        notify(`Removed ${response?.countRemoved ?? -1} item(s)`);
                    });
                });
            }
        });

        return {
            element: fragment,
            title: window.languagePack?.text?.home ?? 'Home'
        };
    }

    static gotoArticles(options = {}) {
        if (!EXTENSION_INSTALLED || !this.api.fetchArticles) {
            const appContent = createElement('div', { class: 'app-content' });
            const p = insertElement('p', appContent, { class: 'error-text' });
            p.appendChild(getIcon('cross'));
            insertElement('span', p, undefined, window.languagePack?.temp?.articles ?? 'CivitAI public API does not provide a list of articles 😢');
            return {
                element: appContent,
                title: window.languagePack?.text?.articles ?? 'Articles'
            };
        }

        const { tag, username, collectionId } = options;
        const forcedPeriod = collectionId ? 'AllTime' : null;
        const fragment = new DocumentFragment();
        const navigationState = {...this.#state};
        const cache = this.#cache.history.get(navigationState.id) ?? {};
        let query, hiddenArticles = 0;
        const layoutConfig = {
            id: 'articles',
            state: navigationState[`virtualScrollState-articles`] ?? null,
            gap: CONFIG.appearance.modelCard.gap,
            itemWidth: CONFIG.appearance.modelCard.width,
            itemHeight: CONFIG.appearance.modelCard.height,
            progressiveGenerator: this.#genArticleCardProgressive,
            getResizedOptions: () => ({
                gap: CONFIG.appearance.modelCard.gap,
                itemWidth: CONFIG.appearance.modelCard.width,
                itemHeight: CONFIG.appearance.modelCard.height
            }),
            passive: true,
            onElementRemove: this.#onCardRemoved.bind(this)
        };

        const loadItems = ({ cursor } = {}) => {
            if (cursor === undefined) {
                query = {
                    limit: CONFIG.perRequestLimits.articles,
                    sort: SETTINGS.sort_articles,
                    period: forcedPeriod || SETTINGS.period_articles,
                    browsingLevel: SETTINGS.browsingLevel,
                    nsfw: SETTINGS.nsfw,
                    tags: tag ? [+tag] : [],
                    collectionId,
                    username,
                };
                this.#state.filter = JSON.stringify(query);

                hiddenArticles = 0;

                if (cache.filter === this.#state.filter && cache.articles?.length) {
                    this.#log('Loading articles (nav cache)');
                    cursor = cache.nextCursor ?? null;
                    return {
                        items: cache.articles,
                        cursor: cache.nextCursor
                    };
                } else {
                    cache.articles = [];
                    cache.nextCursor = null;
                    cache.filter = null;
                }
            } else query.cursor = cursor;


            const apiPromise = this.#preClickResults[JSON.stringify(query)] ?? this.api.fetchArticles(query);
            return apiPromise.then(data => {
                cursor = data.metadata?.nextCursor ?? null;

                cache.nextCursor = cursor;
                cache.filter = this.#state.filter;
                cache.articles = cache.articles?.concat(data.items) ?? data.items;

                return { cursor, items: data.items };
            });
        };
        const prepareItems = articles => {
            this.#log('Loaded articles:', articles);

            const hiddenBefore = hiddenArticles;
            if (SETTINGS.blackListTagIds.length > 0 || SETTINGS.hideFurry || SETTINGS.hideExtreme || SETTINGS.hideGay) {
                let blackListTagIds = [...SETTINGS.blackListTagIds];
                if (SETTINGS.hideFurry) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideFurry);
                if (SETTINGS.hideExtreme) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideExtreme);
                if (SETTINGS.hideGay) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideGay);
                const countAll = articles.length;
                const normalizedBlaclistTagIds = blackListTagIds.map(id => id.match(/[\+\-\|\&\?]/) ? id : `+${id}`);

                articles = filterItems(articles, [
                    { key: 'tagIds', conditions: normalizedBlaclistTagIds, type: 'number' },
                    { key: 'coverImage.tagIds', conditions: normalizedBlaclistTagIds, type: 'number' },
                    SETTINGS.hideGay ? { key: 'coverImage.tagIds', conditions: CONFIG.filters.tagBlacklistPresets.hideGay_nsfw, type: 'number', shouldApply: item => item.coverImage?.nsfwLevel >= 2 } : null,
                    // { key: 'tags', conditions: SETTINGS.blackListTags.map(tag => tag.match(/[\+\-\|\&\?]/) ? tag : `+${tag}`) },
                ]);

                if (countAll !== articles.length) {
                    hiddenArticles += countAll - articles.length;
                    this.#log(`Hidden ${hiddenArticles} article(s) with blacklist tags`);
                }
            }

            const items = articles.map(data => ({ id: data.id, data }));

            return { items, hidden: hiddenArticles - hiddenBefore };
        };

        const filter = this.#genArticlesListFilters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            infinityScroll.reload();
        }, {
            period_articles: !forcedPeriod
        });
        fragment.appendChild(filter);


        const appContent = insertElement('div', fragment, { class: 'app-content app-content-wide cards-list-container' });
        const listWrap = insertElement('div', appContent, { id: 'articles-list' });
        appContent.appendChild(this.#genScrollToTopButton());

        const infinityScroll = this.#genInfinityScroll({
            layoutConfig, loadItems, prepareItems,
            labels: {
                hiddenItems: window.languagePack?.text?.hiddenModels ?? 'Due to the selected hide tags, {count} were hidden',
                units: window.languagePack?.units?.element ?? ['element', 'elements', 'elements'],
            }
        });

        listWrap.appendChild(infinityScroll.element);

        this.#addVirtualScroll(infinityScroll.layout);

        if (infinityScroll.promise instanceof Promise) {
            const firstLoadingPlaceholder = insertElement('div', appContent, { id: 'load-more', style: 'position: absolute; width: 100%;' });
            firstLoadingPlaceholder.appendChild(Controller.genLoadingIndecator());
            infinityScroll.promise.finally(() => firstLoadingPlaceholder.remove());
        }

        return { 
            element: fragment,
            title: window.languagePack?.text?.articles ?? 'Articles',
            promise: infinityScroll.promise
        };
    }

    static gotoArticle(articleId) {
        if (!EXTENSION_INSTALLED || !this.api.fetchArticle) {
            const appContent = createElement('div', { class: 'app-content' });
            const p = insertElement('p', appContent, { class: 'error-text' });
            p.appendChild(getIcon('cross'));
            insertElement('span', p, undefined, window.languagePack?.temp?.articles ?? 'CivitAI public API does not provide a list of articles 😢');
            return {
                element: appContent,
                title: window.languagePack?.text?.articles ?? 'Articles'
            };
        }

        const pageNavigation = this.#pageNavigation;
        const navigationState = {...this.#state};
        const cache = this.#cache.history.get(navigationState.id) ?? {};
        if (!cache.descriptionImages) cache.descriptionImages = new Map();

        // to select the background color when correcting colors
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

        const insertArticle = article => {
            const fragment = new DocumentFragment();
            const appContent = insertElement('div', fragment, { class: 'app-content' });
            const page = insertElement('div', appContent, { class: 'model-page article-page', 'data-article-id': article.id });

            // Model name
            const modelNameWrap = insertElement('div', page, { class: 'model-name article-name' });
            const modelNameH1 = insertElement('h1', modelNameWrap, undefined, article.title);
            const statsList = [
                { icon: 'bookmark', value: article.stats.collectedCount, unit: 'bookmark' },
                { icon: 'chat', value: article.stats.commentCount, unit: 'comment' },
                { icon: 'thunder', value: article.stats.tippedAmountCount, unit: 'buzz' },
                { icon: 'eye', value: article.stats.viewCount, unit: 'view' },
            ];
            const statsFragment = this.#genStats(statsList);
            modelNameH1.appendChild(statsFragment);

            const publishedAt = new Date(article.publishedAt);
            const modelTagsWrap = insertElement('div', page, { class: 'badges model-tags' });
            const updateTags = tags => {
                modelTagsWrap.textContent = '';
                let categoryLink;
                tags.forEach((tag, i) => {
                    const a = insertElement('a', modelTagsWrap, { href: `#articles?tag=${encodeURIComponent(article.tagIds[i])}`, class: (SETTINGS.blackListTags.includes(tag) ? 'badge error-text' : 'badge') }, tag)
                    if (tag === article.category) categoryLink = a;
                });
                if (!categoryLink) categoryLink = createElement('div', { class: 'badge' }, article.category);
                categoryLink.classList.add('model-category');
                modelTagsWrap.prepend(categoryLink);

                const badgePublishedAt = createElement('div', { class: 'badge model-category separated-right', 'lilpipe-text': publishedAt.toLocaleString() }, timeAgo(Math.round((Date.now() - publishedAt)/1000)));
                modelTagsWrap.prepend(badgePublishedAt);
            };
            if (this.#state.article_tags || article.tags.join('').length <= 80) updateTags(article.tags);
            else {
                updateTags(article.tags.reduce((acc, tag) => (acc.join('').length + tag.length <= 80 ? [...acc, tag] : acc), []));
                const showMore = insertElement('button', modelTagsWrap, { class: 'show-more' });
                showMore.appendChild(getIcon('arrow_down'));
                insertElement('span', showMore, { class: 'darker-text', style: 'font-size: .75em;' }, ` +${article.tags.length - 12}`);
                showMore.addEventListener('click', () => {
                    this.#state.article_tags = true;
                    updateTags(article.tags);
                }, { once: true });
            }

            // Download buttons
            const downloadButtons = insertElement('div', modelNameWrap, { class: 'model-download-files' });
            article.attachments.forEach(file => {
                const fileSize = filesizeToString(file.sizeKB / 0.0009765625);
                const downloadUrl = file.downloadUrl || `${CONFIG.civitai_url}/api/download/attachments/${file.id}`; // file.url - required auth
                const a = insertElement('a', downloadButtons, { class: 'link-button', target: '_blank', href: downloadUrl });
                a.appendChild(getIcon('download'));
                insertElement('span', a, undefined, file.name || 'Unnamed');
                insertElement('span', a, { class: 'dark-text' }, ` ${fileSize}`);
                if (file.name) a.setAttribute('data-filename', file.name);
            });

            // Article cover
            if (article.coverImage) {
                const modelPreviewWrap = insertElement('div', page, { class: 'model-preview article-preview' });
                const mediaElement = this.#genMediaElement({ media: article.coverImage, width: Math.min(CONFIG.appearance.appWidth, this.windowWidth), taget: 'model-preview', allowAnimated: true });
                modelPreviewWrap.appendChild(mediaElement);
                this.#genMediaPreviewFromPrevPage(mediaElement, article.coverImage.id);
            }

            const content = createElement('div', { class: 'model-description article-content' });

            // Creator
            if (article.user) {
                const userInfo = {...article.user};
                if (userInfo.username) userInfo.url = `#articles?username=${userInfo.username}`;
                const userBLock = this.#genUserBlock(userInfo);
                if(!SETTINGS.autoplay) userBLock.classList.add('image-hover-play');
                content.appendChild(userBLock);
                const draggableTitleBase = window.languagePack?.text?.models_from ?? 'Models from {username}';
                userBLock.querySelector('a')?.setAttribute('data-draggable-title', draggableTitleBase.replace('{username}', userInfo.username || 'user'));
            }

            // Content
            const description = this.#analyzeModelDescriptionString(article.content);
            const modelDescriptionFragment = safeParseHTML(description);
            this.#analyzeModelDescription(modelDescriptionFragment, cache);
            if(SETTINGS.colorCorrection) this.#analyzeTextColors(modelDescriptionFragment, isDarkMode ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 }); // TODO: real bg
            content.appendChild(modelDescriptionFragment);
            page.appendChild(content);

            // Adding virtual scrolling if there are many elements (For example an article with id = 3733)
            if (content.children.length > 300) {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!this.appElement.contains(content)) return;

                    const virtualScroll = this.#genFakeVirtualScroll(`article-${article.id}`, content);
                    this.#addVirtualScroll(virtualScroll);
                }));
            }

            // Open in CivitAI
            insertElement('a', page, { href: `${CONFIG.civitai_url}/articles/${article.id}`, target: '_blank', class: 'link-button link-open-civitai'}, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

            fragment.appendChild(this.#genScrollToTopButton());

            return { element: fragment, title: article.title };
        };

        const cachedModel = this.#cache.articles.get(`${articleId}`) || this.#preClickResults[`${articleId}-result`];
        if (cachedModel) {
            this.#log('Loaded article (cache):', cachedModel);
            return insertArticle(cachedModel);
        }

        const apiPromise = this.#preClickResults[articleId] ?? this.api.fetchArticle(Number(articleId));
        const promise = apiPromise
        .then(data => {
            if (data?.id) this.#cache.articles.set(`${data.id}`, data);
            if (pageNavigation !== this.#pageNavigation) return;
            this.#log('Loaded article:', data);
            return insertArticle(data);
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            return this.#gotoError(error);
        });

        return { promise };
    }

    static gotoImage(imageId, nsfwLevel) {
        const appContent = createElement('div', { class: 'app-content-wide full-image-page' });

        const cachedMedia = this.#cache.images.get(`${imageId}`) || this.#preClickResults[`${imageId}-result`];
        if (cachedMedia) {
            this.#log('Loaded image info (cache)', cachedMedia);
            if (!this.#cache.images.has(`${imageId}`)) this.#cache.images.set(`${imageId}`, cachedMedia);
            const { element: imageFullPage, title } = this.#genImageFullPage(cachedMedia);
            appContent.appendChild(imageFullPage);
            return { element: appContent, title, headerFormat: 'mini', footerBehavior: 'static' };
        }

        const pageNavigation = this.#pageNavigation;
        const apiPromise = this.#preClickResults[imageId] ?? this.api.fetchImageMeta(imageId, nsfwLevel);
        const promise = apiPromise.then(media => {
            if (pageNavigation !== this.#pageNavigation) return;
            this.#log('Loaded image info', media);
            this.#cache.images.set(`${imageId}`, media);
            if (!media) throw new Error('No Meta');

            const { element: imageFullPage, title } = this.#genImageFullPage(media);
            appContent.appendChild(imageFullPage);
            return { element: appContent, title, headerFormat: 'mini', footerBehavior: 'static' };
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Error'));

            if (error?.message === 'No Meta') {
                appContent.style.flexDirection = 'column';
                insertElement('p', appContent, { class: 'error-text' }, 'Some images cannot be retrieved via API, you can try opening this image on the original site');
                insertElement('a', appContent, { href: `${CONFIG.civitai_url}/images/${imageId}`, target: '_blank', class: 'link-button link-open-civitai' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');
            }
            return { element: appContent };
        });

        return { promise };
    }

    static gotoImages(options = {}) {
        const { modelId, username, userId, modelVersionId, collectionId, postId } = options;

        const appContentWide = createElement('div', { class: 'app-content app-content-wide cards-list-container' });
        const { element: imagesList, promise: imagesListPromise } = this.#genImages({ modelId, modelVersionId, collectionId, username, userId, postId });
        appContentWide.appendChild(imagesList);
        appContentWide.appendChild(this.#genScrollToTopButton());

        return {
            element: appContentWide,
            title: window.languagePack?.text?.images ?? 'Images',
            promise: imagesListPromise
        };
    }

    static gotoCollection(id) {
        const pageNavigation = this.#pageNavigation;
        const navigationState = {...this.#state};

        const insertCollectionPage = collection => {
            const title = [collection.name];

            const cache = this.#cache.history.get(navigationState.id) ?? {};
            if (!cache.descriptionImages) cache.descriptionImages = new Map();

            // to select the background color when correcting colors
            const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

            const fragment = new DocumentFragment();
            const appContent = insertElement('div', fragment, { class: 'app-content app-content-small collection-page' });
            const appContentWide = insertElement('div', fragment, { class: 'app-content app-content-wide cards-list-container' });

            // Title
            insertElement('h1', appContent, { class: 'model-name' }, collection.name);

            // Creator
            if (collection.user) {
                const userBLock = this.#genUserBlock(collection.user);
                if(!SETTINGS.autoplay) userBLock.classList.add('image-hover-play');
                appContent.appendChild(userBLock);
            }

            // Description
            if (collection.description) {
                const modelDescription = createElement('div', { class: 'model-description' });
                const description = this.#analyzeModelDescriptionString(collection.description);
                const modelDescriptionFragment = safeParseHTML(description);
                this.#analyzeModelDescription(modelDescriptionFragment, cache);
                if(SETTINGS.colorCorrection) this.#analyzeTextColors(modelDescriptionFragment, isDarkMode ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 }); // TODO: real bg
                modelDescription.appendChild(modelDescriptionFragment);
                if (modelDescription.childNodes.length) appContent.appendChild(modelDescription);
            }

            const itemsList = ({
                Image: this.gotoImages,
                Model: this.gotoModels,
                Article: this.gotoArticles

            })[collection.type]?.bind(this)({ collectionId: collection.id }) ?? null;

            if (itemsList.element) {
                appContentWide.appendChild(itemsList.element);
            }

            let promise = itemsList.promise;

            if (promise instanceof Promise) {
                promise = promise.then(() => ({ element: fragment, title }));
                return { promise };
            } else return { element: fragment, title };
        };

        const cached = this.#cache.collections.get(`${id}`) || this.#preClickResults[`${id}-result`];
        if (cached) {
            this.#log('Loaded collection (cache):', cached);
            return insertCollectionPage(cached);
        }

        const apiPromise = this.#preClickResults[id] ?? this.api.fetchCollectionInfo(id);
        const promise = apiPromise
        .then(data => {
            if (data?.id) this.#cache.collections.set(`${data.id}`, data);
            if (pageNavigation !== this.#pageNavigation) return;
            this.#log('Loaded collection:', data);
            const result = insertCollectionPage(data);
            if (result.promise) return result.promise;
            return result;
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            return this.#gotoError(error);
        });

        return { promise };
    }

    static gotoPost(id) {
        const pageNavigation = this.#pageNavigation;
        const navigationState = {...this.#state};

        const insertPostPage = post => {
            const title = [post.title];

            const cache = this.#cache.history.get(navigationState.id) ?? {};
            if (!cache.descriptionImages) cache.descriptionImages = new Map();

            // to select the background color when correcting colors
            const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

            const fragment = new DocumentFragment();
            const appContent = insertElement('div', fragment, { class: 'app-content app-content-small post-page' });
            const appContentWide = insertElement('div', fragment, { class: 'app-content app-content-wide cards-list-container' });

            // Title
            if (post.title) insertElement('h1', appContent, { class: 'model-name' }, post.title);

            // Creator
            if (post.user) {
                const userBLock = this.#genUserBlock(post.user);
                if(!SETTINGS.autoplay) userBLock.classList.add('image-hover-play');
                appContent.appendChild(userBLock);
            }

            // Description
            if (post.description) {
                const modelDescription = createElement('div', { class: 'model-description' });
                const description = this.#analyzeModelDescriptionString(post.description);
                const modelDescriptionFragment = safeParseHTML(description);
                this.#analyzeModelDescription(modelDescriptionFragment, cache);
                if(SETTINGS.colorCorrection) this.#analyzeTextColors(modelDescriptionFragment, isDarkMode ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 }); // TODO: real bg
                modelDescription.appendChild(modelDescriptionFragment);
                if (modelDescription.childNodes.length) appContent.appendChild(modelDescription);
            }

            const itemsList = this.gotoImages({ postId: post.id });

            if (itemsList.element) {
                appContentWide.appendChild(itemsList.element);
            }

            let promise = itemsList.promise;

            if (promise instanceof Promise) {
                promise = promise.then(() => ({ element: fragment, title }));
                return { promise };
            } else return { element: fragment, title };
        };

        const cached = this.#cache.postsInfo.get(`${id}`) || this.#preClickResults[`${id}-result`];
        if (cached) {
            this.#log('Loaded post (cache):', cached);
            return insertPostPage(cached);
        }

        const apiPromise = this.#preClickResults[id] ?? this.api.fetchPostInfo(id);
        const promise = apiPromise
        .then(data => {
            if (data?.id) this.#cache.postsInfo.set(`${data.id}`, data);
            if (pageNavigation !== this.#pageNavigation) return;
            this.#log('Loaded post:', data);
            const result = insertPostPage(data);
            if (result.promise) return result.promise;
            return result;
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            return this.#gotoError(error);
        });

        return { promise };
    }

    static gotoModelByHash(hash) {
        const pageNavigation = this.#pageNavigation;

        const redirect = model => {
            if (pageNavigation !== this.#pageNavigation) return;
            if (!model || !model?.modelId) {
                this.#log('There is no model id here...', model);
                const errorPage = this.#genErrorPage(model?.error ?? `No models found with this hash (${hash})`);
                return { element: errorPage };
            }
            const { modelId, name: modelVersionName } = model ?? {};
            return this.gotoModel(modelId, modelVersionName);
        };

        const cached = this.#cache.modelVersions.get(hash) || this.#preClickResults[`${hash}-result`];
        if (cached !== undefined) return redirect(cached);

        const apiPromise = this.#preClickResults[hash] ?? this.api.fetchModelVersionInfo(hash, true);
        const promise = apiPromise.then(redirect).catch(redirect);
        return { promise };
    }

    static gotoModel(id, version = null) {
        const pageNavigation = this.#pageNavigation;
        const navigationState = {...this.#state};

        const insertModelPage = model => {
            if (!model.modelVersions.length) {
                return this.#gotoError({ message: 'Model not available. API returned empty list.' });
            }

            const modelVersion = version ? model.modelVersions.find(v => v.name === version || v.id === Number(version)) ?? model.modelVersions[0] : model.modelVersions[0];
            const title = [model.name, modelVersion.name, modelVersion.baseModel, model.type];

            const fragment = new DocumentFragment();
            const appContent = insertElement('div', fragment, { class: 'app-content' });
            appContent.appendChild(this.#genModelPage({ model, version, state: navigationState }));

            // Images
            const appContentWide = insertElement('div', fragment, { class: 'app-content app-content-wide cards-list-container' });
            const imagesTitle = insertElement('h2', appContentWide, { style: 'justify-content: center;' });
            const imagesTitle_link = insertElement('a', imagesTitle, { href: `#images?model=${model.id}&modelversion=${modelVersion.id}` }, window.languagePack?.text?.images ?? 'Images');
            imagesTitle_link.prepend(getIcon('image'));
            let promise = null;
            if (this.#state.imagesLoaded) {
                const { element: imagesList, promise: imagesListPromise } = this.#genImages({ modelId: model.id, opCreator: model.creator?.username, modelVersionId: modelVersion.id, state: navigationState });
                if (imagesListPromise) {
                    let timerWon = false;
                    const timerPromise = new Promise(resolve =>
                        setTimeout(() => {
                            timerWon = true;
                            resolve();
                        }, 600)
                    );
                    promise = Promise.race([imagesListPromise, timerPromise]).then(() => timerWon ? imagesListPromise.then(() => this.onScroll()) : null);
                }
                appContentWide.appendChild(imagesList);
                appContentWide.appendChild(this.#genScrollToTopButton());
            } else {
                const imagesListTrigger = insertElement('div', appContentWide, undefined, '...');
                onTargetInViewport(imagesListTrigger, () => {
                    imagesListTrigger.remove();
                    this.#state.imagesLoaded = true;
                    const { element: imagesList, promise: imagesListPromise } = this.#genImages({ modelId: model.id, opCreator: model.creator?.username, modelVersionId: modelVersion.id, state: navigationState });
                    imagesListPromise?.then(() => {
                        if (pageNavigation !== this.#pageNavigation) return;
                        this.onScroll();
                    });
                    appContentWide.appendChild(imagesList);
                    appContentWide.appendChild(this.#genScrollToTopButton());
                });
            }

            if (promise instanceof Promise) {
                promise = promise.then(() => ({ element: fragment, title }));
                return { promise };
            } else return { element: fragment, title };
        };

        const cachedModel = this.#cache.models.get(`${id}`) || this.#preClickResults[`${id}-result`];
        if (cachedModel) {
            this.#log('Loaded model (cache):', cachedModel);
            return insertModelPage(cachedModel);
        }

        const apiPromise = this.#preClickResults[id] ?? this.api.fetchModelInfo(id);
        const promise = apiPromise
        .then(data => {
            if (data?.id) this.#cache.models.set(`${data.id}`, data);
            if (pageNavigation !== this.#pageNavigation) return;
            this.#log('Loaded model:', data);
            const result = insertModelPage(data);
            if (result.promise) return result.promise;
            return result;
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            return this.#gotoError(error);
        });

        return { promise };
    }

    static gotoModels(options = {}) {
        const { tag = '', query: searchQuery, username: searchUsername, collectionId = null } = options;
        const navigationState = {...this.#state};
        const cache = this.#cache.history.get(navigationState.id) ?? {};
        const forcedPeriod = collectionId ? 'AllTime' : null;
        const forcedType = collectionId ? [] : null;
        const forcedCheckpountType = collectionId ? 'All' : null;
        const forcedBaseModel = collectionId ? [] : null;
        let query;
        let modelById = new Map(), hiddenModels = 0;
        const fragment = new DocumentFragment();

        const filter = this.#genModelsListFilters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            infinityScroll.reload();
        }, {
            period: !forcedPeriod,
            types: !forcedType,
            checkpointType: !forcedCheckpountType,
            baseModels: !forcedBaseModel,
        });
        fragment.appendChild(filter);

        const appContent = insertElement('div', fragment, { class: 'app-content app-content-wide cards-list-container' });
        const listWrap = insertElement('div', appContent, { id: 'models-list' });
        appContent.appendChild(this.#genScrollToTopButton());

        const layoutConfig = {
            id: 'models',
            state: navigationState[`virtualScrollState-models`] ?? null,
            gap: CONFIG.appearance.modelCard.gap,
            itemWidth: CONFIG.appearance.modelCard.width,
            itemHeight: CONFIG.appearance.modelCard.height,
            progressiveGenerator: this.#genModelCardProgressive,
            getResizedOptions: () => ({
                gap: CONFIG.appearance.modelCard.gap,
                itemWidth: CONFIG.appearance.modelCard.width,
                itemHeight: CONFIG.appearance.modelCard.height
            }),
            passive: true,
            onElementRemove: this.#onCardRemoved.bind(this)
        };

        const onPointerDown = id => {
            if (!SETTINGS.assumeListSameAsModel || EXTENSION_INSTALLED) return;
            if (!modelById.has(id)) return;
            const model = modelById.get(id);
            this.#cache.models.set(`${id}`, model);
        };

        const loadItems = ({ cursor } = {}) => {
            if (cursor === undefined) {
                query = {
                    limit: CONFIG.perRequestLimits.models,
                    tag,
                    query: searchQuery,
                    collectionId,
                    username: searchUsername,
                    types: forcedType || SETTINGS.types,
                    sort: SETTINGS.sort,
                    period: forcedPeriod || SETTINGS.period,
                    checkpointType: forcedCheckpountType || SETTINGS.checkpointType,
                    baseModels: forcedBaseModel || SETTINGS.baseModels,
                    browsingLevel: SETTINGS.browsingLevel,
                    nsfw: SETTINGS.nsfw,
                };
                this.#state.filter = JSON.stringify(query);

                modelById = new Map();
                hiddenModels = 0;

                if (cache.filter === this.#state.filter && cache.models?.length) {
                    this.#log('Loading models (nav cache)');
                    cursor = cache.nextCursor ?? null;
                    return {
                        items: cache.models,
                        cursor: cache.nextCursor
                    };
                } else {
                    cache.models = [];
                    cache.nextCursor = null;
                    cache.filter = null;
                }
            } else query.cursor = cursor;


            const apiPromise = this.#preClickResults[JSON.stringify(query)] ?? this.api.fetchModels(query);
            return apiPromise.then(data => {
                cursor = data.metadata?.nextCursor ?? null;

                cache.nextCursor = cursor;
                cache.filter = this.#state.filter;
                cache.models = cache.models?.concat(data.items) ?? data.items;

                return { cursor, items: data.items };
            });
        };
        const prepareItems = models => {
            this.#log('Loaded models:', models);

            const hiddenBefore = hiddenModels;
            const countAll = models.length;

            if (EXTENSION_INSTALLED) {
                if (SETTINGS.blackListTagIds.length > 0 || SETTINGS.hideFurry || SETTINGS.hideExtreme || SETTINGS.hideGay) {

                    // A shallow copy of the list of models and images in versions (a full copy is too expensive)
                    // (since they can be filtered, and this filtering must not be passed through to the original object taken from the cache)
                    models = models.map(model => {
                        model = {...model};
                        model.modelVersions = model.modelVersions.map(version => {
                            version = {...version};
                            if (version.images) version.images = [...version.images];
                            return version;
                        });
                        return model;
                    });

                    let blackListTagIds = [...SETTINGS.blackListTagIds];
                    if (SETTINGS.hideFurry) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideFurry);
                    if (SETTINGS.hideExtreme) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideExtreme);
                    if (SETTINGS.hideGay) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideGay);
                    blackListTagIds = blackListTagIds.map(id => id.match(/[\+\-\|\&\?]/) ? id : `+${id}`);

                    // Filter images in each model
                    models = models.filter(model => {
                        const modelVersion = model.modelVersions[0];
                        if (!modelVersion.images.length) return true;
                        modelVersion.images = this.#filterImages(modelVersion.images, { blackListTagIds });
                        return modelVersion.images.length;
                    });

                    // Filter models
                    models = filterItems(models, [
                        { key: 'tagIds', conditions: blackListTagIds, type: 'number' },
                        // { key: 'modelVersions.0.images.0.tagIds', conditions: blackListTagIds, type: 'number' } // filtered above
                    ]);
                }
            } else {
                models = models.filter(model => (model?.modelVersions?.length && !model.tags?.some(tag => SETTINGS.blackListTags.includes(tag))));
            }

            if (models.length !== countAll) {
                this.#log(`Due to the selected tags for hiding, ${countAll - models.length} model(s) were hidden`);
                hiddenModels += countAll - models.length;
            }

            models.forEach(model => {
                if (modelById.has(model.id)) return;
                modelById.set(model.id, model);
            });

            const items = models.map(data => ({ id: data.id, data }));

            return { items, hidden: hiddenModels - hiddenBefore };
        };

        const infinityScroll = this.#genInfinityScroll({
            layoutConfig, onPointerDown, loadItems, prepareItems,
            labels: {
                hiddenItems: window.languagePack?.text?.hiddenModels ?? 'Due to the selected hide tags, {count} were hidden',
                units: window.languagePack?.units?.element ?? ['element', 'elements', 'elements'],
            }
        });

        listWrap.appendChild(infinityScroll.element);

        this.#addVirtualScroll(infinityScroll.layout);

        if (infinityScroll.promise instanceof Promise) {
            const firstLoadingPlaceholder = insertElement('div', appContent, { id: 'load-more', style: 'position: absolute; width: 100%;' });
            firstLoadingPlaceholder.appendChild(Controller.genLoadingIndecator());
            infinityScroll.promise.finally(() => firstLoadingPlaceholder.remove());
        }

        return {
            element: fragment,
            title: window.languagePack?.text?.models ?? 'Models',
            promise: infinityScroll.promise
        }
    }

    static createCivitUrl() {
        if (!location.hash.includes('?')) return null;
        try {
            const params = parseParams(location.hash.substring(location.hash.indexOf('?') + 1));

            if (params.model) return `${CONFIG.civitai_url}/models/${params.model}/`;
            if (params.article) return `${CONFIG.civitai_url}/articles/${params.article}/`;
            if (params.image) return `${CONFIG.civitai_url}/images/${params.image}/`;
            return null;
        } catch (_) {
            return null;
        }
    }

    static openFromCivitUrl(href) {
        const { localUrl } = this.parseCivUrl(href);
        if (!localUrl) return this.#gotoError(error, 'Unsupported url');
        this.navigate({ hash: localUrl });
    }

    static parseCivUrl(url) {
        let localUrl = null;

        try {
            url = (url instanceof URL) ? url : new URL(url);
            if (url.origin !== CONFIG.civitai_url) throw new Error(`Unknown url origin, must be ${CONFIG.civitai_url}`);

            const params = Object.fromEntries(url.searchParams);
            for (const rule of this.#civUrlRules) {
                if (rule.match({ url, params })) {
                    rule.parse({ url, params });
                    localUrl = rule.toLocal({ url, params });
                    break;
                }
            }

            return { localUrl, params };
        } catch (error) {
            if (!error?.message?.startsWith(`Failed to construct 'URL'`)) console.warn(error?.message ?? error);
            return { localUrl: null, params: {} };
        }
    }

    static createLinkPreview(url) {
        if (!(url instanceof URL)) url = toURL(url, location.origin);
        if (!url) return;

        let imageId = null, postId = null, modelId = null, articleId = null, collectionId = null, modelVersionId = null;

        if (url.origin === CONFIG.civitai_url) {
            const { params } = this.parseCivUrl(url);
            imageId = params.imageId;
            modelId = params.modelId;
            articleId = params.articleId;
            postId = params.postId;
            collectionId = params.collectionId;
            modelVersionId = params.modelVersionId;
        }

        if (url.origin === location.origin) {
            const [ pageId, paramString ] = url.hash.split('?') ?? [];
            const params = parseParams(paramString);
            imageId = params.image;
            postId = params.post;
            modelId = params.model;
            articleId = params.article;
            collectionId = params.collection;
            modelVersionId = params.version;
        }

        if (collectionId && EXTENSION_INSTALLED) {
            const showCollection = collection => {
                const card = this.#genCollectionCard(collection, { itemWidth: CONFIG.appearance.modelCard.width, itemHeight: CONFIG.appearance.modelCard.height, forceAutoplay: true, version: modelVersionId });
                return card;
            };

            if (this.#cache.collections.has(collectionId)) {
                const cached = this.#cache.collections.get(collectionId);
                if (cached) return showCollection(cached);
                else return this.#genErrorPage(`No collection with id ${collectionId}`);
            }

            return this.api.fetchCollectionInfo(collectionId).then(model => {
                if (model) this.#cache.collections.set(collectionId, model);
                return showCollection(model);
            }).catch(error => {
                if (error?.message.startsWith('No collection with id')) {
                    this.#cache.collections.set(collectionId, null); // Do not try to download again if there is no collection with this ID
                }
                return this.#genErrorPage(error?.message ?? 'Error');
            });
        }

        if (imageId || postId) {
            const showImage = media => {
                let maxImg = media;
                if (media instanceof Set) {
                    const arr = [...media];
                    maxImg = arr.reduce((max, img) => {
                        const s = img.stats;
                        const rate = s.likeCount + s.dislikeCount + s.cryCount + s.heartCount + s.laughCount;
                        if (rate > max.rate) {
                            max.rate = rate;
                            max.img = img;
                        }
                        return max;
                    }, { rate: -1, img: arr[0] }).img;

                    const newData = new Set([maxImg, ...arr.filter(img => img !== maxImg)]);
                    media = newData;
                }
                if (!media) return this.#genErrorPage('No Meta');
                const baseWidth = CONFIG.appearance.imageCard.width;
                const aspectRatio = Math.min(maxImg.width / maxImg.height, 2);
                const itemWidth = aspectRatio > 1.38 ? Math.round(baseWidth * aspectRatio) : baseWidth;
                const card = this.#genImageCard(media, { itemWidth, forceAutoplay: true });
                return card;
            };

            const cache = postId ? this.#cache.posts : this.#cache.images;
            const cached = cache.get(postId || imageId);
            if (cached) return showImage(cached);

            if (postId) {
                return this.api.fetchImages({ limit: 20, postId, period: 'AllTime' }).then(post => {
                    const items = post?.items ? new Set(post.items) : null;
                    if (items) cache.set(postId, items);
                    return showImage(items);
                }).catch(error => this.#genErrorPage(error?.message ?? 'Error'));
            }

            return this.api.fetchImageMeta(imageId).then(media => {
                if (media) cache.set(imageId, media);
                return showImage(media);
            }).catch(error => this.#genErrorPage(error?.message ?? 'Error'));
        }

        if (modelId) {
            const showModel = model => {
                const card = this.#genModelCard(model, { itemWidth: CONFIG.appearance.modelCard.width, itemHeight: CONFIG.appearance.modelCard.height, forceAutoplay: true, version: modelVersionId });
                return card;
            };

            if (this.#cache.models.has(modelId)) {
                const cached = this.#cache.models.get(modelId);
                if (cached) return showModel(cached);
                else return this.#genErrorPage(`No model with id ${modelId}`);
            }

            return this.api.fetchModelInfo(modelId).then(model => {
                if (model) this.#cache.models.set(modelId, model);
                return showModel(model);
            }).catch(error => {
                if (error?.message.startsWith('No model with id')) {
                    this.#cache.models.set(modelId, null); // Do not try to download again if there is no model with this ID
                }
                return this.#genErrorPage(error?.message ?? 'Error');
            });
        }

        if (articleId && EXTENSION_INSTALLED) {
            const showArticle = article => {
                const card = this.#genArticleCard(article, { itemWidth: CONFIG.appearance.modelCard.width, itemHeight: CONFIG.appearance.modelCard.height, forceAutoplay: true });
                return card;
            };

            if (this.#cache.articles.has(articleId)) {
                const cached = this.#cache.articles.get(articleId);
                if (cached) return showArticle(cached);
                else return this.#genErrorPage(`No article with id ${articleId}`);
            }

            return this.api.fetchArticle(articleId).then(article => {
                if (article) this.#cache.articles.set(articleId, article);
                return showArticle(article);
            }).catch(error => {
                if (error?.message.startsWith('No article with id')) {
                    this.#cache.articles.set(articleId, null); // Do not try to download again if there is no article with this ID
                }
                return this.#genErrorPage(error?.message ?? 'Error');
            });
        }
    }

    static #genModelPage(options) {
        const { model, version = null, state: navigationState = {...this.#state} } = options;
        const modelVersion = version ? model.modelVersions.find(v => v.name === version || v.id === Number(version)) ?? model.modelVersions[0] : model.modelVersions[0];
        const page = createElement('div', { class: 'model-page', 'data-model-id': model.id });

        const cache = this.#cache.history.get(navigationState.id) ?? {};
        if (!cache.descriptionImages) cache.descriptionImages = new Map();

        // Model name
        const modelNameWrap = insertElement('div', page, { class: 'model-name' });
        const modelNameH1 = insertElement('h1', modelNameWrap, undefined, model.name);
        const statsList = [
            { icon: 'like', value: model.stats.thumbsUpCount, unit: 'like' },
            { icon: 'download', value: model.stats.downloadCount, unit: 'download' },
            // { icon: 'bookmark', value: model.stats.favoriteCount, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
            { icon: 'chat', value: model.stats.commentCount, unit: 'comment' },
        ];
        const availabilityBadge = modelVersion.availability !== 'Public' ? modelVersion.availability : ((modelVersion.publishedAt ?? modelVersion.createdAt) > CONFIG.minDateForNewBadge) ? model.modelVersions.length > 1 ? 'Updated' : 'New' : null;
        const statsFragment = this.#genStats(statsList);
        if (availabilityBadge) {
            const iconId = { 'EarlyAccess': 'thunder', 'Updated': 'arrow_up_alt', 'New': 'plus' }[availabilityBadge] ?? null;
            const badge = createElement('div', { class: 'badge model-availability', 'data-badge': availabilityBadge }, window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge);
            badge.prepend(getIcon(iconId || 'information'));
            statsFragment.appendChild(badge);
        }
        modelNameH1.appendChild(statsFragment);

        // Download buttons
        const downloadButtons = insertElement('div', modelNameWrap, { class: 'model-download-files' });
        const fileTypeRegex = /\.([^\.]+)$/;
        const downloadFileHashes = new Set();
        modelVersion.files.forEach(file => {
            const hash = file.hashes?.SHA256 || file.hashes?.AutoV3 || file.hashes?.AutoV2 || null;
            if (!hash) console.log('This file has no hashes', file);
            if (downloadFileHashes.has(hash)) return;
            downloadFileHashes.add(hash);
            const download = window.languagePack?.text?.download ?? 'Download';
            const fileSize = filesizeToString(file.sizeKB / 0.0009765625);
            const a = insertElement('a', downloadButtons, { class: 'link-button', target: '_blank', href: file.downloadUrl, 'lilpipe-text': `<b>${escapeHtml(file.type)}</b><br><span style="word-break:break-word;">${escapeHtml(file.name)?.replace(fileTypeRegex, '<span style="color:var(--c-text-darker);">.$1</span>') || ''}</span>`, 'lilpipe-delay': 600 });
            a.appendChild(getIcon('download'));
            if (file.type === 'Model') {
                const downloadTitle = `${download} ${file.metadata.fp ?? ''}` + (file.metadata.format === 'SafeTensor' ? '' : ` ${file.metadata.format}`);
                a.appendChild(document.createTextNode(` ${downloadTitle}`));
                insertElement('span', a, { class: 'dark-text' }, ` ${fileSize}`);
            } else if (file.type === 'Archive') {
                const downloadTitle = download;
                a.appendChild(document.createTextNode(` ${download}`));
                insertElement('span', a, { class: 'dark-text' }, ` ${fileSize}`);
                a.appendChild(getIcon('file_zip'));
            } else {
                const downloadTitle = download + (file.metadata.format === 'SafeTensor' ? '' : ` ${file.metadata.format}`);
                a.appendChild(document.createTextNode(` ${downloadTitle}`));
                insertElement('span', a, { class: 'dark-text' }, ` ${fileSize}`);
                a.appendChild(getIcon('file'));
            }
            if (file.virusScanResult !== 'Success') {
                a.classList.add('link-warning');
                a.setAttribute('lilpipe-text', `${a.getAttribute('lilpipe-text') || ''}<br><b>${escapeHtml(file.virusScanMessage ?? file.virusScanResult)}</b>`);
                a.appendChild(getIcon('warning'));
            }
            if (file.name) a.setAttribute('data-filename', file.name);
        });

        // Model sub name
        const publishedAt = new Date(modelVersion.publishedAt ?? modelVersion.createdAt);
        const modelTagsWrap = insertElement('div', page, { class: 'badges model-tags' });
        const updateTags = tags => {
            modelTagsWrap.textContent = '';
            let categoryLink;
            tags.forEach(tag => {
                const a = insertElement('a', modelTagsWrap, { href: `#models?tag=${encodeURIComponent(tag)}`, class: (SETTINGS.blackListTags.includes(tag) ? 'badge error-text' : 'badge') }, tag);
                if (tag === modelVersion.baseModel) categoryLink = a;
            });
            
            if (modelVersion.baseModel) {
                if (!categoryLink) categoryLink = createElement('div', { class: 'badge' });
                categoryLink.textContent = this.#models.labels[modelVersion.baseModel] ?? modelVersion.baseModel;
                categoryLink.classList.add('model-category', 'separated-right');
                modelTagsWrap.prepend(categoryLink);
            }

            const badgePublishedAt = createElement('div', { class: 'badge model-category separated-right', 'lilpipe-text': escapeHtml(`${window.languagePack?.text?.Updated ?? 'Updated'}: ${publishedAt.toLocaleString()}`) }, timeAgo(Math.round((Date.now() - publishedAt)/1000)));
            modelTagsWrap.prepend(badgePublishedAt);
        };
        if (this.#state.model_tags || model.tags.join('').length <= 80) updateTags(model.tags);
        else {
            updateTags(model.tags.reduce((acc, tag) => (acc.join('').length + tag.length <= 80 ? [...acc, tag] : acc), []));
            const showMore = insertElement('button', modelTagsWrap, { class: 'show-more' });
            showMore.appendChild(getIcon('arrow_down'));
            insertElement('span', showMore, { class: 'darker-text', style: 'font-size: .75em;' }, ` +${model.tags.length - 12}`);
            showMore.addEventListener('click', () => {
                this.#state.model_tags = true;
                updateTags(model.tags);
            }, { once: true });
        }

        const modelVersionsWrap = insertElement('div', page, { class: 'badges model-versions' });
        const modelVersionsElements = [];
        model.modelVersions.forEach(version => {
            const href = `#models?model=${encodeURIComponent(model.id)}&version=${encodeURIComponent(version.id)}`;
            const isActive = version.id === modelVersion.id;
            const button = insertElement('a', modelVersionsWrap, { class: 'badge', href, tabindex: -1 });
            if (version.publishedAt > CONFIG.minDateForNewBadge) button.classList.add('recently-updated');
            if (isActive) button.classList.add('active');
            button.appendChild(this.#formatModelVersionName(version.name));
            modelVersionsElements.push(button);
        });
        modelVersionsElements[0]?.setAttribute('tabindex', 0);
        
        let fakeIndex = 0;
        const setFakeFocus = index => {
            modelVersionsWrap.querySelector('[tabindex="0"]')?.setAttribute('tabindex', -1);
            modelVersionsElements[index].setAttribute('tabindex', 0);
            modelVersionsElements[index].focus();
        };
        modelVersionsWrap.addEventListener('keydown', e => {
            if (e.ctrlKey) return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                fakeIndex = (fakeIndex + 1) % model.modelVersions.length;
                setFakeFocus(fakeIndex);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                fakeIndex = (model.modelVersions.length + fakeIndex - 1) % model.modelVersions.length;
                setFakeFocus(fakeIndex);
            }
        });

        // Model preview
        if (modelVersion.images?.length) {
            const modelPreviewWrap = insertElement('div', page, { class: 'model-preview' });
            const previewImages = modelVersion.images.filter(media => media.nsfwLevel <= SETTINGS.browsingLevel);
            // const rawImages = modelVersion.images.filter(media => media.nsfwLevel <= SETTINGS.browsingLevel);
            // const filteredImages = this.#filterImages(rawImages, { results: true });
            // const previewImages = filteredImages.filter(it => it.ok).map(it => it.item);
            const isWideMinRatio = 1.38;
            const generateMediaPreview = media => {
                const ratio = this.#round(media.width/media.height);
                const item = media.id && media.hasMeta? createElement('a', { href: media.id ? `#images?image=${encodeURIComponent(media.id)}&nsfw=${this.#convertNSFWLevelToString(media.nsfwLevel)}` : '', 'data-id': media.id ?? -1, tabindex: -1 }) : createElement('div');
                const itemWidth = ratio >= isWideMinRatio && CONFIG.appearance.modelPage.carouselItemsCount > 1 ? CONFIG.appearance.modelPage.carouselItemWidth * 2 : CONFIG.appearance.modelPage.carouselItemWidth;
                const mediaElement = this.#genMediaElement({ media, width: itemWidth, height: undefined, loading: undefined, taget: 'model-preview', allowAnimated: true });
                item.appendChild(mediaElement);
                return item;
            };
            const onCarouselScroll = currentId => {
                // In this place, often, the images do not have normal ids...
                // so you need to store the link...
                const item = currentId !== undefined ? previewList.find(i => i.id === currentId) : null;
                this.#state.carouselCurrentUrl = item?.data?.url;
            };
            const previewList = previewImages.map((media, index) => {
                const id = media.id ?? (media?.url?.match(/(\d+).\S{2,5}$/) || [])[1];
                if (!media.id && id) media.id = id;
                const element = index < CONFIG.appearance.modelPage.carouselItemsCount ? generateMediaPreview(media) : null;
                const isWide = media.width/media.height >= isWideMinRatio && CONFIG.appearance.modelPage.carouselItemsCount > 1;
                return { id: media.id, data: media, element, width: media.width, height: media.height, isWide };
            });

            // Try to insert a picture from the previous page, if available
            for (let i = 0; i < CONFIG.appearance.modelPage.carouselItemsCount; i++) {
                const item = previewList[i];
                if (!item?.element) break;
                this.#genMediaPreviewFromPrevPage(item.element, item.id);
            }


            const carouselCurrentId = this.#state.carouselCurrentUrl !== undefined ? previewList.findIndex(i => i.data?.url === this.#state.carouselCurrentUrl) : -1;
            const carouselWrap = new InfiniteCarousel(previewList, {
                gap: CONFIG.appearance.modelPage.carouselGap,
                itemWidth: CONFIG.appearance.modelPage.carouselItemWidth,
                generator: generateMediaPreview,
                active: carouselCurrentId !== -1 ? carouselCurrentId : 0,
                onElementRemove: this.#onCardRemoved.bind(this),
                onScroll: onCarouselScroll,
                visibleCount: CONFIG.appearance.modelPage.carouselItemsCount,
            });
            modelPreviewWrap.appendChild(carouselWrap);
        }

        const hideLongDescription = (descriptionId, el) => {
            if (this.#state[`long_description_${descriptionId}`] || el.children.length < 40) {
                if (el.children.length > 400) fixDescriptionXL(descriptionId, el);
                return;
            }
            el.classList.add('hide-long-description');
            const showMore = createElement('button', { class: 'show-more' });
            showMore.appendChild(getIcon('arrow_down'));
            el.appendChild(showMore);
            showMore.addEventListener('click', () => {
                this.#state[`long_description_${descriptionId}`] = true;
                el.classList.remove('hide-long-description');
                showMore.remove();
                if (el.children.length > 400) fixDescriptionXL(descriptionId, el);
            }, { once: true });
        };
        const fixDescriptionXL = (id, description) => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (!this.appElement.contains(description)) return;

                const virtualScroll = this.#genFakeVirtualScroll(id, description);
                this.#addVirtualScroll(virtualScroll);
            }));
        };

        // Model version description block
        const modelVersionDescription = insertElement('div', page, { class: 'model-description model-version-description' });
        const modelVersionNameWrap = insertElement('h2', modelVersionDescription, { class: 'model-version' });
        const modelVersionNameWrapSpan = insertElement('span', modelVersionNameWrap);
        modelVersionNameWrapSpan.appendChild(this.#formatModelVersionName(modelVersion.name));
        const versionStatsList = [
            { icon: 'like', value: modelVersion.stats.thumbsUpCount, unit: 'like' },
            { icon: 'download', value: modelVersion.stats.downloadCount, unit: 'download' },
        ];
        modelVersionNameWrap.appendChild(this.#genStats(versionStatsList));

        // Creator
        if (model.creator) {
            const userInfo = {...model.creator};
            if (userInfo.username) userInfo.url = `#models?username=${userInfo.username}`;
            if (!userInfo.userId) userInfo.userId = model.userId;
            const userBLock = this.#genUserBlock(userInfo);
            if(!SETTINGS.autoplay) userBLock.classList.add('image-hover-play');
            modelVersionDescription.appendChild(userBLock);
            const draggableTitleBase = window.languagePack?.text?.models_from ?? 'Models from {username}';
            userBLock.querySelector('a')?.setAttribute('data-draggable-title', draggableTitleBase.replace('{username}', model.creator?.username || 'user'));
        }

        // Trigger words
        if (modelVersion.trainedWords?.length > 0) {
            const trainedWordsContainer = insertElement('div', modelVersionDescription, { class: 'trigger-words' });
            modelVersion.trainedWords.forEach(word => {
                // Remove commas at the end or beginning of the trigger, it seems that constructions like "some_tag, " are not what should be there
                // Add spaces after "," and "."
                if (!SETTINGS.disablePromptFormatting) {
                    word = word.trim();
                    if (word.startsWith(',')) word = word.slice(1);
                    if (word.endsWith(',')) word = word.slice(0, -1);
                    word = word.replace(/(,)(?!\s)/g, '$1 ');
                    word = word.trim();
                }

                const item = insertElement('code', trainedWordsContainer, { class: 'trigger-word' }, `${word} `);
                const copyButton = getIcon('copy');
                item.appendChild(copyButton);
                copyButton.addEventListener('click', () => {
                    toClipBoard(word);
                    notify(window.languagePack?.text?.copied ?? 'Copied');
                    console.log(`Trigger word: ${word}`);
                });
            });
        }

        // to select the background color when correcting colors
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Version description
        if (modelVersion.description) {
            const description = this.#analyzeModelDescriptionString(modelVersion.description);
            const modelVersionFragment = safeParseHTML(description);
            this.#analyzeModelDescription(modelVersionFragment, cache);
            if (SETTINGS.colorCorrection) this.#analyzeTextColors(modelVersionFragment, isDarkMode ? { r: 40, g: 40, b: 40 } : { r: 238, g: 238, b: 238 }); // TODO: real bg
            modelVersionDescription.appendChild(modelVersionFragment);
            hideLongDescription('modelVersion', modelVersionDescription);
        }

        // Model descrition
        if (model.description) {
            const modelDescription = createElement('div', { class: 'model-description' });
            const description = this.#analyzeModelDescriptionString(model.description);
            const modelDescriptionFragment = safeParseHTML(description);
            this.#analyzeModelDescription(modelDescriptionFragment, cache);
            if(SETTINGS.colorCorrection) this.#analyzeTextColors(modelDescriptionFragment, isDarkMode ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 }); // TODO: real bg
            modelDescription.appendChild(modelDescriptionFragment);
            hideLongDescription('model', modelDescription);
            if (modelDescription.childNodes.length) page.appendChild(modelDescription);
        }

        // Open in CivitAI
        insertElement('a', page, { href: `${CONFIG.civitai_url}/models/${model.id}?modelVersionId=${modelVersion.id}`, target: '_blank', class: 'link-button link-open-civitai'}, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        return page;
    }

    static #genImageFullPage(media) {
        const fragment = new DocumentFragment();

        const cachedPostInfo = this.#cache.posts.get(`${media.postId}`);
        const postInfo = cachedPostInfo ?? new Set([media]);
        const mediaById = new Map();

        const carouselItems = [];
        const mediaGenerator = item => {
            const mediaElement = this.#genMediaElement({ media: item, className: 'media-full-preview', width: item.width, target: 'full-image', autoplay: true, original: true, controls: true, decoding: 'async', playsinline: false, setMediaElementOriginalSizes: true });
            return mediaElement;
        };
        if (postInfo.size > 1) {
            postInfo.forEach(item => {
                mediaById.set(item.id, item);
                carouselItems.push({ id: item.id, data: item, width: item.width, height: item.height, index: carouselItems.length });
            });
        }

        const insertMeta = (media, container) => {
            const title = (window.languagePack?.text?.image_by ?? 'Image by {username}').replace('{username}', media.username);

            // Creator and Created At
            const creator = this.#genUserBlock({ userId: media.userId, username: media.username, url: `#images?username=${media.username}` });
            if (media.createdAt) {
                const createdAt = new Date(media.createdAt);
                insertElement('span', creator, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
            }
            const draggableTitleBase = window.languagePack?.text?.images_from ?? 'Images from {username}';
            creator.querySelector('a')?.setAttribute('data-draggable-title', draggableTitleBase.replace('{username}', media.username || 'user'));
            container.appendChild(creator);

            // Stats
            const stats = media.stats;
            const statsList = [
                { iconString: '👍', value: stats.likeCount, unit: 'like' },
                { iconString: '👎', value: stats.dislikeCount, unit: 'dislike' },
                { iconString: '😭', value: stats.cryCount, unit: 'cry' },
                { iconString: '❤️', value: stats.heartCount, unit: 'heart' },
                { iconString: '🤣', value: stats.laughCount, unit: 'laugh' },
                { iconString: '💬', value: stats.commentCount, unit: 'comment' },
            ];
            const statsFragment = this.#genStats(statsList, true);

            // NSFW LEvel
            const nsfwLevel = typeof media.nsfwLevel === 'number' ? this.#convertNSFWLevelToString(media.nsfwLevel) : media.nsfwLevel;
            if (nsfwLevel !== 'None') {
                const nsfwBadge = createElement('div', { class: 'image-nsfw-level badge separated-right', 'data-nsfw-level': nsfwLevel }, nsfwLevel);
                statsFragment.prepend(nsfwBadge);
            }

            container.appendChild(statsFragment);

            // Post link
            if (!cachedPostInfo || cachedPostInfo.size > 1) {
                const postLink = insertElement('a', container, { class: 'image-post badge', href: `#images?post=${media.postId}` });
                if (cachedPostInfo) postLink.appendChild(document.createTextNode(cachedPostInfo.size));
                postLink.appendChild(getIcon('image'));
                postLink.appendChild(document.createTextNode(window.languagePack?.text?.view_post ?? 'View Post'));
            }

            // Generation info
            if (media.meta) {
                // For some reason the API started returning meta.meta...
                const meta = media.meta?.meta && Object.keys(media.meta).length < 4 ? media.meta?.meta : media.meta;
                container.appendChild(this.#genImageGenerationMeta(meta));
            }
            else insertElement('div', container, undefined, window.languagePack?.text?.noMeta ?? 'No generation info');

            insertElement('a', container, { href: `${CONFIG.civitai_url}/images/${media.id}`, target: '_blank', class: 'link-button link-open-civitai' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

            return { title };
        };

        // Full image
        const mediaElement = mediaGenerator(media);
        // Try to insert a picture from the previous page, if available
        this.#genMediaPreviewFromPrevPage(mediaElement, media.id);

        const volumeKey = 'civitai-lite-viewer--video-volume';
        const mutedKey = 'civitai-lite-viewer--video-muted';
        let volume = parseFloat(localStorage.getItem(volumeKey)) ?? 0;
        let muted = localStorage.getItem(mutedKey) === 'true';
        const setVolume = (video, targetVolume, isMuted, fade = true) => {
            if (!video) return;
            if (video._fadeTimer) clearInterval(video._fadeTimer);

            if (isMuted) {
                video.muted = true;
                return;
            }

            video.muted = false;
            
            if (!fade) {
                video.volume = targetVolume;
                return;
            }

            video.volume = 0;
            const duration = 1000;
            const step = 0.05;
            const interval = duration / (targetVolume / step);

            video._fadeTimer = setInterval(() => {
                if (video.volume < targetVolume) {
                    video.volume = Math.min(video.volume + step, targetVolume);
                } else {
                    clearInterval(video._fadeTimer);
                    video._fadeTimer = null;
                }
            }, interval);
        };
        const addVideoListeners = video => {
            if (video._hasListeners) return;

            video.addEventListener('volumechange', () => {
                if (video._fadeTimer) return;

                volume = video.volume;
                muted = video.muted;
                localStorage.setItem(volumeKey, volume);
                localStorage.setItem(mutedKey, muted);
            });

            video._hasListeners = true;
        };
        const waitVideoCreation = mediaElement => {
            return new Promise(resolve => {
                if (!mediaElement.classList.contains('media-video')) return resolve(null);
                const poster = mediaElement.querySelector('.media-element');
                const observer = new MutationObserver(() => {
                    if (!mediaElement.contains(poster)) {
                        observer.disconnect();
                        const video = mediaElement.querySelector('video');
                        if (video) addVideoListeners(video);
                        resolve(video || null);
                    }
                });
    
                observer.observe(mediaElement, { childList: true, subtree: false });
            });
        };
        // if (media.type === 'video') waitVideoCreation(mediaElement).then(video => setVolume(video, volume, muted, true));

        if (carouselItems.length > 1) {
            const item = carouselItems.find(item => item.id === media.id);
            const itemWidth = Math.min(carouselItems.reduce((w, it) => it.width < w ? it.width : w, carouselItems[0].width), 800);
            item.element = mediaElement;
            const carouselElement = new InfiniteCarousel(carouselItems, {
                gap: 0,
                visibleCount: 1,
                active: item.index,
                itemWidth,
                generator: mediaGenerator,
                onElementRemove: this.#onCardRemoved.bind(this),
                onScroll: id => {
                    metaContainer.textContent = '';
                    const media = mediaById.get(id);
                    const { title } = insertMeta(media, metaContainer);
                    // if (media.type === 'video') {
                    //     const mediaElement = document.querySelector('.media-full-preview');
                    //     waitVideoCreation(mediaElement).then(video => setVolume(video, volume, muted, false));
                    // }
                    this.navigate({
                        hash: `#images?image=${id}&nsfw=${media.nsfwLevel}`,
                        soft: true,
                        title
                    });
                }
            });
            fragment.appendChild(carouselElement);
        } else fragment.appendChild(mediaElement);


        const metaContainer = createElement('div', { class: 'media-full-meta' });
        const { title } = insertMeta(media, metaContainer);
        fragment.appendChild(metaContainer);

        return { element: fragment, title };
    }

    static #genInfinityScroll(options) {
        const { layoutConfig, loadItems, prepareItems, onPointerDown, labels = {} } = options;
        let promise, cursor, firstDraw = false, hiddenItems = 0;

        const element = createElement('div', { class: 'cards-list' });

        if (onPointerDown) {
            element.addEventListener('pointerdown', e => {
                const a = e.target.closest('a[data-id]');
                const id = Number(a?.getAttribute('data-id'));
                onPointerDown(id);
            }, { capture: true });
        }

        const layout = new MasonryLayout(element, layoutConfig);

        const loadMore = () => {
            if (!cursor) return;
            const result = loadItems({ cursor });

            if (result instanceof Promise) {
                const pageNavigation = this.#pageNavigation;
                document.getElementById('page-loading-bar')?.remove();
                insertElement('div', document.body, { id: 'page-loading-bar' });
                return result.then(result => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    document.getElementById('page-loading-bar')?.remove();
                    cursor = result.cursor;
                    insertItems(result.items);
                }).catch(error => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    document.getElementById('page-loading-bar')?.remove();
                    console.error('Failed to fetch items:', error?.message ?? error);
                    element.classList.add('error');
                    element.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
                });
            } else {
                cursor = result.cursor;
                insertItems(result.items);
            }
        };

        const insertItems = items => {
            const result = prepareItems(items);
            items = result.items;
            hiddenItems += result.hidden;

            layout.addItems(items, firstDraw);

            if (cursor) {
                const pageNavigation = this.#pageNavigation;
                const loadMoreTrigger = insertElement('div', element, { id: 'load-more' });
                loadMoreTrigger.appendChild(Controller.genLoadingIndecator());
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    const promise = loadMore();
                    if (promise instanceof Promise) promise.finally(() => loadMoreTrigger.remove());
                    else loadMoreTrigger.remove();
                });
            } else {
                const loadNoMore = insertElement('div', element, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
                if (hiddenItems) {
                    const hiddenTextBase = labels.hiddenItems ?? 'Some elements were hidden due to the selected filter settings ({count})';
                    const units = labels.units ?? ["element", "elements", "elements"];
                    const text = hiddenTextBase.replace('{count}', `${hiddenItems} ${escapeHtml(pluralize(hiddenItems, units))}`);
                    insertElement('span', loadNoMore, { class: 'darker-text' }, text);
                }
            }
        };

        const getCardPositions = cards => {
            const wh = window.innerHeight;
            const ww = window.innerWidth;
            const checkIsVisible = rect => rect.top < wh && rect.bottom > 0 && rect.left < ww && rect.right > 0;
            cards.forEach(item => {
                if (item.from && !item.from.bounds) {
                    item.from.bounds = item.from.card.getBoundingClientRect();
                    item.from.isVisible = checkIsVisible(item.from.bounds);
                }

                if (item.to && !item.to.bounds) {
                    item.to.bounds = item.to.card.getBoundingClientRect();
                    item.to.isVisible = checkIsVisible(item.to.bounds);
                }
            });
        };

        const animateLayoutChanges = changeCallback => {
            if (!element.textContent) return changeCallback();

            const cards = new Map();
            element.querySelectorAll('.card[data-id]').forEach(card => {
                const id = card.getAttribute('data-id');
                cards.set(id, { from: { card } });
            });
            getCardPositions(cards);

            changeCallback();
            element.querySelectorAll('.card[data-id]').forEach(card => {
                const id = card.getAttribute('data-id');
                if (!cards.has(id)) cards.set(id, { to: { card } });
                else {
                    const item = cards.get(id);
                    item.to = { card };
                    item.animation = 'shift';
                }
            });

            if (!cards.values().some(item => item.animation)) return; // Skip if nothing to shift

            element.classList.remove('cards-loading');
            cards.forEach(item => {
                if (!item.from?.isVisible || item.to) return;
                element.appendChild(item.from.card);
                item.animation = 'remove';
            });
            getCardPositions(cards);

            const animations = [];
            cards.forEach(item => {
                if (item.animation === 'shift') {
                    if (!item.to?.isVisible && !item.from?.isVisible) return;
                    const bn = item.to.bounds;
                    const bo = item.from.bounds;
                    if (bn.left === bo.left && bn.top === bo.top) return; // same position
                    animations.push({
                        element: item.to.card,
                        keyframes: {
                            transform: [`translate(${bo.left - bn.left}px, ${bo.top - bn.top}px)`, 'translate(0px, 0px)']
                        }
                    });
                } else if (item.animation === 'remove') {
                    if (!item.from?.isVisible) return;
                    animations.push({
                        element: item.from.card,
                        keyframes: {
                            transform: ['scale(1)', 'scale(0)'],
                            opacity: [1, 0]
                        },
                        removeAfter: true
                    });
                } else if (item.to?.isVisible) {
                    animations.push({
                        element: item.to.card,
                        keyframes: {
                            transform: ['scale(0)', 'scale(1)'],
                            opacity: [0, 1]
                        }
                    });
                }
            });

            const easing = 'cubic-bezier(0.33, 1, 0.68, 1)', duration = 300, fill = 'forwards';
            element.classList.add('cards-animating');
            return Promise.allSettled(animations.map(({ element, keyframes }) => animateElement(element, { keyframes, easing, duration, fill })))
            .then(() => {
                element.classList.remove('cards-animating');
                animations.forEach(item => item.removeAfter ? item.element.remove() : null);
            });
        };

        const reload = () => {
            cursor = undefined;
            hiddenItems = 0;
            const result = loadItems();
            if (result instanceof Promise) {
                const parent = element.parentElement;
                parent?.classList.add('cards-loading');
                element.setAttribute('inert', '');
                element.classList.remove('error');
                const pageNavigation = this.#pageNavigation;

                document.getElementById('page-loading-bar')?.remove();
                insertElement('div', document.body, { id: 'page-loading-bar' });

                promise = result.then(result => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    cursor = result.cursor;
                    promise = animateLayoutChanges(() => {
                        layout.clear();
                        insertItems(result.items);
                    });
                    parent?.classList.remove('cards-loading'); // Remove loading class immediately after animation starts
                    return promise;
                }).catch(error => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    console.error('Failed to fetch items:', error?.message ?? error);
                    element.textContent = '';
                    element.classList.add('error');
                    element.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
                }).finally(() => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    document.getElementById('page-loading-bar')?.remove();
                    parent?.classList.remove('cards-loading');
                    element.removeAttribute('inert');
                });
            } else {
                cursor = result.cursor;
                promise = animateLayoutChanges(() => {
                    layout.clear();
                    insertItems(result.items);
                });
                return promise;
            }
        };

        firstDraw = true;
        reload();
        firstDraw = false;

        return { element, promise, reload, layout };
    }

    static #genImages(options) {
        const { modelId, modelVersionId, collectionId, postId, userId, username, opCreator = null, state: navigationState = {...this.#state} } = options; // Snippet_1 : modelId
        const isSpecific = modelVersionId || collectionId || modelId || userId || username || postId;
        const forcedPeriod = collectionId || postId ? 'AllTime' : null;
        const cache = this.#cache.history.get(navigationState.id) ?? {};
        let query;
        let groupingByPost = SETTINGS.groupImagesByPost && !postId;
        let imagesMetaById = new Map(), postsById = new Map(), hiddenImages = 0;

        const fragment = new DocumentFragment();
        const listWrap = createElement('div', { id: 'images-list'});

        const layoutConfig = {
            id: 'images',
            state: navigationState[`virtualScrollState-images`] ?? null,
            gap: CONFIG.appearance.imageCard.gap,
            itemWidth: CONFIG.appearance.imageCard.width,
            progressiveGenerator: this.#genImageCardProgressive,
            getResizedOptions: () => ({
                gap: CONFIG.appearance.imageCard.gap,
                itemWidth: CONFIG.appearance.imageCard.width
            }),
            passive: true,
            onElementRemove: this.#onCardRemoved.bind(this)
        };

        const onPointerDown = id => {
            if (!SETTINGS.assumeListSameAsImage || EXTENSION_INSTALLED) return;
            if (!imagesMetaById.has(id)) return;
            const imageMeta = imagesMetaById.get(id);
            const postInfo = imageMeta.postId ? postsById.get(imageMeta.postId) : null;
            this.#cache.images.set(`${id}`, imageMeta);
            if (postInfo) this.#cache.posts.set(`${imageMeta.postId}`, postInfo);
        };

        const loadItems = ({ cursor } = {}) => {
            if (cursor === undefined) {
                const baseModels = !EXTENSION_INSTALLED || isSpecific ? [] : SETTINGS.baseModels_images;
                query = {
                    limit: CONFIG.perRequestLimits.images,
                    sort: SETTINGS.sort_images,
                    period: forcedPeriod || SETTINGS.period_images,
                    browsingLevel: SETTINGS.browsingLevel,
                    nsfw: SETTINGS.nsfwLevel,
                    baseModels,
                    modelVersionId,
                    collectionId,
                    modelId, // Snippet_1
                    userId,
                    username,
                    postId
                };
                groupingByPost = SETTINGS.groupImagesByPost && !postId;
                this.#state.filter = JSON.stringify(query);

                imagesMetaById = new Map();
                postsById = new Map();
                hiddenImages = 0;

                if (cache.filter === this.#state.filter && cache.images?.length) {
                    this.#log('Loading images (nav cache)');
    
                    return {
                        items: cache.images,
                        cursor: cache.nextCursor ?? null
                    };
                } else {
                    cache.images = [];
                    cache.nextCursor = null;
                    cache.filter = null;
                }
            } else query.cursor = cursor;


            return this.api.fetchImages(query).then(data => {
                cursor = data.metadata?.nextCursor ?? null;

                // Delete the large comfy field (I don't break it down into additional meta information in the script),
                // and if you need to copy it, it's often in the image and can be dragged onto comfy.
                data.items.forEach(img => {
                    if (img.meta?.comfy) img.meta.comfy = true;
                    if (img.meta?.meta?.comfy) img.meta.meta.comfy = true;
                    return img;
                });

                cache.nextCursor = cursor;
                cache.filter = this.#state.filter;
                cache.images = cache.images?.concat(data.items) ?? data.items;

                return { cursor, items: data.items };
            });
        };
        const prepareItems = images => {
            this.#log('Loaded images:', images);

            const countHidden = { noMeta: 0, noPositivePrompt: 0, noNegativePrompt: 0, noResources: 0, badTags: 0 };
            const hiddenBefore = hiddenImages;
            const countAll = images.length;
            if (SETTINGS.hideImagesWithoutPositivePrompt || SETTINGS.hideImagesWithoutNegativePrompt || SETTINGS.hideImagesWithoutResources) {
                images = images.filter(image => {
                    // For some reason the API started returning meta.meta...
                    const meta = image.meta?.meta && Object.keys(image.meta).length < 4 ? image.meta?.meta : image.meta;
                    if (!meta) {
                        countHidden.noMeta++;
                        return false;
                    }

                    if (
                        SETTINGS.hideImagesWithoutPositivePrompt
                        && (!meta.prompt || meta.prompt.length < CONFIG.filters.minPromptLength)
                    ) {
                        countHidden.noPositivePrompt++;
                        return false;
                    }

                    if (
                        SETTINGS.hideImagesWithoutNegativePrompt
                        && (!meta.negativePrompt || meta.negativePrompt.length < CONFIG.filters.minPromptLength)
                    ) {
                        countHidden.noNegativePrompt++;
                        return false;
                    }

                    if (
                        SETTINGS.hideImagesWithoutResources
                        && !(meta.civitaiResources?.length || meta.resources?.length || meta.additionalResources?.length || (meta.hashes && Object.keys(meta.hashes).length) || meta['Model hash']) // Filter out some images before parsing
                        && !this.#parseMeta(meta).resources.length
                    ) {
                        countHidden.noResources++;
                        return false;
                    }

                    return true;
                });
            }

            if (SETTINGS.blackListTagIds.length > 0 || SETTINGS.hideFurry || SETTINGS.hideExtreme || SETTINGS.hideGay) {
                const countBefore = images.length;
                images = this.#filterImages(images);
                if (countBefore !== images.length) countHidden.badTags = countBefore - images.length;
            }

            if (images.length < countAll) {
                hiddenImages += countAll - images.length;
                const hiddenCountMessages = [];
                if (countHidden.noMeta) hiddenCountMessages.push(`${countHidden.noMeta} without meta`);
                if (countHidden.noPositivePrompt) hiddenCountMessages.push(`${countHidden.noPositivePrompt} without positive prompt`);
                if (countHidden.noNegativePrompt) hiddenCountMessages.push(`${countHidden.noNegativePrompt} without negative prompt`);
                if (countHidden.noResources) hiddenCountMessages.push(`${countHidden.noResources} without used resources`);
                if (countHidden.badTags) hiddenCountMessages.push(`${countHidden.badTags} with blacklist tags`);
                this.#log(`Hidden ${hiddenImages - hiddenBefore} image(s):\n  ${hiddenCountMessages.join('\n  ')}`);
            }

            const usedPosts = new Set();
            const items = [];
            for (const image of images) {
                if (imagesMetaById.has(image.id)) continue;
                imagesMetaById.set(image.id, image);

                // Mark user as model uploader
                if (opCreator && image.username === opCreator) image.usergroup = 'OP';
    
                if (!postsById.has(image.postId)) postsById.set(image.postId, new Set());
                postsById.get(image.postId).add(image);

                if (groupingByPost) {
                    if (usedPosts.has(image.postId)) continue;
                    usedPosts.add(image.postId);
                }

                const aspectRatio = image.width / image.height;
                if (groupingByPost) items.push({ id: image.postId, aspectRatio, data: postsById.get(image.postId) });
                else items.push({ id: image.id, aspectRatio, data: image });
            }

            // Select image with the most reactions in each group
            items.forEach(item => {
                if (item.data instanceof Set && item.data.size > 1) {
                    const arr = [...item.data];
                    const maxImg = arr.reduce((max, img) => {
                        const s = img.stats;
                        const rate = s.likeCount + s.dislikeCount + s.cryCount + s.heartCount + s.laughCount;
                        if (rate > max.rate) {
                            max.rate = rate;
                            max.img = img;
                        }
                        return max;
                    }, { rate: -1, img: arr[0] }).img;

                    const newData = new Set([maxImg, ...arr.filter(img => img !== maxImg)]);
                    item.data = newData;
                    item.aspectRatio = maxImg.width / maxImg.height;
                }
            });

            return { items, hidden: hiddenImages - hiddenBefore };
        };

        const infinityScroll = this.#genInfinityScroll({
            layoutConfig, onPointerDown, loadItems, prepareItems,
            labels: {
                hiddenItems: window.languagePack?.text?.hiddenImages ?? 'Some images were hidden due to the selected filter settings ({count})',
                units: window.languagePack?.units?.image ?? ['image', 'images', 'images'],
            }
        });

        listWrap.appendChild(infinityScroll.element);

        this.#addVirtualScroll(infinityScroll.layout);

        fragment.appendChild(this.#genImagesListFilters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            infinityScroll.reload();
        }, {
            baseModels_images: !isSpecific,
            groupImagesByPost: !postId,
            period_images: !forcedPeriod
        }));

        if (infinityScroll.promise instanceof Promise) {
            const firstLoadingPlaceholder = insertElement('div', fragment, { id: 'load-more', style: 'position: absolute; width: 100%;' });
            firstLoadingPlaceholder.appendChild(Controller.genLoadingIndecator());
            infinityScroll.promise.finally(() => firstLoadingPlaceholder.remove());
        }

        fragment.appendChild(listWrap);

        return { element: fragment, promise: infinityScroll.promise };
    }

    static #filterImages(images, options = { blackListTagIds: null, results: false }) {
        if (!SETTINGS.blackListTagIds.length && !SETTINGS.hideFurry && !SETTINGS.hideExtreme && !SETTINGS.hideGay) return options.results ? images.map(it => ({ item: it, ok: true })) : images;
        let blackListTagIds = options.blackListTagIds;

        if (!blackListTagIds) {
            blackListTagIds = [...SETTINGS.blackListTagIds];
            if (SETTINGS.hideFurry) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideFurry);
            if (SETTINGS.hideExtreme) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideExtreme);
            if (SETTINGS.hideGay) blackListTagIds = blackListTagIds.concat(...CONFIG.filters.tagBlacklistPresets.hideGay);
            blackListTagIds = blackListTagIds.map(id => id.match(/[\+\-\|\&\?]/) ? id : `+${id}`);
        }

        const result = filterItems(images, [
            { key: 'tagIds', conditions: blackListTagIds, type: 'number' },
            SETTINGS.hideGay ? { key: 'tagIds', conditions: CONFIG.filters.tagBlacklistPresets.hideGay_nsfw, type: 'number', shouldApply: item => item.nsfwLevel >= 2 } : null,
            // { key: 'tags', conditions: SETTINGS.blackListTags.map(tag => tag.match(/[\+\-\|\&\?]/) ? tag : `+${tag}`) },
        ], { results: options.results });

        return result;
    }

    static #genStats(stats, hideEmpty = false) {
        const badges = createElement('div', { class: 'badges' });
        stats.forEach(({ icon, iconString, value = 0, unit }) => {
            if (hideEmpty && !value) return;
            const badge = document.createElement('div');
            badge.textContent = iconString ? `${iconString} ${value > 999 ? formatNumber(value) : value}` : value > 999 ? formatNumber(value) : value;
            let className = 'badge';
            if (!value) {
                badge.setAttribute('inert', '');
                className += ' badge-empty';
            }
            const lilpipeValue = value > 999 ? formatNumberIntl(value) : escapeHtml(value);
            if (unit) {
                const units = window.languagePack?.units?.[unit];
                badge.setAttribute('lilpipe-text', units ? `${lilpipeValue} ${escapeHtml(pluralize(value, units))}` : lilpipeValue);
            } else badge.setAttribute('lilpipe-text', lilpipeValue);
            if (icon) badge.prepend(getIcon(icon));
            else className += ' badge-textonly';
            badge.className = className;
            badges.appendChild(badge);
        });
        return badges;
    }

    static #genFakeVirtualScroll(id, container) {
        const readScroll = onScroll = e => e;
        const readResize = (e = {}) => {
            e.items = Array.from(container.children).map(element => ({ element, bounds: element.getBoundingClientRect() }));    
            return e;
        };
        const onResize = (e = {}) => {
            if (!e.items) readResize(e);
            e.items.forEach(item => {
                const { element, bounds } = item;
                element.style.width = `${bounds.width}px`;
                element.style.height = `${bounds.height}px`;
                element.style.containIntrinsicSize = `${bounds.width}px ${bounds.height}px`;
                element.classList.add('description-xl-item');
            });
        };
        const destroy = () => null;
        const getCallbacks = () => ({ readScroll, readResize, onScroll, onResize });


        onResize();
        container.classList.add('description-xl');

        return { id, destroy, getCallbacks };
    }

    static #analyzeModelDescriptionString(description) {
        // There should be rules here to improve formatting...
        // But... all creators have their own description format, and they don't really fit together,
        // I can't write for everyone, maybe I'll run the first hundred creators (their description format) through llm later
        const rules = [
            //
            { regex: '<br /></p>', replacement: '</p>'  },
            { regex: /<(?:p|code)>(@\w+{[\s\S]*?})<\/(?:p|code)>/gim, replacement: (_, block) => {
                const flat = block
                    .replace(/\s*\n\s*/g, ' ') // Remove \n
                    .trim();

                try {
                    return bibtexToHtml(flat);
                } catch (e) {
                    console.warn('BibTeX parsing error:', e);
                    return block; // Return original, if error
                }
            }},
            // Handle potential prompt blocks with poorly formatted text
            { regex: /<p>\s*(positive\s+)?prompts?:\s*([^<]+)<\/p>/gi, replacement: (_, __, promptText) => `<p>Positive Prompt</p><pre><code>${promptText.trim()}</code></pre>` },
            { regex: /<p>\s*negative\s+prompts?:\s*([^<]+)<\/p>/gi, replacement: (_, promptText) => `<p>Negative Prompt</p><pre><code>${promptText.trim()}</code></pre>` },
            // Sometimes descriptions contain homemade separators... along with the usual <hr>...
            { regex: /<p>\s*([\-=_*+])\1{2,}\s*<\/p>/gi, replacement: '<hr>' },
            { regex: /(?:^|\n)\s*([\-=_*+])\1{4,}\s*(?=\n|$)/g, replacement: '\n<hr>\n' },
        ];

        return rules.reduce((acc, { skip, regex, replacement }) => !skip ? acc.replace(regex, replacement) : acc, description);
    }

    static #analyzeModelDescription(description, cache) {
        const cacheDescriptionImages = cache?.descriptionImages ?? new Map();

        // Remove garbage (empty elements, duplicates and all unnecessary things)
        description.querySelectorAll('p, h3, hr + hr').forEach(el => {
            if (el.tagName === 'HR') {
                el.remove();
                return;
            }
            if (!el.children.length && !el.textContent.trim()) el.remove();
        });

        if (!description.children.length) {
            const text = description.textContent;
            description.textContent = '';
            if (text) insertElement('p', description, undefined, text);
            return;
        }

        // Remove extra nesting (paragraph in list item is extra)
        description.querySelectorAll('li>p:only-child').forEach(p => {
            p.replaceWith(...p.childNodes);
        });

        const headers = description.querySelectorAll('h1, h2, h3');

        // The entire header wrapped in <strong/u/em/b/i> makes no sense
        headers.forEach(header => {
            const hText = header.textContent.trim();
            header.querySelectorAll('strong, u, em, b, i').forEach(el => {
                if (el.textContent.trim() === hText) el.replaceWith(...el.childNodes);
            });
        });

        // Remove headings if most of the description consists of them
        // or Expand spam headings into a normal paragraph (contains line breaks or is too long)
        if (headers.length / description.children.length >= .65) {
            headers.forEach(header => {
                const p = document.createElement('p');
                p.append(...header.childNodes);
                header.replaceWith(p);
            });
        } else {
            headers.forEach(header => {
                const hasBr = header.querySelector('br');
                const isTooLong = header.textContent.length > 60;
                if (hasBr && isTooLong) {
                    const p = document.createElement('p');
                    p.append(...header.childNodes);
                    header.replaceWith(p);
                }
            });
        }

        // Remove bad styles (font family, font size)
        // Reduce unnecessary nesting and extra styles from empty (space-only) spans
        description.querySelectorAll('span').forEach(span => {
            if (!span.textContent.trim().length) {
                const rawText = span.textContent;
                let rootToDelete = span;

                while (
                    rootToDelete.parentElement && 
                    rootToDelete.parentElement !== description &&
                    rootToDelete.parentElement.childNodes.length === 1
                ) {
                    rootToDelete = rootToDelete.parentElement;
                }

                rootToDelete.replaceWith(document.createTextNode(rawText));
                return;
            }

            if (span.hasAttribute('style')) {
                const s = span.style;
                if (s.fontSize) s.removeProperty('font-size');
                if (s.fontFamily) s.removeProperty('font-family');
                if (s.fontWeight) s.removeProperty('font-weight');
            }
        });

        // Add loading lazy, decoding async and srcset
        const regexUrlWidth = /width=(\d+)/;
        description.querySelectorAll('img').forEach(img => {
            let src = img.getAttribute('src');
            img.removeAttribute('src');
            img.setAttribute('decoding', 'async');

            let url = toURL(src), srcset = null;

            if (url && url.origin === CONFIG.images_url && !src.includes('original=true')) {
                const urlWidth = Number(src.match(regexUrlWidth)?.[1] || 0);
                const baseWidth = this.#getNearestServerSize(Math.min(CONFIG.appearance.descriptionMaxWidth, urlWidth));
                const sizes = [1, 2, 3];
                const srcSetParts = [];

                sizes.forEach(ratio => {
                    const targetWidth = baseWidth * ratio;
                    let currentSrc;

                    if (targetWidth > 2200) currentSrc = src.replace(regexUrlWidth, 'original=true');
                    else currentSrc = src.replace(regexUrlWidth, `width=${this.#getNearestServerSize(targetWidth)}`);

                    srcSetParts.push(`${currentSrc} ${ratio}x`);
                });

                srcset = srcSetParts.join(', ');
                if (urlWidth !== baseWidth) src = src.replace(regexUrlWidth, `width=${baseWidth}`);
            }

            if (cacheDescriptionImages.has(src)) {
                const item = cacheDescriptionImages.get(src);
                img.style.aspectRatio = this.#round(item.ratio);
                img.style.height = `${item.height}px`;
                img.setAttribute('src', src);
                if (srcset) img.setAttribute('srcset', srcset);
            } else {
                const onload = e => {
                    img.removeEventListener('load', onload);
                    img.removeEventListener('error', onload);

                    // Error
                    if (e.type !== 'load' || !img.naturalHeight) {
                        img.classList.remove('loading');
                        img.classList.add('error');
                        return;
                    }

                    // Success
                    img.classList.remove('loading');
                    const xlItem = img.closest('.description-xl-item');
                    if (xlItem) {
                        xlItem.style.width = '';
                        xlItem.style.height = '';
                        xlItem.style.containIntrinsicSize = '';
                        xlItem.classList.remove('description-xl-item');
                    }
                    requestAnimationFrame(() => {
                        const bounds = img.getBoundingClientRect();
                        const item = {
                            naturalWidth: img.naturalWidth,
                            naturalHeight: img.naturalHeight,
                            ratio: img.naturalWidth / img.naturalHeight,
                            height: bounds.height
                        };
                        cacheDescriptionImages.set(src, item);

                        // Update size description-xl-item if exist
                        if (xlItem) {
                            const bounds = xlItem.getBoundingClientRect();
                            xlItem.style.width = `${bounds.width}px`;
                            xlItem.style.height = `${bounds.height}px`;
                            xlItem.style.containIntrinsicSize = `${bounds.width}px ${bounds.height}px`;
                            xlItem.classList.add('description-xl-item');
                        }
                    });
                };

                img.classList.add('loading');
                img.addEventListener('load', onload, { once: true });
                img.addEventListener('error', onload, { once: true });

                img.setAttribute('data-src', src);
                if (srcset) img.setAttribute('data-srcset', srcset);
                onTargetInViewport(img, () => {
                    const src = img.getAttribute('data-src');
                    const srcset = img.getAttribute('data-srcset');

                    img.setAttribute('src', src);
                    img.removeAttribute('data-src');
                    if (srcset) {
                        img.setAttribute('srcset', srcset);
                        img.removeAttribute('data-srcset');
                    }
                });
            }

        });

        const findFirstNonEmptyTextNode = root => {
            let node = root.firstChild;
            while (node) {
                if (node.nodeType === 3) { // Node.TEXT_NODE
                    if (node.textContent?.trim()) return node;
                } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
                    const nested = findFirstNonEmptyTextNode(node);
                    if (nested) return nested;
                }
                node = node.nextSibling;
            }
            return null;
        };
        const regexNotSpace = /\S/;
        const linkPreviewOriginal = getIcon('civitai');
        linkPreviewOriginal.classList.add('link-preview-position');
        const setLinkPreview = a => {
            a.classList.add('link-hover-preview', 'link-with-favicon');
            a.setAttribute('data-link-preview', '');

            const icon = linkPreviewOriginal.cloneNode(true);

            // If possible, insert the icon and the first word into a container so that the icon is never separated from the first word
            const firstTextNode = findFirstNonEmptyTextNode(a);
            if (!firstTextNode) {
                a.prepend(icon);
                return;
            }

            const text = firstTextNode.textContent;
            const firstCharIndex = text.search(regexNotSpace);

            if (firstCharIndex === -1) {
                a.prepend(icon);
                return;
            }

            const firstChar = text[firstCharIndex];
            const wrapper = createElement('span', { class: 'icon-text-wrapper' }, firstChar);
            wrapper.prepend(icon);

            const parent = firstTextNode.parentNode;
            if (firstCharIndex === 0) {
                firstTextNode.textContent = text.slice(1);
                parent.insertBefore(wrapper, firstTextNode);
            } else {
                const remainingTextNode = firstTextNode.splitText(firstCharIndex);
                remainingTextNode.textContent = remainingTextNode.textContent.slice(1);
                parent.insertBefore(wrapper, remainingTextNode);
            }
        };
        const moveNodeOutside = (a, node, isStart) => {
            if (isStart) a.parentNode.insertBefore(node, a);
            else a.parentNode.insertBefore(node, a.nextSibling);
        };
        const cleanLinkEdge = (a, isStart) => {
            while (true) {
                let target = isStart ? a.firstChild : a.lastChild;
                if (!target) break;

                // <br>>
                if (target.nodeName === 'BR') {
                    moveNodeOutside(a, target, isStart);
                    continue;
                }

                // text
                if (target.nodeType === 3) { // Node.TEXT_NODE
                    const text = target.textContent;
                    const trimmed = isStart ? text.trimStart() : text.trimEnd();

                    if (trimmed.length === 0) {
                        moveNodeOutside(a, target, isStart);
                        continue;
                    } else if (trimmed.length !== text.length) {
                        const spaceLen = text.length - trimmed.length;
                        const spaceContent = isStart ? text.slice(0, spaceLen) : text.slice(-spaceLen);

                        target.textContent = trimmed;
                        moveNodeOutside(a, document.createTextNode(spaceContent), isStart);
                        continue;
                    }
                }

                // deep check
                if (target.nodeType === 1) { // Node.ELEMENT_NODE
                    const subTarget = isStart ? target.firstChild : target.lastChild;
                    if (subTarget) {
                        if (subTarget.nodeName === 'BR' || (subTarget.nodeType === 3 && !subTarget.textContent?.trim())) { // Node.TEXT_NODE
                            a.insertBefore(subTarget, isStart ? target : target.nextSibling);
                            continue;
                        }
                    }
                }

                break;
            }
        };
        const fixLinkSpacing = a => {
            if (!a.parentNode) return;
            cleanLinkEdge(a, true);  // clean start
            cleanLinkEdge(a, false); // clean end
        };

        // Add _blank and noopener to all links
        description.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            const rel = (a.getAttribute('rel') || '').split(' ');
            if (!rel.includes('noopener')) rel.push('noopener');
            a.setAttribute('rel', rel.join(' ').trim());
            a.setAttribute('target', '_blank');
            fixLinkSpacing(a);
            
            // Add link preview and check url syntax
            const url = href.startsWith('/') ? toURL(href, CONFIG.civitai_url) : toURL(href);
            if (!url) {
                a.classList.add('link-broken');
                if (a.textContent) a.textContent = a.textContent; // Remove formatting inside (there may be span with text color)
                return;
            }

            if (url.origin === CONFIG.civitai_url) {
                if (href.startsWith('/')) a.setAttribute('href', url.toString());
                const { params } = this.parseCivUrl(url);
                if (params.imageId || params.postId || params.modelId || (EXTENSION_INSTALLED && (params.articleId || params.collectionId))) setLinkPreview(a);
                else {
                    // a.prepend(getIcon('civitai'));
                    // a.classList.add('link-with-favicon');
                }
            } else if (url.protocol !== 'https:') {
                a.classList.add('link-warning');
                if (a.textContent) a.textContent = a.textContent; // Remove formatting inside (there may be span with text color)
            }
        });

        // Remove underscores that are too large (they don't make sense if they're on multiple lines)
        description.querySelectorAll('u').forEach(u => {
            if (u.textContent.length >= 40) u.replaceWith(...u.childNodes);
        });

        // Try to fix the incorrect formatting of the code block
        // Disabled: Sometimes some of these "blocks" are just <span> with a background... and such blocks will be skipped, which looks weirder than the bad formatting
        // description.querySelectorAll('p > code:only-child').forEach(code => {
        //     const p = code.parentElement;
        //     const pre = createElement('pre');
        //     pre.appendChild(code);
        //     p.replaceWith(pre);
        // });

        // Prompts

        const promptTitles = [
            {
                exact: [ 'positive prompt', 'positive:' ],
                startsWith: [ '+prompt', '+ prompt', 'positive prompt' ],
                endsWith: [ 'positive prompt' ],
                type: 'positive'
            },
            {
                exact: [ 'negative prompt', 'negative:', 'nprompt:', 'n prompt:' ],
                startsWith: [ '-prompt', '- prompt', 'negative prompt' ],
                endsWith: [ 'negative prompt' ],
                type: 'negative'
            }
        ];

        // If something that matches exactly isn't followed by <pre>, it's probably just bad formatting
        // Disabled: Sometimes there are multiple items below, so changing just one looks weird
        // description.querySelectorAll('p').forEach(p => {
        //     if (!p.nextSibling || p.nextSibling?.tagName !== 'P') return;
        //     const text = p.textContent.trim().toLowerCase();

        //     const type = promptTitles.find(r => r.exact.includes(text))?.type;
        //     if (!type) return;

        //     const pre = createElement('pre');
        //     insertElement('code', pre, { class: `prompt prompt-${type}` }, p.nextSibling.textContent);
        //     p.nextSibling.replaceWith(pre);
        // });

        description.querySelectorAll('pre').forEach(pre => {
            let headerCandidate = pre.previousElementSibling;
            
            while (headerCandidate && headerCandidate.tagName.toLowerCase() === 'pre') {
                headerCandidate = headerCandidate.previousElementSibling;
            }

            if (!headerCandidate) return;

            const text = headerCandidate.textContent.trim().toLowerCase();
            const code = pre.querySelector('code');
            if (!code) return;

            const type = promptTitles.find(r => r.exact.includes(text) || r.startsWith.some(t => text.startsWith(t)) || r.endsWith.some(t => text.endsWith(t)))?.type;
            if (type) code.classList.add('prompt', `prompt-${type}`);
        });

        // If a block of code has a lot of commas, it's probably a prompt block
        description.querySelectorAll('code:not(.prompt)').forEach(code => {
            const text = code.textContent;
            const count = calcCharsInString(text, ',', 4);

            if (count > 3) code.classList.add('prompt');
            else if (text.indexOf('\n') !== -1) {
                code.classList.add('code-block');
                return;
            }
        });

        if (!SETTINGS.disablePromptFormatting) description.querySelectorAll('code.prompt').forEach(this.#analyzePromptCode);

        description.normalize();
    }

    static #analyzePromptCode(codeElement) {
        if (!codeElement) return;

        const fragment = new DocumentFragment();
        const keywords = new Set([ 'BREAK' ]);
        const tokenSpecs = [
            { type: 'lora',     regex: /<lora:[^:>]+:[^>]+>/y },
            { type: 'link',     regex: /https:\/\/civitai\.com\/[^\s]+/y },
            { type: 'escaped',  regex: /\\[\\():]/y },
            { type: 'weight',   regex: /:-?[0-9.]+/y },
            { type: 'bracket',  regex: /[()]/y },
            { type: 'punct',    regex: /[,]/y },
            { type: 'space',    regex: /\s+/y },
            { type: 'word',     regex: /[\w\-]+/y },
            { type: 'other',    regex: /[^\s\w]/y },
        ];

        const text = codeElement.textContent
            .replace(/(,)(?!\s)/g, '$1 ') // Some prompts are hard to read due to missing spaces after commas
            .replace(/\s+/g, ' ') // Collapse bloated spaces
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse bloated line breaks
            .trim();
        const tokens = [];
        let pos = 0;

        // Tokenize
        while (pos < text.length) {
            let matched = false;
            for (const { type, regex } of tokenSpecs) {
                regex.lastIndex = pos;
                const match = regex.exec(text);
                if (match) {
                    tokens.push({ type, value: match[0] });
                    pos = regex.lastIndex;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // fallback: consume one char
                tokens.push({ type: 'unknown', value: text[pos++] });
            }
        }

        let bracketContainers = [];
        let weightContainer = fragment;
        let nextLegitCLoseBracket = null;
        let lastTextNode = null;
        const pushText = text => {
            if (lastTextNode) lastTextNode.textContent += text;
            else {
                lastTextNode = document.createTextNode(text);
                weightContainer.appendChild(lastTextNode);
            }
        };
        // 1000000 - 10**6 - precision 6
        const round = v => Math.round(v * 1000000) / 1000000;
        const updateCurrentWeight = (weightChange, bracketItem) => {
            bracketItem.sum = round(bracketItem.sum * weightChange);
            bracketItem.strength *= weightChange;
            bracketItem.container.setAttribute('style', `--weight: ${bracketItem.sum}; --weight-strength: ${Math.round(Math.min(1, Math.sqrt(Math.abs(bracketItem.sum - 1))) * 100)}%;`);
            bracketItem.container.setAttribute('data-weight-direction', bracketItem.sum >= 1 ? 'up' : 'down');
            if (Math.abs(bracketItem.sum - 1) >= 1) bracketItem.container.setAttribute('data-weight-level', 'high');
            else bracketItem.container.removeAttribute('data-weight-level');
            bracketItem.container.setAttribute('data-weight', bracketItem.sum);
            bracketItem.containersInside.forEach(containerInfo => updateCurrentWeight(weightChange, containerInfo));
        };
        const openWeight = (bracket, tokenIndex) => {
            const currentBracket = bracketContainers.at(-1);
            const strength = bracket === '(' ? 1.1 : 1;
            const closeBracket = bracket === '(' ? ')' : null;
            const sum = round((currentBracket?.sum ?? 1) * strength);
            const container = insertElement('span', weightContainer, {
                class: 'weight-container',
                style: `--weight: ${sum}; --weight-strength: ${Math.round(Math.min(1, Math.sqrt(Math.abs(sum - 1))) * 100)}%;`,
                'data-weight': sum,
                'data-weight-direction': sum >= 1 ? 'up' : 'down'
            });
            if (Math.abs(sum - 1) >= 1) container.setAttribute('data-weight-level', 'high');
            const bracketItem = { container, sum, strength, closeBracket, containersInside: [] };
            currentBracket?.containersInside.push(bracketItem);
            bracketContainers.push(bracketItem);
            weightContainer = container;
            nextLegitCLoseBracket = closeBracket;
        };
        const closeWeight = (bracket, tokenIndex) => {
            const currentBracket = bracketContainers.at(-1);
            if (currentBracket?.closeBracket !== bracket) return;
            if (tokens[tokenIndex - 1]?.type === 'weight') {
                const explicitWeight = Number(tokens[tokenIndex - 1].value.substring(1));
                const weightChange = explicitWeight / currentBracket.strength;
                updateCurrentWeight(weightChange, currentBracket);
            };
            bracketContainers.pop();
            const nextBracket = bracketContainers.at(-1);
            weightContainer = nextBracket?.container ?? fragment;
            nextLegitCLoseBracket = nextBracket?.closeBracket ?? null;
        };
        const clearWeight = () => {
            bracketContainers = [];
            weightContainer = fragment;
            nextLegitCLoseBracket = null;
        };

        // Highlight
        for (let i = 0; i < tokens.length; i++) {
            const { type, value } = tokens[i];

            if (type === 'lora') {
                insertElement('span', weightContainer, { class: 'lora' }, value);
                // const span = insertElement('span', weightContainer, { class: 'lora' }, '<lora:');
                // const indexEnd = value.lastIndexOf(':');
                // insertElement('span', span, { class: 'lora-name' }, value.substring('<lora:'.length, indexEnd));
                // span.appendChild(document.createTextNode(':'));
                // insertElement('span', span, { class: 'lora-weight' }, value.substring(indexEnd + 1, value.length - 1));
                // span.appendChild(document.createTextNode('>'));
            } else if (type === 'link') {
                if (isURL(value)) {
                    const a = insertElement('a', weightContainer, { class: 'link', href: value, target: '_blank', rel: 'noopener' }, value);
                    const { params } = this.parseCivUrl(value);
                    if (params.imageId || params.postId || params.modelId || (EXTENSION_INSTALLED && (params.articleId || params.collectionId))) a.setAttribute('data-link-preview', '');
                }
                else insertElement('span', weightContainer, { class: 'link' }, value);
            } else if (type === 'bracket') {
                if (value === '(') {
                    openWeight(value, i);
                    insertElement('span', weightContainer, { class: 'bracket' }, value);
                } else if (value === ')') {
                    if (value === nextLegitCLoseBracket) {
                        insertElement('span', weightContainer, { class: 'bracket' }, value);
                        closeWeight(value, i);
                    } else {
                        pushText(value);
                        continue;
                    }
                } else {
                    pushText(value);
                    continue;
                }
            } else if (type === 'weight' && tokens[i + 1]?.value === nextLegitCLoseBracket) {
                insertElement('span', weightContainer, { class: 'weight' }, value);
            } else if (type === 'word' && keywords.has(value)) {
                if (value === 'BREAK') clearWeight();
                insertElement('span', weightContainer, { class: 'keyword', 'data-keyword': value }, value);
            } else {
                pushText(value);
                continue;
            }

            lastTextNode = null;
        }

        // Apply
        codeElement.textContent = '';
        codeElement.appendChild(fragment);
    }

    static #analyzeTextColors(element, bgRGB) {
        // APCA correction part generated by ChatGPT-5.2
        const TARGET_LC = 75;
        const TARGET_LC_MIN = 50;
        const TARGET_LC_Headers = {
            H1: 60,
            H2: 65,
            H3: 70
        };
        const TARGET_LC_Modificators = [
            {
                selector: 'strong, b',
                tagNames: [ 'STRONG', 'B' ],
                modificator: -5
            },
            {
                selector: 'em, i',
                tagNames: [ 'EM', 'I' ],
                modificator: +10
            }
        ];
        const COLOR_LC_PENALTY = 12;
        const MIN_CHROMA_RATIO = 0.65;
        const MAX_ITER = 14;

        /* ---------- APCA ---------- */

        function lin(c) {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }

        function getY(rgb) {
            return (lin(rgb.r) * 0.2126729 + lin(rgb.g) * 0.7151522 + lin(rgb.b) * 0.0721750);
        }

        function apca(text, bg) {
            const Ytxt = getY(text);
            const Ybg  = getY(bg);

            if (Math.abs(Ytxt - Ybg) < 0.005) return 0;

            let Lc;
            if (Ybg > Ytxt) {
                Lc = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14 - 0.027;
            } else {
                Lc = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * 1.14 + 0.027;
            }

            return Lc * 100;
        }

        /* ---------- Utilities ---------- */

        function clamp01(v) {
            return Math.min(1, Math.max(0, v));
        }

        function rgbValid(rgb) {
            return (rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255);
        }

        /* ---------- High-quality correction ---------- */

        function correctColor(textRGB, bgRGB, targetLC = TARGET_LC) {
            const startLc = apca(textRGB, bgRGB);
            if (Math.abs(startLc) >= targetLC) return null;

            const baseLch = Color.convert(textRGB, 'oklch');
            const isColorText = baseLch.c > 0.08;

            const targetLc = (startLc <= 0 ? -1 : 1) *
                (isColorText ? targetLC - COLOR_LC_PENALTY : targetLC);

            const polarity = Math.sign(targetLc);
            const bgY = getY(bgRGB);

            let lowY, highY;
            if (polarity > 0) {
                lowY = 0;
                highY = bgY - 0.0005;
            } else {
                lowY = bgY + 0.0005;
                highY = 1;
            }

            let best = null;
            let bestErr = Infinity;

            const minChroma = baseLch.c * MIN_CHROMA_RATIO;

            for (let i = 0; i < MAX_ITER; i++) {
                const midY = (lowY + highY) / 2;

                let l = clamp01(midY ** (1 / 2.2));
                let lch = { ...baseLch, l };
                let rgb = Color.convert(lch, 'rgba');

                if (!rgbValid(rgb)) {
                    let cLow = minChroma;
                    let cHigh = lch.c;

                    for (let j = 0; j < 6; j++) {
                        const cMid = (cLow + cHigh) / 2;
                        lch.c = cMid;
                        rgb = Color.convert(lch, 'rgba');

                        if (rgbValid(rgb)) cLow = cMid;
                        else cHigh = cMid;
                    }

                    lch.c = cLow;
                    rgb = Color.convert(lch, 'rgba');
                }

                const lc = apca(rgb, bgRGB);
                const err = Math.abs(lc - targetLc);

                if (err < bestErr) {
                    bestErr = err;
                    best = rgb;
                }

                if (lc * polarity > targetLc * polarity) {
                    highY = midY;
                } else {
                    lowY = midY;
                }
            }

            return best;
        }

        function correctBackground(bgRGB, textRGB, targetLC, steps = 3) {
            const baseLch = Color.convert(bgRGB, 'oklch');
            const polarity = Math.sign(apca(textRGB, bgRGB));
            if (!polarity) return null;

            let best = bgRGB;
            let bestLc = Math.abs(apca(textRGB, bgRGB));

            let low = 0, high = 1;

            for (let i = 0; i < steps; i++) {
                const mid = (low + high) / 2;

                const l = clamp01(
                    polarity > 0
                        ? baseLch.l + mid * (1 - baseLch.l)
                        : baseLch.l - mid * baseLch.l
                );

                const lch = { ...baseLch, l, c: baseLch.c * 0.9 };

                const rgb = Color.convert(lch, 'rgba');
                if (!rgbValid(rgb)) {
                    high = mid;
                    continue;
                }

                const lc = Math.abs(apca(textRGB, rgb));

                if (lc > bestLc) {
                    bestLc = lc;
                    best = rgb;
                }

                if (lc >= targetLC) return rgb;

                low = mid;
            }

            return bestLc > Math.abs(apca(textRGB, bgRGB)) ? best : null;
        }


        /* ---------- DOM ---------- */

        const cache = new Map();
        const blend = (fg, bg, alpha) => {
            return {
                r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
                g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
                b: Math.round(fg.b * alpha + bg.b * (1 - alpha))
            };
        };

        element.querySelectorAll('span[style*="color:"]').forEach(span => {
            const color = span.style.color;
            const bgColor = span.style.backgroundColor || '';
            const header = span.closest('h1, h2, h3');
            let targetLС = header ? TARGET_LC_Headers[header.tagName] : TARGET_LC;
            TARGET_LC_Modificators.forEach(m => {
                const tagName = span.children[0]?.tagName;
                if (!span.closest(m.selector) && !m.tagNames.includes(tagName)) return;
                if (m.modificator < 0 && header) targetLС += Math.floor(m.modificator / 2);
                else targetLС += m.modificator;
            });
            targetLС = Math.max(targetLС, TARGET_LC_MIN);
            const colorKey = `fg${color}-bg${bgColor}-lc${targetLС}`;

            if (cache.has(colorKey)) {
                const cached = cache.get(colorKey);
                if (cached?.fg) span.style.color = cached.fg;
                if (cached?.bg) span.style.backgroundColor = cached.bg;
                return;
            }

            const rgb = Color.convert(color, 'rgba', true);
            if (!rgb) return;

            let finalBg = bgRGB;
            if (bgColor) {
                finalBg = Color.convert(bgColor, 'rgba', true);
                if (finalBg && finalBg.a !== 0) {
                    if (finalBg.a < 1) {
                        finalBg = blend(finalBg, bgRGB, finalBg.a);
                    }
                } else finalBg = bgRGB;
            }

            const corrected = correctColor(rgb, finalBg, targetLС);
            if (!corrected) {
                cache.set(colorKey, null);
                return;
            }

            let correctedBg = null;
            if (bgColor && Math.abs(apca(corrected, finalBg)) < TARGET_LC_MIN) {
                correctedBg = correctBackground(finalBg, corrected, targetLС);
            }

            const css = `rgb(${corrected.r}, ${corrected.g}, ${corrected.b})`;
            const bgCss = correctedBg ? `rgb(${correctedBg.r}, ${correctedBg.g}, ${correctedBg.b})` : null;
            cache.set(colorKey, { fg: css, bg: bgCss });
            span.style.color = css;
            if (bgCss) span.style.backgroundColor = bgCss;
        });
    }

    static #genImageGenerationMeta(meta) {
        const container = createElement('div', { class: 'generation-info' });

        // Remix of
        if (meta?.extra?.remixOfId) {
            const remixContainer = insertElement('a', container, { class: 'meta-remixOfId badge' });

            const inertRemixImage = media => {
                this.#log('Remix of', media);

                if (!media) {
                    // remixContainer.remove();
                    remixContainer.textContent = 'failed to load';
                    return;
                }

                remixContainer.classList.remove('meta-loading');
                remixContainer.setAttribute('href', `#images?image=${media.id}&nsfw=${media.nsfwLevel}`);
                const mediaElement = this.#genMediaElement({ media: media, height: 128, target: 'model-card' });
                remixContainer.appendChild(mediaElement);

                const infoContainer = insertElement('div', remixContainer, { class: 'meta-remixOfId-info' });

                const titleContainer = insertElement('span', infoContainer);
                insertElement('i', titleContainer, undefined, 'Remix of ');

                // Creator
                titleContainer.appendChild(this.#genUserBlock({ userId: media.userId, username: media.username }));

                // Stats
                const stats = media.stats;
                const statsList = [
                    { iconString: '👍', value: stats.likeCount, unit: 'like' },
                    { iconString: '👎', value: stats.dislikeCount, unit: 'dislike' },
                    { iconString: '😭', value: stats.cryCount, unit: 'cry' },
                    { iconString: '❤️', value: stats.heartCount, unit: 'heart' },
                    { iconString: '🤣', value: stats.laughCount, unit: 'laugh' },
                    { iconString: '💬', value: stats.commentCount, unit: 'comment' },
                ];

                const statsFragment = this.#genStats(statsList, true);

                // NSFW LEvel
                if (media.nsfwLevel !== 'None') {
                    const nsfwBadge = createElement('div', { class: 'image-nsfw-level badge separated-right', 'data-nsfw-level': media.nsfwLevel }, media.nsfwLevel);
                    statsFragment.prepend(nsfwBadge);
                }

                infoContainer.appendChild(statsFragment);
            };
            const loadRemixImage = () => {
                const cachedMedia = this.#cache.images.get(`${meta?.extra?.remixOfId}`);
                if (cachedMedia) {
                    inertRemixImage(cachedMedia);
                    return;
                }

                remixContainer.classList.add('meta-loading');
                this.api.fetchImageMeta(meta?.extra?.remixOfId)
                .then(media => {
                    this.#cache.images.set(`${media.id}`, media);
                    inertRemixImage(media);
                }).catch(() => {
                    const remixError = createElement('span', { class: 'meta-remixOfId error-text', style: 'height: 2em; opacity: .7;' }, ' Remix of non-existent image');
                    remixError.prepend(getIcon('cross'));
                    remixContainer.replaceWith(remixError);
                });
            };

            if (!SETTINGS.disableRemixAutoload) loadRemixImage();
            else {
                const button = insertElement('button', remixContainer);
                button.appendChild(getIcon('file_search'));
                insertElement('span', button, undefined, 'Load Remix info');
                button.addEventListener('click', () => {
                    button.remove();
                    loadRemixImage();
                }, { once: true });
            }
        }

        // params
        if (meta.prompt) {
            const code = insertElement('code', container, { class: 'prompt prompt-positive' }, meta.prompt);
            if (!SETTINGS.disablePromptFormatting) this.#analyzePromptCode(code);
        }
        if (meta.negativePrompt) {
            const code = insertElement('code', container, { class: 'prompt prompt-negative' }, meta.negativePrompt);
            if (!SETTINGS.disablePromptFormatting) this.#analyzePromptCode(code);
        }

        const otherMetaContainer = insertElement('div', container, { class: 'meta-other' });
        const insertOtherMeta = (key, value) => {
            const item = insertElement('code', otherMetaContainer, { class: 'meta-other-item' }, key ? value !== undefined ? `${key}: ` : key : '');
            if (value === undefined) return item;

            insertElement('span', item, { class: 'meta-value' }, value);
            return item;
        };

        const META_RULES = [
            { keys: ['Size'], label: 'Size' },
            { keys: ['seed'], label: 'Seed' },
            { keys: ['steps'], label: 'Steps' },
            { keys: ['cfgScale'], label: 'CFG', format: v => this.#round(+v) },
            { keys: ['sampler'], label: 'Sampler' },
            { keys: ['Schedule type', 'scheduler'], label: 'Scheduler' },
            { keys: ['Shift'], label: 'Shift' },
            { keys: ['clipSkip'], label: 'Clip Skip' },
            { keys: ['RNG'], label: 'RNG' },
            { keys: ['Denoising strength', 'denoise'], label: 'Denoising', format: v => this.#round(+v) },
            // Does this make sense?
            // { 
            //     match: key => key.startsWith('Module '), 
            //     label: key => key,
            //     group: 'modules'
            // },
            // { 
            //     match: key => key.startsWith('Beta schedule'), 
            //     label: key => key.replace('Beta schedule ', 'β '), 
            //     group: 'scheduler_details'
            // }
        ];

        const renderItem = (label, value, originalValue) => {
            const item = insertOtherMeta(label, value);
            if (originalValue && String(value) !== String(originalValue)) item.setAttribute('lilpipe-text', originalValue);
            return item;
        };

        const usedKeys = new Set();
        META_RULES.forEach(rule => {
            let targetKey = rule.keys ? rule.keys.find(k => meta[k] !== undefined) : null;

            if (targetKey) {
                const val = meta[targetKey];
                const label = rule.label;
                const formatted = rule.format ? rule.format(val) : val;
                renderItem(label, formatted, val);
                usedKeys.add(targetKey);
            } else if (rule.match) {
                Object.keys(meta).forEach(key => {
                    if (rule.match(key) && !usedKeys.has(key)) {
                        const label = typeof rule.label === 'function' ? rule.label(key) : rule.label;
                        renderItem(label, meta[key]);
                        usedKeys.add(key);
                    }
                });
            }
        });

        const renderSpecialBlock = (prefix, label) => {
            const mainKey = Object.keys(meta).find(k => k.indexOf(prefix) === 0 && (k.includes('model') || k.includes('upscaler')));
            if (!mainKey) return;

            const groups = {};
            const relatedKeys = Object.keys(meta).filter(k => k.startsWith(prefix));

            relatedKeys.forEach(k => {
                const cleanK = k.replace(prefix, '').trim();
                // Look for the passage indication: "2nd", "3rd", "4th", etc. at the end or middle of the key
                const passMatch = cleanK.match(/(\d+(st|nd|rd|th))/i);
                const passName = passMatch ? passMatch[0].toLowerCase() : 'main';

                if (!groups[passName]) groups[passName] = { items: [] };

                const finalKey = cleanK.replace(passMatch ? passMatch[0] : '', '').trim() || 'model';
                groups[passName].items.push({ key: finalKey, value: meta[k] });

                if (finalKey === 'model' || finalKey === 'upscaler') groups[passName].mainKey = k;
                if (finalKey === 'upscale') groups[passName].scaleKey = k;
            });

            Object.entries(groups).forEach(([pass, group]) => {
                const items = group.items;
                if (items.length === 0) return '';

                const rows = items.map(item => {
                    let valueString = typeof item.value === 'object' ? JSON.stringify(item.value, null, '  ')  : String(item.value);
                    const valueType = typeof item.value === 'object' ? 'json' : 'string';
                    const valueKey = escapeHtml(item.key);
                    return `<tr><td class="key-${valueKey}">${valueKey}</td><td class="value-${valueType}">${escapeHtml(valueString)}</td></tr>`;
                }).join('');

                const tooltipHtml = `<thead class="tooltip-pass-header"><tr><th colspan="2">${pass} Pass</th></tr></thead><tbody>${rows}</tbody>`;

                const item = renderItem(pass !== 'main' ? `${label} (${pass})` : label, meta[group.mainKey] || 'unknown');

                if (group.scaleKey) insertElement('i', item, undefined, ` x${meta[group.scaleKey]}`);

                if (tooltipHtml) {
                    item.setAttribute('lilpipe-text', `<table class='tooltip-table-only'>${tooltipHtml}</table>`);
                    item.setAttribute('lilpipe-type', 'table-grouped');
                }
            });

            relatedKeys.forEach(k => usedKeys.add(k));
        };

        renderSpecialBlock('Hires', 'Hires');
        renderSpecialBlock('ADetailer', 'ADetailer');

        if (meta.comfy) {
            const item = insertOtherMeta('ComfyUI');
            item.classList.add('badge');
            item.setAttribute('data-badge', 'ComfyUI');
            const icon = getIcon('roadmap');
            item.prepend(icon);
        }

        // Resources
        const { resources } = this.#parseMeta(meta);
        if (resources.length) {
            const resourcesContainer = insertElement('div', container, { class: 'meta-resources meta-resources-loading' });
            const resourcesTitle = insertElement('h3', resourcesContainer);
            resourcesTitle.appendChild(getIcon('database'));
            insertElement('span', resourcesTitle, undefined, window.languagePack?.text?.resurces_used ?? 'Resources used');

            if (resources.length > 4 && !this.#state.long_description_resources_img) {
                resourcesContainer.classList.add('hide-long-description');
                const showMore = createElement('button', { class: 'show-more' });
                showMore.appendChild(getIcon('arrow_down'));
                resourcesContainer.appendChild(showMore);
                showMore.addEventListener('click', () => {
                    resourcesContainer.classList.remove('hide-long-description');
                    showMore.remove();
                    this.#state.long_description_resources_img = true;
                }, { once: true });
            }

            const resourcePromises = [];
            const createResourceRowContent = info => {
                const { title, version, href, weight = 1, type, baseModel } = info;

                const el = createElement(href ? 'a' : 'div', { class: 'meta-resource' });
                if (href) el.href = href;
                const titleElement = insertElement('span', el, { class: 'meta-resource-name link-preview-position' });
                insertElement('span', titleElement, { class: 'model-name' }, title);
                titleElement.appendChild(document.createTextNode(' '));
                if(version) insertElement('strong', titleElement, { class: 'model-version-name' }, version);
                if (type?.toLowerCase() === 'lora' && href) { // Checking href to avoid displaying weight on errors
                    const weightRounded = this.#round(weight);
                    const span = insertElement('span', titleElement, { class: 'meta-resource-weight', 'data-weight': weight === 0 ? '=0' : weight > 0 ? '>0' : '<0' }, weightRounded);
                    if (weightRounded !== weight) span.setAttribute('lilpipe-text', escapeHtml(weight));
                }
                insertElement('span', el, { class: 'meta-resource-type', 'lilpipe-text': escapeHtml(baseModel) }, type);
                return el;
            };
            const replaceResourceRow = (info, item, el) => {
                const modelKey = String(item.modelVersionId || item.hash || '').toUpperCase();
                if (!info) {
                    el.classList.add('no-model');
                    el.prepend(getIcon('cross'));
                    // This is to avoid trying to constantly send requests to the 404 model
                    this.#cache.modelVersions.set(modelKey, null);
                    return info;
                }
                if (info.id && loadedResources.has(info.id)) {
                    el.remove();
                    return info;
                }
                loadedResources.add(info.id);
                const newEl = createResourceRowContent({
                    title: info.model?.name,
                    version: info.name,
                    baseModel: info.baseModel,
                    type: info.model?.type,
                    weight: item.weight,
                    href: info.modelId && info.name ? `#models?model=${info.modelId}&version=${info.name}` : undefined
                });
                newEl.setAttribute('data-link-preview', '');
                el.replaceWith(newEl);
                if (modelKey) this.#cache.modelVersions.set(modelKey, info);
                return info;
            };
            const processResources = items => {
                items = items.filter(Boolean);
                const trainedWords = new Set();
                const triggerResources = {};
                this.#log('Loaded resources', items);

                items.forEach(item => {
                    const type = item?.model?.type;
                    if (!type || (type !== 'LORA' && type !== 'TextualInversion') || !item?.trainedWords?.length || !item.model.name) return;

                    item.trainedWords.forEach(word => {
                        word = word.indexOf(',') === -1 ? word.trim() : word.replace(/(,)(?!\s)/g, '$1 ').trim(); // This is necessary because the prompt block is formatted in a similar way
                        const splitWords = word.split(',').map(w => w.trim()).filter(Boolean);

                        splitWords.forEach(w => {
                            w = w.toLowerCase();
                            trainedWords.add(w);
                            if (!triggerResources[w]) triggerResources[w] = new Set();
                            triggerResources[w].add(item);
                        });
                    });
                });

                if (!trainedWords.size || SETTINGS.disablePromptFormatting) return;

                const codeBlocks = container.querySelectorAll('code.prompt-positive, code.prompt-negative');

                const sortedWords = Array.from(trainedWords).sort((a, b) => b.length - a.length);

                const addTextNodesFromElement = (el, out) => {
                    Array.from(el.childNodes).forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            out.push({ node, parent: el });
                            return;
                        }
                        if (node.classList.contains('weight-container')) addTextNodesFromElement(node, out);
                    });
                };

                const resourceToTooltip = item => `<span class="meta-resource-name"><span class="model-name">${escapeHtml(item.model.name)}</span> <strong class="model-version-name">${escapeHtml(item.name)}</strong></span>`;

                codeBlocks.forEach(code => {
                    const children = [];
                    addTextNodesFromElement(code, children);

                    children.forEach(({ node, parent }) => {
                        const text = node.textContent;
                        if (!text) return;

                        let i = 0;
                        const matches = [];
                        text.split(/(?<!\\)([,\(\)]|\bBREAK\b)/).forEach(tag => {
                            let key = tag.trim();
                            if (key.includes(':')) {
                                const parts = key.split(':');
                                const last = parts.at(-1);
                                if (!isNaN(last) && last.trim() !== '') {
                                    parts.pop();
                                    key = parts.join(':');
                                }
                            }
                            if (sortedWords.includes(key.toLowerCase())) matches.push({ key, index: i + tag.search(/\S|$/) });
                            i += tag.length;
                        });

                        if (matches.length === 0) return;

                        matches.sort((a, b) => a.index - b.index);
                        const fragment = new DocumentFragment();
                        let lastIndex = 0;

                        matches.forEach(({ key, index }) => {
                            if (index > lastIndex) {
                                fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
                            }

                            const span = insertElement('span', fragment, { class: 'trigger' }, key);

                            const models = triggerResources[key.toLowerCase()];
                            if (models && models.size) {
                                const tooltip = models.size > 1 ? `<ul>${Array.from(models).map(m => `<li>${resourceToTooltip(m)}</li>`).join('')}</ul>` : resourceToTooltip(models.values().next().value);
                                span.setAttribute('lilpipe-text', tooltip);
                                span.setAttribute('lilpipe-type', 'trigger-word-model');
                            }

                            lastIndex = index + key.length;
                        });

                        if (lastIndex < text.length) {
                            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                        }

                        node.replaceWith(fragment);
                    });
                });
            };

            const loadedResources = new Set();
            const resourcesFromCache = [];
            const loraWeights = meta['Lora weights'] ?? {}; // Fooocus thingy
            resources.forEach(item => {
                const modelKey = String(item.modelVersionId || item.hash || '').toUpperCase();
                let modelInfo = undefined;
                if (modelKey && this.#cache.modelVersions.has(modelKey)) {
                    modelInfo = this.#cache.modelVersions.get(modelKey);
                }

                if (item.weight === undefined && loraWeights[item.name] !== undefined) item.weight = Number(loraWeights[item.name]);

                const el = createResourceRowContent({
                    title: modelInfo?.model?.name || item.name || (item.modelVersionId ? `VersionId: ${item.modelVersionId}` : undefined) || (item.hash ? `Hash: ${item.hash}` : undefined) || 'Unknown',
                    version: modelInfo?.name || item.modelVersionName,
                    weight: item.weight !== undefined ? Number(item.weight) : undefined,
                    type: modelInfo?.model?.type ?? item.type ?? 'Unknown',
                    baseModel: modelInfo?.baseModel ?? 'Unknown base model',
                    href: modelInfo?.modelId && modelInfo?.name ? `#models?model=${modelInfo.modelId}&version=${modelInfo.name}` : undefined
                });
                resourcesContainer.appendChild(el);

                if (modelInfo !== undefined) {
                    if (!modelInfo) {
                        el.classList.add('no-model');
                        el.prepend(getIcon('cross'));
                        return;
                    }
                    resourcesFromCache.push(modelInfo);
                    if (modelInfo.id && loadedResources.has(modelInfo.id)) {
                        el.remove();
                        return;
                    }
                    if (modelInfo.id) loadedResources.add(modelInfo.id);
                    el.setAttribute('data-link-preview', '');
                    return;
                }

                let fetchPromise = null;
                if (item.modelVersionId) fetchPromise = this.api.fetchModelVersionInfo(item.modelVersionId).catch(() => null);
                else if (item.hash) {
                    fetchPromise = this.api.fetchModelVersionInfo(item.hash, true).catch(() => {
                        if (item.hash.length <= 10) return null;

                        const AutoV2 = item.hash.substring(0, 10);
                        if (this.#cache.modelVersions.has(AutoV2)) return this.#cache.modelVersions.get(AutoV2);

                        return this.api.fetchModelVersionInfo(AutoV2, true).then(info => {
                            const baseHash = item.hash.toUpperCase();
                            if (!info.files?.some(file => file.hashes?.SHA256?.toUpperCase().startsWith(baseHash))) return null;

                            if (!this.#cache.modelVersions.has(AutoV2)) this.#cache.modelVersions.set(AutoV2, info);
                            return info;
                        }).catch(() => null);
                    });
                }

                if (!fetchPromise) return;

                el.classList.add('meta-resource-loading');
                const promise = fetchPromise.then(info => replaceResourceRow(info, item, el))
                .catch(() => replaceResourceRow(null, item, el))
                .finally(() => el.classList.remove('meta-resource-loading'));
                resourcePromises.push(promise);
            });

            if (resourcesFromCache.length) processResources(resourcesFromCache);

            if (resourcePromises.length) {
                Promise.all(resourcePromises)
                .then(processResources)
                .finally(() => resourcesContainer.classList.remove('meta-resources-loading'));
            } else {
                resourcesContainer.classList.remove('meta-resources-loading');
            }
        }

        return container;
    }

    static #parseMeta(meta) {
        // Used resources
        const resourceHashes = new Set();
        const resources = [];
        const HASH_SIZES = new Set([8, 10, 12, 64]);
        const HEX_RE = /^[0-9a-f]+$/i;
        const isValidHash = hash => typeof hash === 'string' && HASH_SIZES.has(hash.length) && HEX_RE.test(hash);
        const addResourceToList = resource => {
            if (!resource || typeof resource !== 'object') return;

            // extracting modelVersionId from urn
            if (resource.name?.startsWith('urn:') && !resource.modelVersionId) {
                const id = resource.name.substring(resource.name.lastIndexOf('@') + 1);
                const num = Number(id);
                if (Number.isInteger(num)) resource.modelVersionId = num;
            }

            const key = isValidHash(resource.hash) ? resource.hash.toUpperCase() : resource.modelVersionId;
            if (!key || resourceHashes.has(key)) return;

            resourceHashes.add(key);
            resources.push({ key, ...resource });
        };

        meta?.civitaiResources?.forEach(addResourceToList);
        meta?.resources?.forEach(addResourceToList);
        meta?.additionalResources?.forEach(addResourceToList);
        if (meta?.hashes) Object.entries(meta.hashes).forEach(([name, hash]) => addResourceToList({ hash, name }));
        // if (meta['TI hashes']) Object.keys(meta['TI hashes'])?.forEach(key => addResourceToList({ hash: meta['TI hashes'][key], name: key })); // There always seem to be no models for these hashes on CivitAI // The image where this key was seen: 82695882
        if (meta?.['Model hash']) addResourceToList({ hash: meta['Model hash'], name: meta['Model'] });

        return { resources };
    }

    static #formatModelVersionName(modelVersionName) {
        const fragment = document.createDocumentFragment();
        let matched = false;

        const stack = [];
        let buffer = '';
        let i = 0;

        const pushBuffer = () => {
            if (!buffer) return;
            if (stack.length === 0) fragment.appendChild(document.createTextNode(buffer));
            else stack[stack.length - 1].content += buffer;
            buffer = '';
        };

        while (i < modelVersionName.length) {
            const char = modelVersionName[i];

            if (char === '[' || char === '(') {
                pushBuffer();
                stack.push({ type: char, content: '' });
            } else if (
                (char === ']' && stack.length && stack[stack.length - 1].type === '[') ||
                (char === ')' && stack.length && stack[stack.length - 1].type === '(')
            ) {
                pushBuffer();
                const stackItem = stack.pop();
                if (stack.length === 0) {
                    if (stackItem.type === '[') insertElement('strong', fragment, undefined, `[${stackItem.content}]`);
                    else insertElement('em', fragment, undefined, `(${stackItem.content})`);
                    matched = true;
                } else {
                    stack[stack.length - 1].content += (stackItem.type === '[' ? '[' : '(') + stackItem.content + char;
                }
            } else {
                buffer += char;
            }

            i++;
        }

        pushBuffer();

        while (stack.length > 0) {
            const { type, content } = stack.shift();
            const open = type;
            const close = type === '[' ? ']' : ')';
            fragment.appendChild(document.createTextNode(open + content + close));
        }

        return matched ? fragment : document.createTextNode(modelVersionName);
    }

    // used only in link previews
    static #genCollectionCard(collection, options) {
        const { itemWidth, itemHeight, forceAutoplay = false } = options ?? {};

        const card = createElement('a', { 'data-id': collection.id, href: `#images?collection=${collection.id}`, style: `width: ${itemWidth}px; height: ${itemHeight}px;`, 'data-draggable-title': collection.name });
        let cardClassName = 'card model-card';
        
        // Image
        const previewMedia = collection.image;
        if (previewMedia) {
            const mediaElement = this.#genMediaElement({ media: previewMedia, className: 'card-background', width: itemWidth, height: itemHeight, allowResize: true, target: 'model-card', decoding: 'async', autoplay: forceAutoplay || SETTINGS.autoplay, passiveHoverPlay: true });
            if (!SETTINGS.autoplay) {
                if (previewMedia?.type === 'video') cardClassName += ' video-hover-play';
                cardClassName += ' image-hover-play';
            }
            card.appendChild(mediaElement);
        } else {
            const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
            const noMedia = insertElement('div', cardBackgroundWrap, { class: 'media-element no-media' });
            noMedia.appendChild(getIcon('image'));
            insertElement('span', noMedia, undefined, window.languagePack?.errors?.no_media ?? 'No Media');
        }

        card.className = cardClassName;
        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });
        const cardContentBottom = insertElement('div', cardContentWrap, { class: 'card-content-bottom' });

        // Collection category
        if (collection.mode) insertElement('div', cardContentTop, { class: 'badge model-type' }, collection.mode);
        if (collection.type) {
            const type = { Article: 'articles', Model: 'models', Image: 'images' }[collection.type] ?? collection.type;
            const typeText = window.languagePack?.text?.[type] ?? type;
            insertElement('div', cardContentTop, { class: 'badge model-type' }, typeText);
        }

        // Creator
        if (collection.user) cardContentBottom.appendChild(this.#genUserBlock(collection.user));

        // challengeDate
        if (collection.metadata && collection.metadata.challengeDate && collection.metadata.endsAt) {
            const challengeDate = new Date(collection.metadata.challengeDate);
            const endsAt = new Date(collection.metadata.endsAt);
            insertElement('div', cardContentBottom, { class: 'model-published-time', 'lilpipe-text': `${challengeDate.toLocaleString()} — ${endsAt.toLocaleString()}` }, timeAgo(Math.round((Date.now() - challengeDate)/1000)));
        }

        // Collection Name
        insertElement('div', cardContentBottom, { class: 'model-name' }, collection.name);

        return card;
    }

    static #genArticleCardProgressive = [
        { // base
            weight: 1,
            generator: (ctx) => {
                const { data: article, itemWidth, itemHeight, forceAutoplay = false } = ctx;

                ctx.cardSizeStyle = `width: ${itemWidth}px; height: ${itemHeight}px;`;

                let cardClassName = 'card model-card';
                const card = createElement('a', { 'data-id': article.id, href: `#articles?article=${article.id}`, style: ctx.cardSizeStyle, 'data-draggable-title': article.title });

                if (article.coverImage) {
                    const previewMedia = article.coverImage;
                    if (!previewMedia.hashColor && previewMedia.hash) previewMedia.hashColor = Blurhash.toHex(previewMedia.hash);
                    ctx.mediaContainer = insertElement('div', card, { class: `card-background media-container media-${previewMedia.type} loading`, style: `background-color: ${previewMedia.hashColor || 'transparent'}; ${ctx.cardSizeStyle}` });

                    if (!(forceAutoplay ?? SETTINGS.autoplay) && previewMedia.type === 'video') {
                        if (previewMedia?.type === 'video') cardClassName += ' video-hover-play';
                        cardClassName += ' image-hover-play';
                    }
                }
                card.className = cardClassName;

                ctx.card = card;

                return { element: card };
            }
        },
        { // blurhash
            weight: 5,
            generator: (ctx) => {
                const { data: article, mediaContainer, forceAutoplay = false } = ctx;

                if (article.coverImage) {
                    const previewMedia = article.coverImage;
                    if (previewMedia.hash) this.#insertMediaBlurhash(mediaContainer, { media: previewMedia });

                    // play button
                    if (!(forceAutoplay ?? SETTINGS.autoplay) && previewMedia.type === 'video') {
                        const videoPlayButton = insertElement('div', mediaContainer, { class: 'video-play-button' });
                        videoPlayButton.appendChild(getIcon('play'));
                    }
                } else {
                    const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
                    const noMedia = insertElement('div', cardBackgroundWrap, { class: 'media-element no-media' });
                    noMedia.appendChild(getIcon('image'));
                    insertElement('span', noMedia, undefined, window.languagePack?.errors?.no_media ?? 'No Media');
                }
            }
        },
        { // full
            weight: 10,
            generator: (ctx) => {
                const { mediaContainer, card, data: article, itemWidth, itemHeight, forceAutoplay = false } = ctx;

                // card content
                const cardContentWrap = insertElement('div', card, { class: 'card-content' });
                const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });
                const cardContentBottom = insertElement('div', cardContentWrap, { class: 'card-content-bottom' });

                // Article category
                if (article.category) insertElement('div', cardContentTop, { class: 'badge model-type' }, article.category);

                // Creator
                if (article.user) cardContentBottom.appendChild(this.#genUserBlock(article.user));

                // publishedAt
                const publishedAt = new Date(article.publishedAt);
                insertElement('div', cardContentBottom, { class: 'model-published-time', 'lilpipe-text': publishedAt.toLocaleString() }, timeAgo(Math.round((Date.now() - publishedAt)/1000)));

                // Article Name
                insertElement('div', cardContentBottom, { class: 'model-name' }, article.title);

                // Stats
                const insertStats = (stats, parent) => {
                    stats.forEach(({ icon, value = 0, unit }) => {
                        const badge = document.createElement('div');
                        badge.textContent = value > 999 ? formatNumber(value) : value;
                        let className = 'article-stat';
                        if (!value) {
                            badge.setAttribute('inert', '');
                            className += ' badge-empty';
                        }
                        const lilpipeValue = value > 999 ? formatNumberIntl(value) : escapeHtml(value);
                        if (unit) {
                            const units = Array.isArray(unit) ? unit : window.languagePack?.units?.[unit];
                            badge.setAttribute('lilpipe-text', units ? `${lilpipeValue} ${escapeHtml(pluralize(value, units))}` : lilpipeValue);
                        } else badge.setAttribute('lilpipe-text', lilpipeValue);
                        badge.prepend(getIcon(icon));
                        badge.className = className;
                        parent.appendChild(badge);
                    });
                };
                const statsContainer = insertElement('div', cardContentBottom, { class: 'article-stats' });
                const statsLeft = insertElement('div', statsContainer, { class: 'article-stats-left badge' });
                const statsRight = insertElement('div', statsContainer, { class: 'article-stats-right badge' });

                const stats = article.stats;
                insertStats([
                    { icon: 'bookmark', value: stats.collectedCount, unit: 'bookmark' },
                    { icon: 'chat', value: stats.commentCount, unit: 'comment' },
                    { icon: 'thunder', value: stats.tippedAmountCount, unit: ["Buzz", "Buzz", "Buzz"] }
                ], statsLeft);
                insertStats([
                    { icon: 'eye', value: stats.viewCount, unit: 'view' }
                ], statsRight);

                // actual image
                if (article.coverImage) {
                    this.#insertMediaElement(mediaContainer, { media: article.coverImage, width: itemWidth, height: itemHeight, allowResize: true, decoding: 'async', target: 'model-card', autoplay: forceAutoplay ?? SETTINGS.autoplay });
                    mediaContainer.setAttribute('data-id', article.coverImage.id);
                }
            }
        }
    ];

    static #genArticleCard(article, options) {
        const ctx = { data: article, ...options };
        this.#genArticleCardProgressive.forEach(step => step.generator(ctx));
        return ctx.card;
    }

    static #genModelCardProgressive = [
        { // base
            weight: 1,
            generator: (ctx) => {
                const { data: model, itemWidth, itemHeight, version, forceAutoplay = false } = ctx;

                const modelVersion = version ? model.modelVersions.find(v => v.name === version || v.id === Number(version)) ?? model.modelVersions[0] : model.modelVersions[0];

                ctx.cardSizeStyle = `width: ${itemWidth}px; height: ${itemHeight}px;`;

                let cardClassName = 'card model-card';
                const card = createElement('a', { 'data-id': model.id, href: `#models?model=${model.id}&version=${encodeURIComponent(modelVersion.name)}`, style: ctx.cardSizeStyle, 'data-draggable-title': `${model.name} | ${modelVersion.name}` });

                // Select image
                const previewMedia = modelVersion.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
                if (previewMedia) {
                    ctx.previewMedia = previewMedia;
                    if (!previewMedia.hashColor && previewMedia.hash) previewMedia.hashColor = Blurhash.toHex(previewMedia.hash);;
                    ctx.mediaContainer = insertElement('div', card, { class: `card-background media-container media-${previewMedia.type} loading`, style: `background-color: ${previewMedia.hashColor || 'transparent'}; ${ctx.cardSizeStyle}` });
                    if (!(forceAutoplay ?? SETTINGS.autoplay) && previewMedia.type === 'video') {
                        if (previewMedia.type === 'video') cardClassName += ' video-hover-play';
                        cardClassName += ' image-hover-play';
                    }
                } else if (modelVersion.images?.length) {
                    const cardBackgroundWrap = insertElement('div', card, { class: 'card-background nsfw-blur-hash' });
                    const closestNSFWLevel = Math.min(...modelVersion.images.map(m => m.nsfwLevel));
                    const closestMedia = modelVersion.images.find(m => m.nsfwLevel === closestNSFWLevel);
                    if (closestMedia?.hash) {
                        ctx.closestMedia = closestMedia;
                        cardBackgroundWrap.style.backgroundColor = Blurhash.toHex(closestMedia.hash);
                        ctx.mediaContainer = cardBackgroundWrap;
                    }
                }

                card.className = cardClassName;

                ctx.card = card;
                ctx.modelVersion = modelVersion;

                return { element: card };
            }
        },
        { // blurhash
            weight: 5,
            generator: (ctx) => {
                const { data: model, mediaContainer, card, previewMedia, closestMedia, forceAutoplay = false } = ctx;

                if (previewMedia) {
                    if (previewMedia.hash) this.#insertMediaBlurhash(mediaContainer, { media: previewMedia });

                    // play button
                    if (!(forceAutoplay ?? SETTINGS.autoplay) && previewMedia.type === 'video') {
                        const videoPlayButton = insertElement('div', mediaContainer, { class: 'video-play-button' });
                        videoPlayButton.appendChild(getIcon('play'));
                    }
                } else if (closestMedia) {
                    const noMedia = insertElement('div', mediaContainer, { class: 'media-element nsfw-filter' });
                    const nsfwLabel = this.#convertNSFWLevelToString(closestMedia.nsfwLevel);
                    insertElement('div', noMedia, { class: 'image-nsfw-level badge', 'data-nsfw-level': nsfwLabel }, nsfwLabel);
                    if (closestMedia.hash) this.#insertMediaBlurhash(mediaContainer, { media: closestMedia });
                } else {
                    const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
                    const noMedia = insertElement('div', cardBackgroundWrap, { class: 'media-element no-media' });
                    noMedia.appendChild(getIcon('image'));
                    insertElement('span', noMedia, undefined, window.languagePack?.errors?.no_media ?? 'No Media');
                }
            }
        },
        { // full
            weight: 10,
            generator: (ctx) => {
                const { mediaContainer, card, data: model, modelVersion, previewMedia, itemWidth, itemHeight, forceAutoplay = false } = ctx;

                // card content
                const cardContentWrap = insertElement('div', card, { class: 'card-content' });
                const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top model-type-badges' });
                const cardContentBottom = insertElement('div', cardContentWrap, { class: 'card-content-bottom' });

                // Model Type
                const modelTypeWrap = insertElement('div', cardContentTop, { class: 'badge model-type', 'lilpipe-text': escapeHtml(`${model.type} · ${this.#models.labels[modelVersion.baseModel] ?? modelVersion.baseModel ?? '?'}`) }, `${this.#types.labels[model.type] || model.type} · ${this.#models.labels_short[modelVersion.baseModel] ?? modelVersion.baseModel ?? '?'}`);

                // Availability
                let availabilityBadge = null;
                if (modelVersion.availability !== 'Public') availabilityBadge = modelVersion.availability;
                else {
                    if (model.modelUpdatedRecently === undefined) model.modelUpdatedRecently = model.modelVersions.find(version => (version.publishedAt ?? version.createdAt) > CONFIG.minDateForNewBadge);
                    if (model.modelUpdatedRecently) availabilityBadge = model.modelVersions.length > 1 ? 'Updated' : 'New';
                }
                if (availabilityBadge) {
                    const badge = insertElement('div', cardContentTop, { class: 'badge model-availability', 'data-badge': availabilityBadge }, window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge);
                    let date = null, modelName = null;
                    if (modelVersion.availability === 'EarlyAccess' && modelVersion.earlyAccessDeadline) {
                        date = new Date(modelVersion.earlyAccessDeadline);
                        modelName = modelVersion.name;
                    } else if (modelVersion.availability === 'Public' && model.modelUpdatedRecently) {
                        date = new Date(model.modelUpdatedRecently.publishedAt ?? model.modelUpdatedRecently.createdAt);
                        modelName = model.modelUpdatedRecently.name;
                    }
                    if (date) {
                        const updatedAtString = timeAgo(Math.round((Date.now() - date)/1000));
                        const lilpipeText = `<div class="model-name"><b>${escapeHtml(modelName || '')}</b></div><span class="dark-text">${escapeHtml(updatedAtString)}</span>`;
                        badge.setAttribute('lilpipe-text', lilpipeText);
                        if (forceAutoplay) insertElement('div', cardContentTop, { class: 'dark-text' }, updatedAtString);
                    }
                }

                // Creator
                if (model.creator) cardContentBottom.appendChild(this.#genUserBlock(model.creator));

                // Model Name
                insertElement('div', cardContentBottom, { class: 'model-name' }, model.name);

                // Stats
                const statsSource = SETTINGS.showCurrentModelVersionStats && modelVersion.stats ? modelVersion.stats : model.stats;
                const statsContainer = this.#genStats([
                    { icon: 'download', value: statsSource.downloadCount, unit: 'download' },
                    { icon: 'like', value: statsSource.thumbsUpCount, unit: 'like' },
                    { icon: 'chat', value: model.stats.commentCount, unit: 'comment' },
                    // { icon: 'bookmark', value: model.stats.favoriteCount, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
                ]);
                cardContentBottom.appendChild(statsContainer);

                // actual image
                if (previewMedia) {
                    this.#insertMediaElement(mediaContainer, { media: previewMedia, width: itemWidth, height: itemHeight, allowResize: true, decoding: 'async', target: 'model-card', autoplay: forceAutoplay ?? SETTINGS.autoplay });
                    mediaContainer.setAttribute('data-id', previewMedia.id);
                }
            }
        }
    ];

    static #genModelCard(model, options) {
        // Note: Adds a "modelUpdatedRecently" field to the model object
        const ctx = { data: model, ...options };
        this.#genModelCardProgressive.forEach(step => step.generator(ctx));
        return ctx.card;
    }

    static #genImageCardProgressive = [
        { // base
            weight: 1,
            generator: (ctx) => {
                const { data, itemWidth, forceAutoplay = false } = ctx;

                let image = data;
                if (image instanceof Set) {
                    ctx.postSize = image.size;
                    image = image.values().next().value;
                };

                const ratio = image.width / image.height;
                const draggableTitle = (window.languagePack?.text?.image_by ?? 'Image by {username}').replace('{username}', image.username || 'user');

                if (!ctx.itemHeight) ctx.itemHeight = itemWidth / ratio;

                ctx.cardSizeStyle = `width: ${itemWidth}px; height: ${ctx.itemHeight}px;`;

                let cardClassName = 'card image-card';
                const card = createElement('a', { 'data-id': image.id, href: `#images?image=${encodeURIComponent(image.id)}&nsfw=${image.browsingLevel ? this.#convertNSFWLevelToString(image.browsingLevel) : image.nsfw}`, style: ctx.cardSizeStyle, 'data-draggable-title': draggableTitle });

                if (!image.hashColor && image.hash) {
                    image.hashColor = Blurhash.toHex(image.hash);

                    // The site doesn't provide blurhash for videos, it's always black
                    if (image.hashColor === '#000000' && image.type === 'video') image.hashColor = 'transparent';
                }
                const mediaContainer = insertElement('div', card, { class: `card-background media-container media-${image.type} loading`, style: `background-color: ${image.hashColor || 'transparent'}; ${ctx.cardSizeStyle}` });

                if (!(forceAutoplay ?? SETTINGS.autoplay) && image.type === 'video') {
                    if (image?.type === 'video') cardClassName += ' video-hover-play';
                    cardClassName += ' image-hover-play';
                }
                card.className = cardClassName;

                ctx.card = card;
                ctx.mediaContainer = mediaContainer;
                ctx.image = image;

                return { element: card };
            }
        },
        { // blurhash
            weight: 5,
            generator: (ctx) => {
                const { image, mediaContainer, forceAutoplay = false } = ctx;

                // blurhash
                if (image.hash) this.#insertMediaBlurhash(mediaContainer, { media: image });

                // play button
                if (!(forceAutoplay ?? SETTINGS.autoplay) && image.type === 'video') {
                    const videoPlayButton = insertElement('div', mediaContainer, { class: 'video-play-button' });
                    videoPlayButton.appendChild(getIcon('play'));
                }
            }
        },
        { // full
            weight: 10,
            generator: (ctx) => {
                const { mediaContainer, card, image, itemWidth, itemHeight, forceAutoplay = false } = ctx;

                // card content
                const cardContentWrap = insertElement('div', card, { class: 'card-content' });
                const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });

                // user and createdAt
                const creator = this.#genUserBlock({ userId: image.userId, username: image.username, group: image.usergroup ?? null });
                if (image.createdAt) {
                    const createdAt = new Date(image.createdAt);
                    insertElement('span', creator, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
                }
                cardContentTop.appendChild(creator);

                // badges
                const badgesContainer = insertElement('div', cardContentTop, { class: 'badges other-badges' });
                const nsfwLevel = typeof image.nsfwLevel === 'number' ? this.#convertNSFWLevelToString(image.nsfwLevel) : image.nsfwLevel;
                if (nsfwLevel !== 'None') insertElement('div', badgesContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': nsfwLevel }, nsfwLevel);
                if (ctx.postSize > 1) {
                    const metaIconContainer = insertElement('div', badgesContainer, { class: 'badge' }, ctx.postSize > 99 ? '99+' : ctx.postSize);
                    metaIconContainer.appendChild(getIcon('image'));
                }

                // A note that the image is cropped
                // if (Math.abs(itemWidth / itemHeight - image.width / image.height) > .01) {
                //     const metaIconContainer = insertElement('div', badgesContainer, { class: 'image-meta badge', 'lilpipe-text': 'TODO' });
                //     metaIconContainer.appendChild(getIcon('minimize'));
                // }

                // stats
                const stats = image.stats ?? {};
                const statsContainer = this.#genStats([
                    { iconString: '👍', value: stats.likeCount, unit: 'like' },
                    { iconString: '👎', value: stats.dislikeCount, unit: 'dislike' },
                    { iconString: '😭', value: stats.cryCount, unit: 'cry' },
                    { iconString: '❤️', value: stats.heartCount, unit: 'heart' },
                    { iconString: '🤣', value: stats.laughCount, unit: 'laugh' },
                    { iconString: '💬', value: stats.commentCount, unit: 'comment' },
                ], true);
                cardContentWrap.appendChild(statsContainer);

                // actual image
                this.#insertMediaElement(mediaContainer, { media: image, width: itemWidth, height: itemHeight, decoding: 'async', target: 'image-card', autoplay: forceAutoplay ?? SETTINGS.autoplay });
                mediaContainer.setAttribute('data-id', image.id);
            }
        }
    ];

    static #genImageCard(image, options) {
        const ctx = { data: image, ...options };
        this.#genImageCardProgressive.forEach(step => step.generator(ctx));
        return ctx.card;
    }

    static #genUserBlock(userInfo) {
        let className = 'user-info';
        const container = createElement('div', { class: 'user-info' });

        if (userInfo.deletedAt) className += ' user-deleted';
        if (userInfo.isModerator) className += ' user-moderator';

        if (userInfo.userId && CONFIG.userGroups[userInfo.userId]) className += ` user-${CONFIG.userGroups[userInfo.userId]}`;
        container.className = className;

        const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
        if (userInfo.image !== undefined) {
            if (userInfo.image) {
                const src = `${userInfo.image.replace(this.#regex.urlParamWidth, `/width=${this.#getNearestServerSize(creatorImageSize)}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop${SETTINGS.autoplay ? '' : '&format=webp'}&target=user-image`;

                if (!this.#cachedUserImages.get(src)) this.#cachedUserImages.set(src, new Set());

                const pool = this.#cachedUserImages.get(src);

                let img = null;
                if (pool.size > 0) {
                    const it = pool.values();
                    img = it.next().value;
                    pool.delete(img);
                }

                if (img === null) img = createElement('img', { class: 'image-possibly-animated', crossorigin: 'anonymous', alt: userInfo.username?.substring(0, 2) ?? 'NM', decoding: 'async', fetchPriority: 'low', src });

                container.appendChild(img);
            }
            else insertElement('div', container, { class: 'no-media' }, userInfo.username?.substring(0, 2) ?? 'NM');
        }

        const usernameText = userInfo.url && userInfo.url[0] === '#'
            ? insertElement('a', container, { href: userInfo.url }, userInfo.username)
            : insertElement('span', container, undefined, userInfo.username);

        if (userInfo.group) {
            if (userInfo.group === 'OP') insertElement('div', usernameText, { class: 'badge user-group', 'data-group': 'OP' }, 'OP');
        }

        return container;
    }

    static #genMediaElement(options) {
        // Note: Adds a "hashColor" field to the media object
        const { media, autoplay = SETTINGS.autoplay, passiveHoverPlay = false, className: baseClassName = null, width, height = undefined } = options;
        const ratio = media.width / media.height;
        const styleString = width && height ? `width: ${width}px; height: ${height}px;` : `aspect-ratio: ${this.#round(ratio)};`;
        const mediaContainer = createElement('div', { 'data-id': media.id ?? -1, 'data-nsfw-level': media.nsfwLevel, style: styleString });
        let mediaElement;
        let className = baseClassName ? `${baseClassName} media-container loading` : 'media-container loading';

        if (media.type === 'image') {
            className += ' media-image';
            if (!autoplay && !options.original && !passiveHoverPlay) className += ' image-hover-play';
        } else if (media.type === 'video') {
            className += ' media-video';
            if (autoplay) {
                className += ' video-autoplay';
            } else {
                if (!passiveHoverPlay) className += ' video-hover-play';
                const videoPlayButton = insertElement('div', mediaContainer, { class: 'video-play-button' });
                videoPlayButton.appendChild(getIcon('play'));
            }
        }
        mediaContainer.className = className;

        if (options.loading === 'lazy') {
            onTargetInViewport(mediaContainer, () => this.#insertMediaElement(mediaContainer, options));
        } else {
            mediaElement = this.#insertMediaElement(mediaContainer, options);
        }

        if (media.hash) {
            if (!media.hashColor) media.hashColor = Blurhash.toHex(media.hash);
            mediaContainer.style.backgroundColor = media.hashColor;

            if (!mediaElement || !mediaElement.complete || mediaElement.naturalWidth === 0) this.#insertMediaBlurhash(mediaContainer, { media });
        }

        return mediaContainer;
    }

    static #insertMediaBlurhash(mediaContainer, options) {
        const { media } = options;
        const blurSize = CONFIG.appearance.blurHashSize;
        const ratio = media.width / media.height;
        const blurW = ratio > 1 ? Math.round(blurSize * ratio) : blurSize;
        const blurH = ratio > 1 ? blurSize : Math.round(blurSize / ratio);
        const previewUrl = `${CONFIG.local_urls.blurHash}?hash=${encodeURIComponent(media.hash)}&width=${blurW}&height=${blurH}`;
        mediaContainer.style.backgroundImage = `url(${previewUrl})`;
    }

    static #insertMediaElement(mediaContainer, options) {
        const { media, width, height = undefined, allowResize = false, loading = 'auto', target = null, controls = false, original = false, autoplay = SETTINGS.autoplay, decoding = 'auto', allowAnimated = false, playsinline = true, setMediaElementOriginalSizes = false } = options;
        const ratio = media.width / media.height;
        const targetWidth = Math.round(Math.max(width, height ? (height * ratio) : 0) * this.#devicePixelRatio);
        const realWidth = this.#getNearestServerSize(targetWidth);
        const size = `width=${realWidth},`; // You can't specify "not a jackal image trying to upscale"... if you just don't specify the size, it might return normally, the original resolution, or it might return a jackal 4096px
        // const size = realWidth < media.width || media.type === 'video' ? `width=${realWidth},` : '';
        const resized = allowResize && width && height && Math.min(realWidth, media.width) > (width * this.#devicePixelRatio) * 1.3;
        let paramString = target ? (`?target=${target}`) : '';
        // Crop image if result is 30% wider than required
        if (resized) paramString = `${paramString}${paramString ? '&' : '?'}width=${this.#round(width * this.#devicePixelRatio)}&height=${this.#round(height * this.#devicePixelRatio)}&quality=.88&fit=crop${allowAnimated ? '' : '&format=webp'}`;
        const widthString = original ? '/original=true/' : `/${size}anim=false,optimized=true/`;
        const urlBase = media.url.includes('/original=true/') ? media.url.replace('/original=true/', widthString) : media.url.replace(this.#regex.urlParamWidth, widthString);
        const url = `${urlBase}${paramString}`;
        const mediaElement = createElement('img', { alt: ' ', crossorigin: 'anonymous' });
        let className = 'media-element';
        let src;

        if (media.type === 'image') {
            src = original ? url : (autoplay || allowAnimated ? url.replace(this.#regex.urlParamAnimFalse, '') : url);

            if (!autoplay && !original) className += ' image-possibly-animated';
        } else if (media.type === 'video') {
            // Video does not need any local parameters (video elements are skipped in sw)
            const source = original ? urlBase : urlBase.replace('anim=false', 'anim=false,transcode=true');
            const poster = src = `${source}${paramString}`;
            const videoSrc = source.replace(this.#regex.urlParamAnimFalse, '');

            mediaContainer.setAttribute('data-src', videoSrc);
            mediaContainer.setAttribute('data-poster', poster);
            mediaContainer.setAttribute('data-timestump', 0);
            if (playsinline) mediaContainer.setAttribute('data-playsinline', true);
            if (controls) mediaContainer.setAttribute('data-controls', true);

            if (autoplay) enableAutoPlayOnVisible(mediaContainer);
        }

        mediaElement.className = className;
        if (loading === 'eager') mediaElement.loading = loading;
        if (decoding === 'sync' || decoding === 'async') mediaElement.decoding = decoding;

        if (src) mediaElement.setAttribute('src', src);

        if (setMediaElementOriginalSizes) {
            mediaElement.style.cssText = `width: ${media.width}px; height: ${media.height}px;`;
        } else if (width && height) {
            mediaElement.style.cssText = `width: ${width}px; height: ${height}px;`;
        } else {
            mediaElement.style.cssText = `aspect-ratio: ${this.#round(ratio)};`;
        }
        if (resized && width && height) mediaContainer.setAttribute('data-resize', `${width}:${height}`);
        mediaContainer.prepend(mediaElement);
        return mediaElement;
    }

    static #genMediaPreviewFromPrevPage(mediaElement, mediaId) {
        mediaElement = (mediaElement.classList.contains('media-container') ? mediaElement : mediaElement.querySelector('.media-container')) ?? mediaElement;
        const mediaOriginal = this.appElement.querySelector(`.media-container[data-id="${mediaId}"]:not([data-resize])`); // The resizing animation seems extremely unpleasant and out of place
        // const mediaOriginal = this.appElement.querySelector(`.media-container[data-id="${mediaId}"]`);
        let previewImageOriginal = mediaOriginal?.querySelector(`.media-element`);
        if (!previewImageOriginal) return;

        const fullMedia = mediaElement.querySelector('.media-element');
        const isImage = fullMedia?.tagName === 'IMG';
        if (!fullMedia) return;

        const resized = mediaOriginal.getAttribute('data-resize')?.split(':').map(c => +c);

        let timestump = 0;
        if (mediaElement.classList.contains('media-video')) {
            const isVideo = previewImageOriginal.tagName === 'VIDEO';
            timestump = +(isVideo ? previewImageOriginal.currentTime : mediaOriginal.getAttribute('data-timestump')) || 0;
            mediaElement.setAttribute('data-timestump', timestump);
        }

        if (previewImageOriginal.tagName === 'VIDEO') {
            if (mediaOriginal.hasAttribute('data-autoplay')) pauseVideo(mediaOriginal, 'data-autoplay');
            else if (mediaOriginal.hasAttribute('data-focus-play')) pauseVideo(mediaOriginal, 'data-focus-play');
            previewImageOriginal = mediaOriginal.querySelector(`.media-element`);
        }
        
        const previewImage = previewImageOriginal?.cloneNode(true);
        if (!previewImage) return;

        previewImage.classList.add('media-preview-image');
        previewImage.setAttribute('inert', '');
        previewImage.style.cssText = fullMedia.style.cssText;

        const previewWrap = createElement('div', { class: 'media-preview-wrapper' });
        previewWrap.appendChild(previewImage);
        if (previewImage.tagName === 'VIDEO') {
            if (!previewImage.paused) previewImage.pause();
            if (timestump) previewImage.currentTime = timestump;
        } else if (previewImage.tagName === 'CANVAS') {
            const ctx = previewImage.getContext('2d');
            ctx.drawImage(previewImageOriginal, 0, 0);
        }
        previewWrap.appendChild(Controller.genLoadingIndecator());

        let isReady = false, onReady = null, loadingStart = Date.now();
        const onFullMediaReady = () => {
            if (isReady) return;
            isReady = true;
            const isInstant = Date.now() - loadingStart <= 10;
            requestAnimationFrame(() => {
                if (isInstant) {
                    previewWrap.remove();
                    return;
                }
                if (resized) {
                    const fullMedia = mediaElement.querySelector('.media-element:not([inert])');
                    const [tw, th] = resized;
                    const ow = fullMedia.width;
                    const oh = fullMedia.height;
                    const scaleFactor = Math.max(tw / ow, th / oh);
                    const scale = (ow * scaleFactor) / tw;
                    if (scale && scale !== 1 && scale >= .01 && scale <= 4) {
                        animateElement(fullMedia, {
                            keyframes: { scale: [scale, 1] },
                            duration: 200,
                            fill: 'backwards',
                            easing: 'ease'
                        });
                        previewWrap.remove();
                        return;
                    }
                }

                animateElement(previewWrap, {
                    keyframes: { opacity: [1, 0] },
                    duration: 200,
                    easing: 'ease'
                }).then(() => previewWrap.remove());
            });
            // onReady?.();
        };
        const waitForReady = () => {
            if (!mediaElement.contains(fullMedia)) {
                onFullMediaReady();
                return;
            }

            const cleanup = () => {
                fullMedia.removeEventListener('load', onload);
                fullMedia.removeEventListener('canplay', onload);
                observer.disconnect();
            };
            const onload = () => {
                cleanup();
                let promise;
                if (isImage && mediaElement.contains(fullMedia)) promise = fullMedia.decode?.().catch(() => {});
                if (promise) promise.finally(onFullMediaReady);
                else onFullMediaReady();
            }

            // This is necessary because the image can be replaced with a video when it is ready
            const observer = new MutationObserver(() => {
                if (!mediaElement.contains(fullMedia)) {
                    cleanup();
                    onFullMediaReady();
                }
            });

            observer.observe(mediaElement, { childList: true, subtree: false });

            // There is always an image here, because mediaElement no longer creates videos, they are created elsewhere when they hit the screen
            if (!isImage) {
                if (fullMedia.readyState >= 3) return onload();

                // since the video may have preload=none, need to track at least the loading of the poster
                const posterUrl = fullMedia.poster;
                if (posterUrl) {
                    const posterImg = new Image();
                    posterImg.addEventListener('load', onload, { once: true });
                    posterImg.src = posterUrl;
                }

                fullMedia.addEventListener('canplay', onload, { once: true });
                return;
            }

            if (!mediaElement.classList.contains('media-video') || !timestump) {
                if (fullMedia.complete && fullMedia.naturalWidth !== 0) onload();
                else fullMedia.addEventListener('load', onload, { once: true });
                return;
            }

            // If the video has "video-autoplay", you just need to wait for the observer to trigger; otherwise, start and stop the video
            if (mediaElement.classList.contains('video-autoplay')) return;

            // Start and stop the video to get the correct frame if autoplay is off
            observer.disconnect(); // 
            return playVideo(mediaElement, 'data-autoplay').then(() => {
                pauseVideo(mediaElement, 'data-autoplay');
                onload();
            });
        };

        mediaElement.prepend(previewWrap);
        waitForReady();

        // return new Promise(resolve => {
        //     onReady = resolve;
        // });
    }

    static #genArticlesListFilters(onAnyChange, options = {}) {
        const { period_articles = true } = options;
        const sortOptions = [ 'Most Bookmarks', 'Most Reactions', 'Most Comments', 'Most Collected', 'Newest', 'Recently Updated' ];

        const list = [
            { type: 'list',
                key: 'sort_articles',
                label: window.languagePack?.text?.sort ?? 'Sort',
                options: sortOptions,
                labels: this.#listFilters.genLabels(sortOptions, 'sortOptions')
            },
            period_articles ? { type: 'list',
                key: 'period_articles',
                label: window.languagePack?.text?.period ?? 'Pediod',
                options: this.#listFilters.periodOptions,
                labels: this.#listFilters.genLabels(this.#listFilters.periodOptions, 'periodOptions')
            } : null,
            { type: 'list',
                key: 'nsfwLevel',
                label: window.languagePack?.text?.nsfw ?? 'NSFW',
                options: this.#listFilters.nsfwOptions,
                labels: this.#listFilters.genLabels(this.#listFilters.nsfwOptions, 'nsfwOptions'),
                setValue: newValue => {
                    SETTINGS.nsfwLevel = newValue;
                    SETTINGS.browsingLevel = this.#listFilters.browsingLevels[newValue] ?? 4;
                    SETTINGS.nsfw = SETTINGS.browsingLevel >= 4;
                }
            }
        ];

        return this.#genFilters(list, onAnyChange);
    }

    static #genImagesListFilters(onAnyChange, options = {}) {
        const { baseModels_images = true, groupImagesByPost = true, period_images = true } = options;
        const modelsOptions = [ "All", ...this.#models.options ];
        const sortOptions = [ "Most Reactions", "Most Comments", "Most Collected", "Newest", "Oldest" ]; // "Random": Random sort requires a collectionId

        const list = [
            { type: 'dropdown',
                items: [
                    groupImagesByPost ? { type: 'boolean',
                        key: 'groupImagesByPost',
                        label: window.languagePack?.text?.group_posts ?? 'Group posts'
                    } : null,
                    { type: 'boolean',
                        key: 'hideImagesWithoutPositivePrompt',
                        label: window.languagePack?.text?.hideWithoutPositivePrompt ?? 'Hide without positive prompt'
                    },
                    { type: 'boolean',
                        key: 'hideImagesWithoutNegativePrompt',
                        label: window.languagePack?.text?.hideWithoutNegativePrompt ?? 'Hide without negative prompt'
                    },
                    { type: 'boolean',
                        key: 'hideImagesWithoutResources',
                        label: window.languagePack?.text?.hideImagesWithoutResources ?? 'Hide without resources'
                    }
                ]
            },
            EXTENSION_INSTALLED && baseModels_images ? { type: 'list',
                key: 'baseModels_images',
                label: window.languagePack?.text?.model ?? 'Model',
                options: modelsOptions,
                labels: this.#listFilters.genLabels(modelsOptions, 'modelLabels', this.#models.labels),
                tags: this.#models.tags,
                setValue: newValue => SETTINGS.baseModels_images = newValue === 'All' ? [] : [ newValue ],
                getValue: () => SETTINGS.baseModels_images.length ? (SETTINGS.baseModels_images.length > 1 ? SETTINGS.baseModels_images : SETTINGS.baseModels_images[0]) : 'All'
            } : null,
            { type: 'list',
                key: 'sort_images',
                label: window.languagePack?.text?.sort ?? 'Sort',
                options: sortOptions,
                labels: this.#listFilters.genLabels(sortOptions, 'sortOptions')
            },
            period_images ? { type: 'list',
                key: 'period_images',
                label: window.languagePack?.text?.period ?? 'Pediod',
                options: this.#listFilters.periodOptions,
                labels: this.#listFilters.genLabels(this.#listFilters.periodOptions, 'periodOptions')
            } : null,
            { type: 'list',
                key: 'nsfwLevel',
                label: window.languagePack?.text?.nsfw ?? 'NSFW',
                options: this.#listFilters.nsfwOptions,
                labels: this.#listFilters.genLabels(this.#listFilters.nsfwOptions, 'nsfwOptions'),
                setValue: newValue => {
                    SETTINGS.nsfwLevel = newValue;
                    SETTINGS.browsingLevel = this.#listFilters.browsingLevels[newValue] ?? 4;
                    SETTINGS.nsfw = SETTINGS.browsingLevel >= 4;
                }
            }
        ];

        return this.#genFilters(list, onAnyChange);
    }

    static #genModelsListFilters(onAnyChange, options = {}) {
        const { period = true, types = true, checkpointType = true, baseModels = true } = options;
        const modelsOptions = [ "All", ...this.#models.options ];
        const typeOptions = [ "All", ...this.#types.options];
        const trainedOrMergedOptions = [ 'All', 'Trained', 'Merge' ];
        const sortOptions = [ "Highest Rated", "Most Downloaded", "Most Liked", "Most Discussed", "Most Collected", "Most Images", "Newest", "Oldest" ];

        const list = [
            EXTENSION_INSTALLED ? null : { type: 'dropdown', // the main API (unlike the public one) does not return version statistics, so this parameter does not work
                items: [
                    { type: 'boolean',
                        key: 'showCurrentModelVersionStats',
                        label: window.languagePack?.text?.stats_from_version ?? 'Statistics for this version'
                    }
                ]
            },
            baseModels ? { type: 'list',
                key: 'baseModels',
                label: window.languagePack?.text?.model ?? 'Model',
                options: modelsOptions,
                labels: this.#listFilters.genLabels(modelsOptions, 'modelLabels', this.#models.labels),
                tags: this.#models.tags,
                setValue: newValue => SETTINGS.baseModels = newValue === 'All' ? [] : [ newValue ],
                getValue: () => SETTINGS.baseModels.length ? (SETTINGS.baseModels.length > 1 ? SETTINGS.baseModels : SETTINGS.baseModels[0]) : 'All'
            } : null,
            types ? { type: 'list',
                key: 'types',
                label: window.languagePack?.text?.type ?? 'Type',
                options: typeOptions,
                labels: this.#listFilters.genLabels(typeOptions, 'typeOptions', this.#types.labels),
                setValue: newValue => SETTINGS.types = newValue === 'All' ? [] : [ newValue ],
                getValue: () => SETTINGS.types.length ? (SETTINGS.types.length > 1 ? SETTINGS.types : SETTINGS.types[0]) : 'All'
            } : null,
            checkpointType ? { type: 'list',
                key: 'checkpointType',
                label: window.languagePack?.text?.origin ?? 'Origin',
                options: trainedOrMergedOptions,
                labels: this.#listFilters.genLabels(trainedOrMergedOptions, 'checkpointTypeOptions')
            } : null,
            { type: 'list',
                key: 'sort',
                label: window.languagePack?.text?.sort ?? 'Sort',
                options: sortOptions,
                labels: this.#listFilters.genLabels(sortOptions, 'sortOptions')
            },
            period ? { type: 'list',
                key: 'period',
                label: window.languagePack?.text?.period ?? 'Pediod',
                options: this.#listFilters.periodOptions,
                labels: this.#listFilters.genLabels(this.#listFilters.periodOptions, 'periodOptions')
            } : null,
            { type: 'list',
                key: 'nsfwLevel',
                label: window.languagePack?.text?.nsfw ?? 'NSFW',
                options: this.#listFilters.nsfwOptions,
                labels: this.#listFilters.genLabels(this.#listFilters.nsfwOptions, 'nsfwOptions'),
                setValue: newValue => {
                    SETTINGS.nsfwLevel = newValue;
                    SETTINGS.browsingLevel = this.#listFilters.browsingLevels[newValue] ?? 4;
                    SETTINGS.nsfw = SETTINGS.browsingLevel >= 4;
                }
            }
        ];
        return this.#genFilters(list, onAnyChange);
    }

    static #genFilters(list, onAnyChange) {
        const filterWrap = createElement('div', { class: 'list-filters' });

        for (const rule of list) {
            if (!rule) continue;

            if (rule.type === 'dropdown') {
                const { container } = this.#genDropdownFilter(filterWrap);

                for (const item of rule.items ?? []) {
                    if (!item) continue;
                    if (item.type !== 'boolean') continue;

                    const boolean = this.#genBoolean({
                        value: SETTINGS[item.key],
                        label: item.label,
                        onchange: ({ newValue }) => {
                            SETTINGS[item.key] = newValue;
                            onAnyChange?.();
                        }
                    });

                    boolean.element.classList.add('list-filter');
                    container.appendChild(boolean.element);
                }

                continue;
            }

            if (rule.type === 'list') {
                const value = rule.getValue ? rule.getValue() : SETTINGS[rule.key];

                const listEl = this.#genList({
                    label: rule.label,
                    options: rule.options,
                    labels: rule.labels,
                    tags: rule.tags,
                    value,
                    onchange: ({ newValue }) => {
                        if (rule.setValue) rule.setValue(newValue);
                        else SETTINGS[rule.key] = newValue;
                        onAnyChange?.();
                    }
                });

                listEl.element.classList.add('list-filter');
                filterWrap.appendChild(listEl.element);
            }
        }

        return filterWrap;
    }

    static #genScrollToTopButton() {
        const button = createElement('button', { class: 'scroll-page-to-top' });
        button.appendChild(getIcon('arrow_up_alt'));
        button.addEventListener('click', e => {
            let scrollTop = 0;

            if (e.altKey) {
                scrollTop = document.getElementById('images-list')?.offsetTop;
                scrollTop = Math.max(scrollTop - 200, 0);
            }

            if (scrollTop > 0 && Math.abs(document.documentElement.scrollTop - scrollTop) < 100) scrollTop = 0;

            document.documentElement.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }, { passive: true });
        return button;
    }

    // TODO: not boring loading indicator
    static genLoadingIndecator() {
        const indicator = createElement('div', { class: 'media-loading-indicator' });
        return indicator;
    }

    static #genErrorPage(error) {
        if (error.message) error = error.message;

        const errorImageDefault = 'src/icons/error.png';
        const errorsImagesDictionary = {
            'HTTP 500': 'src/icons/500.png',
            'HTTP 404': 'src/icons/404.png',
            'Model not found': 'src/icons/404.png',
            'No Meta': 'src/icons/404.png',
            'HTTP 401': 'src/icons/403.png',
            'HTTP 403': 'src/icons/403.png'
        };

        let imgSrc;
        if (error.startsWith('No model with id')) imgSrc = errorsImagesDictionary['HTTP 404'];
        else if (error.startsWith('CLUSTERDOWN')) imgSrc = errorsImagesDictionary['HTTP 500'];
        else imgSrc = errorsImagesDictionary[error] || errorImageDefault;

        const errorPage = createElement('div', { class: 'error-block' });
        insertElement('img', errorPage, { class: 'error-image', alt: error, src: imgSrc });
        insertElement('h2', errorPage, { class: 'error-text' }, `${window.languagePack?.errors?.error ?? 'Error'}: ${error}`);

        return errorPage;
    }

    static #genDropdownFilter(parent) {
        const button = insertElement('button', parent, { class: 'list-filter list-filter-dropdown closed' });
        button.appendChild(getIcon('filter'));
        const container = insertElement('div', button, { class: 'list-filter-dropdown-container' });
        let isClosed = true, fromClick = false;

        const open = () => {
            if (!isClosed) return;
            isClosed = false;
            button.classList.remove('closed');

            const offsetRight = button.offsetParent.offsetWidth - (button.offsetLeft + button.offsetWidth);
            const width = container.offsetWidth;
            const targetOffsetRight = offsetRight + button.offsetWidth / 2 - width / 2;
            const windowWidth = window.innerWidth;
            const aviableOffsetRight = targetOffsetRight < 0 ? 16 : targetOffsetRight + width >= windowWidth ? windowWidth - width - 16 : targetOffsetRight;
            const offsetX = aviableOffsetRight - targetOffsetRight;

            container.style.top = `${button.offsetTop + button.offsetHeight + 8}px`;
            container.style.right = `${aviableOffsetRight}px`;
            container.style.setProperty('--offsetX', `${offsetX}px`);

            button.focus({ preventScroll: true });
        };

        const close = () => {
            if (isClosed) return;
            isClosed = true;
            fromClick = false;
            button.classList.add('closed');
        };

        button.addEventListener('pointerdown', e => {
            if (e.target.closest('.list-filter-dropdown-container')) return;
            if (isClosed) fromClick = true;
        });

        button.addEventListener('click', e => {
            if (fromClick) {
                fromClick = false;
                if (!isClosed) return;
            }
            if (e.target.closest('.list-filter-dropdown-container')) return;
            isClosed ? open() : close();
        });

        button.addEventListener('focusin', () => {
            open();
        });

        button.addEventListener('focusout', e => {
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && button.contains(relatedTarget)) return;
            close();
        });

        button.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close();
                button.focus({ preventScroll: true });
            }
        });

        return { button, container };
    }

    static #genBoolean({ onchange, value, label }) {
        const element = createElement('button', { class: 'config config-boolean' });
        let currentValue = value;

        if (label) insertElement('label', element, { class: 'switch-label' }, label);
        const switchButton = insertElement('div', element, { class: 'switch', 'data-value': currentValue });
        insertElement('div', switchButton, { class: 'switch-background' });
        insertElement('div', switchButton, { class: 'switch-button' });

        const setValue = newValue => {
            if (currentValue === newValue) return;
            onchange({ oldValue: currentValue, newValue });
            currentValue = newValue;
            switchButton.setAttribute('data-value', newValue);
        };
        const toggleValue = () => setValue(!currentValue);

        element.addEventListener('click', toggleValue, { passive: true });

        return { element, setValue };
    }

    static #genList({ onchange, value, options, labels = {}, tags = {}, label = '' }) {
        const element = createElement('div', { class: 'config config-list' });
        let currentValue = value;
        const list = {};
        const listElements = {};
        options.forEach(key => list[key] = labels[key] ?? key);
        let listVisible = false, focusIndex = 0, displayedList = [], forceReturnFocus = false, isClicking = false;

        const selectedOptionElement = insertElement('div', element, { class: 'list-selected' }, label ? `${label}: ` : '');
        const searchInput = insertElement('input', element, { type: 'text', class: 'list-search', hidden: '' });
        const selectedOptionTitle = insertElement('span', selectedOptionElement, undefined, list[currentValue] ?? currentValue);
        selectedOptionElement.appendChild(getIcon('arrow_down'));
        const optionsListElement = insertElement('div', element, { class: 'list-options', tabindex: -1 });
        const searchQueryRegex = /[ \|-]/g;
        options.forEach((key, index) => {
            const element = insertElement('div', optionsListElement, { class: 'list-option', 'data-option': key });
            const span = insertElement('span', element, undefined, list[key]);
            const text = list[key] || '';
            const optionTags = [ text, key, ...(tags[key] || []) ];
            const tagLabels = {};
            const searchTags = [];
            optionTags.forEach(label => {
                const tag = label.toLowerCase().replace(searchQueryRegex, '_');
                tagLabels[tag] = label;
                searchTags.push(tag);
            });
            const searchText = searchTags.join('||');
            listElements[key] = { element, index, span, text, tagLabels, searchTags, searchText };
        });
        focusIndex = listElements[currentValue]?.index ?? -1;
        listElements[currentValue]?.element.classList.add('option-selected');

        const searchForText = (q = '') => {
            q = q.toLowerCase().replace(searchQueryRegex, '_');
            searchInput.toggleAttribute('hidden', !q);
            const currentIndex = listElements[displayedList[focusIndex]]?.index ?? null;
            if (q) {
                displayedList = Object.keys(listElements).filter(key => {
                    const item = listElements[key];
                    const index = item.searchText.indexOf(q);
                    if (index === -1) {
                        item.element.setAttribute('hidden', '');
                        return false;
                    }

                    if (index < item.text.length) {
                        item.span.textContent = '';
                        const text = item.text;
                        const startText = text.substring(0, index);
                        if (startText) item.span.appendChild(document.createTextNode(startText));
                        const postText = text.substring(index + q.length);
                        insertElement('mark', item.span, undefined, text.substring(index, index + q.length));
                        if (postText) item.span.appendChild(document.createTextNode(postText));
                        item.element.removeAttribute('hidden');
                        return true;
                    }

                    const matchedTag = item.searchTags.find(t => t.startsWith(q));
                    if (!matchedTag) {
                        item.element.setAttribute('hidden', '');
                        return false;
                    }

                    item.span.textContent = item.text;
                    insertElement('div', item.span, { class: 'list-tag' }, item.tagLabels[matchedTag]);

                    item.element.removeAttribute('hidden');
                    return true;
                });
            }
            else {
                displayedList = Object.keys(listElements);
                optionsListElement.querySelectorAll('.list-option[hidden]').forEach(el => el.removeAttribute('hidden'));
                displayedList.forEach(key => {
                    listElements[key].span.textContent = list[key];
                });
            }

            focusIndex = displayedList.indexOf(currentValue);
            if (focusIndex < 0) focusIndex = 0;
            if (currentIndex !== null && currentIndex !== listElements[displayedList[focusIndex]]?.index) setFakeFocus();
        };
        const scrollToOption = option => optionsListElement.scrollTo({ top: option.offsetTop - optionsListElement.offsetHeight/2 + option.offsetHeight/2 });
        const setFakeFocus = () => {
            const key = displayedList[focusIndex];
            if (listElements[key]) scrollToOption(listElements[key].element);
            optionsListElement.querySelector('.option-focus')?.classList.remove('option-focus');
            listElements[key]?.element.classList.add('option-focus');
        };
        const onfocus = e => {
            if (listVisible) return;
            optionsListElement.classList.add('list-visible');
            selectedOptionElement.classList.add('list-visible');
            if (!isClicking) selectedOptionElement.classList.add('keyboard-focus');
            searchInput.value = '';
            optionsListElement.querySelector('.option-focus')?.classList.remove('option-focus');
            searchForText();
            if (listElements[currentValue]) scrollToOption(listElements[currentValue].element);
            listVisible = true;
            isClicking = false;
        };
        const onfocusout = e => {
            if (forceReturnFocus) {
                forceReturnFocus = false;
                searchInput.focus();
                return;
            }
            if (!listVisible) return;
            optionsListElement.classList.remove('list-visible');
            selectedOptionElement.classList.remove('list-visible');
            selectedOptionElement.classList.remove('keyboard-focus');
            searchInput.setAttribute('hidden', '');
            listVisible = false;
            isClicking = false;
        };
        const onkeydown = e => {
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                focusIndex = (focusIndex + 1) % displayedList.length;
                setFakeFocus();
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                focusIndex = focusIndex > 0 ? (focusIndex - 1) % displayedList.length : displayedList.length - 1;
                setFakeFocus();
            } else if (e.code === 'Enter') {
                e.preventDefault();
                const key = displayedList[focusIndex];
                if (listElements[key]) {
                    setValue(displayedList[focusIndex]);
                    element.blur();
                    onfocusout(e);
                }
            } else if (e.code === 'Escape') {
                element.blur();
                onfocusout(e);
            } else forceReturnFocus = Boolean(e.code === 'Backspace');
        };
        const oninput = () => searchForText(searchInput.value);
        const onclick = e => {
            const key = e.target.closest('.list-option[data-option]')?.getAttribute('data-option');
            if (key) {
                setValue(key);
                element.blur();
                onfocusout(e);
            }
        };
        const oppointerdown = e => {
            e.preventDefault();
        };

        const setValue = newValue => {
            if (currentValue === newValue) return;
            onchange({ oldValue: currentValue, newValue });
            listElements[currentValue]?.element.classList.remove('option-selected');
            listElements[newValue]?.element.classList.add('option-selected');
            currentValue = newValue;
            selectedOptionTitle.textContent = list[newValue] ?? newValue;
        };

        searchInput.addEventListener('focus', onfocus);
        searchInput.addEventListener('focusout', onfocusout);
        searchInput.addEventListener('keydown', onkeydown);
        searchInput.addEventListener('input', oninput);
        element.addEventListener('pointerdown', oppointerdown); // Disable focus loss before click event when mouse is pressed
        optionsListElement.addEventListener('click', onclick);
        selectedOptionElement.addEventListener('click', () => {
            isClicking = true;
            if (listVisible) searchInput.blur();
            else searchInput.focus();
        });

        return { element, setValue };
    }

    static #genStringInput({ onchange, value = '', placeholder = 'string', maxlength, multiline = false }) {
        const element = createElement('div', { class: 'config config-string' });
        let currentValue = value;

        const inputElement = multiline
            ? insertElement('textarea', element, { class: 'string-input textarea-input', placeholder })
            : insertElement('input', element, { type: 'text', class: 'string-input', placeholder });
        
        const invisibleString = multiline ? null : insertElement('div', element, { class: 'invisible-string string-input' });

        if (maxlength) inputElement.setAttribute('maxlength', maxlength);
        inputElement.value = currentValue;
        if (invisibleString) invisibleString.textContent = currentValue;

        const setValue = newValue => {
            if (currentValue === newValue) return;
            onchange({ oldValue: currentValue, newValue });
            currentValue = newValue;
            if (invisibleString) invisibleString.textContent = currentValue;
        };

        const oninput = () => {
            if (maxlength && inputElement.value.length > maxlength) inputElement.value = currentValue;
            else setValue(inputElement.value);
        };

        inputElement.addEventListener('input', oninput, { passive: true });
        inputElement.addEventListener('change', oninput, { passive: true });

        return { element, setValue };
    }

    static #getNearestServerSize(size) {
        // The server can return any requested height and only limits the width to a set of values
        // Anything above 2200 width is returned by the server at the requested width
        const serverWidths = [ 96, 320, 450, 512, 800, 1200, 1600, 2200 ];
        return serverWidths[Math.min((serverWidths.findLastIndex(s => size > s) + 1), serverWidths.length - 1)];
    }

    static #convertNSFWLevelToString(nsfwLevel) {
        return this.#nsfwLevels.string[nsfwLevel] ?? this.#nsfwLevels.sort.find(lvl => lvl.minLevel <= nsfwLevel)?.string ?? 'true';
    }

    // 10000 - 10**4 - precision 4
    static #round(v) {
        return Math.round(v * 10000) / 10000;
    }

    static #onCardRemoved(card, item, preventRemoveItemsFromDOM) {
        const video = card.querySelector('.autoplay-observed');
        if (video) disableAutoPlayOnVisible(video);

        const inVIewportObserved = card.querySelector('.inviewport-observed');
        if (inVIewportObserved) onTargetInViewportClearTarget(inVIewportObserved);

        // Stop loading image if not loaded
        // const img = card.querySelector('img.media-element[src]');
        // if (img && !img.naturalWidth) img.src = '';

        if (preventRemoveItemsFromDOM) return;

        // Reuse user profile images
        const userBlockImage = card.querySelector('.user-info img[src]:not([data-original-active])');
        if (userBlockImage) {
            userBlockImage.remove();
            this.#cachedUserImages.get(userBlockImage.getAttribute('src')).add(userBlockImage);
        }
    }

    static #setTitle(input) {
        const SEPARATOR = '•';
        const ESCAPED_SEP = '·';
        const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200d|\ufe0f/gu;
        const parts = (Array.isArray(input) ? input : [input]).filter(Boolean);
        const cleanedParts = parts.map(part => part.replace(emojiRegex, '').replace(new RegExp(SEPARATOR, 'g'), ESCAPED_SEP).trim());
        const mainContent = cleanedParts.join(` ${SEPARATOR} `);
        document.title = mainContent ? `${mainContent} ${SEPARATOR} ${CONFIG.title}` : CONFIG.title;
    }

    static #saveStateTimer = null;
    static #saveStateRequestTime = null;
    static #saveStateRequestId = null;
    static #saveStateThrottle() {
        const DELAY = 400;

        this.#saveStateRequestTime = Date.now();
        this.#saveStateRequestId = this.#state.id;

        if (this.#saveStateTimer) return;

        const check = () => {
            const now = Date.now();
            const timePassed = now - this.#saveStateRequestTime;

            if (timePassed < DELAY) {
                this.#saveStateTimer = setTimeout(check, DELAY - timePassed);
            } else {
                if (this.#saveStateRequestId === this.#state.id) this.saveState();
                this.#saveStateTimer = null;
            }
        };

        this.#saveStateTimer = setTimeout(check, DELAY);
    }

    static saveState() {
        history.replaceState(this.state, '', this.#page);
    }

    static navigate({ hash, title, soft = false }) {
        if (!hash || hash[0] !== '#') hash = '#home';

        if (title !== undefined) this.#setTitle(title);

        // Replace history state
        if (soft) {
            history.replaceState(this.state, '', hash);
            this.#page = hash;
            return;
        }

        this.saveState();

        // Navigate to page
        const newState = { id: Date.now() };
        if (hash !== location.hash) history.pushState(newState, '', hash);
        this.gotoPage(hash, newState);
    }

    static #log(...args) {
        if (SETTINGS.showLogs) console.log(...args);
    }

    static onScroll(scrollTop = null) {
        if (scrollTop === null) scrollTop = document.documentElement.scrollTop;
        this.#state.scrollTop = scrollTop;

        const scrollReadResults = [];
        for (const item of this.#activeVirtualScroll) {
            const readResult = item.readScroll?.({ scrollTop }) ?? { scrollTop };
            scrollReadResults.push([item, readResult]);
            this.#state[`scrollTopRelative-${item.id}`] = (readResult?.scrollTopRelative ?? readResult) || 0;
        }

        for (const [item, readResult] of scrollReadResults) {
            item.onScroll?.(readResult);
        }

        // When navigating through history, it is not possible to save the state before navigation
        this.#saveStateThrottle();
    }

    static onScrollFromNavigation(state = {}) {
        const scrollTop = state.scrollTop || 0;

        // The scroller may attempt to restore scrolling to its original target, taking into account possible window resizing
        const scrollDeltaMax = this.#activeVirtualScroll.map(item => {
            const scrollTopRelative = state[`scrollTopRelative-${item.id}`] || 0;
            const virtualScrollState = state[`virtualScrollState-${item.id}`] || {};
            const scrollTopRelativeNew = item.onScroll({ scrollTop, scrollTopRelative, ...virtualScrollState });
            const delta = scrollTopRelativeNew - scrollTopRelative;
            return Math.abs(delta) > 10 ? delta : 0;
        }).sort((a, b) => a - b)[0];

        document.documentElement.scrollTo({ top: scrollTop + scrollDeltaMax, behavior: 'instant' });
    }

    static onResize() {
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.#devicePixelRatio = Math.round(window.devicePixelRatio * 100) / 100;

        if (this.windowWidth < 950) CONFIG.appearance = {...CONFIG.appearance_small};
        else CONFIG.appearance = {...CONFIG.appearance_normal};

        if (this.windowWidth < 600) {
            const stretchCard = cardInfo => {
                cardInfo = {...cardInfo};

                const ratio = cardInfo.height ? cardInfo.width / cardInfo.height : null;
                if (this.windowWidth < cardInfo.width * 2 + cardInfo.gap) {
                    cardInfo.width = Math.floor((Math.max(this.windowWidth, 300) - cardInfo.gap * 2) / 50) * 50; // roughen to the nearest multiple of 50
                    if (ratio) cardInfo.height = cardInfo.width / ratio;
                }

                return cardInfo;
            };

            CONFIG.appearance.imageCard = stretchCard(CONFIG.appearance.imageCard);
            CONFIG.appearance.modelCard = stretchCard(CONFIG.appearance.modelCard);
        }

        const resizeReadResults = [];
        for (const item of this.#activeVirtualScroll) {
            resizeReadResults.push([ item, item.readResize?.() ?? {} ]);
        }

        for (const [item, readResult] of resizeReadResults) {
            item.onResize?.(readResult);
        }

        // When navigating through history, it is not possible to save the state before navigation
        this.#saveStateThrottle();
    }

    static get state() {
        const stateCopy = {...this.#state};
        // Get the state of all virtual scrolls
        for (const item of this.#activeVirtualScroll) {
            const virtualScrollState = item.virtualScroll.state || {};
            this.#state[`virtualScrollState-${item.id}`] = virtualScrollState;
            stateCopy[`virtualScrollState-${item.id}`] = {...virtualScrollState};
        }

        return stateCopy;
    }
}

// ==============================

const videPlaybackObservedElements = new Set();
const videPlaybackObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const mediaContainer = entry.target;
        if (entry.isIntersecting) playVideo(mediaContainer, 'data-autoplay');
        else pauseVideo(mediaContainer, 'data-autoplay');
    });
}, { threshold: .35 });

function enableAutoPlayOnVisible(mediaContainer) {
    if (videPlaybackObservedElements.has(mediaContainer)) return;
    mediaContainer.classList.add('autoplay-observed');
    videPlaybackObserver.observe(mediaContainer);
    videPlaybackObservedElements.add(mediaContainer);
}

function disableAutoPlayOnVisible(mediaContainer) {
    videPlaybackObserver.unobserve(mediaContainer);
    videPlaybackObservedElements.delete(mediaContainer);
    mediaContainer.classList.remove('autoplay-observed');
}

const onTargetInViewportCallbacks = new Map();
const onTargetInViewportObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = entry.target;
            onTargetInViewportCallbacks.get(target)?.(target);
            onTargetInViewportClearTarget(target);
        }
    });
}, { threshold: 0.01, rootMargin: '400px 0px' });

function onTargetInViewport(target, callback) {
    target.classList.add('inviewport-observed');
    onTargetInViewportCallbacks.set(target, callback);
    onTargetInViewportObserver.observe(target);
}

function onTargetInViewportClearTarget(target) {
    onTargetInViewportObserver.unobserve(target);
    onTargetInViewportCallbacks.delete(target);
    target.classList.remove('inviewport-observed');
}

function onTargetInViewportClearAll() {
    onTargetInViewportCallbacks.keys().forEach(element => onTargetInViewportClearTarget);
}

function cleanupDetachedObservers() {
    for (const el of videPlaybackObservedElements) {
        if (!document.body.contains(el)) {
            disableAutoPlayOnVisible(el);
        }
    }

    for (const [el] of onTargetInViewportCallbacks) {
        if (!document.body.contains(el)) {
            onTargetInViewportClearTarget(el);
        }
    }
}


function sendMessageToSW(message, sw = navigator.serviceWorker?.controller) {
    return new Promise(resolve => {
        if (!sw) {
            resolve({ ok: false, error: new Error('No active Service Worker') });
            return;
        }

        const channel = new MessageChannel();
        let settled = false;

        channel.port1.onmessage = e => {
            if (settled) return;
            settled = true;

            const data = e?.data ?? {};
            if (data.ok) {
                resolve({ ok: true, response: data.response });
            } else {
                resolve({ ok: false, error: data.error });
            }
        };

        try {
            sw.postMessage(message, [channel.port2]);
        } catch (error) {
            console.error(error);
            resolve({ ok: false, error });
        }
    });
}

// Messages from SW
function onMessage(e) {
    const data = e.data ?? {};
    if (
        data.type === 'CACHE_UPDATED'
        && (data.url === `${location.origin}/` || data.url === `${location.origin}/index.html`)
        && sessionStorage.getItem('civitai-lite-viewer--versionChanged') !== 'true'
    ) {
        sessionStorage.setItem('civitai-lite-viewer--versionChanged', 'true');
        location.reload();
    }
}


const iconsCache = new Map();
function addIconToCache(name, original) {
    const iconName = original ? `__original--${name}` : name;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `icon icon-${name}`);
    svg.setAttribute('aria-hidden', 'true');
    if (original) {
        svg.setAttribute('viewBox', '0 0 24 24');
        Array.from(document.getElementById(name)?.cloneNode(true)?.children).forEach(node => svg.appendChild(node));
        iconsCache.set(iconName, svg);
    } else {
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#${name}`);
        svg.appendChild(use);
        iconsCache.set(iconName, svg);
    }
    return svg.cloneNode(true);
}
function getIcon(name, original = false) {
    const iconName = original ? `__original--${name}` : name;
    return iconsCache.get(iconName)?.cloneNode(true) ?? addIconToCache(name, original);
}


/**
 * RULE FORMAT
 *
 * +tag        → tag must exist
 * -tag        → tag must NOT exist
 * +tag1|tag2  → tag1 OR tag2 must exist
 *
 * Notes:
 * - AND is implicit between blocks
 * - Only '|' is allowed inside a block
 */
function filterItems(items, rules, options = { results: false }) {
    if (!Array.isArray(items) || items.length === 0) return [];
    if (!Array.isArray(rules) || rules.length === 0) return items;

    const getValueByPath = (obj, path) => {
        let cur = obj;
        for (let i = 0; i < path.length && cur != null; i++) {
            cur = cur[path[i]];
        }
        return cur;
    };

    const blocksRegex = /[+\-][^+\-]+/g;
    const compiledRules = rules.map(rule => {
        if (!rule || !Array.isArray(rule.conditions)) return null;

        const parseTag = rule.type === 'number' ? v => Number(v) : v => String(v);

        const conditionMatchers = rule.conditions.map(conditionStr => {
            const blocks = conditionStr.match(blocksRegex);
            if (!blocks) return null;

            const blockMatchers = blocks.map(block => {
                const prefix = block[0];
                const content = block.slice(1).toLowerCase();
                if (!content) return null;

                const tags = content.split('|').filter(Boolean).map(parseTag);
                if (tags.length === 0) return null;

                if (tags.length === 1) {
                    const tag = tags[0];
                    if (prefix === '+') return itemTags => itemTags.includes(tag);
                    if (prefix === '-') return itemTags => !itemTags.includes(tag);
                } else {
                    if (prefix === '+') return itemTags => tags.some(tag => itemTags.includes(tag));
                    if (prefix === '-') return itemTags => !tags.some(tag => itemTags.includes(tag));
                }
            }).filter(Boolean);

            if (blockMatchers.length === 1) return blockMatchers[0];

            // AND between blocks
            return itemTags => blockMatchers.every(fn => fn(itemTags));
        });

        return {
            key: rule.key,
            path: rule.key.includes('.') ? rule.key.split('.') : null,
            conditionMatchers,
            shouldApply: typeof rule.shouldApply === 'function' ? rule.shouldApply : () => true
        };
    }).filter(Boolean);

    const requireAll = options.results ?? false;
    const result = [];
    for(const item of items) {
        let failedRule = null;
        const isFilteredOut = compiledRules.some(rule => {
            if (!rule.shouldApply(item)) return false;

            const rawTags = rule.path ? getValueByPath(item, rule.path) : item[rule.key];
            const tags = Array.isArray(rawTags) ? rawTags : rawTags != null ? [rawTags] : [];

            // OR between condition strings
            for (let i = 0; i < rule.conditionMatchers.length; i++) {
                if (rule.conditionMatchers[i](tags)) {
                    if (requireAll) failedRule = { index: rule.index, key: rule.key, conditionIndex: i };
                    return true;
                }
            }
            return false;
        });

        if (requireAll) {
            result.push({ item, ok: !isFilteredOut, rule: isFilteredOut ? failedRule : null });
        } else if (!isFilteredOut) result.push(item);
    }

    return result;
}


// PLACEHOLDER
// TODO: notifications
function notify(text, icon) {
    console.log('TODO: notifications');
    const div = insertElement('div', document.body, { class: 'notification-placeholder' }, text);
    if (icon) div.prepend(getIcon(icon));
    setTimeout(() => {
        div.remove();
    }, 3000);
}

function loadLanguagePack(language, forceReload = false) {
    if (!CONFIG.langauges.includes(language)) language = 'en';
    const key = `civitai-lite-viewer--languagePack:${language}`;
    const cachedLanguagePack = tryParseLocalStorageJSON(key, {}) ?? {};

    const updateMenu = () => {
        document.querySelector('#language-list li.active')?.classList.remove('active');
        document.querySelector(`#language-list li[data-language="${language}"]`)?.classList.add('active');
        document.documentElement.setAttribute('lang', language);
        Controller.updateMainMenu();
    }

    window.languagePack = cachedLanguagePack.version === CONFIG.version && cachedLanguagePack.language === language ? cachedLanguagePack.languagePack ?? {} : {};
    if (typeof window.languagePack !== 'object' || !Object.keys(window.languagePack).length) {
        fetch(`_locales/${language}/language.json?v=${Number(CONFIG.version)}`)
        .then(response => response.json())
        .then(data => {
            localStorage.setItem(key, JSON.stringify({ languagePack: data, loaded: new Date().toISOString(), version: CONFIG.version, language }));
            window.languagePack = data;
            updateMenu();
            Controller.gotoPage(location.hash || '#home');
        });
    } else {
        updateMenu();
        if (forceReload) Controller.gotoPage(location.hash || '#home');
    }
}

function calcCharsInString(string, char, maxCount = 999) {
    let count = 0;
    let pos = string.indexOf(char);
    while (pos !== -1 && count < maxCount) {
        count++;
        pos = string.indexOf(char, pos + 1);
    }

    return count;
}

function savePageSettings() {
    localStorage.setItem('civitai-lite-viewer--settings', JSON.stringify({ settings: SETTINGS, version: CONFIG.version }));
}

function clearCache(mode = 'old') {
    const data = {};
    if (mode === 'all') {
        data.mode = 'all';
    } else {
        data.mode = 'max-age-expired';
        data.urlMask = [];
        if (!SETTINGS.autoplay) data.urlMask.push('^.*anim=true.*[?&]target=model-card.*[?&]format=webp'); // If autoplay is disabled, remove all animated images
    }
    return sendMessageToSW({ action: 'clear_cache', data }).then(result => result.response);
}

async function performHardCleanup() {
    CONFIG.langauges.forEach(lang => localStorage.removeItem(`civitai-lite-viewer--languagePack:${lang}`));
    localStorage.removeItem('civitai-lite-viewer--time:nextCacheClearTime');
    sessionStorage.setItem('civitai-lite-viewer--cacheCleared', 'true');
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
}

function clearUrlFromLocalParams(url) {
    const urlObj = new URL(url);
    CONFIG.local_params.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
}

function matchLinkDrop(e) {
    const draggedTypes = Array.from(e.dataTransfer.types);
    return draggedTypes.includes('text/uri-list') && !draggedTypes.includes('x-source-type');
}

// Clear old cache (Cleaning every 5 minutes)
let cacheClearTimer = null;
function tryClearCache() {
    try {
        const key ='civitai-lite-viewer--time:nextCacheClearTime';
        const nextCacheClearTime = localStorage.getItem(key) ?? (Date.now() - 1000);
        if (new Date(nextCacheClearTime) < Date.now()) {
            localStorage.setItem(key, new Date(Date.now() + 5 * 60 * 1000).toISOString());
            clearCache('old');
        }
    } catch (_) {
        console.error(_);
    }
}

function onBodyClick(e) {
    if (e.altKey || SETTINGS.civitaiLinksAltClickByDefault) {
        const href = e.target.closest('a[href]:not(.link-open-civitai)')?.getAttribute('href');
        if (href) {
            const { localUrl } = Controller.parseCivUrl(href);
            if (localUrl) {
                e.preventDefault();
                Controller.navigate({ hash: localUrl });
                return;
            }
        }
    }

    if (e.ctrlKey) return;

    const href = e.target.closest('a[href^="#"]:not([target="_blank"])')?.getAttribute('href');
    if (href) {
        e.preventDefault();
        Controller.navigate({ hash: href });
    }
}

function onBodyPointerDown(e) {
    if (e.ctrlKey || e.altKey || (e.pointerType === 'mouse' && e.button !== 0)) return;

    const link = e.target.closest('a[href^="#"]:not([target="_blank"])');
    if (!link) return;

    const href = link.getAttribute('href');

    if (e.pointerType !== 'touch') return Controller.preparePage(href);

    let touchTimer = null;

    const cleanup = () => {
        clearTimeout(touchTimer);
        link.removeEventListener('pointermove', cleanup);
        link.removeEventListener('pointerup', cleanup);
        link.removeEventListener('pointercancel', cleanup);
    };

    touchTimer = setTimeout(() => {
        Controller.preparePage(href);
        touchTimer = null;
    }, 150);

    link.addEventListener('pointermove', cleanup, { once: true });
    link.addEventListener('pointerup', cleanup, { once: true });
    link.addEventListener('pointercancel', cleanup, { once: true });
}

// TODO: check for animation in images
function onBodyPointerOver(e) {
    // tooltips
    const lilpipe = e.target.closest('[lilpipe-text]:not([lilpipe-showed]):not([lilpipe-showed-delay])');
    if (lilpipe) {
        e.eventTarget = lilpipe;
        return startLilpipeEvent(e);
    }

    // link previews
    if (e.altKey) {
        const preview = e.target.closest('[data-link-preview]:not([lilpipe-showed]):not([lilpipe-showed-delay])');
        if (preview) {
            e.eventTarget = preview;
            return startLinkPreviewEvent(e);
        }
    }

    // videos
    const videoPLayback = e.target.closest('.video-hover-play');
    if (videoPLayback) startVideoPlayEvent(videoPLayback);

    // images
    // TODO: Right now it just tries to load the animated version anyway, even when it's useless... add some checks
    // const imageAnimationPLay = e.target.closest('.image-hover-play');
    // if (imageAnimationPLay) showOriginalImage(imageAnimationPLay);
}

function onBodyFocus(e) {
    // tooltips
    const lilpipe = e.target.closest('[lilpipe-text]:not([lilpipe-showed]):not([lilpipe-showed-delay])');
    if (lilpipe) {
        e.eventTarget = lilpipe;
        return startLilpipeEvent(e, { fromFocus: true });
    }

    // link previews
    // const preview = e.target.closest('[data-link-preview]:not([lilpipe-showed]):not([lilpipe-showed-delay])');
    // if (preview) {
    //     e.eventTarget = preview;
    //     return startLinkPreviewEvent(e, { fromFocus: true });
    // }

    // videos
    const videoPLayback = e.target.closest('.video-hover-play');
    if (videoPLayback) startVideoPlayEvent(videoPLayback, { fromFocus: true });

    // images
    // const imageAnimationPLay = e.target.closest('.image-hover-play');
    // if (imageAnimationPLay) showOriginalImage(imageAnimationPLay);
}

function onVisibilityChange() {
    const isVisible = !document.hidden;
    if (isVisible) {
        Array.from(document.querySelectorAll('.media-container[data-autoplay] video'))
        .forEach(video => {
            if (!video._wasPlaying) return;
            video.play().catch(() => null);
            video._wasPlaying = false;
        });
        if (!cacheClearTimer) {
            tryClearCache();
            cacheClearTimer = setInterval(tryClearCache, 60000);
        }
    } else {
        Array.from(document.querySelectorAll('.media-container[data-autoplay] video'))
        .forEach(video => {
            if (video.paused) video._wasPlaying = false;
            else {
                video.pause();
                video._wasPlaying = true;
            }
        });
        document.querySelectorAll('.media-container[data-focus-play-timer]').forEach(v => v.removeAttribute('data-focus-play-timer'));
        document.querySelectorAll('.media-container[data-focus-play]').forEach(v => stopVideoPlayEvent({target: v.closest('.video-hover-play')}));
        if (cacheClearTimer) {
            clearInterval(cacheClearTimer);
            cacheClearTimer = null;
        }
    }
}

function languageToggleClick(e) {
    if (e.target.closest('#language-button')) {
        document.getElementById('language-list').classList.toggle('hidden');
        document.querySelectorAll('#language-list li img[data-src]').forEach(img => {
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
        });
        return;
    }

    const li = e.target.closest('#language-list li[data-language]');
    if (li) {
        const language = li.getAttribute('data-language');
        SETTINGS.language = CONFIG.langauges.includes(language) ? language : 'en';
        savePageSettings();
        loadLanguagePack(SETTINGS.language, true);
        document.getElementById('language-list').classList.add('hidden');
        return;
    }
}

const pendingMedia = new Map();
let batchTimer = null;
function markMediaAsLoadedWhenReady(el, isOk = true) {
    if (!el.parentElement?.classList.contains('loading') && !el.parentElement?.classList.contains('error')) return;

    pendingMedia.set(el, isOk);

    if (batchTimer) return;
    batchTimer = requestAnimationFrame(() => {
        batchTimer = null;
        const readyImages = [];
        const instantMedia = [];

        for (const [media, ok] of pendingMedia) {
            if (!media.isConnected) continue;
            if (media.tagName === 'IMG') readyImages.push([media, ok]);
            else instantMedia.push([media, ok]);
        }
        pendingMedia.clear();

        // videos
        for (const [media, ok] of instantMedia) {
            const parent = media.parentElement;
            if (!parent) continue;

            parent.classList.remove('loading');
            parent.classList.toggle('error', !ok);
            if (ok) {
                // parent.style.backgroundColor = '';
                parent.style.backgroundImage = '';
            }
        }

        // images (Waiting to eliminate possible flickering)
        if (readyImages.length) {
            setTimeout(() => {
                requestAnimationFrame(() => {
                    for (const [img, ok] of readyImages) {
                        if (!img.isConnected) continue;

                        const parent = img.parentElement;
                        if (!parent) continue;

                        parent.classList.remove('loading');
                        parent.classList.toggle('error', !ok);
                        if (ok) {
                            // parent.style.backgroundColor = '';
                            parent.style.backgroundImage = '';
                        }
                    }
                });
            }, 180);
        }
    });
}
function onMediaElementLoaded(e) {
    const tag = e.target.tagName;
    if (tag !== 'IMG' && tag !== 'VIDEO') return;
    markMediaAsLoadedWhenReady(e.target, e.type !== 'error');
}

let isPageScrolled = false;
function onScroll() {
    const scrollTop = document.documentElement.scrollTop;
    Controller.onScroll(scrollTop);

    if (scrollTop > 200) {
        if (!isPageScrolled) {
            isPageScrolled = true;
            document.body.classList.add('page-scrolled');
        }
    } else if (isPageScrolled) {
        isPageScrolled = false;
        document.body.classList.remove('page-scrolled');
    }
}

function onResize() {
    Controller.onResize();
}

function onPopState(e) {
    const savedState = e.state;
    const hash = location.hash || '#home';
    Controller.gotoPage(hash, savedState);
}

function onDragstart_setDragCanvas(e, original) {
    const ghost = createElement('canvas', { class: 'drag-ghost-container drag-ghost-image' });
    const width = original.naturalWidth || original.videoWidth;
    const height = original.naturalHeight || original.videoHeight;
    const scale = Math.min(200 / Math.max(width, height), 1);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    ghost.style.width = `${scaledWidth}px`;
    ghost.style.height = `${scaledHeight}px`;
    ghost.width = scaledWidth;
    ghost.height = scaledHeight;

    // draw small image
    const ctx = ghost.getContext('2d', { alpha: true });
    ctx.drawImage(original, 0, 0, scaledWidth, scaledHeight);

    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(ghost, Math.round(scaledWidth / 2), Math.round(scaledHeight / 2));
    setTimeout(() => ghost.remove(), 0);
}

function onDragstart(e) {
    const link = e.target.closest('a');
    if (link) {
        const title = link.getAttribute('data-draggable-title') || link.textContent.trim();
        const href = link.href;

        // Apply default browser behavior for dragging links
        e.dataTransfer.setData('text/plain', title);
        e.dataTransfer.setData('text/uri-list', href);
        e.dataTransfer.setData('text/html', `<a href="${href}">${escapeHtml(title)}</a>`);
        e.dataTransfer.dropEffect = 'link';

        // Show ghost bubble with title
        const ghost = createElement('div', { class: 'drag-ghost-container drag-ghost-link' });

        let dragIcon = null;
        const originalImg = link.querySelector('.media-container:not(.loading) img[src]');
        if (originalImg) {
            dragIcon = originalImg.cloneNode(true);
            dragIcon.className = 'drag-ghost-img';
            ghost.appendChild(dragIcon);
        } else {
            const originalMedia = link.querySelector('.media-container.loading');
            const backgroundImage = originalMedia?.style.backgroundImage;
            if (backgroundImage) {
                dragIcon = insertElement('div', ghost, { class: 'drag-ghost-img loading', style: `background-image: ${backgroundImage};` });
            }
        }

        const infoWrapper = insertElement('div', ghost, { class: 'drag-ghost-info' });
        if (title && title !== href) insertElement('div', infoWrapper, { class: 'drag-ghost-title' }, title);
        else infoWrapper.classList.add('info-only-url');
        const urlElement = insertElement('div', infoWrapper, { class: 'drag-ghost-url' });

        try {
            const url = new URL(href);
            if (url.origin === location.origin) {
                if (url.pathname !== '/') {
                    insertElement('span', urlElement, { class: 'darker-text' }, url.pathname);
                }

                if (url.hash) {
                    insertElement('b', urlElement, { class: 'light-text' }, '#');
                    insertElement('span', urlElement, undefined, url.hash.substring(1));
                } 

                if (url.pathname === '/' && !url.hash) {
                    insertElement('span', urlElement, { class: 'darker-text' }, '/');
                }

                if (!dragIcon) {
                    dragIcon = getIcon('civitai');
                    dragIcon.classList.add('drag-ghost-img', 'img-small');
                    ghost.prepend(dragIcon);
                }
            } else {
                if (url.protocol === 'https:') {
                    insertElement('span', urlElement, { class: 'darker-text' }, `${url.protocol}//`);
                } else {
                    insertElement('span', urlElement, { class: 'warning-text' }, url.protocol);
                    insertElement('span', urlElement, { class: 'darker-text' }, '//');
                }
                insertElement('b', urlElement, undefined, url.host);
                insertElement('span', urlElement, { class: 'darker-text' }, `${url.pathname + url.search}`);
            }
        } catch (_) {
            urlElement.textContent = href;
        }

        document.body.appendChild(ghost);

        e.dataTransfer.setDragImage(ghost, Math.round(ghost.offsetWidth / 2), Math.round(ghost.offsetHeight / 2));
        setTimeout(() => ghost.remove(), 0);
        return;
    }

    if (e.target.tagName === 'IMG') {
        const original = e.target;

        // Apply default browser behavior for dragging images
        // (The browser may try to place the "Files" field itself, so there is no point in canceling it on error)
        try {
            const url = new URL(original.src);
            const clearUrl = clearUrlFromLocalParams(url);
            e.dataTransfer.setData('text/uri-list', clearUrl);
            // e.dataTransfer.setData('DownloadURL', `image/webp:${url.pathname.split('/').at(-1)}:${clearUrl}`); // work weird
            e.dataTransfer.setData('x-source-type', 'image');
        } catch (_) {}

        onDragstart_setDragCanvas(e, original);
        return;
    }

    if (e.target.tagName === 'VIDEO') {
        const original = e.target;

        // Disable dragging when interacting with controls
        if (original.hasAttribute('controls') && e.offsetY > original.clientHeight - 80) return e.preventDefault();

        // Apply default browser behavior for dragging images
        try {
            const url = new URL(original.src);
            const clearUrl = clearUrlFromLocalParams(url);
            e.dataTransfer.setData('text/uri-list', clearUrl);
            // The browser itself does not place the "Files" field when dragging a video, so let it at least download it if necessary
            e.dataTransfer.setData('DownloadURL', `video/webp:${url.pathname.split('/').at(-1)}:${clearUrl}`);
            e.dataTransfer.setData('x-source-type', 'video');
        } catch (_) {
            return e.preventDefault();
        }

        onDragstart_setDragCanvas(e, original);
        return;
    }
}

function onDragover(e) {
    const match = matchLinkDrop(e);
    if (match) e.preventDefault();
}

function onDrop(e) {
    const match = matchLinkDrop(e);
    if (!match) return;
    e.preventDefault();

    document.body.classList.remove('drop-hover');
    document.getElementById('drop-link-container').classList.remove('drop-hover');

    const target = e.target.closest('#drop-link-container');
    if (!target) return;

    const dt = e.dataTransfer;
    const href = dt.getData('text/uri-list');
    const { localUrl } = Controller.parseCivUrl(href);
    if (!localUrl) {
        try {
            const url = new URL(href);
            if (url.origin !== location.origin) throw new Error('Unsupported url');
            Controller.navigate({ hash: url.hash });
        } catch (_) {
            notify('Unsupported url');
        }
        return;
    }

    Controller.navigate({ hash: localUrl });
}

function onDragenter(e) {
    const match = matchLinkDrop(e);
    if (!match) return;
    e.preventDefault();

    document.body.classList.add('drop-hover');
    const dropLinkContainer = document.getElementById('drop-link-container');
    if (dropLinkContainer.contains(e.target)) dropLinkContainer.classList.add('drop-hover');
}

function onDragleave(e) {
    const dropLinkContainer = document.getElementById('drop-link-container');
    if (!dropLinkContainer.contains(e.relatedTarget)) dropLinkContainer.classList.remove('drop-hover');
    if (document.body.contains(e.relatedTarget)) return;
    const match = matchLinkDrop(e);
    if (!match) return;
    e.preventDefault();

    document.body.classList.remove('drop-hover');
}

function playVideo(mediaContainer, attrCheck = 'data-focus-play') {
    if (mediaContainer.hasAttribute(attrCheck)) return;
    mediaContainer.setAttribute(attrCheck, '');

    const src = mediaContainer.getAttribute('data-src');
    const timestump = mediaContainer.getAttribute('data-timestump');

    const video = createElement('video', { class: 'media-element',  muted: '', loop: '', crossorigin: 'anonymous', draggable: 'true' });
    video.volume = 0;
    video.muted = true;
    video.loop = true;
    if (mediaContainer.hasAttribute('data-playsinline')) video.playsinline = true;
    if (mediaContainer.hasAttribute('data-controls')) video.controls = true;

    video.setAttribute('src', src);
    video.currentTime = +timestump;
    video.play().catch(() => null);

    return new Promise(resolve => {
        const canplayEventName = +timestump > 0 ? 'seeked' : 'canplay';
        const play = e => {
            video.removeEventListener(canplayEventName, play);
            video.removeEventListener('error', play);
            if (!mediaContainer.hasAttribute(attrCheck)) {
                video.src = '';
                resolve();
                return;
            }

            mediaContainer.classList.toggle('error', e.type === 'error');
            const mediaElement = mediaContainer.querySelector('.media-element:not([inert])');
            video.style.cssText = mediaElement.style.cssText;
            mediaElement.replaceWith(video);
            resolve();
        };

        video.addEventListener(canplayEventName, play, { once: true });
        video.addEventListener('error', play, { once: true });
    });
}

function pauseVideo(mediaContainer, attrCheck = 'data-focus-play') {
    if (!mediaContainer.hasAttribute(attrCheck)) return;
    mediaContainer.removeAttribute(attrCheck);

    const video = mediaContainer.querySelector('video:not([inert])');
    if (!video) return;

    video.pause();

    // Resize if enabled
    let { videoWidth: width, videoHeight: height } = video;
    let cropWidth = width, cropHeight = height, offsetX = 0, offsetY = 0, targetWidth = width, targetHeight = height;
    if (mediaContainer.hasAttribute('data-resize')) {
        ([ targetWidth, targetHeight ] = mediaContainer.getAttribute('data-resize').split(':').map(Number));
        const newRatio = targetWidth / targetHeight;
        cropWidth = Math.min(width, Math.round(height * newRatio));
        cropHeight = Math.min(height, Math.round(width / newRatio));
        offsetX = Math.round((width - cropWidth) / 2);
        offsetY = Math.round((height - cropHeight) / 2);
    }

    const canvas = createElement('canvas', { class: 'media-element', width: targetWidth, height: targetHeight });
    canvas.style.cssText = video.style.cssText;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, offsetX, offsetY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
    mediaContainer.setAttribute('data-timestump', video.currentTime);
    video.replaceWith(canvas);
}

function showOriginalImage(target) {
    const images = target.querySelectorAll('img.image-possibly-animated:not([data-original-active])');
    if (!images.length) return;

    const hideOriginalImage = () => {
        target.removeEventListener('blur', hideOriginalImage);
        target.removeEventListener('pointerleave', hideOriginalImage);

        images.forEach(img => {
            if (!img.isConnected) return;

            if (img.hasAttribute('data-replaced-src')) {
                replaceImageElement(img, img.getAttribute('data-replaced-src'), {
                    saveReplacedSrc: false,
                    checkAttrAdded: '',
                    checkAttrRemoved: 'data-original-active data-original-loading'
                });

                img.removeAttribute('data-replaced-src');
                img.removeAttribute('data-original-active');
            }
        });
    };

    images.forEach(img => {
        if (!img.isConnected) return;

        const src = img.getAttribute('src');
        const originalSrc = src.includes('?') ? `${src}&original=true` : `${src}?original=true`;

        replaceImageElement(img, originalSrc, {
            saveReplacedSrc: true,
            checkAttrAdded: 'data-original-active',
            checkAttrRemoved: 'data-original-loading'
        });
    });

    target.addEventListener('blur', hideOriginalImage, { passive: true });
    target.addEventListener('pointerleave', hideOriginalImage, { passive: true });
}

function replaceImageElement(img, newUrl, options) {
    const { saveReplacedSrc, checkAttrAdded, checkAttrRemoved } = options;

    if (!img.isConnected) return;

    img.setAttribute('data-original-loading', newUrl);

    const loader = new Image();
    loader.onload = () => {
        if (!img.isConnected) return;
        if (img.getAttribute('data-original-loading') !== newUrl) return;

        if (saveReplacedSrc && !img.hasAttribute('data-replaced-src')) {
            img.setAttribute('data-replaced-src', img.src);
        }

        img.setAttribute('src', newUrl);

        if (checkAttrAdded) img.setAttribute(checkAttrAdded, 'true');
        if (checkAttrRemoved) {
            checkAttrRemoved.split(/\s+/).forEach(attr => img.removeAttribute(attr));
        }
    };

    loader.onerror = () => {
        if (img.getAttribute('data-original-loading') === newUrl) {
            img.removeAttribute('data-original-loading');
        }
    };

    loader.src = newUrl;
}

function startVideoPlayEvent(target, options = { fromFocus: false }) {
    const selector = '.media-container[data-src][data-poster][data-timestump]:not([data-focus-play]):not([data-focus-play-timer])';
    const container = target.matches(selector) ? target : target.querySelector(selector);
    if (!container) return;

    document.querySelectorAll('.media-container[data-focus-play-timer]').forEach(v => v.removeAttribute('data-focus-play-timer'));
    document.querySelectorAll('.media-container[data-focus-play]').forEach(v => stopVideoPlayEvent({target: v.closest('.video-hover-play')}));

    container.setAttribute('data-focus-play-timer', '');

    // Delay to avoid starting loading when it is not needed, for example the user simply moved the mouse over
    setTimeout(() => {
        if (!container.hasAttribute('data-focus-play-timer')) return;

        playVideo(container, 'data-focus-play');
    }, 250);

    target.addEventListener('blur', stopVideoPlayEvent, { passive: true });
    target.addEventListener('pointerleave', stopVideoPlayEvent, { passive: true });
}

function stopVideoPlayEvent(e) {
    const selector = '.media-container[data-focus-play-timer]';
    const container = e.target.matches(selector) ? e.target : e.target.querySelector(selector);
    if (container) {
        container.removeAttribute('data-focus-play-timer');
        pauseVideo(container, 'data-focus-play');
    }
    e.target.removeEventListener('blur', stopVideoPlayEvent);
    e.target.removeEventListener('pointerleave', stopVideoPlayEvent);
}

function startLinkPreviewEvent(e, options = { fromFocus: false }) {
    const target = e.eventTarget;
    const result = Controller.createLinkPreview(target.getAttribute('href'));

    if (!result) {
        target.removeAttribute('data-link-preview');
        return;
    }

    const previewElement = createElement('div', { class: 'link-preview loading', inert: '' });
    previewElement.appendChild(Controller.genLoadingIndecator());
    let positionTarget = target.querySelector('.link-preview-position');

    const showPreview = element => {
        previewElement.classList.remove('loading');
        previewElement.textContent = '';
        previewElement.appendChild(element);
    };

    if (result instanceof Promise) {
        result.then(element => {
            if (!document.body.contains(previewElement) || !target.hasAttribute('lilpipe-showed')) return;
            showPreview(element);
            startLilpipeEvent(e, { fromFocus: options.fromFocus, type: 'link-preview', element: previewElement, delay: 0, positionTarget }); // update position
        });
    } else {
        showPreview(result);
    }

    startLilpipeEvent(e, { fromFocus: options.fromFocus, type: 'link-preview', element: previewElement, delay: 0, positionTarget });
}

let prevLilpipeEvenetTime = 0, prevLilpipeTimer = null;
function startLilpipeEvent(e, options = { fromFocus: false, type: null, element: null, delay: null, positionTarget: null }) {
    const target = e.eventTarget;
    const animationDuration = 150;

    if (prevLilpipeTimer !== null) clearTimeout(prevLilpipeTimer);
    prevLilpipeTimer = null;

    // Prepare tooltip
    const type = options.type || target.getAttribute('lilpipe-type') || 'default';
    const tooltip = createElement('div', { id: 'tooltip', class: `tooltip tooltip-${type}` });

    if (options.element && options.element instanceof HTMLElement) tooltip.appendChild(options.element);
    else tooltip.innerHTML = target.getAttribute('lilpipe-text') || '';

    const positionTarget = options.positionTarget && target.contains(options.positionTarget) ? options.positionTarget : target;
    const render = () => {
        // Remove old tooltip
        document.getElementById('tooltip')?.remove();
        document.querySelectorAll('[lilpipe-showed],[lilpipe-showed-delay]')?.forEach(item => {item.removeAttribute('lilpipe-showed-delay'); item.removeAttribute('lilpipe-showed')});

        // Append new tooltip
        target.setAttribute('lilpipe-showed', '');
        const parent = target.closest('dialog') ?? document.body;
        parent.appendChild(tooltip);

        // Place new tooltip
        const tH = Math.ceil(tooltip.offsetHeight);
        const tW = Math.ceil(tooltip.offsetWidth);
        const wW = window.innerWidth;
        const wH = window.innerHeight;

        let rect = positionTarget.getBoundingClientRect();
        const style = window.getComputedStyle(positionTarget);

        if (style.display === 'inline') {
            const rects = positionTarget.getClientRects();
            if (rects.length > 1) {
                const cX = e.clientX;
                const cY = e.clientY;
                let minDistance = Infinity;
                let closestRect = rects[0];

                for (const r of rects) {
                    const centerX = r.left + r.width / 2;
                    const centerY = r.top + r.height / 2;
                    const distance = Math.pow(cX - centerX, 2) + Math.pow(cY - centerY, 2);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestRect = r;
                    }
                }
                rect = closestRect;
            }
        }

        const targetX = rect.left + rect.width/2 - tW/2;
        const targetY = rect.top - tH - 8;
        const isBelow = targetY < 0 && rect.top < wH - rect.bottom;
        const newX = targetX < 0 ? 0 : targetX + tW > wW ? wW - tW - 8 : targetX;
        const newY = isBelow ? rect.top + rect.height + 8 : targetY;
        const offsetX = targetX - newX;

        tooltip.style.cssText = `left: ${newX}px; top: ${newY}px;${offsetX === 0 ? '' : ` --offsetX: ${offsetX}px;`}`;
        if (isBelow) tooltip.setAttribute('tooltip-below', '');

        // Animate new tooltip
        tooltip.setAttribute('data-animation', 'in');
        setTimeout(() => {
            if (document.body.contains(tooltip) && tooltip.getAttribute('data-animation') === 'in') tooltip.removeAttribute('data-animation');
        }, animationDuration);
    };

    const delay = e.altKey || options.fromFocus ? 0 : typeof options.delay === 'number' ? options.delay : Number(target.getAttribute('lilpipe-delay') ?? 400);
    if (delay > 0 && Date.now() - prevLilpipeEvenetTime > 400) {
        target.setAttribute('lilpipe-showed-delay', '');
        prevLilpipeTimer = setTimeout(() => {
            prevLilpipeTimer = null;
            if (!document.body.contains(target) || !target.hasAttribute('lilpipe-showed-delay')) return;

            target.removeAttribute('lilpipe-showed-delay');
            render();
        }, delay);
    } else render();

    const onpointerleave = e => {
        if (prevLilpipeTimer !== null) clearTimeout(prevLilpipeTimer);
        else prevLilpipeEvenetTime = Date.now();

        target.removeEventListener('blur', onpointerleave);
        target.removeEventListener('pointerleave', onpointerleave);
        window.removeEventListener('scroll', onpointerleave);

        target.removeAttribute('lilpipe-showed');
        if (delay) target.removeAttribute('lilpipe-showed-delay');
        if (e.type === 'scroll') {
            tooltip.remove?.();
            return;
        }
        tooltip.setAttribute('data-animation', 'out');
        setTimeout(() => tooltip.remove?.(), 100);
    };

    if (options.fromFocus) target.addEventListener('blur', onpointerleave, { passive: true,  once: true, capture: true });
    else target.addEventListener('pointerleave', onpointerleave, { passive: true,  once: true });
    window.addEventListener('scroll', onpointerleave, { passive: true, once: true });
}

// Start loading what will be needed for display before the body is ready
if (navigator.serviceWorker.controller !== null) Controller.preparePage(location.hash || '#home');

// =================================
// init not in defer and not at the end of the document,
// because this is the only way to make changes to the body BEFORE rendering,
// and avoid a language jump or crooked display

function init() {
    if (navigator.serviceWorker.controller === null) {
        console.log('"SW === null", probably a hard page reload, cache clearing and page reload is starting');
        if (sessionStorage.getItem('civitai-lite-viewer--cacheCleared') !== 'true') {
            performHardCleanup().then(() => location.reload()); // reload page (sw is critical)
            return;
        } else {
            console.error('Something went wrong, SW is not ready and the page has already been reloaded...');
            document.getElementById('app').textContent = 'Something went wrong...';
            notify('Something went wrong...', 'cross');
            return;
        }
    } else {
        if (sessionStorage.getItem('civitai-lite-viewer--cacheCleared')) {
            sessionStorage.removeItem('civitai-lite-viewer--cacheCleared');
            notify('Cache clear', 'check');
        }
    }

    Controller.appElement = document.getElementById('app');
    loadLanguagePack(SETTINGS.language);

    const initialHash = location.hash || '#home';

    // TEMP // TODO: normal solution
    if (initialHash.startsWith('#images') && initialHash.includes('image=')) document.getElementsByTagName('header')[0]?.setAttribute('data-format', 'mini');

    Controller.gotoPage(initialHash);
    Controller.navigate({ hash: initialHash, soft: true });
    Controller.onResize();

    if (!document.hidden) {
        tryClearCache();
        cacheClearTimer = setInterval(tryClearCache, 60000);
    }

    // Fix browser attempts to restore scrolling until an element is ready when navigating through history
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    // rAF test (the browser seems to do this itself, but I need to check)
    // const rAFlist = {};
    // const rAFcreateCallback = (id, callback) => {
    //     return e => {
    //         if (rAFlist[id]) {
    //             console.log('skip (rAF)', id);
    //             return;
    //         }
    //         rAFlist[id] = requestAnimationFrame(() => {
    //             rAFlist[id] = null;
    //             callback();
    //         });
    //     };
    // };

    document.body.addEventListener('click', onBodyClick);
    document.body.addEventListener('pointerdown', onBodyPointerDown, { passive: true });
    document.body.addEventListener('focus', onBodyFocus, { capture: true, passive: true });
    document.body.addEventListener('pointerover', onBodyPointerOver, { passive: true });
    document.body.addEventListener('dragover', onDragover);
    document.body.addEventListener('drop', onDrop);
    document.body.addEventListener('dragenter', onDragenter);
    document.body.addEventListener('dragleave', onDragleave);
    document.addEventListener('load', onMediaElementLoaded, { capture: true, passive: true });
    document.addEventListener('canplay', onMediaElementLoaded, { capture: true, passive: true });
    document.addEventListener('error', onMediaElementLoaded, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
    document.addEventListener('dragstart', onDragstart);
    document.addEventListener('scroll', onScroll, { passive: true });
    // document.addEventListener('scroll', rAFcreateCallback('scroll', onScroll), { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    // window.addEventListener('resize', rAFcreateCallback('resize', onResize), { passive: true });
    window.addEventListener('popstate', onPopState, { passive: true });
    document.getElementById('language-toggle')?.addEventListener('click', languageToggleClick, { passive: true });
    navigator.serviceWorker.addEventListener('message', onMessage);
}

(function waitForBody() {
    const bodyIsReady = () => {
        if (navigator.serviceWorker.controller) return init();

        // Wait for SW to start if not active (avoid clearing cache on first opening)
        Promise.race([
            new Promise(resolve => {
                navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true });
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 250))
        ]).then(init);
    };
    if (document.body && document.getElementById('svg-symbols')) return bodyIsReady();
    new MutationObserver((_, obs) => {
        if (document.body && document.getElementById('svg-symbols')) {
            obs.disconnect();
            bodyIsReady();
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
})();
