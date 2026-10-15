// 生圖指令：小手機送去給 Gemini 生圖的所有文字都在這裡。
// 想調生圖的感覺（膚色、光線、鏡頭、頭髮⋯）改這個檔就好，不用動別的地方。
// ${...} 是程式會自動換掉的地方（人名、場景），保留原樣。
// 中文（ZH）和英文（EN）各一份，玩家在相本的證件照頁選用哪一份；改的時候兩份都要改。

const ZH = {
  // 開頭：參考照片放在最前面，一張一張講明是誰（照片放在後面，Pro 會當成附件、自己想像臉）
  REF_INTRO: (name, i) => `圖${i + 1}是${name}的參考照片（並排的是同一個人的不同角度，仍然是同一個人）。`,
  REF_RULE: '請畫一張新的照片，裡面就是這些人：每個人的臉型、眼睛、鼻子、下巴、髮色、髮型都要跟各自的參考照片一模一樣。參考照片優先於下面的文字。鏡頭照情境描述的方式拍（全身、半身、近景都可以）；只要看得到臉，就要認得出是誰。沒有特別指定畫風的話，照參考照片的畫風畫（動漫就畫動漫，照片就畫照片）。',
  ASK: '畫一張圖，圖上不要有任何文字、字幕或浮水印。',
  // 拍照的人：不入鏡，照片只是以防玻璃、櫥窗映出他時臉要對
  GHOST_INTRO: (name, i) => `圖${i + 1}是拍這張照片的${name}，${name}不在畫面裡，不要把${name}畫進去；只有玻璃或水面映出拍照的人時，那張臉才照這張畫。`,
  GHOST_ONLY: '請畫一張新的照片。',

  // 入鏡的人
  PEOPLE_TITLE: '入鏡的人：',
  PERSON_WITH_REF: (name) => `${name}：臉、髮色、髮型照${name}的參考照片（文字寫的不算）`,
  BODY: (body) => `身形：${body}`,
  WARDROBE: (list) => `衣櫃（只穿情境寫的；情境沒寫才從這裡挑一套搭得起來的，不要全部穿上身）：${list}`,
  SEP: '；',
  COLON: '：',

  // 拍照的人自己沒入鏡（例如他拍手上的東西）：只講是誰的手，不要把整個人畫進去
  POV: (name, hand) => `這是${name}用自己的手機拍的第一人稱照片。${name}不在畫面裡：看不到臉、也看不到身體。如果有手或手臂伸進畫面，那是${name}自己的${hand ? `（${hand}）` : ''}。`,
  HAND_MAN: '男生的手',
  HAND_WOMAN: '女生的手',

  // 玩家在證件照頁寫的照片風格
  STYLE: (style) => `畫風（以這裡為準，蓋過上面寫的「照片」「寫實」）：${style}`,

  // 有人入鏡就一定要的（精修、生活感、動漫都套用）
  NO_SELFIE: '除非情境寫到自拍或拍照，畫面裡的人不要拿著手機對著自己拍。',
  // 參考照片多半是正面看鏡頭的證件照，模型會連姿勢表情一起抄（10/15 趴著睡的她被畫成坐直看鏡頭微笑）
  POSE_FROM_SCENE: '參考照片只決定長相；姿勢、表情、眼睛睜開或閉上、視線方向都照情境寫的畫。情境沒寫看鏡頭，就不要看鏡頭。',
  ONLY_LISTED: '每個人在畫面裡只出現一次，不要有同一個人的分身；除了背景路人，不要多出上面沒列到的人。',
  ANATOMY: '人體結構要真實：手和手指數量正確、關節自然、重量和接觸合理；身體碰在一起的地方，衣服會有壓痕和皺褶。',
  CLOTHES: '衣服是一般日常穿搭，有自然皺褶和布料重量；除非情境有寫，不要穿成一樣的情侶裝。',
  TWO_PEOPLE: '每個人的臉各自獨立，不要變成同一張 AI 臉。互動自然、不要對鏡頭擺拍，眼神和笑容不用同步，像剛好被捕捉到的瞬間。',
  HAIR: '頭髮：自然的髮束、碎髮、浮髮，會被空氣和動作影響；不要排得整整齊齊，不要 CG 那種光滑髮絲。',

  // 照片質感「精修」（像 GPT）
  POLISHED: {
    match: '質感照參考照片：一樣光滑柔和、有修過的皮膚，一樣乾淨精緻的成品感。',
    // 情境寫「暖黃燈光」時，Gemini 會讓整張連皮膚都蒙一層黃（10/14 泡澡那張），所以這句要比情境更強
    colour: (anyRef) => `顏色（優先於上面情境寫的燈光顏色）：整張照片白平衡中性、略偏冷，乾淨通透，不要整張蒙上黃色或橘色。情境寫暖光、燭光時，暖色只出現在燈具、燭火和背景的光斑上；人的皮膚維持乾淨白皙、帶自然的粉色調${anyRef ? '，跟各自的參考照片一樣' : ''}，不要偏黃、偏橘或暗沉。`,
    people: '攝影：像電影劇照一樣有親密感，鏡頭照情境描述的方式拍。85mm 鏡頭、f/1.8，景深很淺，背景糊成柔和的光斑，只有人是清楚的。柔光，調色柔和、飽和度稍低。',
    things: '攝影：有電影感的手機照片，淺景深、柔和的光斑，柔光，調色柔和、飽和度稍低。',
  },

  // 照片質感「生活感」（手機隨手拍）
  CANDID: {
    colour: (anyRef) => `顏色：自然真實的色彩和白平衡，${anyRef ? '膚色照各自的參考照片' : '膚色自然'}，不要黃色濾鏡。只用現場真的存在的光（窗光、日光、路燈、餐廳燈）；不要電影感輪廓光、不要棚拍補光。`,
    skin: '質感：真實的皮膚，看得到毛孔、細小汗毛、些微泛紅、眼下淡淡的陰影；不要美顏、不要磨皮塑膠感、不要 CG 光澤。好看但不是模特兒般完美，保留自然的些微不對稱。',
    gaze: '除非情境說他們在看鏡頭，不然就是被捕捉到的瞬間、沒看鏡頭：在聊天、吃東西、走路、看對方或看別的地方。',
    camera: '相機：一般的手機隨手拍，會直接發到社群上的那種，用人像模式拍：人是清楚的，背景和前景自然虛化，有景深。普通手機畫質，有一點雜訊和壓縮感，不要過度銳利；構圖可以有點歪、不置中、裁得隨意。不是廣告、婚紗、偶像宣傳照或棚拍。',
  },

  // IG 照片接在描述後面的
  IG_POST: '，IG 貼文照片，自然光',
  IG_STORY: '，直的 IG 限時動態照片，自然光',

  // 相本快照：請寫劇情的模型把這一幕寫成生圖描述時，要它用哪種語言寫
  SNAP_PROMPT: '生圖用的中文描述，逗號分隔：鏡頭（全身、半身、近景）、誰在做什麼、動作、表情、穿著、場景、光線',
  SNAP_LANG: '- 欄位都用中文寫',
  SHOT_LANG: '中文',
  WEARING: (w) => `穿${w}`,
  COMMA: '，',
  PERIOD: '。',
};

const EN = {
  REF_INTRO: (name, i) => `Image ${i + 1} is a reference photo of ${name} (it may show the same person from several angles side by side; it is still one person).`,
  REF_RULE: "Create a new picture with exactly these people: keep each person's face, eyes, nose, jawline, hair colour and hairstyle identical to their reference image. The reference images win over any text below. Use the framing the scene describes (full body, half body or close-up); whenever a face is visible it must be recognisable as that person. Unless a visual style is given below, draw in the same art style as the references (anime stays anime, photo stays photo).",
  ASK: 'Generate one image. No text, captions or watermarks in the image.',
  GHOST_INTRO: (name, i) => `Image ${i + 1} is ${name}, who is taking this photo. ${name} is NOT in the picture; do not draw ${name}. Only if glass or water reflects the photographer, that face must match this image.`,
  GHOST_ONLY: 'Create a new picture.',

  PEOPLE_TITLE: 'People in the picture:',
  PERSON_WITH_REF: (name) => `${name}: face, hair colour and hairstyle exactly as in ${name}'s reference photo (ignore any text that says otherwise)`,
  BODY: (body) => `body: ${body}`,
  WARDROBE: (list) => `clothes they might own (wear only what the scene describes; if the scene says nothing, pick ONE coherent outfit from these, never mix them all): ${list}`,
  SEP: '; ',
  COLON: ': ',

  POV: (name, hand) => `First-person shot taken by ${name} on their own phone. ${name} is NOT in the photo: no face, no body. If a hand or arm reaches into the frame, it is ${name}'s own${hand ? ` (${hand})` : ''}.`,
  HAND_MAN: "a man's hand",
  HAND_WOMAN: "a woman's hand",

  STYLE: (style) => `Visual style (this overrides any "photo" or "realistic" wording above): ${style}`,

  NO_SELFIE: 'Unless the scene says someone is taking a selfie or a photo, nobody in the picture is holding up a phone to photograph themselves.',
  POSE_FROM_SCENE: 'The reference photos only decide what people look like; pose, expression, whether the eyes are open or closed, and gaze direction follow the scene. Unless the scene says so, nobody looks at the camera.',
  ONLY_LISTED: 'Each person appears only once in the picture, never a duplicate or clone of the same person; apart from background passers-by, no one who is not listed above.',
  ANATOMY: 'Anatomy must be real: correct hands and finger count, natural joints, believable weight and contact; clothes wrinkle and compress where bodies touch or overlap.',
  CLOTHES: 'Clothes are ordinary everyday outfits with natural folds and fabric weight; people do not wear matching outfits unless the scene says so.',
  TWO_PEOPLE: 'Each person keeps their own distinct face; never two people with the same AI face. Natural interaction, not posing for the camera: glances and smiles do not have to be in sync, like a moment caught in passing.',
  HAIR: 'Hair: natural strands, wisps, flyaways and baby hairs moved by the air and by movement; never perfectly arranged, never CG-smooth.',

  POLISHED: {
    match: 'Match the rendering of the reference photos: the same smooth, soft, retouched skin texture and the same polished, clean finish.',
    colour: (anyRef) => `Colour (this overrides any light colour named in the scene above): neutral, slightly cool, clean white balance across the whole picture; never an overall yellow or orange cast. If the scene mentions warm light or candlelight, the warmth appears only in the lamps, flames and background bokeh; skin stays clean and fair with a natural pink undertone${anyRef ? ", exactly like each person's reference photo" : ''}, never yellow, orange or sallow.`,
    people: 'Photography: an intimate cinematic film still, framed the way the scene describes. Shot on an 85mm lens at f/1.8, very shallow depth of field, background melts into creamy bokeh, only the people are sharp. Soft light, gentle muted colour grading, slightly lower saturation.',
    things: 'Photography: cinematic phone photo, shallow depth of field with soft bokeh, soft light, gentle muted colour grading, slightly lower saturation.',
  },

  CANDID: {
    colour: (anyRef) => `Colour: natural, true-to-life colour and white balance. ${anyRef ? "Skin tone like each person's reference photo, " : 'Skin tone natural, '}never yellow-filtered. Only the light that really exists in the place (window light, daylight, street lights, restaurant light); no cinematic rim light, no studio fill.`,
    skin: 'Texture: real skin with visible pores, fine vellus hair, slight redness and subtle under-eye shadows; no beauty filter, no airbrushed or plastic skin, no CG sheen. Attractive but not model-perfect, keep natural slight asymmetry.',
    gaze: 'Unless the scene says they look at the camera, the people are caught in the moment and not looking at the lens: talking, eating, walking, looking at each other or at something else.',
    camera: 'Camera: an everyday smartphone snapshot, the kind posted straight to social media, shot in portrait mode: the people are sharp while the background and foreground fall into natural depth-of-field blur. Ordinary phone image quality with slight noise and compression, not over-sharp; composition can be slightly tilted, off-centre or loosely cropped. Not an advert, wedding shoot, idol photo or studio shoot.',
  },

  IG_POST: ', instagram photo, natural light',
  IG_STORY: ', vertical instagram story photo, natural light',

  SNAP_PROMPT: '英文生圖 prompt，逗號分隔：鏡頭（full body、half body、close-up）、誰在做什麼、動作、表情、穿著、場景、光線',
  SNAP_LANG: '- 欄位除了 desc 以外都用英文寫（desc 用中文）',
  SHOT_LANG: '英文',
  WEARING: (w) => `wearing ${w}`,
  COMMA: ', ',
  PERIOD: '. ',
};

// 玩家選的語言，每台裝置各自記，預設中文
const LANG = 'brume-phone:imglang';
export const promptLang = {
  get() { try { return localStorage.getItem(LANG) === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } },
  set(v) { try { localStorage.setItem(LANG, v === 'en' ? 'en' : 'zh'); } catch { /* 存不了就照預設 */ } },
};

// 用法：P.ASK、P.POLISHED.colour(...)；每次讀都照當下選的語言
export const P = new Proxy({}, { get: (_, k) => (promptLang.get() === 'en' ? EN : ZH)[k] });
