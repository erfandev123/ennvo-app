/* Applied before the first paint so dark mode never flashes white.
   Kept as an external file so the Content-Security-Policy can stay strict. */
(function () {
  try {
    if (localStorage.getItem('ennvo_theme_mode') === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#000000';
    }
  } catch (e) {}
})();

/* Google Fonts is preloaded in index.html; promote it to a real stylesheet as
   soon as the DOM is ready. Done here (not with an inline onload attribute) so
   the Content-Security-Policy can stay "script-src 'self'". */
document.addEventListener('DOMContentLoaded', function () {
  var links = document.querySelectorAll('link[data-async-css]');
  for (var i = 0; i < links.length; i++) {
    links[i].setAttribute('rel', 'stylesheet');
    links[i].removeAttribute('data-async-css');
  }
});
