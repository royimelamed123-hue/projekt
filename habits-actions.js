        function setConfigHabitType(type) {
            configSelectedType = type;
            updateConfigModalUI();
        }

        function toggleConfigWeekday(dayIndex) {
            configSelectedWeekdays[dayIndex] = !configSelectedWeekdays[dayIndex];
            updateConfigModalUI();
        }

        function applyBulkTargetToActiveDays() {
            const bulkEl = document.getElementById('bulkTargetInput');
            const bulkVal = parseInt(bulkEl ? bulkEl.value : 1, 10);
            if (isNaN(bulkVal) || bulkVal < 1) return;
            for (let i = 0; i < 7; i++) {
                if (configSelectedWeekdays[i]) {
                    document.getElementById(`targetDay-${i}`).value = bulkVal;
                }
            }
        }

        function applyWeeklyBulkTargetToActiveDays() {
            const weeklyBulkEl = document.getElementById('weeklyBulkTargetInput');
            const bulkVal = parseInt(weeklyBulkEl ? weeklyBulkEl.value : 1, 10);
            if (isNaN(bulkVal) || bulkVal < 1) return;
            for (let i = 0; i < 7; i++) {
                if (configSelectedWeekdays[i]) {
                    document.getElementById(`weeklyTargetDay-${i}`).value = bulkVal;
                }
            }
        }

        function updateConfigModalUI() {
            const safeEl = (id) => document.getElementById(id);
            const safeToggle = (id, cls, val) => { const el = safeEl(id); if(el) el.classList.toggle(cls, val); };
            const safeDisplay = (id, val) => { const el = safeEl(id); if(el) el.style.display = val; };

            safeToggle('typeBtnXTimes', 'active', configSelectedType === 'x_times' || configSelectedType === 'regular');
            safeToggle('typeBtnWeekly', 'active', configSelectedType === 'weekly');
            safeToggle('typeBtnMonthly', 'active', configSelectedType === 'monthly');
            safeDisplay('xTimesConfigSection', (configSelectedType === 'x_times' || configSelectedType === 'regular') ? 'block' : 'none');
            safeDisplay('weeklyConfigSection', configSelectedType === 'weekly' ? 'block' : 'none');
            safeDisplay('monthlyConfigSection', configSelectedType === 'monthly' ? 'block' : 'none');

            setXTimesMode(xTimesMode);
            setWeeklyMode(weeklyDayMode);
            setMonthlyMode(monthlyDayMode);
            
            for (let i = 0; i < 7; i++) {
                const btn = safeEl(`weekday-${i}`);
                const targetBox = safeEl(`targetBox-${i}`);
                const weeklyTargetBox = safeEl(`weeklyTargetBox-${i}`);
                const monthlyTargetBox = safeEl(`monthlyTargetBox-${i}`);
                
                if (!btn) continue;
                if (configSelectedWeekdays[i]) {
                    btn.classList.add('active');
                    if (targetBox) { targetBox.style.opacity = '1'; targetBox.style.pointerEvents = 'auto'; }
                    if (weeklyTargetBox) { weeklyTargetBox.style.opacity = '1'; weeklyTargetBox.style.pointerEvents = 'auto'; }
                    if (monthlyTargetBox) { monthlyTargetBox.style.opacity = '1'; monthlyTargetBox.style.pointerEvents = 'auto'; }
                } else {
                    btn.classList.remove('active');
                    if (targetBox) { targetBox.style.opacity = '0.4'; targetBox.style.pointerEvents = 'none'; }
                    if (weeklyTargetBox) { weeklyTargetBox.style.opacity = '0.4'; weeklyTargetBox.style.pointerEvents = 'none'; }
                    if (monthlyTargetBox) { monthlyTargetBox.style.opacity = '0.4'; monthlyTargetBox.style.pointerEvents = 'none'; }
                }
            }
        }

        function saveHabitConfig() {
            const title = document.getElementById('configHabitTitle').value.trim();
            const desc = document.getElementById('configHabitDesc').value.trim();
            
            if (!title) {
                alert("אנא הזן את שם ההרגל.");
                return;
            }
            
            let dayTargets = [1, 1, 1, 1, 1, 1, 1];
            if (configSelectedType === 'x_times' || configSelectedType === 'regular') {
                dayTargets = readDayTargetsFromUI();
            }

            // המודל החדש: הקלט מייצג כמה פעמים מותר לדלג (לא לעשות) בתקופה.
            let weeklyDayTargets = [1, 1, 1, 1, 1, 1, 1];
            let weeklyAllowedSkips = 0;
            if (configSelectedType === 'weekly') {
                weeklyDayTargets = readWeeklyDayTargetsFromUI();
                weeklyAllowedSkips = parseInt(document.getElementById('weeklyFreqInput').value, 10);
                if (isNaN(weeklyAllowedSkips) || weeklyAllowedSkips < 0) weeklyAllowedSkips = 0;
                if (weeklyAllowedSkips > 7) weeklyAllowedSkips = 7;
            }

            let monthlyDayTargets = [1, 1, 1, 1, 1, 1, 1];
            let monthlyAllowedSkips = 0;
            if (configSelectedType === 'monthly') {
                monthlyDayTargets = readMonthlyDayTargetsFromUI();
                monthlyAllowedSkips = parseInt(document.getElementById('monthlyFreqInput').value, 10);
                if (isNaN(monthlyAllowedSkips) || monthlyAllowedSkips < 0) monthlyAllowedSkips = 0;
            }
            
            const passingRaw = document.getElementById('passingScoreInput').value.trim();
            const minRaw = document.getElementById('minScoreInput').value.trim();
            let passingScore = (passingRaw === '' || passingRaw === '-') ? null : parseInt(passingRaw, 10);
            let minScore = (minRaw === '' || minRaw === '-') ? null : parseInt(minRaw, 10);
            if (passingScore !== null && isNaN(passingScore)) passingScore = null;
            if (minScore !== null && isNaN(minScore)) minScore = null;
            if (passingScore !== null && passingScore <= 0) passingScore = 0;
            if (passingScore !== null && passingScore >= 100) passingScore = 100;
            if (minScore !== null && minScore <= 0) minScore = 0;
            if (minScore !== null && minScore >= 100) minScore = 100;
            if (passingScore !== null && minScore !== null && minScore > passingScore) minScore = passingScore;

            if (isModalEditMode) {
                const habit = habits.find(h => h.id === selectedHabitIdForView);
                if (!habit) return;
                const habitSnapshot = JSON.parse(JSON.stringify(habit)); // snapshot לפני עריכה
                
                const isTypeChanged = habit.type !== configSelectedType;
                
                if (isTypeChanged) {
                    if (!confirm(`שינוי סוג ההרגל יאפס לחלוטין את כל היסטוריית הסימונים של הרגל זה. האם להמשיך?`)) {
                        return;
                    }
                    habit.history = {};
                }
                
                const oldWorkdays = habit.workdays ? [...habit.workdays] : null;

                habit.title = title;
                habit.description = desc;
                habit.type = configSelectedType;
                habit.workdays = [...configSelectedWeekdays];
                habit.dayTargets = dayTargets;
                if (configSelectedType === 'weekly') {
                    habit.weeklyDayTargets = weeklyDayTargets;
                    habit.weeklyAllowedSkips = weeklyAllowedSkips;
                    delete habit.weeklyFreq;
                }
                if (configSelectedType === 'monthly') {
                    habit.monthlyDayTargets = monthlyDayTargets;
                    habit.monthlyAllowedSkips = monthlyAllowedSkips;
                    delete habit.monthlyFreq;
                }

                if (habit.type === 'x_times' && habit.history) {
                    for (let monthKey in habit.history) {
                        if (!Array.isArray(habit.history[monthKey])) continue;
                        let startDayOfWeek = 0;
                        try {
                            const monthStartDate = getGregorianStartForMonthKey(monthKey);
                            startDayOfWeek = monthStartDate.getDay();
                        } catch(e) {
                            startDayOfWeek = new Date().getDay(); 
                        }
                        for (let i = 0; i < habit.history[monthKey].length; i++) {
                            let currentStatus = habit.history[monthKey][i];
                            let cellDayOfWeek = (startDayOfWeek + i) % 7;
                            let newTarget = dayTargets[cellDayOfWeek];
                            if (typeof currentStatus === 'number') {
                                if (currentStatus >= newTarget) {
                                    habit.history[monthKey][i] = newTarget;
                                }
                            } else if (currentStatus === 'V') {
                                // יום שסומן כ"בוצע" (כמות 1) — כאשר מעלים את הכמות הופך לספירה חלקית 1/X
                                if (newTarget > 1) {
                                    habit.history[monthKey][i] = 1;
                                }
                            }
                        }
                    }
                }
                if (habit.type === 'weekly' && habit.history) {
                    for (let monthKey in habit.history) {
                        if (!Array.isArray(habit.history[monthKey])) continue;
                        let startDayOfWeek = 0;
                        try {
                            startDayOfWeek = getGregorianStartForMonthKey(monthKey).getDay();
                        } catch(e) { startDayOfWeek = new Date().getDay(); }
                        for (let i = 0; i < habit.history[monthKey].length; i++) {
                            let currentStatus = habit.history[monthKey][i];
                            if (typeof currentStatus === 'number') {
                                let cellDayOfWeek = (startDayOfWeek + i) % 7;
                                let newTarget = weeklyDayTargets[cellDayOfWeek];
                                if (currentStatus >= newTarget) {
                                    habit.history[monthKey][i] = 'W';
                                }
                            }
                        }
                    }
                }
                
                for (let monthKey in habit.history) {
                    applyAutomaticOffDaysForMonth(habit, monthKey, isTypeChanged ? null : oldWorkdays);
                }
                habit.passingScore = passingScore;
                habit.minScore = minScore;
                habit.theme = selectedHabitTheme;
                habit.schemaVersion = HABIT_SCHEMA_VERSION;

                invalidateStatsCache(habit.id);
                updateHabitDropdownDisplay();
            } else {
                const newHabit = {
                    id: Date.now().toString(),
                    title: title,
                    description: desc,
                    type: configSelectedType,
                    workdays: [...configSelectedWeekdays],
                    dayTargets: dayTargets,
                    weeklyDayTargets: configSelectedType === 'weekly' ? weeklyDayTargets : undefined,
                    weeklyAllowedSkips: configSelectedType === 'weekly' ? weeklyAllowedSkips : undefined,
                    monthlyDayTargets: configSelectedType === 'monthly' ? monthlyDayTargets : undefined,
                    monthlyAllowedSkips: configSelectedType === 'monthly' ? monthlyAllowedSkips : undefined,
                    passingScore: passingScore,
                    minScore: minScore,
                    theme: selectedHabitTheme,
                    schemaVersion: HABIT_SCHEMA_VERSION,
                    history: {},
                    notesLog: [],
                    lastTextareaVal: ""
                };
                
                const currentMonthComps = getHebrewDateComponents(new Date());
                newHabit.history[currentMonthComps.key] = Array(30).fill("");
                applyAutomaticOffDaysForMonth(newHabit, currentMonthComps.key);
                
                habits.push(newHabit);
            }
            
            closeHabitConfigModal();
            saveToStorage();
            executeScoreExtras(passingScore, minScore);
        }

        function editHabitFromHome(id, event) {
            if (event) event.stopPropagation();
            selectedHabitIdForView = id;
            openHabitConfigModal(true);
        }

        function deleteHabit(id, event) {
            if(event) event.stopPropagation(); 
            const habit = habits.find(h => h.id === id);
            if(!habit) return;

            if(confirm(`האם אתה בטוח שברצונך למחוק לחלוטין את ההרגל "${habit.title}" יחד עם כל ההיסטוריה וההערות שלו?`)) {
                if(selectedHabitIdForView === id) closeMonthView();
                invalidateStatsCache(id);
                habits = habits.filter(h => h.id !== id);
                saveToStorage();
            }
        }

        function duplicateHabit(id, event) {
            if(event) event.stopPropagation();
            const habit = habits.find(h => h.id === id);
            if(!habit) return;

            const newHabit = JSON.parse(JSON.stringify(habit));
            newHabit.id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8);
            newHabit.title = `${habit.title} (עותק)`;
            newHabit.history = {};
            newHabit.notesLog = [];
            newHabit.lastTextareaVal = "";

            habits.push(newHabit);
            saveToStorage();
        }

        function archiveCurrentHabitFromMonthView() {
            if (!selectedHabitIdForView) return;
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit) return;
            pushUndoAction({ type: 'archive', habitId: habit.id, previousArchived: habit.archived });
            habit.archived = !habit.archived;
            closeMonthView();
            saveToStorage();
        }

        function deleteCurrentHabitFromMonthView() {
            if(!selectedHabitIdForView) return;
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if(!habit) return;

            if(confirm(`האם אתה בטוח שברצונך למחוק לחלוטין את ההרגל "${habit.title}" יחד עם כל ההיסטוריה וההערות שלו?`)) {
                invalidateStatsCache(selectedHabitIdForView);
                habits = habits.filter(h => h.id !== selectedHabitIdForView);
                closeMonthView();
                saveToStorage();
            }
        }
