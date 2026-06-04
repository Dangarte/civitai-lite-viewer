/// <reference path="./../src/js/_docs.d.ts" />
"use strict";

window.extension_civitaiExtensionProxyAPI_vertsion = 4;

window.proxyFetchCivAPI = async function (route, params = {}) {
    return new Promise((resolve) => {
        const requestId = crypto.randomUUID();

        const handler = e => {
            if (e.detail?.id === requestId) {
                window.removeEventListener('CIV_RESPONSE', handler);
                resolve(e.detail.data);
            }
        };
        window.addEventListener('CIV_RESPONSE', handler);

        window.dispatchEvent(new CustomEvent('CIV_REQUEST', {
            detail: { id: requestId, route, params }
        }));
    });
};
