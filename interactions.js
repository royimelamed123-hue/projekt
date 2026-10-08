        // ---- חישוב ציון חודשי — גרסה 3 ----
        function calculateStatsForMonth(habit, monthKey) {
            const cacheKey = getStatsCacheKey(habit.id, monthKey);
            if (statsCache.has(cacheKey)) return statsCache.get(cacheKey);
            const result = _calculateStatsForMonthImpl(habit, monthKey);
            statsCache.set(cacheKey, result);
            return result;
        }

        // חישוב ציון שבועי לפי שיטה
        function calcWeekScore(done, fail, effective, method) {
            if (effective === 0) return null;
            if (method === 'additive') return (done / effective) * 100;
            if (method === 'subtractive') return (1 - (fail / effective)) * 100;
            // static
            const total = done + fail;
            if (total === 0) return null;
            return (done / total) * 100;
        }

        function _calculateStatsForMonthImpl(habit, monthKey) {
            const method = habit.scoreMethod || 'static';
            const firstDayDate = getGregorianStartForMonthKey(monthKey);
            const totalDaysInMonth = calculateDaysInBrowsingMonth(firstDayDate);
            const startDayOfWeek = firstDayDate.getDay();

            // ---- הרגל שבועי ----
            if (habit.type === 'weekly') {
                const monthStart = firstDayDate;
                const monthEnd = addDays(firstDayDate, totalDaysInMonth - 1);
                const today = new Date(); today.setHours(0,0,0,0);

                let sunday = getSundayOfWeek(monthStart);
                let weekScores = [];
                let weekCount = 0;

                while (sunday <= monthEnd) {
                    const weekEnd = addDays(sunday, 6);
                    weekCount++;

                    // האם השבוע הגיע? (לפחות יום אחד בשבוע עבר)
                    const weekStartedInMonth = sunday <= today;
                    const weekHasAnyDayInMonth = weekEnd >= monthStart;

                    if (!weekHasAnyDayInMonth) { sunday = addDays(sunday, 7); continue; }

                    if (!weekStartedInMonth) {
                        // שבוע עתידי — לפי שיטה
                        if (method === 'additive') weekScores.push(0);
                        else if (method === 'subtractive') weekScores.push(100);
                        // static: לא נכנס
                        sunday = addDays(sunday, 7);
                        continue;
                    }

                    // חישוב ציון השבוע
                    let done = 0, fail = 0, effective = 0;
                    for (let dow = 0; dow < 7; dow++) {
                        const dG = addDays(sunday, dow);
                        const status = getHabitStatusForGregorianDate(habit, dG);
                        const isAuto = (status === 'N_auto' || status === 'א');
                        if (isAuto) continue; // אונס — לא נספר
                        if (status === '' || status === undefined) continue; // ריק — לא נספר
                        const dayTarget = (habit.weeklyDayTargets && habit.weeklyDayTargets[dow]) || 1;
                        effective++;
                        if (status === 'W') { done += 1; }
                        else if (typeof status === 'number') {
                            const frac = Math.min(status / dayTarget, 1);
                            done += frac; fail += (1 - frac);
                            effective--; // כבר ספרנו, נתאים
                            effective += 1; // נשאיר 1 ליום
                        }
                        else if (status === 'N') { fail += 1; }
                    }

                    const score = calcWeekScore(done, fail, effective, method);
                    if (score !== null) weekScores.push(Math.round(score));
                    else if (method === 'additive') weekScores.push(0);
                    else if (method === 'subtractive') weekScores.push(100);

                    sunday = addDays(sunday, 7);
                }

                if (weekScores.length === 0) return { pct: 0, text: '-' };

                let monthPct;
                if (method === 'additive') {
                    monthPct = weekScores.reduce((a,b) => a+b, 0) / weekCount;
                } else if (method === 'subtractive') {
                    monthPct = (400 - weekScores.reduce((a,b) => a + (100 - b), 0)) / weekCount;
                } else {
                    // static: ממוצע שבועות עם ציון
                    const validScores = weekScores.filter(s => s !== null);
                    if (validScores.length === 0) return { pct: 0, text: '-' };
                    monthPct = validScores.reduce((a,b) => a+b, 0) / validScores.length;
                }

                monthPct = Math.max(0, Math.min(100, Math.round(monthPct)));
                return { pct: monthPct, text: `${monthPct}%` };
            }

            // ---- הרגל יומי (regular / x_times) ----
            if (!habit.history || !habit.history[monthKey]) return { pct: 0, text: '-' };
            const history = habit.history[monthKey];
            const totalDays = totalDaysInMonth;

            let done = 0, fail = 0, effective = totalDays;
            let hasAnyAction = false;

            // חשב כמה אונסים יש בחודש כולו
            let totalForce = 0;
            for (let i = 0; i < totalDays; i++) {
                const status = history[i];
                if (status === 'א' || status === 'N_auto') totalForce++;
            }
            effective = totalDays - totalForce;

            for (let i = 0; i < totalDays; i++) {
                const status = history[i];
                if (status === '' || status === undefined || status === null) continue;
                const cellDayOfWeek = (startDayOfWeek + i) % 7;
                const target = getTargetForDay(habit, cellDayOfWeek);

                if (status === 'א' || status === 'N_auto') continue; // אונס

                hasAnyAction = true;

                if (status === 'V') {
                    done += 1;
                } else if (typeof status === 'number') {
                    const frac = Math.min(status / target, 1);
                    done += frac;
                    fail += (1 - frac);
                } else if (status === 'X' || status === 'N') {
                    fail += 1;
                }
            }

            if (!hasAnyAction) return { pct: 0, text: '-' };
            if (effective === 0) return { pct: 0, text: '-' };

            let pct;
            if (method === 'additive') {
                pct = (done / effective) * 100;
            } else if (method === 'subtractive') {
                pct = (1 - (fail / effective)) * 100;
            } else {
                const total = done + fail;
                if (total === 0) return { pct: 0, text: '-' };
                pct = (done / total) * 100;
            }

            pct = Math.max(0, Math.min(100, Math.round(pct)));
            return { pct, text: `${pct}%` };
        }
        // ---- סיום חישוב ציון חודשי גרסה 3 ----

        function calculateTotalHabitAvg(habit) {
            if(!habit.history) return "-";
            // מטמון: מחזיר ערך שמור אם קיים
            if (totalAvgCache.has(habit.id)) return totalAvgCache.get(habit.id);
            let sumPct = 0;
            let countMonths = 0;
            for(let monthKey in habit.history) {
                const stats = calculateStatsForMonth(habit, monthKey);
                if(stats.text !== "-") {
                    sumPct += stats.pct;
                    countMonths++;
                }
            }
            const result = countMonths > 0 ? `${Math.round(sumPct / countMonths)}%` : "-";
            totalAvgCache.set(habit.id, result);
            return result;
        }



        let draggedHabitId = null;

        let dragState = null;

        function setupCardDragAndDrop(card, habitId) {
            // הגרירה מנוהלת ב-attachDragHandle עם pointer events
        }
        function attachDragHandle(card, habitId) {
            const handle = card.querySelector('.btn-drag-handle');
            if (!handle) return;
            handle.removeAttribute('draggable');

            card.addEventListener('pointerdown', (e) => {
                // רק מהידית
                if (!e.target.closest('.btn-drag-handle')) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                // אל תפריע ללחיצות על כפתורים
                if (e.target.closest('button:not(.btn-drag-handle), input, textarea, select')) return;

                e.preventDefault();
                draggedHabitId = habitId;
                let destHabitId = habitId;
                card.classList.add('dragging');

                let insertBefore = false;

                const move = ev => {
                    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.habit-card');
                    document.querySelectorAll('.habit-card').forEach(c =>
                        c.classList.toggle('drag-over', c === target && c !== card)
                    );
                    if (target && target !== card && target.dataset.habitId) {
                        destHabitId = target.dataset.habitId;
                        const rect = target.getBoundingClientRect();
                        insertBefore = ev.clientY < rect.top + rect.height / 2;
                    }
                };

                const finish = () => {
                    document.removeEventListener('pointermove', move);
                    document.removeEventListener('pointerup', finish);
                    document.removeEventListener('pointercancel', finish);
                    document.querySelectorAll('.habit-card').forEach(c => c.classList.remove('drag-over', 'dragging'));
                    card.classList.remove('dragging');
                    if (draggedHabitId && destHabitId && destHabitId !== draggedHabitId) {
                        reorderHabits(draggedHabitId, destHabitId, insertBefore);
                    }
                    draggedHabitId = null;
                };

                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', finish);
                document.addEventListener('pointercancel', finish);
            });
        }
        function reorderHabits(draggedId, targetId, insertBefore) {
            const draggedIdx = habits.findIndex(h => h.id === draggedId);
            if (draggedIdx === -1) return;
            const [draggedHabit] = habits.splice(draggedIdx, 1);
            let targetIdx = habits.findIndex(h => h.id === targetId);
            if (targetIdx === -1) {
                habits.push(draggedHabit);
            } else {
                if (!insertBefore) targetIdx += 1;
                habits.splice(targetIdx, 0, draggedHabit);
            }
            saveToStorage();
        }

        function toggleCardMenu(habitId, event) {
            if (event) event.stopPropagation();
            const dropdown = document.getElementById(`cardMenu-${habitId}`);
            const wasOpen = dropdown && dropdown.classList.contains('open');
            closeAllCardMenus();
            if (dropdown && !wasOpen) dropdown.classList.add('open');
        }

        function closeAllCardMenus() {
            document.querySelectorAll('.card-menu-dropdown.open').forEach(el => el.classList.remove('open'));
        }

        document.addEventListener('click', closeAllCardMenus);

        let archiveViewOpen = false;

        function toggleHabitArchive(id, event) {
            if (event) event.stopPropagation();
            const habit = habits.find(h => h.id === id);
            if (!habit) return;
            pushUndoAction({ type: 'archive', habitId: id, previousArchived: habit.archived });
            habit.archived = !habit.archived;
            saveToStorage();
        }

        function toggleArchiveView() {
            archiveViewOpen = !archiveViewOpen;
            const section = document.getElementById('archiveSection');
            if (section) section.style.display = archiveViewOpen ? 'block' : 'none';
            const btn = document.getElementById('btnShowArchive');
            if (btn) {
                const archivedCount = habits.filter(h => h.archived).length;
                const countSuffix = archivedCount ? ` (${archivedCount})` : '';
                btn.innerText = archiveViewOpen ? `סגור ארכיון${countSuffix}` : `פתח ארכיון${countSuffix}`;
            }
        }

        let _lastArchiveState = null;

        function renderArchiveSection(archivedList) {
            const container = document.getElementById('archiveSection');
            if (!container) return;

            const btn = document.getElementById('btnShowArchive');
            if (btn) btn.innerText = `${archiveViewOpen ? 'סגור ארכיון' : 'פתח ארכיון'}${archivedList.length ? ` (${archivedList.length})` : ''}`;

            // דלג על בנייה מחדש אם הארכיון סגור או שהמצב לא השתנה
            if (!archiveViewOpen) { _lastArchiveState = null; return; }
            const currentState = JSON.stringify(archivedList.map(h => ({ id: h.id, archived: h.archived, theme: h.theme })));
            if (_lastArchiveState === currentState) return;
            _lastArchiveState = currentState;

            if (!archivedList || archivedList.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:${getMutedTextColor()}; font-size:13px; padding:10px;">הארכיון ריק.</div>`;
                return;
            }

            // כותרת ארכיון
            const headerDiv = document.createElement('div');
            headerDiv.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; margin-bottom:12px;">
                    <div style="font-size:16px; color:${getMutedTextColor()}; font-weight:700; text-align:center;">ארכיון (${archivedList.length})</div>
                </div>
            `;
            
            container.innerHTML = '';
            container.appendChild(headerDiv);
            
            // יצירת grid לכרטיסי הארכיון
            const archiveGrid = document.createElement('div');
            archiveGrid.className = 'habits-grid';
            archiveGrid.style.marginTop = '16px';
            container.appendChild(archiveGrid);
            
            // רינדור כל הרגל בארכיון ככרטיס מלא
            archivedList.forEach(habit => {
                const currentMonthHistory = peekMonthHistory(habit, actualCurrentMonthKey);
                const todayStatus = currentMonthHistory[currentHebrewDayIndex];
                const target = getTargetForDay(habit, currentDayOfWeek);
                const mStats = calculateStatsForMonth(habit, actualCurrentMonthKey);

                if (!habit.notesLog) habit.notesLog = [];
                const dayNoteObj = habit.notesLog.find(n => n.dateStr === currentLetterDayOnly && n.monthKey === actualCurrentMonthKey);
                const currentDayTextVal = dayNoteObj ? dayNoteObj.text : "";

                const card = document.createElement('div');
                card.className = 'habit-card';
                card.style.borderRight = `5px solid ${getThemeColor(habit.theme)}`;
                card.style.opacity = '0.85';
                card.style.position = 'relative';
                card.dataset.habitId = habit.id;
                setupCardDragAndDrop(card, habit.id);
                card.onclick = () => openMonthView(habit.id);

                // לוגיקה לפי סוג הרגל (יומי/שבועי/חודשי)
                if (habit.type === 'weekly' || habit.type === 'monthly') {
                    const isPeriodic = habit.type === 'weekly';
                    const dayTarget = isPeriodic 
                        ? (habit.weeklyDayTargets && habit.weeklyDayTargets[currentDayOfWeek]) || 1
                        : (habit.monthlyDayTargets && habit.monthlyDayTargets[currentDayOfWeek]) || 1;
                    
                    let wText = dayTarget === 1 ? "הצלחה" : `${dayTarget}`;
                    let wStyle = "";
                    let isWActive = false;
                    let isNActive = false;
                    let isNHarmful = false;

                    if (dayTarget > 1) {
                        if (todayStatus === 'W') {
                            wText = "הצלחה";
                            wStyle = getStatusProgressStyle(100);
                            isWActive = true;
                        } else if (typeof todayStatus === 'number') {
                            const rem = dayTarget - todayStatus;
                            wText = rem > 0 ? `${rem}` : "הצלחה";
                            const pct = Math.round((todayStatus / dayTarget) * 100);
                            wStyle = getStatusProgressStyle(pct);
                        }
                    } else {
                        isWActive = (todayStatus === 'W');
                    }

                    isNActive = (todayStatus === 'N');
                    const isForceActiveCard = (todayStatus === 'א' || todayStatus === 'N_auto');
                    const isActiveDayCard = habit.workdays && habit.workdays[currentDayOfWeek];
                    if (isPeriodic) {
                        const firstDayDate = getFirstHebrewDayDate(mainScreenDatePointer);
                        isNHarmful = isWeeklyNHarmful(habit, actualCurrentMonthKey, currentHebrewDayIndex, firstDayDate.getDay(), firstDayDate, calculateDaysInBrowsingMonth(mainScreenDatePointer));
                    } else {
                        isNHarmful = isMonthlyNHarmful(habit, actualCurrentMonthKey, currentHebrewDayIndex);
                    }

                    card.innerHTML = `
                        <div id="cardMenu-${esc(habit.id)}" class="card-menu-dropdown">
                            <div class="card-menu-item" onclick="editHabitFromHome('${esc(habit.id)}', event); closeAllCardMenus();">ערוך הרגל</div>
                            <div class="card-menu-item" onclick="duplicateHabit('${esc(habit.id)}', event); closeAllCardMenus();">שכפל הרגל</div>
                            <div class="card-menu-item" onclick="toggleHabitArchive('${esc(habit.id)}', event); closeAllCardMenus();">הסר מארכיון</div>
                            <div class="card-menu-item danger" onclick="deleteHabit('${esc(habit.id)}', event); closeAllCardMenus();">מחק הרגל</div>
                        </div>
                        <div class="habit-header">
                            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                <button class="btn-card-menu" onclick="toggleCardMenu('${esc(habit.id)}', event)" style="position:static; margin:0;">⋮</button>
                                <span class="habit-stats-summary" style="margin:0;">חודשי: <span style="color: ${getScoreColor(mStats.pct, habit, mStats.text)}; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${esc(mStats.text)}</span></span>
                            </div>
                            <div style="width:100%; margin-top:4px;">
                                <span class="habit-title" data-habit-title style="display:block; width:100%;"></span>
                            </div>
                        </div>
                        <div class="controls-row">
                            <div class="status-buttons-group">
                                <div class="action-toggle btn-w-skip ${isActiveDayCard ? '' : 'hidden'} ${isNActive ? 'active' : ''} ${isNHarmful ? 'harmful' : ''}" onclick="setStatus('${esc(habit.id)}', 'N', event)">
                                    <span>פספוס</span>
                                </div>
                                <div class="action-toggle btn-w-force ${isForceActiveCard ? 'active' : ''}" onclick="setStatus('${esc(habit.id)}', 'א', event)">
                                    <span>אונס</span>
                                </div>
                                <div class="action-toggle btn-w-done ${isWActive ? 'active' : ''}" style="${wStyle}" onclick="setStatus('${esc(habit.id)}', 'W', event)">
                                    <span>${esc(wText)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="card-notes-container" onclick="event.stopPropagation();">
                            <textarea id="noteText-${esc(habit.id)}" class="card-notes-textarea" placeholder="רשום הערה ליום זה..."></textarea>
                            <button class="btn-card-notes-save" onclick="saveCardNote('${esc(habit.id)}', event)">שמור</button>
                        </div>
                    `;
                } else {
                    // יומי (x_times / regular)
                    let vText = "הצלחה";
                    let vStyle = "";
                    let isVActive = false;

                    if (typeof todayStatus === 'number') {
                        const rem = target - todayStatus;
                        vText = rem > 0 ? `${rem}` : `הצלחה`;
                        const pct = Math.round((todayStatus / target) * 100);
                        vStyle = getStatusProgressStyle(pct);
                        isVActive = (todayStatus >= target);
                    } else if (todayStatus === 'V') {
                        vText = `הצלחה`;
                        vStyle = getStatusProgressStyle(100);
                        isVActive = true;
                    } else {
                        vText = target === 1 ? `הצלחה` : `${target}`;
                    }

                    card.innerHTML = `
                        <div id="cardMenu-${esc(habit.id)}" class="card-menu-dropdown">
                            <div class="card-menu-item" onclick="editHabitFromHome('${esc(habit.id)}', event); closeAllCardMenus();">ערוך הרגל</div>
                            <div class="card-menu-item" onclick="duplicateHabit('${esc(habit.id)}', event); closeAllCardMenus();">שכפל הרגל</div>
                            <div class="card-menu-item" onclick="toggleHabitArchive('${esc(habit.id)}', event); closeAllCardMenus();">הסר מארכיון</div>
                            <div class="card-menu-item danger" onclick="deleteHabit('${esc(habit.id)}', event); closeAllCardMenus();">מחק הרגל</div>
                        </div>
                        <div class="habit-header">
                            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                <button class="btn-card-menu" onclick="toggleCardMenu('${esc(habit.id)}', event)" style="position:static; margin:0;">⋮</button>
                                <span class="habit-stats-summary" style="margin:0;">חודשי: <span style="color: ${getScoreColor(mStats.pct, habit, mStats.text)}; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${esc(mStats.text)}</span></span>
                            </div>
                            <div style="width:100%; margin-top:4px;">
                                <span class="habit-title" data-habit-title style="display:block; width:100%;"></span>
                            </div>
                        </div>
                        <div class="controls-row">
                            <div class="status-buttons-group">
                                <div class="action-toggle btn-a ${todayStatus === 'א' ? 'active' : ''}" onclick="setStatus('${esc(habit.id)}', 'א', event)">
                                    <span>אונס</span>
                                </div>
                                <div class="action-toggle btn-x ${todayStatus === 'X' ? 'active' : ''}" onclick="setStatus('${esc(habit.id)}', 'X', event)">
                                    <span>פספוס</span>
                                </div>
                                <div class="action-toggle btn-v ${isVActive ? 'active' : ''}" style="${vStyle}" onclick="setStatus('${esc(habit.id)}', 'V', event)">
                                    <span>${esc(vText)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="card-notes-container" onclick="event.stopPropagation();">
                            <textarea id="noteText-${esc(habit.id)}" class="card-notes-textarea" placeholder="רשום הערה ליום זה..."></textarea>
                            <button class="btn-card-notes-save" onclick="saveCardNote('${esc(habit.id)}', event)">שמור</button>
                        </div>
                    `;
                }

                card.querySelector('[data-habit-title]').textContent = habit.title;
                card.querySelector(`#noteText-${CSS.escape(habit.id)}`).value = currentDayTextVal;
                archiveGrid.appendChild(card);
            });
        }


        function isHabitSignedToday(habit) {
            // בדוק לפי היום שנבחר בניווט (לא בהכרח היום האמיתי)
            const comps = getHebrewDateComponents(mainScreenDatePointer);
            const history = peekMonthHistory(habit, comps.key);
            const dayIdx = comps.dayIndex !== undefined ? comps.dayIndex : currentHebrewDayIndex;
            const status = history[dayIdx];
            if (status === '' || status === undefined || status === null) return false;

            if (habit.type === 'weekly') {
                return status === 'W' || status === 'N' || typeof status === 'number';
            }
            if (habit.type === 'monthly') {
                return status === 'W' || status === 'N' || typeof status === 'number';
            }
            // יומי
            return status === 'V' || status === 'X' || status === 'א' || typeof status === 'number';
        }

        // ---- פילטר סימניות + לא סומן ----
        let activeBookmarkFilter = null; // null = הכל, colorKey = רק סימניה זו
        let showUnsignedOnly = false;    // true = רק הרגלים שלא סומנו היום

        // בודק אם הרגל מסוים סומן היום (כל סוג)
        function isHabitSignedToday(habit) {
            const currentMonthHistory = peekMonthHistory(habit, actualCurrentMonthKey);
            const todayStatus = currentMonthHistory[currentHebrewDayIndex];
            if (habit.type === 'weekly' || habit.type === 'monthly') {
                return todayStatus === 'W' || todayStatus === 'N' || typeof todayStatus === 'number';
            }
            return todayStatus === 'V' || todayStatus === 'X' || todayStatus === 'א' || typeof todayStatus === 'number';
        }

        let _lastBookmarkBarState = null;

        function renderBookmarkFilterBar() {
            const namedBookmarks = BOOKMARK_COLORS.filter(c => bookmarkLabels[c] && bookmarkLabels[c].trim() !== '');

            // דלג על בנייה מחדש אם המצב לא השתנה
            const currentState = JSON.stringify({ namedBookmarks, activeBookmarkFilter, showUnsignedOnly, dark: isDarkModeEnabled() });
            if (_lastBookmarkBarState === currentState && document.getElementById('bookmarkFilterBar')) return;
            _lastBookmarkBarState = currentState;

            let container = document.getElementById('bookmarkFilterBar');
            if (!container) {
                container = document.createElement('div');
                container.id = 'bookmarkFilterBar';
                container.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:14px; margin-bottom:14px; align-items:center;';
                const searchBox = document.getElementById('habitSearchInput');
                if (searchBox && searchBox.parentNode) {
                    searchBox.parentNode.insertBefore(container, searchBox.nextSibling);
                }
            }
            container.innerHTML = '';

            const dark = isDarkModeEnabled();
            const mutedColor = getMutedTextColor();

            // ---- שורה עליונה: כפתורי סימניות ----
            if (namedBookmarks.length > 0) {
                const bookmarkRow = document.createElement('div');
                bookmarkRow.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; align-items:center; justify-content:center; width:100%;';

                // כפתור "הכל"
                const allBtn = document.createElement('button');
                allBtn.textContent = 'הכל';
                const allActive = activeBookmarkFilter === null;
                allBtn.style.cssText = `font-family:inherit; font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; cursor:pointer; border:1.5px solid ${allActive ? '#2563eb' : (dark ? '#475569' : '#cbd5e1')}; background:${allActive ? '#eff6ff' : 'transparent'}; color:${allActive ? '#2563eb' : mutedColor}; transition:all 0.15s;`;
                allBtn.onclick = () => { activeBookmarkFilter = null; renderHabits(); };
                bookmarkRow.appendChild(allBtn);

                namedBookmarks.forEach(colorKey => {
                    const label = bookmarkLabels[colorKey];
                    const isActive = activeBookmarkFilter === colorKey;
                    const btn = document.createElement('button');
                    btn.style.cssText = `font-family:inherit; font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; cursor:pointer; border:1.5px solid ${isActive ? colorKey : (dark ? '#475569' : '#cbd5e1')}; background:${isActive ? colorKey + '22' : 'transparent'}; color:${isActive ? colorKey : mutedColor}; display:flex; align-items:center; gap:5px; transition:all 0.15s;`;
                    const dot = document.createElement('span');
                    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${colorKey};display:inline-block;flex-shrink:0;`;
                    btn.appendChild(dot);
                    btn.appendChild(document.createTextNode(label));
                    btn.onclick = () => { activeBookmarkFilter = isActive ? null : colorKey; renderHabits(); };
                    bookmarkRow.appendChild(btn);
                });

                container.appendChild(bookmarkRow);
            }

            // ---- כפתור "לא סומן היום" ----
            const unsignedRow = document.createElement('div');
            unsignedRow.style.cssText = 'display:flex; gap:6px; align-items:center; justify-content:center; width:100%;';

            const unsignedBtn = document.createElement('button');
            unsignedBtn.style.cssText = `font-family:inherit; font-size:12px; font-weight:600; padding:4px 14px; border-radius:20px; cursor:pointer; transition:all 0.15s; border:1.5px solid ${showUnsignedOnly ? '#f59e0b' : (dark ? '#475569' : '#cbd5e1')}; background:${showUnsignedOnly ? '#fef3c7' : 'transparent'}; color:${showUnsignedOnly ? '#d97706' : mutedColor};`;
            unsignedBtn.textContent = showUnsignedOnly ? 'מציג: לא סומן היום' : 'הצג רק לא סומן היום';
            unsignedBtn.onclick = () => { showUnsignedOnly = !showUnsignedOnly; renderHabits(); };
            unsignedRow.appendChild(unsignedBtn);

            // אם הפילטר פעיל — מציג כמה הרגלים נשארו
            if (showUnsignedOnly) {
                const activeList = habits.filter(h => !h.archived);
                const filtered = activeList.filter(h => {
                    const bookmarkOk = activeBookmarkFilter === null || h.theme === activeBookmarkFilter;
                    return bookmarkOk && !isHabitSignedToday(h);
                });
                const countSpan = document.createElement('span');
                countSpan.style.cssText = `font-size:12px; font-weight:600; color:${mutedColor};`;
                countSpan.textContent = `${filtered.length} נשארו`;
                unsignedRow.appendChild(countSpan);
            }

            container.appendChild(unsignedRow);
            container.style.display = 'flex';
        }
        // ---- סיום פילטר סימניות + לא סומן ----

        // ---- מצב השוואה - גרסה חדשה עם modal ----
        let comparisonSelectedHabits = new Set();
        let comparisonMonthOffset = 0; // 0 = חודש נוכחי, -1 = חודש קודם, וכו'

        function openComparisonModal() {
            comparisonSelectedHabits.clear();
            comparisonMonthOffset = 0;
            showComparisonSelectionScreen();
            document.getElementById('comparisonModal').style.display = 'flex';
        }

        function closeComparisonModal() {
            document.getElementById('comparisonModal').style.display = 'none';
            comparisonSelectedHabits.clear();
        }

        function showComparisonSelectionScreen() {
            const content = document.getElementById('comparisonModalContent');
            const dark = isDarkModeEnabled();
            const bgColor = dark ? '#1e293b' : '#f8fafc';
            const borderColor = dark ? '#475569' : '#e2e8f0';
            const textColor = dark ? '#cbd5e1' : '#475569';

            const activeHabits = habits.filter(h => !h.archived);
            const archivedHabits = habits.filter(h => h.archived);

            let html = `
                <h3 style="margin: 0 0 20px 0; font-size: 20px; color: ${dark ? '#e2e8f0' : '#0f172a'};">בחר הרגלים להשוואה</h3>
                <div style="margin-bottom: 20px;">
            `;

            // הרגלים פעילים
            if (activeHabits.length > 0) {
                html += `<div style="margin-bottom: 20px;">`;
                activeHabits.forEach(habit => {
                    const isChecked = comparisonSelectedHabits.has(habit.id);
                    const themeColor = getThemeColor(habit.theme);
                    html += `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='${dark ? '#293548' : '#f1f5f9'}'" onmouseout="this.style.background='${bgColor}'">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleComparisonHabit('${esc(habit.id)}')" style="width: 18px; height: 18px; cursor: pointer; accent-color: #3b82f6;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${themeColor}; flex-shrink: 0;"></span>
                            <span style="flex: 1; font-size: 14px; font-weight: 600; color: ${dark ? '#e2e8f0' : '#0f172a'};">${esc(habit.title)}</span>
                        </label>
                    `;
                });
                html += `</div>`;
            }

            // כותרת ארכיון
            if (archivedHabits.length > 0) {
                html += `<div style="font-size: 14px; font-weight: 700; color: ${textColor}; margin: 16px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid ${borderColor};">ארכיון</div>`;
                
                archivedHabits.forEach(habit => {
                    const isChecked = comparisonSelectedHabits.has(habit.id);
                    const themeColor = getThemeColor(habit.theme);
                    html += `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; opacity: 0.85; transition: background 0.15s;" onmouseover="this.style.background='${dark ? '#293548' : '#f1f5f9'}'" onmouseout="this.style.background='${bgColor}'">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleComparisonHabit('${esc(habit.id)}')" style="width: 18px; height: 18px; cursor: pointer; accent-color: #3b82f6;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${themeColor}; flex-shrink: 0;"></span>
                            <span style="flex: 1; font-size: 14px; font-weight: 600; color: ${textColor};">${esc(habit.title)}</span>
                        </label>
                    `;
                });
            }

            html += `</div>`;

            // כפתורי פעולה
            html += `
                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-modal-cancel" onclick="closeComparisonModal()">ביטול</button>
                    <button class="btn-modal-save" onclick="showComparisonTableScreen()" ${comparisonSelectedHabits.size < 2 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>השווה (${comparisonSelectedHabits.size})</button>
                </div>
            `;

            content.innerHTML = html;
        }

        function toggleComparisonHabit(habitId) {
            if (comparisonSelectedHabits.has(habitId)) {
                comparisonSelectedHabits.delete(habitId);
            } else {
                comparisonSelectedHabits.add(habitId);
            }
            showComparisonSelectionScreen();
        }

        function showComparisonTableScreen() {
            if (comparisonSelectedHabits.size < 2) {
                alert('אנא בחר לפחות 2 הרגלים להשוואה');
                return;
            }
            renderComparisonModalTable();
        }

        function adjustComparisonMonth(direction) {
            comparisonMonthOffset += direction;
            renderComparisonModalTable();
        }

        function getComparisonMonthKey() {
            const date = new Date();
            date.setMonth(date.getMonth() + comparisonMonthOffset);
            const comps = getHebrewDateComponents(date);
            return comps.key;
        }

        function getComparisonMonthDisplay() {
            const date = new Date();
            date.setMonth(date.getMonth() + comparisonMonthOffset);
            const comps = getHebrewDateComponents(date);
            return comps.month;
        }

        function renderComparisonModalTable() {
            const content = document.getElementById('comparisonModalContent');
            const dark = isDarkModeEnabled();
            const bgHeader = dark ? '#334155' : '#f1f5f9';
            const bgActive = dark ? '#1e3a5f' : '#dbeafe';
            const bgArchived = dark ? '#1e293b' : '#f8fafc';
            const borderColor = dark ? '#475569' : '#e2e8f0';
            const textColor = dark ? '#cbd5e1' : '#475569';

            const selectedHabitsArray = Array.from(comparisonSelectedHabits)
                .map(id => habits.find(h => h.id === id))
                .filter(h => h);

            const comparisonMonthKey = getComparisonMonthKey();
            const comparisonMonthDisplay = getComparisonMonthDisplay();
            const isCurrentMonth = comparisonMonthOffset === 0;

            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 20px; color: ${dark ? '#e2e8f0' : '#0f172a'};">השוואת הרגלים</h3>
                    <button class="btn-edit-habit-trigger" onclick="showComparisonSelectionScreen()" style="font-size: 13px; padding: 6px 14px;">
                        הוסף עוד הרגלים
                    </button>
                </div>

                <div class="navigation-wrapper" style="margin-bottom: 12px;">
                    <div class="day-navigation-container" style="margin-bottom: 0;">
                        <button class="btn-day-nav" onclick="adjustComparisonMonth(-1)" title="חודש קודם">→</button>
                        <div class="date-badge">${comparisonMonthDisplay}${isCurrentMonth ? ' (נוכחי)' : ''}</div>
                        <button class="btn-day-nav" onclick="adjustComparisonMonth(1)" title="חודש הבא" ${isCurrentMonth ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>←</button>
                    </div>
                    <button class="btn-jump-today" onclick="comparisonMonthOffset = 0; renderComparisonModalTable();" ${isCurrentMonth ? 'style="opacity:0.5; pointer-events:none;"' : ''}>חזרה לחודש הנוכחי</button>
                </div>

                `
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">`;

            selectedHabitsArray.forEach(habit => {
                const mStats = calculateStatsForMonth(habit, comparisonMonthKey);
                const totalAvg = calculateTotalHabitAvg(habit);
                const totalAvgPct = parseInt(totalAvg);
                const themeColor = getThemeColor(habit.theme);
                const monthColor = mStats.text !== '-' ? getRelativeSpectrumColor(mStats.pct, minMonthPct, maxMonthPct) : textColor;
                const totalColor = !isNaN(totalAvgPct) ? getRelativeSpectrumColor(totalAvgPct, minTotalPct, maxTotalPct) : textColor;

                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:11px 16px; border-radius:8px; border:1px solid ${borderColor}; background:${habit.archived ? bgArchived : bgActive}; border-right:4px solid ${themeColor};">
                        <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                            <span style="width:10px; height:10px; border-radius:50%; background:${themeColor}; flex-shrink:0;"></span>
                            <span style="font-size:13px; font-weight:600; color:${dark ? '#e2e8f0' : '#0f172a'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(habit.title)}</span>
                        </div>
                        <div style="display:flex; gap:16px; align-items:center; flex-shrink:0;">
                            <span style="font-size:14px; font-weight:700; color:${monthColor};">${mStats.text !== '-' ? mStats.pct + '%' : '-'}</span>
                            <span style="font-size:12px; color:${totalColor};">${!isNaN(totalAvgPct) ? totalAvgPct + '%' : '-'}</span>
                        </div>
                    </div>
                `;
            });

            html += `
                </div>
                <div style="margin-top:12px; padding:10px 12px; background:${dark ? '#1e3a5f' : '#eff6ff'}; border-right:3px solid #3b82f6; border-radius:6px; font-size:12px; color:${textColor}; line-height:1.5;">
                    הסבר: הרגלים פעילים מודגשים ברקע כחול. השתמש בכפתורי הניווט כדי להשוות בין חודשים שונים.
                </div>
                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                    <button class="btn-modal-cancel" onclick="closeComparisonModal()">סגור</button>
                </div>
            `;

            content.innerHTML = html;
        }
        // ---- סיום מצב השוואה ----

        // ---- מודל השוואת הרגלים ----
        let globalComparisonSelectedHabits = new Set();
        let globalComparisonMonthOffset = 0;

        function openComparisonModal() {
            globalComparisonSelectedHabits.clear();
            globalComparisonMonthOffset = 0;
            showComparisonSelectionScreen();
            document.getElementById('comparisonModal').style.display = 'flex';
        }

        function closeComparisonModal() {
            document.getElementById('comparisonModal').style.display = 'none';
            globalComparisonSelectedHabits.clear();
            globalComparisonMonthOffset = 0;
        }

        function showComparisonSelectionScreen() {
            const content = document.getElementById('comparisonModalContent');
            if (!content) return;

            const dark = isDarkModeEnabled();
            const mutedColor = getMutedTextColor();
            const activeHabits = habits.filter(h => !h.archived);
            const archivedHabits = habits.filter(h => h.archived);

            let html = `
                <h3 style="margin: 0 0 20px 0; text-align: center; font-size: 20px; color: ${dark ? '#e2e8f0' : '#0f172a'};">
                    בחר הרגלים להשוואה
                </h3>
                <div style="margin-bottom: 20px;">
            `;

            // הרגלים פעילים
            if (activeHabits.length > 0) {
                html += `<div style="margin-bottom: 16px; font-size: 14px; font-weight: 600; color: ${mutedColor};">הרגלים פעילים:</div>`;
                activeHabits.forEach(habit => {
                    const isChecked = globalComparisonSelectedHabits.has(habit.id);
                    const themeColor = getThemeColor(habit.theme);
                    html += `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${dark ? '#1e293b' : '#f8fafc'}; border: 1px solid ${dark ? '#334155' : '#e2e8f0'}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='${dark ? '#293548' : '#f1f5f9'}'" onmouseout="this.style.background='${dark ? '#1e293b' : '#f8fafc'}'">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleGlobalComparisonHabit('${esc(habit.id)}')" style="width: 18px; height: 18px; cursor: pointer; accent-color: ${themeColor};">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${themeColor}; flex-shrink: 0;"></span>
                            <span style="flex: 1; font-size: 14px; color: ${dark ? '#e2e8f0' : '#0f172a'}; font-weight: 500;">${esc(habit.title)}</span>
                        </label>
                    `;
                });
            }

            // הרגלים בארכיון
            if (archivedHabits.length > 0) {
                html += `<div style="margin: 24px 0 16px 0; font-size: 14px; font-weight: 600; color: ${mutedColor};">ארכיון:</div>`;
                archivedHabits.forEach(habit => {
                    const isChecked = globalComparisonSelectedHabits.has(habit.id);
                    const themeColor = getThemeColor(habit.theme);
                    html += `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${dark ? '#1e293b' : '#f8fafc'}; border: 1px solid ${dark ? '#334155' : '#e2e8f0'}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; opacity: 0.85; transition: background 0.15s, opacity 0.15s;" onmouseover="this.style.background='${dark ? '#293548' : '#f1f5f9'}'; this.style.opacity='1'" onmouseout="this.style.background='${dark ? '#1e293b' : '#f8fafc'}'; this.style.opacity='0.85'">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleGlobalComparisonHabit('${esc(habit.id)}')" style="width: 18px; height: 18px; cursor: pointer; accent-color: ${themeColor};">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${themeColor}; flex-shrink: 0;"></span>
                            <span style="flex: 1; font-size: 14px; color: ${dark ? '#cbd5e1' : '#475569'}; font-weight: 500;">${esc(habit.title)}</span>
                        </label>
                    `;
                });
            }

            html += `
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-modal-cancel" onclick="closeComparisonModal()">ביטול</button>
                    <button class="btn-modal-save" onclick="showComparisonTableScreen()" id="btnShowComparison" ${globalComparisonSelectedHabits.size < 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        השווה (<span id="selectedCount">${globalComparisonSelectedHabits.size}</span>)
                    </button>
                </div>
            `;

            content.innerHTML = html;
        }

        function toggleGlobalComparisonHabit(habitId) {
            if (globalComparisonSelectedHabits.has(habitId)) {
                globalComparisonSelectedHabits.delete(habitId);
            } else {
                globalComparisonSelectedHabits.add(habitId);
            }
            
            // עדכון מונה ומצב כפתור
            const countEl = document.getElementById('selectedCount');
            const btnShow = document.getElementById('btnShowComparison');
            if (countEl) countEl.textContent = globalComparisonSelectedHabits.size;
            if (btnShow) {
                if (globalComparisonSelectedHabits.size < 1) {
                    btnShow.disabled = true;
                    btnShow.style.opacity = '0.5';
                    btnShow.style.cursor = 'not-allowed';
                } else {
                    btnShow.disabled = false;
                    btnShow.style.opacity = '1';
                    btnShow.style.cursor = 'pointer';
                }
            }
        }

        function showComparisonTableScreen() {
            const content = document.getElementById('comparisonModalContent');
            if (!content || globalComparisonSelectedHabits.size === 0) return;

            const selectedHabits = Array.from(globalComparisonSelectedHabits)
                .map(id => habits.find(h => h.id === id))
                .filter(h => h);

            if (selectedHabits.length === 0) {
                closeComparisonModal();
                return;
            }

            const dark = isDarkModeEnabled();
            const bgHeader = dark ? '#334155' : '#f1f5f9';
            const bgActive = dark ? '#1e3a5f' : '#dbeafe';
            const bgArchived = dark ? '#1e293b' : '#f8fafc';
            const borderColor = dark ? '#475569' : '#e2e8f0';
            const textColor = dark ? '#cbd5e1' : '#475569';

            const comparisonMonthKey = getGlobalComparisonMonthKey();
            const comparisonMonthDisplay = getGlobalComparisonMonthDisplay();
            const isCurrentMonth = globalComparisonMonthOffset === 0;

            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 20px; color: ${dark ? '#e2e8f0' : '#0f172a'};">
                        השוואת הרגלים
                    </h3>
                    <button class="btn-edit-habit-trigger" onclick="showComparisonSelectionScreen()" style="font-size: 13px; padding: 6px 14px;">
                        ➕ הוסף עוד הרגלים להשוואה
                    </button>
                </div>

                <div class="navigation-wrapper" style="margin-bottom: 12px;">
                    <div class="day-navigation-container" style="margin-bottom: 0;">
                        <button class="btn-day-nav" onclick="adjustGlobalComparisonMonth(-1)" title="חודש קודם">→</button>
                        <div class="date-badge">${comparisonMonthDisplay}${isCurrentMonth ? ' (נוכחי)' : ''}</div>
                        <button class="btn-day-nav" onclick="adjustGlobalComparisonMonth(1)" title="חודש הבא" ${isCurrentMonth ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>←</button>
                    </div>
                    <button class="btn-jump-today" onclick="globalComparisonMonthOffset = 0; showComparisonTableScreen();" ${isCurrentMonth ? 'style="opacity:0.5; pointer-events:none;"' : ''}>חזרה לחודש הנוכחי</button>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:13px;">
                    <thead>
                        <tr style="background:${bgHeader}; border-bottom:2px solid ${borderColor};">
                            <th style="padding:10px 14px; text-align:right; font-weight:600; color:${textColor};">שם הרגל</th>
                            <th style="padding:10px 14px; text-align:center; font-weight:600; color:${textColor};">ציון ${comparisonMonthDisplay}</th>
                            <th style="padding:10px 14px; text-align:center; font-weight:600; color:${textColor};">ממוצע כולל</th>
                            <th style="padding:10px 14px; text-align:center; font-weight:600; color:${textColor};">סטטוס</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            selectedHabits.forEach(habit => {
                const mStats = calculateStatsForMonth(habit, comparisonMonthKey);
                const totalAvg = calculateTotalHabitAvg(habit);
                const themeColor = getThemeColor(habit.theme);
                const isArchived = habit.archived;
                const rowBg = isArchived ? bgArchived : bgActive;
                const rowOpacity = isArchived ? 'opacity: 0.85;' : '';
                const statusBg = isArchived ? (dark ? '#475569' : '#cbd5e1') : '#3b82f6';
                const statusColor = isArchived ? (dark ? '#e2e8f0' : '#475569') : 'white';
                const statusText = isArchived ? 'ארכיון' : 'פעיל';
                
                html += `
                    <tr style="background:${rowBg}; border-right:4px solid ${themeColor}; border-bottom:1px solid ${borderColor}; ${rowOpacity}">
                        <td style="padding:12px 14px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="width:10px; height:10px; border-radius:50%; background:${themeColor}; flex-shrink:0;"></span>
                                <span style="font-weight:600; color:${isArchived ? textColor : (dark ? '#e2e8f0' : '#0f172a')};">${esc(habit.title)}</span>
                            </div>
                        </td>
                        <td style="padding:12px 14px; text-align:center; font-weight:700; color:${getScoreColor(mStats.pct, habit, mStats.text)};">${esc(mStats.text)}</td>
                        <td style="padding:12px 14px; text-align:center; font-weight:700; color:${getScoreColor(parseInt(totalAvg) || 0, habit, totalAvg)};">${esc(totalAvg)}</td>
                        <td style="padding:12px 14px; text-align:center;">
                            <span style="display:inline-block; padding:3px 10px; background:${statusBg}; color:${statusColor}; border-radius:12px; font-size:11px; font-weight:600;">${statusText}</span>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
                <div style="margin-top:12px; padding:10px 12px; background:${dark ? '#1e3a5f' : '#eff6ff'}; border-right:3px solid #3b82f6; border-radius:6px; font-size:12px; color:${textColor}; line-height:1.5;">
                    💡 <strong>הסבר:</strong> הרגלים פעילים מודגשים ברקע כחול. השתמש בכפתורי הניווט כדי להשוות בין חודשים שונים.
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button class="btn-modal-cancel" onclick="closeComparisonModal()">סגור</button>
                </div>
            `;

            content.innerHTML = html;
        }

        function adjustGlobalComparisonMonth(direction) {
            globalComparisonMonthOffset += direction;
            showComparisonTableScreen();
        }

        function getGlobalComparisonMonthKey() {
            const date = new Date();
            date.setMonth(date.getMonth() + globalComparisonMonthOffset);
            const comps = getHebrewDateComponents(date);
            return comps.key;
        }

        function getGlobalComparisonMonthDisplay() {
            const date = new Date();
            date.setMonth(date.getMonth() + globalComparisonMonthOffset);
            const comps = getHebrewDateComponents(date);
            return comps.month;
        }
        // ---- סיום מודל השוואת הרגלים ----
        // ---- מודל ממוצע הרגלים ספציפיים ----
        let avgHabitsSelectedHabits = new Set();

        function openAvgHabitsModal() {
            avgHabitsSelectedHabits.clear();
            showAvgHabitsSelectionScreen();
            document.getElementById('avgHabitsModal').style.display = 'flex';
        }

        function closeAvgHabitsModal() {
            document.getElementById('avgHabitsModal').style.display = 'none';
            avgHabitsSelectedHabits.clear();
        }

        function showAvgHabitsSelectionScreen() {
            const content = document.getElementById('avgHabitsModalContent');
            if (!content) return;
            const dark = isDarkModeEnabled();
            const mutedColor = getMutedTextColor();
            const activeHabits = habits.filter(h => !h.archived);
            const archivedHabits = habits.filter(h => h.archived);

            let html = `<h3 style="margin: 0 0 20px 0; text-align: center; font-size: 20px; color: ${dark ? '#e2e8f0' : '#0f172a'};">בחר הרגלים לממוצע</h3><div style="margin-bottom: 20px;">`;

            if (activeHabits.length > 0) {
                html += `<div style="margin-bottom: 16px; font-size: 14px; font-weight: 600; color: ${mutedColor};">הרגלים פעילים:</div>`;
                activeHabits.forEach(habit => {
                    const isChecked = avgHabitsSelectedHabits.has(habit.id);
                    const themeColor = getThemeColor(habit.theme);
                    html += `<label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${dark ? '#1e293b' : '#f8fafc'}; border: 1px solid ${dark ? '#334155' : '#e2e8f0'}; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" onmouseover="this.style.background='${dark ? '#293548' : '#f1f5f9'}'" onmouseout="this.style.background='${dark ? '#1e293b' : '#f8fafc'}'"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleAvgHabit('${esc(habit.id)}')" style="width: 18px; height: 18px; cursor: pointer; accent-color: ${themeColor};"><span style="width: 10px; height: 10px; border-radius: 50%; background: ${themeColor}; flex-shrink: 0;"></span><span style="flex: 1; font-size: 14px; color: ${dark ? '#e2e8f0' : '#0f172a'}; font-weight: 500;">${esc(habit.title)}</span></label>`;
                });
            }

            if (archivedHabits.length > 0) {
                html += `<div style="margin: 24px 0 16px 0; font-size: 14px; font-weight: 600; color: ${mutedColor};">ארכיון:</div>`;
                archivedHabits.forEach(habit => {
                    const isChecked = avgHabitsSelectedHabits.has(habit.id);
                    const themeColor = getThemeColor(habit.theme);
                    html += `<label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${dark ? '#1e293b' : '#f8fafc'}; border: 1px solid ${dark ? '#334155' : '#e2e8f0'}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; opacity: 0.85;" onmouseover="this.style.background='${dark ? '#293548' : '#f1f5f9'}'; this.style.opacity='1'" onmouseout="this.style.background='${dark ? '#1e293b' : '#f8fafc'}'; this.style.opacity='0.85'"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleAvgHabit('${esc(habit.id)}')" style="width: 18px; height: 18px; cursor: pointer; accent-color: ${themeColor};"><span style="width: 10px; height: 10px; border-radius: 50%; background: ${themeColor}; flex-shrink: 0;"></span><span style="flex: 1; font-size: 14px; color: ${dark ? '#cbd5e1' : '#475569'}; font-weight: 500;">${esc(habit.title)}</span></label>`;
                });
            }

            html += `</div><div style="display: flex; gap: 10px; justify-content: center;"><button class="btn-modal-cancel" onclick="closeAvgHabitsModal()">ביטול</button><button class="btn-modal-save" onclick="showAvgHabitsResultScreen()" id="btnShowAvg" ${avgHabitsSelectedHabits.size < 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>הצג ממוצע (<span id="avgSelectedCount">${avgHabitsSelectedHabits.size}</span>)</button></div>`;
            content.innerHTML = html;
        }

        function toggleAvgHabit(habitId) {
            if (avgHabitsSelectedHabits.has(habitId)) {
                avgHabitsSelectedHabits.delete(habitId);
            } else {
                avgHabitsSelectedHabits.add(habitId);
            }
            const countEl = document.getElementById('avgSelectedCount');
            const btnShow = document.getElementById('btnShowAvg');
            if (countEl) countEl.textContent = avgHabitsSelectedHabits.size;
            if (btnShow) {
                if (avgHabitsSelectedHabits.size < 1) { btnShow.disabled = true; btnShow.style.opacity = '0.5'; btnShow.style.cursor = 'not-allowed'; }
                else { btnShow.disabled = false; btnShow.style.opacity = '1'; btnShow.style.cursor = 'pointer'; }
            }
        }

        function showAvgHabitsResultScreen() {
            const content = document.getElementById('avgHabitsModalContent');
            if (!content || avgHabitsSelectedHabits.size === 0) return;

            const selectedHabits = Array.from(avgHabitsSelectedHabits).map(id => habits.find(h => h.id === id)).filter(h => h);
            if (selectedHabits.length === 0) { closeAvgHabitsModal(); return; }

            const dark = isDarkModeEnabled();
            const textColor = dark ? '#cbd5e1' : '#475569';
            const borderColor = dark ? '#475569' : '#e2e8f0';

            // כל מפתחות החודשים מכל ההרגלים שנבחרו
            const allMonthKeys = new Set();
            selectedHabits.forEach(habit => { Object.keys(habit.history || {}).forEach(k => allMonthKeys.add(k)); });

            // רק חודשים שיש בהם נתונים לכל ההרגלים
            const validMonths = Array.from(allMonthKeys).filter(monthKey => {
                return selectedHabits.every(habit => {
                    const stats = calculateStatsForMonth(habit, monthKey);
                    return stats.text !== '-';
                });
            });

            // מיון מהחדש לישן
            validMonths.sort((a, b) => b.localeCompare(a));

            const rows = validMonths.map(monthKey => {
                const pcts = selectedHabits.map(habit => calculateStatsForMonth(habit, monthKey).pct).filter(p => p !== null && !isNaN(p));
                const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null;
                return { label: monthKey, pct: avg };
            }).filter(r => r.pct !== null);

            let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><h3 style="margin: 0; font-size: 20px; color: ${dark ? '#e2e8f0' : '#0f172a'};">ממוצע הרגלים ספציפיים</h3><button class="btn-edit-habit-trigger" onclick="showAvgHabitsSelectionScreen()" style="font-size: 13px; padding: 6px 14px;">שנה בחירה</button></div>`;

            if (rows.length === 0) {
                html += `<div style="text-align:center; color:${textColor}; padding: 24px; font-size: 13px;">אין חודשים עם נתונים לכל ההרגלים שנבחרו</div>`;
            } else {
                const pcts = rows.map(r => r.pct);
                const minPct = Math.min(...pcts);
                const maxPct = Math.max(...pcts);
                html += `<div style="display: flex; flex-direction: column; gap: 8px;">`;
                rows.forEach(r => {
                    const color = getRelativeSpectrumColor(r.pct, minPct, maxPct);
                    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:11px 16px; border-radius:8px; border:1px solid ${borderColor}; background:${dark ? '#1e293b' : '#f8fafc'};"><span style="font-size:13px; color:${textColor}; font-weight:600;">${r.label}</span><span style="font-size:16px; font-weight:700; color:${color};">${r.pct}%</span></div>`;
                });
                html += `</div>`;
            }

            html += `<div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;"><button class="btn-modal-cancel" onclick="closeAvgHabitsModal()">סגור</button></div>`;
            content.innerHTML = html;
        }
        // ---- סיום מודל ממוצע הרגלים ספציפיים ----

