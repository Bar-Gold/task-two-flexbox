/* Flex Dock - level data.
   Pure data, no DOM access. game.js reads window.FLEX_DOCK.

   Geometry the levels rely on (see css/style.css):
     board inner area  292 x 292 px  (320 px board, 2 px border, 12 px padding)
     fighter           48 x 48 px    -> up to 5 fit in one row or column
     freighter         80 x 64 px    -> exactly 3 per row, 4 per column, so
                                        wrap levels break in a predictable place

   Every level starts from the CSS initial values (plus display: flex from
   level 2 on) and the solution is applied to a hidden twin container that
   draws the docking pads, so pad positions always follow the real layout. */

(function () {
  'use strict';

  var properties = [
    {
      name: 'display',
      values: ['block', 'flex'],
      initial: 'block',
      description: 'מפעיל את מודל ה-Flexbox על המפרץ. בלי display: flex שאר המאפיינים לא עושים כלום.'
    },
    {
      name: 'flex-direction',
      values: ['row', 'row-reverse', 'column', 'column-reverse'],
      initial: 'row',
      description: 'כיוון הציר הראשי: שורה (משמאל לימין) או טור (מלמעלה למטה). reverse הופך את הכיוון.'
    },
    {
      name: 'justify-content',
      values: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
      initial: 'flex-start',
      description: 'פיזור הפריטים לאורך הציר הראשי.'
    },
    {
      name: 'align-items',
      values: ['stretch', 'flex-start', 'flex-end', 'center'],
      initial: 'stretch',
      description: 'יישור הפריטים על הציר המשני, הניצב לציר הראשי.'
    },
    {
      name: 'flex-wrap',
      values: ['nowrap', 'wrap', 'wrap-reverse'],
      initial: 'nowrap',
      description: 'האם פריטים שלא נכנסים בשורה אחת יורדים לשורה חדשה.'
    },
    {
      name: 'align-content',
      values: ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around'],
      initial: 'stretch',
      description: 'פיזור השורות עצמן על הציר המשני. משפיע רק כשיש כמה שורות (flex-wrap).'
    }
  ];

  var levels = [
    {
      title: 'מפעילים את המנוע',
      instruction: 'שלוש ספינות תקועות זו מעל זו. הפכו את המפרץ ל-Flex Container כדי שיסתדרו בשורה אחת, זו לצד זו, בפינה השמאלית העליונה.',
      hint: 'ברירת המחדל של כל אלמנט היא display: block, ולכן כל ספינה תופסת שורה משלה. display: flex מסדר את הילדים על ציר אחד.',
      ships: 3,
      shipType: 'fighter',
      controls: ['display'],
      start: {},
      solution: { display: 'flex' }
    },
    {
      title: 'לקצה הימני',
      instruction: 'הזיזו את הספינות אל הקצה הימני של המפרץ. הן צריכות להישאר בשורה אחת, צמודות זו לזו ולמעלה.',
      hint: 'justify-content מפזר את הפריטים לאורך הציר הראשי. flex-end דוחף אותם לסוף הציר, כלומר לימין כשהכיוון הוא row.',
      ships: 3,
      shipType: 'fighter',
      controls: ['display', 'justify-content'],
      start: { display: 'flex' },
      solution: { 'justify-content': 'flex-end' }
    },
    {
      title: 'נחיתה בתחתית',
      instruction: 'הורידו את הספינות אל תחתית המפרץ. הן נשארות בשורה אחת, צמודות לקצה השמאלי.',
      hint: 'align-items מיישר את הפריטים על הציר המשני. כשהכיוון הוא row, הציר המשני הוא אנכי ו-flex-end הוא התחתית.',
      ships: 4,
      shipType: 'fighter',
      controls: ['display', 'justify-content', 'align-items'],
      start: { display: 'flex' },
      solution: { 'align-items': 'flex-end' }
    },
    {
      title: 'מרכז המפרץ',
      instruction: 'מרכזו את הספינות בדיוק באמצע המפרץ: גם לרוחב וגם לגובה.',
      hint: 'צריך שני מאפיינים: אחד לציר הראשי (justify-content) ואחד לציר המשני (align-items).',
      ships: 3,
      shipType: 'fighter',
      controls: ['display', 'justify-content', 'align-items'],
      start: { display: 'flex' },
      solution: { 'justify-content': 'center', 'align-items': 'center' }
    },
    {
      title: 'פיזור לאורך הרציף',
      instruction: 'סדרו את הספינות בשורה לאורך תחתית המפרץ: הספינה הראשונה צמודה לקצה השמאלי, האחרונה לקצה הימני, והמרווחים ביניהן שווים.',
      hint: 'space-between משאיר את הפריט הראשון והאחרון צמודים לקצוות ומחלק את המקום הפנוי ביניהם. אל תשכחו את הציר המשני.',
      ships: 4,
      shipType: 'fighter',
      controls: ['display', 'justify-content', 'align-items'],
      start: { display: 'flex' },
      solution: { 'justify-content': 'space-between', 'align-items': 'flex-end' }
    },
    {
      title: 'טור מרכזי',
      instruction: 'סדרו את הספינות בטור, מלמעלה למטה, ומרכזו אותן לרוחב המפרץ.',
      hint: 'flex-direction: column הופך את הציר הראשי לאנכי. עכשיו align-items שולט ביישור האופקי.',
      ships: 4,
      shipType: 'fighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items'],
      start: { display: 'flex' },
      solution: { 'flex-direction': 'column', 'align-items': 'center' }
    },
    {
      title: 'סדר הפוך',
      instruction: 'הפכו את סדר הספינות כך שספינה 1 תהיה הימנית ביותר, ופזרו אותן לאורך החלק העליון של המפרץ במרווחים שווים. המרווח בין הספינות שווה למרווח בינן לבין הקצוות.',
      hint: 'row-reverse משאיר את הציר אופקי אבל הופך את כיוונו. space-evenly מחלק את המקום הפנוי שווה בשווה, כולל בקצוות.',
      ships: 4,
      shipType: 'fighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items'],
      start: { display: 'flex' },
      solution: { 'flex-direction': 'row-reverse', 'justify-content': 'space-evenly' }
    },
    {
      title: 'טור מקצה לקצה',
      instruction: 'סדרו את הספינות בטור ממורכז לרוחב המפרץ: הראשונה צמודה לקצה העליון, האחרונה לקצה התחתון, והמרווחים ביניהן שווים.',
      hint: 'בטור, justify-content מפזר לאורך הגובה ו-align-items מיישר לרוחב. כאן צריך את שניהם יחד עם flex-direction.',
      ships: 4,
      shipType: 'fighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items'],
      start: { display: 'flex' },
      solution: { 'flex-direction': 'column', 'justify-content': 'space-between', 'align-items': 'center' }
    },
    {
      title: 'המשאיות מגיעות',
      instruction: 'שש משאיות חלל רחבות לא נכנסות בשורה אחת ונדחקות אל מחוץ למפרץ. אפשרו להן לרדת לשורה נוספת כשנגמר המקום.',
      hint: 'ברירת המחדל היא flex-wrap: nowrap, ולכן הפריטים גולשים החוצה. wrap מעביר פריטים שלא נכנסים לשורה הבאה.',
      ships: 6,
      shipType: 'freighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap'],
      start: { display: 'flex' },
      solution: { 'flex-wrap': 'wrap' }
    },
    {
      title: 'שתי שורות במרכז',
      instruction: 'סדרו את המשאיות בשתי שורות ממורכזות לרוחב, ומרכזו את שתי השורות יחד לגובה המפרץ.',
      hint: 'align-content מפזר את השורות עצמן על הציר המשני, והוא עובד רק כשיש כמה שורות. justify-content עדיין אחראי על הרוחב.',
      ships: 6,
      shipType: 'freighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'align-content'],
      start: { display: 'flex' },
      solution: { 'flex-wrap': 'wrap', 'justify-content': 'center', 'align-content': 'center' }
    },
    {
      title: 'טורים במחסן',
      instruction: 'סדרו שמונה משאיות בטורים: מלמעלה למטה, וכשטור מתמלא ממשיכים לטור חדש. מרכזו את הטורים לרוחב המפרץ.',
      hint: 'flex-direction: column יחד עם flex-wrap: wrap יוצר טורים. align-content מפזר את הטורים לרוחב.',
      ships: 8,
      shipType: 'freighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'align-content'],
      start: { display: 'flex' },
      solution: { 'flex-direction': 'column', 'flex-wrap': 'wrap', 'align-content': 'center' }
    },
    {
      title: 'המשימה האחרונה',
      instruction: 'סדרו את הספינות בטור צמוד לקצה הימני של המפרץ, ממורכז לגובה, כשספינה 1 היא התחתונה בטור.',
      hint: 'column-reverse מתחיל את הטור מלמטה. justify-content: center ממרכז את הטור לגובה, ו-align-items: flex-end דוחף אותו לימין.',
      ships: 4,
      shipType: 'fighter',
      controls: ['display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'align-content'],
      start: { display: 'flex' },
      solution: { 'flex-direction': 'column-reverse', 'justify-content': 'center', 'align-items': 'flex-end' }
    }
  ];

  var shipTypes = {
    fighter: { unit: 'ספינה', icon: 'icon-fighter' },
    freighter: { unit: 'משאית', icon: 'icon-freighter' }
  };

  window.FLEX_DOCK = {
    properties: properties,
    levels: levels,
    shipTypes: shipTypes,
    maxStars: 3
  };
})();
