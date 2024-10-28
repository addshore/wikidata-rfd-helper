// ==UserScript==
// @name         Highlight Non-Notable Properties on Wikidata (Fork)
// @namespace    https://www.wikidata.org/
// @version      1.0
// @description  Highlights non-notable properties on Wikidata
// @author       User:Shisma
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

    // Run the check once the page has loaded
    window.addEventListener('load', checkNonNotableProperties);
})();