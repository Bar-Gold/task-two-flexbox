/* Runs in <head>, before the page paints: restores the theme the player
   chose last time so the page does not flash the wrong colours.
   Everything else lives in game.js. */
(function () {
  'use strict';
  try {
    var theme = window.localStorage.getItem('flexdock.theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {
    /* Storage can be blocked (private mode, disabled cookies). The OS setting applies. */
  }
})();
