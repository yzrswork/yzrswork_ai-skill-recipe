export const SCHEMA_VERSION = 2;
export const GENERATION_VERSION = 1;
export const SAVE_KEY = 'yzrs-kuku-save-v2';
export const LEGACY_KEYS = ['yzrs-kuku-best-v1', 'yzrs-kuku-progress-v1'];
export const ROUTES = [
  { id: 'ascending', name: 'のぼりのみち', reward: 2 },
  { id: 'descending', name: 'くだりのみち', reward: 2 },
  { id: 'random', name: 'まよいのみち', reward: 3 },
];
export const WEAPONS = ['ひのきのそろばん', 'たびびとの電卓', 'ゆうしゃの電卓', '伝説の電卓', '伝説の電卓・覚醒'];
export const STAGES = [
  [2, 'ふたごのそうげん', 'にしちオーガ', 'grass', 0, 0, ['つのうさぎ', 'たねカブト', 'そうげんポック']],
  [3, 'みつばのもり', 'さざんキング', 'forest', 0, 0, ['みつばフクロウ', 'きのこドラム', 'こえだリス']],
  [5, 'ごいちこうざん', 'ごいちまじん', 'mine', 0, 0, ['レールモグラ', 'けっしょうカニ', 'ハンマーポック']],
  [4, 'きかいのまち', 'しさんゴーレム', 'machine', 0, 0, ['はぐるまドローン', 'パイプカメ', 'ボルトポック']],
  [6, 'ろっかくかざん', 'ろくろくドラゴン', 'volcano', 1, 0, ['ひのこトカゲ', 'ろっかくカブト', 'ようがんポック']],
  [7, 'ななつぼしのさばく', 'しちはゴースト', 'desert', 1, 0, ['すなフクロウ', 'いせきカニ', 'ほしポック']],
  [8, 'やつがねのせつげん', 'はっぱビースト', 'snow', 2, 20, ['こおりうさぎ', 'つららカメ', 'ゆきポック']],
  [9, 'ここのつのそらじろ', 'くくナイト', 'sky', 2, 15, ['くもドローン', 'そらカブト', 'やりポック']],
  [null, 'ムゲンじょう', 'わすれまおう ムゲン', 'castle', 3, 12, ['しるしフクロウ', 'まほうカメ', 'かげポック']],
].map(([dan, name, boss, theme, weapon, seconds, enemies], index) => ({ id: index + 1, dan, name, boss, theme, weapon, seconds, enemies, input: weapon ? 'keypad' : 'choices' }));
