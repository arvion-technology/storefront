/**
 * Inline SVG product art. Twelve scenes, one per catalogue product, drawn from
 * the product's two-tone palette. No images, no network requests; the art is
 * part of the page and scales with the card.
 */

const SCENES = {
  tea: ({ ink, light, deep }) => `
    <ellipse cx="200" cy="238" rx="112" ry="15" fill="${deep}" opacity=".12"/>
    <path d="M132 134h126v26a63 63 0 0 1-126 0z" fill="${ink}"/>
    <path d="M258 144q38 4 33 32-4 22-33 25" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="195" cy="134" rx="63" ry="11" fill="${light}"/>
    <ellipse cx="195" cy="135" rx="49" ry="7" fill="${deep}" opacity=".55"/>
    <path d="M180 112q-10-20 2-36M202 108q-8-22 4-36M224 112q-6-18 4-30" fill="none" stroke="${light}" stroke-width="6" stroke-linecap="round" opacity=".9"/>
    <g fill="${deep}" opacity=".85">
      <path d="M104 242q10-34 40-30-4 30-40 30z"/>
      <path d="M300 236q-4-30 30-32-2 31-30 32z"/>
    </g>`,
  coffee: ({ ink, light, deep }) => `
    <ellipse cx="200" cy="242" rx="104" ry="13" fill="${deep}" opacity=".12"/>
    <path d="M140 104h120l16 126q-76 26-152 0z" fill="${ink}"/>
    <path d="M140 104h120l-8 18h-104z" fill="${deep}" opacity=".45"/>
    <rect x="166" y="142" width="68" height="58" rx="8" fill="${light}" opacity=".92"/>
    <path d="M180 158h40M180 172h40M180 186h26" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <g fill="${deep}">
      <ellipse cx="106" cy="214" rx="13" ry="9" transform="rotate(-24 106 214)"/>
      <ellipse cx="122" cy="234" rx="13" ry="9" transform="rotate(18 122 234)"/>
      <ellipse cx="300" cy="222" rx="13" ry="9" transform="rotate(28 300 222)"/>
      <ellipse cx="284" cy="244" rx="13" ry="9" transform="rotate(-12 284 244)"/>
    </g>
    <path d="M190 226q10-12 20 0M190 236q10-12 20 0" stroke="${light}" stroke-width="4" fill="none" opacity=".7"/>`,
  mug: ({ ink, light, deep }) => `
    <ellipse cx="192" cy="236" rx="104" ry="15" fill="${deep}" opacity=".12"/>
    <path d="M238 142q46 0 46 35t-46 35" fill="none" stroke="${ink}" stroke-width="14" stroke-linecap="round"/>
    <rect x="126" y="118" width="116" height="104" rx="18" fill="${ink}"/>
    <rect x="126" y="118" width="116" height="30" rx="14" fill="${light}" opacity=".35"/>
    <ellipse cx="184" cy="119" rx="58" ry="11" fill="${light}"/>
    <ellipse cx="184" cy="120" rx="45" ry="7" fill="${deep}" opacity=".5"/>
    <path d="M150 178q14-10 28 0t28 0" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round" opacity=".65"/>`,
  vase: ({ ink, light, deep }) => `
    <ellipse cx="200" cy="248" rx="84" ry="11" fill="${deep}" opacity=".12"/>
    <path d="M176 96h52l6 34q26 28 22 76-3 34-56 34t-56-34q-4-48 22-76z" fill="${ink}"/>
    <ellipse cx="202" cy="96" rx="27" ry="7" fill="${light}"/>
    <g fill="none" stroke="${deep}" stroke-width="4" stroke-linecap="round">
      <path d="M202 96q-16-34-34-48"/>
      <path d="M202 96q10-36 2-58"/>
      <path d="M202 96q22-24 38-32"/>
    </g>
    <g fill="${deep}">
      <ellipse cx="164" cy="50" rx="15" ry="7" transform="rotate(28 164 50)"/>
      <ellipse cx="204" cy="34" rx="15" ry="7" transform="rotate(-8 204 34)"/>
      <ellipse cx="242" cy="60" rx="15" ry="7" transform="rotate(-38 242 60)"/>
    </g>
    <path d="M160 166q6 34 2 64M244 168q-6 32-2 60" stroke="${light}" stroke-width="4" opacity=".5" fill="none"/>`,
  throw: ({ ink, light, deep }) => `
    <g transform="rotate(-3 200 170)">
      <rect x="82" y="118" width="236" height="106" rx="10" fill="${ink}"/>
      <rect x="82" y="142" width="236" height="16" fill="${light}" opacity=".55"/>
      <rect x="82" y="178" width="236" height="8" fill="${light}" opacity=".38"/>
      <rect x="82" y="200" width="236" height="24" fill="${deep}" opacity=".22"/>
      <g stroke="${light}" stroke-width="4" opacity=".6">
        <path d="M92 118v106M114 118v106M136 118v106M158 118v106M180 118v106M202 118v106M224 118v106M246 118v106M268 118v106M290 118v106M310 118v106"/>
      </g>
    </g>
    <g stroke="${deep}" stroke-width="4" stroke-linecap="round" opacity=".55">
      <path d="M96 228v14M110 228v14M124 228v14M282 232v14M296 232v14M310 232v14"/>
    </g>`,
  scarf: ({ ink, light, deep }) => `
    <path d="M92 118q56-40 108-8 44 28 96-8 24-16 38-8v40q-22 0-44 20-52 40-98 0-42-36-94 8z" fill="${ink}"/>
    <path d="M120 118q52-24 96 4 42 26 92-6" fill="none" stroke="${light}" stroke-width="5" opacity=".6"/>
    <path d="M116 150q54-20 98 8 40 24 86 0" fill="none" stroke="${deep}" stroke-width="5" opacity=".45"/>
    <g stroke="${deep}" stroke-width="4" stroke-linecap="round" opacity=".6">
      <path d="M88 130l-14 6M92 144l-14 8M100 158l-12 8"/>
    </g>
    <g fill="${light}" opacity=".75">
      <circle cx="150" cy="132" r="4"/><circle cx="186" cy="140" r="4"/><circle cx="224" cy="134" r="4"/><circle cx="258" cy="132" r="4"/>
    </g>`,
  notebook: ({ ink, light, deep }) => `
    <g transform="rotate(-7 200 160)">
      <rect x="118" y="80" width="164" height="146" rx="9" fill="${ink}"/>
      <rect x="132" y="80" width="12" height="146" fill="${deep}" opacity=".55"/>
      <rect x="152" y="96" width="118" height="114" rx="5" fill="${light}" opacity=".8"/>
      <g fill="${ink}" opacity=".28">
        ${Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 6 }, (_, column) => `<circle cx="${166 + column * 18}" cy="${114 + row * 18}" r="2.4"/>`).join("")
        ).join("")}
      </g>
      <path d="M248 96v46l-14-10-14 10V96z" fill="${deep}" opacity=".55"/>
    </g>`,
  cards: ({ ink, light, deep }) => `
    <g transform="rotate(-14 200 170)">
      <rect x="118" y="108" width="130" height="92" rx="6" fill="${ink}" opacity=".55"/>
    </g>
    <g transform="rotate(-3 200 170)">
      <rect x="136" y="98" width="130" height="96" rx="6" fill="${deep}" opacity=".5"/>
    </g>
    <g transform="rotate(8 200 170)">
      <rect x="154" y="94" width="132" height="100" rx="6" fill="${light}"/>
      <g fill="${ink}" opacity=".78">
        <circle cx="220" cy="142" r="9"/>
        <circle cx="236" cy="134" r="9"/>
        <circle cx="237" cy="152" r="9"/>
        <circle cx="204" cy="134" r="9"/>
        <circle cx="204" cy="152" r="9"/>
        <circle cx="220" cy="143" r="5" fill="${light}"/>
      </g>
      <path d="M176 172h74" stroke="${deep}" stroke-width="4" opacity=".5"/>
    </g>`,
  rice: ({ ink, light, deep }) => `
    <path d="M142 148h116l12 92q-70 24-140 0z" fill="${ink}"/>
    <path d="M142 148q28-18 58-18t58 18z" fill="${light}" opacity=".4"/>
    <path d="M168 130q32-26 64 0l-8 18h-48z" fill="${deep}" opacity=".6"/>
    <rect x="168" y="176" width="64" height="50" rx="7" fill="${light}" opacity=".85"/>
    <path d="M182 192h36M182 206h24" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <g fill="${deep}" opacity=".75">
      <ellipse cx="112" cy="236" rx="10" ry="5" transform="rotate(-20 112 236)"/>
      <ellipse cx="128" cy="250" rx="10" ry="5" transform="rotate(16 128 250)"/>
      <ellipse cx="288" cy="242" rx="10" ry="5" transform="rotate(-14 288 242)"/>
    </g>`,
  pepper: ({ ink, light, deep }) => `
    <ellipse cx="200" cy="240" rx="86" ry="12" fill="${deep}" opacity=".12"/>
    <rect x="152" y="124" width="96" height="100" rx="16" fill="${ink}"/>
    <rect x="146" y="104" width="108" height="26" rx="10" fill="${deep}"/>
    <rect x="168" y="156" width="64" height="46" rx="7" fill="${light}" opacity=".9"/>
    <path d="M182 172h36M182 188h24" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <g fill="${deep}">
      <circle cx="116" cy="232" r="7"/><circle cx="134" cy="246" r="6"/><circle cx="286" cy="238" r="7"/><circle cx="306" cy="226" r="5"/>
      <circle cx="102" cy="214" r="5"/>
    </g>`,
  candle: ({ ink, light, deep }) => `
    <circle cx="204" cy="102" r="52" fill="${light}" opacity=".5"/>
    <rect x="170" y="144" width="62" height="94" rx="12" fill="${ink}"/>
    <ellipse cx="201" cy="144" rx="31" ry="9" fill="${light}"/>
    <ellipse cx="201" cy="145" rx="22" ry="5" fill="${deep}" opacity=".5"/>
    <path d="M198 136q-4-20 4-32 14 12 8 32z" fill="${deep}"/>
    <path d="M201 128q1-10 5-16" stroke="${light}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M184 190q16-8 34 0" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`,
  jug: ({ ink, light, deep }) => `
    <ellipse cx="196" cy="246" rx="94" ry="12" fill="${deep}" opacity=".12"/>
    <path d="M158 124h86l-8 26q30 30 24 68-6 32-60 32t-60-32q-6-38 24-68z" fill="${ink}"/>
    <path d="M244 142q40 2 34 38t-38 38" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/>
    <path d="M152 118h96l-10 12h-78z" fill="${deep}" opacity=".6"/>
    <path d="M176 118q-2-18 12-22 14 4 12 22" fill="${ink}"/>
    <path d="M166 170q-4 32 0 62" stroke="${light}" stroke-width="5" opacity=".5" fill="none"/>
    <ellipse cx="200" cy="124" rx="48" ry="7" fill="${light}" opacity=".5"/>`,
};

function mix(hexA, hexB, amount) {
  const a = hexA.replace("#", "");
  const b = hexB.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const left = parseInt(a.slice(offset, offset + 2), 16);
    const right = parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(left + (right - left) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  }[character]));
}

export function productArt(product) {
  const [bg, ink] = product.tones || ["#f3e5d0", "#a35d2c"];
  const light = mix(bg, "#ffffff", 0.55);
  const wash = mix(bg, ink, 0.1);
  const deep = mix(ink, "#2a1809", 0.35);
  const scene = SCENES[product.art] || SCENES.notebook;
  return `<svg class="art-svg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(
    product.name
  )} illustration" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="300" fill="${bg}"/>
    <circle cx="342" cy="48" r="88" fill="${light}" opacity=".5"/>
    <path d="M0 246Q108 214 205 240T400 228V300H0Z" fill="${wash}" opacity=".55"/>
    <g>${scene({ ink, light, deep, wash })}</g>
  </svg>`;
}

export { SCENES };
