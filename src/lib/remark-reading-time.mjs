import { toString } from 'mdast-util-to-string';
import getReadingTime from 'reading-time';

/**
 * Remark plugin to calculate reading time and add it to frontmatter.
 */
export function remarkReadingTime() {
  return function (tree, { data }) {
    const textOnPage = toString(tree);
    const readingTime = getReadingTime(textOnPage);
    data.astro.frontmatter.readingTimeMinutes = Math.ceil(readingTime.minutes);
  };
}
