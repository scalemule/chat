/**
 * Text emoticon → emoji auto-replacement table.
 *
 * Entries are sorted longest-first so longer patterns match before the
 * shorter overlapping ones (e.g. ":-)" matches before ":)" ). Consumed by
 * `RichTextInput` on `text-change` — when a user types an emoticon followed
 * by a space, the emoticon is replaced in-place with its emoji.
 */

export const EMOTICON_MAP: ReadonlyArray<readonly [string, string]> = [
  // Happy
  [':-)', '😊'],
  [':)', '😊'],
  [':-D', '😄'],
  [':D', '😄'],
  ['=)', '😊'],
  ['^_^', '😊'],
  // Sad
  [':-(', '😞'],
  [':(', '😞'],
  [":'(", '😢'],
  // Wink
  [';-)', '😉'],
  [';)', '😉'],
  // Tongue
  [':-P', '😛'],
  [':P', '😛'],
  [':-p', '😛'],
  [':p', '😛'],
  // Laughing
  ['XD', '😆'],
  ['xD', '😆'],
  // Love
  ['</3', '💔'],
  ['<3', '❤️'],
  // Surprise
  [':-O', '😮'],
  [':O', '😮'],
  ['O_O', '😳'],
  ['o_o', '😳'],
  // Neutral / Other
  [':-/', '😕'],
  [':/', '😕'],
  [':-|', '😐'],
  [':|', '😐'],
  ['-_-', '😑'],
  ['>:(', '😠'],
  ['>:)', '😈'],
  ['B)', '😎'],
  [':3', '😺'],
  ['D:', '😧'],
  ['T_T', '😭'],
  ['>.<', '😣'],
];
