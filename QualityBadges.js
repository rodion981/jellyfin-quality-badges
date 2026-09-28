(function () {
    'use strict';

    if (window.jfQualityBadgesLoaded) return;
    window.jfQualityBadgesLoaded = true;

    const STYLE_ID = 'jf-quality-style';
    const CONTAINER_CLASS = 'jf-quality-container';
    const SETTINGS_ID = 'jf-quality-settings';
    const BADGE_GROUPS = {
        Resolution: ['4K', '1080p', '720p', 'SD'],
        'Dynamic Range': ['DV', 'HDR10+', 'HDR10', 'HLG'],
        'Video Codec': ['HEVC', 'AV1', 'AVC'],
        Audio: ['Atmos', 'DTS:X', 'TrueHD', 'DTS-HD MA', 'DTS', 'DD+', 'DD', 'FLAC', 'AAC']
    };
    const ALL_BADGES = Object.values(BADGE_GROUPS).flat();
    const badgeVars = {
        '4K': '{{SHOW_4K}}', '1080p': '{{SHOW_1080P}}', '720p': '{{SHOW_720P}}', SD: '{{SHOW_SD}}',
        DV: '{{SHOW_DV}}', 'HDR10+': '{{SHOW_HDR10_PLUS}}', HDR10: '{{SHOW_HDR10}}', HLG: '{{SHOW_HLG}}',
        HEVC: '{{SHOW_HEVC}}', AV1: '{{SHOW_AV1}}', AVC: '{{SHOW_AVC}}',
        Atmos: '{{SHOW_ATMOS}}', 'DTS:X': '{{SHOW_DTS_X}}', TrueHD: '{{SHOW_TRUEHD}}',
        'DTS-HD MA': '{{SHOW_DTS_HD_MA}}', DTS: '{{SHOW_DTS}}', 'DD+': '{{SHOW_DD_PLUS}}',
        DD: '{{SHOW_DD}}', FLAC: '{{SHOW_FLAC}}', AAC: '{{SHOW_AAC}}'
    };
    const enabledBadges = new Set(ALL_BADGES.filter(label => badgeVars[label] !== 'false' && badgeVars[label] !== '0'));
    const cache = new Map();
    const ancestryCache = new Map();
    const cardState = new WeakMap();
    const observedBoxes = new WeakSet();
    let viewsRequest = null;
    let settingsUser = null;
    let settings = { libraries: null };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
        entries.forEach(entry => layoutQuality(entry.target.closest('.card')));
    });

    const css = `
        .${CONTAINER_CLASS}{position:absolute;top:6px;right:6px;z-index:2;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:3px;max-width:calc(100% - 12px);pointer-events:none}
        .jf-quality-badge{padding:3px 5px;border:1px solid rgba(255,255,255,.25);border-radius:4px;background:rgba(15,18,25,.78);box-shadow:0 2px 6px rgba(0,0,0,.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-size:.62rem;font-weight:800;line-height:1;white-space:nowrap;letter-spacing:.02em;pointer-events:none}
        .cardBox:has(.cardIndicators > *,.cardSelectionButton) .${CONTAINER_CLASS}{top:34px}
        @media(max-width:600px){.${CONTAINER_CLASS}{top:4px;right:4px;gap:2px;max-width:calc(100% - 8px)}.jf-quality-badge{padding:2px 4px;font-size:.55rem}.cardBox:has(.cardIndicators > *,.cardSelectionButton) .${CONTAINER_CLASS}{top:30px}}
        .jf-quality-settings-button{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:36px;padding:6px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer;font-size:20px}
        .jf-quality-settings-button:hover,.jf-quality-settings-button:focus-visible{background:rgba(255,255,255,.14)}
        #${SETTINGS_ID}{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.65);font-family:inherit;color:#fff}
        .jf-quality-panel{width:min(520px,100%);max-height:min(85vh,760px);overflow:auto;padding:20px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:#202127;box-shadow:0 16px 48px rgba(0,0,0,.6)}
        .jf-quality-panel h2{margin:0 0 8px;font-size:1.3rem}.jf-quality-panel p{margin:0 0 16px;color:#c9c9c9;font-size:.85rem}
        .jf-quality-panel fieldset{margin:0 0 14px;padding:10px 12px;border:1px solid rgba(255,255,255,.2);border-radius:8px}
        .jf-quality-panel legend{padding:0 4px;font-weight:700}.jf-quality-options{display:flex;flex-wrap:wrap;gap:8px 16px}
        .jf-quality-option{display:inline-flex;align-items:center;gap:6px;min-height:30px;cursor:pointer}.jf-quality-option input{accent-color:#00a4dc}
        .jf-quality-actions{display:flex;justify-content:flex-end;gap:8px}.jf-quality-actions button{padding:8px 14px;border:0;border-radius:6px;cursor:pointer;color:#fff;background:#555}.jf-quality-actions button[type=submit]{background:#006fab}
    `;

    const ensureStyles = () => {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = css;
        document.head.appendChild(style);
    };

    const currentUser = () => typeof ApiClient === 'undefined' ? null : ApiClient.getCurrentUserId();

    const loadSettings = userId => {
        if (settingsUser === userId) return;
        settingsUser = userId;
        viewsRequest = null;
        ancestryCache.clear();
        settings = { libraries: null };
        try {
            const saved = JSON.parse(localStorage.getItem(`jf-quality-settings:${userId}`));
            if (saved && typeof saved === 'object') {
                if (Array.isArray(saved.libraries)) settings.libraries = saved.libraries.filter(id => typeof id === 'string');
            }
        } catch { /* Storage may be unavailable or contain invalid data. */ }
    };

    const getViews = userId => {
        if (!viewsRequest) {
            viewsRequest = ApiClient.getJSON(ApiClient.getUrl(`Users/${encodeURIComponent(userId)}/Views`, { IncludeExternalContent: false }))
                .then(result => {
                    if (!Array.isArray(result?.Items)) throw new Error('Views unavailable');
                    return result.Items.filter(view => view.Id && view.Name);
                })
                .catch(error => { viewsRequest = null; throw error; });
        }
        return viewsRequest;
    };

    const getLibraryId = async (card, item, userId) => {
        const views = await getViews(userId);
        const ids = new Set(views.map(view => view.Id));
        const pageId = new URLSearchParams(location.hash.split('?')[1] || '').get('topParentId');
        if (card.closest('.libraryPage') && ids.has(pageId)) return pageId;
        if (ids.has(item.parentId)) return item.parentId;
        if (!item.parentId) return null;
        const key = `${userId}:${item.parentId}`;
        if (!ancestryCache.has(key)) {
            const request = ApiClient.getJSON(ApiClient.getUrl(`Items/${encodeURIComponent(item.parentId)}/Ancestors`, { UserId: userId }))
                .then(ancestors => [item.parentId, ...(Array.isArray(ancestors) ? ancestors.map(a => a.Id) : [])].find(id => ids.has(id)) || null)
                .catch(error => { ancestryCache.delete(key); throw error; });
            ancestryCache.set(key, request);
        }
        return ancestryCache.get(key);
    };

    const resetCards = () => document.querySelectorAll('.card').forEach(card => {
        cardState.delete(card);
        card.querySelector(`.${CONTAINER_CLASS}`)?.remove();
        card.removeAttribute('data-jf-quality-id');
        processCard(card);
    });

    const option = (name, value, checked) => {
        const label = document.createElement('label');
        label.className = 'jf-quality-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.value = value;
        input.checked = checked;
        label.append(input, document.createTextNode(value));
        return label;
    };

    const openSettings = async () => {
        if (document.getElementById(SETTINGS_ID)) return;
        const userId = currentUser();
        if (!userId) return;
        loadSettings(userId);
        const overlay = document.createElement('div');
        overlay.id = SETTINGS_ID;
        const form = document.createElement('form');
        form.className = 'jf-quality-panel';
        form.setAttribute('role', 'dialog');
        form.setAttribute('aria-modal', 'true');
        form.setAttribute('aria-label', 'Quality Badges settings');
        const heading = document.createElement('h2');
        heading.textContent = 'Quality Badges';
        const hint = document.createElement('p');
        hint.textContent = 'Оберіть медіатеки. Вибір зберігається для цього користувача у поточному браузері. Позначки налаштовуються в JellyFrame → Моди → Quality Badges → ⚙.';
        const librariesField = document.createElement('fieldset');
        const librariesLegend = document.createElement('legend');
        librariesLegend.textContent = 'Медіатеки';
        librariesField.append(librariesLegend);
        const loading = document.createElement('p');
        loading.textContent = 'Завантаження медіатек…';
        librariesField.append(loading);
        form.append(heading, hint, librariesField);
        const actions = document.createElement('div');
        actions.className = 'jf-quality-actions';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Скасувати';
        cancel.addEventListener('click', () => overlay.remove());
        const save = document.createElement('button');
        save.type = 'submit';
        save.textContent = 'Зберегти';
        actions.append(cancel, save);
        form.append(actions);
        overlay.append(form);
        overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
        overlay.addEventListener('keydown', event => { if (event.key === 'Escape') overlay.remove(); });
        document.body.append(overlay);
        cancel.focus();

        let views = null;
        try {
            views = await getViews(userId);
            if (!overlay.isConnected) return;
            loading.remove();
            const options = document.createElement('div');
            options.className = 'jf-quality-options';
            if (!views.length) {
                loading.textContent = 'Доступних медіатек немає.';
                librariesField.append(loading);
            } else {
                const all = option('all-libraries', 'Усі медіатеки', settings.libraries === null);
                options.append(all);
                const entries = document.createElement('div');
                entries.className = 'jf-quality-options';
                entries.style.width = '100%';
                views.forEach(view => {
                    const entry = option('library', view.Name, settings.libraries === null || settings.libraries.includes(view.Id));
                    entry.querySelector('input').value = view.Id;
                    entries.append(entry);
                });
                all.querySelector('input').addEventListener('change', event => {
                    entries.querySelectorAll('input').forEach(input => { input.checked = event.target.checked; });
                });
                entries.addEventListener('change', () => {
                    all.querySelector('input').checked = [...entries.querySelectorAll('input')].every(input => input.checked);
                });
                options.append(entries);
                librariesField.append(options);
            }
        } catch {
            loading.textContent = 'Не вдалося завантажити медіатеки. Відкрийте налаштування повторно.';
            save.disabled = true;
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!views || currentUser() !== userId) return;
            const selectedLibraries = [...form.querySelectorAll('input[name="library"]:checked')].map(input => input.value);
            const next = {
                libraries: selectedLibraries.length === views.length ? null : selectedLibraries
            };
            try { localStorage.setItem(`jf-quality-settings:${userId}`, JSON.stringify(next)); }
            catch {
                hint.textContent = 'Не вдалося зберегти налаштування у цьому браузері.';
                return;
            }
            settings = next;
            overlay.remove();
            resetCards();
        });
    };

    const ensureSettingsButton = () => {
        const viewButton = document.querySelector('svg[data-testid="ViewModuleIcon"]')?.closest('button')
            || document.querySelector('button[title="Налаштування перегляду"],button[title="View settings"]');
        const toolbar = viewButton?.closest('.MuiToolbar-root');
        const target = viewButton?.parentElement?.parentElement || toolbar;
        if (!target || target.querySelector('.jf-quality-settings-button')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'jf-quality-settings-button';
        button.title = 'Quality Badges: налаштування';
        button.setAttribute('aria-label', button.title);
        button.textContent = '⚙';
        button.addEventListener('click', openSettings);
        target.append(button);
    };

    const layoutQuality = card => {
        if (!card) return;
        const cardBox = card.querySelector('.cardBox');
        const container = cardBox?.querySelector(`.${CONTAINER_CLASS}`);
        if (!container) return;

        container.style.left = '';
        container.style.top = '';
        const overlays = [...card.querySelectorAll('.jf-unified-badge-container, .jf-badge-new')]
            .filter(element => element.getBoundingClientRect().width > 0);
        if (!overlays.length) return;

        const boxRect = cardBox.getBoundingClientRect();
        const reserved = Math.ceil(Math.max(...overlays.map(element => element.getBoundingClientRect().right)) - boxRect.left + 6);
        const widestBadge = Math.max(...[...container.children].map(badge => badge.getBoundingClientRect().width));
        if (boxRect.width - reserved - 6 >= widestBadge) container.style.left = `${reserved}px`;
        else container.style.top = `${Math.ceil(Math.max(...overlays.map(element => element.getBoundingClientRect().bottom)) - boxRect.top + 6)}px`;

        if (resizeObserver) {
            for (const overlay of overlays) {
                if (!observedBoxes.has(overlay)) {
                    resizeObserver.observe(overlay);
                    observedBoxes.add(overlay);
                }
            }
        }
    };

    const resolution = ({ Width: width, Height: height }) => {
        if (!(width > 0 && height > 0)) return null;
        if (width >= 3800 && height >= 1600) return '4K';
        if (width >= 1800 && height >= 800) return '1080p';
        if (width >= 1200 && height >= 600) return '720p';
        return 'SD';
    };

    const dynamicRange = stream => {
        const rangeTypes = ['Unknown', 'SDR', 'HDR10', 'HLG', 'DOVI', 'DOVIWithHDR10', 'DOVIWithHLG', 'DOVIWithSDR', 'DOVIWithEL', 'DOVIWithHDR10Plus', 'DOVIWithELHDR10Plus', 'DOVIInvalid', 'HDR10Plus'];
        const type = String(typeof stream.VideoRangeType === 'number' ? rangeTypes[stream.VideoRangeType] || '' : stream.VideoRangeType || '').toUpperCase();
        const title = String(stream.VideoDoViTitle || '').toUpperCase();
        const badges = [];
        const dv = type.includes('DOVI') || stream.RpuPresentFlag === 1 || stream.RpuPresentFlag === true || !!stream.VideoDoViTitle;
        if (dv) badges.push('DV');
        if (type.includes('HDR10PLUS') || stream.Hdr10PlusPresentFlag === true || stream.Hdr10PlusPresentFlag === 1) badges.push('HDR10+');
        else if (type.includes('HDR10') || (dv && title.includes('HDR10'))) badges.push('HDR10');
        if (type.includes('HLG') && !badges.includes('HDR10') && !badges.includes('HDR10+')) badges.push('HLG');
        return badges;
    };

    const videoCodec = stream => ({ hevc: 'HEVC', h265: 'HEVC', av1: 'AV1', h264: 'AVC', avc: 'AVC' })[String(stream.Codec || '').toLowerCase()] || null;

    const audioFormat = stream => {
        const codec = String(stream.Codec || '').toLowerCase();
        const details = `${stream.Profile || ''} ${stream.Title || ''} ${stream.DisplayTitle || ''} ${stream.AudioSpatialFormat || ''}`.toLowerCase();
        if (stream.AudioSpatialFormat === 1 || /atmos/.test(details)) return 'Atmos';
        if (stream.AudioSpatialFormat === 2 || /dts[- :]*x/.test(details)) return 'DTS:X';
        if (codec === 'truehd') return 'TrueHD';
        if (codec === 'dts' && /master audio|dts[- ]?hd ma/.test(details)) return 'DTS-HD MA';
        if (codec === 'dts') return 'DTS';
        return ({ eac3: 'DD+', ac3: 'DD', flac: 'FLAC', aac: 'AAC' })[codec] || null;
    };

    const audioPriority = ['Atmos', 'DTS:X', 'TrueHD', 'DTS-HD MA', 'DTS', 'DD+', 'DD', 'FLAC', 'AAC'];

    const getBadges = item => {
        const sources = Array.isArray(item.MediaSources) ? item.MediaSources : [];
        const streams = sources.flatMap(source => Array.isArray(source.MediaStreams) ? source.MediaStreams : []);
        if (!streams.length && Array.isArray(item.MediaStreams)) streams.push(...item.MediaStreams);
        if (!streams.length) return null;

        const videos = streams.filter(stream => stream.Type === 'Video' || stream.Type === 1);
        const video = videos.sort((a, b) => (b.Width || 0) * (b.Height || 0) - (a.Width || 0) * (a.Height || 0))[0];
        if (!video) return null;

        const audio = streams.filter(stream => stream.Type === 'Audio' || stream.Type === 0)
            .map(audioFormat).filter(Boolean).sort((a, b) => audioPriority.indexOf(a) - audioPriority.indexOf(b))[0];
        return [resolution(video), ...dynamicRange(video), videoCodec(video), audio].filter(Boolean);
    };

    const fetchBadges = (userId, itemId) => {
        const key = `${userId}:${itemId}`;
        if (!cache.has(key)) {
            const request = ApiClient.getJSON(ApiClient.getUrl(`Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}`, { Fields: 'MediaSources,MediaStreams' }))
                .then(item => {
                    const badges = item && getBadges(item);
                    if (!badges) throw new Error('Media metadata unavailable');
                    return { badges, parentId: item.ParentId || null };
                })
                .catch(error => { cache.delete(key); throw error; });
            cache.set(key, request);
        }
        return cache.get(key);
    };

    const processCard = async card => {
        const itemId = card.getAttribute('data-id');
        const type = card.getAttribute('data-type');
        const cardBox = card.querySelector('.cardBox');
        const old = card.querySelector(`.${CONTAINER_CLASS}`);
        if (!itemId || (type !== 'Movie' && type !== 'Episode') || !cardBox) {
            old?.remove();
            cardState.delete(card);
            card.removeAttribute('data-jf-quality-id');
            return;
        }
        const userId = currentUser();
        if (userId) loadSettings(userId);
        const previous = cardState.get(card);
        if (previous?.id === itemId && previous.userId === userId && previous.box === cardBox && (previous.pending || previous.empty || old?.parentElement === cardBox)) return;
        old?.remove();
        const current = { id: itemId, userId, box: cardBox, pending: true, empty: false };
        cardState.set(card, current);
        card.setAttribute('data-jf-quality-id', itemId);

        try {
            if (!userId) throw new Error('User unavailable');
            if (settings.libraries?.length === 0 || enabledBadges.size === 0) {
                current.pending = false;
                current.empty = true;
                return;
            }
            const pageId = card.closest('.libraryPage') && new URLSearchParams(location.hash.split('?')[1] || '').get('topParentId');
            if (pageId && settings.libraries !== null && !settings.libraries.includes(pageId)) {
                current.pending = false;
                current.empty = true;
                return;
            }
            const item = await fetchBadges(userId, itemId);
            if (settings.libraries !== null) {
                const libraryId = await getLibraryId(card, item, userId);
                if (!settings.libraries.includes(libraryId)) {
                    current.pending = false;
                    current.empty = true;
                    return;
                }
            }
            const badges = item.badges.filter(label => enabledBadges.has(label));
            if (cardState.get(card) !== current || currentUser() !== userId || card.getAttribute('data-id') !== itemId || card.getAttribute('data-type') !== type || card.querySelector('.cardBox') !== cardBox) return;
            current.pending = false;
            current.empty = !badges.length;
            if (!badges.length) return;
            const container = document.createElement('div');
            container.className = CONTAINER_CLASS;
            container.setAttribute('aria-hidden', 'true');
            for (const label of badges) {
                const badge = document.createElement('span');
                badge.className = 'jf-quality-badge';
                badge.textContent = label;
                container.appendChild(badge);
            }
            if (getComputedStyle(cardBox).position === 'static') cardBox.style.position = 'relative';
            cardBox.appendChild(container);
            if (resizeObserver && !observedBoxes.has(cardBox)) {
                resizeObserver.observe(cardBox);
                observedBoxes.add(cardBox);
            }
            layoutQuality(card);
        } catch {
            if (cardState.get(card) === current) {
                cardState.delete(card);
                card.removeAttribute('data-jf-quality-id');
            }
        }
    };

    const scan = (node, changedCards) => {
        if (node.nodeType !== 1) return;
        if (node.matches('.card')) {
            processCard(node);
            changedCards.add(node);
        }
        else {
            const card = node.closest('.card');
            if (card) {
                processCard(card);
                changedCards.add(card);
            }
            node.querySelectorAll('.card').forEach(card => {
                processCard(card);
                changedCards.add(card);
            });
        }
    };

    const init = () => {
        ensureStyles();
        const observer = new MutationObserver(mutations => {
            const changedCards = new Set();
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                    if (mutation.target.matches('.card')) {
                        processCard(mutation.target);
                        changedCards.add(mutation.target);
                    }
                }
                else {
                    mutation.addedNodes.forEach(node => scan(node, changedCards));
                    const card = mutation.target.closest('.card');
                    if (card) changedCards.add(card);
                }
            }
            changedCards.forEach(layoutQuality);
            ensureSettingsButton();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-id', 'data-type'] });
        document.querySelectorAll('.card').forEach(processCard);
        ensureSettingsButton();
        window.addEventListener('resize', () => document.querySelectorAll('.card').forEach(layoutQuality));
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
