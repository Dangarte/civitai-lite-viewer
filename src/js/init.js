/// <reference path="./_docs.d.ts" />

const CONFIG = {
    version: 10,
    title: 'CivitAI Lite Viewer',
    civitai_url: 'https://civitai.com',
    api_url: 'https://civitai.com/api/v1',
    api_status_url: 'https://status.civitai.com/status/public',
    local_urls: {
        local: 'local',
        blurHash: 'local/blurhash'
    },
    langauges: [ 'en', 'ru', 'zh', 'uk' ],
    appearance: {
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
            carouselItemWidth: 450
        },
        blurHashSize: 32, // minimum size of blur preview
    },
    perRequestLimits: {
        models: 60,
        images: 180
    },
    timeOut: 20000, // 20 sec
};

const SETTINGS = {
    api_key: null,
    language: 'en',
    theme: 'default',
    autoplay: false,
    resize: false,
    checkpointType: 'All',
    types: [ 'Checkpoint' ],
    sort: 'Highest Rated',
    sort_images: 'Newest',
    period: 'Month',
    period_images: 'AllTime',
    baseModels: [],
    blackListTags: [], // Doesn't work on images (pictures don't have tags)
    nsfw: true,
    nsfwLevel: 'X',
    browsingLevel: 16,
    hideImagesWithNoMeta: true,
    disablePromptFormatting: false, // Completely disable formatting of blocks with prompts (show original content)
    disableVirtualScroll: false,    // Completely disable virtual scroll
};

Object.entries(tryParseLocalStorageJSON('civitai-lite-viewer--settings')?.settings ?? {}).forEach(([ key, value ]) => SETTINGS[key] = value);

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
            primaryFileOnly = false,
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
        if (primaryFileOnly) url.searchParams.append('primaryFileOnly', 'true');
        if (browsingLevel) url.searchParams.append('browsingLevel', browsingLevel); // ERROR: (see above)
        if (status) url.searchParams.append('status', status);

        const data = await this.#getJSON({ url, target: 'models' });
        return data;
    }

    async fetchImages(options = {}) {
        const {
            limit = 20, // 0 ... 200
            cursor,
            modelId,
            modelVersionId,
            postId,
            username = '',
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
        if (modelId) url.searchParams.append('modelId', modelId);
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

        const data = await this.#getJSON({ url, target: `image meta (id: ${id})` });
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

// TODO: ! IMPORTANT ! Fix performance on model page with autoplay
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

    static #cache = {
        images: new Map(),          // dummy cache for transferring information about images from the list to fullscreen mode
        posts: new Map(),           // dummy cache for transferring information about posts from the list to fullscreen mode
        models: new Map(),          // Cache for quickly obtaining information about models
        modelVersions: new Map(),   // Cache for quickly obtaining information about model versions
        history: new Map()          // History cache (for fast back and forth)
    };

    static #types = {
        'Checkpoint': 'Checkpoint',
        'Embedding': 'Embedding',
        'Hypernetwork': 'Hypernetwork',
        'Aesthetic Gradient': 'Aesthetic Gradient',
        'LoRa': 'LoRa',
        'LyCORIS': 'LyCORIS',
        'DoRA': 'DoRA',
        'Controlnet': 'Controlnet',
        'Upscaler': 'Upscaler',
        'Motion': 'Motion',
        'VAE': 'VAE',
        'Poses': 'Poses',
        'WildCards': 'WildCards',
        'Workflows': 'Workflows',
        'Detection': 'Detection',
        'Other': 'Other',
    };
    static #baseModels = {
        'SD 1.4': 'SD 1.4',
        'SD 1.5': 'SD 1.5',
        'SD 1.5 LCM': 'SD 1.5 LCM',
        'SD 1.5 Hyper': 'SD 1.5 H',
        'SD 2.0': 'SD 2.0',
        'SD 2.1': 'SD 2.1',
        'SDXL 1.0': 'XL',
        'SD 3': 'SD 3',
        'SD 3.5': 'SD 3.5',
        'SD 3.5 Medium': 'SD 3.5 M',
        'SD 3.5 Large': 'SD 3.5 L',
        'SD 3.5 Large Turbo': 'SD 3.5 L T',
        'Pony': 'Pony',
        'Flux.1 S': 'F1 S',
        'Flux.1 D': 'F1',
        'Flux.1 Kontext': 'F1 Kontext',
        'Aura Flow': 'Aura',
        'SDXL Lightning': 'XL Lightning',
        'SDXL Hyper': 'XL Hyper',
        'SVD': 'SVD',
        'PixArt α': 'PA α',
        'PixArt Σ': 'PA Σ',
        'Hunyuan 1': 'Hunyuan',
        'Hunyuan Video': 'Hunyuan Video',
        'Lumina': 'Lumina',
        'Kolors': 'Kolors',
        'Illustrious': 'IL',
        'Mochi': 'Mochi',
        'LTXV': 'LTXV',
        'CogVideoX': 'Cog',
        'NoobAI': 'NAI',
        'Wan Video': 'Wan',
        'Wan Video 1.3B t2v': 'Wan 1.3B t2v',
        'Wan Video 14B t2v': 'Wan 14B t2v',
        'Wan Video 14B i2v 480p': 'Wan 14B i2v 480p',
        'Wan Video 14B i2v 720p': 'Wan 14B i2v 720p',
        'HiDream': 'HiD',
        'Other': 'Other'
    };

    static updateMainMenu() {
        const menu = document.querySelector('#main-menu .menu');

        menu.querySelector('a[href="#home"] span').textContent = window.languagePack?.text?.home ?? 'Home';
        menu.querySelector('a[href="#models"] span').textContent = window.languagePack?.text?.models ?? 'Models';
        menu.querySelector('a[href="#articles"] span').textContent = window.languagePack?.text?.articles ?? 'Articles';
        menu.querySelector('a[href="#images"] span').textContent = window.languagePack?.text?.images ?? 'Images';
    }

    static gotoPage(page, savedState) {
        if (this.#state.id && savedState && this.#state.id === savedState?.id) return; // Do nothing if the transition was processed somewhere else

        const [ pageId, paramString ] = page?.split('?') ?? [];
        document.title = CONFIG.title;

        if (typeof savedState === 'object' && !Array.isArray(savedState)) this.#state = {...savedState};
        else this.#state = {};
        if (!this.#state.id) this.#state.id = Date.now();

        const navigationScrollTop = this.#state.scrollTop || 0;

        this.#activeMasonryLayout?.destroy({ preventRemoveItemsFromDOM: true });
        this.#activeMasonryLayout = null;
        this.#onScroll = null;
        this.#onResize = null;
        const pageNavigation = this.#pageNavigation = Date.now();
        this.#devicePixelRatio = +window.devicePixelRatio.toFixed(2);

        this.appElement.querySelectorAll('video').forEach(el => el.pause());
        this.appElement.querySelectorAll('.autoplay-observed').forEach(disableAutoPlayOnVisible);
        this.appElement.querySelectorAll('.inviewport-observed').forEach(onTargetInViewportClearTarget);
        this.appElement.querySelector('#tooltip')?.remove();
        this.appElement.classList.add('page-loading');
        this.appElement.setAttribute('data-page', pageId);
        if (paramString) this.appElement.setAttribute('data-params', paramString);
        else this.appElement.removeAttribute('data-params');
        document.querySelector('#main-menu .menu a.active')?.classList.remove('active');
        if (pageId) document.querySelector(`#main-menu .menu a[href="${pageId}"]`)?.classList.add('active');

        const finishPageLoading = () => {
            hideTimeError();
            if (pageNavigation === this.#pageNavigation) {
                this.appElement.classList.remove('page-loading');
                if (navigationScrollTop) document.documentElement.scrollTo({ top: navigationScrollTop, behavior: 'instant' });
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
            else if (params.model || params.modelversion || params.username || params.user || params.post) promise = this.gotoImages({ modelId: params.model, modelVersionId: params.modelversion, username: params.username || params.user, postId: params.post });
            else promise = this.gotoImages();
        }

        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' }); // Not sure about this...

        if (promise) promise.finally(finishPageLoading);
        else finishPageLoading();
    }

    static gotoHome() {
        document.title = `${CONFIG.title} - ${window.languagePack?.text?.home ?? 'Home'}`;
        const appContent = createElement('div', { class: 'app-content' });
        const tempHome =  window.languagePack?.temp?.home ?? {};
        insertElement('h1', appContent, undefined, window.languagePack?.text?.home);
        insertElement('p', appContent, undefined, tempHome.p1?.[1]);
        insertElement('p', appContent, undefined, tempHome.p1?.[2]);
        insertElement('p', appContent, undefined, tempHome.p1?.[3]);
        insertElement('p', appContent, undefined, tempHome.p1?.[4]);
        insertElement('p', appContent, undefined, tempHome.p1?.[5]);

        insertElement('br', appContent);
        insertElement('hr', appContent);
        insertElement('br', appContent);

        insertElement('h2', appContent, undefined, tempHome.settingsDescription ?? 'Settings');

        // Inputs
        insertElement('p', appContent, undefined, tempHome.blackListTagsDescription ?? 'List of tags to hide (separated by commas)');
        const blackListTagsInput = this.#genStringInput({
            onchange: ({ newValue }) => {
                SETTINGS.blackListTags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag) ?? [];
                savePageSettings();
            },
            value: SETTINGS.blackListTags.join(', '),
            placeholder: 'tags separated by commas'
        });
        appContent.appendChild(blackListTagsInput.element);

        // Toggles
        insertElement('p', appContent, undefined, tempHome.autoplayDescription ?? 'If autoplay is disabled, cards won’t show GIFs, and videos on all pages will be paused by default, only playing on hover.');
        const autoplayToggle = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.autoplay = newValue;
                localStorage.setItem('civitai-lite-viewer--time:nextCacheClearTime', new Date(Date.now() + 3 * 60 * 1000).toISOString());
                savePageSettings();
            },
            value: SETTINGS.autoplay,
            label: tempHome.autoplay ?? 'autoplay'
        });
        appContent.appendChild(autoplayToggle.element);

        insertElement('p', appContent, undefined, tempHome.resizeDescription ?? 'If SW resizing is enabled, images on the card page will be resized to their actual size (with DPR in mind) before being displayed. Otherwise, the server-provided size will be shown with automatic scaling.');
        insertElement('blockquote', appContent, undefined, tempHome.resizeNote ?? "For example: the server returned an image sized 320x411 for a 300x450 request — with SW resizing enabled, the page will still get 300x450, and the browser won't need to resize it on the fly.");
        const resizeToggle = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.resize = newValue;
                localStorage.setItem('civitai-lite-viewer--time:nextCacheClearTime', new Date(Date.now() + 3 * 60 * 1000).toISOString());
                savePageSettings();
            },
            value: SETTINGS.resize,
            label: tempHome.resize ?? 'resize'
        });
        appContent.appendChild(resizeToggle.element);

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
                    navigator.storage.estimate().then(info => {
                        const caches = info.usageDetails?.caches ?? info.usage;
                        if (caches < 200000000) cacheFileSize.classList.remove('error-text');
                        cacheFileSize.textContent = filesizeToString(caches);
                    });
                };

                const buttonsWrap = insertElement('div', cachesWrap, { style: 'display: flex; gap: 1em;' });
                const buttonRemoveOld = insertElement('button', buttonsWrap, undefined, tempHome?.removeCacheOld ?? 'Delete old cache');
                const buttonRemoveAll = insertElement('button', buttonsWrap, undefined, tempHome?.removeCacheAll ?? 'Delete all cache');

                buttonRemoveOld.addEventListener('click', () => {
                    clearCache('old');
                    setTimeout(updateCacheSize(), 500);
                    setTimeout(updateCacheSize(), 2500);
                });
                buttonRemoveAll.addEventListener('click', () => {
                    clearCache('all');
                    setTimeout(updateCacheSize(), 500);
                    setTimeout(updateCacheSize(), 2500);
                });
            }
        });


        this.appElement.textContent = '';
        this.appElement.appendChild(appContent);
    }

    static gotoArticles() {
        const appContent = createElement('div', { class: 'app-content' });
        document.title = `${CONFIG.title} - ${window.languagePack?.text?.articles ?? 'Articles'}`;
        const p = insertElement('p', appContent, { class: 'error-text' });
        p.appendChild(getIcon('cross'));
        insertElement('span', p, undefined, window.languagePack?.temp?.articles ?? 'CivitAI public API does not provide a list of articles 😢');
        this.appElement.textContent = '';
        this.appElement.appendChild(appContent);
    }

    static gotoImage(imageId, nsfwLevel) {
        const appContent = createElement('div', { class: 'app-content-wide full-image-page' });

        const cachedMedia = this.#cache.images.get(`${imageId}`);
        if (cachedMedia) {
            console.log('Loaded image info (cache)', cachedMedia);
            appContent.appendChild(this.#genImageFullPage(cachedMedia));
            this.appElement.textContent = '';
            this.appElement.appendChild(appContent);
            return;
        }

        const pageNavigation = this.#pageNavigation;
        return this.api.fetchImageMeta(imageId, nsfwLevel).then(media => {
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
            this.appElement.textContent = '';
            this.appElement.appendChild(appContent);
        });
    }

    static gotoImages(options = {}) {
        const { modelId, username, modelVersionId, postId } = options;

        if (username || modelVersionId || modelId || postId) {
            const appContentWide = createElement('div', { class: 'app-content app-content-wide cards-list-container' });
            const imagesList = this.#genImages({ modelId, modelVersionId, username, postId });
            appContentWide.appendChild(imagesList);
            appContentWide.appendChild(this.#genScrollToTopButton());

            this.appElement.textContent = '';
            this.appElement.appendChild(appContentWide);
            return;
        }

        const appContent = createElement('div', { class: 'app-content' });
        document.title = `${CONFIG.title} - ${window.languagePack?.text?.images ?? 'Images'}`;
        insertElement('p', appContent, undefined, "Work In Progress");
        insertElement('a', appContent, { href: 'https://developer.civitai.com/docs/api/public-rest#get-apiv1images' }, 'GET /api/v1/images');
        this.appElement.textContent = '';
        this.appElement.appendChild(appContent);
    }

    static gotoModelByHash(hash) {
        const pageNavigation = this.#pageNavigation;
        return this.api.fetchModelVersionInfo(hash, true).then(model => {
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
            this.appElement.textContent = '';
            this.appElement.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
        });
    }

    static gotoModel(id, version = null) {
        const pageNavigation = this.#pageNavigation;
        const fragment = new DocumentFragment();
        const appContent = insertElement('div', fragment, { class: 'app-content' });
        const navigationState = {...this.#state};

        const insertModelPage = model => {
            const modelVersion = version ? model.modelVersions.find(v => v.name === version) ?? model.modelVersions[0] : model.modelVersions[0];
            document.title = `${model.name} - ${modelVersion.name} | ${modelVersion.baseModel} | ${model.type} | ${CONFIG.title}`;
            appContent.appendChild(this.#genModelPage(model, version));

            // Images
            const appContentWide = insertElement('div', fragment, { class: 'app-content app-content-wide cards-list-container' });
            const imagesTitle = insertElement('h1', appContentWide, { style: 'justify-content: center;' });
            imagesTitle.appendChild(getIcon('image'));
            insertElement('a', imagesTitle, { href: `#images?model=${id}&modelversion=${modelVersion.id}` }, window.languagePack?.text?.images ?? 'Images');

            if (this.#state.imagesLoaded) {
                const imagesList = this.#genImages({ modelId: model.id, modelVersionId: modelVersion.id, state: navigationState });
                appContentWide.appendChild(imagesList);
                appContentWide.appendChild(this.#genScrollToTopButton());
            } else {
                const imagesListTrigger = insertElement('div', appContentWide, undefined, '...');
                onTargetInViewport(imagesListTrigger, () => {
                    imagesListTrigger.remove();
                    this.#state.imagesLoaded = true;
                    const imagesList = this.#genImages({ modelId: model.id, modelVersionId: modelVersion.id, state: navigationState });
                    appContentWide.appendChild(imagesList);
                    appContentWide.appendChild(this.#genScrollToTopButton());
                });
            }
        };

        const cachedModel = this.#cache.models.get(`${id}`);
        if (cachedModel) {
            console.log('Loaded model (cache):', cachedModel);
            insertModelPage(cachedModel);
            this.appElement.textContent = '';
            this.appElement.appendChild(fragment);
            return;
        }

        return this.api.fetchModelInfo(id)
        .then(data => {
            if (data.id) this.#cache.models.set(`${data.id}`, data);
            if (pageNavigation !== this.#pageNavigation) return;
            console.log('Loaded model:', data);
            insertModelPage(data);
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
        }).finally(() => {
            if (pageNavigation !== this.#pageNavigation) return;
            this.appElement.textContent = '';
            this.appElement.appendChild(fragment);
        });
    }

    static gotoModels(options = {}) {
        const { tag = '', query: searchQuery, username: searchUsername } = options;
        let query;
        const appContent = createElement('div', { class: 'app-content app-content-wide cards-list-container' });
        const listWrap = insertElement('div', appContent, { id: 'models-list', class: 'cards-loading' });
        const listElement = insertElement('div', listWrap, { class: 'cards-list models-list' });
        appContent.appendChild(this.#genScrollToTopButton());


        const layout = this.#activeMasonryLayout = new MasonryLayout(listElement, {
            gap: CONFIG.appearance.modelCard.gap,
            itemWidth: CONFIG.appearance.modelCard.width,
            itemHeight: CONFIG.appearance.modelCard.height,
            generator: (data, options) => this.#genModelCard(data, options),
            overscan: 1.5,
            passive: true,
            disableVirtualScroll: SETTINGS.disableVirtualScroll ?? false,
            onElementRemove: (card, item) => this.#onCardRemoved(card, item)
        });

        const { onScroll, onResize } = layout.getCallbacks();
        this.#onScroll = onScroll;
        this.#onResize = onResize;

        const insertModels = models => {
            const pageNavigation = this.#pageNavigation;
            console.log('Loaded models:', models);

            models = models.filter(model => (model?.modelVersions?.length && !model.tags.some(tag => SETTINGS.blackListTags.includes(tag))));

            layout.addItems(models.map(data => ({ id: data.id, data })));

            if (query.cursor) {
                const loadMoreTrigger = insertElement('div', listElement, { id: 'load-more' });
                loadMoreTrigger.appendChild(getIcon('infinity'));
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    loadMore().then(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', listElement, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
            }
        };

        const loadMore = () => {
            const pageNavigation = this.#pageNavigation;
            if (!query.cursor) return;
            return this.api.fetchModels(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                insertModels(data.items);
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Failed to fetch models:', error?.message ?? error);
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
                primaryFileOnly: true,
                baseModels: SETTINGS.baseModels,
                nsfw: SETTINGS.nsfw,
            };

            listElement.querySelectorAll('video').forEach(el => el.pause());
            listElement.querySelectorAll('.autoplay-observed').forEach(disableAutoPlayOnVisible);
            listElement.querySelectorAll('.inviewport-observed').forEach(onTargetInViewportClearTarget);

            const pageNavigation = this.#pageNavigation;
            layout.clear();

            return this.api.fetchModels(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                listElement.textContent = '';
                insertModels(data.items);
                document.title = `${CONFIG.title} - ${window.languagePack?.text?.models ?? 'Models'}`;
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Error:', error?.message ?? error);
                listWrap.textContent = '';
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            }).finally(() => {
                if (pageNavigation !== this.#pageNavigation) return;
                listWrap.classList.remove('cards-loading');
            });
        };

        const firstLoadingPlaceholder = insertElement('div', listWrap, { id: 'load-more' });
        firstLoadingPlaceholder.appendChild(getIcon('infinity'));

        this.appElement.textContent = '';
        this.appElement.appendChild(this.#genModelsListFIlters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            listWrap.classList.add('cards-loading');
            loadModels();
        }));
        this.appElement.appendChild(appContent);

        return loadModels().finally(() => {
            firstLoadingPlaceholder.remove();
        });
    }

    static openFromCivitUrl(href) {
        try {
            let redirectUrl = this.convertCivUrlToLocal(href);
            if (!redirectUrl) throw new Error('Unsupported url');
            window.location.href = redirectUrl;
        } catch(error) {
            const appContent = createElement('div', { class: 'app-content' });
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Unsupported url'));

            this.appElement.textContent = '';
            this.appElement.appendChild(appContent);
        }
    }

    static convertCivUrlToLocal(href) {
        try {
            const url = new URL(href);
            if (url.origin !== CONFIG.civitai_url) throw new Error(`Unknown url origin, must be ${CONFIG.civitai_url}`);
            const searchParams = Object.fromEntries(url.searchParams);
            let localUrl;
            if (url.pathname.indexOf('/models/') === 0) {
                const modelId = url.pathname.match(/\/models\/(\d+)/i)?.[1];
                if (!modelId) throw new Error('There is no model id in the link');
                localUrl = `#models?model=${modelId}`;
                if (searchParams.modelVersionId) localUrl += `&version${searchParams.modelVersionId}`;
            } else if (url.pathname.indexOf('/images/') === 0) {
                const imageId = url.pathname.match(/\/images\/(\d+)/i)?.[1];
                if (!imageId) throw new Error('There is no image id in the link');
                localUrl = `#images?image=${imageId}`;
            } else if (url.pathname.indexOf('/posts/') === 0) {
                const postId = url.pathname.match(/\/posts\/(\d+)/i)?.[1];
                if (!postId) throw new Error('There is no post id in the link');
                localUrl = `#images?posts=${postId}`;
            }
            if (!localUrl) throw new Error('Unsupported url');
            return localUrl;
        } catch(_) {
            console.warn(_?.message ?? _);
            return null;
        }
    }

    static #genModelPage(model, version = null) {
        const modelVersion = version ? model.modelVersions.find(v => v.name === version) ?? model.modelVersions[0] : model.modelVersions[0];
        const page = createElement('div', { class: 'model-page', 'data-model-id': model.id });

        // Model name
        const modelNameWrap = insertElement('div', page, { class: 'model-name' });
        const modelNameH1 = insertElement('h1', modelNameWrap, undefined, model.name);
        const statsList = [
            { icon: 'like', value: model.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'download', value: model.stats.downloadCount, formatter: formatNumber, unit: 'download' },
            // { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
            { icon: 'chat', value: model.stats.commentCount, formatter: formatNumber, unit: 'comment' },
        ];
        const availabilityBadge = modelVersion.availability !== 'Public' ? modelVersion.availability : (new Date() - new Date(modelVersion.publishedAt) < 3 * 24 * 60 * 60 * 1000) ? model.modelVersions.length > 1 ? 'Updated' : 'New' : null;
        if (availabilityBadge) statsList.push({ icon: 'information', value: window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge, type: availabilityBadge });
        modelNameH1.appendChild(this.#genStats(statsList));

        // Download buttons
        const downloadButtons = insertElement('div', modelNameWrap, { class: 'model-download-files' });
        modelVersion.files.forEach(file => {
            const download = window.languagePack?.text?.download ?? 'Download';
            const fileSize = filesizeToString(file.sizeKB / 0.0009765625);
            const a = insertElement('a', downloadButtons, { class: 'link-button', target: '_blank', href: file.downloadUrl, 'lilpipe-text': file.type, 'lilpipe-delay': 600 });
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
                a.setAttribute('lilpipe-text', file.virusScanMessage ?? file.virusScanResult);
                a.appendChild(getIcon('warning'));
            }
        });

        // Model sub name
        const modelSubNameWrap = insertElement('div', page, { class: 'model-sub-name' });
        const publishedAt = new Date(modelVersion.publishedAt);
        insertElement('span', modelSubNameWrap, { class: 'model-updated-time', 'lilpipe-text': `${window.languagePack?.text?.Updated ?? 'Updated'}: ${publishedAt.toLocaleString()}` }, timeAgo(Math.round((Date.now() - publishedAt)/1000)));
        const modelTagsWrap = insertElement('div', modelSubNameWrap, { class: 'badges model-tags' });
        model.tags.forEach(tag => insertElement('a', modelTagsWrap, { href: `#models?tag=${encodeURIComponent(tag)}`, class: (SETTINGS.blackListTags.includes(tag) ? 'badge error-text' : 'badge') }, tag));

        const modelVersionsWrap = insertElement('div', page, { class: 'badges model-versions' });
        model.modelVersions.forEach(version => {
            const href = `#models?model=${encodeURIComponent(model.id)}&version=${encodeURIComponent(version.name)}`;
            const isActive = version.name === modelVersion.name;
            version.element = insertElement('a', modelVersionsWrap, { class: isActive ? 'badge active' : 'badge', href, tabindex: -1 }, version.name);
        });
        model.modelVersions[0]?.element.setAttribute('tabindex', 0);
        
        let fakeIndex = 0;
        const setFakeFocus = index => {
            modelVersionsWrap.querySelector('[tabindex="0"]')?.setAttribute('tabindex', -1);
            model.modelVersions[index].element.setAttribute('tabindex', 0);
            model.modelVersions[index].element.focus();
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
        const modelPreviewWrap = insertElement('div', page, { class: 'model-preview' });
        const previewList = modelVersion.images.filter(media => media.nsfwLevel <= SETTINGS.browsingLevel).map((media, index) => {
            const ratio = +(media.width/media.height).toFixed(3);
            const id = media.id ?? (media?.url?.match(/(\d+).\S{2,5}$/) || [])[1];
            if (!media.id && id) media.id = id;
            const item = id && media.hasMeta? createElement('a', { href: id ? `#images?image=${encodeURIComponent(id)}&nsfw=${this.#convertNSFWLevelToString(media.nsfwLevel)}` : '', style: `aspect-ratio: ${ratio};`, 'data-id': id ?? -1, tabindex: -1 }) : createElement('div', { style: `aspect-ratio: ${ratio};` });
            const itemWidth = ratio > 1.5 ? CONFIG.appearance.modelPage.carouselItemWidth * 2 : CONFIG.appearance.modelPage.carouselItemWidth;
            const mediaElement = this.#genMediaElement({ media, width: itemWidth, height: undefined, resize: false, loading: index > 3 ? 'lazy' : undefined, taget: 'model-preview', allowAnimated: true });
            item.appendChild(mediaElement);
            return { element: item, isWide: ratio > 1.5 };
        });
        modelPreviewWrap.appendChild(this.#genCarousel(previewList, { carouselItemWidth: CONFIG.appearance.modelPage.carouselItemWidth }));
        // modelPreviewWrap.addEventListener('click', e => {
        //     const a = e.target.closest('a[href][data-id]');
        //     const id = Number(a?.getAttribute('data-id'));
        // }, { capture: true });

        // const hideLongDescription = el => {
        //     el.classList.add('hide-long-description');
        //     const showMore = createElement('button', { class: 'show-more' }, 'Show more');
        //     el.prepend(showMore);
        //     showMore.addEventListener('click', () => {
        //         el.classList.remove('hide-long-description');
        //         showMore.remove();
        //     }, { once: true });
        // };

        // Model version description block
        const modelVersionDescription = insertElement('div', page, { class: 'model-description model-version-description' });
        const modelVersionNameWrap = insertElement('h2', modelVersionDescription, { class: 'model-version' }, modelVersion.name);
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
                word = word.trim();
                if (word.startsWith(',')) word = word.slice(1);
                if (word.endsWith(',')) word = word.slice(0, -1);
                word = word.trim();

                const item = insertElement('code', trainedWordsContainer, { class: 'trigger-word' }, word);
                const copyButton = getIcon('copy');
                item.appendChild(copyButton);
                copyButton.addEventListener('click', () => {
                    toClipBoard(word);
                    console.log('Copied to clipboard, TODO: notifications'); // TODO: notifications
                    console.log(`Trigger word: ${word}`);
                });
            });
        }

        // Creattor
        if (model.creator) {
            const userInfo = {...model.creator};
            if (userInfo.username) userInfo.url = `#models?username=${userInfo.username}`;
            modelVersionDescription.appendChild(this.#genUserBlock(userInfo));
        }

        // Version description
        if (modelVersion.description) {
            modelVersion.description = this.#analyzeModelDescriptionString(modelVersion.description);
            const modelVersionContainer = safeParseHTML(modelVersion.description);
            modelVersionDescription.appendChild(modelVersionContainer);
            this.#analyzeModelDescription(modelVersionDescription);
            // if (calcCharsInString(modelVersion.description, '\n', 40)) hideLongDescription(modelVersionDescription);
        }

        // Model descrition
        const modelDescription = insertElement('div', page, { class: 'model-description' });
        model.description = this.#analyzeModelDescriptionString(model.description);
        modelDescription.appendChild(safeParseHTML(model.description));
        // if (calcCharsInString(model.description, '\n', 40)) hideLongDescription(modelDescription);

        // Analyze descriptions and find patterns to improve display
        this.#analyzeModelDescription(modelDescription);

        // Open in CivitAI
        insertElement('a', page, { href: `${CONFIG.civitai_url}/models/${model.id}?modelVersionId=${modelVersion.id}`, target: '_blank', class: 'link-button link-open-civitai'}, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        // Comments
        // ...

        return page;
    }

    static #genImageFullPage(media) {
        const fragment = new DocumentFragment();

        // Full image
        const mediaElement = this.#genMediaElement({ media, width: media.width, resize: false, target: 'full-image', autoplay: true, original: true, controls: true, loading: 'eager' });
        mediaElement.style.width = `${media.width}px`;
        mediaElement.classList.add('media-full-preview');
        fragment.appendChild(mediaElement);

        // Try to insert a picture from the previous page, if available
        const previewImage = document.querySelector(`.media-container[data-id="${media.id}"] .media-element:not(.loading)`)?.cloneNode(true);
        if (previewImage) {
            const fullMedia = mediaElement.querySelector('.media-element');
            const isImage = fullMedia.tagName === 'IMG';

            const onFullMediaReady = () => {
                animateElement(previewImage, {
                    keyframes: { opacity: [1, 0] },
                    duration: 200,
                    easing: 'ease'
                }).then(() => previewImage.remove());
            };

            previewImage.classList.add('full-image-preview');
            mediaElement.prepend(previewImage);

            const waitForReady = async () => {
                if (isImage) {
                    if (fullMedia.complete && fullMedia.naturalWidth !== 0) {
                        await fullMedia.decode?.().catch(() => {});
                        onFullMediaReady();
                    } else {
                        fullMedia.addEventListener('load', async () => {
                            await fullMedia.decode?.().catch(() => {});
                            onFullMediaReady();
                        }, { once: true });
                    }
                } else {
                    if (fullMedia.readyState >= 2) {
                        requestAnimationFrame(onFullMediaReady);
                    } else {
                        fullMedia.addEventListener('loadeddata', () => {
                            requestAnimationFrame(onFullMediaReady);
                        }, { once: true });
                    }
                }
            };

            waitForReady();
        }

        const metaContainer = createElement('div', { class: 'media-full-meta' });

        // Creator
        metaContainer.appendChild(this.#genUserBlock({ username: media.username, url: `#images?username=${media.username}` }));

        // Stats
        const statsList = [
            { iconString: '👍', value: media.stats.likeCount, formatter: formatNumber, unit: 'like' },
            { iconString: '👎', value: media.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
            { iconString: '😭', value: media.stats.cryCount, formatter: formatNumber },
            { iconString: '❤️', value: media.stats.heartCount, formatter: formatNumber },
            { iconString: '🤣', value: media.stats.laughCount, formatter: formatNumber },
            // { icon: 'chat', value: media.stats.commentCount, formatter: formatNumber, unit: 'comment' }, // Always empty (API does not give a value, it is always 0)
        ];
        metaContainer.appendChild(this.#genStats(statsList));

        // Post link
        const postInfo = media.postId ? this.#cache.posts.get(`${media.postId}`) : null;
        if (media.postId && (!postInfo || postInfo.size > 1)) {
            const postLink = insertElement('a', metaContainer, { class: 'image-post badge', href: `#images?post=${media.postId}` });
            if (postInfo) postLink.appendChild(document.createTextNode(`x${postInfo.size}`));
            postLink.appendChild(getIcon('image'));
            postLink.appendChild(document.createTextNode(window.languagePack?.text?.view_post ?? 'View Post'));
        }

        // NSFW LEvel
        if (media.nsfwLevel !== 'None') insertElement('div', metaContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': media.nsfwLevel }, media.nsfwLevel);

        // Generation info
        if (media.meta) metaContainer.appendChild(this.#genImageGenerationMeta(media.meta));
        else insertElement('div', metaContainer, undefined, window.languagePack?.text?.noMeta ?? 'No generation info');

        insertElement('a', metaContainer, { href: `${CONFIG.civitai_url}/images/${media.id}`, target: '_blank', class: 'link-button link-open-civitai' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        fragment.appendChild(metaContainer);

        return fragment;
    }

    // TODO: Add support for grouping images by posts
    // TODO: Add attempt to restore previous list when navigating through history
    static #genImages(options = {}) {
        const { modelId, modelVersionId, postId, username, state: navigationState = {...this.#state} } = options;
        let query;
        const firstPageNavigation = this.#pageNavigation;
        const fragment = new DocumentFragment();
        const listWrap = createElement('div', { id: 'images-list', class: 'cards-loading' });
        const listElement = insertElement('div', listWrap, { class: 'cards-list images-list' });

        const layout = this.#activeMasonryLayout = new MasonryLayout(listElement, {
            gap: CONFIG.appearance.imageCard.gap,
            itemWidth: CONFIG.appearance.imageCard.width,
            generator: (data, options) => this.#genImageCard(data, options),
            overscan: 1.5,
            passive: true,
            disableVirtualScroll: SETTINGS.disableVirtualScroll ?? false,
            onElementRemove: (card, item) => this.#onCardRemoved(card, item)
        });

        const { onScroll, onResize } = layout.getCallbacks();
        this.#onScroll = onScroll;
        this.#onResize = onResize;

        let imagesMetaById = new Map();
        let postsById = new Map();
        listElement.addEventListener('click', e => {
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
            listWrap.classList.add('cards-loading');
            loadImages();
        }));

        const firstLoadingPlaceholder = insertElement('div', fragment, { id: 'load-more', style: 'position: absolute; width: 100%;' });
        firstLoadingPlaceholder.appendChild(getIcon('infinity'));

        fragment.appendChild(listWrap);

        const loadMore = () => {
            if (!query.cursor) return;
            const pageNavigation = this.#pageNavigation;
            return this.api.fetchImages(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                insertImages(data.items);
            }).catch(error => {
                console.error('Failed to fetch images:', error?.message ?? error);
            });
        };

        const insertImages = images => {
            const pageNavigation = this.#pageNavigation;
            console.log('Loaded images:', images);

            if (SETTINGS.hideImagesWithNoMeta) {
                const countAll = images.length;
                images = images.filter(image => image.meta);
                if (images.length < countAll) console.log(`Hidden ${countAll - images.length} image(s) without meta information about generation`);
            }

            layout.addItems(images.map(data => {
                const aspectRatio = data.width / data.height;
                return { id: data.id, aspectRatio, data };
            }));

            images.forEach(image => {
                if (imagesMetaById.has(image.id)) return;
                imagesMetaById.set(image.id, image);

                if (image.postId) {
                    if (!postsById.has(image.postId)) postsById.set(image.postId, new Set());
                    postsById.get(image.postId).add(image);
                }
            });

            if (query.cursor) {
                const loadMoreTrigger = insertElement('div', listElement, { id: 'load-more' });
                loadMoreTrigger.appendChild(getIcon('infinity'));
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    loadMore().then(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', listElement, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
            }

            console.log('TODO: Add support for grouping images by posts', postsById);
        };

        const loadImages = () => {
            query = {
                limit: CONFIG.perRequestLimits.images,
                sort: SETTINGS.sort_images,
                period: SETTINGS.period_images,
                nsfw: SETTINGS.nsfwLevel,
                modelId,
                modelVersionId,
                username,
                postId
            };
            this.#state.imagesFilter = JSON.stringify(query);

            listElement.querySelectorAll('video').forEach(el => el.pause());
            listElement.querySelectorAll('.autoplay-observed').forEach(disableAutoPlayOnVisible);
            listElement.querySelectorAll('.inviewport-observed').forEach(onTargetInViewportClearTarget);

            const pageNavigation = this.#pageNavigation;
            imagesMetaById = new Map();
            postsById = new Map();

            return this.api.fetchImages(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                layout.clear();
                listElement.textContent = '';
                insertImages(data.items);
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Error:', error?.message ?? error);
                listWrap.textContent = '';
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            }).finally(() => {
                if (pageNavigation !== this.#pageNavigation) return;
                listWrap.classList.remove('cards-loading');
            });
        };

        loadImages().finally(() => {
            firstLoadingPlaceholder.remove();

            if (this.#pageNavigation === firstPageNavigation && navigationState.imagesFilter === this.#state.imagesFilter) {
                console.log('[WIP] TODO: restore scroll');
                if (navigationState.scrollTop) document.documentElement.scrollTo({ top: navigationState.scrollTop, behavior: 'instant' });
            }
        });

        return fragment;
    }

    static #genStats(stats) {
        const statsWrap = createElement('div', { class: 'badges' });
        stats.forEach(({ icon, iconString, value, formatter, unit, type }) => {
            const statWrap = insertElement('div', statsWrap, { class: 'badge', 'data-value': value });
            const lilpipeValue = typeof value === 'number' ? formatNumberIntl(value) : value;
            if (unit) {
                const units = window.languagePack?.units?.[unit];
                statWrap.setAttribute('lilpipe-text', units ? `${lilpipeValue} ${pluralize(value, units)}` : lilpipeValue);
            } else if (!type) statWrap.setAttribute('lilpipe-text', lilpipeValue);
            if (type) statWrap.setAttribute('data-badge', type);
            if (icon) statWrap.appendChild(getIcon(icon));
            if (iconString) statWrap.appendChild(document.createTextNode(iconString));
            statWrap.appendChild(document.createTextNode(` ${formatter?.(value) ?? value}`));
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
            { regex: /(<p>@\w+{[\s\S]*?>}<\/p>)/gim, replacement: block => {
                const flat = block
                    .replace(/<\/?p>/gi, '')   // Remove <p> and </p>
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

    static #analyzeModelDescription(description) {
        // Remove garbage (empty elements and all unnecessary things)
        description.querySelectorAll('p:empty, h3:empty').forEach(el => el.remove());

        description.querySelectorAll('p:has(+pre)').forEach(p => {
            const text = p.textContent.trim().toLowerCase();
            if (text === 'positive prompt' || text.indexOf('+prompt') === 0 || text.indexOf('+ prompt') === 0 || text.indexOf('positive prompt') === 0) {
                getFollowingTagGroup(p, 'pre').forEach(pre => {
                    const code = pre.querySelector('code');
                    if (!code) return;

                    code.classList.add('prompt', 'prompt-positive');
                });
            } else if (text === 'negative prompt' || text.indexOf('-prompt') === 0 || text.indexOf('- prompt') === 0 || text.indexOf('negative prompt') === 0) {
                getFollowingTagGroup(p, 'pre').forEach(pre => {
                    const code = pre.querySelector('code');
                    if (!code) return;

                    code.classList.add('prompt', 'prompt-negative');
                });
            }
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

        // Add _blank and noopener to all links
        description.querySelectorAll('a').forEach(a => {
            const rel = (a.rel || '').split(' ');
            if (!rel.includes('noopener')) rel.push('noopener');
            a.setAttribute('rel', rel.join(' ').trim());
            a.setAttribute('target', '_blank');

            // const href = a.href;
            // if (href.indexOf(CONFIG.civitai_url) === 0) {
            //     const localUrl = this.convertCivUrlToLocal(href);    
            //     if (localUrl) {
            //         a.href = localUrl;
            //         if (a.textContent === href) a.textContent = localUrl;
            //         a.removeAttribute('target');
            //     }
            // }
        });

        if (!SETTINGS.disablePromptFormatting) description.querySelectorAll('code.prompt').forEach(this.#analyzePromptCode);
    }

    static #analyzePromptCode(codeElement) {
        if (!codeElement) return;
        // Some prompts are hard to read due to missing spaces after commas
        const fixedText = codeElement.textContent.replace(/,(?!\s)/g, ', ').trim();

        // Highlight keywords and brackets of tag weight
        const keywords = new Set([ 'BREAK', '{PROMPT}' ]);
        const fragment = new DocumentFragment();
        let lastTextNode = null;
        const pushText = text => {
            if (lastTextNode) {
                lastTextNode.textContent += text;
            } else {
                lastTextNode = document.createTextNode(text);
                fragment.appendChild(lastTextNode);
            }
        };
        const tokens = fixedText.match(/<lora:[^:>]+:[^>]+>|https:\/\/civitai\.com\/[^\s]+|\\[()[\]]|[\[\]()]+|:-?[0-9.]+|[\w\-]+|,|\s+|[^\s\w]/g) || [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (/^<lora:[^:>]+:[^>]+>$/.test(token)) insertElement('span', fragment, { class: 'lora' }, token);
            else if (token.indexOf('https://civitai.com/') === 0 && isURL(token)) insertElement('a', fragment, { class: 'link', href: token, target: '_blank', rel: 'noopener' }, token);
            else if (/^[\[\]()]+$/.test(token)) insertElement('span', fragment, { class: 'bracket' }, token);
            else if (/^:-?[0-9.]+$/.test(token) && tokens[i + 1]?.[0] === ')') insertElement('span', fragment, { class: 'weight' }, token);
            else if (keywords.has(token)) insertElement('span', fragment, { class: 'keyword' }, token);
            else {
                pushText(token);
                continue;
            }

            lastTextNode = null;
        }

        codeElement.textContent = '';
        codeElement.appendChild(fragment);
    }

    static #genImageGenerationMeta(meta) {
        const container = createElement('div', { class: 'generation-info' });

        // TODO: remixOfId from extra fields

        // params
        if (meta.baseModel) insertElement('code', container, { class: 'prompt meta-baseModel' }, meta.baseModel);
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
            const item = insertElement('code', otherMetaContainer, { class: 'meta-other-item' }, key ? `${key}: ` : '');
            if (value) {
                if (value instanceof HTMLElement) {
                    value.classList.add('meta-value');
                    item.appendChild(value);
                } else if (typeof value === 'string') insertElement('span', item, { class: 'meta-value' }, value);
                else insertElement('span', item, { class: 'meta-value' }, value);
            }
            return item;
        };
        if (meta.Size) insertOtherMeta('Size', meta.Size);
        if (meta.cfgScale) {
            const cfgOriginal = Number(meta.cfgScale);
            const cfg = +(cfgOriginal).toFixed(4);
            const item = insertOtherMeta('CFG', cfg);
            if (cfg !== cfgOriginal) item.setAttribute('lilpipe-text', cfgOriginal);
        }
        if (meta.sampler) insertOtherMeta('Sampler', meta.sampler);
        if (meta['Schedule type'] || meta.scheduler ) insertOtherMeta('Sheduler', meta['Schedule type'] || meta.scheduler);
        if (meta.steps) insertOtherMeta('Steps', meta.steps);
        if (meta.clipSkip) insertOtherMeta('clipSkip', meta.clipSkip);
        if (meta.seed) insertOtherMeta('Seed', meta.seed);
        if (meta.RNG) insertOtherMeta('RNG', meta.RNG);
        if (meta['Denoising strength'] || meta.denoise) {
            const denoiseOriginal = Number(meta['Denoising strength'] ?? meta.denoise);
            const denoise = +(denoiseOriginal).toFixed(4);
            const item = insertOtherMeta('Denoising', denoise);
            if (denoise !== denoiseOriginal) item.setAttribute('lilpipe-text', denoiseOriginal);
        }
        if (meta.workflow) insertOtherMeta('', meta.workflow);
        // if (meta.sourceImage && meta.sourceImage.url) { // Doesn't work? Links lead to 404?
        //     const sourceSize = meta.sourceImage.width && meta.sourceImage.height ? `${meta.sourceImage.width}x${meta.sourceImage.height}` : null;
        //     const a = createElement('a', { href: meta.sourceImage.url, target: '_blank' }, sourceSize ? `image (${sourceSize})` : 'image');
        //     insertOtherMeta('Source Image', a);
        // }
        if (meta.comfy) {
            const comfyJSON = meta.comfy;
            const item = insertOtherMeta('ComfyUI');
            item.classList.add('copy');
            item.appendChild(getIcon('copy'));
            item.addEventListener('click', () => {
                toClipBoard(comfyJSON);
                console.log('Copied to clipboard, TODO: notifications'); // TODO: notifications
                console.log('ComfyUI: ', JSON.parse(comfyJSON));
            }, { passive: true });
        }
        if (meta['Hires upscaler']) {
            const tooltip = Object.keys(meta).filter(key => key.indexOf('Hires') === 0).map(key => `<tr><td>${key.replace('Hires', '').trim()}</td><td>${typeof meta[key] === 'string' ? meta[key] : JSON.stringify(meta[key])}</td></tr>`).join('');
            const item = insertOtherMeta('Hires', meta['Hires upscaler']);
            if (meta['Hires upscale']) insertElement('i', item, undefined, ` x${meta['Hires upscale']}`);
            if (tooltip) {
                item.setAttribute('lilpipe-text', `<table class='tooltip-table-only' style='text-transform:capitalize;'>${tooltip}</table>`);
                item.setAttribute('lilpipe-type', 'meta-adetailer');
            }
        }
        if (meta['ADetailer model']) {
            const tooltip = Object.keys(meta).filter(key => key.indexOf('ADetailer') === 0).map(key => `<tr><td>${key.replace('ADetailer', '').trim()}</td><td>${typeof meta[key] === 'string' ? meta[key] : JSON.stringify(meta[key])}</td></tr>`).join('');
            const item = insertOtherMeta('ADetailer', meta['ADetailer model']);
            if (tooltip) {
                item.setAttribute('lilpipe-text', `<table class='tooltip-table-only' style='text-transform:capitalize;'>${tooltip}</table>`);
                item.setAttribute('lilpipe-type', 'meta-adetailer');
            }
        }

        // Resources
        const resourceHashes = new Set();
        const resources = [];
        const addResourceToList = resource => {
            if (resource.name?.indexOf('urn:') === 0 && !resource.modelVersionId) resource.modelVersionId = +resource.name.substring(resource.name.lastIndexOf('@') + 1);
            const key = resource.hash || resource.modelVersionId;
            if (resourceHashes.has(key)) return;
            resourceHashes.add(key);
            resources.push({ ...resource });
        };
        meta.civitaiResources?.forEach(addResourceToList);
        meta.resources?.forEach(addResourceToList);
        meta.additionalResources?.forEach(addResourceToList);
        if (meta.hashes) Object.keys(meta.hashes)?.forEach(key => addResourceToList({ hash: meta.hashes[key], name: key }));
        // if (meta['TI hashes']) Object.keys(meta['TI hashes'])?.forEach(key => addResourceToList({ hash: meta['TI hashes'][key], name: key })); // There always seem to be no models for these hashes on CivitAI // The image where this key was seen: 82695882
        if (meta['Model hash']) addResourceToList({ hash: meta['Model hash'], name: meta['Model'] });

        if (resources.length) {
            const resourcesContainer = insertElement('div', container, { class: 'meta-resources meta-resources-loading' });
            const resourcesTitle = insertElement('h3', resourcesContainer);
            resourcesTitle.appendChild(getIcon('database'));
            insertElement('span', resourcesTitle, undefined, window.languagePack?.text?.resurces_used ?? 'Resources used')

            const resourcePromises = [];
            const createResourceRowContent = info => {
                const { title, version, href, weight = 1, type, baseModel } = info;

                const el = createElement(href ? 'a' : 'div', { class: 'meta-resource', href });
                const titleElement = insertElement('span', el, { class: 'meta-resource-name' }, `${title} ` );
                insertElement('span', el, { class: 'meta-resource-type', 'lilpipe-text': baseModel }, type);
                if(version) insertElement('strong', titleElement, undefined, version)
                if (weight !== 1) {
                    const weightRounded = +weight.toFixed(4);
                    const span = insertElement('span', titleElement, { class: 'meta-resource-weight', 'data-weight': weight === 0 ? '=0' : weight > 0 ? '>0' : '<0' }, `:${weightRounded}`);
                    if (weightRounded !== weight) span.setAttribute('lilpipe-text', weight);
                }
                return el;
            };
            const processResources = items => {
                items = items.filter(Boolean);
                const trainedWords = new Set();
                const rawTooltips = {};
                console.log('Loaded resources', items);

                items.forEach(item => {
                    const type = item?.model?.type;
                    if (!type || (type !== 'LORA' && type !== 'TextualInversion') || !item?.trainedWords?.length) return;

                    const modelName = item.model.name;
                    if (!modelName) return;

                    item.trainedWords.forEach(word => {
                        word = word.indexOf(',') === -1 ? word.trim() : word.replace(/,(?!\s)/g, ', ').trim(); // This is necessary because the prompt block is formatted in a similar way
                        const splitWords = word.split(',').map(w => w.trim()).filter(Boolean);

                        splitWords.forEach(w => {
                            trainedWords.add(w);
                            if (!rawTooltips[w]) rawTooltips[w] = new Set();
                            rawTooltips[w].add(modelName);
                        });
                    });
                });

                const triggerTooltips = {};
                trainedWords.forEach(word => {
                    if (rawTooltips[word]) {
                        const words = Array.from(rawTooltips[word]);
                        triggerTooltips[word.toLowerCase()] = words.length > 1 ? `<ul>${words.map(w => `<li>${w}</li>`).join('')}</ul>` : words[0];
                    }
                });

                if (!trainedWords.size || SETTINGS.disablePromptFormatting) return;

                const codeBlocks = container.querySelectorAll('code.prompt-positive, code.prompt-negative');

                const escapedWords = Array.from(trainedWords).map(w =>
                    w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                );
                const wordRegex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

                codeBlocks.forEach(code => {
                    const children = Array.from(code.childNodes);

                    children.forEach(node => {
                        if (node.nodeType !== Node.TEXT_NODE) return;

                        const text = node.textContent;
                        if (!text) return;

                        const matches = [];
                        let match;
                        while ((match = wordRegex.exec(text)) !== null) {
                            matches.push({
                                key: match[0],
                                index: match.index
                            });
                        }

                        if (matches.length === 0) return;

                        matches.sort((a, b) => a.index - b.index);
                        const fragment = new DocumentFragment();
                        let lastIndex = 0;

                        matches.forEach(({ key, index }) => {
                            if (index > lastIndex) {
                                fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
                            }

                            const span = insertElement('span', fragment, { class: 'trigger' }, key);

                            const tooltip = triggerTooltips[key.toLowerCase()];
                            if (tooltip) span.setAttribute('lilpipe-text', tooltip);

                            lastIndex = index + key.length;
                        });

                        if (lastIndex < text.length) {
                            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                        }

                        code.replaceChild(fragment, node);
                    });
                });
            };

            const resourcesFromCache = [];
            resources.forEach(item => {
                const modelKey = item.modelVersionId || item.hash || null;
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
                    resourcesFromCache.push(modelInfo);
                    return;
                }

                let fetchPromise = null;
                if (item.modelVersionId) fetchPromise = this.api.fetchModelVersionInfo(item.modelVersionId);
                else if (item.hash) fetchPromise = this.api.fetchModelVersionInfo(item.hash, true);
                if (!fetchPromise) return;

                el.classList.add('meta-resource-loading');
                const promise = fetchPromise.then(info => {
                    if (!info) return info;
                    const newEl = createResourceRowContent({
                        title: info.model?.name,
                        version: info.name,
                        baseModel: info.baseModel,
                        type: info.model?.type,
                        weight: item.weight,
                        href: info.modelId && info.name ? `#models?model=${info.modelId}&version=${info.name}` : undefined
                    });
                    resourcesContainer.replaceChild(newEl, el);
                    this.#cache.modelVersions.set(modelKey, info);
                    return info;
                })
                .catch(() => {
                    // This is to avoid trying to constantly send requests to the 404 model
                    this.#cache.modelVersions.set(modelKey, null);
                })
                .finally(() => {
                    el.classList.remove('meta-resource-loading');
                });
                resourcePromises.push(promise);
            });

            if (resourcesFromCache.length) processResources(resourcesFromCache);

            if (resourcePromises.length) {
                Promise.all(resourcePromises)
                .then(processResources)
                .finally(() => {
                    resourcesContainer.classList.remove('meta-resources-loading');
                });
            } else {
                resourcesContainer.classList.remove('meta-resources-loading');
            }
        }

        return container;
    }

    static #genModelCard(model, options) {
        const { isVisible, itemWidth, itemHeight } = options ?? {};
        const modelVersion = model.modelVersions[0];
        const previewMedia = modelVersion.images.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
        const card = createElement('a', { class: 'card model-card', 'data-id': model.id, 'data-media': previewMedia?.type ?? 'none', href: `#models?model=${model.id}`, style: `width: ${itemWidth}px; height: ${itemHeight}px;` });

        // Image
        if (previewMedia?.type === 'video' && !SETTINGS.autoplay) card.classList.add('video-hover-play');
        if (previewMedia) {
            const mediaElement = this.#genMediaElement({ media: previewMedia, width: itemWidth, height: itemHeight, resize: SETTINGS.resize, target: 'model-card', loading: isVisible ? undefined : 'lazy' });
            mediaElement.classList.add('card-background');
            card.appendChild(mediaElement);
        } else {
            const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
            const noMedia = insertElement('div', cardBackgroundWrap, { class: 'media-element no-media' }, window.languagePack?.errors?.no_media ?? 'No Media');
            noMedia.appendChild(getIcon('image'));
        }

        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });
        const cardContentBottom = insertElement('div', cardContentWrap);

        // Model Type
        const modelTypeBadges = insertElement('div', cardContentTop, { class: 'badges model-type-badges' });
        const modelTypeWrap = insertElement('div', modelTypeBadges, { class: 'badge model-type', 'lilpipe-text': `${model.type} | ${modelVersion.baseModel ?? '?'}` }, `${this.#types[model.type] || model.type} | ${this.#baseModels[modelVersion.baseModel] ?? modelVersion.baseModel ?? '?'}`);

        // Availability
        const availabilityBadge = modelVersion.availability !== 'Public' ? modelVersion.availability : (new Date() - new Date(modelVersion.publishedAt) < 3 * 24 * 60 * 60 * 1000) ? model.modelVersions.length > 1 ? 'Updated' : 'New' : null;
        if (availabilityBadge) insertElement('div', modelTypeBadges, { class: 'badge model-availability', 'data-availability': availabilityBadge }, window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge);

        // Creator
        if (model.creator) cardContentBottom.appendChild(this.#genUserBlock({ image: model.creator.image, username: model.creator.username }));

        // Model Name
        insertElement('div', cardContentBottom, { class: 'model-name' }, model.name);

        // Stats
        const statsContainer = this.#genStats([
            { icon: 'download', value: model.stats.downloadCount, formatter: formatNumber, unit: 'download' },
            { icon: 'like', value: model.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'chat', value: model.stats.commentCount, formatter: formatNumber, unit: 'comment' },
            // { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
        ]);
        cardContentBottom.appendChild(statsContainer);

        return card;
    }

    static #genImageCard(image, options) {
        const { isVisible, itemWidth, itemHeight } = options ?? {};
        const card = createElement('a', { class: 'card image-card', 'data-id': image.id, 'data-media': image?.type ?? 'none', href: `#images?image=${encodeURIComponent(image.id)}&nsfw=${image.browsingLevel ? this.#convertNSFWLevelToString(image.browsingLevel) : image.nsfw}`, style: `width: ${itemWidth}px; height: ${itemHeight ?? Math.round(itemWidth / (image.width/image.height))}px;` });

        // Image
        if (image?.type === 'video' && !SETTINGS.autoplay) card.classList.add('video-hover-play');
        const mediaElement = this.#genMediaElement({ media: image, width: itemWidth, resize: SETTINGS.resize, target: 'image-card', loading: isVisible ? undefined : 'lazy' });
        mediaElement.classList.add('card-background');
        card.appendChild(mediaElement);

        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        const cardContentTop = insertElement('div', cardContentWrap, { class: 'card-content-top' });

        // Creator and Created At
        const creator = this.#genUserBlock({ username: image.username });
        if (image.createdAt) {
            const createdAt = new Date(image.createdAt);
            insertElement('span', creator, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
        }
        cardContentTop.appendChild(creator);

        // Badges (NSFW Level and Has Meta)
        const badgesContainer = insertElement('div', cardContentTop, { class: 'badges other-badges' });
        if (image.nsfwLevel !== 'None') insertElement('div', badgesContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': image.nsfwLevel }, image.nsfwLevel);
        if (image.meta) {
            const metaIconContainer = insertElement('div', badgesContainer, { class: 'image-meta badge', 'lilpipe-text': window.languagePack?.text?.hasMeta ?? 'Generation info' });
            metaIconContainer.appendChild(getIcon('tag'));
        }

        // Stats
        const statsContainer = this.#genStats([
            { iconString: '👍', value: image.stats.likeCount, formatter: formatNumber, unit: 'like' },
            { iconString: '👎', value: image.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
            { iconString: '😭', value: image.stats.cryCount, formatter: formatNumber },
            { iconString: '❤️', value: image.stats.heartCount, formatter: formatNumber },
            { iconString: '🤣', value: image.stats.laughCount, formatter: formatNumber },
            // { icon: 'chat', value: image.stats.commentCount, formatter: formatNumber, unit: 'comment' }, // Always empty (API does not give a value, it is always 0)
        ]);
        cardContentWrap.appendChild(statsContainer);

        return card;
    }

    static #genUserBlock(userInfo) {
        const container = createElement('div', { class: 'user-info' });

        const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
        if (userInfo.image !== undefined) {
            if (userInfo.image) {
                const src = `${userInfo.image.replace(/\/width=\d+\//, `/width=${creatorImageSize}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop&format=webp&target=user-image`;
                insertElement('img', container, { crossorigin: 'anonymous', alt: userInfo.username?.substring(0, 2) ?? 'NM', src });
            }
            else insertElement('div', container, { class: 'no-media' }, userInfo.username?.substring(0, 2) ?? 'NM');
        }
        if (userInfo.url) insertElement('a', container, { href: userInfo.url }, userInfo.username);
        else insertElement('span', container, undefined, userInfo.username);

        return container;
    }

    static #genCarousel(list, { carouselItemWidth = 400, carouselGap = 12 }) {
        const carousel = createElement('div', { class: 'carousel', style: `--carousel-item-width: ${carouselItemWidth}px; --carousel-gap: ${carouselGap}px;` });
        const carouselItems = insertElement('div', carousel, { class: 'carousel-items' });
        const listElements = [];

        if (list.length === 2) list.forEach(item => item.isWide = false);

        const scrollMax = list.reduce((currentScroll, { element, isWide = false }) => {
            const carouselItem = insertElement('div', carouselItems, { class: isWide ? 'carousel-item carousel-item-wide' : 'carousel-item' });
            carouselItem.appendChild(element);
            listElements.push({ element: carouselItem, scrollLeft: currentScroll, isWide });
            return currentScroll + (isWide ? carouselItemWidth * 2 : carouselItemWidth) + carouselGap;
        }, 0);

        if (listElements.length > 2) {
            let scrollIndex = 0;
            const carouselPrev = insertElement('button', carousel, { class: 'carousel-button', 'data-direction': 'prev' });
            const carouselNext = insertElement('button', carousel, { class: 'carousel-button', 'data-direction': 'next' });
            carouselPrev.appendChild(getIcon('arrow_left'));
            carouselNext.appendChild(getIcon('arrow_right'));

            const scrollToElement = index => {
                const item = listElements[index];
                carouselItems.style.transform = (item.isWide && !item.scrollLeft) ? `translateX(${carouselGap / 2}px)` : `translateX(-${item.isWide ? Math.max(item.scrollLeft - carouselGap / 2, 0): item.scrollLeft}px)`;
                if (listElements.length > 2) {
                    if (index + 1 >= listElements.length) {
                        listElements[0].element.style.transform = `translateX(${scrollMax}px)`;
                        listElements[1].element.style.transform = `translateX(${scrollMax}px)`;
                    } else if (index < 3) {
                        listElements[0].element.style.transform = `translateX(0px)`;
                        listElements[1].element.style.transform = `translateX(0px)`;
                    }
                }
            };
    
            carouselPrev.addEventListener('click', () => {
                scrollIndex = scrollIndex > 0 ? (scrollIndex - 1) % listElements.length : listElements.length - 1;
                scrollToElement(scrollIndex);
            }, { passive: true });
            carouselNext.addEventListener('click', () => {
                scrollIndex = (scrollIndex + 1) % listElements.length;
                scrollToElement(scrollIndex);
            }, { passive: true });

            scrollToElement(0);
        }

        return carousel;
    }

    static #genMediaElement({ media, width, height = undefined, resize = true, loading = 'auto', target = null, controls = false, original = false, autoplay = SETTINGS.autoplay, decoding = 'auto', allowAnimated = false }) {
        const mediaContainer = createElement('div', { class: 'media-container', 'data-id': media.id ?? -1 });
        let mediaElement;
        const lazy = loading === 'lazy';
        const targetWidth = Math.round(width * this.#devicePixelRatio);
        const targetHeight = height ? Math.round(height * this.#devicePixelRatio) : null;
        const blurSize = CONFIG.appearance.blurHashSize;
        const ratio = media.width / media.height;
        const newRequestSize = ratio < 1 || !targetHeight ? `width=${targetWidth}` : `height=${targetHeight}`;
        const params = resize && !original ? `?width=${targetWidth}${targetHeight ? `&height=${targetHeight}` : ''}&fit=crop` : '';
        const url = `${original ? media.url.replace(/\/width=\d+\//, '/original=true/') : media.url.replace(/\/width=\d+\//, `/${newRequestSize},anim=false,optimized=true/`)}${target ? (params ? `${params}&target=${target}` : `?target=${target}`) : params}`;
        const previewUrl = media.hash ? `${CONFIG.local_urls.blurHash}?hash=${encodeURIComponent(media.hash)}&width=${ratio < 1 ? blurSize : Math.round(blurSize/ratio)}&height=${ratio < 1 ? Math.round(blurSize/ratio) : blurSize}` : '';
        if (media.type === 'image') {
            const src = original ? url : (autoplay  || allowAnimated ? url.replace(/anim=false,?/, '') : (resize ? `${url}&format=webp` : url));
            mediaElement = insertElement('img', mediaContainer, { class: 'media-element loading',  alt: ' ', crossorigin: 'anonymous', src: lazy ? '' : src, 'data-nsfw-level': media.nsfwLevel });
            if (lazy) {
                onTargetInViewport(mediaElement, () => {
                    mediaElement.src = src;
                });
            } else if (loading === 'eager') {
                mediaElement.loading = "eager";
            }
            if (decoding === 'sync') {
                mediaElement.decoding = 'sync';
            }
            mediaContainer.classList.add('media-image');
        } else {
            const src = original ? url : url.replace('optimized=true', 'optimized=true,transcode=true');
            const poster = resize && !original ? `${src}&format=webp` : src;
            const videoSrc = src.replace(/anim=false,?/, '');
            mediaElement = insertElement('video', mediaContainer, { class: 'media-element loading',  muted: '', loop: '', playsInline: '', crossorigin: 'anonymous', preload: 'none', 'data-nsfw-level': media.nsfwLevel });
            mediaElement.volume = 0;
            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.playsInline = true;
            if (controls) mediaElement.controls = true;
            if (lazy) {
                onTargetInViewport(mediaElement, () => {
                    mediaElement.poster = poster;
                    mediaElement.src = videoSrc;
                });
            } else {
                mediaElement.poster = poster;
                mediaElement.src = videoSrc;
            }
            if (autoplay) {
                enableAutoPlayOnVisible(mediaElement);
                mediaContainer.classList.add('media-video', 'video-autoplay');
                mediaElement.autoplay = true;
                mediaElement.setAttribute('data-autoplay-src', videoSrc);
            } else {
                mediaContainer.classList.add('media-video', 'video-hover-play');
                const videoPlayButton = getIcon('play');
                videoPlayButton.classList.add('video-play-button');
                mediaContainer.appendChild(videoPlayButton);
            }
        }
        if (((media.type === 'image' && (!mediaElement.complete || mediaElement.naturalWidth === 0)) || (media.type === 'video' && mediaElement.readyState < 2))) {
            if (previewUrl) mediaElement.style.backgroundImage = `url(${previewUrl})`;
        } else {
            mediaElement.classList.remove('loading');
        }
        mediaElement.style.aspectRatio = (media.width/media.height).toFixed(4);
        return mediaContainer;
    }

    static #genImagesListFilters(onAnyChange) {
        const filterWrap = createElement('div', { class: 'list-filters' });

        // Sort list
        const sortOptions = [ "Most Reactions", "Most Comments", "Most Collected", "Newest", "Oldest", "Random" ];
        const sortList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.sort_images = newValue;
            onAnyChange?.();
        }, value: SETTINGS.sort_images, options: sortOptions, labels: Object.fromEntries(sortOptions.map(value => [ value, window.languagePack?.text?.sortOptions?.[value] ?? value ])) });
        sortList.element.classList.add('list-filter');
        filterWrap.appendChild(sortList.element);

        // Period list
        const periodOptions = [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ];
        const periodList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.period_images = newValue;
            onAnyChange?.();
        }, value: SETTINGS.period_images, options: periodOptions, labels: Object.fromEntries(periodOptions.map(value => [ value, window.languagePack?.text?.periodOptions?.[value] ?? value ])) });
        periodList.element.classList.add('list-filter');
        filterWrap.appendChild(periodList.element);

        // NSFW list
        const browsingLevels = {
            'None': 0,
            'Soft': 2,
            'Mature': 4,
            'X': 16,
            'true': 32,
        };
        const nsfwOptions = [ 'None', 'Soft', 'Mature', 'X', 'true' ];
        const nsfwList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.nsfwLevel = newValue;
            SETTINGS.browsingLevel = browsingLevels[newValue] ?? 4;
            onAnyChange?.();
        }, value: SETTINGS.nsfwLevel, options: nsfwOptions, labels: Object.fromEntries(nsfwOptions.map(value => [ value, window.languagePack?.text?.nsfwOptions?.[value] ?? value ])) });
        nsfwList.element.classList.add('list-filter');
        filterWrap.appendChild(nsfwList.element);

        return filterWrap;
    }

    static #genModelsListFIlters(onAnyChange) {
        const filterWrap = createElement('div', { class: 'list-filters' });
        // Models list
        const modelsOptions = [
            "All",
            "ODOR",
            "SD 1.4",
            "SD 1.5",
            "SD 1.5 LCM",
            "SD 1.5 Hyper",
            "SD 2.0",
            "SD 2.0 768",
            "SD 2.1",
            "SD 2.1 768",
            "SD 2.1 Unclip",
            "SDXL 0.9",
            "SDXL 1.0",
            "SD 3",
            "SD 3.5",
            "SD 3.5 Medium",
            "SD 3.5 Large",
            "SD 3.5 Large Turbo",
            "Pony",
            "Flux.1 S",
            "Flux.1 D",
            "Flux.1 Kontext",
            "AuraFlow",
            "SDXL 1.0 LCM",
            "SDXL Distilled",
            "SDXL Turbo",
            "SDXL Lightning",
            "SDXL Hyper",
            "Stable Cascade",
            "SVD",
            "SVD XT",
            "Playground v2",
            "PixArt a",
            "PixArt E",
            "Hunyuan 1",
            "Hunyuan Video",
            "Lumina",
            "Kolors",
            "Illustrious",
            "Mochi",
            "LTXV",
            "CogVideoX",
            "NoobAI",
            "Wan Video",
            "Wan Video 1.3B t2v",
            "Wan Video 14B t2v",
            "Wan Video 14B i2v 480p",
            "Wan Video 14B i2v 720p",
            "HiDream",
            "OpenAI",
            "Imagen4",
            "Other"
        ];
        const modelLabels = Object.fromEntries(modelsOptions.map(value => [ value, window.languagePack?.text?.modelLabels?.[value] ?? value ]));
        const modelsList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.baseModels = newValue === 'All' ? [] : [ newValue ];
            onAnyChange?.();
        }, value: SETTINGS.baseModels.length ? (SETTINGS.baseModels.length > 1 ? SETTINGS.baseModels : SETTINGS.baseModels[0]) : 'All', options: modelsOptions, labels: modelLabels });
        modelsList.element.classList.add('list-filter');
        filterWrap.appendChild(modelsList.element);

        // Types list
        const typeOptions = [ "All", "Checkpoint", "TextualInversion", "Hypernetwork", "AestheticGradient", "LORA", "LoCon", "DoRA", "Controlnet", "Upscaler", "MotionModule", "VAE", "Poses", "Wildcards", "Workflows", "Detection", "Other" ];
        const typeLabelsDefault = { "All": "All", "Checkpoint": "Checkpoint", "TextualInversion": "Textual Inversion", "Hypernetwork": "Hypernetwork", "AestheticGradient": "Aesthetic Gradient", "LORA": "LORA", "LoCon": "LoCon", "DoRA": "DoRA", "Controlnet": "СontrolNet", "Upscaler": "Upscaler", "MotionModule": "Motion", "VAE": "VAE", "Poses": "Poses", "Wildcards": "Wildcards", "Workflows": "Workflows", "Detection": "Detection", "Other": "Other" };
        const typeLabels = Object.fromEntries(typeOptions.map(value => [ value, window.languagePack?.text?.typeOptions?.[value] ?? typeLabelsDefault[value] ?? value ]));
        const typesList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.types = newValue === 'All' ? [] : [ newValue ];
            onAnyChange?.();
        }, value: SETTINGS.types.length ? (SETTINGS.types.length > 1 ? SETTINGS.types : SETTINGS.types[0]) : 'All', options: typeOptions, labels: typeLabels });
        typesList.element.classList.add('list-filter');
        filterWrap.appendChild(typesList.element);

        // Trained or merged
        const trainedOrMergedOptions = [ 'All', 'Trained', 'Merge' ];
        const trainedOrMergedLabels = Object.fromEntries(trainedOrMergedOptions.map(value => [ value, window.languagePack?.text?.checkpointTypeOptions?.[value] ?? value ]));
        const trainedOrMergedList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.checkpointType = newValue;
            onAnyChange?.();
        }, value: SETTINGS.checkpointType, options: trainedOrMergedOptions, labels: trainedOrMergedLabels });
        trainedOrMergedList.element.classList.add('list-filter');
        filterWrap.appendChild(trainedOrMergedList.element);

        // Sort list
        const sortOptions = [ "Highest Rated", "Most Downloaded", "Most Liked", "Most Discussed", "Most Collected", "Most Images", "Newest", "Oldest" ];
        const sortList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.sort = newValue;
            onAnyChange?.();
        }, value: SETTINGS.sort, options: sortOptions, labels: Object.fromEntries(sortOptions.map(value => [ value, window.languagePack?.text?.sortOptions?.[value] ?? value ])) });
        sortList.element.classList.add('list-filter');
        filterWrap.appendChild(sortList.element);

        // Period list
        const periodOptions = [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ];
        const periodList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.period = newValue;
            onAnyChange?.();
        }, value: SETTINGS.period, options: periodOptions, labels: Object.fromEntries(periodOptions.map(value => [ value, window.languagePack?.text?.periodOptions?.[value] ?? value ])) });
        periodList.element.classList.add('list-filter');
        filterWrap.appendChild(periodList.element);

        // NSFW toggle
        const nsfwToggle = this.#genBoolean({ onchange: ({ newValue }) => {
            SETTINGS.nsfw = newValue;
            onAnyChange?.();
        }, value: SETTINGS.nsfw, label: 'NSFW' });
        nsfwToggle.element.classList.add('list-filter');
        filterWrap.appendChild(nsfwToggle.element);

        return filterWrap;
    }

    static #genScrollToTopButton() {
        const button = createElement('button', { class: 'scroll-page-to-top' });
        button.appendChild(getIcon('arrow_up_alt'));
        button.addEventListener('click', () => {
            document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
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
        if (error.indexOf('No model with id') === 0) imgSrc = errorsImagesDictionary['HTTP 404'];
        else imgSrc = errorsImagesDictionary[error] || errorImageDefault;

        const errorPage = createElement('div', { class: 'error-block' });
        insertElement('img', errorPage, { alt: error, src: imgSrc });
        insertElement('h1', errorPage, { class: 'error-text' }, `${window.languagePack?.errors?.error ?? 'Error'}: ${error}`);

        return errorPage;
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

    static #genList({ onchange, value, options, labels = {} }) {
        const element = createElement('button', { class: 'config config-list' });
        let currentValue = value;
        const list = {};
        const listElements = {};
        options.forEach(key => list[key] = labels[key] ?? key);
        let listVisible = false, focusIndex = 0, forceReturnFocus = false;

        const selectedOptionElement = insertElement('div', element, { class: 'list-selected' });
        const selectedOptionTitle = insertElement('span', selectedOptionElement, undefined, list[currentValue] ?? currentValue);
        selectedOptionElement.appendChild(getIcon('arrow_down'));
        const optionsListElement = insertElement('div', element, { class: 'list-options', tabindex: -1 });
        options.forEach(key => {
            listElements[key] = insertElement('div', optionsListElement, { class: 'list-option', 'data-option': key }, list[key]);
        });
        listElements[currentValue]?.classList.add('option-selected');

        const scrollToOption = option => optionsListElement.scrollTo({ top: option.offsetTop - optionsListElement.offsetHeight/2 + option.offsetHeight/2 });
        const setFakeFocus = () => {
            const key = options[focusIndex];
            if (listElements[key]) scrollToOption(listElements[key]);
            optionsListElement.querySelector('.option-focus')?.classList.remove('option-focus');
            listElements[key]?.classList.add('option-focus');
        };
        const onfocus = e => {
            if (listVisible) return;
            optionsListElement.classList.add('list-visible');
            selectedOptionElement.classList.add('list-visible');
            optionsListElement.querySelector('.option-focus')?.classList.remove('option-focus');
            focusIndex = options.indexOf(currentValue);
            if (listElements[currentValue]) scrollToOption(listElements[currentValue]);
            listVisible = true;
        };
        const onfocusout = e => {
            if (forceReturnFocus) {
                forceReturnFocus = false;
                element.focus();
                return;
            }
            if (!listVisible) return;
            optionsListElement.classList.remove('list-visible');
            selectedOptionElement.classList.remove('list-visible');
            listVisible = false;
        };
        const onkeydown = e => {
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                focusIndex = (focusIndex + 1) % options.length;
                setFakeFocus();
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                focusIndex = focusIndex > 0 ? (focusIndex - 1) % options.length : options.length - 1;
                setFakeFocus();
            } else if (e.code === 'Enter') {
                e.preventDefault();
                const key = options[focusIndex];
                if (listElements[key]) {
                    setValue(options[focusIndex]);
                    element.blur();
                    onfocusout(e);
                }
            } else forceReturnFocus = Boolean(e.code === 'Backspace');
        };
        const onclick = e => {
            const key = e.target.closest('.list-option[data-option]')?.getAttribute('data-option');
            if (key) {
                setValue(key);
                element.blur();
                onfocusout(e);
            }
        };

        const setValue = newValue => {
            if (currentValue === newValue) return;
            onchange({ oldValue: currentValue, newValue });
            listElements[currentValue]?.classList.remove('option-selected');
            listElements[newValue]?.classList.add('option-selected');
            currentValue = newValue;
            selectedOptionTitle.textContent = list[newValue] ?? newValue;

        };

        element.addEventListener('focus', onfocus);
        element.addEventListener('focusout', onfocusout);
        element.addEventListener('keydown', onkeydown);
        optionsListElement.addEventListener('mousedown', e => e.preventDefault()); // Disable focus loss before click event when mouse is pressed
        optionsListElement.addEventListener('click', onclick);

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

    static #onCardRemoved(card, item) {
        const video = card.querySelector('.autoplay-observed');
        if (video) disableAutoPlayOnVisible(video);

        const inVIewportObserved = card.querySelector('.inviewport-observed');
        if (inVIewportObserved) onTargetInViewportClearTarget(inVIewportObserved);
    }

    static onScroll(scrollTop) {
        this.#state.scrollTop = scrollTop;
        this.#onScroll?.({ scrollTop });
    }

    static onResize() {
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
        const video = entry.target;
        if (entry.isIntersecting) video.play().catch(() => null);
        else if (!video.paused) video.pause();
    });
}, { threshold: .25 });

function enableAutoPlayOnVisible(video) {
    if (videPlaybackObservedElements.has(video)) return;
    video.classList.add('autoplay-observed');
    videPlaybackObserver.observe(video);
    videPlaybackObservedElements.add(video);
}

function disableAutoPlayOnVisible(video) {
    videPlaybackObserver.unobserve(video);
    videPlaybackObservedElements.delete(video);
    video.classList.remove('autoplay-observed');
}

const onTargetInViewportCallbacks = new Map();
const onTargetInViewportObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = entry.target;
            onTargetInViewportCallbacks.get(target)?.();
            onTargetInViewportClearTarget(target);
        }
    });
}, { threshold: 0.01, rootMargin: '150px 0px' });

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


const iconsCache = new Map();
function addIconToCache(name, original) {
    const iconName = original ? `__original--${name}` : name;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('icon-id', name);
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

function getFollowingTagGroup(startElem, tagName) {
    const result = [];
    let next = startElem.nextElementSibling;

    tagName = tagName.toUpperCase(); // DOM API uses uppercase for tagName

    while (next && next.tagName === tagName) {
        result.push(next);
        next = next.nextElementSibling;
    }

    return result;
}

function savePageSettings() {
    localStorage.setItem('civitai-lite-viewer--settings', JSON.stringify({ settings: SETTINGS, version: CONFIG.version }));
}

function clearCache(mode = 'old') {
    if (mode === 'all') {
        navigator.serviceWorker?.controller?.postMessage({ action: 'Clear Cache', data: { mode: 'all' } });
    } else {
        const urlMask = [];
        if (SETTINGS.resize) urlMask.push('^.*/width=\\d+(?![^?]*[?&]width=\\d+&height=\\d+)[^#]*[?&]target=model-card');   // If resize is enabled, remove all not resized images
        else urlMask.push('^.*/width=\\d+.*[?&]width=\\d+&height=\\d+[^#]*[?&]target=model-card');                          // If resize is disabled, remove all resized images
        if (!SETTINGS.autoplay) urlMask.push('^.*anim=true.*[?&]target=model-card.*[?&]format=webp');                       // If autoplay is disabled, remove all animated images
        navigator.serviceWorker?.controller?.postMessage({ action: 'Clear Cache', data: { mode: 'max-age-expired', urlMask } });
    }
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

// =================================

loadLanguagePack(SETTINGS.language);

Controller.gotoPage(location.hash || '#home');
history.replaceState({ id: Date.now() }, '', location.hash);

if (!document.hidden) {
    tryClearCache();
    cacheClearTimer = setInterval(tryClearCache, 60000);
}

// =================================

document.addEventListener('click', e => {
    if (e.ctrlKey || e.altKey) return;

    const href = e.target.closest('a[href^="#"]:not([target="_blank"])')?.getAttribute('href');
    if (href) {
        e.preventDefault();
        const newState = { id: Date.now() };
        if (href !== location.hash) {
            history.replaceState(Controller.state, '', location.hash);
            history.pushState(newState, '', href);
        }
        Controller.gotoPage(href, newState);
    }
});

document.addEventListener("visibilitychange", () => {
    const isVisible = !document.hidden;
    if (isVisible) {
        Array.from(document.querySelectorAll('video[muted][loop][autoplay]')).forEach(video => video.play().catch(() => null));
        if (!cacheClearTimer) {
            tryClearCache();
            cacheClearTimer = setInterval(tryClearCache, 60000);
        }
    } else {
        Array.from(document.querySelectorAll('video[muted][loop][autoplay]')).forEach(video => video.pause());
        if (cacheClearTimer) {
            clearInterval(cacheClearTimer);
            cacheClearTimer = null;
        }
    }
}, { passive: true });

document.addEventListener('mouseover', e => {
    if (e.sourceCapabilities?.firesTouchEvents) return;

    // tooltips
    const lilpipe = e.target.closest('[lilpipe-text]:not([lilpipe-showed])');
    if (lilpipe) {
        e.eventTarget = lilpipe;
        return startLilpipeEvent(e);
    }

    // videos
    const videoPLayback = e.target.closest('.video-hover-play');
    if (videoPLayback) return startVideoPlayEvent(videoPLayback);
}, { passive: true, passive: true });

document.addEventListener('focus', e => {
    // tooltips
    const lilpipe = e.target.closest('[lilpipe-text]:not([lilpipe-showed])');
    if (lilpipe) {
        e.eventTarget = lilpipe;
        return startLilpipeEvent(e, { fromFocus: true });
    }

    // videos
    const videoPLayback = e.target.closest('.video-hover-play');
    if (videoPLayback) return startVideoPlayEvent(videoPLayback, { fromFocus: true });
}, { capture: true, passive: true });


const pendingMedia = new Set();
let batchTimer = null;
function markMediaAsLoadedWhenReady(el) {
    if (!el.classList.contains('loading')) return;

    const tag = el.tagName;
    if (tag !== 'IMG' && tag !== 'VIDEO') return;

    pendingMedia.add(el);

    if (!batchTimer) {
        batchTimer = requestAnimationFrame(() => {
            for (const media of pendingMedia) {
                if (media.tagName === 'IMG' ? media.complete : media.readyState >= 2) {
                    media.classList.remove('loading');
                    media.style.backgroundImage = '';
                }
            }

            pendingMedia.clear();
            batchTimer = null;
        });
    }
}
document.addEventListener('load', e => markMediaAsLoadedWhenReady(e.target), { capture: true, passive: true });
document.addEventListener('canplay', e => markMediaAsLoadedWhenReady(e.target), { capture: true, passive: true });


window.addEventListener('popstate', e => {
    const savedState = e.state;
    const hash = location.hash || '#home';
    Controller.gotoPage(hash, savedState);
}, { passive: true });


let isPageScrolled = false;
function onScroll() {
    const scrollTop = document.documentElement.scrollTop;
    if (scrollTop > 200) {
        if (!isPageScrolled) {
            isPageScrolled = true;
            document.body.classList.add('page-scrolled');
        }
    } else if (isPageScrolled) {
        isPageScrolled = false;
        document.body.classList.remove('page-scrolled');
    }

    Controller.onScroll(scrollTop);
}
document.addEventListener('scroll', onScroll, { passive: true });

function onResize() {
    Controller.onResize();
}
window.addEventListener('resize', onResize, { passive: true });

document.getElementById('language-toggle').addEventListener('click', e => {
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
}, { passive: true });

function startVideoPlayEvent(target, options = { fromFocus: false }) {
    const video = target.querySelector('video:not([data-focus-play])');
    if (!video) return;

    const pause = video => {
        video.removeAttribute('data-focus-play');
        video.pause();
    };
    document.querySelectorAll('video[data-focus-play]').forEach(pause);

    video.setAttribute('data-focus-play', '');
    // Delay to avoid starting loading when it is not needed, for example the user simply moved the mouse over
    setTimeout(() => {
        if (video.hasAttribute('data-focus-play')) video.play().catch(() => null);
    }, Number.isNaN(video.duration) ? 150 : 50); // 

    target.addEventListener(options.fromFocus ? 'blur' : 'mouseleave', () => pause(video), { once: true, passive: true });
}

let prevLilpipeEvenetTime = 0, prevLilpipeTimer = null;
function startLilpipeEvent(e, options = { fromFocus: false }) {
    const target = e.eventTarget;
    const animationDuration = 150;

    // Remove old tooltip
    document.getElementById('tooltip')?.remove();
    document.querySelectorAll('[lilpipe-showed]')?.forEach(item => item.removeAttribute('lilpipe-showed'));
    if (prevLilpipeTimer !== null) clearTimeout(prevLilpipeTimer);
    prevLilpipeTimer = null;

    // Prepare tooltip
    const type = target.getAttribute('lilpipe-type');
    const delay = e.altKey || options.fromFocus ? 0 : Number(target.getAttribute('lilpipe-delay') ?? 400);
    const tooltip = createElement('div', { id: 'tooltip', class: `tooltip tooltip-${type ?? 'default'}` });
    tooltip.innerHTML = target.getAttribute('lilpipe-text') || '';

    // Add tooltip to page
    target.setAttribute('lilpipe-showed', '');
    const parent = target.closest('dialog') ?? document.body;
    parent.appendChild(tooltip);

    const tH = Math.ceil(tooltip.offsetHeight);
    const tW = Math.ceil(tooltip.offsetWidth);
    const wW = window.innerWidth;

    const onmouseleave = () => {
        if (prevLilpipeTimer !== null) clearTimeout(prevLilpipeTimer);
        else prevLilpipeEvenetTime = Date.now();

        tooltip.setAttribute('data-animation', 'out');
        target.removeAttribute('lilpipe-showed');
        setTimeout(() => tooltip.remove?.(), 100);
    };

    const { left, top, width, height } = target.getBoundingClientRect();
    const targetX = left + width/2 - tW/2;
    const targetY = top - tH - 8;
    const isBelow = targetY < 0;
    const newX = targetX < 0 ? 0 : targetX + tW > wW ? wW - tW - 8 : targetX;
    const newY = isBelow ? top + height + 8 : targetY;
    const offsetX = targetX - newX;

    const startAnimation = () => {
        tooltip.setAttribute('data-animation', 'in');
        setTimeout(() => {
            if (tooltip.offsetParent !== null && tooltip.getAttribute('data-animation') === 'in') tooltip.removeAttribute('data-animation');
        }, animationDuration);
    };

    tooltip.style.cssText = `left: ${newX}px; top: ${newY}px;${offsetX === 0 ? '' : ` --offsetX: ${offsetX}px;`}`;
    if (isBelow) tooltip.setAttribute('tooltip-below', '');

    if (delay && Date.now() - prevLilpipeEvenetTime > 272) {
        tooltip.remove();
        prevLilpipeTimer = setTimeout(() => {
            prevLilpipeTimer = null;

            parent.appendChild(tooltip);
            startAnimation();
        }, delay);
    } else startAnimation();

    if (options.fromFocus) target.addEventListener('blur', onmouseleave, { once: true, capture: true });
    else target.addEventListener('mouseleave', onmouseleave, { once: true });
}
