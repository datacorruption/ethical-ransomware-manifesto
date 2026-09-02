'use strict';

class WordShuffler {
  constructor(holder, options = {}) {
    const defaults = {
      fps: 120,
      timeOffset: 5,
      textColor: '#000',
      mixCapital: false,
      mixSpecialCharacters: false,
      colors: ['#222222'],
    };

    Object.assign(this, defaults, options);

    this.holder = holder;
    this.interval = 1000 / this.fps;
    this.currentTimeOffset = 0;
    this.currentCharacter = 0;
    this.needUpdate = true;
    this.then = Date.now();

    this.chars = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    ];

    if (this.mixSpecialCharacters) {
      this.chars = this.chars.concat([
        '░', '▒', '▓', '█',
        '▖', '▗', '▘', '▙',
        '▚', '▛', '▜', '▝', '▞', '▟',
      ]);
    }

    this.currentWord = this.holder.textContent.split('');
    this.currentWordLength = this.currentWord.length;

    // Render the fully-revealed, line-broken text once to measure its real
    // height, then lock that in before scrambling starts so the animation
    // can't shift the page content that follows.
    this._renderFrame(this.currentWordLength);
    this.holder.style.height = `${this.holder.getBoundingClientRect().height}px`;

    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  restart() {
    this.currentCharacter = 0;
    this.needUpdate = true;
  }

  _getRandomColor() {
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }

  _getRandomCharacter(originalChar) {
    if (originalChar === ' ') return ' ';
    const picked = this.chars[Math.floor(Math.random() * this.chars.length)];
    return this.mixCapital && Math.random() < 0.5 ? picked : picked.toLowerCase();
  }

  _renderCharacter(value, color) {
    const span = document.createElement('span');
    span.style.color = color;
    span.textContent = value;
    return span;
  }

  // Renders `revealCount` characters as settled, the rest as scrambled.
  // Each word is forced onto its own line, always, rather than letting it
  // wrap based on available width.
  _renderFrame(revealCount) {
    this.holder.innerHTML = '';
    this.currentWord.forEach((char, index) => {
      if (char === ' ') {
        this.holder.appendChild(document.createElement('br'));
        return;
      }
      const revealed = index < revealCount;
      const value = revealed ? char : this._getRandomCharacter(char);
      const color = revealed ? this.textColor : this._getRandomColor();
      this.holder.appendChild(this._renderCharacter(value, color));
    });
  }

  _update() {
    this.now = Date.now();
    this.delta = this.now - this.then;

    if (this.delta <= this.interval) return;

    this.currentTimeOffset++;
    if (this.currentTimeOffset === this.timeOffset && this.currentCharacter !== this.currentWordLength) {
      this.currentCharacter++;
      this.currentTimeOffset = 0;
    }

    if (this.currentCharacter === this.currentWordLength) {
      this.needUpdate = false;
      this.holder.style.height = '';
    }

    this._renderFrame(this.currentCharacter);

    this.then = this.now - (this.delta % this.interval);
  }

  _tick() {
    if (this.needUpdate) this._update();
    requestAnimationFrame(this._tick);
  }
}

// Measures whether an element's rendered content extends past its own box,
// regardless of the element's `overflow` value (scrollWidth isn't reliable
// for that check on `visible`/`hidden` boxes).
function measureOverflow(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = range.getClientRects();
  const elRight = el.getBoundingClientRect().right;
  let maxRight = 0;
  for (const rect of rects) maxRight = Math.max(maxRight, rect.right);
  return maxRight - elRight;
}

// Shrinks the header's font-size, if needed, so its text (each word forced
// onto its own line, matching WordShuffler's rendering) never forces the
// scale image onto its own row. A small safety margin covers minor
// cross-browser font-metric differences and the shuffle animation's
// character substitutions, without the drastic over-shrinking that measuring
// against a solid block-glyph stand-in caused (those glyphs aren't in the
// heading's own font, so they fall back to a much wider font for the
// measurement).
function fitHeaderToRow(header, text, { minFontSize = 14, safetyMargin = 6 } = {}) {
  const words = text.split(' ');

  const renderWords = () => {
    header.innerHTML = '';
    words.forEach((word, index) => {
      if (index > 0) header.appendChild(document.createElement('br'));
      header.appendChild(document.createTextNode(word));
    });
  };

  header.style.fontSize = '';
  renderWords();

  let fontSize = parseFloat(getComputedStyle(header).fontSize);
  while (fontSize > minFontSize && measureOverflow(header) > -safetyMargin) {
    fontSize -= 1;
    header.style.fontSize = `${fontSize}px`;
  }

  header.textContent = words.join(' ');
}

document.addEventListener('DOMContentLoaded', () => {
  const headline = document.getElementById('header');
  if (!headline) return;

  // Captured once, before any scrambling or line-break markup touches the
  // element — fitHeaderToRow always needs the real word boundaries, and
  // headline.textContent stops reflecting those once _renderFrame's <br>
  // elements are in place (a <br> contributes no space to textContent).
  const originalText = headline.textContent;

  let shuffler = null;

  const start = () => {
    fitHeaderToRow(headline, originalText);
    shuffler = new WordShuffler(headline, {
      textColor: '#222222',
      timeOffset: 5,
      mixCapital: true,
      mixSpecialCharacters: true,
    });
  };

  // Wait for the webfont so the pre-scramble measurements match the font
  // that will actually render, not a fallback's metrics.
  const ready = document.fonts && document.fonts.ready
    ? document.fonts.ready
    : Promise.resolve();

  ready.then(start);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      headline.style.height = '';
      fitHeaderToRow(headline, originalText);

      // If the shuffle already settled, fitHeaderToRow's plain-text cleanup
      // just replaced the forced-line-break markup — rebuild it at the new
      // size and re-lock the height. A still-running animation will
      // overwrite this on its next tick anyway.
      if (shuffler && !shuffler.needUpdate) {
        shuffler._renderFrame(shuffler.currentWordLength);
        headline.style.height = `${headline.getBoundingClientRect().height}px`;
      }
    }, 150);
  });
});
