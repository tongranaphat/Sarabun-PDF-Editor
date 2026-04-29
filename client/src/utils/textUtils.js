/**
 * Pure utility functions for text processing.
 * Extracted from useCanvas.js to follow Single Responsibility Principle.
 */

/**
 * Wraps Thai text to fit within a maximum pixel width, using Intl.Segmenter
 * for proper Thai word boundary detection.
 *
 * @param {string} text - The text to wrap
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontFamily - CSS font family name
 * @returns {string} Text with newline characters inserted at wrap points
 */
export const wrapThaiText = (text, maxWidth, fontSize, fontFamily) => {
  if (!text) return '';
  if (!window.Intl || !Intl.Segmenter) return text;

  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}`;

  const segmenter = new Intl.Segmenter('th-TH', { granularity: 'word' });
  const words = Array.from(segmenter.segment(text)).map((s) => s.segment);

  let lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (ctx.measureText(word).width <= maxWidth) {
      const testLine = currentLine + word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    } else {
      for (let char of word) {
        const testLineChar = currentLine + char;
        if (ctx.measureText(testLineChar).width > maxWidth && currentLine !== '') {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLineChar;
        }
      }
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
};
