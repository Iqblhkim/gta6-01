/* Round 9 — petunjuk gulir panel HOW TO PLAY (tulis ulang).
   Bar .howtoHint hanya muncul bila teks panel memang masih bisa digulir;
   begitu digulir sampai bawah, teksnya berubah jadi tanda selesai dan
   panel meredup lewat class .atBottom. Murni penanda visual. */
(function () {
  "use strict";
  var scroller = document.getElementById("howtoScroll");
  var hint = document.getElementById("howtoHint");
  var panel = document.getElementById("howtoPanel");
  if (!scroller || !hint || !panel) return;

  function refresh() {
    var scrollable = scroller.scrollHeight - scroller.clientHeight > 8;
    hint.style.display = scrollable ? "flex" : "none";
    if (!scrollable) {
      panel.classList.remove("atBottom");
      return;
    }
    var done = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;
    panel.classList.toggle("atBottom", done);
    hint.textContent = done ? "✓ Sudah sampai bawah" : "Gulir ▾ masih ada di bawah";
  }

  scroller.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh);
  refresh();
  window.setTimeout(refresh, 600);
  window.setTimeout(refresh, 1800);
})();
