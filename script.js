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

    if (document.referrer !== 'https://www.wikidata.org/wiki/Wikidata:Requests_for_deletions') {
        // https://stackoverflow.com/questions/40153206/detect-if-console-devtools-is-open-in-all-browsers
        // TODO add a button to trigger "RFD" view, instead of this debug check
        var minimalUserResponseInMiliseconds = 100;
        var before = new Date().getTime();
        debugger;
        var after = new Date().getTime();
        if (after - before < minimalUserResponseInMiliseconds) { // user had to resume the script manually via opened dev tools
          return
        }
    }

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

    function checkStatementGroups() {
        console.log('Checking statement groups');
        const siteIds = sitelinkIds();
        const P_referenceUrl = 'P854';
        const P_basedOnHeuristic = 'P887';

        // Each property used for statements creates 1 statement group view
        const statementGroups = document.querySelectorAll('.wikibase-statementgroupview[id]');
        statementGroups.forEach(async (statementGroup) => {
            const statementGroupID = statementGroup.id;
            console.log(statementGroupID);
            // Each statement creates one statement view
            const statementViews = statementGroup.querySelectorAll('.wikibase-statementview');
            const apiURL = `https://www.wikidata.org/wiki/Special:EntityData/${statementGroupID}.json`;

            try {
                const data = await fetchJSON(apiURL);
                const entity = data.entities[statementGroupID];

                const isNotNotable = entity.claims?.P31?.some(statement => {
                    return statement.mainsnak?.datavalue?.value?.id === 'Q62589320';
                });
                const isMaybeNotable = entity.claims?.P31?.some(statement => {
                    return statement.mainsnak?.datavalue?.value?.id === 'Q62589316';
                });

                if (isNotNotable) {
                    statementGroup.style.outline = '2px solid red';
                }
                if (isMaybeNotable) {
                    statementGroup.style.outline = '2px solid lightgreen';
                }
            } catch (error) {
                console.error(`Error fetching data for ${statementGroupID}:`, error);
            }

            // Loop through each individual statement
            statementViews.forEach(async (statementView) => {
                const referenceViews = statementView.querySelectorAll('.wikibase-referenceview');
                if (referenceViews.length === 0) {
                    statementView.style.outline = '2px solid red';
                }
                referenceViews.forEach(async (referenceView) => {
                    const snakLists = referenceView.querySelectorAll('.wikibase-snaklistview');
                    let propertyValueMap = {};
                    snakLists.forEach((snakList) => {
                        const propertyId = snakList.querySelector('.wikibase-snakview-property').childNodes[0].href.match(/Property:(P\d+)/)[1];
                        const propertyValue = snakList.querySelector('.wikibase-snakview-value').textContent;
                        propertyValueMap[propertyId] = propertyValue;
                    });
                    if (propertyValueMap[P_basedOnHeuristic]) {
                        referenceView.style.outline = '2px solid red';
                    }
                    const badList = [
                        'amazon.com',
                        'amazon.co.uk',
                    ]
                    if (propertyValueMap[P_referenceUrl]) {
                        const url = propertyValueMap[P_referenceUrl];
                        const domain = new URL(url).hostname;
                        if (badList.includes(domain)) {
                            referenceView.style.outline = '2px solid red';
                        }
                    }
                });
            });
        });
    }

    window.addEventListener('load', checkStatementGroups);
    window.addEventListener('load', checkSitelinks);
})();
