/* MOMENTO — style presets, copy and AI prompts. */
(function () {
  'use strict';

  const STYLES = {
    japanese: {
      id: 'japanese',
      name: '日系拼贴',
      en: 'Japanese Junk Journal',
      short: '日系',
      kicker: 'MORNING PAPER',
      desc: '晨光落在牛皮纸上，和纸胶带、水彩小物与被珍藏的日常。',
      chips: ['和纸胶带', '水彩小物', '牛皮纸'],
      captions: ['小さな幸せ', 'morning light', 'おいしい時間', 'day by day', 'souvenir'],
      defaultNote: '小さな幸せを集めて',
      noteLabel: '一句手写',
      palette: {
        paper: '#e8d5b8',
        paperDeep: '#d8c19f',
        paperLight: '#f4e8d4',
        ink: '#4a3b2e',
        inkSoft: '#7d6a58',
        frame: '#fffaf0',
        frameEdge: '#eadcc8',
        accent: '#c87557',
        accentSoft: '#e8b9a4',
        second: '#8d9c7c',
        third: '#b7c4c8',
        tape: 'rgba(232, 185, 164, .82)',
        note: '#f7ecd8'
      },
      prompt: 'Aesthetic Japanese junk journal scrapbooking spread, creative collage layout. The items from the photo turned into a white-border polaroid snapshot, adorned with patterned washi tape, cute watercolor food doodles, dashed outline markers, handwritten ingredient notes, textured kraft paper background, warm soft morning sunlight, highly detailed flat lay'
    },
    american: {
      id: 'american',
      name: '美式复古',
      en: 'American Vintage',
      short: '美式',
      kicker: 'ROAD TRIP',
      desc: '褪色票根、红白条纹胶带，把公路电影里的夏天贴进相册。',
      chips: ['票根', '红白条纹', '格纹纸'],
      captions: ['good times', 'ROAD TRIP', "summer '26", 'no. 04', 'stay awhile'],
      defaultNote: 'good times, forever',
      noteLabel: '一句手写',
      palette: {
        paper: '#e3cda8',
        paperDeep: '#cfb58b',
        paperLight: '#f1e3c8',
        ink: '#3c3025',
        inkSoft: '#75614d',
        frame: '#fff8e8',
        frameEdge: '#eadabf',
        accent: '#b44f3a',
        accentSoft: '#d98973',
        second: '#4f6d7a',
        third: '#e2b75e',
        tape: 'rgba(180, 79, 58, .84)',
        note: '#f8efd8'
      },
      prompt: 'Aesthetic American vintage junk journal scrapbooking spread, creative collage layout. The photo turned into a white-border Polaroid snapshot with slightly rounded corners, adorned with red-and-cream striped washi tape, cute retro doodles, dashed outline markers, handwritten notes on vintage index cards, distressed ticket stubs, and faded gingham paper scraps, textured kraft paper background, warm soft morning sunlight, highly detailed flat lay'
    },
    gothic: {
      id: 'gothic',
      name: '英伦哥特',
      en: 'British Gothic',
      short: '哥特',
      kicker: 'NOCTURNE',
      desc: '黑色蕾丝与墨色植物，在暗色羊皮纸上写下一段静谧的夜。',
      chips: ['蕾丝', '墨色植物', '火漆印'],
      captions: ['memento mori', 'nocturne', 'the raven', 'chapter IV', 'et in arcadia'],
      defaultNote: 'beauty in the shadows',
      noteLabel: '一句手写',
      palette: {
        paper: '#2b2825',
        paperDeep: '#1e1c1a',
        paperLight: '#3b3530',
        ink: '#e8ddcb',
        inkSoft: '#b6a992',
        frame: '#191715',
        frameEdge: '#4b4238',
        accent: '#983b35',
        accentSoft: '#b96b60',
        second: '#75827a',
        third: '#c9b794',
        tape: 'rgba(18, 17, 16, .92)',
        note: '#cbb997'
      },
      prompt: 'Aesthetic British Gothic junk journal scrapbooking spread, creative collage layout. The photo turned into a white-border Polaroid snapshot with a subtly distressed black border, adorned with black lace washi tape, moody ink-sketched botanical and raven doodles, dashed outline markers, handwritten notes in elegant copperplate script, antique wax-seal accents, and aged parchment scraps, textured dark kraft paper background, soft misty morning light, highly detailed flat lay'
    },
    french: {
      id: 'french',
      name: '法式乡村',
      en: 'French Country',
      short: '法式',
      kicker: 'DOUCEUR',
      desc: '花布胶带、薰衣草与蕾丝晨光，像南法乡间的一封旧信。',
      chips: ['碎花', '蕾丝', '薰衣草'],
      captions: ['douceur', 'mon amour', 'la vie est belle', 'souvenir', 'un matin'],
      defaultNote: 'la douceur des jours',
      noteLabel: '一句手写',
      palette: {
        paper: '#f0e1d6',
        paperDeep: '#dfc9bd',
        paperLight: '#faf0e8',
        ink: '#57423d',
        inkSoft: '#8d726b',
        frame: '#fffaf4',
        frameEdge: '#ecd9ce',
        accent: '#b56d77',
        accentSoft: '#e3b7bd',
        second: '#7f8e9d',
        third: '#a99bb8',
        tape: 'rgba(228, 193, 199, .88)',
        note: '#fbf2e9'
      },
      prompt: 'Aesthetic French country romantic junk journal scrapbooking spread, creative collage layout. The photo turned into a white-border Polaroid snapshot with a delicate scalloped edge, adorned with floral toile washi tape, cute watercolor floral doodles, dashed outline markers, handwritten notes in flowing cursive, vintage postage stamps, lavender sprigs, and soft ribbon scraps, textured linen-and-kraft paper background, warm soft morning sunlight filtering through lace curtains, highly detailed flat lay'
    },
    disney: {
      id: 'disney', name: '迪士尼拼贴', en: 'Fairy Tale Collage', short: '童话', kicker: 'FAIRY TALE',
      desc: '把照片变成童话电影般的精致拼贴，加入冰雪、城堡、玫瑰与动物伙伴等梦幻元素。',
      chips: ['冰雪魔法', '城堡票根', '童话角色'], captions: ['once upon a time', 'let it go', 'be our guest', 'wild hearts'],
      defaultNote: 'where the magic begins', noteLabel: '一句手写',
      palette: {paper:'#dbe8f4',paperDeep:'#b8cde1',paperLight:'#f5f9ff',ink:'#263b59',inkSoft:'#607a99',frame:'#ffffff',frameEdge:'#d8e5f2',accent:'#6d8fd1',accentSoft:'#b9d6ee',second:'#d8a55b',third:'#e48b9a',tape:'rgba(130,168,220,.78)',note:'#fff8e6'},
      prompt: 'Use the uploaded photos as the visual source and create a unique, highly detailed fairytale collage; preserve the people and pets, add original snowflakes, castles, roses, lanterns and friendly animal silhouettes, cinematic rim light, jewel colors, paper textures, layered scrapbook pieces, refined lighting, sharp details. Do not copy any copyrighted character or logo.'
    },
    cute: {
      id: 'cute', name: '日常可爱拼贴', en: 'Cute Daily Collage', short: '可爱', kicker: 'LITTLE JOY',
      desc: '用照片里的日常瞬间搭配软萌动物、贴纸和糖果色纸片，轻松又有细节。',
      chips: ['动物贴纸', '糖果色', '手绘便签'], captions: ['tiny joy', 'today is cute', 'hello sunshine', 'best day'],
      defaultNote: 'little things, big smiles', noteLabel: '一句手写',
      palette: {paper:'#f8e9e2',paperDeep:'#efd0c8',paperLight:'#fff8f3',ink:'#5b4650',inkSoft:'#9c7882',frame:'#fffdfb',frameEdge:'#f0dfe0',accent:'#ee8f9f',accentSoft:'#f7c3c5',second:'#83b9a7',third:'#f2c66d',tape:'rgba(247,177,187,.8)',note:'#fff6cf'},
      prompt: 'Turn the uploaded photos into a unique cute daily scrapbook collage, preserving the photo subjects; add original hand-drawn bunnies, cats, bears, tiny flowers, stars, stickers and washi tape, layered paper fibers, soft shadows, glossy highlights, rich small details, crisp high-resolution finish.'
    },
    impressionist: {
      id: 'impressionist', name: '印象油画', en: 'Impressionist Oil', short: '油画', kicker: 'PAINTED LIGHT',
      desc: '保留照片的构图与情绪，以莫奈睡莲和梵高式笔触重绘，呈现丰富光影与油彩肌理。',
      chips: ['油彩笔触', '睡莲光影', '星夜色彩'], captions: ['painted light', 'garden study', 'la lumière'],
      defaultNote: 'painted in a daydream', noteLabel: '一句手写',
      palette: {paper:'#d8e2d4',paperDeep:'#aabfae',paperLight:'#eef3e6',ink:'#283b45',inkSoft:'#657c78',frame:'#f8f4df',frameEdge:'#d5d7b8',accent:'#557f8b',accentSoft:'#9fc2b3',second:'#d49a55',third:'#6c75a5',tape:'rgba(118,156,146,.58)',note:'#f8edc9'},
      prompt: 'Repaint the uploaded photos as a refined impressionist oil painting while preserving the subjects and composition; visible layered brushstrokes, luminous natural light, Monet-inspired water and lilies, Van Gogh-inspired swirling sky accents, rich color harmony, tactile canvas grain, intricate details, high clarity.'
    }
  };

  const LAYOUTS = [
    { id: 'scatter', name: '漫游', en: 'Wander', desc: '错落叠贴' },
    { id: 'salon', name: '双联', en: 'Salon', desc: '安静对称' },
    { id: 'column', name: '长卷', en: 'Column', desc: '竖向叙事' }
  ];

  window.MOMENTO_PRESETS = { STYLES, LAYOUTS };
})();
