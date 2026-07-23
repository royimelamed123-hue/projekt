        function getTargetForDay(habit, dayOfWeekIndex) {
            if (habit.type === 'regular') return 1;
            if (habit.dayTargets && habit.dayTargets[dayOfWeekIndex] !== undefined) {
                return habit.dayTargets[dayOfWeekIndex];
            }
            return 1;
        }

        let undoStack = [];
        let undoButtonTimer = null;

        // סוגי פעולות הניתנות לביטול:
        // { type: 'status', habitId, monthKey, dayIndex, previousValue } — שינוי סטטוס יום
        // { type: 'archive', habitId, previousArchived }               — ארכיון / הסרה מארכיון
        // { type: 'edit', habitId, previousHabit }                     — עריכת הרגל
        // { type: 'duplicate', newHabitId }                            — שכפול הרגל

        function pushUndoAction(action) {
            undoStack.push(action);
            if (undoStack.length > 30) undoStack.shift();
            updateUndoButtonVisibility();
        }

        function undoLastAction() {
            const action = undoStack.pop();
            if (!action) return;

            if (action.type === 'status') {
                const habit = habits.find(h => h.id === action.habitId);
                if (habit && habit.history && habit.history[action.monthKey]) {
                    habit.history[action.monthKey][action.dayIndex] = action.previousValue;
                    invalidateStatsCache(action.habitId);
                    saveToStorage();
                }
            } else if (action.type === 'archive') {
                const habit = habits.find(h => h.id === action.habitId);
                if (habit) {
                    habit.archived = action.previousArchived;
                    saveToStorage();
                }
            } else if (action.type === 'edit') {
                const idx = habits.findIndex(h => h.id === action.habitId);
                if (idx !== -1) {
                    habits[idx] = JSON.parse(JSON.stringify(action.previousHabit));
                    invalidateStatsCache(action.habitId);
                    saveToStorage();
                }
            } else if (action.type === 'duplicate') {
                habits = habits.filter(h => h.id !== action.newHabitId);
                saveToStorage();
            }

            updateUndoButtonVisibility();
        }

        function updateUndoButtonVisibility() {
            const btn = document.getElementById('undoFloatingBtn');
            
            // ביטול טיימר קודם אם קיים
            if (undoButtonTimer) {
                clearTimeout(undoButtonTimer);
                undoButtonTimer = null;
            }
            
            if (btn) {
                if (undoStack.length > 0) {
                    btn.style.display = 'flex';
                    // הגדרת טיימר להסתרת הכפתור אחרי 5 שניות
                    undoButtonTimer = setTimeout(() => {
                        btn.style.display = 'none';
                        undoButtonTimer = null;
                    }, 5000);
                } else {
                    btn.style.display = 'none';
                }
            }
        }

        function setStatus(habitId, statusType, event) {
            if(event) event.stopPropagation(); 
            const habit = habits.find(h => h.id === habitId);
            const monthHistory = getMonthHistory(habit, actualCurrentMonthKey);
            const currentStatus = monthHistory[currentHebrewDayIndex];
            pushUndoAction({ type: 'status', habitId, monthKey: actualCurrentMonthKey, dayIndex: currentHebrewDayIndex, previousValue: currentStatus });
            
            const target = getTargetForDay(habit, currentDayOfWeek);

            if (habit.type === 'monthly') {
                const mTarget = (habit.monthlyDayTargets && habit.monthlyDayTargets[currentDayOfWeek]) || 1;
                if (statusType === 'W') {
                    if (currentStatus === 'W') {
                        monthHistory[currentHebrewDayIndex] = "";
                    } else {
                        if (mTarget > 1) {
                            const cur = (typeof currentStatus === 'number') ? currentStatus : 0;
                            const next = cur + 1;
                            monthHistory[currentHebrewDayIndex] = next >= mTarget ? 'W' : next;
                        } else {
                            monthHistory[currentHebrewDayIndex] = 'W';
                        }
                    }
                } else if (statusType === 'N') {
                    monthHistory[currentHebrewDayIndex] = (currentStatus === 'N') ? "" : 'N';
                }
                invalidateStatsCache(habitId);
                saveToStorageForHabit(habitId);
                return;
            }

            if (habit.type === 'weekly') {
                if (statusType === 'W') {
                    if (currentStatus === 'W') {
                        monthHistory[currentHebrewDayIndex] = "";
                    } else {
                        const wTarget = (habit.weeklyDayTargets && habit.weeklyDayTargets[currentDayOfWeek]) || 1;
                        if (wTarget > 1) {
                            const cur = (typeof currentStatus === 'number') ? currentStatus : 0;
                            const next = cur + 1;
                            monthHistory[currentHebrewDayIndex] = next >= wTarget ? 'W' : next;
                        } else {
                            monthHistory[currentHebrewDayIndex] = 'W';
                        }
                    }
                } else if (statusType === 'N') {
                    if (currentStatus === 'N') {
                        monthHistory[currentHebrewDayIndex] = "";
                    } else {
                        monthHistory[currentHebrewDayIndex] = 'N';
                    }
                }
                invalidateStatsCache(habitId);
                saveToStorageForHabit(habitId);
                return;
            }

            if (statusType === 'V') {
                if (habit.type === 'x_times' || habit.type === 'regular') {
                    let currentCount = (typeof currentStatus === 'number') ? currentStatus : (currentStatus === 'V' ? target : 0);
                    if (currentCount >= target) {
                        monthHistory[currentHebrewDayIndex] = "";
                    } else {
                        monthHistory[currentHebrewDayIndex] = currentCount + 1;
                    }
                } else {
                    if (currentStatus === "V") {
                        monthHistory[currentHebrewDayIndex] = "";
                    } else {
                        monthHistory[currentHebrewDayIndex] = "V";
                    }
                }
            } else {
                if (currentStatus === statusType) {
                    monthHistory[currentHebrewDayIndex] = "";
                } else {
                    monthHistory[currentHebrewDayIndex] = statusType;
                }
            }
            invalidateStatsCache(habitId);
            saveToStorageForHabit(habitId);
        }

        function saveCardNote(habitId, event) {
            if(event) event.stopPropagation();
            const habit = habits.find(h => h.id === habitId);
            if(!habit) return;

            const textarea = document.getElementById(`noteText-${habitId}`);
            const textVal = textarea.value.trim();

            habit.lastTextareaVal = textVal;

            if(!habit.notesLog) habit.notesLog = [];
            
            habit.notesLog = habit.notesLog.filter(n => !(n.dateStr === currentLetterDayOnly && n.monthKey === actualCurrentMonthKey));
            
            if (textVal !== "") {
                habit.notesLog.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
                    text: textVal,
                    dateStr: currentLetterDayOnly,
                    monthKey: actualCurrentMonthKey,
                    timestamp: Date.now()
                });
            }
            
            saveToStorage();
        }

        function deleteNote(noteId) {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if(!habit || !habit.notesLog) return;

            const noteToDelete = habit.notesLog.find(n => n.id === noteId);
            habit.notesLog = habit.notesLog.filter(n => n.id !== noteId);

            if (noteToDelete && noteToDelete.dateStr === currentLetterDayOnly && noteToDelete.monthKey === actualCurrentMonthKey) {
                habit.lastTextareaVal = "";
            }

            saveToStorage();
        }

        function toggleEditNote(noteId) {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit || !habit.notesLog) return;

            const note = habit.notesLog.find(n => n.id === noteId);
            if (!note) return;

            const container = document.getElementById(`noteTextContainer-${noteId}`);
            const btn = document.getElementById(`btnEditNote-${noteId}`);

            if (note.isEditing) {
                const textarea = document.getElementById(`editInput-${noteId}`);
                const newVal = textarea.value.trim();
                note.text = newVal;
                note.isEditing = false;

                if (note.dateStr === currentLetterDayOnly && note.monthKey === actualCurrentMonthKey) {
                    habit.lastTextareaVal = newVal;
                }

                saveToStorage();
            } else {
                note.isEditing = true;
                // בניית textarea בצורה בטוחה (ללא innerHTML עם note.text)
                container.innerHTML = '';
                const ta = document.createElement('textarea');
                ta.id = `editInput-${noteId}`;
                ta.className = 'note-edit-textarea';
                ta.value = note.text;
                container.appendChild(ta);

                btn.classList.add('save-active');
                btn.title = "שמור שינויים";
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;

                ta.focus();
                ta.setSelectionRange(ta.value.length, ta.value.length);
            }
        }

        function openAddNoteModal() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit) return;

            document.getElementById('modalHabitTitle').innerText = `הוספת הערה להרגל: ${habit.title}`;
            document.getElementById('modalNoteText').value = "";
            
            const targetMonthComps = getHebrewDateComponents(browsingDatePointer);
            const totalDaysInMonth = calculateDaysInBrowsingMonth(browsingDatePointer);
            const monthHistory = peekMonthHistory(habit, targetMonthComps.key);

            const firstDayDate = getFirstHebrewDayDate(browsingDatePointer);
            const startDayOfWeek = firstDayDate.getDay();

            const grid = document.getElementById('modalDaysGrid');
            grid.innerHTML = "";

            for (let i = 0; i < totalDaysInMonth; i++) {
                const dayBtn = document.createElement('button');
                dayBtn.className = 'modal-day-btn';
                dayBtn.innerText = hebrewDays[i];
                
                const status = monthHistory[i] || "";
                const cellDayOfWeek = (startDayOfWeek + i) % 7;
                const target = getTargetForDay(habit, cellDayOfWeek);

                if (typeof status === 'number') {
                    const pct = Math.round((status / target) * 100);
                    dayBtn.style.cssText = `${dayBtn.style.cssText}; ${getStatusProgressStyle(pct)}`;
                } else if(status) {
                    dayBtn.classList.add(`m-status-${status}`);
                }

                if (targetMonthComps.key === actualCurrentMonthKey && i === currentHebrewDayIndex) {
                    dayBtn.classList.add('selected');
                    modalSelectedDayIndex = i;
                }

                dayBtn.onclick = () => {
                    document.querySelectorAll('.modal-day-btn').forEach(b => b.classList.remove('selected'));
                    dayBtn.classList.add('selected');
                    modalSelectedDayIndex = i;
                };

                grid.appendChild(dayBtn);
            }

            if (targetMonthComps.key !== actualCurrentMonthKey) {
                const firstBtn = grid.firstChild;
                if (firstBtn) {
                    firstBtn.classList.add('selected');
                    modalSelectedDayIndex = 0;
                }
            }

            document.getElementById('addNoteModal').style.display = 'flex';
            document.getElementById('modalNoteText').focus();
        }

        function closeAddNoteModal() {
            document.getElementById('addNoteModal').style.display = 'none';
            modalSelectedDayIndex = null;
        }

        function saveModalNote() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit || modalSelectedDayIndex === null) return;

            const textVal = document.getElementById('modalNoteText').value.trim();
            if (!textVal) {
                alert("אנא הקלד תוכן להערה.");
                return;
            }

            const targetMonthComps = getHebrewDateComponents(browsingDatePointer);
            
            let letterDay = hebrewDays[modalSelectedDayIndex];
            if (letterDay.length === 1) letterDay += "'";
            else if (letterDay.length === 2 && letterDay !== "טו" && letterDay !== "טז") letterDay = letterDay.charAt(0) + '"' + letterDay.charAt(1);
            else if (letterDay === "טו") letterDay = 'ט"ו';
            else if (letterDay === "טז") letterDay = 'ט"ז';

            if(!habit.notesLog) habit.notesLog = [];

            habit.notesLog = habit.notesLog.filter(n => !(n.dateStr === letterDay && n.monthKey === targetMonthComps.key));

            habit.notesLog.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
                text: textVal,
                dateStr: letterDay,
                monthKey: targetMonthComps.key,
                timestamp: Date.now()
            });

            if (targetMonthComps.key === actualCurrentMonthKey && modalSelectedDayIndex === currentHebrewDayIndex) {
                habit.lastTextareaVal = textVal;
            }

            closeAddNoteModal();
            saveToStorage();
        }

        function openMonthView(habitId) {
            const habit = habits.find(h => h.id === habitId);
            if(!habit) return;
            selectedHabitIdForView = habitId;
            browsingDatePointer = new Date(); 
            
            updateHabitDropdownDisplay();
            updateMonthNavigationDisplay();
            updateArchiveButtonText();
            renderFullMonthGrid();
            renderMonthNotesList();
            
            document.getElementById('mainAppScreen').style.display = 'none';
            document.getElementById('monthViewScreen').style.display = 'block';
        }

        function updateArchiveButtonText() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            const btn = document.querySelector('.btn-month-action-archive');
            if (btn && habit) {
                btn.textContent = habit.archived ? 'הסר מארכיון' : 'הוסף לארכיון';
            }
        }

        function closeMonthView() {
            document.getElementById('monthViewScreen').style.display = 'none';
            document.getElementById('mainAppScreen').style.display = 'block';
            selectedHabitIdForView = null;
            renderHabits();
        }

        function jumpToCurrentMonth() {
            browsingDatePointer = new Date();
            updateMonthNavigationDisplay();
            renderFullMonthGrid();
            renderMonthNotesList();
        }

        function resetCurrentMonthData() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit) return;
            const targetMonthComps = getHebrewDateComponents(browsingDatePointer);
            
            if (confirm(`האם אתה בטוח שברצונך לאפס לחלוטין את נתוני הסימונים וההערות של ההרגל "${habit.title}" לחודש ${targetMonthComps.key}?`)) {
                if (habit.history && habit.history[targetMonthComps.key]) {
                    habit.history[targetMonthComps.key] = Array(30).fill("");
                    applyAutomaticOffDaysForMonth(habit, targetMonthComps.key);
                }
                if (habit.notesLog) {
                    habit.notesLog = habit.notesLog.filter(n => n.monthKey !== targetMonthComps.key);
                }
                if (targetMonthComps.key === actualCurrentMonthKey) {
                    habit.lastTextareaVal = "";
                }
                invalidateStatsCache(habit.id);
                saveToStorage();
            }
        }

        function resetTotalHabitData() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit) return;

            if (confirm(`האם אתה בטוח שברצונך למחוק לחלוטין את כל היסטוריית הסימונים וההערות של ההרגל "${habit.title}" מכל החודשים?`)) {
                habit.history = {};
                const currentMonthComps = getHebrewDateComponents(new Date());
                habit.history[currentMonthComps.key] = Array(30).fill("");
                applyAutomaticOffDaysForMonth(habit, currentMonthComps.key);
                
                habit.notesLog = [];
                habit.lastTextareaVal = "";
                invalidateStatsCache(habit.id);
                saveToStorage();
            }
        }

        function toggleDayInFullView(dayIndex) {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if(!habit) return;
            
            const comps = getHebrewDateComponents(browsingDatePointer);
            const monthHistory = getMonthHistory(habit, comps.key);
            const currentStatus = monthHistory[dayIndex];
            pushUndoAction({ type: 'status', habitId: selectedHabitIdForView, monthKey: comps.key, dayIndex, previousValue: currentStatus });
            
            const firstDayDate = getFirstHebrewDayDate(browsingDatePointer);
            const cellDayOfWeek = (firstDayDate.getDay() + dayIndex) % 7;
            const target = getTargetForDay(habit, cellDayOfWeek);
            
            if (habit.type === 'weekly') {
                const wTarget = (habit.weeklyDayTargets && habit.weeklyDayTargets[cellDayOfWeek]) || 1;
                let nextStatus = "";
                if (currentStatus === "" || currentStatus === undefined) {
                    nextStatus = "N";
                } else if (currentStatus === "N") {
                    nextStatus = wTarget > 1 ? 1 : "W";
                } else if (typeof currentStatus === 'number') {
                    nextStatus = (currentStatus + 1 < wTarget) ? currentStatus + 1 : "W";
                } else if (currentStatus === "W") {
                    nextStatus = "";
                }
                monthHistory[dayIndex] = nextStatus;
                invalidateStatsCache(selectedHabitIdForView);
                saveToStorage();
                return;
            }

            if (habit.type === 'monthly') {
                const mTarget = (habit.monthlyDayTargets && habit.monthlyDayTargets[cellDayOfWeek]) || 1;
                let nextStatus = "";
                if (currentStatus === "" || currentStatus === undefined) {
                    nextStatus = "N";
                } else if (currentStatus === "N") {
                    nextStatus = mTarget > 1 ? 1 : "W";
                } else if (typeof currentStatus === 'number') {
                    nextStatus = (currentStatus + 1 < mTarget) ? currentStatus + 1 : "W";
                } else if (currentStatus === "W") {
                    nextStatus = "";
                }
                monthHistory[dayIndex] = nextStatus;
                invalidateStatsCache(selectedHabitIdForView);
                saveToStorage();
                return;
            }
            
            let nextStatus = "";
            if (habit.type === 'x_times' || habit.type === 'regular') {
                if (currentStatus === "" || currentStatus === undefined) {
                    nextStatus = "א";
                } else if (currentStatus === "א") {
                    nextStatus = "X";
                } else if (currentStatus === "X") {
                    nextStatus = target > 1 ? 1 : "V";
                } else if (typeof currentStatus === 'number') {
                    if (currentStatus < target) {
                        nextStatus = currentStatus + 1;
                    } else {
                        nextStatus = "";
                    }
                } else if (currentStatus === "V") {
                    nextStatus = "";
                }
            } else {
                if (currentStatus === "" || currentStatus === undefined) {
                    nextStatus = "א";
                } else if (currentStatus === "א") {
                    nextStatus = "X";
                } else if (currentStatus === "X") {
                    nextStatus = "V";
                } else if (currentStatus === "V") {
                    nextStatus = "";
                }
            }
            
            monthHistory[dayIndex] = nextStatus;
            invalidateStatsCache(selectedHabitIdForView);
            saveToStorage();
        }

        function getPeriodDates(habit, periodType, anchorDate) {
            if (periodType === 'weekly') {
                const sunday = getSundayOfWeek(anchorDate);
                return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
            } else {
                const comps = getHebrewDateComponents(anchorDate);
                const firstDay = getGregorianStartForMonthKey(comps.key);
                const totalDays = calculateDaysInBrowsingMonth(firstDay);
                return Array.from({ length: totalDays }, (_, i) => addDays(firstDay, i));
            }
        }

        function getPeriodDayTargets(habit, periodType) {
            return periodType === 'weekly' ? habit.weeklyDayTargets : habit.monthlyDayTargets;
        }

        // מספר הימים ה"מלא" של התקופה: שבוע = 7, חודש = מספר הימים בפועל של אותו חודש עברי (29/30).
        function getPeriodLength(periodType, dates) {
            if (periodType === 'weekly') return 7;
            // חודשי: אורך החודש העברי בפועל (29 או 30) לפי רשימת התאריכים של אותו חודש
            return (dates && dates.length) ? dates.length : 30;
        }

        // היעד האפקטיבי נגזר מכמות הדילוגים המותרים:
        // יעד = אורך התקופה פחות מספר הפעמים שמותר לא לעשות (חסום ל-1 לפחות).
        // כך היעד מתאים אוטומטית לחודש של 29 או 30 ימים.
        function getEffectiveTarget(habit, periodType, dates) {
            const periodLength = getPeriodLength(periodType, dates);
            const skips = getAllowedSkips(habit, periodType);
            if (skips === null || skips === undefined) {
                // נפילה לאחור: תאימות לנתונים ישנים שטרם עברו מיגרציה
                const legacy = (periodType === 'weekly' ? habit.weeklyFreq : habit.monthlyFreq);
                return (legacy && legacy > 0) ? legacy : 1;
            }
            const target = periodLength - skips;
            return target < 1 ? 1 : target;
        }

        // כמות הפעמים שמותר לדלג בתקופה (המודל החדש). מוחזר null אם לא הוגדר.
        function getAllowedSkips(habit, periodType) {
            const val = (periodType === 'weekly' ? habit.weeklyAllowedSkips : habit.monthlyAllowedSkips);
            return (val === null || val === undefined) ? null : val;
        }

        function getPeriodFreq(habit, periodType, dates) {
            return getEffectiveTarget(habit, periodType, dates);
        }

        // היעד האפקטיבי לשבוע הנוכחי (אורך 7).
        function getEffectiveWeeklyTargetNow(habit) {
            const dates = getPeriodDates(habit, 'weekly', new Date());
            return getEffectiveTarget(habit, 'weekly', dates);
        }

        // היעד האפקטיבי לחודש עברי מסוים (לפי אורכו בפועל 29/30).
        function getEffectiveMonthlyTargetForMonth(habit, monthKey) {
            const anchor = getGregorianStartForMonthKey(monthKey);
            const dates = getPeriodDates(habit, 'monthly', anchor);
            return getEffectiveTarget(habit, 'monthly', dates);
        }

        function getGenericPeriodStats(habit, periodType, anchorDate) {
            const dates = getPeriodDates(habit, periodType, anchorDate);
            const dayTargets = getPeriodDayTargets(habit, periodType);
            const freq = getPeriodFreq(habit, periodType, dates);

            let doneScore = 0, activeDays = 0, remainingActive = 0, anyActionTaken = false;

            for (const dayGregorian of dates) {
                const dow = dayGregorian.getDay();
                const isActive = habit.workdays && habit.workdays[dow];
                if (!isActive) continue;

                const status = getHabitStatusForGregorianDate(habit, dayGregorian);
                const target = (dayTargets && dayTargets[dow]) || 1;
                const isEmpty = (status === "" || status === undefined);

                if (!isEmpty) {
                    activeDays++;
                    if (typeof status === 'number') {
                        doneScore += Math.min(status / target, 1);
                        if (status > 0) anyActionTaken = true;
                    } else if (status === 'W') {
                        doneScore += 1;
                        anyActionTaken = true;
                    } else if (status === 'N') {
                        anyActionTaken = true;
                    }
                } else {
                    remainingActive++;
                }
            }

            return { doneScore, activeDays, remainingActive, freq, anyActionTaken };
        }

        function isGenericNHarmful(habit, periodType, dayGregorian) {
            const dates = getPeriodDates(habit, periodType, dayGregorian);
            const dayTargets = getPeriodDayTargets(habit, periodType);
            const freq = getPeriodFreq(habit, periodType, dates);

            let doneScore = 0, openPotential = 0;

            for (const d of dates) {
                const dow = d.getDay();
                const isActive = habit.workdays && habit.workdays[dow];
                if (!isActive) continue;

                const status = getHabitStatusForGregorianDate(habit, d);
                const target = (dayTargets && dayTargets[dow]) || 1;
                const isEmpty = (status === "" || status === undefined);

                if (!isEmpty) {
                    if (typeof status === 'number') doneScore += Math.min(status / target, 1);
                    else if (status === 'W') doneScore += 1;
                } else {
                    openPotential++;
                }
            }

            return (doneScore + openPotential) < freq;
        }

        function getMonthlyStatsForHabitMonth(habit, monthKey) {
            const anchorDate = getGregorianStartForMonthKey(monthKey);
            const s = getGenericPeriodStats(habit, 'monthly', anchorDate);
            return { doneScore: s.doneScore, activeDays: s.activeDays, remainingActive: s.remainingActive, monthlyFreq: s.freq, anyActionTaken: s.anyActionTaken };
        }

        function isMonthlyNHarmful(habit, monthKey, dayIndex) {
            const firstDayDate = getGregorianStartForMonthKey(monthKey);
            const dayGregorian = addDays(firstDayDate, dayIndex);
            return isGenericNHarmful(habit, 'monthly', dayGregorian);
        }

        function calculateMonthlyPctForCurrentMonth(habit, monthKey) {
            const { doneScore, activeDays, remainingActive, monthlyFreq, anyActionTaken } = getMonthlyStatsForHabitMonth(habit, monthKey);
            if (activeDays === 0 && doneScore === 0) return "-";
            if ((doneScore + remainingActive) >= monthlyFreq) return "100%";
            return `${Math.round(((doneScore + remainingActive) / monthlyFreq) * 100)}%`;
        }

        function getHebrewMonthDayIndexForDate(gregorianDate) {
            const comps = getHebrewDateComponents(gregorianDate);
            const firstDayOfThatMonth = getFirstHebrewDayDate(gregorianDate);
            const dayIdx = daysBetween(firstDayOfThatMonth, gregorianDate);
            return { monthKey: comps.key, dayIdx };
        }

        function getHabitStatusForGregorianDate(habit, gregorianDate) {
            const { monthKey, dayIdx } = getHebrewMonthDayIndexForDate(gregorianDate);
            if (dayIdx < 0 || dayIdx > 29) return "";
            if (!habit.history || !habit.history[monthKey]) return "";
            const val = habit.history[monthKey][dayIdx];
            return (val === undefined) ? "" : val;
        }

        function getSundayOfWeek(date) {
            const d = new Date(date.getTime());
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - d.getDay());
            return d;
        }

        function isWeeklyNHarmfulByDate(habit, dayGregorian) {
            return isGenericNHarmful(habit, 'weekly', dayGregorian);
        }

        function isWeeklyNHarmful(habit, monthKey, dayIndex, startDayOfWeek, firstDayOfMonthGregorian, totalDaysInMonth) {
            const dayGregorian = addDays(firstDayOfMonthGregorian, dayIndex);
            return isWeeklyNHarmfulByDate(habit, dayGregorian);
        }

        function getWeeklyStatsForWeekByDate(habit, sundayGregorian) {
            const s = getGenericPeriodStats(habit, 'weekly', sundayGregorian);
            return { doneScore: s.doneScore, activeDays: s.activeDays, remainingActive: s.remainingActive, weeklyFreq: s.freq, anyActionTaken: s.anyActionTaken };
        }

        function getWeeklyStatsForWeek(habit, monthKey, sundayGregorian, firstDayOfMonthGregorian, totalDaysInMonth) {
            return getWeeklyStatsForWeekByDate(habit, sundayGregorian);
        }

        function calculateWeeklyPctForCurrentWeek(habit, monthKey, currentDayIndex, startDayOfWeek, firstDayOfMonthGregorian, totalDaysInMonth) {
            const viewedDate = addDays(firstDayOfMonthGregorian, currentDayIndex);
            const sunday = getSundayOfWeek(viewedDate);
            const { doneScore, activeDays, remainingActive, weeklyFreq } = getWeeklyStatsForWeekByDate(habit, sunday);
            if (activeDays === 0 && doneScore === 0) return "-";
            if (doneScore + remainingActive >= weeklyFreq) return "100%";
            return `${Math.round(((doneScore + remainingActive) / weeklyFreq) * 100)}%`;
        }

        function getScoreColor(pct, habit, text) {
            if (text === '-') return '';
            if (pct === null || pct === undefined || isNaN(pct)) return '';
            const passing = (habit && habit.passingScore !== null && habit.passingScore !== undefined) ? habit.passingScore : null;
            const minimum = (habit && habit.minScore !== null && habit.minScore !== undefined) ? habit.minScore : null;

            if (passing === null && minimum === null) return '';
            if (passing !== null && minimum === null) {
                return pct >= passing ? '#22a84a' : '#e74c3c';
            }
            if (passing === null && minimum !== null) {
                return pct <= minimum ? '#e74c3c' : '#22a84a';
            }
            if (pct >= passing) return '#22a84a';
            if (pct <= minimum) return '#e74c3c';
            return '#d97706';
        }

        function getScoreBgColor(pct, habit) {
            return '';
        }
