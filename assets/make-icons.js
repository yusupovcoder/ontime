// Рисует иконку и заставку On Time (assets/*.png) для @capacitor/assets. Запуск: node assets/make-icons.js
const sharp = require('sharp');
const path = require('path');
const out = (f) => path.join(__dirname, f);
const bg = (s) => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F8BFF"/><stop offset="1" stop-color="#5E5CE6"/></linearGradient>
  <radialGradient id="h" cx="0.3" cy="0.15" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="${s}" height="${s}" fill="url(#g)"/><rect width="${s}" height="${s}" fill="url(#h)"/>`;
// Знак: циферблат-кольцо с галочкой и стрелкой-«хвостиком» сверху (время + сделано).
const mark = (cx, cy, r, color = '#fff') => {
  const w = r * 0.16;
  return `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="${w}" stroke-dasharray="${2 * Math.PI * r * 0.86} ${2 * Math.PI * r * 0.14}" transform="rotate(${-90 + 0.07 * 360} ${cx} ${cy})"/>
    <path d="M ${cx - r * 0.42} ${cy + r * 0.02} L ${cx - r * 0.1} ${cy + r * 0.34} L ${cx + r * 0.48} ${cy - r * 0.3}" stroke-width="${w * 1.05}"/>
    <circle cx="${cx}" cy="${cy - r}" r="${w * 0.55}" fill="${color}" stroke="none"/>
  </g>`;
};
const svg = (s, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${inner}</svg>`);
const rect = (w, h, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`);
(async () => {
  const S = 1024;
  await sharp(svg(S, bg(S) + mark(S / 2, S / 2, S * 0.3))).png().toFile(out('icon-only.png'));
  await sharp(svg(S, bg(S))).png().toFile(out('icon-background.png'));
  await sharp(svg(S, mark(S / 2, S / 2, S * 0.2))).png().toFile(out('icon-foreground.png'));
  const W = 2732;
  const splash = (dark) => rect(W, W, `<rect width="${W}" height="${W}" fill="${dark ? '#000' : '#F2F2F7'}"/>
    <g transform="translate(${W / 2 - 220} ${W / 2 - 220})"><clipPath id="c"><rect width="440" height="440" rx="100"/></clipPath><g clip-path="url(#c)">${bg(440)}${mark(220, 220, 132)}</g></g>`);
  await sharp(splash(false)).png().toFile(out('splash.png'));
  await sharp(splash(true)).png().toFile(out('splash-dark.png'));
  console.log('icons ok');
})();
