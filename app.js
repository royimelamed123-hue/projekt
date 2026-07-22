
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

        // ---- מיגרציה: מעבר מ"כמות פעמים שצריך לעשות" ל"כמות פעמים שמותר לדלג" ----
        // גרסת הסכמה הנוכחית של אובייקט ההרגל. מיגרציה רצה פעם אחת בלבד לכל הרגל.
        const HABIT_SCHEMA_VERSION = 2;

        function migrateHabitToAllowedSkips(habit) {
            if (!habit || typeof habit !== 'object') return;
            if (habit.schemaVersion >= HABIT_SCHEMA_VERSION) return;

            // שבועי: מותר לדלג = 7 פחות היעד הישן (חסום ל-0 עד 7)
            if (habit.type === 'weekly' && (habit.weeklyAllowedSkips === undefined || habit.weeklyAllowedSkips === null)) {
                const oldTarget = (typeof habit.weeklyFreq === 'number' && habit.weeklyFreq > 0) ? habit.weeklyFreq : 1;
                let skips = 7 - oldTarget;
                if (skips < 0) skips = 0;
                if (skips > 7) skips = 7;
                habit.weeklyAllowedSkips = skips;
            }
            delete habit.weeklyFreq;

            // חודשי: מותר לדלג = מספר ימי החודש הנוכחי פחות היעד הישן (חסום ל-0 לפחות)
            if (habit.type === 'monthly' && (habit.monthlyAllowedSkips === undefined || habit.monthlyAllowedSkips === null)) {
                const oldTarget = (typeof habit.monthlyFreq === 'number' && habit.monthlyFreq > 0) ? habit.monthlyFreq : 1;
                let daysInMonth = 30;
                try { daysInMonth = calculateDaysInBrowsingMonth(new Date()); } catch(e) { daysInMonth = 30; }
                let skips = daysInMonth - oldTarget;
                if (skips < 0) skips = 0;
                habit.monthlyAllowedSkips = skips;
            }
            delete habit.monthlyFreq;

            habit.schemaVersion = HABIT_SCHEMA_VERSION;
        }

        function migrateAllHabits(list) {
            if (!Array.isArray(list)) return;
            list.forEach(migrateHabitToAllowedSkips);
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
