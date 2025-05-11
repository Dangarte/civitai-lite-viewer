/// <reference path="./_docs.d.ts" />

const CONFIG = {
    version: 1,
    title: 'CivitAI Lite Viewer',
    civitai_url: 'https://civitai.com',
    api_url: 'https://civitai.com/api/v1',
    local_urls: {
        local: 'local',
        blurHash: 'local/blurhash'
    },
    langauges: [ 'en', 'ru', 'zh', 'uk' ],
    appearance: {
        card: {
            width: 300,
            height: 450
        },
        modelPage: {
            carouselItemWidth: 450
        },
        blurHashSize: 32, // minimum size of blur preview
    }
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
    period: 'Month',
    baseModels: [],
    blackListTags: [ 'gay' ],
    nsfw: true,
};

Object.entries(tryParseLocalStorageJSON('civitai-lite-viewer--settings')?.settings ?? {}).forEach(([ key, value ]) => SETTINGS[key] = value);

// =================================

navigator.serviceWorker.register('service_worker.js', { scope: './' });

class CivitaiAPI {
    constructor(baseURL = CONFIG.api_url) {
        this.baseURL = baseURL;
    }

    async fetchModels(options = {}) {
        const {
            limit = 20,
            page = 1,
            query = '',
            tag = '',
            username = '',
            types = [],
            baseModels = [],
            checkpointType = 'All',
            sort = '',
            period = '',
            rating = '',
            favorites = false,
            hidden = false,
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

        try {
            const data = await fetchJSON(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            return data;
        } catch (error) {
            console.error('Failed to fetch models:', error);
            throw error;
        }
    }

    async fetchModelInfo(id) {
        try {
            const data = await fetchJSON(`${this.baseURL}/models/${id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            return data;
        } catch (error) {
            console.error('Failed to fetch model info:', error);
            throw error;
        }
    }
}

class Controller {
    static api = new CivitaiAPI(CONFIG.api_url);
    static appElement = document.getElementById('app');
    static #devicePixelRatio = +window.devicePixelRatio.toFixed(2);
    static #emptyImage = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>";

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

        this.#devicePixelRatio = +window.devicePixelRatio.toFixed(2);
        onTargetInViewport();
        this.appElement.classList.add('page-loading');
        this.appElement.setAttribute('data-page', pageId);
        if (paramString) this.appElement.setAttribute('data-params', paramString);
        else this.appElement.removeAttribute('data-params');
        document.querySelector('#main-menu .menu a.active')?.classList.remove('active');
        if (pageId) document.querySelector(`#main-menu .menu a[href="${pageId}"]`)?.classList.add('active');
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' }); // Not sure about this...

        let promise;
        if (pageId === '#home') promise = this.gotoHome();
        else if (pageId === '#models') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (!params.model) promise = this.gotoModels();
            else promise = this.gotoModel(params.model, params.version);
        }
        else if (pageId === '#articles') promise = this.gotoArticles();
        else if (pageId === '#images') {
            const params = Object.fromEntries(new URLSearchParams(paramString));
            if (!params.image) promise = this.gotoImages();
            else promise = this.gotoImage(params.image);
        }

        if (promise) promise.finally(() => {
            this.appElement.classList.remove('page-loading');
        });
        else {
            this.appElement.classList.remove('page-loading');
        }
    }

    static gotoHome() {
        document.title = `${CONFIG.title} - ${window.languagePack?.text?.home ?? 'Home'}`;
        const fragment = new DocumentFragment();
        const tempHome =  window.languagePack?.temp?.home ?? {};
        insertElement('h1', fragment, undefined, window.languagePack?.text?.home);
        insertElement('p', fragment, undefined, tempHome.p1?.[1]);
        insertElement('p', fragment, undefined, tempHome.p1?.[2]);
        insertElement('p', fragment, undefined, tempHome.p1?.[3]);
        insertElement('p', fragment, undefined, tempHome.p1?.[4]);
        insertElement('p', fragment, undefined, tempHome.p1?.[5]);

        insertElement('br', fragment);
        insertElement('hr', fragment);
        insertElement('br', fragment);

        insertElement('h2', fragment, undefined, tempHome.settingsDescription ?? 'Performance settings');

        // Toggles
        insertElement('p', fragment, undefined, tempHome.autoplayDescription);
        const autoplayToggle = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.autoplay = newValue;
                localStorage.setItem('civitai-lite-viewer--time:nextCacheClearTime', new Date(Date.now() + 3 * 60 * 1000).toISOString());
                savePageSettings();
            },
            value: SETTINGS.autoplay,
            label: tempHome.autoplay ?? 'autoplay'
        });
        fragment.appendChild(autoplayToggle.element);
        insertElement('p', fragment, undefined, tempHome.resizeDescription);
        insertElement('blockquote', fragment, undefined, tempHome.resizeNote);
        const resizeToggle = this.#genBoolean({
            onchange: ({ newValue }) => {
                SETTINGS.resize = newValue;
                localStorage.setItem('civitai-lite-viewer--time:nextCacheClearTime', new Date(Date.now() + 3 * 60 * 1000).toISOString());
                savePageSettings();
            },
            value: SETTINGS.resize,
            label: tempHome.resize ?? 'resize'
        });
        fragment.appendChild(resizeToggle.element);

        // Cache usage
        const cachesWrap = insertElement('div', fragment);
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
        this.appElement.appendChild(fragment);
    }

    static gotoArticles() {
        const fragment = new DocumentFragment();
        document.title = `${CONFIG.title} - ${window.languagePack?.text?.articles ?? 'Articles'}`;
        const p = insertElement('p', fragment, { class: 'error-text' });
        p.appendChild(getIcon('cross'));
        insertElement('span', p, undefined, window.languagePack?.temp?.articles ?? 'CivitAI public API does not provide a list of articles 😢');
        this.appElement.textContent = '';
        this.appElement.appendChild(fragment);
    }

    static gotoImage(url) {
        const fragment = new DocumentFragment();
        if (url.endsWith('.mp4')) {
            const posterUrl = url.replace(/\/(width=\d+)\//, '/$1,anim=false,transcode=true,optimized=true/');
            insertElement('video', fragment, { controls: '', class: 'loading',  muted: '', loop: '', playsInline: '', crossorigin: 'anonymous', preload: 'none', autoplay: '', poster: `${posterUrl}?target=full-image`, src: `${url}?target=full-image` });
        } else {
            insertElement('img', fragment, { crossorigin: 'anonymous', alt: 'image', src: `${url}?target=full-image` });
        }
        insertElement('p', fragment, { class: 'error-text', style: 'text-align: center;' }, 'There should be a normal full-screen image here, with information about generation and other things, but the Civitai REST API does not provide such data 😭');
        const id = url.split('/')?.at(-1)?.split('.')?.[0];
        insertElement('a', fragment, { href: `${CONFIG.civitai_url}/images/${id}`, class: 'link-button', style: 'display: flex; width: 20ch;margin: 0 auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');
        this.appElement.textContent = '';
        this.appElement.appendChild(fragment);
    }

    static gotoImages() {
        const fragment = new DocumentFragment();
        document.title = `${CONFIG.title} - ${window.languagePack?.text?.images ?? 'Images'}`;
        insertElement('p', fragment, undefined, "Work In Progress");
        insertElement('a', fragment, { href: 'https://developer.civitai.com/docs/api/public-rest#get-apiv1images' }, 'GET /api/v1/images');
        this.appElement.textContent = '';
        this.appElement.appendChild(fragment);
    }

    static gotoModel(id, version = null) {
        const fragment = new DocumentFragment();

        return this.api.fetchModelInfo(id)
        .then(data => {
            console.log('Loaded model:', data);
            const modelVersion = version ? data.modelVersions.find(v => v.name === version) ?? data.modelVersions[0] : data.modelVersions[0];
            document.title = `${data.name} - ${modelVersion.name} | ${modelVersion.baseModel} | ${data.type} | ${CONFIG.title}`;
            fragment.appendChild(this.#genModelPage(data, version));
        }).catch(error => {
            console.error('Error:', error);
            insertElement('h1', fragment, { class: 'error-text' }, 'Error');
        }).finally(() => {
            this.appElement.textContent = '';
            this.appElement.appendChild(fragment);
        });
    }

    static gotoModels() {
        let nextPageUrl = null;
        const listWrap = createElement('div', { id: 'models-list', class: 'cards-list models-list', style: `--card-width: ${CONFIG.appearance.card.width}px; --card-height: ${CONFIG.appearance.card.height}px; ` });
        const insertModels = models => {
            console.log('Loaded models:', models);
            models.forEach(model => !model.modelVersions?.length || model.tags.some(tag => SETTINGS.blackListTags.includes(tag)) || listWrap.querySelector(`.card[href$="${model.id}"]`) ? null : listWrap.appendChild(this.#genModelCard(model)));
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
            if (!nextPageUrl) return;
            return fetchJSON(nextPageUrl, { method: 'GET', headers: { 'Accept': 'application/json' } }).then(data => {
                nextPageUrl = data.metadata?.nextPage ?? null;
                insertModels(data.items);
            }).catch(error => {
                console.error('Failed to fetch models:', error);    
            });
        };
        return this.api.fetchModels({
            limit: 100,
            page: 1,
            types: SETTINGS.types,
            sort: SETTINGS.sort,
            period: SETTINGS.period,
            checkpointType: SETTINGS.checkpointType,
            baseModels: SETTINGS.baseModels,
            nsfw: SETTINGS.nsfw,
        }).then(data => {
            console.log(data);
            nextPageUrl = data.metadata?.nextPage ?? null;
            insertModels(data.items);
            document.title = `${CONFIG.title} - ${window.languagePack?.text?.models ?? 'Models'}`;
        }).catch(error => {
            console.error('Error:', error);
            listWrap.textContent = 'Error!';
        }).finally(() => {
            this.appElement.textContent = '';
            this.appElement.appendChild(this.#genListFIlters(() => {
                savePageSettings();
                listWrap.classList.add('cards-loading');
                Controller.gotoModels();
            }));
            this.appElement.appendChild(listWrap);
        });
    }

    static #genModelPage(model, version = null) {
        const modelVersion = version ? model.modelVersions.find(v => v.name === version) ?? model.modelVersions[0] : model.modelVersions[0];
        const page = createElement('div', { class: 'model-page', 'data-model-id': model.id });


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

        const downloadButtons = insertElement('div', modelNameWrap, { class: 'model-download-files' });
        modelVersion.files.forEach(file => {
            const download = window.languagePack?.text?.download ?? 'Download';
            const fileSize = filesizeToString(file.sizeKB / 0.0009765625);
            const a = insertElement('a', downloadButtons, { class: 'link-button', target: '_blank', href: file.downloadUrl });
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


        const modelSubNameWrap = insertElement('p', page, { class: 'model-sub-name' });
        const publishedAt = new Date(modelVersion.publishedAt);
        insertElement('span', modelSubNameWrap, { class: 'model-updated-time', 'lilpipe-text': `${window.languagePack?.text?.Updated ?? 'Updated'}: ${publishedAt.toLocaleString()}` }, timeAgo(Math.round((Date.now() - publishedAt)/1000)));
        const modelTagsWrap = insertElement('div', modelSubNameWrap, { class: 'badges model-tags' });
        model.tags.forEach(tag => insertElement('div', modelTagsWrap, { class: (SETTINGS.blackListTags.includes(tag) ? 'badge error-text' : 'badge') }, tag));

        const modelVersionsWrap = insertElement('div', page, { class: 'badges model-versions' });
        model.modelVersions.forEach(version => {
            const href = `#models?model=${model.id}&version=${version.name}`;
            const isActive = version.name === modelVersion.name;
            insertElement('a', modelVersionsWrap, { class: isActive ? 'badge active' : 'badge', href }, version.name);
        });


        const modelPreviewWrap = insertElement('div', page, { class: 'model-preview' });
        const previewList = modelVersion.images.map((media, index) => {
            const ratio = +(media.width/media.height).toFixed(3);
            const item = createElement('a', { href: `#images?image=${media.url}`, style: `aspect-ratio: ${ratio};`, tabindex: -1 });
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


        const creatorWrap = insertElement('div', page, { class: 'model-creator' });
        const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
        if (model.creator.image) insertElement('img', creatorWrap, { crossorigin: 'anonymous', alt: 'creator-picture', src: `${model.creator.image.replace(/\/width=\d+\//, `/width=${creatorImageSize}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop&format=webp&target=creator-image` });
        else insertElement('div', creatorWrap, { class: 'no-media' }, model.creator.username.substring(0, 2));
        insertElement('div', creatorWrap, undefined, model.creator.username);

        const modelVersionDescription = insertElement('div', page, { class: 'model-description model-version-description' });
        const modelVersionNameWrap = insertElement('h2', modelVersionDescription, { class: 'model-version' }, modelVersion.name);
        const versionStatsList = [
            { icon: 'like', value: modelVersion.stats.thumbsUpCount, formatter: formatNumber, unit: 'like' },
            { icon: 'download', value: modelVersion.stats.downloadCount, formatter: formatNumber, unit: 'download' },
        ];
        modelVersionNameWrap.appendChild(this.#genStats(versionStatsList));
        if (modelVersion.description) modelVersionDescription.appendChild(safeParseHTML(modelVersion.description));

        const modelDescription = insertElement('div', page, { class: 'model-description' });
        modelDescription.appendChild(safeParseHTML(model.description));

        insertElement('a', page, { href: `${CONFIG.civitai_url}/models/${model.id}?modelVersionId=${modelVersion.id}`, class: 'link-button', style: 'display: flex; width: 20ch;margin: 0 auto;' }, window.languagePack?.text?.openOnCivitAI ?? 'Open CivitAI');

        return page;
    }

    static #genStats(stats) {
        const statsWrap = createElement('div', { class: 'badges model-stats' });
        stats.forEach(({ icon, value, formatter, unit, type }) => {
            const statWrap = insertElement('div', statsWrap, { class: 'badge' });
            if (unit) {
                const untis = window.languagePack?.units?.[unit];
                if (untis) statWrap.setAttribute('lilpipe-text', `${value} ${pluralize(value, untis)}`);
            }
            if (type) statWrap.setAttribute('data-badge', type);
            statWrap.appendChild(getIcon(icon));
            insertElement('span', statWrap, undefined, formatter?.(value) ?? value);
        });
        return statsWrap;
    }

    static #genModelCard(model) {
        const modelVersion = model.modelVersions[0];
        const previewMedia = modelVersion.images[0];
        const card = createElement('a', { class: 'card model-card', 'data-media': previewMedia?.type ?? 'none', href: `#models?model=${model.id}` });
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

        const creatorWrap = insertElement('div', cardContentWrap, { class: 'model-creator' });
        const creatorImageSize = Math.round(48 * this.#devicePixelRatio);
        if (model.creator.image) insertElement('img', creatorWrap, { crossorigin: 'anonymous', alt: 'creator-picture', src: `${model.creator.image.replace(/\/width=\d+\//, `/width=${creatorImageSize}/`)}?width=${creatorImageSize}&height=${creatorImageSize}&fit=crop&format=webp&target=creator-image` });
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
            mediaElement = createElement('img', { class: 'loading',  alt: 'model-preview', crossorigin: 'anonymous', src: lazy ? '' : src });
            if (lazy) onTargetInViewport(mediaElement, () => {
                mediaElement.src = src;
            });
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
            if (lazy) onTargetInViewport(mediaElement, () => {
                mediaElement.poster = poster;
                mediaElement.src = videoSrc;
            }); else {
                mediaElement.poster = poster;
                mediaElement.src = videoSrc;
            }
        }
        if (previewUrl) mediaElement.style.backgroundImage = `url(${previewUrl})`;
        return mediaElement;
    }

    static #genListFIlters(onAnyChange) {
        const filterWrap = createElement('div', { class: 'list-filters' });
        // Models list
        const modelsOptions = ['All', ...Object.keys(this.#baseModels)];
        const modelLabels = Object.fromEntries(modelsOptions.map(value => [ value, value ]));
        const modelsList = this.#genList({ onchange: ({ newValue }) => {
            SETTINGS.baseModels = newValue === 'All' ? [] : [ newValue ];
            onAnyChange?.();
        }, value: SETTINGS.baseModels.length ? SETTINGS.baseModels : 'All', options: modelsOptions, labels: modelLabels });
        const filterModelsList = insertElement('div', filterWrap, { class: 'list-filter', 'data-filter': 'model' });
        filterModelsList.appendChild(modelsList.element);

        // Types list
        const typeOptions = [ "All", "Checkpoint", "TextualInversion", "Hypernetwork", "AestheticGradient", "LORA", "LoCon", "DoRA", "Controlnet", "Upscaler", "MotionModule", "VAE", "Poses", "Wildcards", "Workflows", "Detection", "Other" ];
        const typeLabels = { "All": "All", "Checkpoint": "Checkpoint", "TextualInversion": "Textual Inversion", "Hypernetwork": "Hypernetwork", "AestheticGradient": "Aesthetic Gradient", "LORA": "LORA", "LoCon": "LoCon", "DoRA": "DoRA", "Controlnet": "Controlnet", "Upscaler": "Upscaler", "MotionModule": "Motion", "VAE": "VAE", "Poses": "Poses", "Wildcards": "Wildcards", "Workflows": "Workflows", "Detection": "Detection", "Other": "Other" };
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
        fetch(`_locales/${language}/language.json`)
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

function onTargetInViewport(target, callback) {
    if (!target || typeof callback !== 'function') return;

    const observer = new IntersectionObserver(([entry], obs) => {
        if (entry.isIntersecting) {
            obs.disconnect();
            callback();
        }
    }, { threshold: 0.1 });

    observer.observe(target);
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
    const href = e.target.closest('a[href^="#"]')?.getAttribute('href');
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
