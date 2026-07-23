        // ---- ייצוא לאקסל (חודש נוכחי בתצוגה) ----
        function exportMonthToExcel() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit) return;

            const targetMonthComps = getHebrewDateComponents(browsingDatePointer);
            const totalDays = calculateDaysInBrowsingMonth(browsingDatePointer);
            const firstDayDate = getFirstHebrewDayDate(browsingDatePointer);
            const startDayOfWeek = firstDayDate.getDay();
            const monthHistory = peekMonthHistory(habit, targetMonthComps.key);

            const weekdayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

            // בניית שורות הנתונים
            const rows = [['יום', 'יום בשבוע', 'סטטוס', 'ציון']];

            for (let i = 0; i < totalDays; i++) {
                const cellDayOfWeek = (startDayOfWeek + i) % 7;
                const status = monthHistory[i];
                const target = getTargetForDay(habit, cellDayOfWeek);
                const dayLabel = hebrewDays[i];
                const weekdayLabel = weekdayNames[cellDayOfWeek];

                let statusLabel = '-';
                let scoreLabel = '';

                if (habit.type === 'weekly' || habit.type === 'monthly') {
                    if (status === 'W') { statusLabel = 'בוצע'; scoreLabel = '100%'; }
                    else if (status === 'N') { statusLabel = 'לא בוצע'; scoreLabel = '0%'; }
                    else if (typeof status === 'number') {
                        const t = (habit.type === 'weekly' ? habit.weeklyDayTargets : habit.monthlyDayTargets)?.[cellDayOfWeek] || 1;
                        statusLabel = `${status}/${t}`;
                        scoreLabel = `${Math.round((status / t) * 100)}%`;
                    }
                } else {
                    if (status === 'V') { statusLabel = 'בוצע'; scoreLabel = '100%'; }
                    else if (status === 'X') { statusLabel = 'פספוס'; scoreLabel = '0%'; }
                    else if (status === 'א') { statusLabel = 'אונס'; scoreLabel = '-'; }
                    else if (typeof status === 'number') {
                        statusLabel = status >= target ? 'בוצע' : `${status}/${target}`;
                        scoreLabel = `${Math.round((status / target) * 100)}%`;
                    }
                }

                rows.push([dayLabel, weekdayLabel, statusLabel, scoreLabel]);
            }

            // חישוב ציון חודשי
            const mStats = calculateStatsForMonth(habit, targetMonthComps.key);
            rows.push([]);
            rows.push(['ציון חודשי', '', mStats.text, '']);

            // המרה ל-CSV עם BOM לעברית
            const bom = '\uFEFF';
            const csv = bom + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${habit.title} — ${targetMonthComps.key}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        // ---- סיום ייצוא לאקסל ----

        // ---- יוצר את ה-dropdown של תפריט הכרטיס ----
        function createCardMenuHTML(habitId) {
            return `
                <div id="cardMenu-${esc(habitId)}" class="card-menu-dropdown">
                    <div class="card-menu-item" onclick="editHabitFromHome('${esc(habitId)}', event); closeAllCardMenus();">ערוך הרגל</div>
                    <div class="card-menu-item" onclick="duplicateHabit('${esc(habitId)}', event); closeAllCardMenus();">שכפל הרגל</div>
                    <div class="card-menu-item" onclick="toggleHabitArchive('${esc(habitId)}', event); closeAllCardMenus();">הוסף לארכיון</div>
                    <div class="card-menu-item danger" onclick="deleteHabit('${esc(habitId)}', event); closeAllCardMenus();">מחק הרגל</div>
                </div>`;
        }

        // ---- יוצר את חלק ה-header של כרטיס ----
        // שורה 1: ציון (ימין) | ידית (מרכז) | שלוש נקודות (שמאל)
        // שורה 2: שם ההרגל
        function createCardHeaderHTML(habit, mStats) {
            return `
                <div class="habit-header">
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <button class="btn-card-menu" onclick="toggleCardMenu('${esc(habit.id)}', event)" style="position:static; margin:0;">⋮</button>
                        <span class="btn-drag-handle" title="גרור לסידור מחדש" style="flex:1; text-align:center;">⠿⠿</span>
                        <span class="habit-stats-summary" style="margin:0;">חודשי: <span style="color: ${getScoreColor(mStats.pct, habit, mStats.text)}; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${esc(mStats.text)}</span></span>
                    </div>
                    <div style="width:100%; margin-top:4px;">
                        <span class="habit-title" data-habit-title style="display:block; width:100%;"></span>
                    </div>
                </div>`;
        }

        // ---- יוצר את אזור ההערות של כרטיס ----
        function createCardNotesHTML(habitId) {
            return `
                <div class="card-notes-container" onclick="event.stopPropagation();">
                    <textarea id="noteText-${esc(habitId)}" class="card-notes-textarea" placeholder="רשום הערה ליום זה..."></textarea>
                    <button class="btn-card-notes-save" onclick="saveCardNote('${esc(habitId)}', event)">שמור</button>
                </div>`;
        }

        // ---- יוצר כרטיס בסיסי (div) עם מאפיינים משותפים ----
        function createBaseCard(habit) {
            const card = document.createElement('div');
            card.className = 'habit-card';
            card.style.borderRight = `5px solid ${getThemeColor(habit.theme)}`;
            setupCardDragAndDrop(card, habit.id);
            card.onclick = () => openMonthView(habit.id);
            return card;
        }

        // ---- כרטיס להרגל חודשי (monthly) ----
        function createMonthlyHabitCard(habit, todayStatus, mStats, currentDayTextVal) {
            const mTarget = (habit.monthlyDayTargets && habit.monthlyDayTargets[currentDayOfWeek]) || 1;
            const isNHarmfulM = isMonthlyNHarmful(habit, actualCurrentMonthKey, currentHebrewDayIndex);
            const isNActiveM = (todayStatus === 'N');

            let wTextM = mTarget === 1 ? "בוצע" : `${mTarget}`;
            let wStyleM = "";
            let isWActiveM = false;
            if (todayStatus === 'W') {
                wTextM = "בוצע";
                wStyleM = getStatusProgressStyle(100);
                isWActiveM = true;
            } else if (mTarget > 1 && typeof todayStatus === 'number') {
                const rem = mTarget - todayStatus;
                wTextM = rem > 0 ? `${rem}` : "בוצע";
                const pct = Math.round((todayStatus / mTarget) * 100);
                wStyleM = getStatusProgressStyle(pct);
            }

            const card = createBaseCard(habit);
            card.innerHTML =
                createCardMenuHTML(habit.id) +
                createCardHeaderHTML(habit, mStats) +
                `<div class="controls-row">
                    <div class="status-buttons-group">
                        <div class="action-toggle btn-w-skip ${isNActiveM ? 'active' : ''} ${isNHarmfulM ? 'harmful' : ''}" onclick="setStatus('${esc(habit.id)}', 'N', event)">
                            <span>לא בוצע</span>
                        </div>
                        <div class="action-toggle btn-w-done ${isWActiveM ? 'active' : ''}" style="${wStyleM}" onclick="setStatus('${esc(habit.id)}', 'W', event)">
                            <span>${esc(wTextM)}</span>
                        </div>
                    </div>
                </div>` +
                createCardNotesHTML(habit.id);

            card.querySelector('[data-habit-title]').textContent = habit.title;
            card.querySelector(`#noteText-${CSS.escape(habit.id)}`).value = currentDayTextVal;
            return { card, mTarget, isNHarmfulM, todayStatus };
        }

        // ---- כרטיס להרגל שבועי (weekly) ----
        function createWeeklyHabitCard(habit, todayStatus, mStats, currentDayTextVal) {
            const firstDayDate = getFirstHebrewDayDate(mainScreenDatePointer);
            const firstDayGregorian = firstDayDate;
            const totalDaysInMonth = calculateDaysInBrowsingMonth(mainScreenDatePointer);
            const wTarget = (habit.weeklyDayTargets && habit.weeklyDayTargets[currentDayOfWeek]) || 1;

            let wText = wTarget === 1 ? "בוצע" : `${wTarget}`;
            let wStyle = "";
            let isWActive = false;

            if (wTarget > 1) {
                if (todayStatus === 'W') {
                    wText = "בוצע"; wStyle = getStatusProgressStyle(100); isWActive = true;
                } else if (typeof todayStatus === 'number') {
                    const rem = wTarget - todayStatus;
                    wText = rem > 0 ? `${rem}` : `בוצע`;
                    wStyle = getStatusProgressStyle(Math.round((todayStatus / wTarget) * 100));
                }
            } else {
                isWActive = (todayStatus === 'W');
            }

            const isNActive = (todayStatus === 'N');
            const isNHarmful = isWeeklyNHarmful(habit, actualCurrentMonthKey, currentHebrewDayIndex, firstDayDate.getDay(), firstDayGregorian, totalDaysInMonth);

            const card = createBaseCard(habit);
            card.innerHTML =
                createCardMenuHTML(habit.id) +
                createCardHeaderHTML(habit, mStats) +
                `<div class="controls-row">
                    <div class="status-buttons-group">
                        <div class="action-toggle btn-w-skip ${isNActive ? 'active' : ''} ${isNHarmful ? 'harmful' : ''}" onclick="setStatus('${esc(habit.id)}', 'N', event)">
                            <span>לא בוצע</span>
                        </div>
                        <div class="action-toggle btn-w-done ${isWActive ? 'active' : ''}" style="${wStyle}" onclick="setStatus('${esc(habit.id)}', 'W', event)">
                            <span>${esc(wText)}</span>
                        </div>
                    </div>
                </div>` +
                createCardNotesHTML(habit.id);

            card.querySelector('[data-habit-title]').textContent = habit.title;
            card.querySelector(`#noteText-${CSS.escape(habit.id)}`).value = currentDayTextVal;
            return { card, wTarget, isNHarmful, todayStatus };
        }

        // ---- כרטיס להרגל יומי (x_times / regular) ----
        function createDailyHabitCard(habit, todayStatus, target, mStats, currentDayTextVal) {
            let vText = "בוצע";
            let vStyle = "";
            let isVActive = false;

            if (habit.type === 'x_times' || habit.type === 'regular') {
                if (typeof todayStatus === 'number') {
                    const rem = target - todayStatus;
                    vText = rem > 0 ? `${rem}` : `בוצע`;
                    vStyle = getStatusProgressStyle(Math.round((todayStatus / target) * 100));
                    isVActive = (todayStatus >= target);
                } else if (todayStatus === 'V') {
                    vText = `בוצע`;
                    vStyle = getStatusProgressStyle(100);
                    isVActive = true;
                } else {
                    vText = target === 1 ? `בוצע` : `${target}`;
                }
            } else {
                isVActive = (todayStatus === 'V');
            }

            const card = createBaseCard(habit);
            card.innerHTML =
                createCardMenuHTML(habit.id) +
                createCardHeaderHTML(habit, mStats) +
                `<div class="controls-row">
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
                </div>` +
                createCardNotesHTML(habit.id);

            card.querySelector('[data-habit-title]').textContent = habit.title;
            card.querySelector(`#noteText-${CSS.escape(habit.id)}`).value = currentDayTextVal;
            return card;
        }

        function renderHabits() {
            const grid = document.getElementById('habitsGrid');
            grid.innerHTML = "";

            const searchInput = document.getElementById('habitSearchInput');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            const activeHabitsList = habits.filter(h => !h.archived);
            const archivedHabitsList = habits.filter(h => h.archived);

            if (archiveViewOpen) renderArchiveSection(archivedHabitsList);
            renderBookmarkFilterBar();

            const dragHint = document.getElementById('dragHintMessage');
            if (dragHint) dragHint.style.display = (activeHabitsList.length > 1 && !searchTerm) ? 'block' : 'none';

            if (habits.length === 0) {
                grid.innerHTML = `<div class="empty-state-message">לא הוגדרו הרגלים, אנא לחץ על כפתור "הוסף הרגל" כדי להתחיל.</div>`;
                document.getElementById('statTotalHabits').innerText = 0;
                document.getElementById('statAvgSuccess').innerText = "-";
                document.getElementById('statTodaySuccess').innerText = "-";
                return;
            }

            const bookmarkFilteredList = activeBookmarkFilter
                ? activeHabitsList.filter(h => h.theme === activeBookmarkFilter)
                : activeHabitsList;

            const unsignedFilteredList = showUnsignedOnly
                ? bookmarkFilteredList.filter(h => !isHabitSignedToday(h))
                : bookmarkFilteredList;

            const visibleHabitsList = searchTerm
                ? unsignedFilteredList.filter(h => h.title.toLowerCase().includes(searchTerm))
                : unsignedFilteredList;

            if (activeHabitsList.length === 0) {
                if (grid.children.length === 0) {
                    grid.innerHTML = `<div class="empty-state-message">אין הרגלים פעילים כרגע (יתכן שהם בארכיון).</div>`;
                }
                document.getElementById('statTotalHabits').innerText = 0;
                document.getElementById('statAvgSuccess').innerText = "-";
                document.getElementById('statTodaySuccess').innerText = "-";
                return;
            }

            if (visibleHabitsList.length === 0) {
                let msg = '';
                if (showUnsignedOnly && activeBookmarkFilter) {
                    msg = 'כל ההרגלים בסימניה זו סומנו היום.';
                } else if (showUnsignedOnly) {
                    msg = 'כל ההרגלים סומנו היום.';
                } else if (searchTerm) {
                    msg = `לא נמצאו הרגלים התואמים לחיפוש "${searchInput.value}".`;
                } else if (activeBookmarkFilter) {
                    msg = 'אין הרגלים עם סימניה זו.';
                }
                if (msg) grid.innerHTML = `<div class="empty-state-message">${msg}</div>`;
            }

            let sumMonthAverages = 0;
            let countMonthAverages = 0;
            let todayV = 0;
            let todayActive = 0;

            activeHabitsList.forEach(habit => {
                const isVisibleInSearch = visibleHabitsList.includes(habit);
                const currentMonthHistory = peekMonthHistory(habit, actualCurrentMonthKey);
                const todayStatus = currentMonthHistory[currentHebrewDayIndex];
                const target = getTargetForDay(habit, currentDayOfWeek);
                const mStats = calculateStatsForMonth(habit, actualCurrentMonthKey);

                if (mStats.text !== "-") {
                    sumMonthAverages += mStats.pct;
                    countMonthAverages++;
                }

                if (!habit.notesLog) habit.notesLog = [];
                const dayNoteObj = habit.notesLog.find(n => n.dateStr === currentLetterDayOnly && n.monthKey === actualCurrentMonthKey);
                const currentDayTextVal = dayNoteObj ? dayNoteObj.text : "";

                let card;

                if (habit.type === 'monthly') {
                    const { card: mCard, mTarget, isNHarmfulM } = createMonthlyHabitCard(habit, todayStatus, mStats, currentDayTextVal);
                    card = mCard;
                    if (typeof todayStatus === 'number') { todayV += todayStatus / mTarget; todayActive += 1; }
                    else if (todayStatus === 'W') { todayV += 1; todayActive += 1; }
                    else if (todayStatus === 'N' && isNHarmfulM) { todayActive += 1; }
                } else if (habit.type === 'weekly') {
                    const { card: wCard, wTarget, isNHarmful } = createWeeklyHabitCard(habit, todayStatus, mStats, currentDayTextVal);
                    card = wCard;
                    if (typeof todayStatus === 'number') { todayV += todayStatus / wTarget; todayActive += 1; }
                    else if (todayStatus === 'W') { todayV += 1; todayActive += 1; }
                    else if (todayStatus === 'N' && isNHarmful) { todayActive += 1; }
                } else {
                    card = createDailyHabitCard(habit, todayStatus, target, mStats, currentDayTextVal);
                    if (typeof todayStatus === 'number') { todayV += todayStatus; todayActive += target; }
                    else if (todayStatus === "V") { todayV += target; todayActive += target; }
                    else if (todayStatus === "X") { todayActive += target; }
                }

                if (isVisibleInSearch) { grid.appendChild(card); attachDragHandle(card, habit.id); }
            });

            document.getElementById('statTotalHabits').innerText = activeHabitsList.length;
            document.getElementById('statAvgSuccess').innerText = countMonthAverages > 0 ? `${Math.round(sumMonthAverages / countMonthAverages)}%` : "-";
            document.getElementById('statTodaySuccess').innerText = todayActive > 0 ? `${Math.round((todayV / todayActive) * 100)}%` : "-";
        }

        function renderFullMonthGrid() {
            const grid = document.getElementById('fullMonthGrid');
            grid.innerHTML = "";
            
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if(!habit) return;

            const isDaily = (habit.type === 'x_times' || habit.type === 'regular');
            const isComparable = (habit.type === 'weekly' || habit.type === 'monthly');
            const tabGraph = document.getElementById('tabGraph');
            const tabComparison = document.getElementById('tabComparison');
            if (tabGraph) tabGraph.style.display = isDaily ? 'block' : 'none';
            if (tabComparison) tabComparison.style.display = isComparable ? 'block' : 'none';
            if (!isDaily && currentMonthTab === 'graph') switchMonthTab('calendar');
            if (!isComparable && currentMonthTab === 'comparison') switchMonthTab('calendar');

            if (currentMonthTab === 'graph' && isDaily) {
                renderMonthGraph();
            }
            if (currentMonthTab === 'comparison' && isComparable) {
                renderComparisonView();
            }
            if(!habit) return;

            const targetMonthComps = getHebrewDateComponents(browsingDatePointer);
            const totalDaysInMonth = calculateDaysInBrowsingMonth(browsingDatePointer);
            const firstDayDate = getFirstHebrewDayDate(browsingDatePointer);
            const startDayOfWeek = firstDayDate.getDay();

            // כפתור ייצוא CSV — מעדכן את הטקסט לפי החודש המוצג
            let exportBtn = document.getElementById('btnExportMonthCsv');
            if (!exportBtn) {
                exportBtn = document.createElement('button');
                exportBtn.id = 'btnExportMonthCsv';
                exportBtn.className = 'btn-edit-habit-trigger';
                exportBtn.onclick = exportMonthToExcel;
                // מוסיף לפני כפתור "חזור" — מחפשים את שורת הכפתורים בראש מסך החודש
                const backBtn = document.querySelector('#monthViewScreen .btn-back');
                if (backBtn && backBtn.parentNode) {
                    backBtn.parentNode.insertBefore(exportBtn, backBtn);
                }
            }
            exportBtn.textContent = `ייצוא ${targetMonthComps.month} ל-CSV`;

            const mStats = calculateStatsForMonth(habit, targetMonthComps.key);
            const totalAvgText = calculateTotalHabitAvg(habit);
            const totalAvgPct = parseInt(totalAvgText, 10);

            const browsingMonthEl = document.getElementById('browsingMonthAvg');
            browsingMonthEl.innerText = mStats.text;
            browsingMonthEl.style.color = getScoreColor(mStats.pct, habit, mStats.text);
            browsingMonthEl.style.background = '';
            browsingMonthEl.style.borderRadius = '';
            browsingMonthEl.style.padding = '';

            const totalAvgEl = document.getElementById('habitTotalAvg');
            totalAvgEl.innerText = totalAvgText;
            totalAvgEl.style.color = getScoreColor(totalAvgPct, habit, totalAvgText);
            totalAvgEl.style.background = '';
            totalAvgEl.style.borderRadius = '';
            totalAvgEl.style.padding = '';

            const monthHistory = peekMonthHistory(habit, targetMonthComps.key);

            for (let i = 0; i < startDayOfWeek; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-empty-cell';
                grid.appendChild(emptyCell);
            }

            for (let i = 0; i < totalDaysInMonth; i++) {
                const cell = document.createElement('div');
                cell.className = 'full-day-cell';
                
                const isToday = (targetMonthComps.key === actualCurrentMonthKey && i === currentHebrewDayIndex);
                if (isToday) cell.classList.add('today-target');

                let letterDay = hebrewDays[i];
                const status = monthHistory[i];
                let cellStyle = "";
                let statusLabel = "-";
                
                const cellDayOfWeek = (startDayOfWeek + i) % 7;
                const target = getTargetForDay(habit, cellDayOfWeek);

                if (habit.type === 'weekly') {
                    const wTarget = (habit.weeklyDayTargets && habit.weeklyDayTargets[cellDayOfWeek]) || 1;
                    const firstDayGregorian = firstDayDate;

                    if (typeof status === 'number') {
                        const pct = Math.round((status / wTarget) * 100);
                        cellStyle = getStatusProgressStyle(pct);
                        statusLabel = status >= wTarget ? "בוצע" : `${status}/${wTarget}`;
                    } else if (status === 'W') {
                        cell.classList.add('m-status-V');
                        statusLabel = "בוצע";
                    } else if (status === 'N') {
                        const dayGregorian = addDays(firstDayGregorian, i);
                        const harmful = isWeeklyNHarmfulByDate(habit, dayGregorian);
                        cell.classList.add(harmful ? 'm-status-X' : 'm-status-א');
                        statusLabel = "לא בוצע";
                    }
                } else if (habit.type === 'monthly') {
                    const mTarget = (habit.monthlyDayTargets && habit.monthlyDayTargets[cellDayOfWeek]) || 1;

                    if (typeof status === 'number') {
                        const pct = Math.round((status / mTarget) * 100);
                        cellStyle = getStatusProgressStyle(pct);
                        statusLabel = status >= mTarget ? "בוצע" : `${status}/${mTarget}`;
                    } else if (status === 'W') {
                        cell.classList.add('m-status-V');
                        statusLabel = "בוצע";
                    } else if (status === 'N') {
                        const harmful = isMonthlyNHarmful(habit, targetMonthComps.key, i);
                        cell.classList.add(harmful ? 'm-status-X' : 'm-status-א');
                        statusLabel = "לא בוצע";
                    }
                } else {
                    if (typeof status === 'number') {
                        if (status >= target) {
                            statusLabel = "בוצע";
                            cell.classList.add('m-status-V');
                        } else {
                            statusLabel = `${status}/${target}`;
                            const pct = Math.round((status / target) * 100);
                            cellStyle = getStatusProgressStyle(pct);
                        }
                    } else {
                        if(status) cell.classList.add(`m-status-${status}`);
                        if(status === "V") statusLabel = "בוצע";
                        if(status === "X") statusLabel = "פספוס";
                        if(status === "א") statusLabel = "אונס";
                    }
                }

                cell.setAttribute('style', cellStyle);
                cell.innerHTML = `
                    <span class="cell-day-label">${letterDay}</span>
                    <span class="cell-status-text">${statusLabel}</span>
                `;
                
                cell.onclick = () => toggleDayInFullView(i);
                grid.appendChild(cell);
            }
        }

        function renderMonthNotesList() {
            const listContainer = document.getElementById('notesList');
            listContainer.innerHTML = "";

            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if(!habit) return;

            if (!habit.notesLog) {
                habit.notesLog = [];
            }

            const targetMonthComps = getHebrewDateComponents(browsingDatePointer);
            const filteredNotes = habit.notesLog.filter(n => n.monthKey === targetMonthComps.key && n.text !== "");

            if(filteredNotes.length === 0) {
                listContainer.innerHTML = `<div style="color:${getMutedTextColor()}; font-size:13px; text-align:center; margin-top:20px;">אין הערות מתועדות לחודש זה.</div>`;
                return;
            }

            filteredNotes.sort((a, b) => {
                const cleanDayA = a.dateStr.replace(/['"]/g, '');
                const cleanDayB = b.dateStr.replace(/['"]/g, '');
                return hebrewDays.indexOf(cleanDayA) - hebrewDays.indexOf(cleanDayB);
            });

            filteredNotes.forEach(note => {
                const item = document.createElement('div');
                item.className = 'logged-note-item';

                const svgEdit = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
                const svgSave = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                const svgDel  = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

                item.innerHTML = `
                    <div class="note-item-header">
                        <span class="logged-note-date" data-note-date></span>
                        <div class="note-actions-wrapper">
                            <button id="btnEditNote-${esc(note.id)}" class="btn-edit-note ${note.isEditing ? 'save-active' : ''}" title="${note.isEditing ? 'שמור' : 'ערוך הערה'}" onclick="toggleEditNote('${esc(note.id)}')">
                                ${note.isEditing ? svgSave : svgEdit}
                            </button>
                            <button class="btn-delete-note" title="מחק הערה" onclick="deleteNote('${esc(note.id)}')">
                                ${svgDel}
                            </button>
                        </div>
                    </div>
                    <div id="noteTextContainer-${esc(note.id)}" style="width: 100%;"></div>
                `;

                // הכנסה בטוחה של תוכן
                item.querySelector('[data-note-date]').textContent = `[${note.dateStr}]`;

                const contentContainer = item.querySelector(`#noteTextContainer-${CSS.escape(note.id)}`);
                if (note.isEditing) {
                    const ta = document.createElement('textarea');
                    ta.id = `editInput-${note.id}`;
                    ta.className = 'note-edit-textarea';
                    ta.value = note.text;
                    contentContainer.appendChild(ta);
                } else {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'note-content-area';
                    contentDiv.textContent = note.text;
                    contentContainer.appendChild(contentDiv);
                }

                listContainer.appendChild(item);
                if (note.isEditing) {
                    const textarea = document.getElementById(`editInput-${note.id}`);
                    if (textarea) {
                        textarea.focus();
                        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                    }
                }
            });
        }

        function isDarkModeEnabled() {
            return !!document.body && document.body.classList.contains('dark-mode');
        }

        function getStatusProgressStyle(pct) {
            const darkMode = isDarkModeEnabled();
            const fillColor = darkMode ? '#14532d' : '#bbf7d0';
            const baseColor = darkMode ? '#1e293b' : '#f8fafc';
            const borderColor = darkMode ? '#22c55e' : '#86efac';
            const textColor = darkMode ? '#dcfce7' : '';
            return `background: linear-gradient(to top, ${fillColor} ${pct}%, ${baseColor} ${pct}%); border-color: ${borderColor};${textColor ? ` color: ${textColor};` : ''}`;
        }

        function getNeutralPanelStyle() {
            return isDarkModeEnabled()
                ? 'background:#1e293b; border:1px solid #334155;'
                : 'background:#f8fafc; border:1px solid #e2e8f0;';
        }

        function getMutedTextColor() {
            return isDarkModeEnabled() ? '#cbd5e1' : '#64748b';
        }

        function toggleDarkMode() {
            const checkbox = document.getElementById('btnDarkModeToggle');
            const isDark = checkbox ? checkbox.checked : document.body.classList.toggle('dark-mode');
            document.body.classList.toggle('dark-mode', isDark);
            storageSaveAsync('otzarya_dark_mode', isDark ? 'true' : 'false');
            if (document.getElementById('monthViewScreen')?.style.display === 'block') {
                renderFullMonthGrid();
                renderMonthNotesList();
            } else {
                renderHabits();
            }
        }

        async function initDarkMode() {
            // אם אוצריא מסר מצב נושא ב-boot — כבר טופל. כאן טוענים מהאחסון.
            const saved = await storageGet('otzarya_dark_mode');
            if (saved === 'true') {
                document.body.classList.add('dark-mode');
                const checkbox = document.getElementById('btnDarkModeToggle');
                if (checkbox) checkbox.checked = true;
            }
        }
