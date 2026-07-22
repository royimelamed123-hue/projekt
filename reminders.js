        // ---- תזכורות ----
        // תומך במספר תזכורות, נוסח מותאם אישית, ובחירת ימים לכל תזכורת

        const REMINDER_STORAGE_KEY = 'otzarya_reminders_v2';
        let reminderIntervalId = null;

        const REMINDER_WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

        function getDefaultReminders() {
            return { enabled: false, reminders: [] };
        }

        // reminder object: { id, hour, minute, text, days: [0..6] (0=ראשון) }
        async function loadRemindersConfig() {
            try {
                const parsed = await storageGet(REMINDER_STORAGE_KEY);
                if (!parsed) return getDefaultReminders();
                // תאימות לגרסה ישנה (אובייקט בודד)
                if (parsed && typeof parsed.hour === 'number') {
                    return {
                        enabled: !!parsed.enabled,
                        reminders: parsed.enabled ? [{
                            id: 'legacy',
                            hour: parsed.hour,
                            minute: parsed.minute || 0,
                            text: '',
                            days: [0,1,2,3,4,5,6]
                        }] : []
                    };
                }
                return parsed;
            } catch(e) {
                return getDefaultReminders();
            }
        }

        function saveRemindersConfig(config) {
            storageSaveAsync(REMINDER_STORAGE_KEY, config);
        }

        async function checkAndFireReminders() {
            const config = await loadRemindersConfig();
            if (!config.enabled || !config.reminders || config.reminders.length === 0) return;

            const now = new Date();
            const todayDow = now.getDay();

            config.reminders.forEach(reminder => {
                if (!reminder.days || !reminder.days.includes(todayDow)) return;
                if (now.getHours() !== reminder.hour || now.getMinutes() !== reminder.minute) return;

                const firedKey = `otzarya_rfired_${reminder.id}`;
                const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${reminder.hour}-${reminder.minute}`;
                // fired tracking נשאר ב-localStorage כי הוא זמני (session-based)
                if (localStorage.getItem(firedKey) === todayKey) return;
                localStorage.setItem(firedKey, todayKey);
                sendReminderNotification(reminder.text);
            });
        }

        function sendReminderNotification(customText) {
            const body = (customText && customText.trim()) ? customText.trim() : 'זמן לבדוק את ההרגלים שלך';
            if (HAS_OTZARIA) {
                // תיקון באג 1: השם הנכון של המתודה הוא notifications.sendSystem (לא notifications.send)
                try {
                    Otzaria.call('notifications.sendSystem', { title: 'קניין הרגלים', body });
                } catch(e) {}
            } else if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('קניין הרגלים', { body, icon: 'icon.png', lang: 'he', dir: 'rtl' });
            }
        }

        function startReminderInterval() {
            if (reminderIntervalId) clearInterval(reminderIntervalId);
            reminderIntervalId = setInterval(checkAndFireReminders, 30000);
            checkAndFireReminders();
        }

        function stopReminderInterval() {
            if (reminderIntervalId) {
                clearInterval(reminderIntervalId);
                reminderIntervalId = null;
            }
        }

        async function requestNotificationPermission() {
            if (HAS_OTZARIA) return true; // אוצריא מנהל הרשאות בעצמה
            if (!('Notification' in window)) {
                alert('הדפדפן שלך לא תומך בהתראות. נסה דפדפן מעודכן יותר.');
                return false;
            }
            if (Notification.permission === 'granted') return true;
            if (Notification.permission === 'denied') {
                alert('ההתראות חסומות בהגדרות הדפדפן. יש לאפשר אותן ידנית בהגדרות האתר.');
                return false;
            }
            const result = await Notification.requestPermission();
            return result === 'granted';
        }

        // ---- בניית ממשק התזכורות ----

        // מחזיר את הנתונים מהשורות שמוצגות כרגע במסך
        function readReminderRowsFromUI() {
            const rows = document.querySelectorAll('.reminder-row');
            const reminders = [];
            rows.forEach(row => {
                const id = row.dataset.reminderId;
                const hour = parseInt(row.querySelector('.r-hour').value, 10);
                const minute = parseInt(row.querySelector('.r-minute').value, 10);
                const text = row.querySelector('.r-text').value.trim();
                const dayCheckboxes = row.querySelectorAll('.r-day-cb');
                const days = [];
                dayCheckboxes.forEach((cb, i) => { if (cb.checked) days.push(i); });
                reminders.push({
                    id: id || (Date.now().toString() + Math.random().toString(36).slice(2,6)),
                    hour: isNaN(hour) || hour < 0 || hour > 23 ? 20 : hour,
                    minute: isNaN(minute) || minute < 0 || minute > 59 ? 0 : minute,
                    text,
                    days: days.length > 0 ? days : [0,1,2,3,4,5,6]
                });
            });
            return reminders;
        }

        function buildReminderRowHTML(reminder) {
            const rid = reminder ? reminder.id : (Date.now().toString() + Math.random().toString(36).slice(2,6));
            const hour = reminder ? String(reminder.hour).padStart(2,'0') : '20';
            const minute = reminder ? String(reminder.minute).padStart(2,'0') : '00';
            const text = reminder ? (reminder.text || '') : '';
            const days = reminder ? (reminder.days || [0,1,2,3,4,5,6]) : [0,1,2,3,4,5,6];

            const dayButtons = REMINDER_WEEKDAY_NAMES.map((name, i) => {
                const checked = days.includes(i) ? 'checked' : '';
                return `<label style="display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer;">
                    <input type="checkbox" class="r-day-cb" ${checked} style="accent-color:#2563eb; width:14px; height:14px;">
                    <span style="font-size:10px; font-weight:600; color:var(--text-color, #334155);">${name.slice(0,2)}</span>
                </label>`;
            }).join('');

            return `
                <div class="reminder-row" data-reminder-id="${rid}" style="background: var(--input-background-color, #f8fafc); border: 1px solid var(--divider-color, #e2e8f0); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <label style="font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;">שעה:</label>
                        <div style="display: flex; align-items: center; gap: 4px; direction: ltr;">
                            <input type="number" class="r-hour" min="0" max="23" value="${hour}" style="width: 50px; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 5px; font-size: 14px; font-weight: 600; font-family: inherit; background: var(--input-background-color, #fff); color: var(--text-color, #1e293b);">
                            <span style="font-size: 15px; font-weight: 700; color: #475569;">:</span>
                            <input type="number" class="r-minute" min="0" max="59" value="${minute}" style="width: 50px; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 5px; font-size: 14px; font-weight: 600; font-family: inherit; background: var(--input-background-color, #fff); color: var(--text-color, #1e293b);">
                        </div>
                        <button onclick="removeReminderRow(this)" style="margin-right: auto; background: none; border: none; color: #ef4444; font-size: 18px; cursor: pointer; line-height: 1; padding: 0 4px;" title="הסר תזכורת זו">×</button>
                    </div>
                    <div>
                        <input type="text" class="r-text" value="${escAttr(text)}" placeholder="נוסח ההתראה (אם ריק — נוסח ברירת מחדל)" style="width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 13px; font-family: inherit; background: var(--input-background-color, #fff); color: var(--text-color, #1e293b);">
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <span style="font-size: 12px; font-weight: 600; color: #475569; white-space: nowrap;">ימים:</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${dayButtons}
                        </div>
                    </div>
                </div>
            `;
        }

        function removeReminderRow(btn) {
            const row = btn.closest('.reminder-row');
            if (row) row.remove();
        }

        function addReminderRow() {
            const container = document.getElementById('remindersContainer');
            if (!container) return;
            const div = document.createElement('div');
            div.innerHTML = buildReminderRowHTML(null);
            container.appendChild(div.firstElementChild);
        }

        async function openReminderModal() {
            let modal = document.getElementById('reminderModal');
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = 'reminderModal';
            modal.className = 'modal-overlay';

            const config = await loadRemindersConfig();
            const enabledChecked = config.enabled ? 'checked' : '';

            let statusText = '';
            let statusColor = '#64748b';
            if (HAS_OTZARIA) {
                statusText = config.enabled
                    ? `תזכורות פעילות (${(config.reminders || []).length})`
                    : 'תזכורות כבויות';
                statusColor = config.enabled ? '#0f766e' : '#64748b';
            } else if (!('Notification' in window)) {
                statusText = 'הדפדפן לא תומך בהתראות';
                statusColor = '#b91c1c';
            } else if (Notification.permission === 'denied') {
                statusText = 'התראות חסומות — יש לאפשר בהגדרות הדפדפן';
                statusColor = '#b91c1c';
            } else if (Notification.permission === 'granted') {
                statusText = config.enabled
                    ? `תזכורות פעילות (${(config.reminders || []).length})`
                    : 'הרשאות התראות אושרו';
                statusColor = '#0f766e';
            } else {
                statusText = 'לחץ "שמור" כדי לאשר הרשאת התראות';
            }

            const existingRowsHTML = (config.reminders || []).map(r => buildReminderRowHTML(r)).join('');

            modal.innerHTML = `
                <div class="modal-card" style="max-width: 500px;">
                    <h4>תזכורות</h4>
                    <p style="font-size: 12px; color: #64748b; margin: 0;">
                        הגדר תזכורת אחת או יותר. האפליקציה חייבת להיות פתוחה כדי שהתזכורת תגיע.
                    </p>

                    <label class="access-lock-toggle-row">
                        <input type="checkbox" id="reminderEnabledCheckbox" ${enabledChecked}>
                        <span>הפעל תזכורות</span>
                    </label>

                    <div id="remindersContainer" style="display: flex; flex-direction: column; gap: 10px; max-height: 55vh; overflow-y: auto; padding-left: 2px;">
                        ${existingRowsHTML}
                    </div>

                    <button onclick="addReminderRow()" style="align-self: flex-start; background: none; border: 1.5px dashed #94a3b8; color: #64748b; border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; width: 100%;">+ הוסף תזכורת</button>

                    <div id="reminderStatusMsg" style="font-size: 12px; min-height: 16px; color: ${statusColor};">${esc(statusText)}</div>

                    <div class="modal-actions">
                        <button class="btn-modal-cancel" onclick="closeReminderModal()">ביטול</button>
                        <button class="btn-modal-save" onclick="saveReminderSettings()">שמור</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            modal.style.display = 'flex';
        }

        function closeReminderModal() {
            const modal = document.getElementById('reminderModal');
            if (modal) modal.style.display = 'none';
        }

        async function saveReminderSettings() {
            const checkbox = document.getElementById('reminderEnabledCheckbox');
            const statusMsg = document.getElementById('reminderStatusMsg');

            const enabled = checkbox && checkbox.checked;
            const reminders = readReminderRowsFromUI();

            if (enabled && reminders.length === 0) {
                if (statusMsg) {
                    statusMsg.textContent = 'הוסף לפחות תזכורת אחת כדי להפעיל';
                    statusMsg.style.color = '#b91c1c';
                }
                return;
            }

            if (enabled && !HAS_OTZARIA) {
                const granted = await requestNotificationPermission();
                if (!granted) {
                    if (statusMsg) {
                        statusMsg.textContent = 'לא ניתן לשלוח התראות — בדוק הגדרות דפדפן';
                        statusMsg.style.color = '#b91c1c';
                    }
                    return;
                }
            }

            const config = { enabled, reminders };
            saveRemindersConfig(config);

            if (enabled) {
                startReminderInterval();
                if (statusMsg) {
                    statusMsg.textContent = `נשמר — ${reminders.length} תזכורת${reminders.length !== 1 ? 'ות' : ''} פעיל${reminders.length !== 1 ? 'ות' : 'ה'}`;
                    statusMsg.style.color = '#0f766e';
                }
            } else {
                stopReminderInterval();
                if (statusMsg) {
                    statusMsg.textContent = 'התזכורות כובו';
                    statusMsg.style.color = '#64748b';
                }
            }

            setTimeout(closeReminderModal, 1500);
        }

        async function initReminder() {
            const config = await loadRemindersConfig();
            if (config.enabled) {
                startReminderInterval();
            }

            // תיקון באג 5: עצירה והפעלה מחדש של הטיימר עם אירועי plugin.suspended/resumed
            if (HAS_OTZARIA) {
                try { Otzaria.on('plugin.suspended', stopReminderInterval); } catch(e) {}
                try { Otzaria.on('plugin.resumed', startReminderInterval); } catch(e) {}
            }

            const actionBar = document.querySelector('.action-bar');
            if (actionBar && !document.getElementById('btnReminderSettings')) {
                const btn = document.createElement('button');
                btn.className = 'btn-edit-habit-trigger';
                btn.id = 'btnReminderSettings';
                btn.title = 'הגדרות תזכורות';
                btn.textContent = 'תזכורות';
                btn.addEventListener('click', openReminderModal);
                actionBar.appendChild(btn);
            }
        }
        // ---- סיום תזכורות ----
