
        function convertHebrewYearToLetters(yearNum) {
            let remainder = yearNum % 1000; 
            const lettersMap = [
                {v: 400, l: 'ת'}, {v: 300, l: 'ש'}, {v: 200, l: 'ר'}, {v: 100, l: 'ק'},
                {v: 90, l: 'צ'}, {v: 80, l: 'פ'}, {v: 70, l: 'ע'}, {v: 60, l: 'ס'},
                {v: 50, l: 'נ'}, {v: 40, l: 'מ'}, {v: 30, l: 'ל'}, {v: 20, l: 'כ'},
                {v: 10, l: 'י'}, {v: 9, l: 'ט'}, {v: 8, l: 'ח'}, {v: 7, l: 'ז'},
                {v: 6, l: 'ו'}, {v: 5, l: 'ה'}, {v: 4, l: 'ד'}, {v: 3, l: 'ג'},
                {v: 2, l: 'ב'}, {v: 1, l: 'א'}
            ];
            let result = "";
            while(remainder > 0) {
                if (remainder === 15) { result += "טו"; break; }
                if (remainder === 16) { result += "טז"; break; }
                for(let item of lettersMap) {
                    if(remainder >= item.v) {
                        result += item.l;
                        remainder -= item.v;
                        break;
                    }
                }
            }
            if (result.length === 1) return result + "'";
            if (result.length > 1) return result.slice(0, -1) + '"' + result.slice(-1);
            return result;
        }

        function getHebrewDateComponents(date) {
            try {
                const monthFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' });
                const yearFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { year: 'numeric' });
                const monthName = monthFormatter.format(date).replace(/"/g, "'").trim();
                const rawYearStr = yearFormatter.format(date).replace(/[^\d]/g, '');
                return {
                    month: monthName,
                    year: convertHebrewYearToLetters(parseInt(rawYearStr, 10)),
                    key: `${monthName} ${convertHebrewYearToLetters(parseInt(rawYearStr, 10))}`
                };
            } catch(e) {
                return { month: "תמוז", year: 'תשפ"ו', key: 'תמוז תשפ"ו' };
            }
        }

        function updateHabitDropdownDisplay() {
            const dropdown = document.getElementById('habitSelectDropdown');
            if (!dropdown) return;
            dropdown.innerHTML = "";

            habits.forEach(habit => {
                const option = document.createElement('option');
                option.value = habit.id;
                option.innerText = habit.title;
                if (habit.id === selectedHabitIdForView) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });

            renderHabitDescriptionInView();
        }

        function renderHabitDescriptionInView() {
            const descContainer = document.getElementById('habitViewDescriptionContainer');
            if (!descContainer) return;
            descContainer.innerHTML = "";
            
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (habit && habit.description && habit.description.trim() !== "") {
                const descDiv = document.createElement('div');
                descDiv.className = 'habit-view-desc-text';
                descDiv.innerText = `הערת ההרגל: ${habit.description}`;
                descContainer.appendChild(descDiv);
            }
        }

        function onHabitSelectChange() {
            const dropdown = document.getElementById('habitSelectDropdown');
            if (!dropdown) return;
            const selectedId = dropdown.value;
            if (!selectedId) return;

            selectedHabitIdForView = selectedId;
            renderHabitDescriptionInView();
            renderFullMonthGrid();
            renderMonthNotesList();
        }

        function updateMonthNavigationDisplay() {
            const comps = getHebrewDateComponents(browsingDatePointer);
            const badge = document.getElementById('monthDisplayBadge');
            if (badge) {
                badge.innerText = `${comps.month} ${comps.year}`;
            }

            const currentRealComps = getHebrewDateComponents(new Date());
            const isCurrentMonth = comps.key === currentRealComps.key;
            const btnMonthToday = document.getElementById('btnMonthJumpToday');
            if (btnMonthToday) {
                btnMonthToday.style.visibility = 'visible';
                if (isCurrentMonth) {
                    btnMonthToday.style.opacity = '0.5';
                    btnMonthToday.style.pointerEvents = 'none';
                } else {
                    btnMonthToday.style.opacity = '1';
                    btnMonthToday.style.pointerEvents = 'auto';
                }
            }
        }

        function adjustBrowsingMonth(monthOffset) {
            browsingDatePointer.setDate(browsingDatePointer.getDate() + (monthOffset * 30));
            updateMonthNavigationDisplay();
            renderFullMonthGrid();
            renderMonthNotesList();
        }

        // ---- תיקון 1: חישוב מספר ימים בחודש עברי ----
        // במקום רשימה קבועה שלא מתחשבת בשנה, שואלים את הדפדפן ישירות.
        // הדפדפן יודע בדיוק כמה ימים יש בכל חודש עברי בכל שנה (כולל חשוון/כסלו משתנים).
        function calculateDaysInBrowsingMonth(date) {
            try {
                // מוצאים את היום הראשון של החודש העברי
                const firstDay = getFirstHebrewDayDate(date);
                // מוצאים את היום הראשון של החודש הבא
                // מקפיצים 32 יום קדימה (מספיק לחצות לחודש הבא בכל מקרה)
                const nextMonthDate = addDays(firstDay, 32);
                const firstDayOfNextMonth = getFirstHebrewDayDate(nextMonthDate);
                // ההפרש בין שני הימים הראשונים = מספר הימים בחודש
                const days = daysBetween(firstDay, firstDayOfNextMonth);
                // הגנה: חודש עברי תמיד 29 או 30 ימים
                if (days === 29 || days === 30) return days;
                return 30; // ברירת מחדל אם משהו השתבש
            } catch(e) {
                return 30;
            }
        }
        // ---- סיום תיקון 1 ----

        // ---- פונקציות תאריך בטוחות מפני מעבר שעון קיץ/חורף (DST) ----
        function addDays(date, days) {
            const d = new Date(date.getTime());
            d.setDate(d.getDate() + days);
            return d;
        }

        function daysBetween(date1, date2) {
            const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
            const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
            return Math.round((utc2 - utc1) / 86400000);
        }
        // ---- סיום פונקציות תאריך בטוחות ----

        function getFirstHebrewDayDate(date) {
            try {
                let tempDate = new Date(date.getTime());
                const currentMonthFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long', year: 'numeric' });
                let targetMonthStr = currentMonthFormatter.format(tempDate);
                for (let i = 0; i < 45; i++) {
                    let checkDate = addDays(tempDate, -i);
                    let dayNumFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' });
                    let dayNum = parseInt(dayNumFormatter.format(checkDate).replace(/[^\d]/g, ''), 10);
                    if (dayNum === 1 && currentMonthFormatter.format(checkDate) === targetMonthStr) {
                        return checkDate;
                    }
                }
                return date;
            } catch(e) { return date; }
        }

        // ---- תיקון 3: חיפוש חודש תמיד מהיום האמיתי ----
        // במקום להסתמך על browsingDatePointer (שמשתנה לפי מה שהמשתמש צפה לאחרונה),
        // תמיד מתחילים את החיפוש מהיום האמיתי. כך גם אם המשתמש גלל 3 שנים אחורה
        // ואז חזר למסך הראשי, החישובים של החודש הנוכחי יהיו תקינים.
        function getGregorianStartForMonthKey(monthKey) {
            // תמיד מתחילים מהיום האמיתי — לא מ-browsingDatePointer
            const anchor = new Date();

            // בדיקה מהירה: אם החודש המבוקש הוא החודש הנוכחי של ה-anchor
            const anchorComps = getHebrewDateComponents(anchor);
            if (anchorComps.key === monthKey) {
                return getFirstHebrewDayDate(anchor);
            }

            // חיפוש עד 24 חודשים קדימה ואחורה
            for (let i = 1; i <= 24; i++) {
                const forwardCheck = addDays(anchor, i * 30);
                if (getHebrewDateComponents(forwardCheck).key === monthKey) {
                    return getFirstHebrewDayDate(forwardCheck);
                }
                const backwardCheck = addDays(anchor, -i * 30);
                if (getHebrewDateComponents(backwardCheck).key === monthKey) {
                    return getFirstHebrewDayDate(backwardCheck);
                }
            }

            // אם לא נמצא בטווח הרגיל, ניסיון נוסף עם browsingDatePointer כ-anchor (לחודשים רחוקים מאוד)
            const browsingAnchor = (typeof browsingDatePointer !== 'undefined' && browsingDatePointer) ? browsingDatePointer : anchor;
            const browsingComps = getHebrewDateComponents(browsingAnchor);
            if (browsingComps.key === monthKey) {
                return getFirstHebrewDayDate(browsingAnchor);
            }
            for (let i = 1; i <= 24; i++) {
                const forwardCheck = addDays(browsingAnchor, i * 30);
                if (getHebrewDateComponents(forwardCheck).key === monthKey) {
                    return getFirstHebrewDayDate(forwardCheck);
                }
                const backwardCheck = addDays(browsingAnchor, -i * 30);
                if (getHebrewDateComponents(backwardCheck).key === monthKey) {
                    return getFirstHebrewDayDate(backwardCheck);
                }
            }

            return getFirstHebrewDayDate(anchor);
        }
        // ---- סיום תיקון 3 ----

        function getMonthHistory(habit, monthKey) {
            if (!habit.history) habit.history = {};
            if (!habit.history[monthKey]) {
                habit.history[monthKey] = Array(30).fill("");
                applyAutomaticOffDaysForMonth(habit, monthKey);
            }
            return habit.history[monthKey];
        }

        function peekMonthHistory(habit, monthKey) {
            if (!habit.history || !habit.history[monthKey]) {
                const virtualArr = Array(30).fill("");
                if (habit.workdays) {
                    // תיקון 3 נכנס לפעולה כאן: getGregorianStartForMonthKey משתמשת ב-new Date() כ-anchor
                    const firstHebrewDayDate = getGregorianStartForMonthKey(monthKey);
                    const startDayOfWeek = firstHebrewDayDate.getDay();
                    const offValue = (habit.type === 'weekly' || habit.type === 'monthly') ? "N" : "א";
                    for (let i = 0; i < 30; i++) {
                        const currentDayOfWeek = (startDayOfWeek + i) % 7;
                        if (!habit.workdays[currentDayOfWeek]) {
                            virtualArr[i] = offValue;
                        }
                    }
                }
                return virtualArr;
            }
            return habit.history[monthKey];
        }

        function applyAutomaticOffDaysForMonth(habit, monthKey, oldWorkdays) {
            if (!habit.workdays) return; 
            
            const firstHebrewDayDate = getGregorianStartForMonthKey(monthKey);
            const startDayOfWeek = firstHebrewDayDate.getDay(); 

            const offValue = (habit.type === 'weekly' || habit.type === 'monthly') ? "N" : "א";
            
            for (let i = 0; i < 30; i++) {
                const currentDayOfWeek = (startDayOfWeek + i) % 7;
                const isNowActive = habit.workdays[currentDayOfWeek];

                if (oldWorkdays) {
                    const wasActive = oldWorkdays[currentDayOfWeek];
                    if (wasActive === isNowActive) continue;
                }

                if (!isNowActive) {
                    habit.history[monthKey][i] = offValue;
                } else {
                    if (habit.history[monthKey][i] === offValue) {
                        habit.history[monthKey][i] = "";
                    }
                }
            }
        }

        function detectCurrentHebrewDay() {
            try {
                currentDayOfWeek = mainScreenDatePointer.getDay();
                const dayNum = parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(mainScreenDatePointer).replace(/[^\d]/g, ''), 10);
                const comps = getHebrewDateComponents(mainScreenDatePointer);
                actualCurrentMonthName = comps.month;
                actualCurrentMonthKey = comps.key;
                if (dayNum >= 1 && dayNum <= 30) currentHebrewDayIndex = dayNum - 1;

                let letterDay = hebrewDays[currentHebrewDayIndex] || "א";
                if (letterDay.length === 1) letterDay += "'";
                else if (letterDay.length === 2 && letterDay !== "טו" && letterDay !== "טז") letterDay = letterDay.charAt(0) + '"' + letterDay.charAt(1);
                else if (letterDay === "טו") letterDay = 'ט"ו';
                else if (letterDay === "טז") letterDay = 'ט"ז';

                currentLetterDayOnly = letterDay;
                document.getElementById('hebrewDateBadge').innerText = `${letterDay} ב${actualCurrentMonthName}`;

                const isRealToday = new Date().toDateString() === mainScreenDatePointer.toDateString();
                const btnToday = document.getElementById('btnMainJumpToday');
                btnToday.style.visibility = 'visible';
                if (isRealToday) {
                    btnToday.style.opacity = '0.5';
                    btnToday.style.pointerEvents = 'none';
                } else {
                    btnToday.style.opacity = '1';
                    btnToday.style.pointerEvents = 'auto';
                }

            } catch (e) {
                document.getElementById('hebrewDateBadge').innerText = "יום נוכחי בחודש";
                actualCurrentMonthKey = 'תמוז תשפ"ו';
                currentLetterDayOnly = "א'";
            }
        }

        function adjustMainScreenDay(daysOffset) {
            mainScreenDatePointer.setDate(mainScreenDatePointer.getDate() + daysOffset);
            detectCurrentHebrewDay();
            renderHabits();
        }

        function resetMainScreenToToday() {
            mainScreenDatePointer = new Date();
            detectCurrentHebrewDay();
            renderHabits();
        }