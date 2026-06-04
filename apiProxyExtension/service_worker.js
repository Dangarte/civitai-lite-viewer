"use strict";

/**
 * modifyHeaders rule
 *
 * https://github.com/civitai/civitai/commit/34f0670f48e9ebec57fdc8daee4260bef94daad4
 * > "Anonymous users (any domain) now cap at publicBrowsingLevelsFlag (PG),"
 *
 * So... this rule moves authorization from .red to the iframe, forcibly adding cookies (otherwise the browser doesn't attach cookies there)
 */

const CONFIG = {
    domain: 'civitai.red',
    storageKey: 'active_bridge_tabs',
    rules: {
        block: { offset: 0, priority: 2 },
        allow: { offset: 1, priority: 3 },
        modify: { offset: 2, priority: 4 }
    }
};

// Listeners
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === 'enableBridgeMode' && sender.tab) enableBridgeMode(sender.tab.id);
});

chrome.cookies.onChanged.addListener(async (change) => {
    if (change.cookie.domain.includes(CONFIG.domain)) await syncAllBridgeRules();
});

chrome.tabs.onRemoved.addListener(cleanTabRules);

function getRuleId(tabId, type) {
    const base = Math.abs(tabId) % 100000;
    return (base * 10) + CONFIG.rules[type].offset + 1;
}

async function getActiveTabs() {
    const data = await chrome.storage.session.get(CONFIG.storageKey);
    return data[CONFIG.storageKey] || [];
}

async function getCookieString() {
    const cookies = await chrome.cookies.getAll({ domain: CONFIG.domain });
    return cookies
        .filter(c => c.value && !c.value.includes('expired-session'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
}

function buildRules(tabId, cookieString) {
    const condition = {
        initiatorDomains: [CONFIG.domain],
        tabIds: [tabId]
    };

    const apiCondition = {
        ...condition,
        urlFilter: `https://${CONFIG.domain}/api/*`,
        resourceTypes: ['xmlhttprequest']
    };

    const rules = [
        {
            id: getRuleId(tabId, 'block'),
            priority: CONFIG.rules.block.priority,
            action: { type: 'block' },
            condition
        },
        {
            id: getRuleId(tabId, 'allow'),
            priority: CONFIG.rules.allow.priority,
            action: { type: 'allow' },
            condition: apiCondition
        }
    ];

    if (cookieString) {
        rules.push({
            id: getRuleId(tabId, 'modify'),
            priority: CONFIG.rules.modify.priority,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [{ header: 'Cookie', operation: 'set', value: cookieString }]
            },
            condition: apiCondition
        });
    }

    return rules;
}

async function enableBridgeMode(tabId) {
    const cookieString = await getCookieString();
    const rules = buildRules(tabId, cookieString);
    const activeTabs = await getActiveTabs();

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: Object.keys(CONFIG.rules).map(type => getRuleId(tabId, type)),
        addRules: rules
    });

    if (!activeTabs.includes(tabId)) {
        await chrome.storage.session.set({ [CONFIG.storageKey]: [...activeTabs, tabId] });
    }
}

async function syncAllBridgeRules() {
    const activeTabs = await getActiveTabs();
    if (!activeTabs.length) return;

    const cookieString = await getCookieString();

    // Updating only the header modification rules
    for (const tabId of activeTabs) {
        const modifyRule = buildRules(tabId, cookieString).find(r => r.action.type === 'modifyHeaders');
        if (modifyRule) {
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [modifyRule.id],
                addRules: [modifyRule]
            });
        }
    }
}

async function cleanTabRules(tabId) {
    const activeTabs = await getActiveTabs();
    if (!activeTabs.includes(tabId)) return;

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: Object.keys(CONFIG.rules).map(type => getRuleId(tabId, type))
    });

    await chrome.storage.session.set({
        [CONFIG.storageKey]: activeTabs.filter(id => id !== tabId)
    });
}
