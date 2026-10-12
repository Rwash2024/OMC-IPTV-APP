// Arabic / English switch, remembered in this browser.
(function () {
  var html = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  var lang = saved || ((navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en');
  function apply(l) {
    html.lang = l; html.dir = l === 'ar' ? 'rtl' : 'ltr';
    var b = document.getElementById('lang'); if (b) b.textContent = l === 'ar' ? 'English' : 'عربي';
    try { localStorage.setItem('lang', l); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    apply(lang);
    var b = document.getElementById('lang');
    if (b) b.addEventListener('click', function () { lang = lang === 'ar' ? 'en' : 'ar'; apply(lang); });
  });
})();
