
        function openHabitConfigModal(editMode = false) {
            try {
            isModalEditMode = editMode;
            
            document.getElementById('configHabitTitle').value = "";
            document.getElementById('configHabitDesc').value = "";

            if (editMode) {
                const habit = habits.find(h => h.id === selectedHabitIdForView);
                if (!habit) return;
                
                // (כותרת הוסרה מה-UI)
                document.getElementById('configHabitTitle').value = habit.title;
                document.getElementById('configHabitDesc').value = habit.description || "";
                
                configSelectedType = (habit.type === 'regular' || habit.type === 'x_times') ? 'x_times' : (habit.type || 'x_times');
                configSelectedWeekdays = habit.workdays ? [...habit.workdays] : [true, true, true, true, true, true, true];
                
                const activeDayTargets = (habit.dayTargets || []).filter((_, i) => configSelectedWeekdays[i]);
                const allSameDay = activeDayTargets.length === 0 || activeDayTargets.every(v => v === activeDayTargets[0]);
                xTimesMode = allSameDay ? 'uniform' : 'custom';
                document.getElementById('uniformTargetInput').value = activeDayTargets[0] || 1;
                for (let i = 0; i < 7; i++) {
                    document.getElementById(`targetDay-${i}`).value = (habit.dayTargets && habit.dayTargets[i]) || 1;
                }

                const activeWeeklyTargets = (habit.weeklyDayTargets || []).filter((_, i) => configSelectedWeekdays[i]);
                const allSameWeekly = activeWeeklyTargets.length === 0 || activeWeeklyTargets.every(v => v === activeWeeklyTargets[0]);
                weeklyDayMode = allSameWeekly ? 'uniform' : 'custom';
                document.getElementById('weeklyUniformTargetInput').value = activeWeeklyTargets[0] || 1;
                for (let i = 0; i < 7; i++) {
                    document.getElementById(`weeklyTargetDay-${i}`).value = (habit.weeklyDayTargets && habit.weeklyDayTargets[i]) || 1;
                }
                document.getElementById('weeklyFreqInput').value = (habit.weeklyAllowedSkips !== null && habit.weeklyAllowedSkips !== undefined) ? habit.weeklyAllowedSkips : 0;
                const activeMonthlyTargets = (habit.monthlyDayTargets || []).filter((_, i) => configSelectedWeekdays[i]);
                const allSameMonthly = activeMonthlyTargets.length === 0 || activeMonthlyTargets.every(v => v === activeMonthlyTargets[0]);
                monthlyDayMode = allSameMonthly ? 'uniform' : 'custom';
                document.getElementById('monthlyUniformTargetInput').value = activeMonthlyTargets[0] || 1;
                for (let i = 0; i < 7; i++) {
                    document.getElementById(`monthlyTargetDay-${i}`).value = (habit.monthlyDayTargets && habit.monthlyDayTargets[i]) || 1;
                }
                document.getElementById('monthlyFreqInput').value = (habit.monthlyAllowedSkips !== null && habit.monthlyAllowedSkips !== undefined) ? habit.monthlyAllowedSkips : 0;
                document.getElementById('passingScoreInput').value = habit.passingScore !== null && habit.passingScore !== undefined ? habit.passingScore : '';
                document.getElementById('minScoreInput').value = habit.minScore !== null && habit.minScore !== undefined ? habit.minScore : '';
                selectedHabitTheme = habit.theme || BOOKMARK_COLORS[0];
            } else {
                // (כותרת הוסרה מה-UI)
                configSelectedType = 'x_times';
                configSelectedWeekdays = [true, true, true, true, true, true, true];
                xTimesMode = 'uniform';
                weeklyDayMode = 'uniform';
                monthlyDayMode = 'uniform';
                document.getElementById('uniformTargetInput').value = "1";
                document.getElementById('weeklyUniformTargetInput').value = "1";
                document.getElementById('monthlyUniformTargetInput').value = "1";
                document.getElementById('weeklyFreqInput').value = "0";
                document.getElementById('monthlyFreqInput').value = "0";
                for (let i = 0; i < 7; i++) {
                    document.getElementById(`targetDay-${i}`).value = "1";
                    document.getElementById(`weeklyTargetDay-${i}`).value = "1";
                    document.getElementById(`monthlyTargetDay-${i}`).value = "1";
                }
                selectedHabitTheme = BOOKMARK_COLORS[0];
                document.getElementById('passingScoreInput').value = '';
                document.getElementById('minScoreInput').value = '';
                // טען ברירות מחדל שנשמרו ("שמור להרגלים הבאים") ומלא את השדות
                loadScoreDefaults().then(defaults => {
                    if (!defaults) return;
                    // מלא רק אם המשתמש עדיין לא שינה ידנית את השדות
                    const passingEl = document.getElementById('passingScoreInput');
                    const minEl = document.getElementById('minScoreInput');
                    if (passingEl && passingEl.value.trim() === '' && defaults.passingScore !== null && defaults.passingScore !== undefined) {
                        passingEl.value = defaults.passingScore;
                    }
                    if (minEl && minEl.value.trim() === '' && defaults.minScore !== null && defaults.minScore !== undefined) {
                        minEl.value = defaults.minScore;
                    }
                }).catch(() => {});
            }

            renderHabitColorSwatches();
            resetScoreToggleButtons();
            
            const bulkEl = document.getElementById('bulkTargetInput');
            if (bulkEl) bulkEl.value = "1";
            
            updateConfigModalUI();
            const modalEl = document.getElementById('habitConfigModal');
            if (!modalEl) {
                alert('שגיאה: אלמנט habitConfigModal לא נמצא. אנא רענן את הדף.');
                return;
            }
            modalEl.style.display = 'flex';
            modalEl.style.visibility = 'visible';
            modalEl.style.opacity = '1';
            document.getElementById('configHabitTitle').focus();
            } catch(e) { alert('Error: ' + e.message + '\nStack: ' + (e.stack||'').substring(0,200)); }
        }

        function closeHabitConfigModal() {
            document.getElementById('habitConfigModal').style.display = 'none';
        }

        const SCORE_DEFAULTS_KEY = 'otzarya_score_defaults';
        let scoreDefaultMarked = false;
        let scoreApplyAllMarked = false;

        async function loadScoreDefaults() {
            try {
                const parsed = await storageGet(SCORE_DEFAULTS_KEY);
                return parsed || { passingScore: null, minScore: null };
            } catch(e) { return { passingScore: null, minScore: null }; }
        }

        function readScoreFieldsFromUI() {
            const passingRaw = document.getElementById('passingScoreInput').value.trim();
            const minRaw = document.getElementById('minScoreInput').value.trim();
            let passingScore = (passingRaw === '' || passingRaw === '-') ? null : parseInt(passingRaw, 10);
            let minScore = (minRaw === '' || minRaw === '-') ? null : parseInt(minRaw, 10);
            if (passingScore !== null && isNaN(passingScore)) passingScore = null;
            if (minScore !== null && isNaN(minScore)) minScore = null;
            if (passingScore !== null) passingScore = Math.max(0, Math.min(100, passingScore));
            if (minScore !== null) minScore = Math.max(0, Math.min(100, minScore));
            if (passingScore !== null && minScore !== null && minScore > passingScore) minScore = passingScore;
            return { passingScore, minScore };
        }

        function resetScoreToggleButtons() {
            scoreDefaultMarked = false;
            scoreApplyAllMarked = false;
            _renderScoreToggleBtn('btnScoreDefaultToggle', false, '#2563eb', '#eff6ff', '#1d4ed8');
            _renderScoreToggleBtn('btnScoreApplyAllToggle', false, '#7c3aed', '#f5f3ff', '#6d28d9');
        }

        function _renderScoreToggleBtn(id, active, borderColor, bgOff, colorOff) {
            const btn = document.getElementById(id);
            if (!btn) return;
            const dark = document.body.classList.contains('dark-mode');
            if (active) {
                btn.style.background = borderColor;
                btn.style.color = '#ffffff';
                btn.style.borderColor = borderColor;
                btn.style.boxShadow = `0 0 0 3px ${borderColor}33`;
            } else {
                btn.style.background = dark ? '#1e293b' : bgOff;
                btn.style.color = dark ? borderColor : colorOff;
                btn.style.borderColor = borderColor;
                btn.style.boxShadow = '';
            }
        }

        function toggleScoreDefaultMark() {
            scoreDefaultMarked = !scoreDefaultMarked;
            _renderScoreToggleBtn('btnScoreDefaultToggle', scoreDefaultMarked, '#2563eb', '#eff6ff', '#1d4ed8');
        }

        function toggleScoreApplyAllMark() {
            scoreApplyAllMarked = !scoreApplyAllMarked;
            _renderScoreToggleBtn('btnScoreApplyAllToggle', scoreApplyAllMarked, '#7c3aed', '#f5f3ff', '#6d28d9');
        }

        function executeScoreExtras(passingScore, minScore) {
            if (scoreDefaultMarked) {
                storageSaveAsync(SCORE_DEFAULTS_KEY, { passingScore, minScore });
                otzShowMessage('הציונים נשמרו כברירת מחדל להרגלים הבאים.', 'success');
            }
            if (scoreApplyAllMarked) {
                const count = habits.filter(h => !h.archived).length;
                const msgParts = [];
                if (passingScore !== null) msgParts.push(`ציון קניין: ${passingScore}%`);
                if (minScore !== null) msgParts.push(`ציון הגזמה: ${minScore}%`);
                const displayStr = msgParts.length > 0 ? msgParts.join(', ') : 'ריק (ללא ציון)';
                if (confirm(`לעדכן את כל ${count} ההרגלים הקיימים עם הציונים הבאים?\n${displayStr}`)) {
                    habits.forEach(h => {
                        if (h.archived) return;
                        h.passingScore = passingScore;
                        h.minScore = minScore;
                    });
                    invalidateAllStatsCache();
                    saveToStorage();
                    otzShowMessage(`עודכנו ${count} הרגלים.`, 'success');
                }
            }
            scoreDefaultMarked = false;
            scoreApplyAllMarked = false;
        }

        let xTimesMode = 'uniform';

        const BOOKMARK_COLORS = ['#3b82f6', '#22c55e', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#eab308', '#ef4444'];
        let bookmarkLabels = {}; // יטען אסינכרונית ב-boot

        function saveBookmarkLabels() {
            storageSaveAsync('otzarya_bookmark_labels', bookmarkLabels);
        }

        function getBookmarkLabel(colorKey) {
            return bookmarkLabels[colorKey] || 'ללא שם';
        }

        let selectedHabitTheme = BOOKMARK_COLORS[0];

        function getThemeColor(themeKey) {
            return themeKey || BOOKMARK_COLORS[0];
        }

        function renderHabitColorSwatches() {
            const container = document.getElementById('habitColorSwatches');
            if (!container) return;
            container.innerHTML = BOOKMARK_COLORS.map(c => {
                const label = esc(getBookmarkLabel(c));
                const borderColor = c === selectedHabitTheme ? '#0f172a' : 'transparent';
                return `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; width: 68px;">
                    <div onclick="setHabitColor('${c}')" style="width: 26px; height: 26px; border-radius: 50%; background: ${c}; cursor:pointer; border: 3px solid ${borderColor}; box-shadow: 0 0 0 1px #e2e8f0;"></div>
                    <span onclick="renameBookmark('${c}', event)" style="font-size: 10px; color: #64748b; text-align:center; line-height:1.2; cursor:pointer; text-decoration: underline dotted; text-underline-offset: 2px;" title="לחץ כדי לשנות שם">${label}</span>
                </div>`;
            }).join('');
        }

        function setHabitColor(colorKey) {
            selectedHabitTheme = colorKey;
            renderHabitColorSwatches();
        }

        function renameBookmark(colorKey, event) {
            if (event) event.stopPropagation();
            const current = bookmarkLabels[colorKey] || '';
            const newLabel = prompt('שם לסימניה זו (יחול על כל ההרגלים שמשתמשים בצבע זה):', current);
            if (newLabel === null) return;
            const trimmed = newLabel.trim();
            if (trimmed === '') {
                delete bookmarkLabels[colorKey];
            } else {
                bookmarkLabels[colorKey] = trimmed;
            }
            saveBookmarkLabels();
            renderHabitColorSwatches();
            renderHabits();
        }

        let weeklyDayMode = 'uniform';
        let monthlyDayMode = 'uniform';

        function setXTimesMode(mode) {
            xTimesMode = mode;
            const u = document.getElementById('xTimesModeUniform'); if(u) u.classList.toggle('active', mode === 'uniform');
            const c = document.getElementById('xTimesModeCustom'); if(c) c.classList.toggle('active', mode === 'custom');
            const us = document.getElementById('xTimesUniformSection'); if(us) us.style.display = mode === 'uniform' ? 'flex' : 'none';
            const cs = document.getElementById('xTimesCustomSection'); if(cs) cs.style.display = mode === 'custom' ? 'block' : 'none';
        }

        function setWeeklyMode(mode) {
            weeklyDayMode = mode;
            const u = document.getElementById('weeklyModeUniform'); if(u) u.classList.toggle('active', mode === 'uniform');
            const c = document.getElementById('weeklyModeCustom'); if(c) c.classList.toggle('active', mode === 'custom');
            const us = document.getElementById('weeklyUniformSection'); if(us) us.style.display = mode === 'uniform' ? 'flex' : 'none';
            const cs = document.getElementById('weeklyCustomSection'); if(cs) cs.style.display = mode === 'custom' ? 'block' : 'none';
        }

        function setMonthlyMode(mode) {
            monthlyDayMode = mode;
            const u = document.getElementById('monthlyModeUniform'); if(u) u.classList.toggle('active', mode === 'uniform');
            const c = document.getElementById('monthlyModeCustom'); if(c) c.classList.toggle('active', mode === 'custom');
            const us = document.getElementById('monthlyUniformSection'); if(us) us.style.display = mode === 'uniform' ? 'flex' : 'none';
            const cs = document.getElementById('monthlyCustomSection'); if(cs) cs.style.display = mode === 'custom' ? 'block' : 'none';
        }

        function readDayTargetsFromUI() {
            const targets = [1,1,1,1,1,1,1];
            if (xTimesMode === 'uniform') {
                const val = parseInt(document.getElementById('uniformTargetInput').value, 10);
                const v = isNaN(val) || val < 1 ? 1 : val;
                return targets.map(() => v);
            } else {
                for (let i = 0; i < 7; i++) {
                    let val = parseInt(document.getElementById(`targetDay-${i}`).value, 10);
                    targets[i] = isNaN(val) || val < 1 ? 1 : val;
                }
                return targets;
            }
        }

        function readWeeklyDayTargetsFromUI() {
            const targets = [1,1,1,1,1,1,1];
            if (weeklyDayMode === 'uniform') {
                const val = parseInt(document.getElementById('weeklyUniformTargetInput').value, 10);
                const v = isNaN(val) || val < 1 ? 1 : val;
                return targets.map(() => v);
            } else {
                for (let i = 0; i < 7; i++) {
                    let val = parseInt(document.getElementById(`weeklyTargetDay-${i}`).value, 10);
                    targets[i] = isNaN(val) || val < 1 ? 1 : val;
                }
                return targets;
            }
        }

        function readMonthlyDayTargetsFromUI() {
            const targets = [1,1,1,1,1,1,1];
            if (monthlyDayMode === 'uniform') {
                const val = parseInt(document.getElementById('monthlyUniformTargetInput').value, 10);
                const v = isNaN(val) || val < 1 ? 1 : val;
                return targets.map(() => v);
            } else {
                for (let i = 0; i < 7; i++) {
                    let val = parseInt(document.getElementById(`monthlyTargetDay-${i}`).value, 10);
                    targets[i] = isNaN(val) || val < 1 ? 1 : val;
                }
                return targets;
            }
        }

        let currentMonthTab = 'calendar';

        function switchMonthTab(tab) {
            currentMonthTab = tab;
            document.getElementById('tabCalendar').classList.toggle('active', tab === 'calendar');
            document.getElementById('tabGraph').classList.toggle('active', tab === 'graph');
            const tabComp = document.getElementById('tabComparison');
            if (tabComp) tabComp.classList.toggle('active', tab === 'comparison');
            document.getElementById('calendarView').style.display = tab === 'calendar' ? 'block' : 'none';
            document.getElementById('graphView').style.display = tab === 'graph' ? 'block' : 'none';
            const compView = document.getElementById('comparisonView');
            if (compView) compView.style.display = tab === 'comparison' ? 'block' : 'none';
            if (tab === 'graph') renderMonthGraph();
            if (tab === 'comparison') renderComparisonView();
        }
