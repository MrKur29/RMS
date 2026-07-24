/* ============================================================================
 * RPA Management System — Shared Module Access Control
 * File: permissions.js
 * Include in each operational module page with:
 *     <script src="permissions.js"></script>
 * placed AFTER the Supabase CDN script tag and BEFORE the page's own
 * inline <script> block.
 *
 * Depends on: a Supabase client already created by the page (usually named
 * `db`), and a `currentUser` object with at least {id, is_system_admin}.
 *
 * Typical usage inside a page's doLogin() / session-restore code, right
 * after the `users` row has been fetched:
 *
 *   currentUser.permissions = await RPA_PERM.fetchPermissions(db, currentUser.id);
 *   const moduleRole = RPA_PERM.enforceModuleAccess(currentUser, 'karkas');
 *   if (!moduleRole) return; // access denied — already redirected to Dashboard
 *
 *   // later, to gate specific UI:
 *   if (RPA_PERM.canApprove(moduleRole)) { ... show approve button ... }
 *   if (RPA_PERM.canInput(moduleRole))   { ... enable input form ... }
 *   if (RPA_PERM.isViewOnly(moduleRole)) { ... disable inputs, hide actions ... }
 *
 * moduleRole values: 'admin' | 'supervisor' | 'operator' | 'viewer' | null
 *   - 'admin'      -> user.is_system_admin = true (full access, bypasses table)
 *   - 'supervisor' -> explicit row in user_module_permissions with role='supervisor'
 *   - 'operator'   -> explicit row with role='operator'
 *   - 'viewer'     -> explicit row with role='viewer'
 *   - null         -> no row for this module = NO ACCESS
 * ==========================================================================*/

const RPA_PERM = (function () {
    const REDIRECT_DEFAULT = 'Dashboard.html';
    const DENIED_MESSAGE = 'Anda tidak punya akses ke modul ini.';

    /**
     * Fetch this user's module permissions from Supabase and return them as
     * a plain {module: role} map. Returns {} on error (fail-closed: caller
     * should treat missing permissions as "no access", not "full access").
     */
    async function fetchPermissions(db, userId) {
        try {
            const { data, error } = await db
                .from('user_module_permissions')
                .select('module, role')
                .eq('user_id', userId);
            if (error) throw error;
            const map = {};
            (data || []).forEach(p => { map[p.module] = p.role; });
            return map;
        } catch (e) {
            console.error('[RPA_PERM] fetchPermissions error:', e);
            return {};
        }
    }

    /**
     * Returns this user's effective role for a given module key, or null if
     * they have no access at all. System admins always get 'admin'.
     */
    function getModuleRole(user, moduleKey) {
        if (!user) return null;
        if (user.is_system_admin) return 'admin';
        const perms = user.permissions || {};
        return perms[moduleKey] || null;
    }

    function hasModuleAccess(user, moduleKey) {
        return getModuleRole(user, moduleKey) !== null;
    }

    function canApprove(moduleRole) {
        return moduleRole === 'admin' || moduleRole === 'supervisor';
    }

    function canInput(moduleRole) {
        return moduleRole === 'admin' || moduleRole === 'supervisor' || moduleRole === 'operator';
    }

    function isViewOnly(moduleRole) {
        return moduleRole === 'viewer';
    }

    /**
     * Restore a logged-in session from localStorage/sessionStorage AND
     * refresh currentUser.permissions from the DB before returning it.
     *
     * Why this exists: pages used to JSON.parse the cached 'rpa_user' blob
     * on page load and trust its .permissions field as-is. That blob is a
     * snapshot taken at the moment of the last fresh login, so any
     * permission grant/revoke made via UserManagement.html while a user's
     * session was still active silently had NO effect until that user
     * explicitly logged out (clearing storage) and logged back in. This
     * function re-fetches permissions on every restore so grants apply on
     * the user's very next page load/navigation instead.
     *
     * Usage (replaces the old "JSON.parse + startApp()" restore blocks):
     *
     *   (async function () {
     *       currentUser = await RPA_PERM.restoreSession(db);
     *       if (currentUser) startApp();
     *   })();
     *
     * Returns the restored user object (with fresh .permissions), or null
     * if there was no saved session / it failed to parse.
     */
    async function restoreSession(db) {
        let saved = null;
        try { saved = sessionStorage.getItem('rpa_user') || localStorage.getItem('rpa_user'); }
        catch (e) { /* storage may be unavailable, e.g. privacy mode */ }
        if (!saved) return null;

        let user;
        try {
            user = JSON.parse(saved);
        } catch (e) {
            try { localStorage.removeItem('rpa_user'); } catch (e2) {}
            try { sessionStorage.removeItem('rpa_user'); } catch (e2) {}
            return null;
        }

        try {
            user.permissions = await fetchPermissions(db, user.id);
        } catch (e) {
            // Network hiccup etc: fall back to the cached permissions rather
            // than locking the user out entirely.
            console.error('[RPA_PERM] restoreSession: could not refresh permissions, using cached copy', e);
        }

        try {
            localStorage.setItem('rpa_user', JSON.stringify(user));
            sessionStorage.setItem('rpa_user', JSON.stringify(user));
        } catch (e) { /* ignore storage write errors */ }

        return user;
    }

    /**
     * Gate a whole page behind a module key. Call this once, after
     * currentUser (with .permissions already populated) is known and the
     * app shell has started rendering.
     *
     * If access is denied: shows a toast (if the page defines a global
     * showToast(msg, type) function) or falls back to alert(), then
     * redirects to Dashboard.html (or opts.redirectTo) after a short delay
     * so the user sees the message. Returns null — callers should stop
     * further page setup when they get null back.
     *
     * If access is granted: returns the moduleRole string immediately.
     */
    function enforceModuleAccess(user, moduleKey, opts = {}) {
        const redirectTo = opts.redirectTo || REDIRECT_DEFAULT;
        const role = getModuleRole(user, moduleKey);
        if (role !== null) return role;

        try {
            if (typeof showToast === 'function') {
                showToast(DENIED_MESSAGE, 'error');
            } else {
                alert(DENIED_MESSAGE);
            }
        } catch (e) { /* ignore UI errors, still redirect */ }

        setTimeout(() => { window.location.href = redirectTo; }, 900);
        return null;
    }

    return {
        fetchPermissions,
        getModuleRole,
        hasModuleAccess,
        canApprove,
        canInput,
        isViewOnly,
        enforceModuleAccess,
        restoreSession,
    };
})();
