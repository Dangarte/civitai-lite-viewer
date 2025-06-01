/// <reference path="./_docs.d.ts" />

const CONFIG = {
    version: 5,
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
    autoplay: true,
    resize: false,
    checkpointType: 'All',
    types: [ 'Checkpoint' ],
    sort: 'Highest Rated',
    sort_images: 'Newest',
    period: 'Month',
    period_images: 'Month',
    baseModels: [],
    blackListTags: [], // TODO: Doesn't work on images (pictures don't have tags), need to poke around the API, maybe there's some field like excludedTags...
    nsfw: true,
};

Object.entries(tryParseLocalStorageJSON('civitai-lite-viewer--settings')?.settings ?? {}).forEach(([ key, value ]) => SETTINGS[key] = value);

// =================================

navigator.serviceWorker.register(`service_worker.js?v=${Number(CONFIG.version)}`, { scope: './' });

class CivitaiAPI {
    constructor(baseURL = CONFIG.api_url) {
        this.baseURL = baseURL;
    }

    async #getJSON({ url, target }) {
        try {
            const data = await fetchJSON(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (data.error) throw new Error(data.error);
            return data;
        } catch (error) {
            console.error(`Failed to fetch ${target ?? 'something'}:`, error?.message ?? error);
            throw error;
        }
    }

    async fetchModels(options = {}) {
        const {
            limit = 20,
            page = 1,
            query = '',
            tag = '',
            username = '',
            status = '',
            types = [],
            baseModels = [],
            checkpointType = 'All',
            browsingLevel = '', // Is it work?
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
        url.searchParams.append('page', page);

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
        if (nsfw) url.searchParams.append('nsfw', 'true');
        if (primaryFileOnly) url.searchParams.append('primaryFileOnly', 'true');
        if (browsingLevel) url.searchParams.append('browsingLevel', browsingLevel); // Is it work?
        if (status) url.searchParams.append('status', status);

        const data = await this.#getJSON({ url, target: 'models' });
        return data;
    }

    async fetchImages(options = {}) {
        const {
            limit = 20,
            page = 1,
            modelId,
            modelVersionId,
            username = '',
            nsfw = false,
            hidden = false,
            sort = '',
            period = '',
        } = options;

        const url = new URL(`${this.baseURL}/images`);
        url.searchParams.append('limit', limit);
        url.searchParams.append('page', page);

        if (username) url.searchParams.append('username', username);
        if (modelId) url.searchParams.append('modelId', modelId);
        if (modelVersionId) url.searchParams.append('modelVersionId', modelVersionId);
        if (sort) url.searchParams.append('sort', sort);
        if (period) url.searchParams.append('period', period);
        if (hidden) url.searchParams.append('hidden', 'true');
        if (nsfw) url.searchParams.append('nsfw', 'true');

        const data = await this.#getJSON({ url, target: 'images' });
        return data;
    }

    async fetchImageMeta(options = {}) {
        const {
            id,
            nsfw = false,
        } = options;

        const url = new URL(`${this.baseURL}/images`);
        url.searchParams.append('limit', 1);

        if (id) url.searchParams.append('imageId', id);
        if (nsfw) url.searchParams.append('nsfw', 'true');

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

        this.#devicePixelRatio = +window.devicePixelRatio.toFixed(2);
        onTargetInViewport();
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
        if (pageId === '#home') promise = this.gotoHome();
        else if (pageId === '#models') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (params.hash) promise = this.gotoModelByHash(params.hash);
            else if (!params.model) promise = this.gotoModels({ tag: params.tag });
            else promise = this.gotoModel(params.model, params.version);
        }
        else if (pageId === '#articles') promise = this.gotoArticles();
        else if (pageId === '#images') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (!params.image) promise = this.gotoImages();
            else promise = this.gotoImage(params.image);
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
                    setTimeout(updateCacheSize(), 300);
                });
                buttonRemoveAll.addEventListener('click', () => {
                    clearCache('all');
                    setTimeout(updateCacheSize(), 300);
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

    static gotoImage(imageId) {
        const pageNavigation = this.#pageNavigation;
        const appContent = createElement('div', { class: 'app-content-wide full-image-page' });

        return this.api.fetchImageMeta({ id: imageId, nsfw: SETTINGS.nsfw }).then(media => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.log('Loaded image info', media);
            if (!media) throw new Error('No Meta');

            const mediaContainer = createElement('div', { class: 'media-full-preview' });
            const mediaElement = this.#genMediaElement({ media, width: media.width, resize: false, target: 'full-image' });
            mediaElement.style.aspectRatio = (media.width/media.height).toFixed(4);
            mediaElement.style.width = `${media.width}px`;
            mediaContainer.appendChild(mediaElement);
            if (media.type === 'video' && !SETTINGS.autoplay) {
                mediaContainer.classList.add('video-hover-play');
                const videoPlayButton = getIcon('play');
                videoPlayButton.classList.add('video-play-button');
                mediaContainer.appendChild(videoPlayButton);
            }
            appContent.appendChild(mediaContainer);

            const metaContainer = createElement('div', { class: 'media-full-meta' });

            if (media.nsfwLevel !== 'None') insertElement('div', metaContainer, { class: 'image-nsfw-level badge', 'data-nsfw-level': media.nsfwLevel }, `NSFW: ${media.nsfwLevel}`);

            const creatorWrap = insertElement('div', metaContainer, { class: 'user-info' });
            insertElement('div', creatorWrap, undefined, media.username);
        
            const statsList = [
                { iconString: '👍', value: media.stats.likeCount, formatter: formatNumber, unit: 'like' },
                { iconString: '👎', value: media.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
                { iconString: '😭', value: media.stats.cryCount, formatter: formatNumber },
                { iconString: '❤️', value: media.stats.heartCount, formatter: formatNumber },
                { iconString: '🤣', value: media.stats.laughCount, formatter: formatNumber },
                { icon: 'chat', value: media.stats.commentCount, formatter: formatNumber, unit: 'comment' },
            ];
            metaContainer.appendChild(this.#genStats(statsList));

            // Generation info
            if (media.meta) metaContainer.appendChild(this.#genImageGenerationMeta(media.meta));

            insertElement('a', metaContainer, { href: `${CONFIG.civitai_url}/images/${media.id}`, class: 'link-button', style: 'display: flex; width: 20ch;margin: 1em auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

            appContent.appendChild(metaContainer);
        }).catch(error => {
            if (pageNavigation !== this.#pageNavigation) return;
            console.error('Error:', error?.message ?? error);
            appContent.appendChild(this.#genErrorPage(error?.message ?? 'Error'));
        }).finally(() => {
            if (pageNavigation !== this.#pageNavigation) return;
            this.appElement.textContent = '';
            this.appElement.appendChild(appContent);
        });
    }

    static gotoImages() {
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
            const appContentWide = insertElement('div', fragment, { class: 'app-content app-content-wide' });
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
        const { tag = '' } = options;
        let nextPageUrl = null;
        const appContent = createElement('div', { class: 'app-content app-content-wide' });
        const listWrap = insertElement('div', appContent, { id: 'models-list', class: 'cards-list models-list cards-loading', style: `--card-width: ${CONFIG.appearance.card.width}px; --card-height: ${CONFIG.appearance.card.height}px; --gap: ${CONFIG.appearance.card.gap}px;` });

        let allCards = [];
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
            console.log('Loaded models:', models);
            models.forEach(model => {
                if (!model.modelVersions?.length || model.tags.some(tag => SETTINGS.blackListTags.includes(tag)) || listWrap.querySelector(`.card[data-id="${model.id}"]`)) return;
                const card = this.#genModelCard(model);
                card.setAttribute('tabindex', -1);
                allCards.push(card);
                listWrap.appendChild(card);
            });
            if (nextPageUrl) {
                const loadMoreTrigger = insertElement('div', listWrap, { id: 'load-more' });
                loadMoreTrigger.appendChild(getIcon('infinity'));
                onTargetInViewport(loadMoreTrigger, () => {
                    loadMore().then(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', listWrap, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
            }
        };

        const loadMore = () => {
            const pageNavigation = this.#pageNavigation;
            if (!nextPageUrl) return;
            return fetchJSON(nextPageUrl, { method: 'GET', headers: { 'Accept': 'application/json' } }).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                nextPageUrl = data.metadata?.nextPage ?? null;
                insertModels(data.items);
            }).catch(error => {
                if (pageNavigation !== this.#pageNavigation) return;
                console.error('Failed to fetch models:', error?.message ?? error);
            });
        };

        const loadModels = () => {
            const pageNavigation = this.#pageNavigation;

            return this.api.fetchModels({
                limit: 100,
                page: 1,
                tag,
                types: SETTINGS.types,
                sort: SETTINGS.sort,
                period: SETTINGS.period,
                checkpointType: SETTINGS.checkpointType,
                primaryFileOnly: true,
                baseModels: SETTINGS.baseModels,
                nsfw: SETTINGS.nsfw,
            }).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                nextPageUrl = data.metadata?.nextPage ?? null;
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

    static #genModelPage(model, version = null) {
        const modelVersion = version ? model.modelVersions.find(v => v.name === version) ?? model.modelVersions[0] : model.modelVersions[0];
        const page = createElement('div', { class: 'model-page', 'data-model-id': model.id });

        // Model name
        const modelNameWrap = insertElement('div', page, { class: 'model-name' });
        const modelNameH1 = insertElement('h1', modelNameWrap, undefined, model.name);
        const statsList = [
            { icon: 'like', value: model.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'download', value: model.stats.downloadCount, formatter: formatNumber, unit: 'download' },
            { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' },
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
        model.tags.forEach(tag => insertElement('a', modelTagsWrap, { href: `#models?tag=${tag}`, class: (SETTINGS.blackListTags.includes(tag) ? 'badge error-text' : 'badge') }, tag));

        const modelVersionsWrap = insertElement('div', page, { class: 'badges model-versions' });
        model.modelVersions.forEach(version => {
            const href = `#models?model=${model.id}&version=${version.name}`;
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
        const previewList = modelVersion.images.map((media, index) => {
            const ratio = +(media.width/media.height).toFixed(3);
            const item = createElement('div', { style: `aspect-ratio: ${ratio};` });
            // const id = media.id ?? (media?.url?.match(/(\d+).\S{2,5}$/) || [])[1]; // This id is not real and there will always be an error
            // const item = createElement('a', { href: id ? `#images?image=${encodeURIComponent(id)}` : ', style: `aspect-ratio: ${ratio};`, tabindex: -1 });
            const itemWidth = ratio > 1.5 ? CONFIG.appearance.modelPage.carouselItemWidth * 2 : CONFIG.appearance.modelPage.carouselItemWidth;
            const mediaElement = this.#genMediaElement({ media, width: itemWidth, height: undefined, resize: false, lazy: index > 3, taget: 'model-preview' });
            item.appendChild(mediaElement);
            if (media.type === 'video' && !SETTINGS.autoplay) {
                const videoPlayButton = getIcon('play');
                videoPlayButton.classList.add('video-play-button');
                item.classList.add('video-hover-play');
                item.appendChild(videoPlayButton);
            }
            return { element: item, isWide: ratio > 1.5 };
        });
        modelPreviewWrap.appendChild(this.#genCarousel(previewList, { carouselItemWidth: CONFIG.appearance.modelPage.carouselItemWidth }));

        // Model creator
        if (model.creator) {
            const creatorWrap = insertElement('div', page, { class: 'user-info' });
            const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
            if (model.creator.image) insertElement('img', creatorWrap, { crossorigin: 'anonymous', alt: 'creator-picture', src: `${model.creator.image.replace(/\/width=\d+\//, `/width=${creatorImageSize}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop&format=webp&target=user-image` });
            else insertElement('div', creatorWrap, { class: 'no-media' }, model.creator.username.substring(0, 2));
            insertElement('div', creatorWrap, undefined, model.creator.username);
        }

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
        if (modelVersion.description) modelVersionDescription.appendChild(safeParseHTML(modelVersion.description));

        // Model descrition
        const modelDescription = insertElement('div', page, { class: 'model-description' });
        model.description = this.#analyzeModelDescriptionString(model.description);
        modelDescription.appendChild(safeParseHTML(model.description));

        // Analyze descriptions and find patterns to improve display
        this.#analyzeModelDescription(modelDescription);

        // Open in CivitAI
        insertElement('a', page, { href: `${CONFIG.civitai_url}/models/${model.id}?modelVersionId=${modelVersion.id}`, class: 'link-button', style: 'display: flex; width: 20ch;margin: 2em auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        // Comments
        // ...

        return page;
    }

    // TODO: change number of columns when browser resizes
    static #genImages({ modelId, modelVersionId }) {
        let nextPageUrl = null;
        const fragment = new DocumentFragment();
        const imagesTitle = insertElement('h1', fragment, { style: 'justify-content: center;;' });
        imagesTitle.appendChild(getIcon('image'));
        insertElement('span', imagesTitle, undefined, window.languagePack?.text?.images ?? 'Images');

        const listWrap = createElement('div', { id: 'images-list', class: 'cards-list images-list cards-loading', style: `--card-width: ${CONFIG.appearance.card.width}px; --gap: ${CONFIG.appearance.card.gap}px;` });

        let allImages = [];
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
            if (!nextPageUrl) return;
            const pageNavigation = this.#pageNavigation;
            return fetchJSON(nextPageUrl, { method: 'GET', headers: { 'Accept': 'application/json' } }).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                nextPageUrl = data.metadata?.nextPage ?? null;
                insertImages(data.items);
            }).catch(error => {
                console.error('Failed to fetch images:', error?.message ?? error);
            });
        };

        const updateColumns = () => {
            columns = [];
            let columnsCount = Math.floor(window.innerWidth / (CONFIG.appearance.card.width + CONFIG.appearance.card.gap));
            for(let i = 0; i < columnsCount; i++) {
                columns.push({
                    height: 0,
                    element: createElement('div', { class: 'images-column' }),
                    positions: []
                });
            }

            if (allImages.length) {
                insertImages(allImages);
                allImages[0].element.setAttribute('tabindex', 0);
                fakeIndex = 0;
                fakeTableIndex = 0;
            }
        };

        const insertImages = images => {
            console.log('Loaded images:', images);
            images.forEach(image => {
                if (listWrap.querySelector(`.card[data-id="${image.id}"]`)) return;

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

            if (nextPageUrl) {
                const loadMoreTrigger = insertElement('div', targetColumn.element, { id: 'load-more' });
                loadMoreTrigger.appendChild(getIcon('infinity'));
                onTargetInViewport(loadMoreTrigger, () => {
                    loadMore().then(() => loadMoreTrigger.remove());
                });
            } else {
                const loadNoMore = insertElement('div', targetColumn.element, { id: 'load-no-more' });
                loadNoMore.appendChild(getIcon('ufo'));
                insertElement('span', loadNoMore, undefined, window.languagePack?.text?.end ?? 'End');
            }
        };

        const loadImages = () => {
            const pageNavigation = this.#pageNavigation;
            allImages = [];
            updateColumns();

            return this.api.fetchImages({
                limit: 100,
                page: 1,
                sort: SETTINGS.sort_images,
                period: SETTINGS.period_images,
                nsfw: SETTINGS.nsfw,
                modelId,
                modelVersionId
            }).then(data => {
                if (pageNavigation !== this.#pageNavigation) return;
                nextPageUrl = data.metadata?.nextPage ?? null;
                listWrap.textContent = '';
                columns.forEach(col => listWrap.appendChild(col.element));
                insertImages(data.items);
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

    // TODO: Add BibTeX support https://ru.wikipedia.org/wiki/BibTeX
    // BibTeX: It is in the description of this model (modelId: 958009)
    static #analyzeModelDescriptionString(description) {
        // There should be rules here to improve formatting...
        // But... all creators have their own description format, and they don't really fit together,
        // I can't write for everyone, maybe I'll run the first hundred creators (their description format) through llm later
        const rules = [
            //
            { regex: '<br /></p>', replacement: '</p>'  },
            // Handle potential prompt blocks with poorly formatted text
            { regex: /<p>\s*(positive\s+)?prompts?:\s*([^<]+)<\/p>/gi, replacement: (_, __, promptText) => `<p>Positive Prompt</p><pre><code>${promptText.trim()}</code></pre>` },
            { regex: /<p>\s*negative\s+prompts?:\s*([^<]+)<\/p>/gi, replacement: (_, promptText) => `<p>Negative Prompt</p><pre><code>${promptText.trim()}</code></pre>` },
            // Sometimes descriptions contain homemade separators... along with the usual <hr>...
            { regex: /<p>\s*([\-=_*+])\1{4,}\s*<\/p>/gi, replacement: '<hr>' },
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
            let count = 0;
            let pos = text.indexOf(',');
            while (pos !== -1 || count < 3) {
                count++;
                pos = text.indexOf(',', pos + 1);
            }

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
        if (meta.Size) insertElement('code', otherMetaContainer, undefined, `Size: ${meta.Size}`);
        if (meta.cfgScale) {
            const cfg = +(meta.cfgScale).toFixed(4);
            const code = insertElement('code', otherMetaContainer, undefined, `CFG: ${cfg}`);
            if (cfg !== meta.cfgScale) code.setAttribute('lilpipe-text', meta.cfgScale);
        }
        if (meta.sampler) insertElement('code', otherMetaContainer, undefined, `Sampler: ${meta.sampler}`);
        if (meta['Schedule type'] || meta.scheduler ) insertElement('code', otherMetaContainer, undefined, `Sheduler: ${meta['Schedule type'] || meta.scheduler}`);
        if (meta.steps) insertElement('code', otherMetaContainer, undefined, `Steps: ${meta.steps}`);
        if (meta.clipSkip) insertElement('code', otherMetaContainer, undefined, `clipSkip: ${meta.clipSkip}`);
        if (meta.seed) insertElement('code', otherMetaContainer, undefined, `Seed: ${meta.seed}`);
        if (meta['Denoising strength'] || meta.denoise) insertElement('code', otherMetaContainer, undefined, `Denoising: ${meta['Denoising strength'] || meta.denoise}`);
        if (meta.workflow) insertElement('code', otherMetaContainer, undefined, meta.workflow);
        if (meta.comfy) {
            const comfyJSON = meta.comfy;
            const code = insertElement('code', otherMetaContainer, { class: 'copy' }, 'ComfyUI');
            code.appendChild(getIcon('copy'));
            code.addEventListener('click', () => {
                toClipBoard(comfyJSON);
                console.log('Copied to clipboard, TODO: notifications'); // TODO: notifications
                console.log('ComfyUI: ', JSON.parse(comfyJSON));
            }, { passive: true });
        }
        if (meta['Hires upscaler']) {
            const code = insertElement('code', otherMetaContainer, undefined, `Hires: ${meta['Hires upscaler']}`);
            if (meta['Hires upscale']) insertElement('i', code, undefined, ` x${meta['Hires upscale']}`);
        }
        if (meta['ADetailer model']) {
            const tooltip = Object.keys(meta).filter(key => key.indexOf('ADetailer') === 0).map(key => `<tr><td>${key.replace('ADetailer', '').trim()}</td><td>${typeof meta[key] === 'string' ? meta[key] : JSON.stringify(meta[key])}</td></tr>`).join('');
            const code = insertElement('code', otherMetaContainer, undefined, `ADetailer: ${meta['ADetailer model']}`);
            if (tooltip) {
                code.setAttribute('lilpipe-text', `<table class='tooltip-table-only' style='text-transform:capitalize;'>${tooltip}</table>`);
                code.setAttribute('lilpipe-type', 'meta-adetailer');
            }
        }

        // Resources
        if (meta.civitaiResources?.length || meta.resources?.length || (meta.hashes && Object.keys(meta.hashes)?.length)) {
            const resourcesContainer = insertElement('div', container, { class: 'meta-resources meta-resources-loading' });
            const resourcesTitle = insertElement('h3', resourcesContainer);
            resourcesTitle.appendChild(getIcon('database'));
            insertElement('span', resourcesTitle, undefined, window.languagePack?.text?.resurces_used ?? 'Resources used')

            const resources = [ ...(meta.civitaiResources || []), ...(meta.resources || []), ...(meta.additionalResources || [])];
            const processedResources = new Set();
            const resourcePromises = [];

            // Not sure if this is necessary...
            if (meta.hashes && Object.keys(meta.hashes)?.length) {
                Object.keys(meta.hashes).forEach(key => {
                    const hash = meta.hashes[key];
                    if (resources.some(item => item.hash === hash)) return;

                    resources.push({ hash, name: key });
                });
            }

            resources.forEach(item => {
                if (item.modelVersionId) {
                    if (processedResources.has(item.modelVersionId)) return;
                    else processedResources.add(item.modelVersionId)
                }

                const el = insertElement('div', resourcesContainer, { class: 'meta-resource', 'data-resource-hash': item.hash ?? '' });
                // TODO: Understand where to get the names and id for the link...
                const nameEl = insertElement('span', el, { class: 'meta-resource-name' }, item.name || `${item.modelVersionId} ${item.modelVersionName}` );
                insertElement('span', el, { class: 'meta-resource-type' }, item.type ?? '???');
                if (item.weight && item.weight !== 1) insertElement('span', nameEl, { class: 'meta-resource-weight' }, `:${item.weight}`);

                let fetchPromise = null;

                if (item.modelVersionId) fetchPromise = this.api.fetchModelVersionInfo(item.modelVersionId);
                else if (item.hash) fetchPromise = this.api.fetchModelVersionInfo(item.hash, true);

                if (!fetchPromise) return;

                el.classList.add('meta-resource-loading');
                const promise = fetchPromise.then(info => {
                    if (!info) return info;

                    el.textContent = '';
                    const nameEl = insertElement('a', el, { href: `#models?model=${info.modelId}&version=${info.name}`, class: 'meta-resource-name' }, `${info?.model?.name} ` );
                    insertElement('span', el, { class: 'meta-resource-type', 'lilpipe-text': info.baseModel }, info?.model?.type);
                    insertElement('strong', nameEl, undefined, info.name)
                    if (item.weight && item.weight !== 1) insertElement('span', nameEl, { class: 'meta-resource-weight' }, `:${item.weight}`);
                    return info;
                }).finally(() => {
                    el.classList.remove('meta-resource-loading');
                });
                resourcePromises.push(promise);
            });

            if (resourcePromises.length) {
                Promise.all(resourcePromises).then(result => {
                    result = result.filter(item => item);
                    const trainedWords = [];
                    const triggerTooltips = {};
                    console.log('Loaded resources', result);

                    result.forEach(item => {
                        const type = item?.model?.type;
                        if (!type || (type !== 'LORA' && type !== 'TextualInversion') || !item?.trainedWords?.length) return;

                        item.trainedWords.forEach(word => {
                            word = word.indexOf(',') === -1 ? word : word.replace(/,(?!\s)/g, ', ').trim(); // This is necessary because the prompt block is formatted in a similar way
                            trainedWords.push(word);
                            if (item.model.name) {
                                if (triggerTooltips[word]) triggerTooltips[word] += `, ${item.model.name}`;
                                else triggerTooltips[word] = item.model.name;
                            }
                        });
                    });

                    if (trainedWords.length > 0) {
                        const codeBlocks = container.querySelectorAll('code.prompt-positive, code.prompt-negative');

                        codeBlocks.forEach(code => {
                            const children = Array.from(code.childNodes);

                            children.forEach(node => {
                                if (node.nodeType !== Node.TEXT_NODE) return;

                                const text = node.textContent;
                                const indexes = trainedWords.map(key => [ key, text.indexOf(key) ]).filter(a => a[1] !== -1).sort((a, b) => a[1] - b[1]);

                                if (indexes.length <= 0) return;

                                const fragment = new DocumentFragment();
                                const startText = text.substring(0, indexes[0][1]);
                                if (startText) fragment.appendChild(document.createTextNode(startText));
                                indexes.forEach(([key, index], i) => {
                                    const postText = text.substring(index + key.length, indexes[i + 1]?.[1] ?? undefined );
                                    const span = insertElement('span', fragment, { class: 'trigger' }, key);
                                    if (triggerTooltips[key]) span.setAttribute('lilpipe-text', triggerTooltips[key]);
                                    if (postText) fragment.appendChild(document.createTextNode(postText));
                                });

                                code.replaceChild(fragment, node);
                                return fragment;
                            });
                        });
                    }
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
        const previewMedia = modelVersion.images[0];
        const card = createElement('a', { class: 'card model-card', 'data-id': model.id, 'data-media': previewMedia?.type ?? 'none', href: `#models?model=${model.id}` });
        if (previewMedia?.type === 'video' && !SETTINGS.autoplay) card.classList.add('video-hover-play');
        const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        if (previewMedia) {
            const mediaElement = this.#genMediaElement({ media: previewMedia, width: CONFIG.appearance.card.width, height: CONFIG.appearance.card.height, resize: SETTINGS.resize, target: 'model-card' });
            cardBackgroundWrap.appendChild(mediaElement);
            if (previewMedia.type === 'video' && !SETTINGS.autoplay) {
                const videoPlayButton = getIcon('play');
                videoPlayButton.classList.add('video-play-button');
                cardBackgroundWrap.appendChild(videoPlayButton);
            }
        } else {
            const noMedia = insertElement('div', cardBackgroundWrap, { class: 'no-media' }, window.languagePack?.errors?.no_media ?? 'No Media');
            noMedia.appendChild(getIcon('image'));
        }
        const modelTypeWrap = insertElement('div', cardContentWrap, { class: 'model-type' });
        if (this.#types[model.type]) insertElement('span', modelTypeWrap, undefined, this.#types[model.type]);
        else insertElement('span', modelTypeWrap, undefined, model.type);
        if (modelVersion.baseModel) insertElement('span', modelTypeWrap, { class: 'model-baseType' }, this.#baseModels[modelVersion.baseModel] ?? modelVersion.baseModel);
        
        const availabilityBadge = modelVersion.availability !== 'Public' ? modelVersion.availability : (new Date() - new Date(modelVersion.publishedAt) < 3 * 24 * 60 * 60 * 1000) ? model.modelVersions.length > 1 ? 'Updated' : 'New' : null;
        if (availabilityBadge) insertElement('span', modelTypeWrap, { class: 'model-availability', 'data-availability': availabilityBadge }, window.languagePack?.text?.[availabilityBadge] ?? availabilityBadge);

        const creatorWrap = insertElement('div', cardContentWrap, { class: 'user-info' });
        const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
        if (model.creator.image) insertElement('img', creatorWrap, { crossorigin: 'anonymous', alt: 'creator-picture', src: `${model.creator.image.replace(/\/width=\d+\//, `/width=${creatorImageSize}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop&format=webp&target=user-image` });
        else insertElement('div', creatorWrap, { class: 'no-media' }, model.creator.username.substring(0, 2));
        insertElement('div', creatorWrap, undefined, model.creator.username);
    
        insertElement('div', cardContentWrap, { class: 'model-name' }, model.name);
        
        const statsList = [
            { icon: 'download', value: model.stats.downloadCount, formatter: formatNumber, unit: 'download' },
            { icon: 'bookmark', value: model.stats.favoriteCount, formatter: formatNumber, unit: 'bookmark' },
            { icon: 'chat', value: model.stats.commentCount, formatter: formatNumber, unit: 'comment' },
            { icon: 'like', value: model.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
        ];
        cardContentWrap.appendChild(this.#genStats(statsList));
    
        return card;
    }

    static #genImageCard(image) {
        const card = createElement('a', { class: 'card image-card', 'data-id': image.id, 'data-media': image?.type ?? 'none', href: `#images?image=${encodeURIComponent(image.id)}`, style: `--aspect-ratio: ${(image.width/image.height).toFixed(4)};` });

        // Image
        if (image?.type === 'video' && !SETTINGS.autoplay) card.classList.add('video-hover-play');
        const cardBackgroundWrap = insertElement('div', card, { class: 'card-background' });
        const cardContentWrap = insertElement('div', card, { class: 'card-content' });
        const mediaElement = this.#genMediaElement({ media: image, width: CONFIG.appearance.card.width, resize: SETTINGS.resize, target: 'image-card', lazy: true });
        cardBackgroundWrap.appendChild(mediaElement);
        if (image.type === 'video' && !SETTINGS.autoplay) {
            const videoPlayButton = getIcon('play');
            videoPlayButton.classList.add('video-play-button');
            cardBackgroundWrap.appendChild(videoPlayButton);
            cardBackgroundWrap.classList.add('video-hover-play');
        }

        // NSFW Level
        if (image.nsfwLevel !== 'None') insertElement('div', cardContentWrap, { class: 'image-nsfw-level badge', 'data-nsfw-level': image.nsfwLevel }, image.nsfwLevel);
        
        // Created At
        if (image.createdAt) {
            const createdAt = new Date(image.createdAt);
            insertElement('span', cardContentWrap, { class: 'image-created-time', 'lilpipe-text': createdAt.toLocaleString() }, timeAgo(Math.round((Date.now() - createdAt)/1000)));
        }

        // Creator
        const creatorWrap = insertElement('div', cardContentWrap, { class: 'user-info' });
        insertElement('div', creatorWrap, undefined, image.username);
    
        // Stats
        const statsList = [
            { iconString: '👍', value: image.stats.likeCount, formatter: formatNumber, unit: 'like' },
            { iconString: '👎', value: image.stats.dislikeCount, formatter: formatNumber, unit: 'dislike' },
            { iconString: '😭', value: image.stats.cryCount, formatter: formatNumber },
            { iconString: '❤️', value: image.stats.heartCount, formatter: formatNumber },
            { iconString: '🤣', value: image.stats.laughCount, formatter: formatNumber },
            { icon: 'chat', value: image.stats.commentCount, formatter: formatNumber, unit: 'comment' },
        ];
        cardContentWrap.appendChild(this.#genStats(statsList));

        return card;
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
                carouselItems.style.transform = `translateX(-${item.isWide ? item.scrollLeft - carouselGap / 2: item.scrollLeft}px)`;
                if (listElements.length > 3) {
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
        }

        return carousel;
    }

    static #genMediaElement({ media, width, height = undefined, resize = true, lazy = false, target = null }) {
        let mediaElement;
        const targetWidth = Math.round(width * this.#devicePixelRatio);
        const targetHeight = height ? Math.round(height * this.#devicePixelRatio) : null;
        const blurSize = CONFIG.appearance.blurHashSize;
        const ratio = media.width / media.height;
        const newRequestSize = ratio < 1 || !targetHeight ? `width=${targetWidth}` : `height=${targetHeight}`;
        const params = resize ? `?width=${targetWidth}${targetHeight ? `&height=${targetHeight}` : ''}&fit=crop` : '';
        const url = `${media.url.replace(/\/width=\d+\//, `/${newRequestSize},anim=false,optimized=true/`)}${target ? (params ? `${params}&target=${target}` : `?target=${target}`) : params}`;
        const previewUrl = media.hash ? `${CONFIG.local_urls.blurHash}?hash=${encodeURIComponent(media.hash)}&width=${ratio < 1 ? blurSize : Math.round(blurSize/ratio)}&height=${ratio < 1 ? Math.round(blurSize/ratio) : blurSize}` : '';
        if (media.type === 'image') {
            const src = SETTINGS.autoplay ? url.replace(/anim=false,?/, '') : (resize ? `${url}&format=webp` : url);
            mediaElement = createElement('img', { class: 'loading',  alt: 'image', crossorigin: 'anonymous', src: lazy ? '' : src });
            if (lazy) {
                onTargetInViewport(mediaElement, () => {
                    mediaElement.src = src;
                });
            }
        } else {
            const src = url.replace('optimized=true', 'optimized=true,transcode=true');
            const poster = resize ? `${src}&format=webp` : src;
            const videoSrc = src.replace(/anim=false,?/, '');
            mediaElement = createElement('video', { class: 'loading',  muted: '', loop: '', playsInline: '', crossorigin: 'anonymous', preload: 'none' });
            mediaElement.volume = 0;
            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.playsInline = true;
            if (SETTINGS.autoplay) mediaElement.autoplay = true;
            if (lazy) {
                onTargetInViewport(mediaElement, () => {
                    mediaElement.poster = poster;
                    mediaElement.src = videoSrc;
                });
            } else {
                mediaElement.poster = poster;
                mediaElement.src = videoSrc;
            }
        }
        if (previewUrl) mediaElement.style.backgroundImage = `url(${previewUrl})`;
        return mediaElement;
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

        // NSFW toggle
        const filterNSFW = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'nsfw' });
        const nsfwToggle = this.#genBoolean({ onchange: ({ newValue }) => {
            SETTINGS.nsfw = newValue;
            onAnyChange?.();
        }, value: SETTINGS.nsfw, label: 'NSFW' });
        filterNSFW.appendChild(nsfwToggle.element);

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
}

// ==============================

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

function onTargetInViewport(target, callback) {
    if (!target || typeof callback !== 'function') return;

    const observer = new IntersectionObserver(([entry], obs) => {
        if (entry.isIntersecting) {
            obs.disconnect();
            callback();
        }
    }, { threshold: 0.05 });

    // This requestAnimationFrame is needed to make sure that the element is in the DOM
    requestAnimationFrame(() => observer.observe(target));
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
    e.target.classList.remove('loading');
    e.target.style.backgroundImage = '';
}, { passive: true, capture: true });

document.addEventListener('load', e => {
    e.target.classList.remove('loading');
    e.target.style.backgroundImage = '';
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
    video.play().catch(() => null);
    const pause = video => {
        video.removeAttribute('data-focus-play');
        video.pause();
    };
    document.querySelectorAll('video[data-focus-play]').forEach(pause);
    video.setAttribute('data-focus-play', '');
    target.addEventListener(options.fromFocus ? 'blur' : 'mouseleave', () => pause(video), { once: true, passive: true });
}

let prevLilpipeEvenetTime = 0, prevLilpipeTimer = null;
function startLilpipeEvent(e, options = { fromFocus: false }) {
    const target = e.eventTarget;

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
    const newX = targetX < 0 ? 0 : targetX + tW > wW ? wW - tW : targetX;
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
            setTimeout(() => tooltip.removeAttribute('data-animation'), 100);
        }, delay);
    } else {
        tooltip.setAttribute('data-animation', 'in');
        setTimeout(() => tooltip.removeAttribute('data-animation'), 100);
    }

    if (options.fromFocus) target.addEventListener('blur', onmouseleave, { once: true, capture: true });
    else target.addEventListener('mouseleave', onmouseleave, { once: true });
}
