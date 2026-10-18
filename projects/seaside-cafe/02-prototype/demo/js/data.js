/* 《汐湾咖啡馆》演示用文案与流程。有原文的句子来自 01-planning，其余按人设占位。 */
const CafeData = {
  characters: [
    {
      id: "lu-yu",
      romance: "female",
      name: "陆屿",
      role: "隔壁渔家青年，儿时玩伴",
      bio: "嘴上嫌你麻烦，手上已经把你搬不动的箱子扛上了二楼。",
      day: "第 2 天",
      bond: {
        male: ["会互相损两句的邻居", "箱子他扛，水管他修", "收网后会在门口坐一会儿"],
        female: ["刚重逢，话还生分", "嘴上嫌弃，人已经留下了", "临走前也没说再见"],
      },
    },
    {
      id: "xia-zhi",
      romance: "male",
      name: "夏栀",
      role: "灯塔守塔人的孙女，镇小学老师",
      bio: "像傍晚灯塔亮起的第一束光：不刺眼，但一直在那儿。",
      day: "第 3 天",
      bond: {
        male: ["她叫你店长，话不多", "旧咖啡壶送到了", "会留下来帮你擦窗"],
        female: ["温柔的老朋友", "旧咖啡壶送到了", "会留下来帮你擦窗"],
      },
    },
    {
      id: "shen-ruo",
      romance: "male",
      name: "沈若",
      role: "城里的前同事",
      bio: "穿着高跟鞋踩进沙滩的女人。说是来休假，手机却一刻都没放下。",
      day: "第 3 天消息 · 第 18 天到场",
      messageOnly: true,
      bond: {
        male: ["只在消息里见过", "她问起你有没有吃饭", "电话那头，两个人都累"],
        female: ["只在消息里见过", "前同事，叮嘱你别空着肚子", "电话那头，两个人都累"],
      },
    },
    {
      id: "tang-tang",
      romance: "male",
      name: "唐棠",
      role: "码头海鲜排档的女儿",
      bio: "码头上嗓门最大的姑娘，刀工比她爸还好。",
      day: "第 5 天",
      bond: { male: ["撞见你中暑的那天"], female: ["码头上的好姐妹"] },
    },
    {
      id: "xu-zhiyan",
      romance: "female",
      name: "许之言",
      role: "镇卫生所唯一的医生",
      bio: "话很少。你中暑那天的字条，他写了整整三行。",
      day: "第 9 天",
      bond: { male: ["镇里的医生"], female: ["话很少的医生"] },
    },
    {
      id: "ye-fan",
      romance: "male",
      name: "叶帆",
      role: "骑单车送信的邮递员",
      bio: "单车铃一响，整条老街都知道她来了。",
      day: "第 11 天",
      bond: { male: ["带着一肚子问题的邮差"], female: ["活泼的邮差朋友"] },
    },
    {
      id: "cheng-lu",
      romance: "male",
      name: "程鹭",
      role: "海洋研究站的潜水研究员",
      bio: "冷淡、专注，不想离开这片海。",
      day: "第 16 天",
      bond: { male: ["研究站的人"], female: ["研究站的人"] },
    },
    {
      id: "song-zhiyuan",
      romance: "female",
      name: "宋知远",
      role: "冲浪民宿老板，冲浪教练",
      bio: "阳光，爱开玩笑。受伤退役后，再没站上过比赛的浪。",
      day: "第 17 天",
      bond: { male: ["教人冲浪的朋友"], female: ["礁石滩上把人带回岸边"] },
    },
    {
      id: "jiang-xubai",
      romance: "female",
      name: "江叙白",
      role: "夏天来写生的画家",
      bio: "温和健谈。一年来，再也画不出满意的作品。",
      day: "第 21 天",
      bond: { male: ["借窗口看海的画家"], female: ["借窗口看海的画家"] },
    },
    {
      id: "su-nian",
      romance: "male",
      name: "苏念",
      role: "来小镇采风的独立音乐人",
      bio: "安静、骄傲。每晚在礁石滩弹琴。",
      day: "第 23 天",
      bond: { male: ["礁石滩上的琴声"], female: ["礁石滩上的琴声"] },
    },
  ],

  scenes: {
    main: [
      { id: "p1", type: "line", bg: "city", speaker: "旁白", text: "城里，写字楼。深夜的显示器还亮着。" },
      { id: "p2", type: "line", bg: "city", speaker: "电话", text: "……外婆走了。葬礼在后天。" },
      { id: "p3", type: "line", bg: "train", speaker: "旁白", text: "你递了辞职信。第二天，坐上回汐湾的车。" },
      {
        id: "p4",
        type: "line",
        bg: "station",
        speaker: "秀姨",
        figure: "xiu-yi",
        text: "{name}，到啦。钥匙给你。外婆的「潮汐」，从今天起归你了。",
      },
      {
        id: "p5",
        type: "line",
        bg: "cafe",
        speaker: "外婆的信",
        text: "店交给你了，想开就开，不想开也没关系。",
      },
      {
        id: "p6",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        prop: "cat",
        text: "推开落满灰的咖啡馆。柜台后面钻出一只橘猫，项圈上写着「拿铁」。",
      },
      {
        id: "p7",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        day: 2,
        text: "第 2 天。你还在打扫。门口的光被一个扛着工具箱的人挡住了。",
      },
      {
        id: "p8",
        type: "line",
        bg: "cafe",
        speaker: "陆屿",
        figure: "lu-yu",
        meet: "lu-yu",
        text: "啧，你别动，我来。……城里待久了，连箱子都搬不动了？",
      },
      {
        id: "p9",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        figure: "lu-yu",
        text: {
          male: "他朝你扬了扬下巴。你们谁也不肯先认输，像回到了小时候。",
          female: "他停了一下，才把帽子往后一推。晒黑的脸上，是你认得的那个人。",
        },
      },
      {
        id: "p10",
        type: "line",
        bg: "cafe",
        speaker: "陆屿",
        figure: "lu-yu",
        text: "水管漏了。我修。你别在旁边添乱。",
      },
      {
        id: "c-day2",
        type: "choice",
        bg: "cafe",
        speaker: "陆屿",
        figure: "lu-yu",
        quote: "水管漏了。我修。你别在旁边添乱。",
        prompt: "你怎么接这句话？",
        options: [
          { text: "「还是你利落。箱子就拜托你了。」", bond: "lu-yu", next: "r-a" },
          { text: "「我自己可以。你忙你的。」", next: "r-b" },
          { text: "「谢谢。家里还好吗？」", bond: "lu-yu", next: "r-c" },
        ],
      },
      {
        id: "r-a",
        type: "line",
        bg: "cafe",
        speaker: "陆屿",
        figure: "lu-yu",
        text: "啧。知道就行。去把桶拿来。",
        next: "bridge",
      },
      {
        id: "r-b",
        type: "line",
        bg: "cafe",
        speaker: "陆屿",
        figure: "lu-yu",
        text: "随你。扳手我放下了。……漏水的地方在水槽下面。",
        next: "bridge",
      },
      {
        id: "r-c",
        type: "line",
        bg: "cafe",
        speaker: "陆屿",
        figure: "lu-yu",
        text: "还行。别问了。……你瘦了。",
        next: "bridge",
      },
      {
        id: "bridge",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        figure: "lu-yu",
        text: "他在店里忙到天黑，临走也没说再见。",
      },
      { id: "to-map", type: "goto", screen: "map", day: 3, phase: "day" },
    ],

    day3: [
      {
        id: "d1",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        text: "门铃响了。门口站着一个穿浅色衬衫的人，怀里抱着一把旧咖啡壶。",
      },
      {
        id: "d2",
        type: "line",
        bg: "cafe",
        speaker: "夏栀",
        figure: "xia-zhi",
        meet: "xia-zhi",
        text: "嗯……没关系的，咖啡苦一点也很好喝。你回来了，这家店就还在。",
      },
      {
        id: "d3",
        type: "line",
        bg: "cafe",
        speaker: "夏栀",
        figure: "xia-zhi",
        text: "这把壶是爷爷让我送回来的。外婆借给灯塔很多年了。",
      },
      {
        id: "d4",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        text: "壶底刻着「潮汐」。配方本摊在柜台上。回来后的第一杯，从手冲开始。",
      },
      { id: "to-mini", type: "goto", screen: "minigame" },
    ],

    "day3-evening": [
      {
        id: "w1",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        figure: "xia-zhi",
        day: 3,
        text: "第 3 天傍晚。杯子收进水槽，店里的灯还亮着。",
      },
      {
        id: "w2",
        type: "line",
        bg: "cafe",
        speaker: "夏栀",
        figure: "xia-zhi",
        text: "我再擦一会儿窗。你去忙别的也行。",
      },
      {
        id: "w3",
        type: "line",
        bg: "cafe",
        speaker: "旁白",
        figure: "xia-zhi",
        text: "她留下来，把朝海的那面窗擦到能看见灯塔。柜台后面，手机亮了。",
      },
      { id: "to-phone", type: "goto", screen: "phone", phoneReady: true },
    ],

    "evening-dock": [
      {
        id: "e1",
        type: "line",
        bg: "dock",
        speaker: "陆屿",
        figure: "lu-yu",
        text: "网破了。看什么，渔人结不是看着就会的。",
      },
      {
        id: "e2",
        type: "line",
        bg: "dock",
        speaker: "旁白",
        figure: "lu-yu",
        text: "他嘴上不耐烦，还是把绳子的一头递到你手里。",
      },
      { id: "back", type: "goto", screen: "map", outing: "dock" },
    ],

    "evening-lighthouse": [
      {
        id: "e1",
        type: "line",
        bg: "lighthouse",
        speaker: "夏栀",
        figure: "xia-zhi",
        text: "爷爷今天精神还好。报纸读到灯塔那一版，他就睡着了。",
      },
      {
        id: "e2",
        type: "line",
        bg: "lighthouse",
        speaker: "旁白",
        figure: "xia-zhi",
        text: "她往旁边让了让。灯还没亮，海风先到了。",
      },
      { id: "back", type: "goto", screen: "map", outing: "lighthouse" },
    ],

    "evening-rocks": [
      {
        id: "e1",
        type: "line",
        bg: "rocks",
        speaker: "旁白",
        text: "潮水退了一半。礁石滩上没有人在等你，只有风，和很远的船。",
      },
      { id: "back", type: "goto", screen: "map", outing: "rocks" },
    ],

    "evening-street": [
      {
        id: "e1",
        type: "line",
        bg: "street",
        speaker: "秀姨",
        figure: "xiu-yi",
        text: "营业还顺利吧？别饿着肚子干活，外婆最见不得这个。",
      },
      {
        id: "e2",
        type: "line",
        bg: "street",
        speaker: "旁白",
        figure: "xiu-yi",
        text: "她把一袋橘子塞过来，又去招呼别的客人了。",
      },
      { id: "back", type: "goto", screen: "map" },
    ],
  },

  places: [
    { id: "station", name: "车站", hint: "老街这一头", x: 22, y: 90, landmark: true, blurb: "车站在老街这一头。往里走是杂货铺、邮局、卫生所，尽头才是「潮汐」。今晚不在车站停留。" },
    { id: "street", name: "老街·秀姨", hint: "日常", x: 22, y: 78, everyday: true },
    { id: "post", name: "邮局", hint: "第11天", x: 22, y: 66, locked: true, lockText: "邮局要等第 11 天，叶帆才会骑车过来。" },
    { id: "clinic", name: "卫生所", hint: "第10天起傍晚开放", x: 22, y: 54, locked: true, lockText: "第10天起傍晚开放" },
    { id: "cafe", name: "潮汐", hint: "二楼朝海", x: 22, y: 42 },
    { id: "school", name: "小学", hint: "街的尽头", x: 22, y: 30, landmark: true, blurb: "镇小学在老街最尽头。夏栀白天在这里上课，傍晚不开放。" },
    { id: "dock", name: "码头", hint: "陆屿", x: 34, y: 36, eveningEvent: true },
    { id: "lighthouse", name: "灯塔", hint: "北岬", x: 84, y: 14, eveningEvent: true },
    { id: "rocks", name: "礁石滩", hint: "看海", x: 62, y: 26 },
    { id: "lab", name: "研究站", hint: "第16天", x: 84, y: 36, locked: true, lockText: "研究站对着近岸珊瑚，第 16 天才进得去。" },
    { id: "inn", name: "浪花里", hint: "第20天", x: 62, y: 46, locked: true, lockText: "浪花里在沙滩这一侧。第 20 天的生日烧烤才会过去。" },
  ],

  messages: [
    { from: "沈若", text: "听说你辞职了？公司还在等你回来。" },
    { from: "沈若", text: "你的项目现在挂在我名下。第一，把辞职的事说清楚。第二……你吃饭了没有。" },
  ],

  replies: [
    { id: "warm", label: "我知道。你也别熬太晚。", bond: "shen-ruo", back: "……行。你先把店撑住。别让我白担心。" },
    { id: "cool", label: "工作的事以后再说。", back: "说重点。八月底前，公司要一个答复。" },
  ],

  sceneTag: {
    city: "城里 · 写字楼",
    train: "回汐湾的车上",
    station: "汐湾车站",
    cafe: "潮汐 · 店内",
    dock: "码头",
    lighthouse: "灯塔下",
    rocks: "礁石滩",
    street: "老街",
    night: "码头 · 夏日祭",
  },

  endings: {
    male: {
      who: "夏栀",
      figure: "xia-zhi",
      title: "好结局（示意）",
      where: "留在汐湾",
      text: "灯塔留了下来，改成可以走进去的海洋小课堂。她一边教书，一边读在职研究生。你守着「潮汐」，每天傍晚给灯塔送一杯栀子花蜂蜜拿铁。",
    },
    female: {
      who: "陆屿",
      figure: "lu-yu",
      title: "好结局（示意）",
      where: "留在汐湾",
      text: "他重新读了书。你守着店，等他放假回来。「远帆号」交给镇上的渔民代管。每个假期他推门进来，第一句话都是「橘子汽水还有吗」。",
    },
  },
};

/* romance 写的是哪一种主角能和这个人走在一起。心或贝壳不写死，按当前性别现算。 */
function cafeBondKind(id, gender) {
  const person = CafeData.characters.find((item) => item.id === id);
  if (!person) return "shell";
  const lead = gender === "female" ? "female" : "male";
  return person.romance === lead ? "heart" : "shell";
}

function cafeHeartField(gender) {
  const field = {};
  CafeData.characters.forEach((person) => {
    field[person.id] = cafeBondKind(person.id, gender);
  });
  return field;
}

function cafeApplyHeartField(gender) {
  const field = cafeHeartField(gender);
  CafeData.characters.forEach((person) => {
    person.heart = field[person.id];
  });
  return field;
}

function cafeShellSvg() {
  return (
    '<svg class="shell-icon" viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M32 56c-14-8-22-20-22-32 7 6 14 8 22 8s15-2 22-8c0 12-8 24-22 32z" fill="none" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M32 20v32M23 26c2 8 5 18 9 26M41 26c-2 8-5 18-9 26M16 32c5 4 11 10 16 18M48 32c-5 4-11 10-16 18" fill="none" stroke="currentColor" stroke-width="2"/>' +
    "</svg>"
  );
}

function cafeSilhouette(id) {
  const hair = {
    "lu-yu": '<path d="M64 58c4-28 22-40 36-40s32 12 36 40l-8 8H72z"/><path d="M78 36h44l-6 14H84z"/>',
    "xia-zhi": '<circle cx="100" cy="36" r="10"/><path d="M68 70c8-24 56-24 64 0 4 18-6 28-32 28S64 88 68 70z"/>',
    "tang-tang": '<path d="M70 48c6-22 54-22 60 4-16 10-44 10-60-4z"/><path d="M78 118h44v18H78z"/>',
    "xu-zhiyan": '<path d="M70 62h60" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="82" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="118" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="3"/>',
    "ye-fan": '<path d="M68 40h64l-8 16H76z"/><path d="M118 78c18 8 22 36 8 48"/>',
    "shen-ruo": '<path d="M72 70c10-30 46-30 56 0v18H72z"/><path d="M58 150h84l12 150H46z"/>',
    "cheng-lu": '<path d="M76 42c8-16 40-16 48 2-8 8-40 8-48-2z"/>',
    "song-zhiyuan": '<path d="M66 52c10-24 58-20 66 8-20 6-46 4-66-8z"/>',
    "jiang-xubai": '<path d="M64 64c8-30 64-30 72 4-22 16-52 14-72-4z"/>',
    "su-nian": '<path d="M78 72c-6 40-2 90 8 130M122 72c6 40 2 90-8 130"/>',
    "xiu-yi": '<circle cx="100" cy="34" r="11"/><path d="M62 78c10-20 66-20 76 2-8 16-68 16-76-2z"/>',
  };
  return (
    '<svg class="sil" viewBox="0 0 200 340" aria-hidden="true">' +
    '<ellipse class="shadow" cx="100" cy="318" rx="54" ry="8"/>' +
    '<path d="M46 328 72 168c8-28 28-40 28-40s20 12 28 40l26 160z"/>' +
    '<ellipse cx="100" cy="86" rx="30" ry="34"/>' +
    (hair[id] || "") +
    "</svg>"
  );
}
