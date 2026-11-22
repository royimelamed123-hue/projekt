        function toggleConfigWeekday(dayIndex) {
            configSelectedWeekdays[dayIndex] = !configSelectedWeekdays[dayIndex];
            updateConfigModalUI();
        }



        function updateConfigModalUI() {
            const safeEl = (id) => document.getElementById(id);
            const safeToggle = (id, cls, val) => { const el = safeEl(id); if(el) { if(val) { if(!el.classList.contains(cls)) el.classList.add(cls); } else { el.classList.remove(cls); } } };
            const safeDisplay = (id, val) => { const el = safeEl(id); if(el && el.style.display !== val) el.style.display = val; };
                
            safeDisplay('weeklyConfigSection', 'block');

            setWeeklyMode(weeklyDayMode);
            
            for (let i = 0; i < 7; i++) {
                const btn = safeEl(`weekday-${i}`);
                const targetBox = safeEl(`targetBox-${i}`);
                const weeklyTargetBox = safeEl(`weeklyTargetBox-${i}`);
                
                if (!btn) continue;
                if (configSelectedWeekdays[i]) {
                    btn.classList.add('active');
                    if (targetBox) { targetBox.style.opacity = '1'; targetBox.style.pointerEvents = 'auto'; }
                    if (weeklyTargetBox) { weeklyTargetBox.style.opacity = '1'; weeklyTargetBox.style.pointerEvents = 'auto'; }
                } else {
                    btn.classList.remove('active');
                    if (targetBox) { targetBox.style.opacity = '0.4'; targetBox.style.pointerEvents = 'none'; }
                    if (weeklyTargetBox) { weeklyTargetBox.style.opacity = '0.4'; weeklyTargetBox.style.pointerEvents = 'none'; }
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
            
            const weeklyDayTargets = readWeeklyDayTargetsFromUI();
            let weeklyAllowedSkips = 0;
            if (isNaN(weeklyAllowedSkips) || weeklyAllowedSkips < 0) weeklyAllowedSkips = 0;
            if (weeklyAllowedSkips > 7) weeklyAllowedSkips = 7;


            
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
                const editedHabitId = habit.id;
                const habitSnapshot = JSON.parse(JSON.stringify(habit));
                const oldWorkdays = habit.workdays ? [...habit.workdays] : null;
                const isTypeChanged = habit.type !== configSelectedType;

                const applyEdit = () => {
                    habit.title = title;
                    habit.description = desc;
                    habit.type = 'weekly';
                    habit.workdays = [...configSelectedWeekdays];
                    habit.weeklyDayTargets = weeklyDayTargets;
                    habit.weeklyAllowedSkips = weeklyAllowedSkips;
                    delete habit.weeklyFreq;
                    delete habit.dayTargets;

                    if (habit.history) {
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
                                let newTarget = weeklyDayTargets[cellDayOfWeek];
                                if (typeof currentStatus === 'number') {
                                    if (currentStatus >= newTarget) {
                                        habit.history[monthKey][i] = newTarget;
                                    }
                                } else if (currentStatus === 'V' || currentStatus === 'W') {
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
                    habit.scoreMethod = configSelectedScoreMethod;
                    habit.schemaVersion = HABIT_SCHEMA_VERSION;
                    pushUndoAction({ type: 'edit', habitId: habit.id, previousHabit: JSON.parse(JSON.stringify(habitSnapshot)) });
                    invalidateStatsCache(habit.id);
                    updateHabitDropdownDisplay();
                };

                if (isTypeChanged) {
                    showConfirm(`שינוי סוג ההרגל יאפס לחלוטין את כל היסטוריית הסימונים של הרגל זה. האם להמשיך?`, () => {
                        habit.history = {};
                        applyEdit();
                        closeHabitConfigModal();
                        saveToStorage();
                        executeScoreExtras(passingScore, minScore);
                    });
                    return;
                }

                applyEdit();
                invalidateStatsCache(habit.id);
            } else {
                const newHabit = {
                    id: Date.now().toString(),
                    title: title,
                    description: desc,
                    type: 'weekly',
                    workdays: [...configSelectedWeekdays],
                    weeklyDayTargets: weeklyDayTargets,
                    weeklyAllowedSkips: weeklyAllowedSkips,
                    passingScore: passingScore,
                    minScore: minScore,
                    theme: selectedHabitTheme,
                    scoreMethod: configSelectedScoreMethod,
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
            
            const _editedHabitId = isModalEditMode ? selectedHabitIdForView : null;
            closeHabitConfigModal();
            saveToStorage();
            if (_editedHabitId) {
                invalidateStatsCache(_editedHabitId);
                if (selectedHabitIdForView) {
                    renderFullMonthGrid();
                }
            }
            executeScoreExtras(passingScore, minScore);
            executeScoreMethodExtras(configSelectedScoreMethod);
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

            showConfirm(`האם אתה בטוח שברצונך למחוק לחלוטין את ההרגל "${habit.title}" יחד עם כל ההיסטוריה וההערות שלו?`, () => {
                if(selectedHabitIdForView === id) closeMonthView();
                invalidateStatsCache(id);
                habits = habits.filter(h => h.id !== id);
                saveToStorage();
            });
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
            pushUndoAction({ type: 'duplicate', newHabitId: newHabit.id });
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

            showConfirm(`האם אתה בטוח שברצונך למחוק לחלוטין את ההרגל "${habit.title}" יחד עם כל ההיסטוריה וההערות שלו?`, () => {
                invalidateStatsCache(selectedHabitIdForView);
                habits = habits.filter(h => h.id !== selectedHabitIdForView);
                closeMonthView();
                saveToStorage();
            });
        }
