        // ---- תיקון 5: הסרת hebrewDays הכפול מתוך renderMonthGraph ----
        // hebrewDays כבר מוגדר בתחילת הקובץ — לא צריך להגדיר שוב כאן
        function renderMonthGraph() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            if (!habit || (habit.type !== 'x_times' && habit.type !== 'regular')) return;

            const comps = getHebrewDateComponents(browsingDatePointer);
            const history = habit.history && habit.history[comps.key] ? habit.history[comps.key] : [];
            const firstDayDate = getGregorianStartForMonthKey(comps.key);
            const totalDays = calculateDaysInBrowsingMonth(browsingDatePointer);

            const canvas = document.getElementById('monthGraphCanvas');
            const dpr = window.devicePixelRatio || 1;
            const W = canvas.offsetWidth || 600;
            const H = 280;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, W, H);

            const points = [];
            let level = 0;

            for (let i = 0; i < totalDays; i++) {
                const dow = (firstDayDate.getDay() + i) % 7;
                const status = history[i];
                const target = getTargetForDay(habit, dow);
                const isActive = habit.workdays && habit.workdays[dow];

                if (!isActive || status === 'א' || status === "" || status === undefined) {
                    points.push({ day: i + 1, level, type: 'unchanged' });
                } else if (status === 'V' || (typeof status === 'number' && status >= target)) {
                    level += 1;
                    points.push({ day: i + 1, level, type: 'v' });
                } else if (typeof status === 'number' && status > 0) {
                    level += status / target;
                    points.push({ day: i + 1, level, type: 'partial' });
                } else if (status === 'X') {
                    level -= 1;
                    points.push({ day: i + 1, level, type: 'x' });
                } else {
                    points.push({ day: i + 1, level, type: 'unchanged' });
                }
            }

            if (points.length === 0) return;
           
            const actualMax = Math.max(...points.map(p => p.level));
            const actualMin = Math.min(...points.map(p => p.level));
            const padding = Math.max(1, (actualMax - actualMin) * 0.2) || 1;
            const minLevel = Math.min(0, actualMin - padding * 0.5);
            const maxLevel = Math.max(actualMax + padding, actualMin + 2);
            const range = maxLevel - minLevel || 1;

            const padL = 44, padR = 16, padT = 20, padB = 30;
            const gW = W - padL - padR;
            const gH = H - padT - padB;

            const toX = (day) => padL + ((day - 1) / (totalDays - 1 || 1)) * gW;
            const toY = (lv) => padT + gH - ((lv - minLevel) / range) * gH;

            const zeroY = toY(0);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padL, zeroY);
            ctx.lineTo(padL + gW, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            [0, Math.round(maxLevel / 2), maxLevel].forEach(lv => {
                const y = toY(lv);
                ctx.fillText(Math.round(lv), padL - 6, y + 4);
            });

            ctx.textAlign = 'center';
            // תיקון 5: משתמשים ב-hebrewDays הגלובלי, לא מגדירים מקומי
            for (let i = 0; i < totalDays; i += 5) {
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(hebrewDays[i], toX(i + 1), H - padB + 16);
            }

            ctx.beginPath();
            ctx.lineWidth = 2.5;
            points.forEach((p, idx) => {
                const x = toX(p.day);
                const y = toY(p.level);
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            const finalLevel = points[points.length - 1].level;
            ctx.strokeStyle = finalLevel >= 0 ? '#22c55e' : '#ef4444';
            ctx.stroke();

            points.forEach(p => {
                if (p.type === 'unchanged') return;
                const x = toX(p.day);
                const y = toY(p.level);
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = p.type === 'v' ? '#16a34a' : p.type === 'partial' ? '#84cc16' : '#ef4444';
                ctx.fill();
            });
        }
        // ---- סיום תיקון 5 ----

        function getSpectrumColor(pct) {
            const clamp = Math.max(0, Math.min(100, pct));
            const red = [231, 76, 60];
            const orange = [217, 119, 6];
            const green = [22, 101, 52];
            let c1, c2, t;
            if (clamp <= 50) {
                c1 = red; c2 = orange; t = clamp / 50;
            } else {
                c1 = orange; c2 = green; t = (clamp - 50) / 50;
            }
            const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
            const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
            const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
            return `rgb(${r},${g},${b})`;
        }

        function getRelativeSpectrumColor(pct, minPct, maxPct) {
            if (maxPct === minPct) return getSpectrumColor(pct);
            const normalized = ((pct - minPct) / (maxPct - minPct)) * 100;
            return getSpectrumColor(normalized);
        }

        function formatHebrewShort(date) {
            try {
                const comps = getHebrewDateComponents(date);
                const firstDay = getFirstHebrewDayDate(date);
                const dayIdx = daysBetween(firstDay, date);
                const dayLetter = hebrewDays[dayIdx] || '';
                return `${dayLetter}' ${comps.month}`;
            } catch(e) { return ''; }
        }

        function renderComparisonView() {
            const habit = habits.find(h => h.id === selectedHabitIdForView);
            const container = document.getElementById('comparisonList');
            if (!habit || !container) return;
            container.innerHTML = '';

            const emptyMsg = (text) => {
                container.innerHTML = `<div style="text-align:center; color:${getMutedTextColor()}; padding: 24px; font-size: 13px;">${text}</div>`;
            };

            const renderRow = (label, pct, minPct, maxPct) => {
                const row = document.createElement('div');
                row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:11px 16px; border-radius:8px; ${getNeutralPanelStyle()}`;
                row.innerHTML = `<span style="font-size:13px; color:${getMutedTextColor()}; font-weight:600;">${label}</span><span style="font-size:16px; font-weight:700; color:${getRelativeSpectrumColor(pct, minPct, maxPct)};">${pct}%</span>`;
                container.appendChild(row);
            };

            if (habit.type === 'weekly') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let sunday = getSundayOfWeek(today);
                const rows = [];

                for (let i = 0; i < 12; i++) {
                    const { doneScore, activeDays, remainingActive, weeklyFreq, anyActionTaken } = getWeeklyStatsForWeekByDate(habit, sunday);
                    if (activeDays > 0 && anyActionTaken) {
                        let pctVal;
                        if ((doneScore + remainingActive) >= weeklyFreq) {
                            pctVal = 100;
                        } else {
                            pctVal = Math.round(((doneScore + remainingActive) / weeklyFreq) * 100);
                        }
                        const weekEnd = addDays(sunday, 6);
                        rows.push({ label: `${formatHebrewShort(sunday)} — ${formatHebrewShort(weekEnd)}`, pct: pctVal });
                    }
                    sunday = addDays(sunday, -7);
                }

                if (rows.length === 0) { emptyMsg('אין עדיין נתונים להשוואה'); return; }
                const pcts = rows.map(r => r.pct);
                const minPct = Math.min(...pcts), maxPct = Math.max(...pcts);
                rows.forEach(r => renderRow(r.label, r.pct, minPct, maxPct));

            } else if (habit.type === 'monthly') {
                let cursor = new Date();
                const rows = [];

                for (let i = 0; i < 12; i++) {
                    const comps = getHebrewDateComponents(cursor);
                    const stats = calculateStatsForMonth(habit, comps.key);
                    if (stats.text !== '-') {
                        rows.push({ label: comps.key, pct: stats.pct });
                    }
                    const firstDay = getGregorianStartForMonthKey(comps.key);
                    cursor = addDays(firstDay, -1);
                }

                if (rows.length === 0) { emptyMsg('אין עדיין נתונים להשוואה'); return; }
                const pcts = rows.map(r => r.pct);
                const minPct = Math.min(...pcts), maxPct = Math.max(...pcts);
                rows.forEach(r => renderRow(r.label, r.pct, minPct, maxPct));

            } else {
                emptyMsg('השוואה זמינה רק להרגלים שבועיים או חודשיים');
            }
        }

