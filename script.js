// ==UserScript==
// @name         Highlight Non-Notable Properties on Wikidata
// @namespace    https://www.wikidata.org/
// @version      1.0
// @downloadURL  https://raw.githubusercontent.com/addshore/wikidata-rfd-helper/refs/heads/main/script.js
// @updateURL    https://raw.githubusercontent.com/addshore/wikidata-rfd-helper/refs/heads/main/script.js
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

    function onLoad() {
        // Add a link to the top of item pages
        if (window.location.pathname.match(/\/wiki\/Q\d+/)) {
            // Add a link to the end of the inner HTML of wikibase-title, called "RFD view", which runs checkStatementGroups and checkSitelinks
            const title = document.querySelector('.wikibase-title');
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = 'RFD view';
            link.onclick = function() {
                runAllItemChecks();
                return false;
            };
            title.appendChild(link);

            checkNoStatements();
        }
        // If we are on wiki/Wikidata:Requests_for_deletions, add stuff
        if (window.location.pathname.match(/\/wiki\/Wikidata:Requests_for_deletions/)) {
            // Find each mw-heading2 section
            const headings = document.querySelectorAll('.mw-heading2');
            headings.forEach(async (heading) => {
                // If we add content, it will be to a div at the end of the heading content :)
                const div = document.createElement('div');
                heading.appendChild(div);
                const rfdHelper = document.createElement('span');
                rfdHelper.textContent = 'RFD Helper: ';
                div.appendChild(rfdHelper);
                // We want to find the next ol tag after "heading", if it is a group,
                // Or find the next p tag after "heading" if it is a single entry
                const nextElement = heading.nextElementSibling;
                // Within that next element, find all li tags, or use the p tag as the only li
                const rfdItems = nextElement.tagName === 'OL' ? nextElement.querySelectorAll('li') : [nextElement];
                rfdItems.forEach(async (rfdItem) => {
                    if (!rfdItem.querySelector('a')) {
                        console.log('No link found in RFD item');
                        console.log(rfdItem);
                        return;
                    }
                    // find the attribute title of the a link, this is the item id
                    const itemId = rfdItem.querySelector('a').title;
                    // skip if it is not a Q item
                    if (!itemId.match(/^Q\d+$/)) {
                        console.log('Not a Q item, skipping item:', itemId);
                        return;
                    }
                    try{
                        // Lookup the first revision of the item from the API, and add the author and timestamp to the content of the page
                        // https://www.wikidata.org/w/api.php?action=query&prop=revisions&titles=Q123&rvlimit=1&rvprop=timestamp|user&format=json
                        let data = await fetchJSON(`https://www.wikidata.org/w/api.php?action=query&prop=revisions&titles=${itemId}&rvlimit=1&rvprop=timestamp|user&format=json`)
                        console.log(data);
                        let pageId = Object.keys(data.query.pages)[0];
                        let firstRevisionData = data.query.pages[pageId].revisions[0];
                        let author = firstRevisionData.user;
                        let timestamp = firstRevisionData.timestamp;
                        let timeSinceCreation = new Date() - new Date(timestamp);
                        let daysSinceCreation = Math.floor(timeSinceCreation / (1000 * 60 * 60 * 24));
                        let timeSinceCreationString = `${daysSinceCreation} days ago`;
                        if (daysSinceCreation === 1) {
                            timeSinceCreationString = '1 day ago';
                        }
                        if (daysSinceCreation === 0) {
                            timeSinceCreationString = 'today';
                        }
                        let authorElement = document.createElement('span');
                        authorElement.innerHTML = `Created by <a href="https://www.wikidata.org/wiki/User:${author}">${author}</a> ${timeSinceCreationString}`;
                        div.appendChild(authorElement);

                        // If the user is NOT an IP address, then add a link to send them a message on their talk page
                        if (!author.match(/\d+\.\d+\.\d+\.\d+/)) {
                            let talkLink = document.createElement('a');
                            talkLink.href = `https://www.wikidata.org/wiki/User_talk:${author}`;
                            talkLink.textContent = ' (talk)';
                            authorElement.appendChild(talkLink);
                        }
                    } catch (error) {
                        console.error(`Error fetching data and suplementing info for ${itemId}:`, error);
                    }
                });
            })
        }
    }

    function runAllItemChecksOnRFDRefer() {
        // If the URL contains "Special:EntityData", run checkStatementGroups and checkSitelinks
        if (document.referrer === 'https://www.wikidata.org/wiki/Wikidata:Requests_for_deletions') {
            runAllItemChecks();
        }
    }

    function runAllItemChecks() {
        checkSitelinks();
        checkStatementGroups();
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

    function checkNoStatements() {
      const statementList = document.querySelector('#claims + .wikibase-statementgrouplistview > .wikibase-listview')
      if (statementList.childElementCount === 0) {
         document.querySelector('#claims').style.borderBottom = '1px solid red';
      }
    }

    // TODO if a statement has 0 references, draw a red outline around the references sections

    function checkStatementGroups() {
        console.log('Checking statement groups');
        const siteIds = sitelinkIds();
        const P_importedFromWikimedia = 'P143';
        const P_referenceUrl = 'P854';
        const P_basedOnHeuristic = 'P887';

        // Each property used for statements creates 1 statement group view
        const statementGroups = document.querySelectorAll('.wikibase-statementgroupview[id]');
        // if there are no statemens, highlight wikibase-statements in red
        if (statementGroups.length === 0) {
            const element = document.querySelector('.wikibase-statements');
            element.style.outline = '2px solid red';
        }
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
                let referenceViewStates = [];
                await Promise.all(Array.from(referenceViews).map(async (referenceView) => {
                    const snakLists = referenceView.querySelectorAll('.wikibase-snaklistview');
                    let propertyValueMap = {};
                    snakLists.forEach((snakList) => {
                        const propertyId = snakList.querySelector('.wikibase-snakview-property').childNodes[0].href.match(/Property:(P\d+)/)[1];
                        // For entities, we have <a href="/wiki/Q328" original-title="English-language edition of Wikipedia">English Wikipedia</a>
                        const textContent = snakList.querySelector('.wikibase-snakview-value').textContent;
                        const aElement = snakList.querySelector('.wikibase-snakview-value a');
                        let propertyValue;
                        if (aElement && aElement.href === 'https://www.wikidata.org/wiki/Q328') {
                            propertyValue = aElement.href.split('/').pop();
                        } else {
                            propertyValue = textContent;
                        }
                        propertyValueMap[propertyId] = propertyValue;
                    });
                    if (propertyValueMap[P_basedOnHeuristic]) {
                        referenceView.style.outline = '2px solid red';
                        referenceViewStates.push('red');
                        return;
                    }
                    if (propertyValueMap[P_importedFromWikimedia]) {
                        // we need to load the value of the snak, so that we can get the wiki site code, and see if this item is linked to an article for it
                        const snakValue = propertyValueMap[P_importedFromWikimedia];
                        console.log('Checking imported from wikimedia:', snakValue);
                        const wikiSiteData = await fetchJSON(`https://www.wikidata.org/wiki/Special:EntityData/${snakValue}.json`);
                        const wikiSiteEntity = wikiSiteData.entities[snakValue];
                        // There should be one P1800 value, and that is out oursiteid
                        if (wikiSiteEntity.claims.P1800 && wikiSiteEntity.claims.P1800.length != 1) {
                            console.error('There should be exactly one P1800 value for a wiki site entity');
                            return;
                        }
                        const wikiSiteId = wikiSiteEntity.claims.P1800[0].mainsnak.datavalue.value;
                        if (!siteIds.includes(wikiSiteId)) {
                            referenceView.style.outline = '2px solid red';
                            referenceViewStates.push('red');
                        } else {
                            referenceView.style.outline = '2px solid lightgreen';
                            referenceViewStates.push('lightgreen');
                        }
                    }
                    const badList = [
                        // Shops
                        'amazon.com',
                        'amazon.co.uk',
                        // Socials
                        'instagram.com',
                        'tiktok.com',
                        'facebook.com',
                        'twitter.com',
                        // URLs for IDs that don't infer notability
                        'crunchbase.com', // https://www.wikidata.org/wiki/Property:P2087
                    ]
                    const probablyBadList = [
                        // Translations
                        'unalengua.com', // Just a translation service
                        // Music listings
                        'music.apple.com',
                        'genius.com',
                        // Just a youtube wrapper
                        'upwindmusic.com', // Discovered from https://www.wikidata.org/wiki/Q116907159
                    ]
                    if (propertyValueMap[P_referenceUrl]) {
                        const url = propertyValueMap[P_referenceUrl];
                        const domain = new URL(url).hostname;
                        if (badList.includes(domain)) {
                            referenceView.style.outline = '2px solid red';
                            referenceViewStates.push('red');
                            return;
                        }
                        if (probablyBadList.includes(domain)) {
                            referenceView.style.outline = '2px solid orange';
                            referenceViewStates.push('orange');
                            return;
                        }
                    }
                }));
                // If there are the same number of red reference views as there are reference views, then the statement view should be red
                if (referenceViewStates.length === referenceViews.length) {
                    statementView.style.outline = '2px solid red';
                }
            });
        });
    }

    window.addEventListener('load', onLoad);
    window.addEventListener('load', runAllItemChecksOnRFDRefer);
})();
