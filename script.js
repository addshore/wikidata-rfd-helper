// ==UserScript==
// @name         Highlights non-notable elements of a Wikidata Item (Fork)
// @namespace    https://www.wikidata.org/
// @version      1.0
// @description  Highlights non-notable elements of a Wikidata Item
// @author       User:Shisma,User:Addshore
// @match        https://www.wikidata.org/wiki/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Helper function to request JSON from a URL
    function fetchJSON(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Main function to check each property
    function checkNonNotableProperties() {
        // Select all statement group elements with an ID
        const elements = document.querySelectorAll('#identifiers + div .wikibase-statementgroupview[id]');

        elements.forEach(async (element) => {
            const id = element.id;
            const apiURL = `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`;

            try {
                const data = await fetchJSON(apiURL);
                const entity = data.entities[id];

                // Check if the entity has a P31 → Q62589320 statement
                const isNotNotable = entity.claims?.P31?.some(statement => {
                    return statement.mainsnak?.datavalue?.value?.id === 'Q62589320';
                });
                const isMaybeNotable = entity.claims?.P31?.some(statement => {
                    return statement.mainsnak?.datavalue?.value?.id === 'Q62589316';
                });

                // If it's not notable, apply the red outline
                if (isNotNotable) {
                    element.style.outline = '2px solid red';
                }
                if (isMaybeNotable) {
                    element.style.outline = '2px solid lightgreen';
                }
            } catch (error) {
                console.error(`Error fetching data for ${id}:`, error);
            }
        });
    }

    function sitelinkIds() {
        const elements = document.querySelectorAll('div.wikibase-sitelinkgrouplistview > div .wikibase-sitelinkview-siteid');
        let siteIds = [];
        elements.forEach(async (element) => {
            // className gives you something like 'wikibase-sitelinkview-siteid wikibase-sitelinkview-siteid-arzwiki'
            // we want to extract arzwiki using a regex
            const siteId = element.className.match(/wikibase-sitelinkview-siteid-(\w+)/)[1];
            siteIds.push(siteId);
        });
        return siteIds;
    }

    function checkSitelinks() {
        const siteIds = sitelinkIds();
        const element = document.querySelector('div.wikibase-sitelinkgrouplistview');
        if (siteIds.length === 0) {
            element.style.outline = '2px solid red';
        } else {
            element.style.outline = '2px solid lightgreen';
        }
    }

    // TODO if thee are 0 terms (labels descriptions aliases), draw a red outline around the terms section
    // TODO if there are 0 statements, draw a red outline around the statements section
    // TODO if a statement has 0 references, draw a red outline around the references sections

    function checkReferences() {
        const elements = document.querySelectorAll('.wikibase-referenceview');
        const siteIds = sitelinkIds();
        const P_referenceUrl = 'P854';
        const P_basedOnHeuristic = 'P887';
        // Loop over each reference
        elements.forEach(async (element) => {
            let propertyValueMap = {};
            // Find each wikibase-snaklistview in the referenceview (which is an indivudal snak)
            const snakLists = element.querySelectorAll('.wikibase-snaklistview');
            snakLists.forEach((snakList) => {
                // Find the property ID
                const propertyId = snakList.querySelector('.wikibase-snakview-property').childNodes[0].href.match(/Property:(P\d+)/)[1];
                // Find the value of the property, which is in the text content of wikibase-snakview-value
                const propertyValue = snakList.querySelector('.wikibase-snakview-value').textContent;
                propertyValueMap[propertyId] = propertyValue;
            });
            // If a reference is based on a heuristic, it's not a reliable source, mark as red
            if (propertyValueMap[P_basedOnHeuristic]) {
                element.style.outline = '2px solid red';
            }
            // If a reference is a URL, and the domain is the the bad list, mark as red
            const badList = [
                'amazon.com',
                'amazon.co.uk',
            ]
            if (propertyValueMap[P_referenceUrl]) {
                const url = propertyValueMap[P_referenceUrl];
                const domain = new URL(url).hostname;
                if (badList.includes(domain)) {
                    element.style.outline = '2px solid red';
                }
            }
            // TODO check if the reference says imported from Wikipedia (P143), but no such sitelink exists, then mark as red
        });
    }

    // Run the checks once the page has loaded
    window.addEventListener('load', checkNonNotableProperties);
    window.addEventListener('load', checkSitelinks);
    window.addEventListener('load', checkReferences);
})();
