(() => {
  const storageKey = "eminonu:reload-from-top";

  try {
    const storedValue = window.sessionStorage.getItem(storageKey);

    if (!storedValue) {
      return;
    }

    const reloadIntent = JSON.parse(storedValue);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const intentAge = Date.now() - Number(reloadIntent.createdAt || 0);
    const shouldStartAtTop =
      reloadIntent.path === currentPath && intentAge >= 0 && intentAge < 5000;

    if (!shouldStartAtTop) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.scrollTo(0, 0);
  } catch (_error) {
    // Reload remains usable when browser storage is unavailable.
  }
})();
