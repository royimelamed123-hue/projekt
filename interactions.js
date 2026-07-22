        // ---- תיקון 4: calculateStatsForMonth עם מטמון ----
        function calculateStatsForMonth(habit, monthKey) {
            // בדיקה אם התוצאה כבר מחושבת במטמון
            const cacheKey = getStatsCacheKey(habit.id, monthKey);
            if (statsCache.has(cacheKey)) {
                return statsCache.get(cacheKey);
            }

            // חישוב בפועל (הלוגיקה המקורית ללא שינוי)
            const result = _calculateStatsForMonthImpl(habit, monthKey);

            // שמירה במטמון
            statsCache.set(cacheKey, result);
            return result;
        }

        // הלוגיקה המקורית — לא שונה כלום, רק הועברה לפונקציה פנימית
        function _calculateStatsForMonthImpl(habit, monthKey) {
            const firstDayDate = getGregorianStartForMonthKey(monthKey);
            const startDayOfWeek = firstDayDate.getDay();

            if (habit.type === 'weekly') {
                const totalDaysInMonth = calculateDaysInBrowsingMonth(firstDayDate);
                const weeklyFreq = getEffectiveWeeklyTargetNow(habit);
                const firstDayGregorian = firstDayDate;
                const monthStart = firstDayGregorian;
                const monthEnd = addDays(firstDayGregorian, totalDaysInMonth - 1);

                let sunday = getSundayOfWeek(monthStart);
                let totalWeekScore = 0;
                let countedWeeks = 0;

                while (true) {
                    const weekEnd = addDays(sunday, 6);
                    if (sunday > monthEnd) break;
                    if (weekEnd < monthStart) { sunday = addDays(sunday, 7); continue; }

                    let activeDaysInThisMonth = 0;
                    let activeDaysTotal = 0;
                    for (let dow = 0; dow < 7; dow++) {
                        if (!(habit.workdays && habit.workdays[dow])) continue;
                        const dG = addDays(sunday, dow);
                        activeDaysTotal++;
                        if (dG >= monthStart && dG <= monthEnd) activeDaysInThisMonth++;
                    }

                    const hasAnyDayInThisMonth = activeDaysTotal > 0 && activeDaysInThisMonth > 0;

                    if (hasAnyDayInThisMonth) {
                        const { doneScore, activeDays, remainingActive, anyActionTaken } = getWeeklyStatsForWeekByDate(habit, sunday);
                        if (activeDays > 0 && anyActionTaken) {
                            let weekPct;
                            if ((doneScore + remainingActive) >= weeklyFreq) {
                                weekPct = 1;
                            } else {
                                weekPct = Math.min((doneScore + remainingActive) / weeklyFreq, 1);
                            }
                            totalWeekScore += weekPct;
                            countedWeeks++;
                        }
                    }

                    sunday = addDays(sunday, 7);
                }

                if (countedWeeks === 0) return { pct: 0, text: "-" };
                const pct = Math.round((totalWeekScore / countedWeeks) * 100);
                return { pct, text: `${pct}%` };
            }

            if (habit.type === 'monthly') {
                const { doneScore, activeDays, remainingActive, monthlyFreq, anyActionTaken } = getMonthlyStatsForHabitMonth(habit, monthKey);
                if (!anyActionTaken) return { pct: 0, text: "-" };
                let pctVal;
                if ((doneScore + remainingActive) >= monthlyFreq) {
                    pctVal = 1;
                } else {
                    pctVal = Math.min((doneScore + remainingActive) / monthlyFreq, 1);
                }
                const pct = Math.round(pctVal * 100);
                return { pct, text: `${pct}%` };
            }

            if(!habit.history || !habit.history[monthKey]) return { pct: 0, text: "-" };
            const history = habit.history[monthKey];

            let totalActive = 0;
            let totalV = 0;
            
            for(let i = 0; i < 30; i++) {
                const status = history[i];
                const cellDayOfWeek = (startDayOfWeek + i) % 7;
                const target = getTargetForDay(habit, cellDayOfWeek);
                
                if (typeof status === 'number') {
                    totalV += status;
                    totalActive += target;
                } else if(status === "V") { 
                    totalV += target; 
                    totalActive += target; 
                } else if(status === "X") { 
                    totalActive += target; 
                }
            }
            if(totalActive === 0) return { pct: 0, text: "-" };
            const pct = Math.round((totalV / totalActive) * 100);
            return { pct: pct, text: `${pct}%` };
        }
        // ---- סיום תיקון 4 ----

        function calculateTotalHabitAvg(habit) {
            if(!habit.history) return "-";
            let sumPct = 0;
            let countMonths = 0;
            for(let monthKey in habit.history) {
                const stats = calculateStatsForMonth(habit, monthKey);
                if(stats.text !== "-") {
                    sumPct += stats.pct;
                    countMonths++;
                }
            }
            return countMonths > 0 ? `${Math.round(sumPct / countMonths)}%` : "-";
        }



        let draggedHabitId = null;

        let dragState = null;

        function setupCardDragAndDrop(card, habitId) {
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedHabitId || draggedHabitId === habitId) return;
                const rect = card.getBoundingClientRect();
                card.classList.remove('drag-over-top', 'drag-over-bottom');
                const sameRow = e.clientY >= rect.top && e.clientY <= rect.bottom;
                const insertBefore = sameRow
                    ? e.clientX < rect.left + rect.width  * 0.5
                    : e.clientY < rect.top  + rect.height * 0.5;
                card.classList.add(insertBefore ? 'drag-over-top' : 'drag-over-bottom');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const insertBefore = card.classList.contains('drag-over-top');
                card.classList.remove('drag-over-top', 'drag-over-bottom');
                if (!draggedHabitId || draggedHabitId === habitId) return;
                reorderHabits(draggedHabitId, habitId, insertBefore);
            });
        }

        function attachDragHandle(card, habitId) {
            const handle = card.querySelector('.btn-drag-handle');
            if (!handle) return;
            handle.setAttribute('draggable', 'true');
            handle.addEventListener('dragstart', (e) => {
                draggedHabitId = habitId;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', habitId);
            });
            handle.addEventListener('dragend', () => {
                draggedHabitId = null;
                document.querySelectorAll('.habit-card').forEach(c => c.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
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
                btn.innerText = archiveViewOpen ? `סגור ארכיון${countSuffix}` : `ארכיון${countSuffix}`;
            }
        }

        function renderArchiveSection(archivedList) {
            const container = document.getElementById('archiveSection');
            if (!container) return;

            const btn = document.getElementById('btnShowArchive');
            if (btn) btn.innerText = `${archiveViewOpen ? 'סגור ארכיון' : 'ארכיון'}${archivedList.length ? ` (${archivedList.length})` : ''}`;

            if (!archivedList || archivedList.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:${getMutedTextColor()}; font-size:13px; padding:10px;">הארכיון ריק.</div>`;
                return;
            }

            // כותרת ארכיון
            const headerDiv = document.createElement('div');
            headerDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="font-size:16px; color:${getMutedTextColor()}; font-weight:700;">ארכיון (${archivedList.length})</div>
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
                setupCardDragAndDrop(card, habit.id);
                card.onclick = () => openMonthView(habit.id);

                // לוגיקה לפי סוג הרגל (יומי/שבועי/חודשי)
                if (habit.type === 'weekly' || habit.type === 'monthly') {
                    const isPeriodic = habit.type === 'weekly';
                    const dayTarget = isPeriodic 
                        ? (habit.weeklyDayTargets && habit.weeklyDayTargets[currentDayOfWeek]) || 1
                        : (habit.monthlyDayTargets && habit.monthlyDayTargets[currentDayOfWeek]) || 1;
                    
                    let wText = dayTarget === 1 ? "בוצע" : `${dayTarget}`;
                    let wStyle = "";
                    let isWActive = false;
                    let isNActive = false;
                    let isNHarmful = false;

                    if (dayTarget > 1) {
                        if (todayStatus === 'W') {
                            wText = "בוצע";
                            wStyle = getStatusProgressStyle(100);
                            isWActive = true;
                        } else if (typeof todayStatus === 'number') {
                            const rem = dayTarget - todayStatus;
                            wText = rem > 0 ? `${rem}` : "בוצע";
                            const pct = Math.round((todayStatus / dayTarget) * 100);
                            wStyle = getStatusProgressStyle(pct);
                        }
                    } else {
                        isWActive = (todayStatus === 'W');
                    }

                    isNActive = (todayStatus === 'N');
                    if (isPeriodic) {
                        const firstDayDate = getFirstHebrewDayDate(mainScreenDatePointer);
                        isNHarmful = isWeeklyNHarmful(habit, actualCurrentMonthKey, currentHebrewDayIndex, firstDayDate.getDay(), firstDayDate, calculateDaysInBrowsingMonth(mainScreenDatePointer));
                    } else {
                        isNHarmful = isMonthlyNHarmful(habit, actualCurrentMonthKey, currentHebrewDayIndex);
                    }

                    card.innerHTML = `
                        <button class="btn-card-menu" onclick="toggleCardMenu('${esc(habit.id)}', event)">⋮</button>
                        <div id="cardMenu-${esc(habit.id)}" class="card-menu-dropdown">
                            <div class="card-menu-item" onclick="editHabitFromHome('${esc(habit.id)}', event); closeAllCardMenus();">ערוך הרגל</div>
                            <div class="card-menu-item" onclick="duplicateHabit('${esc(habit.id)}', event); closeAllCardMenus();">שכפל הרגל</div>
                            <div class="card-menu-item" onclick="toggleHabitArchive('${esc(habit.id)}', event); closeAllCardMenus();">הסר מארכיון</div>
                            <div class="card-menu-item danger" onclick="deleteHabit('${esc(habit.id)}', event); closeAllCardMenus();">מחק הרגל</div>
                        </div>
                        <div class="habit-header">
                            <span class="habit-title" data-habit-title></span>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <span class="habit-stats-summary">חודשי: <span style="color: ${getScoreColor(mStats.pct, habit, mStats.text)}; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${esc(mStats.text)}</span></span>
                            </div>
                        </div>
                        <div class="controls-row">
                            <div class="status-buttons-group">
                                <div class="action-toggle btn-w-skip ${isNActive ? 'active' : ''} ${isNHarmful ? 'harmful' : ''}" onclick="setStatus('${esc(habit.id)}', 'N', event)">
                                    <span>לא בוצע</span>
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
                    let vText = "בוצע";
                    let vStyle = "";
                    let isVActive = false;

                    if (typeof todayStatus === 'number') {
                        const rem = target - todayStatus;
                        vText = rem > 0 ? `${rem}` : `בוצע`;
                        const pct = Math.round((todayStatus / target) * 100);
                        vStyle = getStatusProgressStyle(pct);
                        isVActive = (todayStatus >= target);
                    } else if (todayStatus === 'V') {
                        vText = `בוצע`;
                        vStyle = getStatusProgressStyle(100);
                        isVActive = true;
                    } else {
                        vText = target === 1 ? `בוצע` : `${target}`;
                    }

                    card.innerHTML = `
                        <button class="btn-card-menu" onclick="toggleCardMenu('${esc(habit.id)}', event)">⋮</button>
                        <div id="cardMenu-${esc(habit.id)}" class="card-menu-dropdown">
                            <div class="card-menu-item" onclick="editHabitFromHome('${esc(habit.id)}', event); closeAllCardMenus();">ערוך הרגל</div>
                            <div class="card-menu-item" onclick="duplicateHabit('${esc(habit.id)}', event); closeAllCardMenus();">שכפל הרגל</div>
                            <div class="card-menu-item" onclick="toggleHabitArchive('${esc(habit.id)}', event); closeAllCardMenus();">הסר מארכיון</div>
                            <div class="card-menu-item danger" onclick="deleteHabit('${esc(habit.id)}', event); closeAllCardMenus();">מחק הרגל</div>
                        </div>
                        <div class="habit-header">
                            <span class="habit-title" data-habit-title></span>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <span class="habit-stats-summary">חודשי: <span style="color: ${getScoreColor(mStats.pct, habit, mStats.text)}; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${esc(mStats.text)}</span></span>
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

        function moveHabit(id, direction, event) {
            if (event) event.stopPropagation();
            const idx = habits.findIndex(h => h.id === id);
            if (idx === -1) return;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= habits.length) return;
            [habits[idx], habits[newIdx]] = [habits[newIdx], habits[idx]];
            saveToStorage();
        }

        // ---- פילטר סימניות + לא סומן ----
        let activeBookmarkFilter = null; // null = הכל, colorKey = רק סימניה זו
        let showUnsignedOnly = false;    // true = רק הרגלים שלא סומנו היום

        // בודק אם הרגל מסוים סומן היום (כל סוג)
        function isHabitSignedToday(habit) {
            const history = peekMonthHistory(habit, actualCurrentMonthKey);
            const status = history[currentHebrewDayIndex];
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

        function renderBookmarkFilterBar() {
            const namedBookmarks = BOOKMARK_COLORS.filter(c => bookmarkLabels[c] && bookmarkLabels[c].trim() !== '');

            let container = document.getElementById('bookmarkFilterBar');
            if (!container) {
                container = document.createElement('div');
                container.id = 'bookmarkFilterBar';
                container.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-bottom:14px; align-items:center;';
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

            selectedHabitsArray.forEach(habit => {
                const mStats = calculateStatsForMonth(habit, comparisonMonthKey);
                const totalAvg = calculateTotalHabitAvg(habit);
                const themeColor = getThemeColor(habit.theme);
                const isArchived = habit.archived;
                const rowBg = isArchived ? bgArchived : bgActive;
                
                html += `
                    <tr style="background:${rowBg}; border-right:4px solid ${themeColor}; border-bottom:1px solid ${borderColor};">
                        <td style="padding:12px 14px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="width:10px; height:10px; border-radius:50%; background:${themeColor}; flex-shrink:0;"></span>
                                <span style="font-weight:600; color:${dark ? '#e2e8f0' : '#0f172a'};">${esc(habit.title)}</span>
                            </div>
                        </td>
                        <td style="padding:12px 14px; text-align:center; font-weight:700; color:${getScoreColor(mStats.pct, habit, mStats.text)};">${esc(mStats.text)}</td>
                        <td style="padding:12px 14px; text-align:center; font-weight:700; color:${getScoreColor(parseInt(totalAvg) || 0, habit, totalAvg)};">${esc(totalAvg)}</td>
                        <td style="padding:12px 14px; text-align:center;">
                            <span style="display:inline-block; padding:3px 10px; background:${isArchived ? (dark ? '#475569' : '#cbd5e1') : '#3b82f6'}; color:${isArchived ? (dark ? '#e2e8f0' : '#475569') : 'white'}; border-radius:12px; font-size:11px; font-weight:600;">${isArchived ? 'ארכיון' : 'פעיל'}</span>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
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
