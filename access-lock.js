
        async function loadAccessLockConfig() {
            try {
                const parsed = await storageGet(ACCESS_LOCK_STORAGE_KEY);
                if (!parsed) return getDefaultAccessLockConfig();
                const validModes = ['onStart', 'always', 'none'];
                return {
                    enabled: !!parsed.enabled && typeof parsed.passwordHash === 'string' && parsed.passwordHash.length > 0,
                    passwordHash: typeof parsed.passwordHash === 'string' ? parsed.passwordHash : '',
                    lockMode: validModes.includes(parsed.lockMode) ? parsed.lockMode : 'onStart'
                };
            } catch (e) {
                return getDefaultAccessLockConfig();
            }
        }

        function saveAccessLockConfig() {
            storageSaveAsync(ACCESS_LOCK_STORAGE_KEY, {
                enabled: !!accessLockConfig.enabled,
                passwordHash: accessLockConfig.passwordHash || '',
                lockMode: accessLockConfig.lockMode || 'onStart'
            });
        }

        function isAccessLockEnabled() {
            return !!(accessLockConfig.enabled && accessLockConfig.passwordHash);
        }

        // נעילה תופעל לאחר טעינת config אסינכרונית ב-initializeApp

        function getAccessLockOverlay() {
            return document.getElementById('accessLockOverlay');
        }

        function getAccessLockModal() {
            return document.getElementById('accessLockModal');
        }

        function getAccessLockMessageEl() {
            return document.getElementById('accessLockMessage');
        }

        function getAccessLockSettingsMessageEl() {
            return document.getElementById('accessLockSettingsMessage');
        }

        function setAccessLockMessage(text, isError = false) {
            const el = getAccessLockMessageEl();
            if (!el) return;
            el.textContent = text || '';
            el.classList.toggle('error', !!isError);
        }

        function setAccessLockSettingsMessage(text, isError = false) {
            const el = getAccessLockSettingsMessageEl();
            if (!el) return;
            el.textContent = text || '';
            el.classList.toggle('error', !!isError);
        }

        function clearAccessLockInput() {
            const input = document.getElementById('accessPasswordInput');
            if (input) input.value = '';
            setAccessLockMessage('');
        }

        async function hashPassword(password) {
            const value = String(password || '');
            if (window.crypto && crypto.subtle && window.TextEncoder) {
                const bytes = new TextEncoder().encode(value);
                const digest = await crypto.subtle.digest('SHA-256', bytes);
                return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
            }
            return btoa(unescape(encodeURIComponent(value)));
        }

        async function verifyAccessLockPassword(password) {
            if (!isAccessLockEnabled()) return false;
            return (await hashPassword(password)) === accessLockConfig.passwordHash;
        }

        function syncAccessLockVisualState() {
            const locked = isAccessLockEnabled() && !isAppUnlocked;
            document.body.classList.toggle('app-locked', locked);

            const overlay = getAccessLockOverlay();
            if (overlay) overlay.style.display = locked ? 'flex' : 'none';

            const mainScreen = document.getElementById('mainAppScreen');
            if (mainScreen) mainScreen.setAttribute('aria-hidden', locked ? 'true' : 'false');
            const monthScreen = document.getElementById('monthViewScreen');
            if (monthScreen) monthScreen.setAttribute('aria-hidden', locked ? 'true' : 'false');
        }

        function buildAccessLockUi() {
            if (accessLockUiReady || !document.body) return;

            const actionBar = document.querySelector('.action-bar');
            if (actionBar && !document.getElementById('btnAccessLockSettings')) {
                const lockBtn = document.createElement('button');
                lockBtn.className = 'btn-edit-habit-trigger';
                lockBtn.id = 'btnAccessLockSettings';
                lockBtn.title = 'הגדרות סיסמת כניסה';
                lockBtn.textContent = 'הגדרות סיסמת כניסה';
                lockBtn.addEventListener('click', openAccessLockModal);
                actionBar.appendChild(lockBtn);
            }

            if (!document.getElementById('accessLockOverlay')) {
                const overlay = document.createElement('div');
                overlay.id = 'accessLockOverlay';
                overlay.className = 'access-lock-overlay';
                overlay.innerHTML = `
                    <div class="access-lock-card">
                        <div class="access-lock-badge">סיסמת כניסה</div>
                        <h2>הזן סיסמה כדי להיכנס</h2>
                        <p class="access-lock-text">אם לא הגדרת סיסמה, התוסף ייפתח כרגיל. אפשר להגדיר סיסמת כניסה בהגדרות.</p>
                        <input type="password" id="accessPasswordInput" class="access-lock-input" placeholder="הקלד סיסמה" autocomplete="current-password">
                        <div id="accessLockMessage" class="access-lock-message"></div>
                        <div class="access-lock-actions">
                            <button class="btn-modal-save" type="button" id="btnAccessUnlock">כניסה</button>
                            <button class="btn-modal-cancel" type="button" id="btnAccessLockClear">ניקוי</button>
                        </div>
                    </div>
                `;
                document.body.insertBefore(overlay, document.body.firstChild);
            }

            if (!document.getElementById('accessLockModal')) {
                const modal = document.createElement('div');
                modal.id = 'accessLockModal';
                modal.className = 'modal-overlay';
                modal.innerHTML = `
                    <div class="modal-card" style="max-width: 520px;">
                        <h4>הגדרות סיסמת כניסה</h4>
                        <div class="access-lock-note">
                            אפשר להפעיל סיסמה בכניסה כדי שלא כל מי שפותח את המחשב יראה את התוסף מיד.
                            אם משאירים את סיסמת הכניסה כבויה, אין מסך סיסמה בפתיחה.
                        </div>
                        <label class="access-lock-toggle-row">
                            <input type="checkbox" id="accessLockEnabledCheckbox">
                            <span>הפעלת סיסמת כניסה</span>
                        </label>
                        <div id="accessLockModeSection">
                            <div class="modal-section-title" style="margin-bottom: 6px;">מתי לנעול את התוסף:</div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label class="access-lock-toggle-row" style="cursor: pointer;">
                                    <input type="radio" name="lockMode" id="lockModeOnStart" value="onStart" style="accent-color: #2563eb; width: 15px; height: 15px; flex-shrink: 0;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 13px;">נעילה בפתיחה בלבד</div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 1px;">יבקש סיסמה רק כשפותחים את אוצריא מחדש</div>
                                    </div>
                                </label>
                                <label class="access-lock-toggle-row" style="cursor: pointer;">
                                    <input type="radio" name="lockMode" id="lockModeAlways" value="always" style="accent-color: #2563eb; width: 15px; height: 15px; flex-shrink: 0;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 13px;">נעילה בכל מעבר</div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 1px;">יבקש סיסמה גם בכל מעבר לטאב אחר או תוסף אחר</div>
                                    </div>
                                </label>
                                <label class="access-lock-toggle-row" style="cursor: pointer;">
                                    <input type="radio" name="lockMode" id="lockModeNone" value="none" style="accent-color: #2563eb; width: 15px; height: 15px; flex-shrink: 0;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 13px;">ללא נעילה אוטומטית</div>
                                        <div style="font-size: 11px; color: #64748b; margin-top: 1px;">הסיסמה קיימת אך התוסף לא ינעל אוטומטית</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div id="accessLockCurrentPasswordRow">
                            <div class="modal-section-title">סיסמה נוכחית:</div>
                            <input type="password" id="accessLockCurrentPasswordInput" class="modal-text-input" placeholder="הקלד סיסמה נוכחית" autocomplete="current-password">
                        </div>
                        <div>
                            <div class="modal-section-title">סיסמה חדשה:</div>
                            <input type="password" id="accessLockNewPasswordInput" class="modal-text-input" placeholder="הקלד סיסמה חדשה" autocomplete="new-password">
                        </div>
                        <div>
                            <div class="modal-section-title">אימות סיסמה חדשה:</div>
                            <input type="password" id="accessLockConfirmPasswordInput" class="modal-text-input" placeholder="הקלד שוב את הסיסמה" autocomplete="new-password">
                        </div>
                        <div class="access-lock-note" style="margin-top: 2px;">
                            כדי להשאיר את הסיסמה הקיימת, אפשר לסמן שסיסמת הכניסה פעילה ולהשאיר את השדות החדשים ריקים.
                        </div>
                        <div id="accessLockSettingsMessage" class="access-lock-message"></div>
                        <div class="modal-actions">
                            <button class="btn-modal-cancel" type="button" id="btnAccessLockClose">ביטול</button>
                            <button class="btn-modal-save" type="button" id="btnAccessLockSave">שמירה</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const unlockBtn = document.getElementById('btnAccessUnlock');
            if (unlockBtn) unlockBtn.onclick = unlockApp;
            const clearBtn = document.getElementById('btnAccessLockClear');
            if (clearBtn) clearBtn.onclick = clearAccessLockInput;
            const closeBtn = document.getElementById('btnAccessLockClose');
            if (closeBtn) closeBtn.onclick = closeAccessLockModal;
            const saveBtn = document.getElementById('btnAccessLockSave');
            if (saveBtn) saveBtn.onclick = saveAccessLockSettings;

            const lockInput = document.getElementById('accessPasswordInput');
            if (lockInput) {
                lockInput.addEventListener('keydown', handleAccessLockKeydown);
            }

            const lockInputs = [
                'accessLockCurrentPasswordInput',
                'accessLockNewPasswordInput',
                'accessLockConfirmPasswordInput'
            ];
            lockInputs.forEach(id => {
                const input = document.getElementById(id);
                if (input) input.addEventListener('keydown', handleAccessLockSettingsKeydown);
            });

            accessLockUiReady = true;
            syncAccessLockVisualState();
        }

        function handleAccessLockKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                unlockApp();
            }
        }

        function handleAccessLockSettingsKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveAccessLockSettings();
            }
        }

        function openAccessLockModal() {
            buildAccessLockUi();
            setAccessLockSettingsMessage('');

            const modal = getAccessLockModal();
            if (!modal) return;

            const enabledCheckbox = document.getElementById('accessLockEnabledCheckbox');
            const modeSection = document.getElementById('accessLockModeSection');
            const currentPasswordRow = document.getElementById('accessLockCurrentPasswordRow');
            const currentPasswordInput = document.getElementById('accessLockCurrentPasswordInput');
            const newPasswordInput = document.getElementById('accessLockNewPasswordInput');
            const confirmPasswordInput = document.getElementById('accessLockConfirmPasswordInput');

            const isEnabled = isAccessLockEnabled();
            if (enabledCheckbox) enabledCheckbox.checked = isEnabled;

            // הצגת/הסתרת סקשן מצב הנעילה לפי מצב ה-checkbox
            if (modeSection) modeSection.style.display = isEnabled ? 'block' : 'none';

            // סנכרון ה-radio button למצב השמור
            const currentMode = accessLockConfig.lockMode || 'onStart';
            const radioEl = document.querySelector(`input[name="lockMode"][value="${currentMode}"]`);
            if (radioEl) radioEl.checked = true;

            // האזנה לשינוי checkbox — הצג/הסתר את סקשן מצב הנעילה
            if (enabledCheckbox) {
                enabledCheckbox.onchange = () => {
                    if (modeSection) modeSection.style.display = enabledCheckbox.checked ? 'block' : 'none';
                    if (currentPasswordRow) currentPasswordRow.style.display = (enabledCheckbox.checked && isAccessLockEnabled()) ? 'block' : 'none';
                };
            }

            if (currentPasswordRow) currentPasswordRow.style.display = isEnabled ? 'block' : 'none';
            if (currentPasswordInput) currentPasswordInput.value = '';
            if (newPasswordInput) newPasswordInput.value = '';
            if (confirmPasswordInput) confirmPasswordInput.value = '';

            modal.style.display = 'flex';
            if (currentPasswordInput && isEnabled) {
                setTimeout(() => currentPasswordInput.focus(), 0);
            } else if (newPasswordInput) {
                setTimeout(() => newPasswordInput.focus(), 0);
            }
        }

        function closeAccessLockModal() {
            const modal = getAccessLockModal();
            if (modal) modal.style.display = 'none';
            setAccessLockSettingsMessage('');
        }

        async function unlockApp() {
            if (!isAccessLockEnabled()) {
                isAppUnlocked = true;
                syncAccessLockVisualState();
                return;
            }

            const input = document.getElementById('accessPasswordInput');
            const password = input ? input.value : '';
            if (!password) {
                setAccessLockMessage('צריך להקליד סיסמה.', true);
                if (input) input.focus();
                return;
            }

            const isValid = await verifyAccessLockPassword(password);
            if (!isValid) {
                setAccessLockMessage('סיסמה שגויה. נסה שוב.', true);
                if (input) {
                    input.select();
                    input.focus();
                }
                return;
            }

            isAppUnlocked = true;
            setAccessLockMessage('');
            syncAccessLockVisualState();
            if (input) input.value = '';
            renderHabits();
            updateMonthNavigationDisplay();
        }

        async function saveAccessLockSettings() {
            buildAccessLockUi();

            const enabledCheckbox = document.getElementById('accessLockEnabledCheckbox');
            const currentPasswordInput = document.getElementById('accessLockCurrentPasswordInput');
            const newPasswordInput = document.getElementById('accessLockNewPasswordInput');
            const confirmPasswordInput = document.getElementById('accessLockConfirmPasswordInput');

            const enabled = !!(enabledCheckbox && enabledCheckbox.checked);
            const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
            const newPassword = newPasswordInput ? newPasswordInput.value : '';
            const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
            const hasExistingPassword = !!accessLockConfig.passwordHash;
            const hasNewPassword = !!newPassword.trim();
            const hasConfirmPassword = !!confirmPassword.trim();

            // קריאת מצב הנעילה שנבחר
            const selectedModeEl = document.querySelector('input[name="lockMode"]:checked');
            const selectedMode = selectedModeEl ? selectedModeEl.value : 'onStart';

            setAccessLockSettingsMessage('');

            if (enabled) {
                if (hasExistingPassword) {
                    if (!currentPassword.trim()) {
                        setAccessLockSettingsMessage('כדי לשנות או לכבות סיסמת כניסה קיימת, צריך להקליד את הסיסמה הנוכחית.', true);
                        if (currentPasswordInput) currentPasswordInput.focus();
                        return;
                    }
                    const validCurrent = await verifyAccessLockPassword(currentPassword);
                    if (!validCurrent) {
                        setAccessLockSettingsMessage('הסיסמה הנוכחית לא נכונה.', true);
                        if (currentPasswordInput) currentPasswordInput.focus();
                        return;
                    }
                }

                if (hasNewPassword || hasConfirmPassword || !hasExistingPassword) {
                    if (!hasNewPassword) {
                        setAccessLockSettingsMessage('כדי להפעיל סיסמת כניסה בפעם הראשונה, צריך לקבוע סיסמה חדשה.', true);
                        if (newPasswordInput) newPasswordInput.focus();
                        return;
                    }
                    if (newPassword !== confirmPassword) {
                        setAccessLockSettingsMessage('הסיסמאות החדשות לא תואמות.', true);
                        if (confirmPasswordInput) confirmPasswordInput.focus();
                        return;
                    }
                    accessLockConfig.passwordHash = await hashPassword(newPassword);
                }

                accessLockConfig.enabled = true;
                accessLockConfig.lockMode = selectedMode;
                saveAccessLockConfig();
                isAppUnlocked = true;
                closeAccessLockModal();
                syncAccessLockVisualState();
                return;
            }

            if (hasExistingPassword) {
                if (!currentPassword.trim()) {
                    setAccessLockSettingsMessage('כדי לכבות סיסמת כניסה קיימת, צריך להקליד את הסיסמה הנוכחית.', true);
                    if (currentPasswordInput) currentPasswordInput.focus();
                    return;
                }
                const validCurrent = await verifyAccessLockPassword(currentPassword);
                if (!validCurrent) {
                    setAccessLockSettingsMessage('הסיסמה הנוכחית לא נכונה.', true);
                    if (currentPasswordInput) currentPasswordInput.focus();
                    return;
                }
            }

            accessLockConfig = getDefaultAccessLockConfig();
            saveAccessLockConfig();
            isAppUnlocked = true;
            closeAccessLockModal();
            syncAccessLockVisualState();
        }

        buildAccessLockUi();
        syncAccessLockVisualState();

        // ---- נעילה אוטומטית בעת עזיבת התוסף ----
        function lockAppOnHide() {
            if (!isAccessLockEnabled()) return;
            if (accessLockConfig.lockMode !== 'always') return;
            isAppUnlocked = false;
            clearAccessLockInput();
            syncAccessLockVisualState();
        }

        // האזנה לאירוע אוצריא plugin.suspended (מופעל כשהמשתמש עוזב את התוסף)
        if (HAS_OTZARIA) {
            try { Otzaria.on('plugin.suspended', lockAppOnHide); } catch(e) {}
        }

        // fallback לדפדפן רגיל
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) lockAppOnHide();
        });
        // ---- סיום נעילה אוטומטית ----