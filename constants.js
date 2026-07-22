        const hebrewDays = ["א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג","כד","כה","כו","כז","כח","כט","ל"];
        const daysOfWeekLetters = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "שבת"];
        const monthsList = ["תשרי", "חשוון", "כסלו", "טבת", "שבט", "אדר", "ניסן", "אייר", "סיון", "תמוז", "אב", "אלול"];

        // ---- פונקציית esc — הגנה מפני XSS ----
        function esc(s) {
            const d = document.createElement('div');
            d.textContent = String(s ?? '');
            return d.innerHTML;
        }

        // ---- escAttr — הגנה לערך בתוך attribute (מוסיף בריחה למרכאות כפולות) ----
        function escAttr(s) {
            return esc(s).replace(/"/g, '&quot;');
        }

        // ---- זיהוי אם Otzaria זמין ----
        const HAS_OTZARIA = (typeof Otzaria !== 'undefined');