
        // ---- Otzaria Storage helpers (fallback ל-localStorage אם לא בסביבת אוצריא) ----
        async function storageGet(key) {
            if (HAS_OTZARIA) {
                try {
                    const res = await Otzaria.call('storage.get', { key });
                    return res && res.success ? res.data : null;
                } catch(e) { return null; }
            }
            try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
        }

        async function storageSet(key, value) {
            if (HAS_OTZARIA) {
                try { await Otzaria.call('storage.set', { key, value }); } catch(e) {}
                return;
            }
            localStorage.setItem(key, JSON.stringify(value));
        }

        async function storageRemove(key) {
            if (HAS_OTZARIA) {
                try { await Otzaria.call('storage.remove', { key }); } catch(e) {}
                return;
            }
            localStorage.removeItem(key);
        }

        // Sync wrapper לשמירה (נקרא מ-saveToStorage שאינה async)
        function storageSaveAsync(key, value) {
            storageSet(key, value).catch(e => console.error('storage save error', e));
        }

        let habits = [];
        
        let mainScreenDatePointer = new Date();

        let currentHebrewDayIndex = 0; 
        let actualCurrentMonthKey = ""; 
        let actualCurrentMonthName = "";
        let currentDayOfWeek = 0; 
        let currentLetterDayOnly = ""; 
        
        let selectedHabitIdForView = null;
        let browsingDatePointer = new Date(); 
        let modalSelectedDayIndex = null; 

        const ACCESS_LOCK_STORAGE_KEY = 'otzarya_access_lock';

        function getDefaultAccessLockConfig() {
            return {
                enabled: false,
                passwordHash: '',
                lockMode: 'onStart'  // 'onStart' | 'always' | 'none'
            };
        }

        let accessLockConfig = getDefaultAccessLockConfig(); // יטען אסינכרונית ב-boot
        let isAppUnlocked = true; // יעודכן אחרי טעינת config
        let accessLockUiReady = false;

        let isModalEditMode = false;
        let configSelectedType = 'x_times'; 
        let configSelectedWeekdays = [true, true, true, true, true, true, true]; 

        // ---- מטמון סטטיסטיקות (תיקון 4: ביצועים) ----
        // שומר תוצאות חישוב כדי לא לחשב מחדש בכל לחיצה
        const statsCache = new Map();

        function getStatsCacheKey(habitId, monthKey) {
            return `${habitId}::${monthKey}`;
        }

        function invalidateStatsCache(habitId) {
            // מחיקת כל הרשומות של הרגל זה מהמטמון
            for (const key of statsCache.keys()) {
                if (key.startsWith(habitId + '::')) {
                    statsCache.delete(key);
                }
            }
        }

        function invalidateAllStatsCache() {
            statsCache.clear();
        }
        // ---- סיום מטמון ----