// Apply the saved palette before first paint (kept external so CSP can stay script-src 'self').
try { var p = localStorage.getItem('pal'); if (p === 'viridis' || p === 'graphite') document.documentElement.dataset.pal = p; } catch (e) {}
