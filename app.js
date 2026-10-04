
        // ---- ערכת נושא אוצריא ----
        // קבלת הצבעים מאוצריא והחלתם על משתני CSS
        function applyOtzariaTheme(theme) {
            if (!theme || !theme.colorScheme) return;
            const cs = theme.colorScheme;
            const root = document.documentElement;

            // צבעי הבסיס - Material Design 3
            root.style.setProperty('--otz-primary',          cs.primary          || '');
            root.style.setProperty('--otz-on-primary',       cs.onPrimary        || '');
            root.style.setProperty('--otz-secondary',        cs.secondary        || '');
            root.style.setProperty('--otz-on-secondary',     cs.onSecondary      || '');
            root.style.setProperty('--otz-surface',          cs.surface          || '');
            root.style.setProperty('--otz-on-surface',       cs.onSurface        || '');
            root.style.setProperty('--otz-outline',          cs.outline          || '');
            root.style.setProperty('--otz-error',            cs.error            || '');
            root.style.setProperty('--otz-on-error',         cs.onError          || '');

            // צבעים נוספים (SDK 1.1)
            if (cs.surfaceContainerHighest) root.style.setProperty('--otz-surface-highest',  cs.surfaceContainerHighest);
            if (cs.surfaceContainerHigh)    root.style.setProperty('--otz-surface-high',     cs.surfaceContainerHigh);
            if (cs.surfaceContainer)        root.style.setProperty('--otz-surface-container',cs.surfaceContainer);
            if (cs.onSurfaceVariant)        root.style.setProperty('--otz-on-surface-variant',cs.onSurfaceVariant);
            if (cs.secondaryContainer)      root.style.setProperty('--otz-secondary-container',cs.secondaryContainer);
            if (cs.onSecondaryContainer)    root.style.setProperty('--otz-on-secondary-container',cs.onSecondaryContainer);

            // גופן
            if (theme.typography && theme.typography.fontFamily) {
                root.style.setProperty('--otz-font', "'" + theme.typography.fontFamily + "', 'David', serif");
            }

            // מצב כהה/בהיר — מסנכרן עם מצב אוצריא אם אין העדפה שמורה
            // בדיקה א-סינכרונית
            storageGet('otzarya_dark_mode').then(savedDark => {
                if (savedDark === null || savedDark === undefined) {
                    const isDark = theme.mode === 'dark';
                    document.body.classList.toggle('dark-mode', isDark);
                    const checkbox = document.getElementById('btnDarkModeToggle');
                    if (checkbox) checkbox.checked = isDark;
                }
            }).catch(() => {});
        }

        // ---- otzShowMessage — הצגת הודעות דרך Otzaria ui.feedback ----
        function otzShowMessage(text, type) {
            if (HAS_OTZARIA) {
                try { 
                    // SDK מגדיר 3 פונקציות נפרדות לפי סוג ההודעה
                    if (type === 'error') {
                        Otzaria.call('ui.showError', { message: text });
                    } else if (type === 'success') {
                        Otzaria.call('ui.showSuccess', { message: text });
                    } else {
                        Otzaria.call('ui.showMessage', { message: text });
                    }
                    return;
                } catch(e) {}
            }
            // fallback
            alert(text);
        }

        // ---- האזנה לאירועי אוצריא ----
        if (HAS_OTZARIA) {
            Otzaria.on('plugin.boot', function(payload) {
                // דלג על הרצה ב-background mode
                if (payload && payload.app && payload.app.runMode === 'background') return;
                if (payload && payload.theme) {
                    applyOtzariaTheme(payload.theme);
                }
                // האתחול הראשי רץ כאן כשאוצריא זמין
                initializeApp();
            });

            Otzaria.on('theme.changed', function(theme) {
                applyOtzariaTheme(theme);
                // רענן UI לאחר שינוי נושא
                if (document.getElementById('monthViewScreen')?.style.display === 'block') {
                    renderFullMonthGrid();
                    renderMonthNotesList();
                } else {
                    renderHabits();
                }
            });
        }
        // ---- סיום ערכת נושא אוצריא ----

        // ---- מיגרציה: גרסה 3 — שיטות חישוב חדשות + סטטוסים חדשים ----
        const HABIT_SCHEMA_VERSION = 3;

        function migrateNAutoForHabit(habit) {
            if (!habit.workdays || !habit.history) return;
            if ((habit.type !== 'weekly' && habit.type !== 'monthly')) return;
            for (const monthKey in habit.history) {
                const history = habit.history[monthKey];
                const firstDate = getGregorianStartForMonthKey(monthKey);
                const startDayOfWeek = firstDate.getDay();
                for (let i = 0; i < 30; i++) {
                    if (history[i] === 'N') {
                        const dayOfWeek = (startDayOfWeek + i) % 7;
                        const isActive = habit.workdays[dayOfWeek];
                        if (!isActive) {
                            history[i] = 'N_auto';
                        }
                    }
                }
            }
        }

        function migrateHabitToV3(habit) {
            if (!habit || typeof habit !== 'object') return;

            // מיגרציה גרסה 2: weeklyAllowedSkips
            if ((habit.schemaVersion || 0) < 2) {
                if (habit.type === 'weekly' && (habit.weeklyAllowedSkips === undefined || habit.weeklyAllowedSkips === null)) {
                    const oldTarget = (typeof habit.weeklyFreq === 'number' && habit.weeklyFreq > 0) ? habit.weeklyFreq : 1;
                    let skips = 7 - oldTarget;
                    if (skips < 0) skips = 0;
                    if (skips > 7) skips = 7;
                    habit.weeklyAllowedSkips = skips;
                }
                delete habit.weeklyFreq;
                if (habit.type === 'monthly' && (habit.monthlyAllowedSkips === undefined || habit.monthlyAllowedSkips === null)) {
                    const oldTarget = (typeof habit.monthlyFreq === 'number' && habit.monthlyFreq > 0) ? habit.monthlyFreq : 1;
                    let daysInMonth = 30;
                    try { daysInMonth = calculateDaysInBrowsingMonth(new Date()); } catch(e) { daysInMonth = 30; }
                    let skips = daysInMonth - oldTarget;
                    if (skips < 0) skips = 0;
                    habit.monthlyAllowedSkips = skips;
                }
                delete habit.monthlyFreq;
            }

            // מיגרציה גרסה 3: שיטת חישוב + המרת חודשי ליומי
            if ((habit.schemaVersion || 0) < 3) {
                // ברירת מחדל: מצב סטטי (הכי קרוב לשיטה הישנה)
                if (!habit.scoreMethod) {
                    habit.scoreMethod = 'static';
                }
                // המרת הרגל חודשי ליומי
                if (habit.type === 'monthly') {
                    habit.type = 'regular';
                }
                // N_auto ישן → א (אונס)
                migrateNAutoForHabit(habit);
            }

            habit.schemaVersion = HABIT_SCHEMA_VERSION;
        }

        function migrateAllHabits(list) {
            if (!Array.isArray(list)) return;
            list.forEach(migrateHabitToV3);
        }
        // ---- סיום מיגרציה ----

        async function initializeApp() {
            // טעינת כל הנתונים מהאחסון
            const [habitsData, bookmarkData] = await Promise.all([
                storageGet('otzarya_habits'),
                storageGet('otzarya_bookmark_labels')
            ]);
            habits = Array.isArray(habitsData) ? habitsData : [];
            migrateAllHabits(habits);
            bookmarkLabels = (bookmarkData && typeof bookmarkData === 'object') ? bookmarkData : {};

            // טעינת נעילה
            accessLockConfig = await loadAccessLockConfig();
            isAppUnlocked = !isAccessLockEnabled();

            buildAccessLockUi();
            syncAccessLockVisualState();
            await initDarkMode();
            detectCurrentHebrewDay();
            renderHabits();
            await initReminder();
            await checkAutoBackup();

            if (isAccessLockEnabled() && !isAppUnlocked) {
                setTimeout(() => {
                    const input = document.getElementById('accessPasswordInput');
                    if (input) input.focus();
                }, 0);
            }
        }

        // אם לא בסביבת אוצריא — מאתחלים ישירות
        if (!HAS_OTZARIA) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeApp);
            } else {
                initializeApp();
            }
        }

