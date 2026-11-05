// Sets the theme before the page is drawn, so there is no flash of the wrong colours.
(function () {
  try {
    var theme = localStorage.getItem("ttt-theme");
    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) { }
})();