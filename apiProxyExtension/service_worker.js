const tabRulesMap = new Map();

chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) return;

    if (message.action === "enableBridgeMode" && sender.tab) {
        const tabId = sender.tab.id;

        const blockRuleId = (tabId + 2000) | 0;
        const allowRuleId = (tabId + 3000) | 0;

        const oldRules = tabRulesMap.get(tabId) || [];

        chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: oldRules,
            addRules: [
                {
                    id: blockRuleId,
                    priority: 2,
                    action: { type: "block" },
                    condition: {
                        initiatorDomains: ["civitai.com"],
                        tabIds: [tabId]
                    }
                },
                {
                    id: allowRuleId,
                    priority: 3,
                    action: { type: "allow" },
                    condition: {
                        initiatorDomains: ["civitai.com"],
                        urlFilter: "https://civitai.com/api/*",
                        resourceTypes: ["xmlhttprequest"],
                        tabIds: [tabId]
                    }
                }
            ]
        });

        tabRulesMap.set(tabId, [blockRuleId, allowRuleId]);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabRulesMap.has(tabId)) {
        chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: tabRulesMap.get(tabId)
        });
        tabRulesMap.delete(tabId);
    }
});
