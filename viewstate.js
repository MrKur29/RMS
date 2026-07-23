/* ============================================================================
 * RPA Management System — Shared View-State Persistence
 * File: viewstate.js
 * Include in each page with:
 *     <script src="viewstate.js"></script>
 * placed AFTER permissions.js and BEFORE the page's own inline <script> block.
 *
 * PROBLEM THIS SOLVES
 * --------------------
 * Every page in this system is a separate static HTML file. Clicking a
 * sidebar link (navTo()) is a full page navigation, not an in-app route
 * change — so when the user goes Batch Ayam Hidup -> Laporan Produksi
 * Karkas -> back to Batch Ayam Hidup, the browser reloads the page from
 * scratch and all in-memory JS state (filters, active tab, scroll position)
 * is gone. Pages then fall back to hardcoded defaults (e.g. "tanggal =
 * hari ini"), which looks like the view "reset".
 *
 * This module persists that view state in sessionStorage (survives
 * navigation within the same browser tab/session, clears when the tab is
 * closed — which is the right scope for "where was I" state, as opposed to
 * permanent user preferences).
 *
 * TYPICAL USAGE (inside a page's startApp() / after login, BEFORE the first
 * data load call):
 *
 *   const restored = RPA_STATE.bindFilters('BatchAyamHidup', ['.filter-bar']);
 *   RPA_STATE.bindScroll('BatchAyamHidup');
 *   if (!restored) {
 *     // only apply hardcoded defaults if nothing was saved from before
 *     document.getElementById('inp-filter-date').value = todayISO();
 *   }
 *   loadPage(); // whatever the page's own initial load function is called
 *
 * For pages with a tab bar, inside switchTab(tab):
 *   RPA_STATE.saveTab('Koreksi', tab);
 * and at startup, before the first switchTab() call:
 *   const savedTab = RPA_STATE.getTab('Koreksi', 'pending'); // 'pending' = default
 *   switchTab(savedTab);
 * ==========================================================================*/

const RPA_STATE = (function () {
    function storageKey(pageKey) { return 'rpa_viewstate_' + pageKey; }

    function _load(pageKey) {
        try { return JSON.parse(sessionStorage.getItem(storageKey(pageKey)) || '{}'); }
        catch (e) { return {}; }
    }
    function _save(pageKey, obj) {
        try { sessionStorage.setItem(storageKey(pageKey), JSON.stringify(obj)); }
        catch (e) { /* sessionStorage unavailable — fail silently, no persistence */ }
    }

    // ---- individual field values (filters, search boxes, dropdowns) ----
    function saveField(pageKey, field, value) {
        const s = _load(pageKey);
        s.fields = s.fields || {};
        s.fields[field] = value;
        _save(pageKey, s);
    }
    function getFields(pageKey) {
        return _load(pageKey).fields || {};
    }

    // ---- active tab (for pages using a tab-bar / switchTab pattern) ----
    function saveTab(pageKey, tab) {
        const s = _load(pageKey);
        s.tab = tab;
        _save(pageKey, s);
    }
    function getTab(pageKey, fallback) {
        const t = _load(pageKey).tab;
        return t != null ? t : (fallback || null);
    }

    // ---- scroll position of the main scrollable content area ----
    function saveScroll(pageKey, top) {
        const s = _load(pageKey);
        s.scroll = top;
        _save(pageKey, s);
    }
    function getScroll(pageKey) {
        return _load(pageKey).scroll || 0;
    }

    /**
     * Find every <input>/<select> with an `id` inside the given CSS selectors,
     * restore any previously-saved value into it, and attach a `change`
     * listener so future edits are persisted automatically.
     *
     * Returns true if at least one field was restored from a previous visit —
     * callers should use this to skip their own hardcoded "default" values,
     * so a saved filter isn't immediately clobbered.
     */
    function bindFilters(pageKey, selectors) {
        const fields = getFields(pageKey);
        let restored = false;
        const els = [];
        (selectors || []).forEach(sel => {
            document.querySelectorAll(sel + ' input[id], ' + sel + ' select[id]').forEach(el => els.push(el));
        });
        els.forEach(el => {
            if (Object.prototype.hasOwnProperty.call(fields, el.id)) {
                el.value = fields[el.id];
                restored = true;
            }
            el.addEventListener('change', () => saveField(pageKey, el.id, el.value));
        });
        return restored;
    }

    /**
     * Restore + auto-persist the scroll position of a scrollable container
     * (defaults to `.content-area`, the standard shell class used across
     * every page in this system).
     */
    function bindScroll(pageKey, containerSelector) {
        containerSelector = containerSelector || '.content-area';
        const el = document.querySelector(containerSelector);
        if (!el) return;
        const top = getScroll(pageKey);
        if (top) {
            // Wait a tick so the page's own data render has a chance to lay out first.
            requestAnimationFrame(() => { el.scrollTop = top; });
            setTimeout(() => { el.scrollTop = top; }, 250);
        }
        let t = null;
        el.addEventListener('scroll', () => {
            clearTimeout(t);
            t = setTimeout(() => saveScroll(pageKey, el.scrollTop), 200);
        });
    }

    return { saveField, getFields, saveTab, getTab, saveScroll, getScroll, bindFilters, bindScroll };
})();
