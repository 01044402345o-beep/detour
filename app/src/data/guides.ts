/**
 * 음성 가이드 원고 (T6.14, 사용자 요청 2026-11-26: "여행가이드가 코스에 대한 부가 설명을 하는 형태",
 * "각 장소를 클릭하면 그 가게의 대표메뉴·주문방법 등 설명", 영어·일본어·중국어).
 *
 * 형식: 언어 → 문단 → 문장. 문장 단위로 끊어 읽습니다(긴 발화가 끊기는 브라우저 문제 예방, 지금 읽는 문장 강조).
 * 작성 원칙
 * - 근거: 앱 데이터(downtown.json·market.json의 메뉴·이용 순서·영업시간·도보 시간·설명)와 널리 알려진 사실만
 *   (성심당 1956년 개업, 옛 충남도청 1930년대 건물, 대전역이 철도와 함께 성장 등). 확인 안 된 사실을 단정하지 않음.
 * - 현장 확인 전 정보(가격·메뉴·영업시간)는 끝에 '예시 정보'임을 말로도 밝힘(DESIGN.md 6장 정책과 같은 뜻).
 * - 한글을 넣지 않음: 영어·일본어·중국어 음성은 한글을 읽지 못하므로 로마자·가나·한자 표기만 씀(테스트로 검사).
 * - 가격 숫자는 말하지 않음(예시 가격이 바뀌어도 원고를 고치지 않게). 행사 날짜도 말하지 않고 화면의 시즌 카드로 안내.
 */
import type { Lang } from '../types';

/** 문단(문장 배열)들의 배열 */
export type GuideParagraphs = readonly (readonly string[])[];
export type GuideText = Readonly<Record<Lang, GuideParagraphs>>;

export const COURSE_GUIDES: Readonly<Record<string, GuideText>> = {
  'downtown-halfday': {
    en: [
      [
        'Welcome to the Old Downtown Half-day course.',
        'This is the heart of old Daejeon, the part of the city that grew up around the railway in the early 1900s.',
        'The walk is about 2.2 kilometers, and with time to eat and look around, it takes about three hours.',
      ],
      [
        'We start at Daejeon Station.',
        'Walk out toward the old downtown side, or if you would like to save your legs, ride Metro Line 1 for one stop to Jungang-ro.',
      ],
      [
        'Stop 1 is Sungsimdang, the bakery Daejeon is famous for.',
        'Its signature is the fried soboro, a crunchy bun with sweet red bean inside.',
        'Stop 2, just two minutes away, is Euneungjeongi Culture Street.',
        'Look up at Sky Road, a long LED screen that covers the street, and check on site for evening show times.',
        'Stop 3 is the Daejeon Modern History Exhibition Hall, inside the former South Chungcheong Provincial Office, a brick building from the 1930s.',
        'Stop 4 is Gwangcheon Sikdang, known for duruchigi, tofu cooked in a spicy red sauce.',
        'The local way to finish is to mix noodles into the leftover sauce.',
      ],
      [
        'On each stop, tap the guide button to hear more, and use the Korean phrases to talk with the staff.',
        'Hours, menus and prices in this app are sample information not yet checked on site, so please check the signs at each place.',
        'Enjoy your walk!',
      ],
    ],
    ja: [
      [
        '旧市街 半日コースへようこそ。',
        'ここは昔の大田の中心で、1900年代の初めに鉄道とともに発展した地域です。',
        '歩く距離は約2.2キロ、食事や見学の時間を入れて、約3時間のコースです。',
      ],
      [
        '出発は大田駅です。',
        '旧市街側に出て歩くか、足を休めたいときは地下鉄1号線で1駅、中央路駅まで乗ってください。',
      ],
      [
        '1か所目は、大田で一番有名なパン屋、聖心堂です。',
        '名物は、あんこ入りのサクサクした揚げソボロパンです。',
        '2か所目は、歩いて2分のウヌンジョンイ文化の街です。',
        '通りを覆う長いLEDの屋根、スカイロードを見上げてみてください。夜のショーの時間は現地で確認してください。',
        '3か所目は大田近現代史展示館です。1930年代に建てられた、れんが造りの旧忠清南道庁舎の中にあります。',
        '4か所目はクァンチョン食堂です。ピリ辛の赤いソースで豆腐を煮る、トゥルチギで知られる店です。',
        '最後に残ったソースに麺を入れて食べるのが、地元流の締めくくりです。',
      ],
      [
        'それぞれの場所では、ガイドボタンで説明を聞き、韓国語のフレーズでお店の人と話してみてください。',
        'このアプリの営業時間・メニュー・価格は参考例で、現地ではまだ確認できていません。各店の看板でご確認ください。',
        'では、楽しい散策を！',
      ],
    ],
    zh: [
      [
        '欢迎参加老城区半日游。',
        '这里是大田的老中心，20世纪初随着铁路的开通发展起来。',
        '全程步行约2.2公里，加上用餐和参观的时间，大约需要3小时。',
      ],
      [
        '我们从大田站出发。',
        '可以朝老城区方向步行，想省点力气的话，也可以乘地铁1号线坐一站，到中央路站。',
      ],
      [
        '第1站是大田最有名的面包店，圣心堂。',
        '招牌是炸酥粒面包，外皮酥脆，里面是甜甜的红豆馅。',
        '第2站离这里只要步行2分钟，是银杏亭文化街。',
        '抬头看看覆盖整条街的长长的LED屏幕“天空之路”，晚上灯光秀的时间请在现场确认。',
        '第3站是大田近现代史展览馆，位于建于20世纪30年代的砖砌建筑，旧忠清南道厅里面。',
        '第4站是广川食堂，以用辣红酱炒豆腐的“辣炒”料理闻名。',
        '当地人的吃法是最后把面条拌进剩下的酱汁里。',
      ],
      [
        '在每一站，都可以点导览按钮听介绍，也可以用韩语短句和店员交流。',
        '本App中的营业时间、菜单和价格是尚未实地确认的示例信息，请以各店的招牌为准。',
        '祝您散步愉快！',
      ],
    ],
  },
  'jungang-market': {
    en: [
      [
        'Welcome to the Jungang Market Food Walk.',
        'Daejeon Jungang Market, right next to Daejeon Station, is one of the biggest traditional markets in the city.',
        'The route is short, only about 0.7 kilometers, but give yourself around two hours to snack and browse.',
      ],
      [
        'Stop 1 is Suyeon Bunsik, a snack stall known for gochu twigim, crispy fried chili peppers with a savory filling.',
        'They also make tteokbokki, chewy rice cakes in a sweet and spicy sauce. Just point at what you want.',
        'Stop 2 is Gaecheon Sikdang, for handmade dumplings, in a warm dumpling soup or steamed.',
        'Stop 3 is Saengiljip, the place for sundae gukbap, a hearty pork soup with Korean sausage and rice.',
        'Stop 4 is Honggane Pulppang, where small cakes with sweet red bean are baked fresh and sold by the bag.',
      ],
      [
        'During the night market season, you will see a card for it on this screen.',
        'On each stop, tap the guide button to hear how to order.',
        'Menus and prices in this app are sample information not yet checked on site, so please check the signs at each stall.',
        'Enjoy the market!',
      ],
    ],
    ja: [
      [
        '中央市場 食べ歩きコースへようこそ。',
        '大田駅のすぐそばにある大田中央市場は、大田でも指折りの大きな伝統市場です。',
        '距離は約0.7キロと短いですが、食べ歩きと見物で2時間ほど見ておいてください。',
      ],
      [
        '1か所目のスヨン粉食は、具を詰めてカリッと揚げた唐辛子の天ぷらが名物の屋台です。',
        '甘辛いソースのもちもちしたトッポッキもあります。欲しいものを指さすだけで大丈夫です。',
        '2か所目のケチョン食堂では、手作りの餃子を、温かいマンドゥスープか蒸し餃子で味わえます。',
        '3か所目のセンイルチプは、豚骨スープにスンデとご飯が入った、スンデクッパの店です。',
        '4か所目のホンガネ プルッパンでは、甘いあん入りの小さな焼き菓子を焼きたてで、袋単位で売っています。',
      ],
      [
        '夜市の季節には、この画面にお知らせのカードが表示されます。',
        'それぞれの場所では、ガイドボタンで注文のしかたを聞いてみてください。',
        'このアプリのメニューと価格は参考例で、現地ではまだ確認できていません。各店の看板でご確認ください。',
        'では、市場を楽しんでください！',
      ],
    ],
    zh: [
      [
        '欢迎参加中央市场美食漫步。',
        '大田中央市场就在大田站旁边，是大田规模最大的传统市场之一。',
        '路线很短，只有约0.7公里，但边吃边逛的话，请预留2小时左右。',
      ],
      [
        '第1站是Suyeon小吃店，招牌是填了馅料的酥脆炸辣椒。',
        '这里也有甜辣酱炒年糕，口感软糯。想要什么，用手指一下就可以。',
        '第2站是Gaecheon食堂，可以吃到手工饺子，有热乎乎的饺子汤，也有蒸饺。',
        '第3站是生日家，招牌是米肠汤饭，猪骨汤里有韩式米肠和米饭，非常实在。',
        '第4站是洪家小烤饼，现烤的红豆小烤饼，按袋出售。',
      ],
      [
        '夜市季节期间，这个画面上会出现夜市的介绍卡片。',
        '在每一站，都可以点导览按钮，听听怎么点餐。',
        '本App中的菜单和价格是尚未实地确认的示例信息，请以各店的招牌为准。',
        '祝您逛得开心！',
      ],
    ],
  },
};

/** 음식점 공통 끝맺음 (예시 정보 안내) */
const FOOD_NOTE = {
  en: 'Menus and prices in this app are sample information not yet checked on site, so please check the menu board.',
  ja: 'このアプリのメニューと価格は参考例で、現地ではまだ確認できていません。店内のメニュー表でご確認ください。',
  zh: '本App中的菜单和价格是尚未实地确认的示例信息，请以店内的菜单为准。',
} as const;

const PHRASE_TIP = {
  en: 'If you need help, open the Phrases tab and play a Korean phrase for the staff.',
  ja: '困ったときは「フレーズ」タブを開いて、韓国語のフレーズをお店の人に聞かせてください。',
  zh: '需要帮助时，打开“短句”标签，把韩语短句播放给店员听。',
} as const;

export const PLACE_GUIDES: Readonly<Record<string, GuideText>> = {
  ssd: {
    en: [
      [
        'Sungsimdang is the bakery Daejeon is best known for, and it has been baking in the city since 1956.',
        'Its signature is the fried soboro, a crispy fried bun with a crumbly topping and sweet red bean inside.',
        'You will also find the Pantarong bread packed with chives, and a baguette with pollock roe butter.',
      ],
      [
        'Here is how to order.',
        'Grab a tray and tongs at the entrance, pick your bread, then line up and pay at the counter.',
        'You can take everything with you.',
      ],
      [PHRASE_TIP.en, FOOD_NOTE.en],
    ],
    ja: [
      [
        '聖心堂は大田で一番有名なパン屋で、1956年から大田でパンを焼き続けています。',
        '名物は揚げソボロパン。そぼろ状の生地をまとったサクサクの揚げパンで、中には甘いあんこが入っています。',
        'ほかにも、ニラがたっぷり入ったパンタロン ニラパンや、明太子バターのバゲットが人気です。',
      ],
      [
        '注文のしかたです。',
        '入口でトレーとトングを取り、パンを選んだら、レジに並んで支払います。',
        '持ち帰りもできます。',
      ],
      [PHRASE_TIP.ja, FOOD_NOTE.ja],
    ],
    zh: [
      [
        '圣心堂是大田最有名的面包店，从1956年起就在大田烤面包。',
        '招牌是炸酥粒面包，表面是酥粒，外皮炸得酥脆，里面是甜甜的红豆馅。',
        '另外，满满韭菜馅的韭菜面包和明太子黄油法棍也很受欢迎。',
      ],
      ['点餐方法如下。', '在入口拿托盘和夹子，挑好面包后，排队到柜台付款。', '可以打包带走。'],
      [PHRASE_TIP.zh, FOOD_NOTE.zh],
    ],
  },
  eun: {
    en: [
      [
        'Euneungjeongi Culture Street is the busy shopping street of old downtown Daejeon.',
        'The highlight is Sky Road, a long LED screen that forms a roof over the street.',
        'In the evening there are light shows, so check the times on site.',
      ],
      [
        'There is nothing to order here. Just walk under Sky Road, take photos, and drop into the shops and cafés nearby.',
        'Sungsimdang is only a two-minute walk away.',
        'Show times and other information in this app are sample information not yet checked on site, so please check on site.',
      ],
    ],
    ja: [
      [
        'ウヌンジョンイ文化の街は、大田の旧市街でにぎわうショッピングストリートです。',
        '見どころは、通りの屋根になっている長いLEDスクリーン、スカイロードです。',
        '夜にはライトショーがあるので、時間は現地で確認してください。',
      ],
      [
        'ここでは注文するものはありません。スカイロードの下を歩いて写真を撮り、周りのショップやカフェに立ち寄ってみてください。',
        '聖心堂からは歩いて2分です。',
        'ショーの時間などこのアプリの情報は参考例で、現地ではまだ確認できていません。現地でご確認ください。',
      ],
    ],
    zh: [
      [
        '银杏亭文化街是大田老城区热闹的购物街。',
        '最大的看点是“天空之路”，一块长长的LED屏幕，像屋顶一样覆盖着街道。',
        '晚上有灯光秀，具体时间请在现场确认。',
      ],
      [
        '这里不需要点餐。在天空之路下面走走、拍拍照，再去附近的商店和咖啡馆逛逛吧。',
        '离圣心堂只要步行2分钟。',
        '灯光秀时间等本App中的信息是尚未实地确认的示例信息，请在现场确认。',
      ],
    ],
  },
  mus: {
    en: [
      [
        'The Daejeon Modern History Exhibition Hall is inside the former South Chungcheong Provincial Office, a brick building from the 1930s.',
        'Enter through the main gate and look around the exhibits on the building and the history of the city.',
        'Do not miss the central staircase. It is a popular photo spot.',
      ],
      [
        'It is open from 10 in the morning to 6 in the evening, and closed on Mondays.',
        'These hours are sample information not yet checked on site, so please check before you go.',
      ],
    ],
    ja: [
      [
        '大田近現代史展示館は、1930年代に建てられたれんが造りの旧忠清南道庁舎の中にあります。',
        '正門から入って、建物と大田の街の歴史の展示を見て回ってください。',
        '中央の階段もお見逃しなく。人気の写真スポットです。',
      ],
      [
        '開館は午前10時から午後6時まで、月曜日は休館です。',
        'この時間は参考例で、現地ではまだ確認できていないので、行く前にご確認ください。',
      ],
    ],
    zh: [
      [
        '大田近现代史展览馆位于旧忠清南道厅里面，这是一座建于20世纪30年代的砖砌建筑。',
        '从正门进入，参观关于这座建筑和大田城市历史的展览。',
        '别错过中央楼梯，这里是很受欢迎的拍照点。',
      ],
      [
        '开放时间是上午10点到下午6点，周一闭馆。',
        '这些时间是尚未实地确认的示例信息，出发前请再确认一下。',
      ],
    ],
  },
  gwc: {
    en: [
      [
        'Gwangcheon Sikdang is known for duruchigi, a Daejeon style dish cooked in a spicy red sauce.',
        'The signature is spicy braised tofu, ordered per person. There is also a squid version.',
      ],
      [
        'Here is how to order.',
        'Take a seat and order from the staff.',
        'Near the end, add a portion of noodles and mix them into the leftover sauce. That is the local way to finish.',
        'You can add a bowl of rice too, and you pay at the counter on your way out.',
        'It is quite spicy, so take it slowly.',
      ],
      [PHRASE_TIP.en, FOOD_NOTE.en],
    ],
    ja: [
      [
        'クァンチョン食堂は、ピリ辛の赤いソースで煮る大田流の料理、トゥルチギで知られる店です。',
        '名物は豆腐トゥルチギで、1人前ずつ注文します。イカのトゥルチギもあります。',
      ],
      [
        '注文のしかたです。',
        '席に座って、お店の人に注文します。',
        '最後に麺を追加して、残ったソースに絡めて食べるのが地元流の締めくくりです。',
        'ご飯も追加でき、支払いは帰りにレジでします。',
        'かなり辛いので、ゆっくり味わってください。',
      ],
      [PHRASE_TIP.ja, FOOD_NOTE.ja],
    ],
    zh: [
      [
        '广川食堂以“辣炒”料理闻名，这是用辣红酱烹制的大田风味菜。',
        '招牌是辣炒豆腐，按人份点。也有辣炒鱿鱼。',
      ],
      [
        '点餐方法如下。',
        '入座后向店员点餐。',
        '快吃完时，加一份面条，拌进剩下的酱汁里，这是当地人的吃法。',
        '也可以加一碗米饭，离开时在柜台付款。',
        '味道相当辣，请慢慢享用。',
      ],
      [PHRASE_TIP.zh, FOOD_NOTE.zh],
    ],
  },
  sy: {
    en: [
      [
        'Suyeon Bunsik is a snack stall in Jungang Market.',
        'Its signature is gochu twigim, a crispy fried chili pepper with a savory filling, a market favorite.',
        'You can also try tteokbokki, chewy rice cakes in a sweet and spicy sauce.',
      ],
      [
        'Here is how to order.',
        'Point at the fried snacks you want, say how many, and pay.',
        'Eat right at the stall, or take them with you.',
      ],
      [PHRASE_TIP.en, FOOD_NOTE.en],
    ],
    ja: [
      [
        'スヨン粉食は、中央市場の中にある軽食の屋台です。',
        '名物は、具を詰めてカリッと揚げた唐辛子の天ぷらで、市場の人気メニューです。',
        '甘辛いソースのもちもちしたトッポッキもおすすめです。',
      ],
      [
        '注文のしかたです。',
        '欲しい揚げ物を指さして、数を伝えて支払います。',
        '店先で食べても、持ち帰ってもかまいません。',
      ],
      [PHRASE_TIP.ja, FOOD_NOTE.ja],
    ],
    zh: [
      [
        'Suyeon小吃店是中央市场里的一个小吃摊。',
        '招牌是填了馅料的酥脆炸辣椒，是市场人气小吃。',
        '也推荐甜辣酱炒年糕，口感软糯。',
      ],
      ['点餐方法如下。', '指出想要的炸物，说出数量，然后付款。', '可以在摊位旁吃，也可以打包带走。'],
      [PHRASE_TIP.zh, FOOD_NOTE.zh],
    ],
  },
  gc: {
    en: [
      [
        'Gaecheon Sikdang is known for northern style handmade dumplings.',
        'Try the dumpling soup, with dumplings in a warm broth, or a plate of plump steamed dumplings.',
      ],
      [
        'Here is how to order.',
        'Take a seat and order from the staff.',
        'The dumplings may contain pork, so if you avoid it, ask before you order.',
        'You pay at the counter on your way out, and you can also take food with you.',
      ],
      [PHRASE_TIP.en, FOOD_NOTE.en],
    ],
    ja: [
      [
        'ケチョン食堂は、北部式の手作り餃子で知られる店です。',
        '温かいスープに餃子が入ったマンドゥスープや、ふっくらした蒸し餃子を味わってみてください。',
      ],
      [
        '注文のしかたです。',
        '席に座って、お店の人に注文します。',
        '餃子には豚肉が入っていることがあるので、苦手な方は注文の前に確認してください。',
        '支払いは帰りにレジでします。持ち帰りもできます。',
      ],
      [PHRASE_TIP.ja, FOOD_NOTE.ja],
    ],
    zh: [
      [
        'Gaecheon食堂以北方风味的手工饺子闻名。',
        '可以尝尝热汤里煮着饺子的饺子汤，或者一盘饱满的蒸饺。',
      ],
      [
        '点餐方法如下。',
        '入座后向店员点餐。',
        '饺子里可能有猪肉，如果不吃猪肉，请在点餐前先问一下。',
        '离开时在柜台付款，也可以打包带走。',
      ],
      [PHRASE_TIP.zh, FOOD_NOTE.zh],
    ],
  },
  sj: {
    en: [
      [
        'Saengiljip serves sundae gukbap, a hearty pork broth with Korean blood sausage, served with rice.',
        'There is also a plate of sliced sausage filled with meat. Both dishes contain pork.',
      ],
      [
        'Here is how to order.',
        'Take a seat and order from the staff.',
        'When your soup arrives, season it yourself with perilla seed powder and salt.',
        'You pay at the counter on your way out.',
      ],
      [PHRASE_TIP.en, FOOD_NOTE.en],
    ],
    ja: [
      [
        'センイルチプは、豚骨スープにスンデとご飯が入ったスンデクッパの店です。',
        'お肉の入ったスンデの盛り合わせもあります。どちらも豚肉を使っています。',
      ],
      [
        '注文のしかたです。',
        '席に座って、お店の人に注文します。',
        'スープが来たら、エゴマの粉と塩で自分好みに味を調えてください。',
        '支払いは帰りにレジでします。',
      ],
      [PHRASE_TIP.ja, FOOD_NOTE.ja],
    ],
    zh: [
      [
        '生日家的招牌是米肠汤饭，猪骨汤里有韩式米肠，配米饭，非常实在。',
        '也有切片的肉馅米肠。这两道菜都含有猪肉。',
      ],
      [
        '点餐方法如下。',
        '入座后向店员点餐。',
        '汤上桌后，用紫苏粉和盐按自己的口味调味。',
        '离开时在柜台付款。',
      ],
      [PHRASE_TIP.zh, FOOD_NOTE.zh],
    ],
  },
  hg: {
    en: [
      [
        'Honggane Pulppang bakes pulppang, small cakes filled with sweet red bean.',
        'They are usually sold by the bag.',
      ],
      [
        'Here is how to order.',
        'Check the price per bag on the sign, say how many you want, and pay.',
        'They taste best warm, so enjoy them as you walk.',
      ],
      [PHRASE_TIP.en, FOOD_NOTE.en],
    ],
    ja: [
      [
        'ホンガネ プルッパンは、甘いあんの入った小さな焼き菓子、プルッパンのお店です。',
        'たいてい袋単位で売っています。',
      ],
      [
        '注文のしかたです。',
        '看板で1袋の値段を確かめて、欲しい数を伝えて支払います。',
        '温かいうちが一番おいしいので、食べ歩きで楽しんでください。',
      ],
      [PHRASE_TIP.ja, FOOD_NOTE.ja],
    ],
    zh: [
      ['洪家小烤饼卖的是红豆小烤饼，一种包着甜红豆馅的小烤饼。', '通常按袋出售。'],
      [
        '点餐方法如下。',
        '先看招牌上每袋的价格，说出想要几个，然后付款。',
        '趁热吃最好吃，边走边吃吧。',
      ],
      [PHRASE_TIP.zh, FOOD_NOTE.zh],
    ],
  },
};
