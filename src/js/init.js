/// <reference path="./_docs.d.ts" />

const CONFIG = {
    version: 9,
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
        card: {
            width: 300,
            height: 450,
            gap: 16
        },
        modelPage: {
            carouselItemWidth: 450
        },
        blurHashSize: 32, // minimum size of blur preview
    },
    timeOut: 20000, // 20 sec (API is very slow)
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
    blackListTags: [], // TODO: Doesn't work on images (pictures don't have tags), need to poke around the API, maybe there's some field like excludedTags...
    nsfw: true,
    nsfwLevel: 'X',
    browsingLevel: 16,
    hideImagesWithNoMeta: true
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

class Controller {
    static api = new CivitaiAPI(CONFIG.api_url);
    static appElement = document.getElementById('app');
    static #devicePixelRatio = +window.devicePixelRatio.toFixed(2);
    static #errorTimer = null;
    static #emptyImage = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>";
    static #pageNavigation = null; // This is necessary to ignore events that are no longer related to the current page (for example, after a long API load from an old page)

    static #types = {
        'Checkpoint': 'Checkpoint',
        'Embedding': 'Embedding',
        'Hypernetwork': 'Hypernetwork',
        'Aesthetic Gracdient': 'Aesthetic Gracdient',
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
        'SD 3.5 Large': 'SD 3.5 L T',
        'SD 3.5 Large Turbo': 'SD 3.5 L',
        'Pony': 'Pony',
        'Flux.1 S': 'F1 S',
        'Flux.1 D': 'F1',
        'Aura Flow': 'AF',
        'SDXL Lightning': 'XL Lightning',
        'SDXL Hyper': 'XL Hyper',
        'SVD': 'XVD',
        'PixArt α': 'PA α',
        'PixArt Σ': 'PA Σ',
        'Hunyuan 1': 'H1',
        'Hunyuan Video': 'Hunyuan Video',
        'Lumina': 'Lumina',
        'Kolors': 'Kolors',
        'Illustrious': 'IL',
        'Mochi': 'Mochi',
        'LTXV': 'LTXV',
        'CogVideoX': 'Cog',
        'NoobAI': 'NAI',
        'WAN Video': 'WAN',
        'HiDream': 'HID',
        'Other': 'Other'
    };

    static updateMainMenu() {
        const menu = document.querySelector('#main-menu .menu');

        menu.querySelector('a[href="#home"] span').textContent = window.languagePack?.text?.home ?? 'Home';
        menu.querySelector('a[href="#models"] span').textContent = window.languagePack?.text?.models ?? 'Models';
        menu.querySelector('a[href="#articles"] span').textContent = window.languagePack?.text?.articles ?? 'Articles';
        menu.querySelector('a[href="#images"] span').textContent = window.languagePack?.text?.images ?? 'Images';
    }

    static gotoPage(page) {
        const [ pageId, paramString ] = page?.split('?') ?? [];
        document.title = CONFIG.title;

        const pageNavigation = this.#pageNavigation = Date.now();

        this.appElement.querySelectorAll('video').forEach(video => {
            video.pause();
            disableAutoPlayOnVisible(video);
        });

        this.#devicePixelRatio = +window.devicePixelRatio.toFixed(2);
        onTargetInViewportClearAll();
        this.appElement.classList.add('page-loading');
        this.appElement.setAttribute('data-page', pageId);
        if (paramString) this.appElement.setAttribute('data-params', paramString);
        else this.appElement.removeAttribute('data-params');
        document.querySelector('#main-menu .menu a.active')?.classList.remove('active');
        if (pageId) document.querySelector(`#main-menu .menu a[href="${pageId}"]`)?.classList.add('active');
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' }); // Not sure about this...

        const finishPageLoading = () => {
            hideTimeError();
            if (pageNavigation === this.#pageNavigation) this.appElement.classList.remove('page-loading');
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
        }
        else if (pageId === '#models') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.hash) promise = this.gotoModelByHash(params.hash);
            else if (params.model) promise = this.gotoModel(params.model, params.version);
            else promise = this.gotoModels({ tag: params.tag, query: params.query, username: params.username });
        }
        else if (pageId === '#articles') promise = this.gotoArticles();
        else if (pageId === '#images') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.image) promise = this.gotoImage(params.image, params.nsfw);
            else if (params.modelversion || params.username) promise = this.gotoImages({ modelId: params.model, modelVersionId: params.modelversion, username: params.username }); // Only model dont search any
            else promise = this.gotoImages();
        }

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
        const pageNavigation = this.#pageNavigation;
        const appContent = createElement('div', { class: 'app-content-wide full-image-page' });

        return this.api.fetchImageMeta(imageId, nsfwLevel).then(media => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.log('Loaded image info', media);
            if (!media) throw new Error('No Meta');

            // Full image
            const mediaElement = this.#genMediaElement({ media, width: media.width, resize: false, target: 'full-image', autoplay: true, original: true });
            mediaElement.style.width = `${media.width}px`;
            mediaElement.classList.add('media-full-preview');
            appContent.appendChild(mediaElement);

            const metaContainer = createElement('div', { class: 'media-full-meta' });

            // NSFW LEvel
            if (media.nsfwLevel !== 'None') insertElement('div', metaContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': media.nsfwLevel }, `NSFW: ${media.nsfwLevel}`);

            // Creator
            metaContainer.appendChild(this.#genUserBlock({ username: media.username }));

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

            // Generation info
            if (media.meta) metaContainer.appendChild(this.#genImageGenerationMeta(media.meta));
            else insertElement('div', metaContainer, undefined, window.languagePack?.text?.noMeta ?? 'No generation info');

            insertElement('a', metaContainer, { href: `${CONFIG.civitai_url}/images/${media.id}`, target: '_blank', class: 'link-button', style: 'display: flex; width: 20ch;margin: 1em auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

            appContent.appendChild(metaContainer);
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Error'));

            if (error?.message === 'No Meta') {
                appContent.style.flexDirection = 'column';
                insertElement('p', appContent, { class: 'error-text' }, 'Some images cannot be retrieved via API, you can try opening this image on the original site');
                insertElement('a', appContent, { href: `${CONFIG.civitai_url}/images/${imageId}`, target: '_blank', class: 'link-button', style: 'display: flex; width: 20ch;margin: 1em auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');
            }
        }).finally(() => {
            if (pageNavigation !== this.#pageNavigation) return;
            this.appElement.textContent = '';
            this.appElement.appendChild(appContent);
        });
    }

    static gotoImages(options = {}) {
        const { modelId, username, modelVersionId } = options;

        if (username || modelVersionId) {
            const appContentWide = createElement('div', { class: 'app-content app-content-wide images-list-container' });
            const imagesList = this.#genImages({ modelId, modelVersionId, username });
            appContentWide.appendChild(imagesList);

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

        return this.api.fetchModelInfo(id)
        .then(data => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.log('Loaded model:', data);
            const modelVersion = version ? data.modelVersions.find(v => v.name === version) ?? data.modelVersions[0] : data.modelVersions[0];
            document.title = `${data.name} - ${modelVersion.name} | ${modelVersion.baseModel} | ${data.type} | ${CONFIG.title}`;
            appContent.appendChild(this.#genModelPage(data, version));

            // Images
            const appContentWide = insertElement('div', fragment, { class: 'app-content app-content-wide images-list-container' });
            const imagesTitle = insertElement('h1', appContentWide, { style: 'justify-content: center;;' });
            imagesTitle.appendChild(getIcon('image'));
            insertElement('a', imagesTitle, { href: `#images?model=${id}&modelversion=${modelVersion.id}` }, window.languagePack?.text?.images ?? 'Images');

            const imagesListTrigger = insertElement('div', appContentWide, undefined, '...');
            onTargetInViewport(imagesListTrigger, () => {
                imagesListTrigger.remove();
                const imagesList = this.#genImages({ modelId: data.id, modelVersionId: modelVersion.id });
                appContentWide.appendChild(imagesList);
            });
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
        const appContent = createElement('div', { class: 'app-content app-content-wide' });
        const listWrap = insertElement('div', appContent, { id: 'models-list', class: 'cards-list models-list cards-loading', style: `--card-width: ${CONFIG.appearance.card.width}px; --card-height: ${CONFIG.appearance.card.height}px; --gap: ${CONFIG.appearance.card.gap}px;` });

        let allCards = [];
        let displayedCards = new Set();
        let fakeIndex = 0;
        const setFakeFocus = index => {
            listWrap.querySelector('[tabindex="0"]')?.setAttribute('tabindex', -1);
            allCards[index].setAttribute('tabindex', 0);
            allCards[index].focus();
        };
        listWrap.addEventListener('keydown', e => {
            if (e.ctrlKey) return;

            const columns = Math.floor(window.innerWidth / (CONFIG.appearance.card.width + CONFIG.appearance.card.gap));

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (Math.floor((fakeIndex + 1) / columns) === Math.floor(fakeIndex / columns)) {
                    fakeIndex++;
                    setFakeFocus(fakeIndex);
                }
                
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (Math.floor((fakeIndex - 1) / columns) === Math.floor(fakeIndex / columns)) {
                    fakeIndex--;
                    setFakeFocus(fakeIndex);
                }
                
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (fakeIndex + columns < allCards.length) {
                    fakeIndex += columns;
                    setFakeFocus(fakeIndex);
                }
                
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (fakeIndex >= columns) {
                    fakeIndex -= columns;
                    setFakeFocus(fakeIndex);
                }
                
            }
        });

        const insertModels = models => {
            const pageNavigation = this.#pageNavigation;
            console.log('Loaded models:', models);

            const fragment = new DocumentFragment();
            models.forEach(model => {
                if (!model.modelVersions?.length || displayedCards.has(model.id) || model.tags.some(tag => SETTINGS.blackListTags.includes(tag))) return;
                displayedCards.add(model.id);
                const card = this.#genModelCard(model);
                card.setAttribute('tabindex', -1);
                allCards.push(card);
                fragment.appendChild(card);
            });

            if (query.cursor) {
                const loadMoreTrigger = insertElement('div', fragment, { id: 'load-more' });
                loadMoreTrigger.appendChild(getIcon('infinity'));
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    loadMore().then(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', fragment, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
            }

            listWrap.appendChild(fragment);
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
                limit: 100,
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
            listWrap.querySelectorAll('video').forEach(video => {
                video.pause();
                disableAutoPlayOnVisible(video);
            });
            const pageNavigation = this.#pageNavigation;
            displayedCards = new Set();

            return this.api.fetchModels(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                allCards = [];
                listWrap.textContent = '';
                insertModels(data.items);
                allCards[0]?.setAttribute('tabindex', 0);
                fakeIndex = 0;
                document.title = `${CONFIG.title} - ${window.languagePack?.text?.models ?? 'Models'}`;
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Error:', error?.message ?? error);
                listWrap.textContent = '';
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            }).finally(() => {
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
            const url = new URL(href);
            if (url.origin !== CONFIG.civitai_url) throw new Error(`Unknown url origin, must be ${CONFIG.civitai_url}`);
            const searchParams = Object.fromEntries(url.searchParams);
            if (url.pathname.indexOf('/models/') === 0) {
                const modelId = url.pathname.match(/\/models\/(\d+)/i)?.[1];
                if (!modelId) throw new Error('There is no model id in the link');
                let redirectUrl = `#models?model=${modelId}`;
                if (searchParams.modelVersionId) redirectUrl += `&version${searchParams.modelVersionId}`;
                window.location.href = redirectUrl;
            } else if (url.pathname.indexOf('/images/') === 0) {
                const imageId = url.pathname.match(/\/images\/(\d+)/i)?.[1];
                if (!imageId) throw new Error('There is no image id in the link');
                const redirectUrl = `#images?image=${imageId}`;
                window.location.href = redirectUrl;
            } else throw new Error('Unsupported url');
        } catch(error) {
            const appContent = createElement('div', { class: 'app-content' });

            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Bad url'));

            this.appElement.textContent = '';
            this.appElement.appendChild(appContent);
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
                insertElement('span', a, undefined, downloadTitle);
            } else if (file.type === 'Archive') {
                const downloadTitle = `${download} (${fileSize})`;
                insertElement('span', a, undefined, downloadTitle);
                a.appendChild(getIcon('file_zip'));
            } else {
                const downloadTitle = `${download} (${fileSize})` + (file.metadata.format === 'SafeTensor' ? '' : ` ${file.metadata.format}`);
                insertElement('span', a, undefined, downloadTitle);
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
            const item = id && media.hasMeta? createElement('a', { href: id ? `#images?image=${encodeURIComponent(id)}&nsfw=${this.#convertNSFWLevelToString(media.nsfwLevel)}` : '', style: `aspect-ratio: ${ratio};`, tabindex: -1 }) : createElement('div', { style: `aspect-ratio: ${ratio};` });
            const itemWidth = ratio > 1.5 ? CONFIG.appearance.modelPage.carouselItemWidth * 2 : CONFIG.appearance.modelPage.carouselItemWidth;
            const mediaElement = this.#genMediaElement({ media, width: itemWidth, height: undefined, resize: false, lazy: index > 3, taget: 'model-preview' });
            item.appendChild(mediaElement);
            return { element: item, isWide: ratio > 1.5 };
        });
        modelPreviewWrap.appendChild(this.#genCarousel(previewList, { carouselItemWidth: CONFIG.appearance.modelPage.carouselItemWidth }));

        // const hideLongDescription = el => {
        //     el.classList.add('hide-long-description');
        //     const showMore = createElement('button', { class: 'show-more' }, 'Show more');
        //     el.prepend(showMore);
        //     showMore.addEventListener('click', () => {
        //         el.classList.remove('hide-long-description');
        //         showMore.remove();
        //     }, { once: true });
        // };

        // Model version description
        const modelVersionDescription = insertElement('div', page, { class: 'model-description model-version-description' });
        const modelVersionNameWrap = insertElement('h2', modelVersionDescription, { class: 'model-version' }, modelVersion.name);
        const versionStatsList = [
            { icon: 'like', value: modelVersion.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'download', value: modelVersion.stats.downloadCount, formatter: formatNumber, unit: 'download' },
        ];
        modelVersionNameWrap.appendChild(this.#genStats(versionStatsList));
        if (modelVersion.trainedWords?.length > 0) {
            const trainedWordsContainer = insertElement('div', modelVersionDescription, { class: 'trigger-words' });
            modelVersion.trainedWords.forEach(word => {
                insertElement('code', trainedWordsContainer, { class: 'trigger-word' }, word);
            });
        }
        if (model.creator) modelVersionDescription.appendChild(this.#genUserBlock(model.creator));
        if (modelVersion.description) {
            modelVersion.description = this.#analyzeModelDescriptionString(modelVersion.description);
            const modelVersionContainer = safeParseHTML(modelVersion.description);
            modelVersionDescription.appendChild(modelVersionContainer);
            this.#analyzeModelDescription(modelVersionContainer);
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
        insertElement('a', page, { href: `${CONFIG.civitai_url}/models/${model.id}?modelVersionId=${modelVersion.id}`, target: '_blank', class: 'link-button', style: 'display: flex; width: 20ch;margin: 2em auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        // Comments
        // ...

        return page;
    }

    // TODO: change number of columns when browser resizes
    static #genImages(options = {}) {
        const { modelId, modelVersionId, username } = options;
        let query;
        const fragment = new DocumentFragment();
        const listWrap = createElement('div', { id: 'images-list', class: 'cards-list images-list cards-loading', style: `--card-width: ${CONFIG.appearance.card.width}px; --gap: ${CONFIG.appearance.card.gap}px;` });

        let allImages = [];
        let displayedCards = new Set();
        let columns = [];
        let fakeIndex = 0;
        let fakeTableIndex = 0;
        const setFakeFocus = index => {
            listWrap.querySelector('[tabindex="0"]')?.setAttribute('tabindex', -1);
            allImages[index].element.setAttribute('tabindex', 0);
            allImages[index].element.focus();
        };
        listWrap.addEventListener('keydown', e => {
            if (e.ctrlKey) return;

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (fakeTableIndex + 1 < columns.length) {
                    const currentColumn = columns[fakeTableIndex].positions;
                    const currentImageTop = currentColumn.find(e => e.index === fakeIndex).top;
    
                    fakeTableIndex = fakeTableIndex + 1;
                    const nextColumn = columns[fakeTableIndex].positions;
                    const closestImage = nextColumn.reduce((closest, item) => {
                        const diff = Math.abs(item.top - currentImageTop);
                        const closestDiff = Math.abs(closest.top - currentImageTop);
                        return diff < closestDiff ? item : closest;
                    });
                    fakeIndex = closestImage.index;
                    setFakeFocus(fakeIndex);
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (fakeTableIndex > 0) {
                    const currentColumn = columns[fakeTableIndex].positions;
                    const currentImageTop = currentColumn.find(e => e.index === fakeIndex).top;
    
                    fakeTableIndex = fakeTableIndex - 1;
                    const nextColumn = columns[fakeTableIndex].positions;
                    const closestImage = nextColumn.reduce((closest, item) => {
                        const diff = Math.abs(item.top - currentImageTop);
                        const closestDiff = Math.abs(closest.top - currentImageTop);
                        return diff < closestDiff ? item : closest;
                    });
                    fakeIndex = closestImage.index;
                    setFakeFocus(fakeIndex);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const column = columns[fakeTableIndex].positions;
                const currentImageIndex = column.findIndex(e => e.index === fakeIndex);
                if (currentImageIndex < column.length) {
                    const closestImage = column[currentImageIndex + 1];
                    fakeIndex = closestImage.index;
                    setFakeFocus(fakeIndex);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const column = columns[fakeTableIndex].positions;
                const currentImageIndex = column.findIndex(e => e.index === fakeIndex);
                if (currentImageIndex > 0) {
                    const closestImage = column[currentImageIndex - 1];
                    fakeIndex = closestImage.index;
                    setFakeFocus(fakeIndex);
                }
            }
        });

        fragment.appendChild(this.#genImagesListFilters(() => {
            savePageSettings();
            this.#pageNavigation = Date.now();
            listWrap.classList.add('cards-loading');
            loadImages();
        }));

        const firstLoadingPlaceholder = insertElement('div', fragment, { id: 'load-more' });
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

        const updateColumns = () => {
            columns = [];
            // padding left + N columns with padding right, padding on the right of the container is taken into account as padding of the last column
            const columnsCount = Math.floor((window.innerWidth - CONFIG.appearance.card.gap) / (CONFIG.appearance.card.width + CONFIG.appearance.card.gap));
            for(let i = 0; i < columnsCount; i++) {
                columns.push({
                    height: 0,
                    element: createElement('div', { class: 'images-column' }),
                    positions: []
                });
            }

            if (allImages.length) {
                displayedCards = new Set();
                insertImages(allImages);
                allImages[0].element.setAttribute('tabindex', 0);
                fakeIndex = 0;
                fakeTableIndex = 0;
            }
        };

        const insertImages = images => {
            const pageNavigation = this.#pageNavigation;
            console.log('Loaded images:', images);

            if (SETTINGS.hideImagesWithNoMeta) {
                const countAll = images.length;
                images = images.filter(image => image.meta);
                if (images.length < countAll) console.log(`Hidden ${countAll - images.length} image(s) without meta information about generation`);
            }

            images.forEach(image => {
                if (displayedCards.has(image.id)) return;
                displayedCards.add(image.id);

                const card = image.element ?? this.#genImageCard(image);
                card.setAttribute('tabindex', -1);
                const ratio = image.width / image.height;

                if (!image.element) image.element = card;
                allImages.push(image);

                const targetColumn = columns.reduce((minCol, col) => {
                    return col.height < minCol.height ? col : minCol;
                }, columns[0]);

                targetColumn.element.appendChild(card);
                const cardHeight = Math.round(CONFIG.appearance.card.width / ratio);
                targetColumn.positions.push({ element: card, top: Math.round(targetColumn.height + cardHeight / 2), index: allImages.length - 1 });
                targetColumn.height += cardHeight + CONFIG.appearance.card.gap;
            });

            const targetColumn = columns.reduce((minCol, col) => {
                return col.height < minCol.height ? col : minCol;
            }, columns[0]);

            if (query.cursor) {
                const loadMoreTrigger = insertElement('div', targetColumn.element, { id: 'load-more' });
                loadMoreTrigger.appendChild(getIcon('infinity'));
                onTargetInViewport(loadMoreTrigger, () => {
                    if (pageNavigation !== this.#pageNavigation) return;
                    loadMore().then(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', targetColumn.element, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
            }
        };

        const loadImages = () => {
            query = {
                limit: 100,
                sort: SETTINGS.sort_images,
                period: SETTINGS.period_images,
                nsfw: SETTINGS.nsfwLevel,
                modelId,
                modelVersionId,
                username
            };
            listWrap.querySelectorAll('video').forEach(video => {
                video.pause();
                disableAutoPlayOnVisible(video);
            });
            const pageNavigation = this.#pageNavigation;
            displayedCards = new Set();
            allImages = [];
            updateColumns();

            return this.api.fetchImages(query).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                query.cursor = data.metadata?.nextCursor ?? null;
                insertImages(data.items);
                listWrap.textContent = '';
                columns.forEach(col => listWrap.appendChild(col.element));
                allImages[0]?.element?.setAttribute('tabindex', 0);
                fakeIndex = 0;
                fakeTableIndex = 0;
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Error:', error?.message ?? error);
                listWrap.textContent = '';
                listWrap.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
            }).finally(() => {
                listWrap.classList.remove('cards-loading');
            });
        };

        loadImages().finally(() => {
            firstLoadingPlaceholder.remove();
        });

        return fragment;
    }

    static #genStats(stats) {
        const statsWrap = createElement('div', { class: 'badges' });
        stats.forEach(({ icon, iconString, value, formatter, unit, type }) => {
            const statWrap = insertElement('div', statsWrap, { class: 'badge', 'data-value': value });
            if (unit) {
                const untis = window.languagePack?.units?.[unit];
                if (untis) statWrap.setAttribute('lilpipe-text', `${value} ${pluralize(value, untis)}`);
            } else if (!type) statWrap.setAttribute('lilpipe-text', value);
            if (type) statWrap.setAttribute('data-badge', type);
            if (icon) statWrap.appendChild(getIcon(icon));
            if (iconString) statWrap.appendChild(document.createTextNode(iconString));
            insertElement('span', statWrap, undefined, formatter?.(value) ?? value);
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
            if (text === 'positive prompt' || text.indexOf('+prompt') === 0 || text.indexOf('positive prompt') === 0) {
                getFollowingTagGroup(p, 'pre').forEach(pre => {
                    const code = pre.querySelector('code');
                    if (!code) return;

                    code.classList.add('prompt', 'prompt-positive');
                });
            } else if (text === 'negative prompt' || text.indexOf('-prompt') === 0 || text.indexOf('negative prompt') === 0) {
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

        description.querySelectorAll('code.prompt').forEach(this.#analyzePromptCode);
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
        const tokens = fixedText.match(/<lora:[^:>]+:[^>]+>|\\[()[\]]|[\[\]()]+|:-?[0-9.]+|[\w\-]+|,|\s+|[^\s\w]/g) || [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (/^<lora:[^:>]+:[^>]+>$/.test(token)) {
                insertElement('span', fragment, { class: 'lora' }, token);
            } else if (/^[\[\]()]+$/.test(token)) {
                insertElement('span', fragment, { class: 'bracket' }, token);
            } else if (/^:-?[0-9.]+$/.test(token) && tokens[i + 1]?.[0] === ')') {
                insertElement('span', fragment, { class: 'weight' }, token);
            } else if (keywords.has(token)) {
                insertElement('span', fragment, { class: 'keyword' }, token);
            } else {
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
            this.#analyzePromptCode(code);
        }
        if (meta.negativePrompt) {
            const code = insertElement('code', container, { class: 'prompt prompt-negative' }, meta.negativePrompt);
            this.#analyzePromptCode(code);
        }
        const otherMetaContainer = insertElement('div', container, { class: 'meta-other' });
        const insertOtherMeta = (key, value) => {
            const item = insertElement('code', otherMetaContainer, { class: 'meta-other-item' }, key ? `${key}: ` : '');
            if (value) insertElement('span', item, { class: 'meta-value' }, value);
            return item;
        };
        if (meta.Size) insertOtherMeta('Size', meta.Size);
        if (meta.cfgScale) {
            const cfg = +(meta.cfgScale).toFixed(4);
            const item = insertOtherMeta('CFG', cfg);
            if (cfg !== meta.cfgScale) item.setAttribute('lilpipe-text', meta.cfgScale);
        }
        if (meta.sampler) insertOtherMeta('Sampler', meta.sampler);
        if (meta['Schedule type'] || meta.scheduler ) insertOtherMeta('Sheduler', meta['Schedule type'] || meta.scheduler);
        if (meta.steps) insertOtherMeta('Steps', meta.steps);
        if (meta.clipSkip) insertOtherMeta('clipSkip', meta.clipSkip);
        if (meta.seed) insertOtherMeta('Seed', meta.seed);
        if (meta['Denoising strength'] || meta.denoise) insertOtherMeta('Denoising', meta['Denoising strength'] || meta.denoise);
        if (meta.workflow) insertOtherMeta('', meta.workflow);
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
                if (weight !== 1) insertElement('span', titleElement, { class: 'meta-resource-weight', 'data-weight': weight === 0 ? '=0' : weight > 0 ? '>0' : '<0' }, `:${weight}`);
                return el;
            };

            resources.forEach(item => {
                const el = createResourceRowContent({
                    title: item.name || (item.modelVersionId ? `VersionId: ${item.modelVersionId}` : undefined) || (item.hash ? `Hash: ${item.hash}` : undefined) || 'Unknown',
                    version: item.modelVersionName,
                    weight: item.weight,
                    type: item.type ?? 'Unknown',
                    baseModel: 'Unknown base model'
                });
                resourcesContainer.appendChild(el);

                let fetchPromise = null;
                if (item.modelVersionId) fetchPromise = this.api.fetchModelVersionInfo(item.modelVersionId);
                else if (item.hash) fetchPromise = this.api.fetchModelVersionInfo(item.hash, true);
                if (!fetchPromise) return;

                el.classList.add('meta-resource-loading');
                const promise = fetchPromise.then(info => {
                    if (!info) return info;
                    const newEl = createResourceRowContent({
                        title: info?.model?.name,
                        version: info.name,
                        baseModel: info.baseModel,
                        type: info?.model?.type,
                        weight: item.weight,
                        href: info.modelId && info.name ? `#models?model=${info.modelId}&version=${info.name}` : undefined
                    });
                    resourcesContainer.replaceChild(newEl, el);
                    return info;
                }).finally(() => {
                    el.classList.remove('meta-resource-loading');
                });
                resourcePromises.push(promise);
            });

            if (resourcePromises.length) {
                Promise.all(resourcePromises).then(result => {
                    result = result.filter(Boolean);
                    const trainedWords = new Set();
                    const rawTooltips = {};
                    console.log('Loaded resources', result);

                    result.forEach(item => {
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
                            triggerTooltips[word.toLowerCase()] = `<ul>${Array.from(rawTooltips[word]).map(w => `<li>${w}</li>`).join('')}</ul>`;
                        }
                    });

                    if (!trainedWords.size) return;

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
                }).finally(() => {
                    resourcesContainer.classList.remove('meta-resources-loading');
                });
            } else {
                resourcesContainer.classList.remove('meta-resources-loading');
            }

        }

        return container;
    }

    static #genModelCard(model) {
        const modelVersion = model.modelVersions[0];
        const previewMedia = modelVersion.images.find(media => media.nsfwLevel <= SETTINGS.browsingLevel);
        const card = createElement('a', { class: 'card model-card', 'data-id': model.id, 'data-media': previewMedia?.type ?? 'none', href: `#models?model=${model.id}` });

        // Image
        if (previewMedia?.type === 'video' && !SETTINGS.autoplay) card.classList.add('video-hover-play');
        if (previewMedia) {
            const mediaElement = this.#genMediaElement({ media: previewMedia, width: CONFIG.appearance.card.width, height: CONFIG.appearance.card.height, resize: SETTINGS.resize, target: 'model-card', lazy: true });
            mediaElement.classList.add('card-background');
            card.appendChild(mediaElement);
        } else {
            const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
            const noMedia = insertElement('div', cardBackgroundWrap, { class: 'no-media' }, window.languagePack?.errors?.no_media ?? 'No Media');
            noMedia.appendChild(getIcon('image'));
        }

        const cardContentWrap = insertElement('div', card, { class: 'card-content' });

        // Model Type
        const modelTypeWrap = insertElement('div', cardContentWrap, { class: 'model-type' });
        if (this.#types[model.type]) insertElement('span', modelTypeWrap, undefined, this.#types[model.type]);
        else insertElement('span', modelTypeWrap, undefined, model.type);
        if (modelVersion.baseModel) insertElement('span', modelTypeWrap, { class: 'model-baseType' }, this.#baseModels[modelVersion.baseModel] ?? modelVersion.baseModel);

        // Availability
        const availabilityBadge = modelVersion.availability !== 'Public' ? modelVersion.availability : (new Date() - new Date(modelVersion.publishedAt) < 3 * 24 * 60 * 60 * 1000) ? model.modelVersions.length > 1 ? 'Updated' : 'New' : null;
        if (availabilityBadge) insertElement('span', modelTypeWrap, { class: 'model-availability', 'data-availability': availabilityBadge }, window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge);

        // Creator
        if (model.creator) cardContentWrap.appendChild(this.#genUserBlock(model.creator));
    
        // Model Name
        insertElement('div', cardContentWrap, { class: 'model-name' }, model.name);

        // Stats
        const statsList = [
            { icon: 'download', value: model.stats.downloadCount, formatter: formatNumber, unit: 'download' },
            { icon: 'like', value: model.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'chat', value: model.stats.commentCount, formatter: formatNumber, unit: 'comment' },
            // { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' }, // Always empty (API does not give a value, it is always 0)
        ];
        cardContentWrap.appendChild(this.#genStats(statsList));

        return card;
    }

    static #genImageCard(image) {
        const card = createElement('a', { class: 'card image-card', 'data-id': image.id, 'data-media': image?.type ?? 'none', href: `#images?image=${encodeURIComponent(image.id)}&nsfw=${image.browsingLevel ? this.#convertNSFWLevelToString(image.browsingLevel) : image.nsfw}`, style: `--aspect-ratio: ${(image.width/image.height).toFixed(4)};` });

        // Image
        if (image?.type === 'video' && !SETTINGS.autoplay) card.classList.add('video-hover-play');
        const mediaElement = this.#genMediaElement({ media: image, width: CONFIG.appearance.card.width, resize: SETTINGS.resize, target: 'image-card', lazy: true });
        mediaElement.classList.add('card-background');
        card.appendChild(mediaElement);

        const cardContentWrap = insertElement('div', card, { class: 'card-content' });

        // Badges
        const badgesContainer = insertElement('div', cardContentWrap, { class: 'badges other-badges' });
        // NSFW Level
        if (image.nsfwLevel !== 'None') insertElement('div', badgesContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': image.nsfwLevel }, image.nsfwLevel);
        // Meta
        if (image.meta) {
            const metaIconContainer = insertElement('div', badgesContainer, { class: 'image-meta badge', 'lilpipe-text': window.languagePack?.text?.hasMeta ?? 'Generation info' });
            metaIconContainer.appendChild(getIcon('tag'));
        }
        
        // Creator and Created At
        const creator = this.#genUserBlock({ username: image.username });
        if (image.createdAt) {
            const createdAt = new Date(image.createdAt);
            insertElement('span', creator, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
        }
        cardContentWrap.appendChild(creator);
    
        // Stats
        const statsList = [
            { iconString: '👍', value: image.stats.likeCount, formatter: formatNumber, unit: 'like' },
            { iconString: '👎', value: image.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
            { iconString: '😭', value: image.stats.cryCount, formatter: formatNumber },
            { iconString: '❤️', value: image.stats.heartCount, formatter: formatNumber },
            { iconString: '🤣', value: image.stats.laughCount, formatter: formatNumber },
            // { icon: 'chat', value: image.stats.commentCount, formatter: formatNumber, unit: 'comment' }, // Always empty (API does not give a value, it is always 0)
        ];
        cardContentWrap.appendChild(this.#genStats(statsList));

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
        insertElement('div', container, undefined, userInfo.username);

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

    static #genMediaElement({ media, width, height = undefined, resize = true, lazy = false, target = null, controls = false, original = false, autoplay = SETTINGS.autoplay }) {
        const mediaContainer = createElement('div', { class: 'media-container' });
        let mediaElement;
        const targetWidth = Math.round(width * this.#devicePixelRatio);
        const targetHeight = height ? Math.round(height * this.#devicePixelRatio) : null;
        const blurSize = CONFIG.appearance.blurHashSize;
        const ratio = media.width / media.height;
        const newRequestSize = ratio < 1 || !targetHeight ? `width=${targetWidth}` : `height=${targetHeight}`;
        const params = resize && !original ? `?width=${targetWidth}${targetHeight ? `&height=${targetHeight}` : ''}&fit=crop` : '';
        const url = `${original ? media.url : media.url.replace(/\/width=\d+\//, `/${newRequestSize},anim=false,optimized=true/`)}${target ? (params ? `${params}&target=${target}` : `?target=${target}`) : params}`;
        const previewUrl = media.hash ? `${CONFIG.local_urls.blurHash}?hash=${encodeURIComponent(media.hash)}&width=${ratio < 1 ? blurSize : Math.round(blurSize/ratio)}&height=${ratio < 1 ? Math.round(blurSize/ratio) : blurSize}` : '';
        if (media.type === 'image') {
            const src = autoplay ? url.replace(/anim=false,?/, '') : (resize ? `${url}&format=webp` : url);
            mediaElement = insertElement('img', mediaContainer, { class: 'loading',  alt: ' ', crossorigin: 'anonymous', src: lazy ? '' : src, 'data-nsfw-level': media.nsfwLevel });
            if (lazy) {
                onTargetInViewport(mediaElement, () => {
                    mediaElement.src = src;
                });
            }
            mediaContainer.classList.add('media-image');
        } else {
            const src = url.replace('optimized=true', 'optimized=true,transcode=true');
            const poster = resize ? `${src}&format=webp` : src;
            const videoSrc = src.replace(/anim=false,?/, '');
            mediaElement = insertElement('video', mediaContainer, { class: 'loading',  muted: '', loop: '', playsInline: '', crossorigin: 'anonymous', preload: 'none', 'data-nsfw-level': media.nsfwLevel });
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
            } else {
                mediaContainer.classList.add('media-video', 'video-hover-play');
                const videoPlayButton = getIcon('play');
                videoPlayButton.classList.add('video-play-button');
                mediaContainer.appendChild(videoPlayButton);
            }
        }
        if (previewUrl) mediaElement.style.backgroundImage = `url(${previewUrl})`;
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
        const filterSortList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'sort' });
        filterSortList.appendChild(sortList.element);

        // Period list
        const periodOptions = [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ];
        const periodList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.period_images = newValue;
            onAnyChange?.();
        }, value: SETTINGS.period_images, options: periodOptions, labels: Object.fromEntries(periodOptions.map(value => [ value, window.languagePack?.text?.periodOptions?.[value] ?? value ])) });
        const filterPeriodList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'period' });
        filterPeriodList.appendChild(periodList.element);

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
        const filterNsfwList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'nsfwLevel' });
        filterNsfwList.appendChild(nsfwList.element);

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
            "Other"
        ];
        const modelLabels = Object.fromEntries(modelsOptions.map(value => [ value, window.languagePack?.text?.modelLabels?.[value] ?? value ]));
        const modelsList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.baseModels = newValue === 'All' ? [] : [ newValue ];
            onAnyChange?.();
        }, value: SETTINGS.baseModels.length ? SETTINGS.baseModels : 'All', options: modelsOptions, labels: modelLabels });
        const filterModelsList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'model' });
        filterModelsList.appendChild(modelsList.element);

        // Types list
        const typeOptions = [ "All", "Checkpoint", "TextualInversion", "Hypernetwork", "AestheticGradient", "LORA", "LoCon", "DoRA", "Controlnet", "Upscaler", "MotionModule", "VAE", "Poses", "Wildcards", "Workflows", "Detection", "Other" ];
        const typeLabelsDefault = { "All": "All", "Checkpoint": "Checkpoint", "TextualInversion": "Textual Inversion", "Hypernetwork": "Hypernetwork", "AestheticGradient": "Aesthetic Gradient", "LORA": "LORA", "LoCon": "LoCon", "DoRA": "DoRA", "Controlnet": "СontrolNet", "Upscaler": "Upscaler", "MotionModule": "Motion", "VAE": "VAE", "Poses": "Poses", "Wildcards": "Wildcards", "Workflows": "Workflows", "Detection": "Detection", "Other": "Other" };
        const typeLabels = Object.fromEntries(typeOptions.map(value => [ value, window.languagePack?.text?.typeOptions?.[value] ?? typeLabelsDefault[value] ?? value ]));
        const typesList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.types = newValue === 'All' ? [] : [ newValue ];
            onAnyChange?.();
        }, value: SETTINGS.types.length ? SETTINGS.types : 'All', options: typeOptions, labels: typeLabels });
        const filterTypesList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'type' });
        filterTypesList.appendChild(typesList.element);

        // Trained or merged
        const trainedOrMergedOptions = [ 'All', 'Trained', 'Merge' ];
        const trainedOrMergedLabels = Object.fromEntries(trainedOrMergedOptions.map(value => [ value, window.languagePack?.text?.checkpointTypeOptions?.[value] ?? value ]));
        const trainedOrMergedList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.checkpointType = newValue;
            onAnyChange?.();
        }, value: SETTINGS.checkpointType, options: trainedOrMergedOptions, labels: trainedOrMergedLabels });
        const filterTrainedOrMergedList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'checkpointType' });
        filterTrainedOrMergedList.appendChild(trainedOrMergedList.element);

        // Sort list
        const sortOptions = [ "Highest Rated", "Most Downloaded", "Most Liked", "Most Discussed", "Most Collected", "Most Images", "Newest", "Oldest" ];
        const sortList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.sort = newValue;
            onAnyChange?.();
        }, value: SETTINGS.sort, options: sortOptions, labels: Object.fromEntries(sortOptions.map(value => [ value, window.languagePack?.text?.sortOptions?.[value] ?? value ])) });
        const filterSortList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'sort' });
        filterSortList.appendChild(sortList.element);

        // Period list
        const periodOptions = [ 'AllTime', 'Year', 'Month', 'Week', 'Day' ];
        const periodList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.period = newValue;
            onAnyChange?.();
        }, value: SETTINGS.period, options: periodOptions, labels: Object.fromEntries(periodOptions.map(value => [ value, window.languagePack?.text?.periodOptions?.[value] ?? value ])) });
        const filterPeriodList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'period' });
        filterPeriodList.appendChild(periodList.element);

        // NSFW toggle
        const filterNSFW = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'nsfw' });
        const nsfwToggle = this.#genBoolean({ onchange: ({ newValue }) => {
            SETTINGS.nsfw = newValue;
            onAnyChange?.();
        }, value: SETTINGS.nsfw, label: 'NSFW' });
        filterNSFW.appendChild(nsfwToggle.element);

        return filterWrap;
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
        const optionsListElement = insertElement('div', element, { class: 'list-options' });
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
}

// ==============================

const videPlaybackObservedElements = new Set();
const videPlaybackObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) video.play().catch(() => null);
        else video.pause();
    });
}, { threshold: .25 });

function enableAutoPlayOnVisible(video) {
    if (videPlaybackObservedElements.has(video)) return;
    videPlaybackObserver.observe(video);
    videPlaybackObservedElements.add(video);
}

function disableAutoPlayOnVisible(video) {
    videPlaybackObserver.unobserve(video);
    videPlaybackObservedElements.delete(video);
}

const onTargetInViewportCallbacks = new Map();
const onTargetInViewportObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = entry.target;
            onTargetInViewportObserver.unobserve(target);
            onTargetInViewportCallbacks.get(target)?.();
            onTargetInViewportCallbacks.delete(target);
        }
    });
}, { threshold: 0.1, rootMargin: '150px 0px' });

function onTargetInViewport(target, callback) {
    onTargetInViewportCallbacks.set(target, callback);
    onTargetInViewportObserver.observe(target);
}

function onTargetInViewportClearAll() {
    onTargetInViewportCallbacks.keys().forEach(element => {
        onTargetInViewportObserver.unobserve(element);
        onTargetInViewportCallbacks.delete(element);
    });
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
        if (href !== location.hash) history.pushState(null, '', href);
        Controller.gotoPage(href);
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

document.addEventListener('canplay', e => {
    const target = e.target;
    requestAnimationFrame(() => {
        target.classList.remove('loading');
        target.style.backgroundImage = '';
    });
}, { passive: true, capture: true });

document.addEventListener('load', e => {
    const target = e.target;
    requestAnimationFrame(() => {
        target.classList.remove('loading');
        target.style.backgroundImage = '';
    });
}, { passive: true, capture: true });

window.addEventListener('popstate', () => {
    const hash = location.hash || '#home';
    Controller.gotoPage(hash);
}, { passive: true });

let isPageScrolled = false;
let pageScrollTimer = null;
document.addEventListener('scroll', e => {
    if (pageScrollTimer !== null) return;
    pageScrollTimer = setTimeout(() => requestAnimationFrame(() => {
        pageScrollTimer = null;
        if (document.documentElement.scrollTop > 200) {
            if (!isPageScrolled) {
                isPageScrolled = true;
                document.body.classList.add('page-scrolled');
            }
        } else if (isPageScrolled) {
            isPageScrolled = false;
            document.body.classList.remove('page-scrolled');
        }
    }), 100);
}, { passive: true });

document.getElementById('language-toggle').addEventListener('click', e => {
    if (e.target.closest('#language-button')) {
        document.getElementById('language-list').classList.toggle('hidden');
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
    }, 150);

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

    tooltip.style.cssText = `left: ${newX}px; top: ${newY}px;${offsetX === 0 ? '' : ` --offsetX: ${offsetX}px;`}`;
    if (isBelow) tooltip.setAttribute('tooltip-below', '');

    if (delay && Date.now() - prevLilpipeEvenetTime > 272) {
        tooltip.remove();
        prevLilpipeTimer = setTimeout(() => {
            prevLilpipeTimer = null;

            parent.appendChild(tooltip);
            tooltip.setAttribute('data-animation', 'in');
            setTimeout(() => tooltip.removeAttribute('data-animation'), animationDuration);
        }, delay);
    } else {
        tooltip.setAttribute('data-animation', 'in');
        setTimeout(() => tooltip.removeAttribute('data-animation'), animationDuration);
    }

    if (options.fromFocus) target.addEventListener('blur', onmouseleave, { once: true, capture: true });
    else target.addEventListener('mouseleave', onmouseleave, { once: true });
}
