let tree;
let data = {};
let civs = {};
let connections;
let parentConnections;
let connectionpoints;
let focusedNodeId = null;

const unitClasses = {
    0: 'Unused',
    1: 'Infantry',
    2: 'Turtle Ships',
    3: 'Base Pierce',
    4: 'Base Melee',
    5: 'War Elephants',
    6: 'Unused',
    7: 'Unused',
    8: 'Cavalry',
    9: 'Unused',
    10: 'Unused',
    11: '<abbr title="(except Port)">All Buildings</abbr>',
    12: 'Unused',
    13: 'Stone Defense',
    14: 'FE Predator Animals',
    15: 'Archers',
    16: 'Ships & Camels & Saboteurs',
    17: 'Rams',
    18: 'Trees',
    19: '<abbr title="(except Turtle Ship)">Unique Units</abbr>',
    20: 'Siege Weapons',
    21: 'Standard Buildings',
    22: 'Walls & Gates',
    23: 'FE Gunpowder Units',
    24: 'Boars',
    25: 'Monks',
    26: 'Castle',
    27: 'Spearmen',
    28: 'Cavalry Archers',
    29: 'Eagle Warriors',
    30: 'HD Camels',
    31: 'Anti-Leitis',
    32: 'Condottieros',
    33: 'Organ Gun Damage',
    34: 'Fishing Ships',
    35: 'Mamelukes',
    36: 'Heroes and Kings',
};

const locales = {
    en: 'English',
    zh: '简体中文',
    tw: '繁體中文',
    fr: 'Français',
    de: 'Deutsch',
    hi: 'हिंदी',
    it: 'Italiano',
    jp: '日本語',
    ko: '한국어',
    ms: 'Bahasa Melayu',
    pl: 'Polski',
    ru: 'Русский',
    es: 'Español',
    mx: 'Español (México)',
    tr: 'Türkçe',
    vi: 'Tiếng Việt',
    br: 'Português (Brasil)',
};
const defaultLocale = 'en';

function loadLocale(localeCode) {
    if (!Object.keys(locales).includes(localeCode)) {
        localeCode = defaultLocale;
    }
    loadJson('data/locales/' + localeCode + '/strings.json', function (strings) {
        data.strings = strings;
        updatePageTitle();
        createXRefBadges();
        displayData();
        document.getElementById('localeselect').value = localeCode;
        document.documentElement.setAttribute('lang', localeCode);
    });
}

function updatePageTitle() {
    const aoe2 = data.strings[data.tech_tree_strings['Age of Empires II']];
    const techtree = data.strings[data.tech_tree_strings['Technology Tree']];
    document.title = `${aoe2} ${techtree}`;
}

function displayData() {
    // Reset containers
    const root = document.getElementById('root');
    if (root) {
        document.getElementById('techtree').removeChild(root);
    }
    document.getElementById('civselect').innerHTML = '';
    document.getElementById('buildingindex__table').innerHTML = '';
    document.getElementById('key__table').innerHTML = '';

    tree = getDefaultTree();
    connections = getConnections();
    parentConnections = new Map(connections.map(([parent, child]) => [child, parent]));
    connectionpoints = getConnectionPoints(tree);
    fillCivSelector();

    const draw = SVG().addTo('#techtree').id('root').size(tree.width, tree.height)
        .click((e) => {
            if (e.target.id === 'root') {
                hideHelp();
            }
        });

    document.getElementById('techtree').onclick = (e) => {
        if (e.target.id === 'techtree') {
            hideHelp();
        }
    };

    // Draw Age Row Highlighters
    let row_height = tree.height / 4;
    draw.rect(tree.width, row_height).attr({fill: '#4d3617', opacity:0.3}).click(hideHelp);
    draw.rect(tree.width, row_height).attr({fill: '#4d3617', opacity:0.3}).click(hideHelp).y(row_height * 2);

    // Add Age Icons
    let icon_height = Math.min(row_height / 2, 112);
    let icon_width = 112;
    let vertical_spacing = (row_height - icon_height) / 2 - 10;
    let margin_left = 20;
    let image_urls = ['dark_age_de.png', 'feudal_age_de.png', 'castle_age_de.png', 'imperial_age_de.png'];
    let age_names = [
        data.strings[data.age_names['Dark Age']],
        data.strings[data.age_names['Feudal Age']],
        data.strings[data.age_names['Castle Age']],
        data.strings[data.age_names['Imperial Age']]
    ];
    for (let i = 0; i < image_urls.length; i++) {
        let age_image_group = draw.group().click(hideHelp);
        let age_image = age_image_group.image('img/Ages/' + image_urls[i])
            .size(icon_width, icon_height)
            .x(margin_left)
            .y(row_height * i + vertical_spacing);
        age_image_group
            .text(age_names[i])
            .font({size: 16, weight: 'bold'}) /* Text-anchor: middle does not work. */
            .cx(icon_width / 2 + margin_left)
            .y(age_image.attr('y') + age_image.attr('height') + 5)
        ;
    }

    const connectionGroup = draw.group().attr({id: 'connection_lines'});
    for (let connection of connections) {
        let from = connectionpoints.get(connection[0]);
        let to = connectionpoints.get(connection[1]);
        let intermediate_height = from.y + (tree.element_height * 2 / 3);
        connectionGroup.polyline([from.x, from.y, from.x, intermediate_height, to.x, intermediate_height, to.x, to.y])
            .attr({id: `connection_${connection[0]}_${connection[1]}`})
            .addClass('connection')
            .click(hideHelp);
    }

    for (let lane of tree.lanes) {
        draw.rect(lane.width + 10, tree.height)
            .attr({fill: '#ffeeaa', 'opacity': 0, class: lane.caretIds().map((id) => `lane-with-${id}`)})
            .move(lane.x - 10, lane.y)
            .click(hideHelp);
        for (let r of Object.keys(lane.rows)) {
            let row = lane.rows[r];
            for (let caret of row) {
                const item = draw.group().attr({id: caret.id}).addClass('node');
                const rect = item.rect(caret.width, caret.height).attr({
                    fill: caret.type.colour,
                    id: `${caret.id}_bg`
                }).move(caret.x, caret.y);
                let name = formatName(caret.name);
                const text = item.text(name.toString())
                    .font({size: 9, weight: 'bold'})
                    .attr({fill: '#ffffff', opacity: 0.95, 'text-anchor': 'middle', id: caret.id + '_text'})
                    .cx(caret.x + caret.width / 2)
                    .y(caret.y + caret.height / 1.5);
                const image_placeholder = item.rect(caret.width * 0.6, caret.height * 0.6)
                    .attr({fill: '#000000', opacity: 0.5, id: caret.id + '_imgph'})
                    .move(caret.x + caret.width * 0.2, caret.y);
                const prefix = 'img/';
                const image = item.image(prefix + imagePrefix(caret.id) + '.png')
                    .size(caret.width * 0.6, caret.height * 0.6)
                    .attr({id: caret.id + '_img'})
                    .move(caret.x + caret.width * 0.2, caret.y);
                const rect_disabled_gray = item.rect(caret.width, caret.height).attr({
                    fill: '#000',
                    opacity: 0.2,
                    id: `${caret.id}_disabled_gray`
                }).move(caret.x, caret.y);
                const cross = item.image(prefix + 'cross.png')
                    .size(caret.width * 0.7, caret.height * 0.7)
                    .attr({id: caret.id + '_x'})
                    .addClass('cross')
                    .move(caret.x + caret.width * 0.15, caret.y - caret.height * 0.04);
                const overlaytrigger = item.rect(caret.width, caret.height)
                    .attr({id: caret.id + '_overlay'})
                    .addClass('node__overlay')
                    .move(caret.x, caret.y)
                    .data({'type': caret.type.type, 'caret': caret, 'name': caret.name, 'id': caret.id})
                    .mouseover(function () {
                        highlightPath(caret.id);
                    })
                    .mouseout(function () {
                        resetHighlightPath();
                    })
                    .click(function () {
                        displayHelp(caret.id);
                    });
            }
        }
    }


    let civWasLoaded = updateCivselectValue();
    if(!civWasLoaded){
        loadCiv();
    }
    create_colour_key();
    create_building_index();
    window.onhashchange = function () {
        updateCivselectValue();
    };
}

function updateCivselectValue() {
    let hash = window.location.hash.substr(1);
    let capitalisedHash = hash.substring(0, 1).toUpperCase() + hash.substring(1).toLowerCase();
    if (capitalisedHash in data.civ_names) {
        const civSelect = document.getElementById('civselect');
        if (civSelect.value !== capitalisedHash) {
            civSelect.value = capitalisedHash;
            loadCiv();
            return true;
        }
    }
    return false;
}

function setAdvancedStatsState() {
    try {
        let showAdvancedStats = localStorage.getItem('showAdvancedStats');
        let advancedStats = document.getElementById('advanced-stats');
        if (showAdvancedStats === 'true') {
            advancedStats.open = true;
        }
        advancedStats.onclick = onAdvancedStatsStateUpdate;
    } catch (e) {
        // pass
    }
}

function onAdvancedStatsStateUpdate() {
    try {
        localStorage.setItem('showAdvancedStats', (!document.getElementById('advanced-stats').open).toString());
    } catch (e) {
        // pass
    }
}

function imagePrefix(name) {
    return name.replace('_copy', '')
        .replace('building_', 'Buildings/')
        .replace('unit_', 'Units/')
        .replace('tech_', 'Techs/');
}

function loadCiv() {
    const selectedCiv = document.getElementById('civselect').value;
    civ(selectedCiv, tree);
    if (selectedCiv in data.civ_helptexts) {
        document.getElementById('civtext').innerHTML = data.strings[data.civ_helptexts[selectedCiv]];
        document.getElementById('civlogo').src = `./img/Civs/${selectedCiv.toLowerCase()}.png`;
        window.location.hash = selectedCiv;
    } else {
        document.getElementById('civtext').innerHTML = '';
        document.getElementById('civlogo').src = document.getElementById('civlogo').dataset.transparent;
    }
    hideHelp();
}

function loadJson(file, callback) {
    const xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', file, true);
    xobj.onreadystatechange = function () {
        if (xobj.readyState === 4 && xobj.status === 200) {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(JSON.parse(xobj.responseText));
        }
    };
    xobj.send(null);
}

function resetHighlightPath() {
    unhighlightPath();
    if (focusedNodeId) {
        highlightPath(focusedNodeId);
    }
}

function unhighlightPath() {
    SVG.find('.node.is-highlight, .connection.is-highlight')
        .each((el) => {el.removeClass('is-highlight')});
}

function highlightPath(caretId) {
    recurse(caretId);

    function recurse(caretId) {
        SVG('#'+caretId).addClass('is-highlight');

        const parentId = parentConnections.get(caretId);
        if (!parentId) return;

        const line = SVG(`#connection_${parentId}_${caretId}`);
        if (line) {
            // Move to the end of the <g> element so that it is drawn on top.
            // Without this, the line would be highlighted, but other unhighlighted
            // connection lines could be drawn on top, undoing the highlighting.
            line.front().addClass('is-highlight');
        }
        recurse(parentId);
    }
}

function displayHelp(caretId) {
    focusedNodeId = caretId;
    let helptextContent = document.getElementById('helptext__content');
    let helptextAdvancedStats = document.getElementById('helptext__advanced_stats');
    let overlay = SVG(`#${caretId}_overlay`);
    let name = overlay.data('name');
    let id = overlay.data('id').replace('_copy', '');
    let caret = overlay.data('caret');
    let type = overlay.data('type');
    helptextContent.innerHTML = getHelpText(name, id, type);
    helptextAdvancedStats.innerHTML = getAdvancedStats(name, id, type);
    styleXRefBadges(name, id, type);
    positionHelptext(caret);
    resetHighlightPath();
}

function hideHelp() {
    focusedNodeId = null;
    const helptext = document.getElementById('helptext');
    helptext.style.display = 'none';
    resetHighlightPath();
}

function positionHelptext(caret) {
    const helptext = document.getElementById('helptext');
    helptext.style.display = 'block';
    positionHelptextBelow(caret, helptext)
    || positionHelptextAbove(caret, helptext)
    || positionHelptextToLeftOrRight(caret, helptext);
}

function positionHelptextBelow(caret, helptext) {
    let top = caret.y + caret.height + document.getElementById('root').getBoundingClientRect().top;
    let helpbox = helptext.getBoundingClientRect();
    if (top + helpbox.height > tree.height) {
        return false;
    }

    let destX = caret.x - helpbox.width;
    let techtree = document.getElementById('techtree');
    if (destX < 0 || destX - techtree.scrollLeft < 0) {
        destX = techtree.scrollLeft;
    }
    helptext.style.top = top + 'px';
    helptext.style.left = destX + 'px';
    return true;
}

function positionHelptextAbove(caret, helptext) {
    let helpbox = helptext.getBoundingClientRect();
    let top = caret.y - helpbox.height + document.getElementById('root').getBoundingClientRect().top;
    if (top < 0) {
        return false;
    }

    let destX = caret.x - helpbox.width;
    let techtree = document.getElementById('techtree');
    if (destX < 0 || destX - techtree.scrollLeft < 0) {
        destX = techtree.scrollLeft;
    }
    helptext.style.top = top + 'px';
    helptext.style.left = destX + 'px';
    return true;
}

function positionHelptextToLeftOrRight(caret, helptext) {
    let helpbox = helptext.getBoundingClientRect();
    let top = 0;
    let destX = caret.x - helpbox.width;
    let techtree = document.getElementById('techtree');
    if (destX < 0 || destX - techtree.scrollLeft < 0) {
        destX = caret.x + caret.width;
    }
    helptext.style.top = top + 'px';
    helptext.style.left = destX + 'px';
}

function getHelpText(name, id, type) {
    let entitytype = getEntityType(type);
    const items = id.split('_', 1);
    id = id.substring(items[0].length + 1);
    let text = data.strings[data.data[entitytype][id]['LanguageHelpId']];
    if (text === undefined) {
        return '?';
    }
    text = text.replace(/\s<br>/g, '');
    text = text.replace(/\n/g, '');
    if (type === 'TECHNOLOGY') {
        text = text.replace(/(.+?\(.+?\))(.*)/m,
            '<p class="helptext__heading">$1</p>' +
            '<p class="helptext__desc">$2</p>' +
            '<p class="helptext__stats">&nbsp;</p>');
    } else if (type === 'UNIT' || type === 'UNIQUEUNIT' ) {
        text = text.replace(/(.+?\(‹cost›\))(.+?)<i>\s*(.+?)<\/i>(.*)/m,
            '<p>$1</p>' +
            '<p>$2</p>' +
            '<p><em>$3</em></p>' +
            '<p class="helptext__stats">$4</p>');
    } else if (type === 'BUILDING') {
        // convert the 'Required for' text in <i> to <em> so that it doesn't break the next regex
        text = text.replace(/<b><i>(.+?)<\/b><\/i>/m, '<b><em>$1</em></b>');
        if (text.indexOf('<i>') >= 0) {
            text = text.replace(/(.+?\(‹cost›\))(.+?)<i>\s*(.+?)<\/i>(.*)/m,
                '<p>$1</p>' +
                '<p>$2</p>' +
                '<p><em>$3</em></p>' +
                '<p class="helptext__stats">$4</p>');
        } else {
            // Handle certain buildings like Wonders separately as the upgrades text is missing for them.
            text = text.replace(/(.+?\(‹cost›\))(.*)<br>(.*)/m,
                '<p>$1</p>' +
                '<p>$2</p>' +
                '<p class="helptext__stats">$3</p>');
        }
    }
    let meta = data.data[entitytype][id];
    if (meta !== undefined) {
        text = text.replace(/‹cost›/, 'Cost: ' + cost(meta.Cost));
        let stats = []
        if (text.match(/‹hp›/)) {
            stats.push('HP:&nbsp;' + meta.HP);
        }
        if (text.match(/‹attack›/)) {
            stats.push('Attack:&nbsp;' + meta.Attack);
        }
        if (text.match(/‹[Aa]rmor›/)) {
            stats.push('Armor:&nbsp;' + meta.MeleeArmor);
        }
        if (text.match(/‹[Pp]iercearmor›/)) {
            stats.push('Pierce armor:&nbsp;' + meta.PierceArmor);
        }
        if (text.match(/‹garrison›/)) {
            stats.push('Garrison:&nbsp;' + meta.GarrisonCapacity);
        }
        if (text.match(/‹range›/)) {
            stats.push('Range:&nbsp;' + meta.Range);
        }
        stats.push(ifDefinedAndGreaterZero(meta.MinRange, 'Min Range:&nbsp;'));
        stats.push(ifDefined(meta.LineOfSight, 'Line of Sight:&nbsp;'));
        stats.push(ifDefined(meta.Speed, 'Speed:&nbsp;'));
        stats.push(secondsIfDefined(meta.TrainTime, 'Build Time:&nbsp;'));
        stats.push(secondsIfDefined(meta.ResearchTime, 'Research Time:&nbsp;'));
        stats.push(ifDefined(meta.FrameDelay, 'Frame Delay:&nbsp;'));
        stats.push(ifDefinedAndGreaterZero(meta.MaxCharge, 'Charge Attack:&nbsp;'));
        stats.push(ifDefinedAndGreaterZero(meta.RechargeRate, 'Recharge Rate:&nbsp;'));
        stats.push(secondsIfDefined(meta.RechargeDuration, 'Recharge Duration:&nbsp;'));
        stats.push(secondsIfDefined(meta.AttackDelaySeconds, 'Attack Delay:&nbsp;'));
        stats.push(secondsIfDefined(meta.ReloadTime, 'Reload Time:&nbsp;'));
        stats.push(accuracyIfDefined(meta.AccuracyPercent, 'Accuracy:&nbsp;'));
        stats.push(repeatableIfDefined(meta.Repeatable));
        text = text.replace(/<p class="helptext__stats">(.+?)<\/p>/, '<h3>Stats</h3><p>' + stats.filter(Boolean).join(', ') + '<p>')
    } else {
        console.error('No metadata found for ' + name);
    }
    return text;
}

function getAdvancedStats(name, id, type) {
    let entitytype = getEntityType(type);
    const items = id.split('_', 1);
    id = id.substring(items[0].length + 1);
    let meta = data.data[entitytype][id];
    let text = ''
    if (meta !== undefined) {
        text += arrayIfDefinedAndNonEmpty(meta.Attacks, '<h3>Attacks</h3>');
        text += arrayIfDefinedAndNonEmpty(meta.Armours, '<h3>Armours</h3>');
    } else {
        console.error('No metadata found for ' + name);
    }
    return text;
}

function getEntityType(type) {
    let entitytype = 'buildings';
    if (type === 'UNIT' || type === 'UNIQUEUNIT') {
        entitytype = 'units';
    }
    if (type === 'TECHNOLOGY') {
        entitytype = 'techs';
    }
    return entitytype;
}

/**
 * Create the Cross-Reference badges. This is done at load time in order to avoid re-making the
 * badges at runtime per-click on a new unit.
 *
 * @return A container with buttons + images for each civ to be used in cross referencing.
 */
  function createXRefBadges() {
    let xRefLinks = document.getElementById('helptext__x_ref__container');
    xRefLinks.innerHTML = '';
    for (let civ of Object.keys(data.civ_names)) {
        let xRefLink = document.createElement('button');
        xRefLink.addEventListener('click', function() {
          document.getElementById('civselect').value=civ;
          loadCiv();
        });

        let xRefImage = document.createElement('img');

        xRefImage.src = `./img/Civs/${civ.toLowerCase()}.png`;
        xRefImage.title = data.strings[data.civ_names[civ]];
        xRefImage.id = `xRef__badge__${civ}`;
        xRefImage.classList.add('xRef__badge')
        xRefLink.appendChild(xRefImage);
        xRefLinks.appendChild(xRefLink);
    }
}

/**
 * Set on/off of all cross reference badges for a single unit.
 *
 * @param {string} name The name of the entity being cross-referenced.
 * @param {string} id The id of the entity being cross-referenced.
 * @param {string} type The type of the entity being cross-referenced.
 */
function styleXRefBadges(name, id, type) {
    for (let civ of Object.keys(data.civ_names)) {
        let xRefImage = document.getElementById(`xRef__badge__${civ}`);
        let found = false;
        // Make sure this civ exists
        if (civs[civ]) {
            if (type === 'UNIT' || type === 'UNIQUEUNIT') {
                if (civs[civ].units.map((id) => `unit_${id}`).includes(id)) {
                    found = true;
                } else if (`unit_${civs[`${civ}`].unique.castleAgeUniqueUnit}` === id || `unit_${civs[`${civ}`].unique.imperialAgeUniqueUnit}` === id) {
                    found = true;
                }
            } else if (type === 'TECHNOLOGY') {
                if (civs[civ].techs.map((id) => `tech_${id}`).includes(id)) {
                    found = true;
                } else if (`tech_${civs[`${civ}`].unique.castleAgeUniqueTech}` === id || `tech_${civs[`${civ}`].unique.imperialAgeUniqueTech}` === id) {
                    found = true;
                }
            } else if (type === 'BUILDING') {
                if (civs[civ].buildings.map((id) => `building_${id}`).includes(id)) {
                    found = true;
                }
            }
        }
        if (found) {
            xRefImage.style.opacity = '1.0';
        } else {
            xRefImage.style.opacity = '0.2';
        }
    }
}

function ifDefined(value, prefix) {
    if (value !== undefined) {
        return ' ' + prefix + value;
    } else {
        return '';
    }
}

function secondsIfDefined(value, prefix) {
    if (value !== undefined) {
        return ' ' + prefix + toMaxFixed2(value) + 's';
    } else {
        return '';
    }
}

function toMaxFixed2(value) {
    return Math.round(value * 100) / 100;
}

function accuracyIfDefined(value, prefix) {
    if (value !== undefined && value < 100) {
        return ' ' + prefix + value + '%';
    } else {
        return '';
    }
}

function ifDefinedAndGreaterZero(value, prefix) {
    if (value !== undefined && value > 0) {
        return ' ' + prefix + value;
    } else {
        return '';
    }
}

function arrayIfDefinedAndNonEmpty(attacks, prefix) {
    if (attacks === undefined || attacks.length < 1) {
        return '';
    } else {
        const strings = [];
        for (let attack of attacks) {
            const amount = attack['Amount'];
            const clazz = unitClasses[attack['Class']];
            strings.push(`${amount} (${clazz})`);
        }
        return prefix + '<p>' + strings.join(', ') + '</p>';
    }
}

function repeatableIfDefined(value) {
    if (value !== undefined) {
        return value ? 'Repeatable' : 'Not Repeatable';
    } else {
        return '';
    }
}

function cost(cost_object) {
    let value = '';
    if ('Food' in cost_object) {
        value += ' ' + cost_object.Food + 'F';
    }
    if ('Wood' in cost_object) {
        value += ' ' + cost_object.Wood + 'W';
    }
    if ('Gold' in cost_object) {
        value += ' ' + cost_object.Gold + 'G';
    }
    if ('Stone' in cost_object) {
        value += ' ' + cost_object.Stone + 'S';
    }
    return value;
}

function create_building_index() {
    const buildingIndexShowIds = [
        ARCHERY_RANGE,
        BARRACKS,
        STABLE,
        SIEGE_WORKSHOP,
        BLACKSMITH,
        DOCK,
        UNIVERSITY,
        WATCH_TOWER,
        CASTLE,
        MONASTERY,
        TOWN_CENTER,
        MARKET
    ];
    const buildingIndexRowLength = 6;

    let kc = document.getElementById('buildingindex__table');
    let tr = null;
    let count = 0;
    for (let index in buildingIndexShowIds) {
        let buildingId = buildingIndexShowIds[index];
        if ((count % buildingIndexRowLength) === 0) {
            if (tr) {
              kc.appendChild(tr);
            }
            tr = document.createElement('tr');
        }
        ++count;
        let img = document.createElement('img');
        img.src = 'img/Buildings/' + String(buildingId) + '.png';
        img.style.height = '24px';
        img.style.width = '24px';
        let td = document.createElement('td');
        td.onclick = function() { scrollToBuildingId(buildingId); }
        td.appendChild(img);
        tr.appendChild(td);
    }
    if (tr) {
      kc.appendChild(tr);
    }
}

function create_colour_key() {
    let legend = [TYPES.UNIQUEUNIT, TYPES.UNIT, TYPES.BUILDING, TYPES.TECHNOLOGY];
    let kc = document.getElementById('key__table');
    let tr = null
    for (let index in legend) {
        if (index % 2 === 0) {
            tr = document.createElement('tr');
        }
        let td_color = document.createElement('td');
        td_color.style.backgroundColor = legend[index]['colour'];
        td_color.style.border = '1px outset #8a5d21';
        td_color.style.width = '23px';
        tr.appendChild(td_color);
        let td_type = document.createElement('td');
        td_type.innerText = data.strings[data.tech_tree_strings[legend[index]['name']]];
        tr.appendChild(td_type);
        if (index % 2 === 1) {
            kc.appendChild(tr);
        }
    }
    document.getElementById('key__label').innerText = data.strings[data.tech_tree_strings['Key']];
}

function changeLocale() {
    const newLocale = document.getElementById('localeselect').value;
    setLocaleInUrl(newLocale);
    setLocaleInLocalStorage(newLocale);
    loadLocale(newLocale);
}

function fillLocaleSelector(currentLocale) {
    Object.keys(locales).map(function(locale) {
        const option = document.createElement('option');
        option.setAttribute('value', locale);
        option.textContent = locales[locale];
        if (currentLocale === locale) {
            option.setAttribute('selected', '')
        }
        document.getElementById('localeselect').appendChild(option);
    });
}

function fillCivSelector() {
    const sorted_civ_names = Object.keys(data.civ_names).sort((a, b) => {
        const localised_name_a = data.strings[data.civ_names[a]];
        const localised_name_b = data.strings[data.civ_names[b]];
        return localised_name_a.localeCompare(localised_name_b);
    });

    for (let civ_name of sorted_civ_names) {
        const option = document.createElement('option');
        option.setAttribute('value', civ_name);
        option.textContent = data.strings[data.civ_names[civ_name]];
        document.getElementById('civselect').appendChild(option);
    }
}

function civ(name) {
    let selectedCiv = civs[name];

    SVG.find('.cross').each(function () {
        if (SVGObjectIsOpaque(this)) {
            return;
        }

        let {id, type} = parseSVGObjectId(this.id());
        if (id === undefined || type === undefined) {
            return;
        }

        if (type === 'unit') {
            if (selectedCiv.units.includes(id)) {
                return;
            }
        } else if (type === 'building') {
            if (selectedCiv.buildings.includes(id)) {
                return;
            }
        } else if (type === 'tech') {
            if (selectedCiv.techs.includes(id)) {
                return;
            }
        }
        makeSVGObjectOpaque(this);
        makeSVGObjectOpaque(SVG('#' + this.id().replace('_x', '_disabled_gray')), 0.2);
    });

    enable(selectedCiv.buildings, [...selectedCiv.units, UNIQUE_UNIT, ELITE_UNIQUE_UNIT], [...selectedCiv.techs, UNIQUE_TECH_1, UNIQUE_TECH_2]);
    unique([selectedCiv.unique.castleAgeUniqueUnit,
        selectedCiv.unique.imperialAgeUniqueUnit,
        selectedCiv.unique.castleAgeUniqueTech,
        selectedCiv.unique.imperialAgeUniqueTech], selectedCiv.monkPrefix);
}

function SVGObjectIsOpaque(svgObj) {
    return svgObj.attr('opacity') === 1
}

function makeSVGObjectOpaque(svgObj, opacity = 1) {
    svgObj.attr({'opacity': opacity});
}

function parseSVGObjectId(svgObjId) {
    const id_regex = /(.+)_([\d]+)_(x|copy)/;

    const found = svgObjId.match(id_regex);
    if (!found) {
        return {id: undefined, type: undefined};
    }
    let id = parseInt(found[2]);
    let type = found[1];

    return {id, type}
}

function techtreeDoesNotHaveScrollbar() {
    const techtreeElement = document.getElementById('techtree');
    return techtreeElement.scrollHeight <= techtreeElement.clientHeight;
}

function shiftKeyIsNotPressed(e) {
    return !e.shiftKey;
}

function scrollToBuildingId(buildingId) {
    const buildingElementId = `building_${buildingId}_bg`;
    const laneBackground = SVG(`.lane-with-building_${buildingId}`);
    laneBackground.attr({'opacity': 0.5});
    setTimeout(() => {
        laneBackground.animate(animation_duration * 10).attr({'opacity': 0});
    }, 500);
    const buildingElement = document.getElementById(buildingElementId);
    buildingElement.scrollIntoView({block: 'center', inline: 'center'});
}

function getLocaleFromUrlIfExists(defaultValue) {
    const urlParams = new URLSearchParams(window.location.search);
    const lng = urlParams.get('lng');
    if (Object.keys(locales).includes(lng)) {
        return lng;
    }
    return defaultValue;
}

function setLocaleInUrl(locale) {
    let searchParams = new URLSearchParams(window.location.search);
    searchParams.set('lng', locale);
    history.pushState({}, null, `?${searchParams}${window.location.hash}`);
}

function setLocaleInLocalStorage(localeCode) {
    try {
        window.localStorage.setItem('locale', localeCode);
    } catch (e) {
        // pass
    }
}

function getInitialLocale() {
    let storedLocale = defaultLocale;
    try {
        storedLocale = window.localStorage.getItem('locale');
    } catch (e) {
        // pass
    }
    storedLocale = getLocaleFromUrlIfExists(storedLocale);
    return storedLocale;
}

function main() {

    history.pushState = (f => function pushState() {
        const ret = f.apply(this, arguments); // Fixme: Void function return value is used.
        window.dispatchEvent(new Event('pushstate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    })(history.pushState);

    history.replaceState = (f => function replaceState() {
        const ret = f.apply(this, arguments); // Fixme: Void function return value is used.
        window.dispatchEvent(new Event('replacestate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    })(history.replaceState);

    window.addEventListener('popstate', () => {
        window.dispatchEvent(new Event('locationchange'));
    });

    window.addEventListener('locationchange', () => {
        const newLocale = getLocaleFromUrlIfExists(undefined);
        const oldLocale = document.getElementById('localeselect').value;
        if (newLocale && (newLocale !== oldLocale)) {
            loadLocale(newLocale);
        }
    })

    setAdvancedStatsState();

    let storedLocale = getInitialLocale();
    fillLocaleSelector(storedLocale);

    loadJson('data/data.json', function (response) {
        data = response;
        civs = data.techtrees;
        loadLocale(storedLocale);
    });

    let doVerticalScroll = true;
    const techtreeElement = document.getElementById('techtree');
    techtreeElement.addEventListener('wheel', function (e) {
        if (e.deltaX !== 0) {
            doVerticalScroll = false;
        }
        if (doVerticalScroll && techtreeDoesNotHaveScrollbar() && shiftKeyIsNotPressed(e)) {
            if (e.deltaY > 0) {
                techtreeElement.scrollLeft += 150;
            } else if (e.deltaY < 0) {
                techtreeElement.scrollLeft -= 150;
            }
        }
    });
}

main();
