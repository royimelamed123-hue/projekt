
        function saveToStorage() {
            storageSaveAsync('otzarya_habits', habits);
            // תיקון 4: לא מנקה את כל המטמון — רק מרנדר מחדש את מה שצריך
            renderHabits();
            if(selectedHabitIdForView) {
                renderFullMonthGrid();
                renderMonthNotesList();
            }
        }

        // גרסה של saveToStorage שמנקה את המטמון של הרגל ספציפי בלבד
        function saveToStorageForHabit(habitId) {
            invalidateStatsCache(habitId);
            storageSaveAsync('otzarya_habits', habits);
            renderHabits();
            if(selectedHabitIdForView) {
                renderFullMonthGrid();
                renderMonthNotesList();
            }
        }

        // ---- ייצוא / ייבוא / גיבוי אוטומטי ----
        const BACKUP_CONFIG_KEY = 'otzarya_backup_config';
        let _backupConfigCache = null; // cache בזיכרון

        async function loadBackupConfig() {
            if (_backupConfigCache) return _backupConfigCache;
            try {
                const parsed = await storageGet(BACKUP_CONFIG_KEY);
                _backupConfigCache = parsed || { autoEnabled: false, autoFreq: 'week', lastAutoBackup: null };
                return _backupConfigCache;
            } catch(e) {
                return { autoEnabled: false, autoFreq: 'week', lastAutoBackup: null };
            }
        }

        function saveBackupConfig(config) {
            _backupConfigCache = config;
            storageSaveAsync(BACKUP_CONFIG_KEY, config);
        }

        // ---- ייצוא (הורדת קובץ) ----
        async function exportHabitsData() {
            try {
                const dateStr = new Date().toISOString().slice(0, 10);
                const dataStr = JSON.stringify({ habits: habits, exportedAt: new Date().toISOString() }, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `גיבוי-מעקב-הרגלים-${dateStr}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // עדכון תאריך גיבוי אחרון
                const config = await loadBackupConfig();
                config.lastAutoBackup = new Date().toISOString();
                saveBackupConfig(config);

                return true;
            } catch(e) {
                alert('שגיאה בייצוא הגיבוי: ' + e.message);
                return false;
            }
        }

        // ---- ייבוא (קריאת קובץ) ----
        function importHabitsData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parsed = JSON.parse(e.target.result);
                    const importedHabits = Array.isArray(parsed) ? parsed : parsed.habits;

                    if (!Array.isArray(importedHabits)) {
                        alert('קובץ לא תקין - לא נמצאו הרגלים בקובץ.');
                        return;
                    }

                    const choice = confirm(
                        `נמצאו ${importedHabits.length} הרגלים בקובץ הגיבוי.\n` +
                        `לחץ "אישור" כדי להוסיף אותם להרגלים הקיימים (${habits.length}).\n` +
                        `לחץ "ביטול" כדי לבטל את הייבוא.`
                    );

                    if (!choice) { event.target.value = ''; return; }

                    importedHabits.forEach(h => {
                        h.id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8);
                        migrateHabitToAllowedSkips(h);
                        habits.push(h);
                    });

                    invalidateAllStatsCache();
                    saveToStorage();
                    closeBackupModal();
                    alert(`יובאו בהצלחה ${importedHabits.length} הרגלים.`);
                } catch(err) {
                    alert('שגיאה בקריאת קובץ הגיבוי: ' + err.message);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        }

        // ---- גיבוי אוטומטי ----
        async function checkAutoBackup() {
            const config = await loadBackupConfig();
            if (!config.autoEnabled) return;

            const now = new Date();
            const last = config.lastAutoBackup ? new Date(config.lastAutoBackup) : null;

            let shouldBackup = false;
            if (!last) {
                shouldBackup = true;
            } else {
                const diffMs = now - last;
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                if (config.autoFreq === 'day' && diffDays >= 1) shouldBackup = true;
                if (config.autoFreq === 'week' && diffDays >= 7) shouldBackup = true;
                if (config.autoFreq === 'month' && diffDays >= 30) shouldBackup = true;
            }

            if (shouldBackup) {
                exportHabitsData();
            }
        }

        // ---- מודל ייבוא/ייצוא ----
        async function openBackupModal() {
            let modal = document.getElementById('backupModal');
            if (modal) { modal.remove(); }

            const config = await loadBackupConfig();
            const last = config.lastAutoBackup
                ? new Date(config.lastAutoBackup).toLocaleDateString('he-IL')
                : 'מעולם לא';

            const freqOptions = [
                { value: 'day', label: 'כל יום' },
                { value: 'week', label: 'כל שבוע' },
                { value: 'month', label: 'כל חודש' },
            ].map(o => `<option value="${o.value}" ${config.autoFreq === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');

            modal = document.createElement('div');
            modal.id = 'backupModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-card" style="max-width: 440px;">
                    <h4>ייבוא / ייצוא גיבוי</h4>

                    <div style="display:flex; flex-direction:column; gap:8px;">

                        <div style="padding:12px 14px; background:var(--input-background-color,#f8fafc); border:1px solid var(--divider-color,#e2e8f0); border-radius:10px;">
                            <div style="font-size:13px; font-weight:700; color:var(--text-color,#0f172a); margin-bottom:4px;">ייצוא גיבוי עכשיו</div>
                            <div style="font-size:12px; color:#64748b; margin-bottom:10px;">מוריד קובץ JSON עם כל ההרגלים וההיסטוריה שלהם.</div>
                            <button class="btn-modal-save" style="width:100%;" onclick="exportHabitsData(); closeBackupModal();">הורד גיבוי</button>
                        </div>

                        <div style="padding:12px 14px; background:var(--input-background-color,#f8fafc); border:1px solid var(--divider-color,#e2e8f0); border-radius:10px;">
                            <div style="font-size:13px; font-weight:700; color:var(--text-color,#0f172a); margin-bottom:4px;">ייבוא מקובץ גיבוי</div>
                            <div style="font-size:12px; color:#64748b; margin-bottom:10px;">מוסיף הרגלים מקובץ JSON שמורד בעבר.</div>
                            <button class="btn-modal-save" style="width:100%; background:#475569;" onclick="document.getElementById('importFileInputModal').click();">בחר קובץ לייבוא</button>
                            <input type="file" id="importFileInputModal" accept="application/json" style="display:none;" onchange="importHabitsData(event)">
                        </div>

                        <div style="padding:12px 14px; background:var(--input-background-color,#f8fafc); border:1px solid var(--divider-color,#e2e8f0); border-radius:10px;">
                            <div style="font-size:13px; font-weight:700; color:var(--text-color,#0f172a); margin-bottom:4px;">גיבוי אוטומטי</div>
                            <div style="font-size:12px; color:#64748b; margin-bottom:8px;">מוריד גיבוי אוטומטית בפתיחת האפליקציה לפי התדירות שתבחר. גיבוי אחרון: <strong>${last}</strong></div>
                            <label class="access-lock-toggle-row" style="margin-bottom:8px;">
                                <input type="checkbox" id="autoBackupEnabled" ${config.autoEnabled ? 'checked' : ''}>
                                <span>הפעל גיבוי אוטומטי</span>
                            </label>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <label style="font-size:12px; font-weight:600; color:#475569; white-space:nowrap;">תדירות:</label>
                                <select id="autoBackupFreq" style="flex:1; font-family:inherit; font-size:13px; padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; background:var(--input-background-color,#fff); color:var(--text-color,#1e293b);">
                                    ${freqOptions}
                                </select>
                            </div>
                        </div>

                    </div>

                    <div class="modal-actions">
                        <button class="btn-modal-cancel" onclick="closeBackupModal()">סגור</button>
                        <button class="btn-modal-save" onclick="saveBackupSettings()">שמור הגדרות</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            modal.style.display = 'flex';
        }

        function closeBackupModal() {
            const modal = document.getElementById('backupModal');
            if (modal) modal.style.display = 'none';
        }

        async function saveBackupSettings() {
            const enabled = document.getElementById('autoBackupEnabled')?.checked ?? false;
            const freq = document.getElementById('autoBackupFreq')?.value ?? 'week';
            const config = await loadBackupConfig();
            config.autoEnabled = enabled;
            config.autoFreq = freq;
            saveBackupConfig(config);
            closeBackupModal();
        }
        // ---- סיום ייצוא / ייבוא / גיבוי אוטומטי ----