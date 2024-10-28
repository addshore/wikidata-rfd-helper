// ==UserScript==
// @name         Highlights non-notable parts of Wikidata items (Fork)
// @namespace    https://www.wikidata.org/
// @version      1.0
// @description  Highlights non-notable parts of Wikidata items
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
        if (siteIds.length === 0) {
            // mark wikibase-sitelinkgrouplistview as red
            const element = document.querySelector('div.wikibase-sitelinkgrouplistview');
            element.style.outline = '2px solid red';
        }
    }

    // Run the checks once the page has loaded
    window.addEventListener('load', checkNonNotableProperties);
    window.addEventListener('load', checkSitelinks);
})();