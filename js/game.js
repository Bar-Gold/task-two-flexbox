/* Flex Dock - game logic.

   How a level works
   -----------------
   The board holds two absolutely positioned twins with identical padding:
     #pads  the solution container. Its children are the docking pads and it
            gets the level's solution CSS, so the browser itself decides where
            every pad goes.
     #dock  the player's container. Its children are the ships and it gets
            whatever the player picked in the control panel.
   Checking a level is comparing the layout position of ship i with pad i.
   Any combination of properties that produces the requested arrangement is
   accepted, not only the one written in levels.js.

   Progress (finished levels, attempts, stars, current level) is kept in
   localStorage under one key. Nothing here is required for the page to
   render; without storage the game simply starts from level 1 each time. */

(function () {
  'use strict';

  var data = window.FLEX_DOCK;
  var PROPERTIES = data.properties;
  var LEVELS = data.levels;
  var SHIP_TYPES = data.shipTypes;
  var MAX_STARS = data.maxStars;
  var STORAGE_KEY = 'flexdock.progress.v1';
  var THEME_KEY = 'flexdock.theme';
  var HINT_AFTER_ATTEMPTS = 2;

  var el = {
    board: document.getElementById('board'),
    pads: document.getElementById('pads'),
    dock: document.getElementById('dock'),
    levelIndicator: document.getElementById('level-indicator'),
    levelTitle: document.getElementById('level-title'),
    levelInstruction: document.getElementById('level-instruction'),
    hint: document.getElementById('hint'),
    hintText: document.getElementById('hint-text'),
    hintToggle: document.getElementById('hint-toggle'),
    attempts: document.getElementById('attempts'),
    controls: document.getElementById('controls'),
    props: Array.prototype.slice.call(document.querySelectorAll('.prop')),
    codeBody: document.getElementById('code-body'),
    check: document.getElementById('check'),
    reset: document.getElementById('reset'),
    feedback: document.getElementById('feedback'),
    success: document.getElementById('success'),
    successTitle: document.getElementById('success-title'),
    successStars: document.getElementById('success-stars'),
    successText: document.getElementById('success-text'),
    next: document.getElementById('next'),
    levelMap: document.getElementById('level-map'),
    score: document.getElementById('score'),
    scoreMax: document.getElementById('score-max'),
    themeToggle: document.getElementById('theme-toggle'),
    restart: document.getElementById('restart')
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var state = {
    levelIndex: 0,
    values: {},
    progress: { current: 0, levels: {} }
  };

  /* ------------------------------------------------------------ storage */

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object' && saved.levels) {
        state.progress = {
          current: clampLevel(saved.current),
          levels: saved.levels
        };
      }
    } catch (error) {
      /* Unreadable or blocked storage: start fresh. */
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch (error) {
      /* Storage is optional. */
    }
  }

  function clearProgress() {
    state.progress = { current: 0, levels: {} };
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* Storage is optional. */
    }
  }

  function clampLevel(index) {
    var n = parseInt(index, 10);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(n, LEVELS.length - 1);
  }

  function levelRecord(index) {
    var key = String(index + 1);
    if (!state.progress.levels[key]) {
      state.progress.levels[key] = { done: false, attempts: 0, stars: 0 };
    }
    return state.progress.levels[key];
  }

  /* A level can be played if it is finished or it is the first unfinished one. */
  function isUnlocked(index) {
    for (var i = 0; i < index; i += 1) {
      if (!levelRecord(i).done) return false;
    }
    return true;
  }

  function totalStars() {
    var sum = 0;
    for (var i = 0; i < LEVELS.length; i += 1) sum += levelRecord(i).stars;
    return sum;
  }

  function starsForAttempts(attempts) {
    if (attempts <= 1) return 3;
    if (attempts <= 3) return 2;
    return 1;
  }

  /* --------------------------------------------------------- properties */

  function propertyByName(name) {
    for (var i = 0; i < PROPERTIES.length; i += 1) {
      if (PROPERTIES[i].name === name) return PROPERTIES[i];
    }
    return null;
  }

  function initialValues() {
    var values = {};
    PROPERTIES.forEach(function (prop) {
      values[prop.name] = prop.initial;
    });
    return values;
  }

  function merge(base, extra) {
    var out = {};
    var key;
    for (key in base) if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    for (key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) out[key] = extra[key];
    return out;
  }

  function startValues(level) {
    return merge(initialValues(), level.start);
  }

  function solutionValues(level) {
    return merge(merge(initialValues(), { display: 'flex' }), level.solution);
  }

  function applyValues(container, values) {
    PROPERTIES.forEach(function (prop) {
      container.style.setProperty(prop.name, values[prop.name]);
    });
  }

  /* ------------------------------------------------------------ board */

  function buildShip(level, index, ghost) {
    var type = SHIP_TYPES[level.shipType];
    var item = document.createElement('li');
    var number = index + 1;

    if (ghost) {
      item.className = 'pad pad--' + level.shipType;
      item.textContent = String(number);
      return item;
    }

    item.className = 'ship ship--' + level.shipType;

    var svgNs = 'http://www.w3.org/2000/svg';
    var icon = document.createElementNS(svgNs, 'svg');
    icon.setAttribute('class', 'ship__icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    var use = document.createElementNS(svgNs, 'use');
    use.setAttribute('href', '#' + type.icon);
    icon.appendChild(use);

    var label = document.createElement('span');
    label.className = 'ship__label';
    var hiddenUnit = document.createElement('span');
    hiddenUnit.className = 'visually-hidden';
    hiddenUnit.textContent = type.unit + ' ';
    label.appendChild(hiddenUnit);
    label.appendChild(document.createTextNode(String(number)));

    item.appendChild(icon);
    item.appendChild(label);
    return item;
  }

  function renderBoard(level) {
    el.pads.textContent = '';
    el.dock.textContent = '';
    for (var i = 0; i < level.ships; i += 1) {
      el.pads.appendChild(buildShip(level, i, true));
      el.dock.appendChild(buildShip(level, i, false));
    }
    applyValues(el.pads, solutionValues(level));
    applyValues(el.dock, state.values);
    el.board.classList.remove('is-success');
  }

  /* FLIP: remember where every ship is, change the layout, then animate each
     ship from its old spot to the new one with a transform. */
  function relayout(mutate) {
    var ships = Array.prototype.slice.call(el.dock.children);
    if (reduceMotion.matches || ships.length === 0) {
      mutate();
      return;
    }

    var first = ships.map(function (ship) { return ship.getBoundingClientRect(); });
    ships.forEach(function (ship) {
      ship.style.transition = 'none';
      ship.style.transform = '';
    });

    mutate();

    var last = ships.map(function (ship) { return ship.getBoundingClientRect(); });
    ships.forEach(function (ship, i) {
      var dx = first[i].left - last[i].left;
      var dy = first[i].top - last[i].top;
      if (dx || dy) ship.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    });

    void el.dock.offsetWidth; /* commit the inverted positions before animating */

    window.requestAnimationFrame(function () {
      ships.forEach(function (ship) {
        ship.style.transition = '';
        ship.style.transform = '';
      });
    });
  }

  /* Layout positions (offsetLeft/Top) ignore transforms, so a ship that is
     still gliding is judged by where it will land, not where it is drawn. */
  function dockedShips() {
    var ships = el.dock.children;
    var pads = el.pads.children;
    var docked = [];
    for (var i = 0; i < ships.length; i += 1) {
      var ship = ships[i];
      var pad = pads[i];
      var ok = Math.abs(ship.offsetLeft - pad.offsetLeft) <= 1 &&
        Math.abs(ship.offsetTop - pad.offsetTop) <= 1 &&
        Math.abs(ship.offsetWidth - pad.offsetWidth) <= 1 &&
        Math.abs(ship.offsetHeight - pad.offsetHeight) <= 1;
      docked.push(ok);
    }
    return docked;
  }

  /* ---------------------------------------------------------- controls */

  function syncControls() {
    var level = LEVELS[state.levelIndex];
    var previous = state.levelIndex > 0 ? LEVELS[state.levelIndex - 1].controls : [];

    el.props.forEach(function (fieldset) {
      var name = fieldset.getAttribute('data-prop');
      var enabled = level.controls.indexOf(name) !== -1;
      fieldset.hidden = !enabled;
      fieldset.disabled = !enabled;

      var badge = fieldset.querySelector('.prop__badge');
      badge.hidden = !(enabled && previous.indexOf(name) === -1);

      var input = fieldset.querySelector('input[value="' + state.values[name] + '"]');
      if (input) input.checked = true;
    });
  }

  function renderCode() {
    var level = LEVELS[state.levelIndex];
    var body = el.codeBody;
    body.textContent = '';

    function span(className, text) {
      var s = document.createElement('span');
      s.className = className;
      s.textContent = text;
      return s;
    }

    body.appendChild(span('code__selector', '.dock'));
    body.appendChild(span('code__punct', ' {\n'));

    level.controls.forEach(function (name) {
      var prop = propertyByName(name);
      var value = state.values[name];
      var line = span('code__line', '');
      if (value === prop.initial) line.className += ' code__line--default';
      line.appendChild(document.createTextNode('  '));
      line.appendChild(span('code__prop', name));
      line.appendChild(span('code__punct', ': '));
      line.appendChild(span('code__value', value));
      line.appendChild(span('code__punct', ';\n'));
      body.appendChild(line);
    });

    body.appendChild(span('code__punct', '}'));
  }

  function onControlChange(event) {
    var input = event.target;
    if (!input || input.type !== 'radio' || !input.checked) return;
    var name = input.name;
    if (!propertyByName(name)) return;

    state.values[name] = input.value;
    relayout(function () {
      applyValues(el.dock, state.values);
    });
    renderCode();
    clearOutcome();
  }

  /* ------------------------------------------------------------- level */

  function renderMission(level) {
    el.levelIndicator.textContent = 'שלב ' + (state.levelIndex + 1) + ' מתוך ' + LEVELS.length;
    el.levelTitle.textContent = level.title;
    el.levelInstruction.textContent = level.instruction;
    el.hintText.textContent = level.hint;
    el.hint.hidden = true;
    el.hintToggle.setAttribute('aria-expanded', 'false');
    el.hintToggle.textContent = 'רמז';
  }

  function renderDescriptions() {
    PROPERTIES.forEach(function (prop) {
      var desc = document.getElementById('desc-' + prop.name);
      if (desc) desc.textContent = prop.description;
    });
  }

  function renderAttempts() {
    var record = levelRecord(state.levelIndex);
    el.attempts.textContent = String(record.attempts);
    el.hintToggle.hidden = record.attempts < HINT_AFTER_ATTEMPTS;
  }

  function renderScore() {
    el.score.textContent = String(totalStars());
    el.scoreMax.textContent = String(LEVELS.length * MAX_STARS);
  }

  function starString(stars) {
    var out = '';
    for (var i = 0; i < MAX_STARS; i += 1) out += i < stars ? '★' : '☆';
    return out;
  }

  /* "כוכב" is masculine, so 1-3 read: כוכב אחד, שני כוכבים, שלושה כוכבים. */
  function starWords(stars) {
    if (stars === 1) return 'כוכב אחד';
    if (stars === 2) return 'שני כוכבים';
    if (stars === 3) return 'שלושה כוכבים';
    return stars + ' כוכבים';
  }

  function plural(unit) {
    return unit === 'ספינה' ? 'ספינות' : 'משאיות';
  }

  function renderLevelMap() {
    el.levelMap.textContent = '';
    LEVELS.forEach(function (level, index) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      var record = levelRecord(index);
      var unlocked = isUnlocked(index);

      button.type = 'button';
      button.className = 'level';
      if (record.done) button.className += ' level--done';
      if (index === state.levelIndex) {
        button.className += ' level--current';
        button.setAttribute('aria-current', 'step');
      }
      button.disabled = !unlocked;
      button.setAttribute('data-level', String(index));

      var status = record.done ? ', הושלם, ' + starWords(record.stars) : (unlocked ? '' : ', נעול');
      button.setAttribute('aria-label', 'שלב ' + (index + 1) + ': ' + level.title + status);
      button.title = level.title;

      var number = document.createElement('span');
      number.className = 'level__number';
      number.textContent = String(index + 1);
      button.appendChild(number);

      if (record.done) {
        var stars = document.createElement('span');
        stars.className = 'level__stars';
        stars.setAttribute('aria-hidden', 'true');
        stars.textContent = starString(record.stars).replace(/☆/g, '');
        button.appendChild(stars);
      }

      item.appendChild(button);
      el.levelMap.appendChild(item);
    });
  }

  function clearOutcome() {
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    el.success.hidden = true;
    el.board.classList.remove('is-success');
    Array.prototype.forEach.call(el.dock.children, function (ship) {
      ship.classList.remove('is-docked');
    });
    Array.prototype.forEach.call(el.pads.children, function (pad) {
      pad.classList.remove('is-lit');
    });
  }

  function startLevel(index) {
    state.levelIndex = clampLevel(index);
    var level = LEVELS[state.levelIndex];
    state.values = startValues(level);
    state.progress.current = state.levelIndex;
    saveProgress();

    renderMission(level);
    renderBoard(level);
    syncControls();
    renderCode();
    renderAttempts();
    renderLevelMap();
    clearOutcome();
  }

  function resetLevel() {
    var level = LEVELS[state.levelIndex];
    state.values = startValues(level);
    syncControls();
    relayout(function () {
      applyValues(el.dock, state.values);
    });
    renderCode();
    clearOutcome();
    el.feedback.textContent = 'השלב אופס לברירת המחדל.';
    el.feedback.className = 'feedback is-info';
  }

  function checkLevel() {
    var level = LEVELS[state.levelIndex];
    var record = levelRecord(state.levelIndex);
    var docked = dockedShips();
    var count = docked.filter(Boolean).length;
    var unit = SHIP_TYPES[level.shipType].unit;

    record.attempts += 1;
    clearOutcome();

    if (count === docked.length) {
      var firstTime = !record.done;
      if (firstTime) {
        record.done = true;
        record.stars = starsForAttempts(record.attempts);
      }
      saveProgress();
      showSuccess(level, record, firstTime, unit);
    } else {
      saveProgress();
      showFailure(count, docked.length, unit);
    }

    renderAttempts();
    renderScore();
    renderLevelMap();
  }

  function showSuccess(level, record, firstTime, unit) {
    var isLast = state.levelIndex === LEVELS.length - 1;
    var allDone = LEVELS.every(function (_, i) { return levelRecord(i).done; });

    el.board.classList.add('is-success');
    Array.prototype.forEach.call(el.dock.children, function (ship) {
      ship.classList.add('is-docked');
    });
    Array.prototype.forEach.call(el.pads.children, function (pad) {
      pad.classList.add('is-lit');
    });

    el.successTitle.textContent = firstTime ? 'כל ה' + plural(unit) + ' עגנו!' : 'שוב עגינה מושלמת!';
    el.successStars.textContent = starString(record.stars);
    el.successStars.setAttribute('aria-label', record.stars + ' מתוך ' + MAX_STARS + ' כוכבים');

    if (firstTime) {
      el.successText.textContent = record.stars === 3
        ? 'בניסיון הראשון. שלושה כוכבים.'
        : 'השלב הושלם אחרי ' + record.attempts + ' ניסיונות. ' + starWords(record.stars) + '.';
    } else {
      el.successText.textContent = 'השלב הזה כבר הושלם. הכוכבים שנצברו עליו נשמרים.';
    }

    if (isLast) {
      el.next.hidden = true;
      if (allDone) {
        el.successTitle.textContent = 'כל השלבים הושלמו!';
        el.successText.textContent = 'נצברו ' + totalStars() + ' מתוך ' + (LEVELS.length * MAX_STARS) +
          ' כוכבים. אפשר לחזור לכל שלב ממפת השלבים ולשפר את התוצאה.';
      }
    } else {
      el.next.hidden = false;
    }

    el.success.hidden = false;
    el.next.focus();
  }

  function showFailure(count, total, unit) {
    var message;
    if (count === 0) {
      message = 'אף ' + unit + ' לא עגנה במקום הנכון. השוו את המיקום של כל ' + unit + ' לרציף עם המספר שלה ונסו שוב.';
    } else {
      message = count + ' מתוך ' + total + ' ' + plural(unit) + ' עגנו במקום הנכון. עוד קצת. נסו שוב.';
    }
    el.feedback.textContent = message;
    el.feedback.className = 'feedback is-error';

    if (!reduceMotion.matches) {
      el.board.classList.remove('is-shake');
      void el.board.offsetWidth;
      el.board.classList.add('is-shake');
    }
  }

  function nextLevel() {
    if (state.levelIndex < LEVELS.length - 1) {
      startLevel(state.levelIndex + 1);
      el.levelTitle.focus({ preventScroll: false });
    }
  }

  function toggleHint() {
    var open = el.hint.hidden;
    el.hint.hidden = !open;
    el.hintToggle.setAttribute('aria-expanded', String(open));
    el.hintToggle.textContent = open ? 'הסתרת הרמז' : 'רמז';
  }

  /* ------------------------------------------------------------- theme */

  function currentTheme() {
    var chosen = document.documentElement.getAttribute('data-theme');
    if (chosen === 'dark' || chosen === 'light') return chosen;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function renderThemeToggle() {
    var theme = currentTheme();
    el.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      /* Storage is optional. */
    }
    renderThemeToggle();
  }

  /* ----------------------------------------------------------- restart */

  var restartArmed = null;

  function restartGame() {
    if (restartArmed) {
      window.clearTimeout(restartArmed);
      restartArmed = null;
      el.restart.textContent = 'מחיקת ההתקדמות';
      clearProgress();
      startLevel(0);
      renderScore();
      el.feedback.textContent = 'ההתקדמות נמחקה. מתחילים מהשלב הראשון.';
      el.feedback.className = 'feedback is-info';
      return;
    }
    el.restart.textContent = 'למחוק את כל ההתקדמות? לחצו שוב לאישור';
    restartArmed = window.setTimeout(function () {
      restartArmed = null;
      el.restart.textContent = 'מחיקת ההתקדמות';
    }, 4000);
  }

  /* -------------------------------------------------------------- wire */

  el.controls.addEventListener('change', onControlChange);
  el.controls.addEventListener('submit', function (event) {
    event.preventDefault();
    checkLevel();
  });
  el.reset.addEventListener('click', resetLevel);
  el.next.addEventListener('click', nextLevel);
  el.hintToggle.addEventListener('click', toggleHint);
  el.themeToggle.addEventListener('click', toggleTheme);
  el.restart.addEventListener('click', restartGame);
  el.levelMap.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-level]');
    if (!button || button.disabled) return;
    startLevel(parseInt(button.getAttribute('data-level'), 10));
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderThemeToggle);

  el.levelTitle.tabIndex = -1;

  renderDescriptions();
  loadProgress();
  renderScore();
  renderThemeToggle();
  startLevel(isUnlocked(state.progress.current) ? state.progress.current : 0);

  /* Small read-only surface for the automated tests. Not used by the page. */
  window.FLEX_DOCK.debug = {
    getLevelIndex: function () { return state.levelIndex; },
    getValues: function () { return merge({}, state.values); },
    dockedShips: dockedShips
  };
})();
