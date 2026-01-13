/// <reference path="./_docs.d.ts" />

const CONFIG = {
    version: 26,
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
        blurHashSize: 32, // minimum size of blur preview
    },
    appearance_small: {
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
        blurHashSize: 32, // minimum size of blur preview
    },
    appearance: {},
    perRequestLimits: {
        models: 60,
        images: 180
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
    period: 'Month',
    period_images: 'AllTime',
    baseModels: [],
    blackListTags: [], // Doesn't work on images (pictures don't have tags)
    nsfw: true,
    nsfwLevel: 'Mature',
    browsingLevel: 4,
    groupImagesByPost: true,
    showCurrentModelVersionStats: true,
    hideImagesWithoutPositivePrompt: true,
    hideImagesWithoutNegativePrompt: false,
    hideImagesWithoutResources: false,
    colorCorrection: true,
    disableRemixAutoload: false,    // Completely disables automatic loading of remix image
    disablePromptFormatting: false, // Completely disable formatting of blocks with prompts (show original content)
    disableVirtualScroll: false,    // Completely disable virtual scroll
    assumeListSameAsModel: false,   // When opening a model from a list, use the value from the list (instead of loading it separately), (assume that when loading a list and a separate model, the data is the same)
};

Object.entries(tryParseLocalStorageJSON('civitai-lite-viewer--settings')?.settings ?? {}).forEach(([ key, value ]) => SETTINGS[key] = value);

// Reasons for some old code snippets
// Snippet_1:
//   The presence of a `modelId` or `imageId` in the request forces the
//   civitai api to use the old method for retrieving images,
//   and it, unlike the new one (probably a bug? But all the stats there are 0),
//   returns a response with stats.

// =================================

navigator.serviceWorker.register(`service_worker.js?v=${Number(CONFIG.version)}`, { scope: './' });

class CivitaiAPI {
    // https://github.com/civitai/civitai/tree/main/src/pages/api/v1

    constructor(baseURL = CONFIG.api_url) {
        this.baseURL = baseURL;
    }

    async #getJSON({ url, target }) {
        try {
            const headers = {
                'Accept': 'application/json'
            };
            // if (SETTINGS.api_key) headers['Authorization'] = `Bearer ${SETTINGS.api_key}`; // Need to check

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
        if (primaryFileOnly) url.searchParams.append('primaryFileOnly', 'true'); // (see above)
        if (browsingLevel) url.searchParams.append('browsingLevel', browsingLevel); // ERROR: (see above)
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

        // Guessing the nsfw level has been moved to sw

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

// TODO: Normalize the management of the history, I don't like that inside #genImageFullPage the history are touched...
// TODO: Prerender pages when pointerdown, and show on click
class Controller {
    static api = new CivitaiAPI(CONFIG.api_url);
    static appElement = document.getElementById('app');
    static #devicePixelRatio = +window.devicePixelRatio.toFixed(2);
    static #errorTimer = null;
    static #emptyImage = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>";
    static #pageNavigation = null; // This is necessary to ignore events that are no longer related to the current page (for example, after a long API load from an old page)
    static #activeMasonryLayout = null;
    static #onScroll = null;
    static #onResize = null;
    static #state = {};

    static #groups = new Map(); // key -> { list, timer }
    static #preClickResults = {};
    static #cachedUserImages = new Map(); // try to reuse user profile images

    static #cache = {
        images: new Map(),          // dummy cache for transferring information about images from the list to fullscreen mode
        posts: new Map(),           // dummy cache for transferring information about posts from the list to fullscreen mode
        models: new Map(),          // Cache for quickly obtaining information about models
        modelVersions: new Map(),   // Cache for quickly obtaining information about model versions
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
            'HiDream',
            'Hunyuan 1',
            'Hunyuan Video',
            'Illustrious',
            'Imagen4',
            'Kolors',
            'LTXV',
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
            'Sora 2',
            'Stable Cascade',
            'Veo 3',
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
            'Other'
        ],
        labels: {
            AuraFlow: 'Aura Flow',
            ZImageTurbo: 'Z-Image Turbo',
            'PixArt a': 'PixArt α',
            'PixArt E': 'PixArt Σ',
            'Wan Video 2.2 I2V-A14B': 'Wan 2.2 I2V A14B',
            'Wan Video 2.2 T2V-A14B': 'Wan 2.2 T2V A14B',
            'Wan Video 2.2 TI2V-5B': 'Wan 2.2 TI2V 5B',
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

    static updateMainMenu() {
        const menu = document.querySelector('#main-menu .menu');

        menu.querySelector('a[href="#home"] span').textContent = window.languagePack?.text?.home ?? 'Home';
        menu.querySelector('a[href="#models"] span').textContent = window.languagePack?.text?.models ?? 'Models';
        menu.querySelector('a[href="#articles"] span').textContent = window.languagePack?.text?.articles ?? 'Articles';
        menu.querySelector('a[href="#images"] span').textContent = window.languagePack?.text?.images ?? 'Images';
    }

    static gotoPage(page, savedState) {
        // Do nothing if the transition was processed somewhere else
        if (this.#state.id && this.#state.id === savedState?.id) return;

        const [ pageId, paramString ] = page?.split('?') ?? [];
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

        this.#activeMasonryLayout?.destroy({ preventRemoveItemsFromDOM: true });
        this.#activeMasonryLayout = null;
        this.#onScroll = null;
        this.#onResize = null;
        this.#pageNavigation = Date.now();
        this.#devicePixelRatio = +window.devicePixelRatio.toFixed(2);

        this.appElement.querySelectorAll('video').forEach(el => el.pause());
        this.appElement.querySelectorAll('.autoplay-observed').forEach(disableAutoPlayOnVisible);
        this.appElement.querySelectorAll('.inviewport-observed').forEach(onTargetInViewportClearTarget);
        document.getElementById('tooltip')?.remove();
        this.appElement.classList.add('page-loading');
        this.appElement.setAttribute('data-page', pageId);
        if (paramString) this.appElement.setAttribute('data-params', paramString);
        else this.appElement.removeAttribute('data-params');
        document.querySelector('#main-menu .menu a.active')?.classList.remove('active');
        if (pageId) document.querySelector(`#main-menu .menu a[href="${pageId}"]`)?.classList.add('active');

        const finishPageLoading = () => {
            cleanupDetachedObservers();
            hideTimeError();
            if (navigationState.id === this.#state.id) {
                this.appElement.classList.remove('page-loading');

                this.#onScroll?.({ scrollTop: navigationState.scrollTop || 0, scrollTopRelative: navigationState.scrollTopRelative ?? null });
                document.documentElement.scrollTo({ top: navigationState.scrollTop || 0, behavior: 'instant' });
            }
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

        let promise;
        if (pageId === '#home') {
            if (paramString) {
                try {
                    const params = Object.fromEntries(new URLSearchParams(paramString));
                    if (params.url) promise = this.openFromCivitUrl(params.url);
                    else promise = this.gotoHome();
                } catch(_) {
                    promise = this.gotoHome();
                }
            } else promise = this.gotoHome();
        } else if (pageId === '#models') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.hash) promise = this.gotoModelByHash(params.hash);
            else if (params.model) promise = this.gotoModel(params.model, params.version);
            else promise = this.gotoModels({ tag: params.tag, query: params.query, username: params.username || params.user });
        } else if (pageId === '#articles') promise = this.gotoArticles();
        else if (pageId === '#images') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.image) promise = this.gotoImage(params.image, params.nsfw);
            else if (params.model || params.modelversion || params.username || params.userId || params.user || params.post) {
                promise = this.gotoImages({ userId: params.userId, modelId: params.model, modelVersionId: params.modelversion, username: params.username || params.user, postId: params.post });
            }
            else promise = this.gotoImages();
        }

        if (promise) promise.finally(finishPageLoading);
        else finishPageLoading();

        // Clear promises or whatever might have been in the preflight
        this.#preClickResults = {};
    }

    // This implementation seems wrong... and problematic in terms of support, but let it be for now
    static preparePage(page) {
        console.log(`Preload ${page}`);
        // Start downloading or retrieving from cache in advance,
        // because after pressing it is highly likely that a click will occur... 
        const [ pageId, paramString ] = page?.split('?') ?? [];
        this.#preClickResults = {};

        // TODO
        if (pageId === '#models') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.hash) {
                this.#preClickResults[params.hash] = this.api.fetchModelVersionInfo(params.hash, true);
            } else if (params.model) {
                if (!this.#cache.models.has(`${params.model}`)) {
                    this.#preClickResults[params.model] = this.api.fetchModelInfo(params.model);
                }
            } else {
                const query = {
                    limit: CONFIG.perRequestLimits.models,
                    tag: params.tag ?? '',
                    query: params.query,
                    username: params.username || params.user,
                    types: SETTINGS.types,
                    sort: SETTINGS.sort,
                    period: SETTINGS.period,
                    checkpointType: SETTINGS.checkpointType,
                    baseModels: SETTINGS.baseModels,
                    nsfw: SETTINGS.nsfw,
                };

                this.#preClickResults[JSON.stringify(query)] = this.api.fetchModels(query);
            }
        } else if (pageId === '#images') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.image) {
                if (!this.#cache.images.has(`${params.image}`)) {
                    this.#preClickResults[params.image] = this.api.fetchImageMeta(params.image, params.nsfw);
                }
            }
        }
    }

    static gotoHome() {
        this.#setTitle(window.languagePack?.text?.home ?? 'Home');

        const searchLang = window.languagePack?.temp?.home?.search ?? {};
        const searchWrap = createElement('div', { class: 'app-content main-search-container' });
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
            try {
                const url = new URL(q);
                if (url.origin === CONFIG.civitai_url) {
                    const redirectUrl = this.convertCivUrlToLocal(q);
                    if (!redirectUrl) throw new Error('Unknown url');
                    let promise;
                    const searchParams = Object.fromEntries(url.searchParams);

                    if (url.pathname.indexOf('/models/') === 0) {
                        const modelId = url.pathname.match(/\/models\/(\d+)/i)?.[1];
                        if (!modelId) throw new Error('There is no model id in the link');
                        if (searchParams.modelVersionId) {
                            promise = this.api.fetchModelVersionInfo(searchParams.modelVersionId).then(version => {
                                const previewMedia = version?.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
                                const title = version.model?.name ? `${version.model?.name} (${version.name})` : version.name ?? redirectUrl;
                                results.push({ media: previewMedia, image: CONFIG.logo, href: redirectUrl, title, typeBadge: version.model?.type ?? window.languagePack?.text?.model ?? 'Model' });
                            });
                        } else {
                            promise = this.api.fetchModelInfo(modelId).then(model => {
                                const previewMedia = model?.modelVersions?.[0]?.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
                                const title = model.name ?? redirectUrl;
                                results.push({ media: previewMedia, image: CONFIG.logo, href: redirectUrl, title, typeBadge: model.type ?? window.languagePack?.text?.model ?? 'Model' });
                            });
                        }
                    } else if (url.pathname.indexOf('/images/') === 0) {
                        const imageId = url.pathname.match(/\/images\/(\d+)/i)?.[1];
                        if (!imageId) throw new Error('There is no image id in the link');
                        promise = this.api.fetchImageMeta(imageId).then(media => {
                            const title = window.languagePack?.text?.image ?? 'Image';
                            results.push({ media, image: CONFIG.logo, href: redirectUrl, title, typeBadge: title });
                        });
                    } else if (url.pathname.indexOf('/posts/') === 0) {
                        const postId = url.pathname.match(/\/posts\/(\d+)/i)?.[1];
                        if (!postId) throw new Error('There is no post id in the link');
                        const title = window.languagePack?.text?.post ?? 'Post';
                        results.push({ image: CONFIG.logo, href: redirectUrl, title, typeBadge: title });
                    }
                    if (promise) promises.push(promise);
                }

                if (!promises.length && !results.length) results.push({ icon: 'cross', title: searchLang.linkNotSupported ?? 'This link is not supported' });

                if (promises.length) {
                    showLoading();
                    Promise.allSettled(promises).then(() => q === searchQuery ? renderResults(results) : null);
                } else renderResults(results);

                return;
            } catch(_) {}

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
                        console.log(q);
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
        const appContent = createElement('div', { class: 'app-content' });
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
            } catch(_) {
                console.error(_);
                insertElement('p', settingsContainer, { class: 'error-text' }, `Error: ${_?.message ?? _}`);
            }
        };

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

        this.#clearAppElement();
        this.appElement.appendChild(searchWrap);
        this.appElement.appendChild(appContent);
    }

    static gotoArticles() {
        const appContent = createElement('div', { class: 'app-content' });
        this.#setTitle(window.languagePack?.text?.articles ?? 'Articles');
        const p = insertElement('p', appContent, { class: 'error-text' });
        p.appendChild(getIcon('cross'));
        insertElement('span', p, undefined, window.languagePack?.temp?.articles ?? 'CivitAI public API does not provide a list of articles 😢');
        this.#clearAppElement();
        this.appElement.appendChild(appContent);
    }

    static gotoImage(imageId, nsfwLevel) {
        const appContent = createElement('div', { class: 'app-content-wide full-image-page' });

        const cachedMedia = this.#cache.images.get(`${imageId}`);
        if (cachedMedia) {
            console.log('Loaded image info (cache)', cachedMedia);
            appContent.appendChild(this.#genImageFullPage(cachedMedia));
            this.#clearAppElement();
            this.appElement.appendChild(appContent);
            return;
        }

        const pageNavigation = this.#pageNavigation;
        const apiPromise = this.#preClickResults[imageId] ?? this.api.fetchImageMeta(imageId, nsfwLevel);
        return apiPromise.then(media => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.log('Loaded image info', media);
            if (!media) throw new Error('No Meta');

            appContent.appendChild(this.#genImageFullPage(media));
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Error'));

            if (error?.message === 'No Meta') {
                appContent.style.flexDirection = 'column';
                insertElement('p', appContent, { class: 'error-text' }, 'Some images cannot be retrieved via API, you can try opening this image on the original site');
                insertElement('a', appContent, { href: `${CONFIG.civitai_url}/images/${imageId}`, target: '_blank', class: 'link-button link-open-civitai' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');
            }
        }).finally(() => {
            if (pageNavigation !== this.#pageNavigation) return;
            this.#clearAppElement();
            this.appElement.appendChild(appContent);
        });
    }

    static gotoImages(options = {}) {
        const { modelId, username, userId, modelVersionId, postId } = options;

        this.#setTitle(window.languagePack?.text?.images ?? 'Images');

        const appContentWide = createElement('div', { class: 'app-content app-content-wide cards-list-container' });
        const { element: imagesList, promise: imagesListPromise } = this.#genImages({ modelId, modelVersionId, username, userId, postId });
        appContentWide.appendChild(imagesList);
        appContentWide.appendChild(this.#genScrollToTopButton());

        this.#clearAppElement();
        this.appElement.appendChild(appContentWide);
        return imagesListPromise;
    }

    static gotoModelByHash(hash) {
        const pageNavigation = this.#pageNavigation;
        const apiPromise = this.#preClickResults[hash] ?? this.api.fetchModelVersionInfo(hash, true);
        return apiPromise.then(model => {
            if (pageNavigation !== this.#pageNavigation) return;
            const { modelId, name: modelVersionName } = model ?? {};
            if (modelId) return this.gotoModel(modelId, modelVersionName);
            else {
                console.log('There is no model id here...', model);
                throw new Error(model?.error ?? `No models found with this hash (${hash})`);
            }
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            this.#clearAppElement();
            this.appElement.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
        });
    }

    static gotoModel(id, version = null) {
        const pageNavigation = this.#pageNavigation;
        const navigationState = {...this.#state};

        const insertModelPage = model => {
            const modelVersion = version ? model.modelVersions.find(v => v.name === version || v.id === Number(version)) ?? model.modelVersions[0] : model.modelVersions[0];
            this.#setTitle([model.name, modelVersion.name, modelVersion.baseModel, model.type]);

            const appContent = createElement('div', { class: 'app-content' });
            appContent.appendChild(this.#genModelPage({ model, version, state: navigationState }));

            // Images
            const appContentWide = createElement('div', { class: 'app-content app-content-wide cards-list-container' });
            const imagesTitle = insertElement('h2', appContentWide, { style: 'justify-content: center;' });
            const imagesTitle_link = insertElement('a', imagesTitle, { href: `#images?model=${model.id}&modelversion=${modelVersion.id}` }, window.languagePack?.text?.images ?? 'Images');
            imagesTitle_link.prepend(getIcon('image'));
            let promise = null;
            if (this.#state.imagesLoaded) {
                const { element: imagesList, promise: imagesListPromise } = this.#genImages({ modelId: model.id, opCreator: model.creator?.username, modelVersionId: modelVersion.id, state: navigationState });
                promise = imagesListPromise;
                appContentWide.appendChild(imagesList);
                appContentWide.appendChild(this.#genScrollToTopButton());
            } else {
                const imagesListTrigger = insertElement('div', appContentWide, undefined, '...');
                onTargetInViewport(imagesListTrigger, () => {
                    imagesListTrigger.remove();
                    this.#state.imagesLoaded = true;
                    const { element: imagesList, promise: imagesListPromise } = this.#genImages({ modelId: model.id, opCreator: model.creator?.username, modelVersionId: modelVersion.id, state: navigationState });
                    imagesListPromise.then(() => {
                        if (pageNavigation !== this.#pageNavigation) return;
                        this.#onScroll();
                    });
                    appContentWide.appendChild(imagesList);
                    appContentWide.appendChild(this.#genScrollToTopButton());
                });
            }

            this.#clearAppElement();
            this.appElement.appendChild(appContent);
            this.appElement.appendChild(appContentWide);
            return promise;
        };

        const cachedModel = this.#cache.models.get(`${id}`);
        if (cachedModel) {
            console.log('Loaded model (cache):', cachedModel);
            return insertModelPage(cachedModel);
        }

        const apiPromise = this.#preClickResults[id] ?? this.api.fetchModelInfo(id);
        return apiPromise
        .then(data => {
            if (data.id) this.#cache.models.set(`${data.id}`, data);
            if (pageNavigation !== this.#pageNavigation) return;
            console.log('Loaded model:', data);
            return insertModelPage(data);
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            const appContent = createElement('div', { class: 'app-content' });
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            this.#clearAppElement();
            this.appElement.appendChild(appContent);
        });
    }

    static gotoModels(options = {}) {
        const { tag = '', query: searchQuery, username: searchUsername } = options;
        const navigationState = {...this.#state};
        const cache = this.#cache.history.get(navigationState.id) ?? {};
        let firstDraw = false;
        let query;
        const appContent = createElement('div', { class: 'app-content app-content-wide cards-list-container' });
        const listWrap = insertElement('div', appContent, { id: 'models-list' });
        const listElement = insertElement('div', listWrap, { class: 'cards-list models-list' });
        appContent.appendChild(this.#genScrollToTopButton());
        this.#setTitle(window.languagePack?.text?.models ?? 'Models');

        const layout = this.#activeMasonryLayout = new MasonryLayout(listElement, {
            gap: CONFIG.appearance.modelCard.gap,
            itemWidth: CONFIG.appearance.modelCard.width,
            itemHeight: CONFIG.appearance.modelCard.height,
            generator: this.#genModelCard.bind(this),
            minOverscan: 1,
            maxOverscan: 3,
            passive: true,
            disableVirtualScroll: SETTINGS.disableVirtualScroll ?? false,
            onElementRemove: this.#onCardRemoved.bind(this)
        });

        let modelById = new Map(), hiddenModels = 0;
        if (SETTINGS.assumeListSameAsModel) {
            listElement.addEventListener('pointerdown', e => {
                const a = e.target.closest('a[data-id]');
                const id = Number(a?.getAttribute('data-id'));
                if (!modelById.has(id)) return;
                const model = modelById.get(id);
                this.#cache.models.set(`${id}`, model);
            }, { capture: true });
        }

        const { onScroll, onResize } = layout.getCallbacks();
        this.#onScroll = onScroll;
        this.#onResize = onResize;

        const insertModels = models => {
            const pageNavigation = this.#pageNavigation;
            console.log('Loaded models:', models);

            const modelsCountAll = models.length;
            models = models.filter(model => (model?.modelVersions?.length && !model.tags.some(tag => SETTINGS.blackListTags.includes(tag))));
            if (models.length !== modelsCountAll) {
                console.log(`Due to the selected tags for hiding, ${modelsCountAll - models.length} model(s) were hidden`);
                hiddenModels += modelsCountAll - models.length;
            }

            models.forEach(model => {
                if (modelById.has(model.id)) return;
                modelById.set(model.id, model);
            });

            layout.addItems(models.map(data => ({ id: data.id, data })), firstDraw);

            if (query.cursor) {
                const loadMoreTrigger = insertElement('div', listElement, { id: 'load-more' });
                insertElement('div', loadMoreTrigger, { class: 'media-loading-indicator' });
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    loadMore().finally(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', listElement, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
                if (hiddenModels) {
                    const hiddenTextBase = window.languagePack?.text?.hiddenModels ?? 'Due to the selected hide tags, {count} were hidden';
                    const units = window.languagePack?.units?.element ?? ['element', 'elements', 'elements'];
                    const text = hiddenTextBase.replace('{count}', `${hiddenModels} ${escapeHtml(pluralize(hiddenModels, units))}`);
                    insertElement('span', loadNoMore, { class: 'darker-text' }, text);
                }
            }
        };

        const loadMore = () => {
            const pageNavigation = this.#pageNavigation;
            if (!query.cursor) return;
            return this.api.fetchModels(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                if (data.items?.length > 0) {
                    query.cursor = data.metadata?.nextCursor ?? null;
                    cache.nextModelsCursor = query.cursor;
                    cache.models = cache.models.concat(data.items);
                    insertModels(data.items);
                } else {
                    query.cursor = null;
                    cache.nextModelsCursor = null;
                    insertModels([]);
                }
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Failed to fetch models:', error?.message ?? error);
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            });
        };

        const loadModels = () => {
            query = {
                limit: CONFIG.perRequestLimits.models,
                tag,
                query: searchQuery,
                username: searchUsername,
                types: SETTINGS.types,
                sort: SETTINGS.sort,
                period: SETTINGS.period,
                checkpointType: SETTINGS.checkpointType,
                baseModels: SETTINGS.baseModels,
                nsfw: SETTINGS.nsfw,
            };
            this.#state.modelsFilter = JSON.stringify(query);

            const pageNavigation = this.#pageNavigation;
            modelById = new Map();
            hiddenModels = 0;

            if (cache.modelsFilter === this.#state.modelsFilter && cache.models) {
                console.log('Loading models (nav cache)');
                query.cursor = cache.nextModelsCursor ?? null;
                layout.clear();
                insertModels(cache.models);
                return Promise.resolve();
            }

            listWrap.classList.add('cards-loading');
            listWrap.setAttribute('inert', '');

            const apiPromise = this.#preClickResults[JSON.stringify(query)] ?? this.api.fetchModels(query);
            return apiPromise.then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                cache.nextModelsCursor = query.cursor;
                cache.modelsFilter = this.#state.modelsFilter;
                cache.models = [...data.items];

                layout.clear();
                insertModels(data.items);
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Error:', error?.message ?? error);
                listWrap.textContent = '';
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            }).finally(() => {
                if (pageNavigation !== this.#pageNavigation) return;
                listWrap.classList.remove('cards-loading');
                listWrap.removeAttribute('inert');
            });
        };

        const firstLoadingPlaceholder = insertElement('div', listWrap, { id: 'load-more' });
        insertElement('div', firstLoadingPlaceholder, { class: 'media-loading-indicator' });

        this.#clearAppElement();
        this.appElement.appendChild(this.#genModelsListFilters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            loadModels();
        }));
        this.appElement.appendChild(appContent);

        firstDraw = true;
        return loadModels().finally(() => {
            if (navigationState.id !== this.#state.id) return;
            firstLoadingPlaceholder.remove();
            firstDraw = false;
        });
    }

    static openFromCivitUrl(href) {
        try {
            const redirectUrl = this.convertCivUrlToLocal(href);
            if (!redirectUrl) throw new Error('Unsupported url');
            gotoLocalLink(redirectUrl);
        } catch(error) {
            const appContent = createElement('div', { class: 'app-content' });
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Unsupported url'));

            this.#setTitle();

            this.#clearAppElement();
            this.appElement.appendChild(appContent);
        }
    }

    static convertCivUrlToLocal(href) {
        try {
            const url = new URL(href);
            if (url.origin !== CONFIG.civitai_url) throw new Error(`Unknown url origin, must be ${CONFIG.civitai_url}`);
            const searchParams = Object.fromEntries(url.searchParams);
            let localUrl;
            if (url.pathname.startsWith('/models/')) {
                const modelId = url.pathname.match(/\/models\/(\d+)/i)?.[1];
                if (!modelId) throw new Error('There is no model id in the link');
                localUrl = `#models?model=${modelId}`;
                if (searchParams.modelVersionId) localUrl += `&version=${searchParams.modelVersionId}`;
            } else if (url.pathname.startsWith('/images/')) {
                const imageId = url.pathname.match(/\/images\/(\d+)/i)?.[1];
                if (!imageId) throw new Error('There is no image id in the link');
                localUrl = `#images?image=${imageId}`;
            } else if (url.pathname.startsWith('/posts/')) {
                const postId = url.pathname.match(/\/posts\/(\d+)/i)?.[1];
                if (!postId) throw new Error('There is no post id in the link');
                localUrl = `#images?post=${postId}`;
            }
            if (!localUrl) throw new Error('Unsupported url');
            return localUrl;
        } catch(_) {
            console.warn(_?.message ?? _);
            return null;
        }
    }

    static createLinkPreview(url) {
        if (!(url instanceof URL)) {
            try {
                url = new URL(url, location.origin);
            } catch (_) {
                return;
            }
        }

        let imageId = null, modelId = null, modelVersionId = null;

        if (url.origin === CONFIG.civitai_url) {
            if (url.pathname.startsWith('/images/')) {
                imageId = url.pathname.match(/\/images\/(\d+)/i)?.[1];
            } else if (url.pathname.startsWith('/models/')) {
                modelId = url.pathname.match(/\/models\/(\d+)/i)?.[1];
                const params = Object.fromEntries(url.searchParams);
                modelVersionId = params.modelVersionId;
            }
        }

        if (url.origin === location.origin) {
            const [ pageId, paramString ] = url.hash.split('?') ?? [];
            const params = Object.fromEntries(new URLSearchParams(paramString));
            imageId = params.image;
            modelId = params.model;
            modelVersionId = params.version;
        }

        if (imageId) {
            const showImage = media => {
                if (!media) return this.#genErrorPage('No Meta');
                const baseWidth = CONFIG.appearance.imageCard.width;
                const aspectRatio = Math.min(media.width / media.height, 2);
                const itemWidth = aspectRatio > 1.38 ? Math.round(baseWidth * aspectRatio) : baseWidth;
                const card = this.#genImageCard(media, { isVisible: true, firstDraw: true, itemWidth, forceAutoplay: true });
                return card;
            };
    
            const cached = this.#cache.images.get(imageId);
            if (cached) return showImage(cached);

            return this.api.fetchImageMeta(imageId).then(media => {
                if (media) this.#cache.images.set(imageId, media);
                return showImage(media);
            }).catch(error => this.#genErrorPage(error?.message ?? 'Error'));
        } else if (modelId) {
            const showModel = model => {
                const card = this.#genModelCard(model, { isVisible: true, firstDraw: true, itemWidth: CONFIG.appearance.modelCard.width, itemHeight: CONFIG.appearance.modelCard.height, forceAutoplay: true, version: modelVersionId });
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
            { icon: 'like', value: model.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'download', value: model.stats.downloadCount, formatter: formatNumber, unit: 'download' },
            // { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
            { icon: 'chat', value: model.stats.commentCount, formatter: formatNumber, unit: 'comment' },
        ];
        const availabilityBadge = modelVersion.availability !== 'Public' ? modelVersion.availability : ((modelVersion.publishedAt ?? modelVersion.createdAt) > CONFIG.minDateForNewBadge) ? model.modelVersions.length > 1 ? 'Updated' : 'New' : null;
        const iconId = { 'EarlyAccess': 'thunder', 'Updated': 'arrow_up_alt', 'New': 'plus' }[availabilityBadge] ?? null;
        if (availabilityBadge) statsList.push({ icon: iconId || 'information', value: window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge, type: availabilityBadge });
        const statsFragment = this.#genStats(statsList);
        if (availabilityBadge) statsFragment.children[statsFragment.children.length - 1].classList.add('model-availability');
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
                const downloadTitle = `${download} ${file.metadata.fp ?? ''} (${fileSize})` + (file.metadata.format === 'SafeTensor' ? '' : ` ${file.metadata.format}`);
                a.appendChild(document.createTextNode(` ${downloadTitle}`));
            } else if (file.type === 'Archive') {
                const downloadTitle = `${download} (${fileSize})`;
                a.appendChild(document.createTextNode(` ${downloadTitle}`));
                a.appendChild(getIcon('file_zip'));
            } else {
                const downloadTitle = `${download} (${fileSize})` + (file.metadata.format === 'SafeTensor' ? '' : ` ${file.metadata.format}`);
                a.appendChild(document.createTextNode(` ${downloadTitle}`));
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
        const modelSubNameWrap = insertElement('div', page, { class: 'model-sub-name' });
        const publishedAt = new Date(modelVersion.publishedAt ?? modelVersion.createdAt);
        insertElement('span', modelSubNameWrap, { class: 'model-updated-time', 'lilpipe-text': escapeHtml(`${window.languagePack?.text?.Updated ?? 'Updated'}: ${publishedAt.toLocaleString()}`) }, timeAgo(Math.round((Date.now() - publishedAt)/1000)));
        const modelTagsWrap = insertElement('div', modelSubNameWrap, { class: 'badges model-tags' });
        const updateTags = tags => {
            modelTagsWrap.textContent = '';
            tags.forEach(tag => insertElement('a', modelTagsWrap, { href: `#models?tag=${encodeURIComponent(tag)}`, class: (SETTINGS.blackListTags.includes(tag) ? 'badge error-text' : 'badge') }, tag));
            
            if (modelVersion.baseModel) {
                const baseModel = createElement('div', { class: 'badge' }, this.#models.labels[modelVersion.baseModel] ?? modelVersion.baseModel);
                modelTagsWrap.prepend(baseModel);
            }
        };
        if (this.#state.model_tags || model.tags.length <= 12) updateTags(model.tags);
        else {
            updateTags(model.tags.slice(0, 12));
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
            const isWideMinRatio = 1.38;
            const generateMediaPreview = media => {
                const ratio = +(media.width/media.height).toFixed(4);
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
                const element = index <= 2 ? generateMediaPreview(media) : null;
                const isWide = media.width/media.height >= isWideMinRatio && CONFIG.appearance.modelPage.carouselItemsCount > 1;
                return { id: media.id, data: media, element, width: media.width, height: media.height, isWide };
            });

            // Try to insert a picture from the previous page, if available
            if (previewList[0]) this.#genMediaPreviewFromPrevPage(previewList[0].element, previewList[0].id);
            if (previewList[1]) this.#genMediaPreviewFromPrevPage(previewList[1].element, previewList[1].id);

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
            if (this.#state[`long_description_${descriptionId}`]) return;
            el.classList.add('hide-long-description');
            const showMore = createElement('button', { class: 'show-more' });
            showMore.appendChild(getIcon('arrow_down'));
            el.appendChild(showMore);
            showMore.addEventListener('click', () => {
                this.#state[`long_description_${descriptionId}`] = true;
                el.classList.remove('hide-long-description');
                showMore.remove();
            }, { once: true });
        };

        // Model version description block
        const modelVersionDescription = insertElement('div', page, { class: 'model-description model-version-description' });
        const modelVersionNameWrap = insertElement('h2', modelVersionDescription, { class: 'model-version' });
        const modelVersionNameWrapSpan = insertElement('span', modelVersionNameWrap);
        modelVersionNameWrapSpan.appendChild(this.#formatModelVersionName(modelVersion.name));
        const versionStatsList = [
            { icon: 'like', value: modelVersion.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'download', value: modelVersion.stats.downloadCount, formatter: formatNumber, unit: 'download' },
        ];
        modelVersionNameWrap.appendChild(this.#genStats(versionStatsList));

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

        // Creator
        if (model.creator) {
            const userInfo = {...model.creator};
            if (userInfo.username) userInfo.url = `#models?username=${userInfo.username}`;
            const userBLock = this.#genUserBlock(userInfo);
            if(!SETTINGS.autoplay) userBLock.classList.add('image-hover-play');
            modelVersionDescription.appendChild(userBLock);
            const draggableTitleBase = window.languagePack?.text?.models_from ?? 'Models from {username}';
            userBLock.querySelector('a')?.setAttribute('data-draggable-title', draggableTitleBase.replace('{username}', model.creator?.username || 'user'));
        }

        // to select the background color when correcting colors
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

        // Version description
        if (modelVersion.description) {
            const description = this.#analyzeModelDescriptionString(modelVersion.description);
            const modelVersionFragment = safeParseHTML(description);
            this.#analyzeModelDescription(modelVersionFragment, cache);
            if (SETTINGS.colorCorrection) this.#analyzeTextColors(modelVersionFragment, isDarkMode ? { r: 40, g: 40, b: 40 } : { r: 238, g: 238, b: 238 }); // TODO: real bg
            modelVersionDescription.appendChild(modelVersionFragment);
            if (calcCharsInString(description, '<p>', 40) >= 40) hideLongDescription('modelVersion', modelVersionDescription);
        }

        // Model descrition
        if (model.description) {
            const modelDescription = createElement('div', { class: 'model-description' });
            const description = this.#analyzeModelDescriptionString(model.description);
            const modelDescriptionFragment = safeParseHTML(description);
            this.#analyzeModelDescription(modelDescriptionFragment, cache);
            if(SETTINGS.colorCorrection) this.#analyzeTextColors(modelDescriptionFragment, isDarkMode ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 }); // TODO: real bg
            modelDescription.appendChild(modelDescriptionFragment);
            if (calcCharsInString(description, '<p>', 40) >= 40) hideLongDescription('model', modelDescription);
            if (modelDescription.childNodes.length) page.appendChild(modelDescription);
        }


        // Open in CivitAI
        insertElement('a', page, { href: `${CONFIG.civitai_url}/models/${model.id}?modelVersionId=${modelVersion.id}`, target: '_blank', class: 'link-button link-open-civitai'}, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        // Comments
        // ...

        return page;
    }

    static #genImageFullPage(media) {
        const fragment = new DocumentFragment();

        const cachedPostInfo = this.#cache.posts.get(`${media.postId}`);
        const postInfo = cachedPostInfo ?? new Set([media]);
        const mediaById = new Map();

        const carouselItems = [];
        let mediaGenerator;
        if (postInfo.size > 1) {
            mediaGenerator = item => {
                const mediaElement = this.#genMediaElement({ media: item, width: item.width, target: 'full-image', autoplay: true, original: true, controls: true, loading: 'eager', playsinline: false });
                mediaElement.style.width = `${item.width}px`;
                mediaElement.classList.add('media-full-preview');
                return mediaElement;
            }
            postInfo.forEach(item => {
                mediaById.set(item.id, item);
                carouselItems.push({ id: item.id, data: item, width: item.width, height: item.height, index: carouselItems.length });
            });
        }

        const insertMeta = (media, container) => {
            this.#setTitle((window.languagePack?.text?.image_by ?? 'Image by {username}').replace('{username}', media.username));

            // Creator and Created At
            const creator = this.#genUserBlock({ username: media.username, url: `#images?username=${media.username}` });
            if (media.createdAt) {
                const createdAt = new Date(media.createdAt);
                insertElement('span', creator, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
            }
            const draggableTitleBase = window.languagePack?.text?.images_from ?? 'Images from {username}';
            creator.querySelector('a')?.setAttribute('data-draggable-title', draggableTitleBase.replace('{username}', media.username || 'user'));
            container.appendChild(creator);

            // Stats
            const statsList = [
                { iconString: '👍', value: media.stats.likeCount, formatter: formatNumber, unit: 'like' },
                { iconString: '👎', value: media.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
                { iconString: '😭', value: media.stats.cryCount, formatter: formatNumber, unit: 'cry' },
                { iconString: '❤️', value: media.stats.heartCount, formatter: formatNumber, unit: 'heart' },
                { iconString: '🤣', value: media.stats.laughCount, formatter: formatNumber, unit: 'laugh' },
                { icon: 'chat', value: media.stats.commentCount, formatter: formatNumber, unit: 'comment' },
            ];
            const statsFragment = this.#genStats(statsList, true);

            // NSFW LEvel
            if (media.nsfwLevel !== 'None') {
                const nsfwBadge = createElement('div', { class: 'image-nsfw-level badge', 'data-nsfw-level': media.nsfwLevel }, media.nsfwLevel);
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
        };

        // Full image
        const mediaElement = this.#genMediaElement({ media, width: media.width, target: 'full-image', autoplay: true, original: true, controls: true, decoding: 'async', playsinline: false });
        mediaElement.style.width = `${media.width}px`;
        mediaElement.classList.add('media-full-preview');
        // Try to insert a picture from the previous page, if available
        this.#genMediaPreviewFromPrevPage(mediaElement, media.id);

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
                    insertMeta(media, metaContainer);
                    history.replaceState(Controller.state, '', `#images?image=${id}&nsfw=${media.nsfwLevel}`);
                }
            });
            fragment.appendChild(carouselElement);
        } else fragment.appendChild(mediaElement);


        const metaContainer = createElement('div', { class: 'media-full-meta' });
        insertMeta(media, metaContainer);
        fragment.appendChild(metaContainer);

        return fragment;
    }

    static #genImages(options) {
        const { modelId, modelVersionId, postId, userId, username, opCreator = null, state: navigationState = {...this.#state} } = options; // Snippet_1 : modelId
        const cache = this.#cache.history.get(navigationState.id) ?? {};
        let firstDraw = false;
        let query;
        let groupingByPost = SETTINGS.groupImagesByPost && !postId;
        const fragment = new DocumentFragment();
        const listWrap = createElement('div', { id: 'images-list'});
        const listElement = insertElement('div', listWrap, { class: 'cards-list images-list' });

        const layout = this.#activeMasonryLayout = new MasonryLayout(listElement, {
            gap: CONFIG.appearance.imageCard.gap,
            itemWidth: CONFIG.appearance.imageCard.width,
            generator: this.#genImageCard.bind(this),
            minOverscan: 1,
            maxOverscan: 3,
            passive: true,
            disableVirtualScroll: SETTINGS.disableVirtualScroll ?? false,
            onElementRemove: this.#onCardRemoved.bind(this)
        });

        const { onScroll, onResize } = layout.getCallbacks();
        this.#onScroll = onScroll;
        this.#onResize = onResize;

        let imagesMetaById = new Map(), postsById = new Map(), hiddenImages = 0;
        listElement.addEventListener('pointerdown', e => {
            const a = e.target.closest('a[data-id]');
            const id = Number(a?.getAttribute('data-id'));
            if (!imagesMetaById.has(id)) return;
            const imageMeta = imagesMetaById.get(id);
            const postInfo = imageMeta.postId ? postsById.get(imageMeta.postId) : null;
            this.#cache.images.set(`${id}`, imageMeta);
            if (postInfo) this.#cache.posts.set(`${imageMeta.postId}`, postInfo);
        }, { capture: true });

        fragment.appendChild(this.#genImagesListFilters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            loadImages();
        }));

        const firstLoadingPlaceholder = insertElement('div', fragment, { id: 'load-more', style: 'position: absolute; width: 100%;' });
        insertElement('div', firstLoadingPlaceholder, { class: 'media-loading-indicator' });

        fragment.appendChild(listWrap);

        const loadMore = () => {
            if (!query.cursor) return;
            const pageNavigation = this.#pageNavigation;
            return this.api.fetchImages(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                cache.nextImagesCursor = query.cursor;
                cache.images = cache.images.concat(data.items);
                insertImages(data.items);
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Failed to fetch images:', error?.message ?? error);
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            });
        };

        const insertImages = images => {
            const pageNavigation = this.#pageNavigation;
            console.log('Loaded images:', images);

            if (SETTINGS.hideImagesWithoutPositivePrompt) {
                const countAll = images.length;
                images = images.filter(image => image.meta?.prompt || image.meta?.meta?.prompt); // For some reason the API started returning meta.meta...
                if (images.length < countAll) {
                    hiddenImages += countAll - images.length;
                    console.log(`Hidden ${countAll - images.length} image(s) without positive prompt`);
                }
            }

            if (SETTINGS.hideImagesWithoutNegativePrompt) {
                const countAll = images.length;
                images = images.filter(image => image.meta?.negativePrompt || image.meta?.meta?.negativePrompt); // For some reason the API started returning meta.meta...
                if (images.length < countAll) {
                    hiddenImages += countAll - images.length;
                    console.log(`Hidden ${countAll - images.length} image(s) without negative prompt`);
                }
            }

            if (SETTINGS.hideImagesWithoutResources) {
                const countAll = images.length;
                images = images.filter(image => {
                    // For some reason the API started returning meta.meta...
                    const meta = image.meta?.meta && Object.keys(image.meta).length < 4 ? image.meta?.meta : image.meta;
                    return meta.civitaiResources?.length || meta.resources?.length || meta.additionalResources?.length || (meta.hashes && Object.keys(meta.hashes).length) || meta['Model hash'];
                });
                if (images.length < countAll) {
                    hiddenImages += countAll - images.length;
                    console.log(`Hidden ${countAll - images.length} image(s) without used resources`);
                }
            }

            images.forEach(image => {
                if (imagesMetaById.has(image.id)) return;
                imagesMetaById.set(image.id, image);

                // Mark user as model uploader
                if (opCreator && image.username === opCreator) image.usergroup = 'OP';

                if (!postsById.has(image.postId)) postsById.set(image.postId, new Set());
                postsById.get(image.postId).add(image);
            });

            const postsInList = new Set();
            const items = images.map(image => {
                if (groupingByPost) {
                    if (postsInList.has(image.postId)) return null;
                    postsInList.add(image.postId);
                }

                const aspectRatio = image.width / image.height;
                if (groupingByPost) return { id: image.postId, aspectRatio, data: postsById.get(image.postId) };
                else return { id: image.id, aspectRatio, data: image }
            }).filter(Boolean);

            // Select image with the most reactions in each group
            items.forEach(item => {
                if (item.data instanceof Set && item.data.size > 1) {
                    const arr = [...item.data];
                    const sum = s => s.likeCount + s.dislikeCount + s.cryCount + s.heartCount + s.laughCount;
                    const maxImg = arr.reduce((max, img) => sum(img.stats) > sum(max.stats) ? img : max);

                    const newData = new Set([maxImg, ...arr.filter(img => img !== maxImg)]);
                    item.data = newData;
                    item.aspectRatio = maxImg.width / maxImg.height;
                }
            });

            layout.addItems(items, firstDraw);

            if (query.cursor) {
                const loadMoreTrigger = insertElement('div', listElement, { id: 'load-more' });
                insertElement('div', loadMoreTrigger, { class: 'media-loading-indicator' });
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    loadMore().finally(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', listElement, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
                if (hiddenImages) {
                    const hiddenTextBase = window.languagePack?.text?.hiddenImages ?? 'Some images were hidden due to the selected filter settings ({count})';
                    const units = window.languagePack?.units?.image ?? ['image', 'images', 'images'];
                    const text = hiddenTextBase.replace('{count}', `${hiddenImages} ${escapeHtml(pluralize(hiddenImages, units))}`);
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
            if (!listElement.textContent) return changeCallback();

            const cards = new Map();
            listElement.querySelectorAll('.card[data-id]').forEach(card => {
                const id = card.getAttribute('data-id');
                cards.set(id, { from: { card } });
            });
            getCardPositions(cards);

            changeCallback();
            listElement.querySelectorAll('.card[data-id]').forEach(card => {
                const id = card.getAttribute('data-id');
                if (!cards.has(id)) cards.set(id, { to: { card } });
                else {
                    const item = cards.get(id);
                    item.to = { card };
                    item.animation = 'shift';
                }
            });

            if (!cards.values().some(item => item.animation)) return; // Skip if nothing to shift

            listWrap.classList.remove('cards-loading');
            cards.forEach(item => {
                if (!item.from?.isVisible || item.to) return;
                listElement.appendChild(item.from.card);
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
            return Promise.allSettled(animations.map(({ element, keyframes }) => animateElement(element, { keyframes, easing, duration, fill })))
            .then(() => animations.forEach(item => item.removeAfter ? item.element.remove() : null));
        };

        const loadImages = () => {
            query = {
                limit: CONFIG.perRequestLimits.images,
                sort: SETTINGS.sort_images,
                period: SETTINGS.period_images,
                nsfw: SETTINGS.nsfwLevel,
                modelVersionId,
                modelId, // Snippet_1
                userId,
                username,
                postId
            };
            groupingByPost = SETTINGS.groupImagesByPost && !postId;
            this.#state.imagesFilter = JSON.stringify(query);

            const pageNavigation = this.#pageNavigation;
            imagesMetaById = new Map();
            postsById = new Map();
            hiddenImages = 0;

            if (cache.imagesFilter === this.#state.imagesFilter && cache.images) {
                console.log('Loading images (nav cache)');
                query.cursor = cache.nextImagesCursor ?? null;
                const animationsPromise = animateLayoutChanges(() => {
                    layout.clear();
                    insertImages(cache.images);
                });
                return animationsPromise instanceof Promise ? animationsPromise : Promise.resolve();
            }

            listWrap.classList.add('cards-loading');
            listWrap.setAttribute('inert', '');

            return this.api.fetchImages(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;

                // Delete the large comfy field (I don't break it down into additional meta information in the script),
                // and if you need to copy it, it's often in the image and can be dragged onto comfy.
                data.items.map(img => {
                    if (img.meta?.comfy) img.meta.comfy = true;
                    if (img.meta?.meta?.comfy) img.meta.meta.comfy = true;
                });

                cache.nextImagesCursor = query.cursor;
                cache.imagesFilter = this.#state.imagesFilter;
                cache.images = [...data.items];

                return animateLayoutChanges(() => {
                    layout.clear();
                    insertImages(data.items);
                });
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Error:', error?.message ?? error);
                listWrap.textContent = '';
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            }).finally(() => {
                if (pageNavigation !== this.#pageNavigation) return;
                listWrap.classList.remove('cards-loading');
                listWrap.removeAttribute('inert');
            });
        };

        firstDraw = true;
        const promise = loadImages().finally(() => {
            if (navigationState.id !== this.#state.id) return;
            firstLoadingPlaceholder.remove();
            firstDraw = false;
        });

        return { element: fragment, promise };
    }

    static #genStats(stats, hideEmpty = false) {
        const statsWrap = createElement('div', { class: 'badges' });
        stats.forEach(({ icon, iconString, value, formatter, unit, type }) => {
            if (hideEmpty && !value) return;
            const statWrap = insertElement('div', statsWrap, { class: 'badge', 'data-value': value });
            if (!value) statWrap.setAttribute('inert', '');
            const lilpipeValue = typeof value === 'number' && value > 999 ? formatNumberIntl(value) : escapeHtml(value);
            if (unit) {
                const units = window.languagePack?.units?.[unit];
                statWrap.setAttribute('lilpipe-text', units ? `${lilpipeValue} ${escapeHtml(pluralize(value, units))}` : lilpipeValue);
            } else if (!type) statWrap.setAttribute('lilpipe-text', lilpipeValue);
            if (type) statWrap.setAttribute('data-badge', type);
            if (icon) statWrap.appendChild(getIcon(icon));
            // if (iconString) statWrap.appendChild(document.createTextNode(iconString));
            statWrap.appendChild(document.createTextNode(`${iconString || ''} ${formatter?.(value) ?? value}`));
        });
        return statsWrap;
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
        description.querySelectorAll('p:empty, h3:empty, hr + hr').forEach(el => el.remove());
        description.querySelectorAll('p, h3').forEach(el => !el.children.length && !el.textContent.trim() ? el.remove() : null);

        if (!description.children.length) {
            const text = description.textContent;
            description.textContent = '';
            if (text) insertElement('p', description, undefined, text);
            return;
        }

        const headers = description.querySelectorAll('h1, h2, h3');

        // The entire header wrapped in <strong/u/em/b/i> makes no sense
        headers.forEach(header => {
            header.querySelectorAll('strong, u, em, b, i').forEach(el => {
                const isFullWrap = el.textContent.trim() === header.textContent.trim();
                if (isFullWrap) el.replaceWith(...el.childNodes);
            });
        });

        // Remove headings if most of the description consists of them
        // or Expand spam headings into a normal paragraph (contains line breaks or is too long)
        if (headers.length / description.children.length >= .65) {
            headers.forEach(header => {
                const p = createElement('p');
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

        // Add loading lazy, decoding async and srcset
        description.querySelectorAll('img').forEach(img => {
            let src = img.getAttribute('src');
            img.setAttribute('decoding', 'async');

            let url = null, srcset = null;
            try { url = new URL(src); } catch (_) {}

            if (url && url.origin === CONFIG.images_url && !src.includes('original=true')) {
                const urlWidth = Number(src.match(/width=(\d+)/)?.[1] || 0);
                const baseWidth = this.#getNearestServerSize(Math.min(CONFIG.appearance.descriptionMaxWidth, urlWidth));
                const sizes = [1, 2, 3];
                const srcSetParts = [];

                sizes.forEach(ratio => {
                    const targetWidth = baseWidth * ratio;
                    let currentSrc;

                    if (targetWidth > 2200) currentSrc = src.replace(/width=\d+/, 'original=true');
                    else currentSrc = src.replace(/width=\d+/, `width=${this.#getNearestServerSize(targetWidth)}`);

                    srcSetParts.push(`${currentSrc} ${ratio}x`);
                });

                srcset = srcSetParts.join(', ');
                if (urlWidth !== baseWidth) {
                    src = src.replace(/width=\d+/, `width=${baseWidth}`);
                    img.setAttribute('src', src);
                }
            }

            if (cacheDescriptionImages.has(src)) {
                const item = cacheDescriptionImages.get(src);
                img.style.aspectRatio = item.ratio;
                img.style.height = `${item.offsetHeight}px`;
                if (srcset) img.setAttribute('srcset', srcset);
            } else {
                img.addEventListener('load', () => {
                    if (!img.naturalHeight) return;
                    const item = {
                        ratio: +(img.naturalWidth / img.naturalHeight).toFixed(4),
                        offsetHeight: img.offsetHeight
                    };
                    cacheDescriptionImages.set(src, item);
                }, { once: true });

                if (srcset) img.setAttribute('data-srcset', srcset);
                img.setAttribute('data-src', src);
                img.removeAttribute('src');
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

        const setLinkPreview = a => {
            const icon = getIcon('civitai');
            icon.classList.add('link-preview-position');
            a.prepend(icon);
            a.classList.add('link-hover-preview', 'link-with-favicon');
            a.setAttribute('data-link-preview', '');
        };
        const fixLinkSpacing = (a) => {
            const moveOutside = (node, isStart) => {
                if (isStart) {
                    a.parentNode.insertBefore(node, a);
                } else {
                    a.parentNode.insertBefore(node, a.nextSibling);
                }
            };

            const cleanEdge = (isStart) => {
                while (true) {
                    let target = isStart ? a.firstChild : a.lastChild;
                    if (!target) break;

                    // <br>>
                    if (target.nodeName === 'BR') {
                        moveOutside(target, isStart);
                        continue;
                    }

                    // text
                    if (target.nodeType === Node.TEXT_NODE) {
                        const text = target.textContent;
                        const regex = isStart ? /^\s+/ : /\s+$/;
                        const match = text.match(regex);

                        if (match) {
                            const spaceContent = match[0];
                            if (spaceContent.length === text.length) {
                                moveOutside(target, isStart);
                            } else {
                                const remainingText = isStart ? text.slice(spaceContent.length) : text.slice(0, -spaceContent.length);
                                target.textContent = remainingText;
                                moveOutside(document.createTextNode(spaceContent), isStart);
                            }
                            continue;
                        }
                    }

                    // deep check
                    if (target.nodeType === Node.ELEMENT_NODE) {
                        const subTarget = isStart ? target.firstChild : target.lastChild;
                        if (subTarget) {
                            if (subTarget.nodeName === 'BR' || (subTarget.nodeType === Node.TEXT_NODE && /^\s*$/.test(subTarget.textContent))) {
                                a.insertBefore(subTarget, isStart ? target : target.nextSibling);
                                continue;
                            }
                        }
                    }

                    break;
                }
            };

            cleanEdge(true);    // clean start
            cleanEdge(false);   // clean end
        };

        // Add _blank and noopener to all links
        description.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            const rel = (a.rel || '').split(' ');
            if (!rel.includes('noopener')) rel.push('noopener');
            a.setAttribute('rel', rel.join(' ').trim());
            a.setAttribute('target', '_blank');
            fixLinkSpacing(a);

            // Add link preview and check url syntax
            try {
                const url = new URL(href);
                if (url.origin === CONFIG.civitai_url) {
                    if (url.pathname.startsWith('/images/')) {
                        const imageId = url.pathname.match(/\/images\/(\d+)/i)?.[1];
                        if (imageId) setLinkPreview(a);
                    } else if (url.pathname.startsWith('/models/')) {
                        const modelId = url.pathname.match(/\/models\/(\d+)/i)?.[1];
                        if (modelId) setLinkPreview(a);
                    } else {
                        // a.prepend(getIcon('civitai'));
                        // a.classList.add('link-with-favicon');
                    }
                } else if (url.protocol !== 'https:') {
                    a.classList.add('link-warning');
                    if (a.textContent) a.textContent = a.textContent; // Remove formatting inside (there may be span with text color)
                }
            } catch (_) {
                a.classList.add('link-broken');
                if (a.textContent) a.textContent = a.textContent; // Remove formatting inside (there may be span with text color)
            }
        });

        // Remove bad styles (font family, font size)
        description.querySelectorAll('span[style]').forEach(span => {
            span.style.fontSize = '';
            span.style.fontFamily = '';
            span.style.fontWeight = '';
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
                type: 'positive'
            },
            {
                exact: [ 'negative prompt', 'negative:', 'nprompt:', 'n prompt:' ],
                startsWith: [ '-prompt', '- prompt', 'negative prompt' ],
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

            const type = promptTitles.find(r => r.exact.includes(text) || r.startsWith.some(t => text.startsWith(t)))?.type;
            if (type) code.classList.add('prompt', `prompt-${type}`);
        });

        // If a block of code has a lot of commas, it's probably a prompt block
        description.querySelectorAll('code:not(.prompt)').forEach(code => {
            const text = code.textContent;
            const count = calcCharsInString(text, ',', 3);

            if (count > 3) code.classList.add('prompt');
            else if (text.indexOf('\n') !== -1) {
                code.classList.add('code-block');
                return;
            }
        });

        if (!SETTINGS.disablePromptFormatting) description.querySelectorAll('code.prompt').forEach(this.#analyzePromptCode);
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
        const updateCurrentWeight = (weightChange, bracketItem) => {
            bracketItem.sum = +(bracketItem.sum * weightChange).toFixed(6);
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
            const sum = +((currentBracket?.sum ?? 1) * strength).toFixed(6);
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
                if (isURL(value)) insertElement('a', weightContainer, { class: 'link', href: value, target: '_blank', rel: 'noopener' }, value);
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


        /* ---------- DOM ---------- */

        const cache = new Map();
        const colorRe = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/;
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
                if (cached) span.style.color = cached;
                return;
            }

            const m = color.match(colorRe);
            if (!m) return;
            const rgb = { r: +m[1], g: +m[2], b: +m[3] };

            let finalBg = bgRGB
            const mBg = bgColor?.match(colorRe);
            if (mBg) {
                const bgAlpha = mBg[4] !== undefined ? parseFloat(mBg[4]) : 1;
                if (bgAlpha === 0) finalBg = bgRGB;
                else if (bgAlpha < 1) finalBg = blend({ r: +mBg[1], g: +mBg[2], b: +mBg[3] }, bgRGB, bgAlpha);
                else finalBg = { r: +mBg[1], g: +mBg[2], b: +mBg[3] };
            }

            const corrected = correctColor(rgb, finalBg, targetLС);
            if (!corrected) {
                cache.set(colorKey, null);
                return;
            }

            const css = `rgb(${corrected.r}, ${corrected.g}, ${corrected.b})`;
            cache.set(colorKey, css);
            span.style.color = css;
        });
    }

    static #genImageGenerationMeta(meta) {
        const container = createElement('div', { class: 'generation-info' });

        // Remix of
        if (meta?.extra?.remixOfId) {
            const remixContainer = insertElement('a', container, { class: 'meta-remixOfId badge' });

            const inertRemixImage = media => {
                console.log('Remix of', media);

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
                titleContainer.appendChild(this.#genUserBlock({ username: media.username }));

                // Stats
                const statsList = [
                    { iconString: '👍', value: media.stats.likeCount, formatter: formatNumber, unit: 'like' },
                    { iconString: '👎', value: media.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
                    { iconString: '😭', value: media.stats.cryCount, formatter: formatNumber, unit: 'cry' },
                    { iconString: '❤️', value: media.stats.heartCount, formatter: formatNumber, unit: 'heart' },
                    { iconString: '🤣', value: media.stats.laughCount, formatter: formatNumber, unit: 'laugh' },
                ];

                const statsFragment = this.#genStats(statsList, true);

                // NSFW LEvel
                if (media.nsfwLevel !== 'None') {
                    const nsfwBadge = createElement('div', { class: 'image-nsfw-level badge', 'data-nsfw-level': media.nsfwLevel }, media.nsfwLevel);
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
            { keys: ['cfgScale'], label: 'CFG', format: v => +Number(v).toFixed(4) },
            { keys: ['sampler'], label: 'Sampler' },
            { keys: ['Schedule type', 'scheduler'], label: 'Scheduler' },
            { keys: ['Shift'], label: 'Shift' },
            { keys: ['clipSkip'], label: 'Clip Skip' },
            { keys: ['RNG'], label: 'RNG' },
            { keys: ['Denoising strength', 'denoise'], label: 'Denoising', format: v => +Number(v).toFixed(4) },
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

            const related = Object.keys(meta).filter(k => k.startsWith(prefix));
            const tooltip = related.map(k => {
                const cleanK = k.replace(prefix, '').trim();
                let valueString, valueType;
                if (typeof meta[k] === 'object') {
                    valueString = JSON.stringify(meta[k], null, '  ');
                    valueType = 'json';
                } else {
                    valueString = String(meta[k]);
                    valueType = 'string';
                }
                return `<tr><td>${escapeHtml(cleanK)}</td><td class="value-${valueType}">${escapeHtml(valueString)}</td></tr>`;
            }).join('');

            const item = renderItem(label, meta[mainKey]);

            const scaleKey = prefix + ' upscale';
            if (meta[scaleKey]) insertElement('i', item, undefined, ` x${meta[scaleKey]}`);

            if (tooltip) {
                item.setAttribute('lilpipe-text', `<table class='tooltip-table-only'>${tooltip}</table>`);
                item.setAttribute('lilpipe-type', 'meta-adetailer');
            }

            related.forEach(k => usedKeys.add(k));
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
        const resourceHashes = new Set();
        const resources = [];
        const hashSizes = [ 8, 10, 12, 64 ];
        const addResourceToList = resource => {
            if (resource.name?.startsWith('urn:') && !resource.modelVersionId) resource.modelVersionId = +resource.name.substring(resource.name.lastIndexOf('@') + 1);
            const key = resource.hash && hashSizes.some(n => resource.hash.length === n) ? resource.hash : resource.modelVersionId;
            if (!key || resourceHashes.has(key)) return;
            resourceHashes.add(key);
            resources.push({ ...resource });
        };
        meta.civitaiResources?.forEach(addResourceToList);
        meta.resources?.forEach(addResourceToList);
        meta.additionalResources?.forEach(addResourceToList);
        if (meta.hashes) Object.keys(meta.hashes).forEach(key => addResourceToList({ hash: meta.hashes[key], name: key }));
        // if (meta['TI hashes']) Object.keys(meta['TI hashes'])?.forEach(key => addResourceToList({ hash: meta['TI hashes'][key], name: key })); // There always seem to be no models for these hashes on CivitAI // The image where this key was seen: 82695882
        if (meta['Model hash']) addResourceToList({ hash: meta['Model hash'], name: meta['Model'] });

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
                if (weight !== 1) {
                    const weightRounded = +weight.toFixed(4);
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
                console.log('Loaded resources', items);

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
            resources.forEach(item => {
                const modelKey = String(item.modelVersionId || item.hash || '').toUpperCase();
                let modelInfo = undefined;
                if (modelKey && this.#cache.modelVersions.has(modelKey)) {
                    modelInfo = this.#cache.modelVersions.get(modelKey);
                }

                const el = createResourceRowContent({
                    title: modelInfo?.model?.name || item.name || (item.modelVersionId ? `VersionId: ${item.modelVersionId}` : undefined) || (item.hash ? `Hash: ${item.hash}` : undefined) || 'Unknown',
                    version: modelInfo?.name || item.modelVersionName,
                    weight: item.weight,
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

    static #genModelCard(model, options) {
        // Note: Adds a "modelUpdatedRecently" field to the model object
        const { isVisible = false, firstDraw = false, itemWidth, itemHeight, timestump = null, forceAutoplay = false, version = null } = options ?? {};
        const modelVersion = version ? model.modelVersions.find(v => v.name === version || v.id === Number(version)) ?? model.modelVersions[0] : model.modelVersions[0];
        const card = createElement('a', { class: 'card model-card', 'data-id': model.id, href: `#models?model=${model.id}&version=${encodeURIComponent(modelVersion.name)}`, style: `width: ${itemWidth}px; height: ${itemHeight}px;`, 'data-draggable-title': `${model.name} | ${modelVersion.name}` });
        
        // Image
        const previewMedia = modelVersion.images?.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
        if (previewMedia) {
            const mediaElement = this.#genMediaElement({ media: previewMedia, width: itemWidth, height: itemHeight, target: 'model-card', decoding: 'async', defer: isVisible ? firstDraw ? -1 : 2 : 8, timestump, autoplay: forceAutoplay || SETTINGS.autoplay, forceBlurhash: true });
            mediaElement.classList.add('card-background');
            if (!SETTINGS.autoplay) {
                if (previewMedia?.type === 'image') mediaElement.classList.remove('image-hover-play');
                else if (previewMedia?.type === 'video') {
                    mediaElement.classList.remove('video-hover-play');
                    card.classList.add('video-hover-play');
                }
                card.classList.add('image-hover-play');
            }
            card.appendChild(mediaElement);
        } else if (modelVersion.images?.length) {
            const cardBackgroundWrap = insertElement('div', card, { class: 'card-background nsfw-blur-hash' });
            const noMedia = insertElement('div', cardBackgroundWrap, { class: 'media-element nsfw-filter' });
            const closestNSFWLevel = Math.min(...modelVersion.images.map(m => m.nsfwLevel));
            const closestMedia = modelVersion.images.find(m => m.nsfwLevel === closestNSFWLevel);
            const nsfwLabel = this.#convertNSFWLevelToString(closestMedia.nsfwLevel);
            insertElement('div', noMedia, { class: 'image-nsfw-level badge', 'data-nsfw-level': nsfwLabel }, nsfwLabel);
            const ratio = closestMedia.width / closestMedia.height;
            const blurSize = CONFIG.appearance.blurHashSize;
            const blurW = ratio > 1 ? Math.round(blurSize * ratio) : blurSize;
            const blurH = ratio > 1 ? blurSize : Math.round(blurSize / ratio);
            const blurUrl = closestMedia.hash ? `${CONFIG.local_urls.blurHash}?hash=${encodeURIComponent(closestMedia.hash)}&width=${blurW}&height=${blurH}` : '';
            if (blurUrl) cardBackgroundWrap.style.backgroundImage = `url(${blurUrl})`;
        } else {
            const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
            const noMedia = insertElement('div', cardBackgroundWrap, { class: 'media-element no-media' });
            noMedia.appendChild(getIcon('image'));
            insertElement('span', noMedia, undefined, window.languagePack?.errors?.no_media ?? 'No Media');
        }

        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });
        const cardContentBottom = insertElement('div', cardContentWrap);

        // Model Type
        const modelTypeBadges = insertElement('div', cardContentTop, { class: 'badges model-type-badges' });
        const modelTypeWrap = insertElement('div', modelTypeBadges, { class: 'badge model-type', 'lilpipe-text': escapeHtml(`${model.type} | ${this.#models.labels[modelVersion.baseModel] ?? modelVersion.baseModel ?? '?'}`) }, `${this.#types.labels[model.type] || model.type} | ${this.#models.labels_short[modelVersion.baseModel] ?? modelVersion.baseModel ?? '?'}`);

        // Availability
        let availabilityBadge = null;
        if (modelVersion.availability !== 'Public') availabilityBadge = modelVersion.availability;
        else {
            if (model.modelUpdatedRecently === undefined) model.modelUpdatedRecently = model.modelVersions.find(version => (version.publishedAt ?? version.createdAt) > CONFIG.minDateForNewBadge);
            if (model.modelUpdatedRecently) availabilityBadge = model.modelVersions.length > 1 ? 'Updated' : 'New';
        }
        if (availabilityBadge) {
            const badge = insertElement('div', modelTypeBadges, { class: 'badge model-availability', 'data-badge': availabilityBadge }, window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge);
            if (modelVersion.availability === 'Public' && model.modelUpdatedRecently) {
                const publishedAt = new Date(model.modelUpdatedRecently.publishedAt ?? model.modelUpdatedRecently.createdAt);
                const lilpipeText = `<b>${escapeHtml(model.modelUpdatedRecently.name || '')}</b><br>${escapeHtml(timeAgo(Math.round((Date.now() - publishedAt)/1000)))}`;
                badge.setAttribute('lilpipe-text', lilpipeText);
            }
        }

        // Creator
        if (model.creator) cardContentBottom.appendChild(this.#genUserBlock({ image: model.creator.image, username: model.creator.username }));

        // Model Name
        insertElement('div', cardContentBottom, { class: 'model-name' }, model.name);

        // Stats
        const statsSource = SETTINGS.showCurrentModelVersionStats ? modelVersion.stats : model.stats;
        const statsContainer = this.#genStats([
            { icon: 'download', value: statsSource.downloadCount, formatter: formatNumber, unit: 'download' },
            { icon: 'like', value: statsSource.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'chat', value: model.stats.commentCount, formatter: formatNumber, unit: 'comment' },
            // { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
        ]);
        cardContentBottom.appendChild(statsContainer);

        return card;
    }

    static #genImageCard(image, options) {
        let postSize = 1;
        if (image instanceof Set) {
            postSize = image.size;
            image = image.values().next().value;
        };

        const { isVisible = false, firstDraw = false, itemWidth, timestump = null, forceAutoplay = false } = options ?? {};
        const draggableTitle = (window.languagePack?.text?.image_by ?? 'Image by {username}').replace('{username}', image.username || 'user');
        const itemHeight = options.itemHeight ?? (itemWidth / (image.width/image.height));
        const card = createElement('a', { class: 'card image-card', 'data-id': image.id, href: `#images?image=${encodeURIComponent(image.id)}&nsfw=${image.browsingLevel ? this.#convertNSFWLevelToString(image.browsingLevel) : image.nsfw}`, style: `width: ${itemWidth}px; height: ${itemHeight}px;`, 'data-draggable-title': draggableTitle });

        // Image
        const mediaElement = this.#genMediaElement({ media: image, width: itemWidth, target: 'image-card', decoding: 'async', defer: isVisible ? firstDraw ? -1 : 2 : 8, timestump, autoplay: forceAutoplay || SETTINGS.autoplay, forceBlurhash: true });
        mediaElement.classList.add('card-background');
        if (!SETTINGS.autoplay) {
            if (image?.type === 'image') mediaElement.classList.remove('image-hover-play');
            else if (image?.type === 'video') {
                mediaElement.classList.remove('video-hover-play');
                card.classList.add('video-hover-play');
            }
            card.classList.add('image-hover-play');
        }
        card.appendChild(mediaElement);

        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });

        // Creator and Created At
        const creator = this.#genUserBlock({ username: image.username, group: image.usergroup ?? null });
        if (image.createdAt) {
            const createdAt = new Date(image.createdAt);
            insertElement('span', creator, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
        }
        cardContentTop.appendChild(creator);

        // Badges (NSFW Level and Has Meta)
        const badgesContainer = insertElement('div', cardContentTop, { class: 'badges other-badges' });
        if (image.nsfwLevel !== 'None') insertElement('div', badgesContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': image.nsfwLevel }, image.nsfwLevel);
        if (postSize > 1) {
            const metaIconContainer = insertElement('div', badgesContainer, { class: 'badge' }, postSize);
            metaIconContainer.appendChild(getIcon('image'));
        }
        if (image.meta) {
            const metaIconContainer = insertElement('div', badgesContainer, { class: 'image-meta badge', 'lilpipe-text': escapeHtml(window.languagePack?.text?.hasMeta ?? 'Generation info') });
            metaIconContainer.appendChild(getIcon('information'));
        }

        // Stats
        const statsContainer = this.#genStats([
            { iconString: '👍', value: image.stats.likeCount, formatter: formatNumber, unit: 'like' },
            { iconString: '👎', value: image.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
            { iconString: '😭', value: image.stats.cryCount, formatter: formatNumber, unit: 'cry' },
            { iconString: '❤️', value: image.stats.heartCount, formatter: formatNumber, unit: 'heart' },
            { iconString: '🤣', value: image.stats.laughCount, formatter: formatNumber, unit: 'laugh' },
            { icon: 'chat', value: image.stats.commentCount, formatter: formatNumber, unit: 'comment' },
        ], true);
        cardContentWrap.appendChild(statsContainer);

        return card;
    }

    static #genUserBlock(userInfo) {
        const container = createElement('div', { class: 'user-info' });

        const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
        if (userInfo.image !== undefined) {
            if (userInfo.image) {
                const src = `${userInfo.image.replace(/\/width=\d+\//, `/width=${this.#getNearestServerSize(creatorImageSize)}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop${SETTINGS.autoplay ? '' : '&format=webp'}&target=user-image`;

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

        const usernameText = userInfo.url
            ? insertElement('a', container, { href: userInfo.url }, userInfo.username)
            : insertElement('span', container, undefined, userInfo.username);

        if (userInfo.group) {
            if (userInfo.group === 'OP') insertElement('div', usernameText, { class: 'badge user-group', 'data-group': 'OP' }, 'OP');
        }

        return container;
    }

    static #genMediaElement(options) {
        const { media, autoplay = SETTINGS.autoplay } = options;
        const ratio = media.width / media.height;
        const mediaContainer = createElement('div', { class: 'media-container loading', 'data-id': media.id ?? -1, 'data-nsfw-level': media.nsfwLevel, style: `aspect-ratio: ${+(ratio).toFixed(4)};` });
        let mediaElement;

        if (media.type === 'image') {
            if (!autoplay && !options.original) mediaContainer.classList.add('image-hover-play');
            mediaContainer.classList.add('media-image');
        } else if (media.type === 'video') {
            if (autoplay) {
                mediaContainer.classList.add('media-video', 'video-autoplay');
            } else {
                mediaContainer.classList.add('media-video', 'video-hover-play');
                const videoPlayButton = insertElement('div', mediaContainer, { class: 'video-play-button' });
                videoPlayButton.appendChild(getIcon('play'));
            }
        }

        if (options.loading === 'lazy') {
            onTargetInViewport(mediaContainer, () => this.#finishLoading(mediaContainer, options));
        } else if (options.defer >= 0) {
            this.#queueAddPipeline(
                { delay: options.defer, prefix: options.timestump || 'src-load' },
                () => !this.appElement.contains(mediaContainer),
                skip => skip ? null : this.#finishLoading(mediaContainer, options)
            );
        } else {
            mediaElement = this.#finishLoading(mediaContainer, options);
        }

        // forceBlurhash - This is necessary for the first rendering when navigating
        //   (otherwise the image will have the dimensions, but will not be rendered on the first frame, and there will be empty space)
        // Problem: This check works even if the image is not ready (not decoded) yet
        if (options.forceBlurhash || !mediaElement || !mediaElement.complete || mediaElement.naturalWidth === 0) {
            if (media.hash) {
                const blurSize = CONFIG.appearance.blurHashSize;
                const blurW = ratio > 1 ? Math.round(blurSize * ratio) : blurSize;
                const blurH = ratio > 1 ? blurSize : Math.round(blurSize / ratio);
                const previewUrl = `${CONFIG.local_urls.blurHash}?hash=${encodeURIComponent(media.hash)}&width=${blurW}&height=${blurH}`;
                mediaContainer.style.backgroundImage = `url(${previewUrl})`;
            }
        } else {
            mediaContainer.classList.remove('loading');
        }
        return mediaContainer;
    }

    static #finishLoading(mediaContainer, options) {
        const { media, width, height = undefined, loading = 'auto', target = null, controls = false, original = false, autoplay = SETTINGS.autoplay, decoding = 'auto', allowAnimated = false, playsinline = true } = options;
        const ratio = media.width / media.height;
        const widthNeededForWidth = width || 0;
        const widthNeededForHeight = height ? (height * ratio) : 0;
        const targetWidth = Math.round(Math.max(widthNeededForWidth, widthNeededForHeight) * this.#devicePixelRatio);
        const size = `width=${this.#getNearestServerSize(targetWidth)}`;
        const paramString = target ? (`?target=${target}`) : '';
        const widthString = original ? '/original=true/' : `/${size},anim=false,optimized=true/`;
        const urlBase = media.url.includes('/original=true/') ? media.url.replace('/original=true/', widthString) : replace(/\/width=\d+\//, widthString);
        const url = `${urlBase}${paramString}`;
        const mediaElement = createElement('img', { class: 'media-element',  alt: ' ', crossorigin: 'anonymous' });
        let src;

        if (media.type === 'image') {
            src = original ? url : (autoplay || allowAnimated ? url.replace(/anim=false,?/, '') : url);

            if (!autoplay && !original) {
                mediaElement.classList.add('image-possibly-animated');
            }
        } else if (media.type === 'video') {
            // Video does not need any local parameters (video elements are skipped in sw)
            const source = original ? urlBase : urlBase.replace('optimized=true', 'optimized=true,transcode=true');
            const poster = src = `${source}${paramString}`;
            const videoSrc = source.replace(/anim=false,?/, '');

            mediaContainer.setAttribute('data-src', videoSrc);
            mediaContainer.setAttribute('data-poster', poster);
            mediaContainer.setAttribute('data-timestump', 0);
            if (playsinline) mediaContainer.setAttribute('data-playsinline', true);
            if (controls) mediaContainer.setAttribute('data-controls', true);

            if (autoplay) enableAutoPlayOnVisible(mediaContainer);
        }

        if (loading === 'eager') mediaElement.loading = loading;
        if (decoding === 'sync' || decoding === 'async') mediaElement.decoding = decoding;

        if (src) mediaElement.setAttribute('src', src);

        mediaElement.style.aspectRatio = +(ratio).toFixed(4);
        // if (resize) mediaContainer.setAttribute('data-resize', `${targetWidth}:${targetHeight || Math.round(targetWidth / ratio)}`);
        mediaContainer.prepend(mediaElement);
        return mediaElement;
    }

    static #genMediaPreviewFromPrevPage(mediaElement, mediaId) {
        const previewImageOriginal = this.appElement.querySelector(`.media-container[data-id="${mediaId}"]:not(.loading) .media-element`);
        const previewImage = previewImageOriginal?.cloneNode(true);
        if (!previewImage) return;

        const fullMedia = mediaElement.querySelector('.media-element');
        const isImage = fullMedia?.tagName === 'IMG';
        if (!fullMedia) return;

        const previewWrap = createElement('div', { class: 'media-preview-wrapper' });
        previewImage.classList.add('media-preview-image');
        previewImage.setAttribute('inert', '');
        previewWrap.appendChild(previewImage);
        if (previewImage.tagName === 'VIDEO' && !previewImage.paused) previewImage.pause();
        if (previewImage.tagName === 'CANVAS') {
            const ctx = previewImage.getContext('2d');
            ctx.drawImage(previewImageOriginal, 0, 0);
        }
        insertElement('div', previewWrap, { class: 'media-loading-indicator' });

        let isReady = false;
        const onFullMediaReady = () => {
            if (isReady) return;
            isReady = true;
            animateElement(previewWrap, {
                keyframes: { opacity: [1, 0] },
                duration: 200,
                easing: 'ease'
            }).then(() => previewWrap.remove());
        };
        const waitForReady = async () => {
            if (!mediaElement.contains(fullMedia)) {
                onFullMediaReady();
                return;
            }

            const cleanup = () => {
                fullMedia.removeEventListener('load', onload);
                fullMedia.removeEventListener('loadeddata', onload);
                observer.disconnect();
            };
            const onload = async () => {
                cleanup();
                if (isImage) await fullMedia.decode?.().catch(() => {});
                requestAnimationFrame(onFullMediaReady);
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
            if (isImage) {
                if (fullMedia.complete && fullMedia.naturalWidth !== 0) onload();
                else fullMedia.addEventListener('load', onload, { once: true });
            } else {
                if (fullMedia.readyState >= 2) onload();
                else {
                    // since the video may have preload=none, need to track at least the loading of the poster
                    const posterUrl = fullMedia.poster;
                    if (posterUrl) {
                        const posterImg = new Image();
                        posterImg.addEventListener('load', onload, { once: true });
                        posterImg.src = posterUrl;
                    }

                    fullMedia.addEventListener('loadeddata', onload, { once: true });
                }
            }
        };

        mediaElement.prepend(previewWrap);
        waitForReady();
    }

    static #genImagesListFilters(onAnyChange) {
        const filterWrap = createElement('div', { class: 'list-filters' });

        // Metadata filters
        const { container: metadataContiner } = this.#genDropdownFilter(filterWrap);

        // Group posts
        const groupImagesByPost = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.groupImagesByPost = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.groupImagesByPost,
            label: window.languagePack?.text?.group_posts ?? 'Group posts'
        });
        groupImagesByPost.element.classList.add('list-filter');
        metadataContiner.appendChild(groupImagesByPost.element);

        // Hide without positive prompt
        const requiredPositivePrompt = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.hideImagesWithoutPositivePrompt = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.hideImagesWithoutPositivePrompt,
            label: window.languagePack?.text?.hideWithoutPositivePrompt ?? 'Hide without positive prompt'
        });
        requiredPositivePrompt.element.classList.add('list-filter');
        metadataContiner.appendChild(requiredPositivePrompt.element);

        // Hide without negative prompt
        const requiredNegativePrompt = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.hideImagesWithoutNegativePrompt = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.hideImagesWithoutNegativePrompt,
            label: window.languagePack?.text?.hideWithoutNegativePrompt ?? 'Hide without negative prompt'
        });
        requiredNegativePrompt.element.classList.add('list-filter');
        metadataContiner.appendChild(requiredNegativePrompt.element);

        // Hide without negative prompt
        const requiredResources = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.hideImagesWithoutResources = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.hideImagesWithoutResources,
            label: window.languagePack?.text?.hideImagesWithoutResources ?? 'Hide without resources'
        });
        requiredResources.element.classList.add('list-filter');
        metadataContiner.appendChild(requiredResources.element);


        // Sort list
        const sortOptions = [ "Most Reactions", "Most Comments", "Most Collected", "Newest", "Oldest" ]; // "Random": Random sort requires a collectionId
        const sortList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.sort_images = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.sort_images,
            options: sortOptions,
            label: window.languagePack?.text?.sort ?? 'Sort',
            labels: Object.fromEntries(sortOptions.map(value => [ value, window.languagePack?.text?.sortOptions?.[value] ?? value ]))
        });
        sortList.element.classList.add('list-filter');
        filterWrap.appendChild(sortList.element);

        // Period list
        const periodOptions = [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ];
        const periodList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.period_images = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.period_images,
            options: periodOptions,
            label: window.languagePack?.text?.period ?? 'Pediod',
            labels: Object.fromEntries(periodOptions.map(value => [ value, window.languagePack?.text?.periodOptions?.[value] ?? value ]))
        });
        periodList.element.classList.add('list-filter');
        filterWrap.appendChild(periodList.element);

        // NSFW list
        const browsingLevels = {
            'None': 1,
            'Soft': 2,
            'Mature': 4,
            'X': 16,
            'true': 32,
        };
        const nsfwOptions = [ 'None', 'Soft', 'Mature', 'X', 'true' ];
        const nsfwList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.nsfwLevel = newValue;
                SETTINGS.browsingLevel = browsingLevels[newValue] ?? 4;
                SETTINGS.nsfw = SETTINGS.browsingLevel >= 4;
                onAnyChange?.();
            },
            value: SETTINGS.nsfwLevel,
            options: nsfwOptions,
            label: window.languagePack?.text?.nsfw ?? 'NSFW',
            labels: Object.fromEntries(nsfwOptions.map(value => [ value, window.languagePack?.text?.nsfwOptions?.[value] ?? value ]))
        });
        nsfwList.element.classList.add('list-filter');
        filterWrap.appendChild(nsfwList.element);

        return filterWrap;
    }

    static #genModelsListFilters(onAnyChange) {
        const filterWrap = createElement('div', { class: 'list-filters' });

        // Appearance filters
        const { container: appearanceContiner } = this.#genDropdownFilter(filterWrap);

        // Use statistics from the current version of the model
        const showCurrentModelVersionStats = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.showCurrentModelVersionStats = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.showCurrentModelVersionStats,
            label: window.languagePack?.text?.stats_from_version ?? 'Statistics for this version'
        });
        showCurrentModelVersionStats.element.classList.add('list-filter');
        appearanceContiner.appendChild(showCurrentModelVersionStats.element);

        // Models list
        const modelsOptions = [ "All", ...this.#models.options ];
        const modelLabels = Object.fromEntries(modelsOptions.map(value => [ value, window.languagePack?.text?.modelLabels?.[value] ?? this.#models.labels[value]  ?? value ]));
        const modelsList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.baseModels = newValue === 'All' ? [] : [ newValue ];
                onAnyChange?.();
            },
            value: SETTINGS.baseModels.length ? (SETTINGS.baseModels.length > 1 ? SETTINGS.baseModels : SETTINGS.baseModels[0]) : 'All',
            options: modelsOptions,
            label: window.languagePack?.text?.model ?? 'Model',
            tags: this.#models.tags,
            labels: modelLabels
        });
        modelsList.element.classList.add('list-filter');
        filterWrap.appendChild(modelsList.element);

        // Types list
        const typeOptions = [ "All", ...this.#types.options];
        const typeLabels = Object.fromEntries(typeOptions.map(value => [ value, window.languagePack?.text?.typeOptions?.[value] ?? this.#types.labels[value] ?? value ]));
        const typesList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.types = newValue === 'All' ? [] : [ newValue ];
                onAnyChange?.();
            },
            value: SETTINGS.types.length ? (SETTINGS.types.length > 1 ? SETTINGS.types : SETTINGS.types[0]) : 'All',
            options: typeOptions,
            label: window.languagePack?.text?.type ?? 'Type',
            labels: typeLabels
        });
        typesList.element.classList.add('list-filter');
        filterWrap.appendChild(typesList.element);

        // Trained or merged
        const trainedOrMergedOptions = [ 'All', 'Trained', 'Merge' ];
        const trainedOrMergedLabels = Object.fromEntries(trainedOrMergedOptions.map(value => [ value, window.languagePack?.text?.checkpointTypeOptions?.[value] ?? value ]));
        const trainedOrMergedList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.checkpointType = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.checkpointType,
            options: trainedOrMergedOptions,
            label: window.languagePack?.text?.origin ?? 'Origin',
            labels: trainedOrMergedLabels
        });
        trainedOrMergedList.element.classList.add('list-filter');
        filterWrap.appendChild(trainedOrMergedList.element);

        // Sort list
        const sortOptions = [ "Highest Rated", "Most Downloaded", "Most Liked", "Most Discussed", "Most Collected", "Most Images", "Newest", "Oldest" ];
        const sortList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.sort = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.sort,
            options: sortOptions,
            label: window.languagePack?.text?.sort ?? 'Sort',
            labels: Object.fromEntries(sortOptions.map(value => [ value, window.languagePack?.text?.sortOptions?.[value] ?? value ]))
        });
        sortList.element.classList.add('list-filter');
        filterWrap.appendChild(sortList.element);

        // Period list
        const periodOptions = [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ];
        const periodList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.period = newValue;
                onAnyChange?.();
            },
            value: SETTINGS.period,
            options: periodOptions,
            label: window.languagePack?.text?.period ?? 'Pediod',
            labels: Object.fromEntries(periodOptions.map(value => [ value, window.languagePack?.text?.periodOptions?.[value] ?? value ]))
        });
        periodList.element.classList.add('list-filter');
        filterWrap.appendChild(periodList.element);

        // NSFW list
        const browsingLevels = {
            'None': 1,
            'Soft': 2,
            'Mature': 4,
            'X': 16,
            'true': 32,
        };
        const nsfwOptions = [ 'None', 'Soft', 'Mature', 'X', 'true' ];
        const nsfwList = this.#genList({
            onchange: ({ newValue }) => {
                SETTINGS.nsfwLevel = newValue;
                SETTINGS.browsingLevel = browsingLevels[newValue] ?? 4;
                SETTINGS.nsfw = SETTINGS.browsingLevel >= 4;
                onAnyChange?.();
            },
            value: SETTINGS.nsfwLevel,
            options: nsfwOptions,
            label: window.languagePack?.text?.nsfw ?? 'NSFW',
            labels: Object.fromEntries(nsfwOptions.map(value => [ value, window.languagePack?.text?.nsfwOptions?.[value] ?? value ]))
        });
        nsfwList.element.classList.add('list-filter');
        filterWrap.appendChild(nsfwList.element);

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
        let isClosed = true;
        button.addEventListener('click', e => {
            if (e.target.closest('.list-filter-dropdown-container')) return;
            isClosed = !isClosed;
            button.classList.toggle('closed', isClosed);
            if (!isClosed) {
                const offsetRight = button.offsetParent.offsetWidth - (button.offsetLeft + button.offsetWidth);
                const width = container.offsetWidth;
                const targetOffsetRight = offsetRight + button.offsetWidth / 2 - width / 2;
                const windowWidth = window.innerWidth;
                const aviableOffsetRight = targetOffsetRight < 0 ? 16 : targetOffsetRight + width >= windowWidth ? windowWidth - width - 16 : targetOffsetRight;
                const offsetX = aviableOffsetRight - targetOffsetRight;
                container.style.top = `${button.offsetTop + button.offsetHeight + 8}px`;
                container.style.right = `${aviableOffsetRight}px`;
                container.style.setProperty('--offsetX', `${offsetX}px`);
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
        const levels = [
            { minLevel: 32, string: 'Blocked' },
            { minLevel: 16, string: 'X' },
            { minLevel: 8, string: 'X' },
            { minLevel: 4, string: 'Mature' },
            { minLevel: 2, string: 'Soft' },
            { minLevel: 0, string: 'None' },
        ]

        return levels.find(lvl => lvl.minLevel <= nsfwLevel)?.string ?? 'true';
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

    static #clearAppElement() {
        this.appElement.querySelectorAll('.user-info img[src]:not([data-original-active])').forEach(img => {
            img.remove(); // Unpin the element from the old tree (otherwise it will also remain in memory)
            this.#cachedUserImages.get(img.getAttribute('src')).add(img);
        });
        this.appElement.textContent = '';
    }

    static #queueAddPipeline(optionsOrFn, ...fns) {
        let options = {};
        if (typeof optionsOrFn === "function") {
            fns.unshift(optionsOrFn);
        } else if (optionsOrFn && typeof optionsOrFn === "object") {
            options = optionsOrFn;
        }

        if (!fns.length) return;

        const pipeline = { fns };

        // gen key
        const key = `${options.prefix || ''}${options.frames ? `f${options.frames}` : `d${options.delay ?? 0}`}`;

        let group = this.#groups.get(key);
        if (!group) {
            group = { list: [], timer: null, options };
            this.#groups.set(key, group);
            this.#scheduleGroup(group, key);
        }

        group.list.push(pipeline);
    }

    static #scheduleGroup(group, key) {
        const { options } = group;

        if (options.frames) {
            let framesLeft = options.frames;
            const frameLoop = () => {
                if (--framesLeft <= 0) {
                    this.#runGroup(group, key);
                } else {
                    group.timer = requestAnimationFrame(frameLoop);
                }
            };
            group.timer = requestAnimationFrame(frameLoop);
        } else {
            const delay = options.delay ?? 0;
            group.timer = setTimeout(() => {
                this.#runGroup(group, key);
            }, delay);
        }
    }

    static #runGroup(group, key) {
        const pipelines = group.list;
        this.#groups.delete(key);

        let results = new Array(pipelines.length).fill(undefined);
        let step = 0;

        while (true) {
            let hasWork = false;

            for (let i = 0; i < pipelines.length; i++) {
                const fn = pipelines[i].fns[step];
                if (fn) {
                    hasWork = true;
                    try {
                        results[i] = fn(results[i]);
                    } catch (e) {
                        console.error("Pipeline error:", e);
                        results[i] = undefined;
                    }
                }
            }

            if (!hasWork) break;
            step++;
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

    static onScroll(scrollTop) {
        this.#state.scrollTop = scrollTop;
        this.#state.scrollTopRelative = this.#onScroll?.({ scrollTop }) ?? null;
    }

    static onResize() {
        const windowWidth = window.innerWidth;
        if (windowWidth < 950) CONFIG.appearance = CONFIG.appearance_small;
        else CONFIG.appearance = CONFIG.appearance_normal;
        this.#onResize?.();
    }

    static get state() {
        return {...this.#state};
    }
}

// ==============================

const videPlaybackObservedElements = new Set();
const videPlaybackObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const mediaContainer = entry.target;
        if (entry.isIntersecting) {
            mediaContainer.setAttribute('data-autoplay', '');
            playVideo(mediaContainer, 'data-autoplay');
        } else {
            pauseVideo(mediaContainer);
            mediaContainer.removeAttribute('data-autoplay');
        }
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
}, { threshold: 0.01, rootMargin: '300px 0px' });

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
        } catch (err) {
            resolve({ ok: false, error: err });
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
    } catch(_) {
        console.error(_);
    }
}

function gotoLocalLink(hash) {
    const newState = { id: Date.now() };
    if (hash !== location.hash) {
        history.replaceState(Controller.state, '', location.hash);
        history.pushState(newState, '', hash);
    }
    Controller.gotoPage(hash, newState);
}

function onBodyClick(e) {
    if (e.altKey) {
        const href = e.target.closest('a[href]')?.getAttribute('href');
        if (href) {
            const localUrl = Controller.convertCivUrlToLocal(href);
            if (localUrl) {
                e.preventDefault();
                gotoLocalLink(localUrl);
                return;
            }
        }
    }

    if (e.ctrlKey) return;

    const href = e.target.closest('a[href^="#"]:not([target="_blank"])')?.getAttribute('href');
    if (href) {
        e.preventDefault();
        gotoLocalLink(href);
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
    }, 100);

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
        const preview = e.target.closest('[data-link-preview]:not([lilpipe-showed])');
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
    // const preview = e.target.closest('[data-link-preview]:not([lilpipe-showed])');
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
        Array.from(document.querySelectorAll('video[muted][loop][data-autoplay]')).forEach(video => video.play().catch(() => null));
        if (!cacheClearTimer) {
            tryClearCache();
            cacheClearTimer = setInterval(tryClearCache, 60000);
        }
    } else {
        Array.from(document.querySelectorAll('video[muted][loop][data-autoplay]')).forEach(video => video.pause());
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

const pendingMedia = new Set();
let batchTimer = null;
function markMediaAsLoadedWhenReady(el) {
    if (!el.parentElement?.classList.contains('loading')) return;

    const tag = el.tagName;
    if (tag !== 'IMG' && tag !== 'VIDEO') return;

    pendingMedia.add(el);

    if (batchTimer) return;
    batchTimer = requestAnimationFrame(() => {
        batchTimer = null;
        const readyImages = [];
        const instantMedia = [];

        for (const media of pendingMedia) {
            if (!document.body.contains(media)) continue;
            if (media.tagName === 'IMG') readyImages.push(media);
            else instantMedia.push(media);
        }
        pendingMedia.clear();

        // videos
        for (const media of instantMedia) {
            media.parentElement.classList.remove('loading');
            media.parentElement.style.backgroundImage = '';
        }

        // images (Waiting to eliminate possible flickering)
        if (readyImages.length) {
            setTimeout(() => {
                readyImages.filter(img => document.body.contains(img)).forEach(img => {
                    img.parentElement.classList.remove('loading');
                    img.parentElement.style.backgroundImage = '';
                });
            }, 180);
        }
    });
}
function onMediaElementLoaded(e) {
    markMediaAsLoadedWhenReady(e.target);
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
        } catch(_) {
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
    const redirectUrl = Controller.convertCivUrlToLocal(href);
    if (redirectUrl) gotoLocalLink(redirectUrl);
    else {
        try {
            const url = new URL(href);
            if (url.origin !== location.origin) throw new Error('Unsupported url');
            gotoLocalLink(url.hash);
        } catch (_) {
            notify('Unsupported url');
        }
    }
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
    const src = mediaContainer.getAttribute('data-src');
    const timestump = mediaContainer.getAttribute('data-timestump');

    const video = createElement('video', { class: 'media-element',  muted: '', loop: '', crossorigin: 'anonymous', draggable: 'true' });
    video.volume = 0;
    video.muted = true;
    video.loop = true;
    if (mediaContainer.hasAttribute('data-playsinline')) video.playsinline = true;
    if (mediaContainer.hasAttribute('data-controls')) video.controls = true;
    video.style.aspectRatio = mediaContainer.style.aspectRatio;

    video.setAttribute('src', src);
    video.currentTime = +timestump;
    video.play().catch(() => null);

    const play = () => {
        video.removeEventListener('canplay', play);
        video.removeEventListener('error', play);
        if (!mediaContainer.hasAttribute(attrCheck)) {
            video.src = '';
            return;
        }

        const mediaElement = mediaContainer.querySelector('.media-element:not([inert])');
        mediaElement.replaceWith(video);
    };

    video.addEventListener('canplay', play, { once: true });
    video.addEventListener('error', play, { once: true });
}

function pauseVideo(mediaContainer) {
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
    canvas.style.aspectRatio = mediaContainer.style.aspectRatio;
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
    const selector = '.media-container[data-src][data-poster][data-timestump]:not([data-focus-play])';
    const container = target.matches(selector) ? target : target.querySelector(selector);
    if (!container) return;

    document.querySelectorAll('.media-container[data-focus-play]').forEach(v => stopVideoPlayEvent({target: v.closest('.video-hover-play')}));

    container.setAttribute('data-focus-play', '');

    // Delay to avoid starting loading when it is not needed, for example the user simply moved the mouse over
    setTimeout(() => {
        if (!container.hasAttribute('data-focus-play')) return;

        playVideo(container, 'data-focus-play');
    }, 200);

    target.addEventListener('blur', stopVideoPlayEvent, { passive: true });
    target.addEventListener('pointerleave', stopVideoPlayEvent, { passive: true });
}

function stopVideoPlayEvent(e) {
    const selector = '.media-container[data-focus-play]';
    const container = e.target.matches(selector) ? e.target : e.target.querySelector(selector);
    if (container) {
        pauseVideo(container);
        container.removeAttribute('data-focus-play');
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
    insertElement('div', previewElement, { class: 'media-loading-indicator' });
    let positionTarget = target.querySelector('.link-preview-position');

    const showPreview = element => {
        previewElement.classList.remove('loading');
        previewElement.textContent = '';
        previewElement.appendChild(element);
    };

    if (result instanceof Promise) {
        result.then(element => {
            if (!document.body.contains(previewElement)) return;
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

        const { left, top, width, height } = rect;

        const targetX = left + width/2 - tW/2;
        const targetY = top - tH - 8;
        const isBelow = targetY < 0;
        const newX = targetX < 0 ? 0 : targetX + tW > wW ? wW - tW - 8 : targetX;
        const newY = isBelow ? top + height + 8 : targetY;
        const offsetX = targetX - newX;

        tooltip.style.cssText = `left: ${newX}px; top: ${newY}px;${offsetX === 0 ? '' : ` --offsetX: ${offsetX}px;`}`;
        if (isBelow) tooltip.setAttribute('tooltip-below', '');

        // Animate new tooltip
        tooltip.setAttribute('data-animation', 'in');
        setTimeout(() => {
            if (tooltip.offsetParent !== null && tooltip.getAttribute('data-animation') === 'in') tooltip.removeAttribute('data-animation');
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

    const onpointerleave = () => {
        if (prevLilpipeTimer !== null) clearTimeout(prevLilpipeTimer);
        else prevLilpipeEvenetTime = Date.now();

        tooltip.setAttribute('data-animation', 'out');
        target.removeAttribute('lilpipe-showed');
        if (delay) target.removeAttribute('lilpipe-showed-delay');
        setTimeout(() => tooltip.remove?.(), 100);
    };

    if (options.fromFocus) target.addEventListener('blur', onpointerleave, { once: true, capture: true });
    else target.addEventListener('pointerleave', onpointerleave, { once: true });
}

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

    Controller.gotoPage(location.hash || '#home');
    Controller.onResize();
    history.replaceState({ id: Date.now() }, '', location.hash);

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
    document.body.addEventListener('load', onMediaElementLoaded, { capture: true, passive: true });
    document.body.addEventListener('canplay', onMediaElementLoaded, { capture: true, passive: true });
    document.body.addEventListener('dragover', onDragover);
    document.body.addEventListener('drop', onDrop);
    document.body.addEventListener('dragenter', onDragenter);
    document.body.addEventListener('dragleave', onDragleave);
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
            new Promise(resolve => setTimeout(() => resolve(false), 200))
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
