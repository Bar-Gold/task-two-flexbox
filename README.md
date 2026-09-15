# Flex Dock - משחק ללימוד Flexbox

מטלה 2 בקורס פיתוח אתרים. בר גולדשטיין ובנימין ברודי.

[האתר החי](https://bar-gold.github.io/task-two-flexbox/) | [הקוד](https://github.com/Bar-Gold/task-two-flexbox)

## המשחק

מפרץ עגינה בחלל. בכל שלב יש כמה ספינות ורציפי עגינה מקווקווים, והוראה שמתארת
איך הספינות צריכות להסתדר. משנים מאפייני Flexbox בחדר הבקרה, הספינות זזות
מיד, ולוחצים "בדיקת עגינה". ספינה נחשבת עוגנת כשהיא יושבת בדיוק על הרציף עם
המספר שלה.

12 שלבים. הראשונים מלמדים מאפיין אחד בכל פעם (`display: flex`,
`justify-content`, `align-items`), ומשלב 4 והלאה צריך לשלב כמה מאפיינים.
שלבים 9-11 עוסקים ב-`flex-wrap` וב-`align-content`.

| שלב | מה צריך |
| --- | --- |
| 1 | `display: flex` |
| 2 | `justify-content: flex-end` |
| 3 | `align-items: flex-end` |
| 4 | `justify-content: center` + `align-items: center` |
| 5 | `justify-content: space-between` + `align-items: flex-end` |
| 6 | `flex-direction: column` + `align-items: center` |
| 7 | `flex-direction: row-reverse` + `justify-content: space-evenly` |
| 8 | `flex-direction: column` + `justify-content: space-between` + `align-items: center` |
| 9 | `flex-wrap: wrap` |
| 10 | `flex-wrap: wrap` + `justify-content: center` + `align-content: center` |
| 11 | `flex-direction: column` + `flex-wrap: wrap` + `align-content: center` |
| 12 | `flex-direction: column-reverse` + `justify-content: center` + `align-items: flex-end` |

מעבר לדרישות המינימום:

- ניקוד בכוכבים לפי מספר הניסיונות (3 בניסיון הראשון, 2 עד שלושה ניסיונות, אחרת 1).
- רמז שנפתח אחרי שני ניסיונות כושלים.
- ההתקדמות נשמרת ב-`localStorage`, ומפת השלבים מאפשרת לחזור לכל שלב שהושלם.
- אנימציית תנועה של הספינות בכל שינוי, הבהוב של הרציפים בהצלחה ורעידת הלוח בטעות.
- מצב בהיר וכהה, לפי מערכת ההפעלה או לפי בחירה.

## מבנה

```
index.html
css/
  reset.css      איפוס קטן
  tokens.css     צבעים, גופנים, מרווחים ושתי ערכות נושא
  style.css      פריסה ורכיבים
js/
  theme.js       מחיל את ערכת הנושא השמורה לפני שהעמוד מוצג
  levels.js      נתוני השלבים והמאפיינים (בלי DOM)
  game.js        לוגיקת המשחק
assets/
  favicon.svg
  fonts/         Rubik ו-JetBrains Mono, שמורים בפרויקט
tools/           כלי בדיקה בלבד, לא חלק מהמשחק
```

## איך הבדיקה עובדת

בלוח יש שתי רשימות זהות אחת מעל השנייה. התחתונה מקבלת את ה-CSS של הפתרון
והילדים שלה הם הרציפים, כך שהדפדפן עצמו קובע איפה כל רציף. העליונה מקבלת את
מה שנבחר בחדר הבקרה והילדים שלה הם הספינות. הבדיקה משווה את המיקום של ספינה מספר
i למיקום של רציף מספר i, ולכן כל שילוב מאפיינים שמגיע לאותו סידור מתקבל, לא
רק זה שכתוב בקובץ השלבים.

הלוח הוא תמיד 320 על 320 פיקסלים, בכל גודל מסך, כדי שהפתרון לא יהיה תלוי
ברזולוציה. הוא מוגדר `dir="ltr"` כדי ש-`row` ו-`flex-start` יתנהגו כמו
בתיעוד, גם כשהעמוד עצמו מימין לשמאל.

## מגבלות שנשמרו

-שפות HTML, CSS ו-JavaScript בלבד, בלי ספריות.
- אין CSS Grid בשום מקום, גם לא בפריסת העמוד.
- אין מעבר בין עמודים; כל השלבים באותו `index.html`.
- הגופנים שמורים בפרויקט, כך שהאתר נראה אותו דבר גם מקובץ ה-ZIP בלי אינטרנט.

## בדיקות

```bash
cd tools
npm install
npm test          # דרישות המטלה, html-validate, stylelint, ניגודיות, ומשחק מלא ב-Chrome
npm run zip       # בונה flex-dock-submission.zip עם קבצי המשחק בלבד
```

בדיקת הדפדפן מריצה Chrome מקומי (`CHROME_PATH` אם הוא לא במקום הרגיל) ומשחקת
את כל 12 השלבים דרך הממשק: ניסיון שגוי, איפוס, רמז, פתרון, מעבר לשלב הבא,
טעינה מחדש עם שמירת התקדמות, מחיקת התקדמות, ורוחב מסך של 360 ו-1920 פיקסלים.

## גופנים

Rubik ו-JetBrains Mono, שניהם ברישיון SIL Open Font License 1.1.
הרישיונות ב-`assets/fonts/`.
