import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve('dist');
const destination=path.resolve(process.argv[2]||'../FLASH-SWIM-для-просмотра-с-видео');
if(destination===source||destination.startsWith(source+path.sep))throw new Error('Preview must be outside dist');
await mkdir(destination,{recursive:true});
await cp(source,destination,{recursive:true});
const playlist=JSON.stringify(JSON.parse(await readFile(path.join(source,'hero-media.json'),'utf8'))).replaceAll('<','\\u003c');
const index=await readFile(path.join(destination,'index.html'),'utf8');
const marker='<script src="hero-media.js" defer></script>';
if(!index.includes(marker))throw new Error('Playlist script was not found');
await writeFile(path.join(destination,'index.html'),index.replace(marker,`<script type="application/json" id="hero-media-data">${playlist}</script>\n  ${marker}`));
await writeFile(path.join(destination,'ПРОЧИТАЙТЕ.txt'),'\uFEFF'+[
  'FLASH SWIM — версия с видео',
  '',
  '1. Полностью распакуйте ZIP в отдельную папку.',
  '2. Откройте index.html двойным щелчком в Chrome, Edge или Firefox.',
  '',
  'Установка программ и запуск сервера не нужны.',
  'В архив включены видео тренировок, фотографии, шрифты и анимации.',
  'На первом экране текст слева и одно тихое видео справа — без звука, кнопок и переключения материалов.',
  'Чистый фрагмент тренировок в бассейне плавно повторяется через растворение кадров.',
  'Если браузер запрещает автозапуск или включено уменьшение движения, видна фотография команды.',
  'В разделе сборов пять фотографий: нажимайте на фото, стрелки или миниатюры; на телефоне можно листать свайпом. Фотографии остаются внутри сайта.',
  'Для живой карты, построения маршрута, отзывов Яндекса и ссылок на Telegram и WhatsApp нужен интернет.',
  'Кнопки записи открывают настоящие контакты школы.',
  'Не открывайте index.html прямо внутри ZIP: сначала распакуйте все файлы.',
  ''
].join('\r\n'));
console.log(destination);
