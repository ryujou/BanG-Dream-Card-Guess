# 字体与图片来源

## 首页轮换立绘

三个主题共 70 位不同角色：BanG Dream! 20 位、世界计划 26 位、蔚蓝档案 24 位。角色列表及构图位于 `src/client/data/hero-characters.json`；轮换素材位于 `public/brand/hero/`，香澄和初音未来沿用既有首页文件。图片保留透明背景，仅裁去透明边距和进行 WebP 编码。

| 主题 | 游戏立绘来源 |
| --- | --- |
| BanG Dream! | [ガルパ官方角色目录](https://bang-dream.bushimo.jp/character/)，覆盖八支乐队；香澄来源见下方既有素材表。 |
| 世界计划 | [SEGA 官方角色目录](https://pjsekai.sega.jp/character/index.html)，包含 20 位原创角色与 6 位虚拟歌手。 |
| 蔚蓝档案 | [SchaleDB](https://schaledb.com/home) 的完整游戏立绘，资源地址为 `/images/student/portrait/{Id}.webp`；星野为 10005，日奈为 10004，白子为 10010。 |

每 6 秒切换下一位，一轮内不重复；刷新首位随机选择并避开该主题上次显示的角色。下一张图片提前加载，解码完成后以 600 ms 淡入淡出交接；三个主题首页仅展示角色立绘。页面隐藏、首屏离开视口或启用减少动态效果偏好时暂停计时。

## 双主题首页与鼠标伙伴

世界计划首页立绘使用 [SEGA《世界计划》初音未来官方角色图](https://pjsekai.sega.jp/assets/images/character/virtualsinger/chara01/chara.png)，网页文件为 `public/brand/miku-sekai.webp`，保留透明背景和角色原色。

鼠标资产使用内置 imagegen 生成，参考官方角色外形，属于本项目生成的衍生插画，不是官方原始立绘。完整生成 PNG 位于 `artifacts/cursor-source/`；网页资产位于 `public/brand/cursor/`，仅缩放及编码，不改变角色绘制。

| 文件 | 角色与用途 | 官方外形参考 |
| --- | --- | --- |
| `kasumi.webp`、`kasumi-pointer.png`、`kasumi-pointer-hover.png` | 户山香澄，红色主题主跟随角色与指针 | [BanG Dream! ガルパ☆ピコ](https://anime.bang-dream.com/pico/character/poppinparty/) |
| `michelle.webp` | 米歇尔，红色主题第二跟随角色 | [BanG Dream! 米歇尔](https://bang-dream.com/artist/hello-happy-world/michelle/) |
| `miku.webp`、`miku-pointer.png`、`miku-pointer-hover.png` | 初音未来，蓝色主题主跟随角色与指针 | [SEGA 初音未来](https://pjsekai.sega.jp/character/virtualsinger/miku/index.html) |
| `tofu.webp` | 白色耳机豆腐人，蓝色主题第二跟随角色；采用虚拟演唱会头像造型 | [SEGA 2.5 周年虚拟演唱会介绍](https://pjsekai.sega.jp/2_5thanniversary/welcome/index.html) |

交互参考 [Blue Archive 6th Anniversary Fes](https://cmn-jp.nexon.com/event/ba-6th-fes/) 的原生图片光标、两层延迟跟随和小屏点击散开效果，使用本站角色资产。

### 生成提示词

执行方式：内置 imagegen，六个独立生成请求，均设置 `transparent_background: true`，分别附上对应官方参考图。

<details><summary>香澄跟随角色</summary>

Use case: stylized-concept. Asset type: transparent chibi character sprite for a website mouse-follow companion, readable when displayed at 64 pixels. Create ONE full-body super-deformed Kasumi Toyama from BanG Dream!, using the attached OFFICIAL CHARACTER REFERENCE only to preserve her identity: short chestnut-brown hair with her two distinctive pointed hair tufts, purple eyes, tan school blazer and skirt, white collar, red ribbon, navy socks, brown shoes. Cheerful bright open smile, tiny compact waving hand and her recognizable red star-shaped electric guitar held close to the body. About 2.2 heads tall, oversized expressive face, compact silhouette, confident thick clean dark-brown line art, restrained cel shading, subtle narrow white sticker outline. Center the entire character including hair, shoes and guitar in a square image with generous transparent margins; character occupies about 80% of the canvas height. Clear simplified shapes optimized for a tiny UI companion. Accent red near #9F191E but preserve character's natural colors. This is a newly drawn sprite, NOT a character sheet: exactly one character, front three-quarter view, no second pose, no text, no name, no logo, no pink backing shape, no frame, no scene, no floor, no cast shadow, no decorative floating objects. Genuine transparent background.

</details>

<details><summary>初音跟随角色</summary>

Use case: stylized-concept. Asset type: transparent chibi character sprite for a website mouse-follow companion, readable when displayed at 64 pixels. Create ONE full-body super-deformed Hatsune Miku specifically matching the attached OFFICIAL PROJECT SEKAI CHARACTER REFERENCE: vivid turquoise long twin-tails with black-and-magenta angular hair bands, turquoise eyes, white sleeveless blouse with turquoise collar and tie, black pleated skirt with turquoise trim, detached black arm sleeves, black thigh-high boots with turquoise trim. Cheerful welcoming smile, one tiny compact hand waving, the other holding a small microphone close to her body. About 2.2 heads tall, oversized expressive face, compact gently curved twin-tails contained around the body, confident thick clean dark-blue line art, restrained cel shading, subtle narrow white sticker outline. Center the entire character including both twin-tails, feet and microphone in a square image with generous transparent margins; character occupies about 80% of the canvas height. Clear simplified shapes optimized for a tiny UI companion. Accent deep blue near #004190 in small details but preserve her iconic turquoise hair and the accurate costume. Exactly one character, front three-quarter view, no second pose, no text, no name, no logo, no background shape, no frame, no scene, no floor, no cast shadow, no separate floating objects. Genuine transparent background.

</details>

<details><summary>米歇尔</summary>

Use case: stylized-concept. Asset type: transparent small mascot sprite, readable at 40 pixels, companion to a chibi Kasumi mouse follower. Draw exactly ONE Michelle (ミッシェル) pink bear mascot from BanG Dream!, using the attached OFFICIAL REFERENCE for accurate identity. Round pink bear head and body, round ears with white centers, very large black oval eyes with yellow four-point sparkle pupils, white muzzle and cheeks, small black nose, little smiling mouth, white paws and white oval belly with the distinctive pink four-point sparkle mark. Compact two-head-tall plush bear, front three-quarter view, happily waving one paw. Clean bold dark-pink outline, simple cel shading, narrow white sticker edge matching a cute chibi anime website companion. Preserve the pink mascot colors. Centered full body, complete ears and feet, roughly 75% canvas height, spacious fully transparent margins. No clothing, no human, no second view, no text, no name, no CV, no logo, no yellow reference backdrop, no scene, no ground, no shadow, no extra objects. Genuine transparent background.

</details>

<details><summary>豆腐人</summary>

Use case: stylized-concept. Asset type: transparent small mascot sprite, readable at 40 pixels, companion to chibi Hatsune Miku. Draw exactly ONE Project SEKAI virtual-live tofu avatar, accurately based on the WHITE HEADPHONE-WEARING figure on the LEFT of the attached OFFICIAL REFERENCE. White rounded cube head, two simple black bean-shaped eyes, no nose and no mouth, little white block body and small block arms and feet. Black over-ear headphones with turquoise accents. Cute front three-quarter pose, one arm waving, slight playful lean. Simplify into clean friendly cel-shaded game sticker artwork with bold dark-blue outline and a narrow white sticker edge, matching polished chibi anime companion assets. The body remains white; tiny headset details may use deep blue #004190 and turquoise. Centered complete figure occupying around 75% of a square canvas with generous transparent margins. Exactly one white tofu avatar, no yellow avatar, no flower crown, no human face, no letters, no text, no name, no logo, no backdrop, no frame, no floor, no cast shadow, no separate objects. Genuine transparent background.

</details>

<details><summary>香澄鼠标指针</summary>

Use case: stylized-concept. Asset type: raster custom mouse pointer, character portrait with clear click arrow, needs to read at 48 pixels. Using the attached Kasumi Toyama OFFICIAL CHARACTER REFERENCE, draw a single extremely simplified cute chibi Kasumi HEAD ONLY: chestnut bob with her two hair tufts, purple eyes, happy smile, two red star hair clips. Put the face in the lower-right area and a crisp small north-west-pointing mouse arrow in the upper-left, joined as one compact sticker silhouette. Arrow fill deep red #9F191E, thin white separator and dark outline, arrow tip near 8% from the top and 8% from the left of the square canvas; clear pointing tip. Face has thick clean outlines, flat readable colors, minimal details. Transparent background with no background badge or shadow. Exactly one face and one arrow, no body, no text, no logo, no multiple states, no scene, no frame. Maintain generous transparent margin and do not crop.

</details>

<details><summary>初音鼠标指针</summary>

Use case: stylized-concept. Asset type: raster custom mouse pointer, character portrait with clear click arrow, needs to read at 48 pixels. Using the attached OFFICIAL PROJECT SEKAI Miku REFERENCE, draw a single extremely simplified cute chibi Hatsune Miku HEAD ONLY: turquoise hair with two short compact outward-curving twin-tail shapes, black-and-magenta angular hair ties, turquoise eyes, happy smile. Put the face in the lower-right area and a crisp small north-west-pointing mouse arrow in the upper-left, joined as one compact sticker silhouette. Arrow fill deep blue #004190, thin white separator and dark outline, arrow tip near 8% from the top and 8% from the left of the square canvas; clear pointing tip. Face has thick clean outlines, flat readable colors, minimal details. Transparent background with no background badge or shadow. Exactly one face and one arrow, no body, no text, no logo, no multiple states, no scene, no frame. Maintain generous transparent margin and do not crop.

</details>

## 游戏角色与入口插画

两主题各四个首页游戏入口均使用内置 imagegen 绘制的透明角色插画。世界计划的猜卡、射手与华容道原图位于 `artifacts/sekai-source/`，网页文件位于 `public/brand/sekai-games/`。

邦邦四个入口及世界计划秒表入口的完整 PNG 与实际提示词保存于 `artifacts/game-entry-source/`（`prompts.json`）。网页文件导出为 720×360 WebP，保留透明通道；首页与游戏列表的小图共用 `HomeGameArt` 的主题映射，按原比例显示。

| 网页文件 | 角色与构图 |
| --- | --- |
| `public/brand/bangdream-games/cards.webp` | 香澄、有咲、沙绫三张扇形卡片，红金配色 |
| `public/brand/bangdream-games/shooter.webp` | 香澄弹奏红色星形吉他，音符射出与唱片构图 |
| `public/brand/bangdream-games/stopwatch.webp` | 香澄按下金色秒表按钮 |
| `public/brand/bangdream-games/klotski.webp` | 米歇尔中央拼块，香澄、有咲两侧人物块 |
| `public/brand/sekai-games/stopwatch.webp` | 初音按下金色秒表按钮，双马尾与蓝色描边 |

构图参考既有世界计划入口插画；角色依据项目中的香澄立绘、有咲和沙绫原棋子图、米歇尔与初音跟随素材。每张图的具体参考文件与完整提示词见 `artifacts/game-entry-source/prompts.json`。

华容道使用正常动漫比例的角色梗图，参考邦邦原棋子的彩框、满幅构图、动作道具和醒目标签。10 张棋子原始 PNG、入口原图和完整实际提示词保存于 `artifacts/sekai-source/klotski-memes/`（`prompts.json`）；网页棋子在 `public/brand/sekai-games/klotski/`，入口为 `public/brand/sekai-games/klotski-memes.webp`。中央棋子与通关图共用 `tsukasa.webp`。方形导出 640×640、竖条 320×640、横条 640×320，棋盘按格子满幅显示。

| 原棋子位置 | 世界计划角色 | 梗图文字与动作 |
| --- | --- | --- |
| 米歇尔 2×2 | 天马司 | 世界第一；自信指向自己、舞台星光 |
| 喵梦 1×2 | 日野森雫 | 又迷路了；地图与行李箱 |
| 摩卡 1×2 | 东云彰人 | 松饼是我的；抱着松饼盘 |
| 有咲 1×2 | 宵崎奏 | 杯面续命；键盘前吃杯面 |
| 友希那 2×1 | 凤笑梦 | WONDERHOY!；张开双臂 |
| 伊芙 1×2 | 神代类 | 发明中；扳手与舞台道具火箭 |
| 沙绫 1×1 | 东云绘名 | 自拍时间；手机自拍 |
| 纸箱 1×1 | 桐谷遥 | 企鹅天堂；抱企鹅玩偶 |
| 多惠 1×1 | 小豆泽心羽 | 仓鼠本鼠；捧着仓鼠 |
| 筑紫 1×1 | 朝比奈真冬 | 不知道；平静无表情 |

角色外形参考 [SEGA 角色页](https://pjsekai.sega.jp/character/index.html)，各独立立绘地址见提示词文件。梗的依据：[SEGA 初始角色设定](https://www.sega.jp/topics/detail/191213_4/)中的明星志向、发明与自拍爱好；[CoroCoro 对 Wonderhoy 的介绍](https://corocoro-news.jp/special/278525/)；[遥官方资料的企鹅收藏爱好](https://pjsekai.sega.jp/character/unite02/haruka/index.html)；角色资料中的[彰人松饼喜好](https://pjsekai.info/character/shinonome-akito)、[奏杯面喜好](https://pjsekai.info/character/yoisaki-kanade)及[雫方向感](https://w.atwiki.jp/prskwiki/pages/23.html)。心羽的仓鼠与真冬的“わからない”属于玩家常用梗，参照[心羽资料](https://mzh.moegirl.org.cn/小豆泽心羽)和[用语与梗](https://moegirl.uk/世界计划_缤纷舞台！_feat._初音未来/用语与梗)。中文标签和具体构图为本项目的同人改编。

射手采用原游戏素材逐帧作为动作参考，世界计划官方图作为身份和服装参考，由内置 imagegen 重绘。透明原图、51 个文件对应表和全部实际提示词保存于 `artifacts/sekai-source/shooter-frames/`；最终 WebP 位于 `public/brand/sekai-games/shooter-frames/`。保留原图画布比例，配对跑动帧使用共同缩放、脚底对齐和原 400 ms 切换节奏。原图和重绘图的并排及连续帧预览为 `artifacts/screenshots/sekai-shooter-frame-comparison.html`。

官方角色参考：[虚拟歌手](https://pjsekai.sega.jp/assets/data/webp/character/virtualsinger/list/chara.png.webp)、[Leo/need](https://pjsekai.sega.jp/assets/data/webp/character/unite01/list/chara.png.webp)、[MORE MORE JUMP!](https://pjsekai.sega.jp/assets/data/webp/character/unite02/list/chara.png.webp)、[Vivid BAD SQUAD](https://pjsekai.sega.jp/assets/data/webp/character/unite03/list/chara.png.webp)、[Wonderlands×Showtime](https://pjsekai.sega.jp/assets/data/webp/character/unite04/list/chara.png.webp)、[25 时，在 Nightcord。](https://pjsekai.sega.jp/assets/data/webp/character/unite05/list/chara.png.webp)。豆腐人采用前述官方白色耳机头像。生成图是同人游戏装饰素材，角色权利归原权利方。

猜卡使用真实卡面。实现参考了 [pjsk 猜卡 GitHub 项目](https://github.com/yonglanws/astrbot_plugin_pjsk_guess_card) 的公开数据组织方式，未复制其 GPL 代码；仍使用本站原有猜卡引擎。题库从 [Haruki 世界计划主数据](https://github.com/Team-Haruki/haruki-sekai-master/blob/main/master/cards.json) 整理为 26 位角色、986 张已发布三星/四星卡，中文、日文、英文及常用昵称保存在 `resource/sekai/nickname.json`。卡面 URL 格式以 [Sekai Viewer 卡面页源码](https://github.com/Sekai-World/sekai-viewer/blob/main/src/pages/card/CardDetail.tsx) 为依据，使用 `storage.sekai.best/sekai-jp-assets/character/member/{assetbundleName}/card_{normal,after_training}.webp`，按需缓存于 `public/cards/sekai/`。这些真实卡面不属于 AI 绘制素材。

世界计划社群链接 `https://qm.qq.com/q/EF4FxmYc6W` 与群号 `1030720768` 由用户提供。

## 字体

网页字体存放于 `public/fonts`，原始 TTF 存放于 `artifacts/fonts-source`。页面通过 `src/client/fonts.css` 按需加载 `public/fonts/subsets` 中的字形分片，保留可变字重；Noto Sans SC 的分片覆盖原字体全部字符。使用安装了 `fonttools[woff]` 的 Python 运行 `scripts/subset-fonts.py` 可生成分片。首页社团缩略图由 `node scripts/community-thumbnails.mjs` 生成，原图用于完整相册。

| 网页文件 | 字重 | 原始字体 | 许可证文件 |
| --- | --- | --- | --- |
| `NotoSansSC-Variable.woff2` | 100–900 | [Google Fonts：Noto Sans SC](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf) | `public/fonts/NotoSansSC-OFL.txt` |
| `MaShanZheng-Regular.woff2` | 400 | [Google Fonts：Ma Shan Zheng](https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf) | `public/fonts/MaShanZheng-OFL.txt` |
| `Caveat-Variable.woff2` | 400–700 | [Google Fonts：Caveat](https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf) | `public/fonts/Caveat-OFL.txt` |

三款字体均使用 SIL Open Font License 1.1。许可证原文随字体保留；该许可证仅适用于字体。

## 角色、标识与舞台图片

| 本地文件 | 来源 |
| --- | --- |
| `public/brand/kasumi.png` | 首页与社区页角色；原项目 `public/standees/res001001_rip/trim_normal.png`；[Bestdori 原角色素材](https://bestdori.com/assets/jp/characters/resourceset/res001001_rip/trim_normal.png) |
| `public/brand/poppin-party-logo.webp` | [BanG Dream! 官方 Poppin’Party 标识](https://bang-dream.com/wordpress/wp-content/themes/bangdream-portal/assets/webp/common/artist/logo_poppinparty.webp) |
| `public/brand/bang-dream-logo.png` | [BanG Dream! 官方标识](https://bang-dream.com/wordpress/wp-content/themes/bangdream-portal/assets/images/common/common/logo_bangdream.png) |
| `public/brand/film-live-stage.jpg` | [BanG Dream! FILM LIVE 官方宣传剧照](https://anime.bang-dream.com/filmlive/wordpress/wp-content/uploads/2019/08/メイン場面写1.jpg) |

角色、标识与剧照的版权归各自权利人。舞台图片保留原图版权标注，用作作品主题装饰，不代表社团活动记录。

## 湘潭边饰与草书字标

`src/client/components/XiangtanScene.tsx` 以分层色块绘制万楼飞檐、湘潭眼、湘江一桥和湘莲，使用本地 Ma Shan Zheng 书法字体排版地标名称。建筑外形参考下列资料，图形为装饰性概括：

- [湖南日报·新湖南：湘潭⇆长沙文旅直通线](https://www.hunantoday.cn/news/xhn/202604/32429840.html)，万楼夜景照片。
- [湖南政协：来湘潭必打卡的城市地标“千里湘江第一桥”](https://zx.zxy.hunanzx.gov.cn/szxapp/4/305/content_1124414.html)，湘潭一大桥航拍与桥梁介绍。
- [湖南省文旅厅：湘潭文旅体消费体验](https://whhlyt.hunan.gov.cn/whhlyt/news/sxxw/202305/t20230526_29359765.html)，万楼与“莲城”地域元素。
- [湖南省政府：湘潭县花石镇碧色荷塘](https://www.hunan.gov.cn/hnyw/sy/hnyw1/201809/t20180910_5090785.html)，湘莲产地与荷塘说明。

`public/brand/xiangtan-wordmark.svg` 的“湘潭”字形取自湘潭大学校名标识的矢量轮廓，仅提取两字、旋正排列为地方装饰。字形对照[湘潭大学官方校名原图](https://en.xtu.edu.cn/About_XTU/xtu_values/Name_of_XTU.htm)，矢量来源为 [urongda 校徽素材库](https://www.urongda.com/logos/4143010530)。官网记载校名由毛泽东于 1958 年题写；本站两字为衍生排版，不使用完整校徽。

城市 SVG 使用可暂停的摩天轮、江面流光和灯光动画，Canvas 绘制漂浮光点及星芒。湘潭眼参考[湖南省政府的万楼景区介绍](https://www.hunan.gov.cn/topic/kjbh/knxhsc/gzjxs02/szdt02/202604/t20260402_33947551.html)。图形为装饰性组合，不代表地理位置关系。

## Bilibili 测试视频

测试站配置以下“BanGDream梦想协奏曲”官方账号视频，通过 Bilibili 官方播放器内嵌播放：

- [周年纪念 MV《CiRCLE THANKS MUSiC♪》](https://www.bilibili.com/video/BV1HP4y1R73q/)
- [《BanG Dream! 少女乐团派对!》五周年特别节目](https://www.bilibili.com/video/BV1mi421U7tn/)
- [《BanG Dream!》七周年特别直播节目](https://www.bilibili.com/video/BV12ZGR6NE25/)

## 商品与小程序码

商品名称、价格及图片来源沿用现有商品目录。图片与小程序码存放于 `public/shop`，供线下聚会页面本地加载；权利归原提供方。

| 本地文件 | 原链接 |
| --- | --- |
| `public/shop/b80f2450b90e4ee9554e37715fd2eeac.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/b80f2450b90e4ee9554e37715fd2eeac.jpg) |
| `public/shop/231070724592ffab9ea610199009cfab.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/231070724592ffab9ea610199009cfab.jpg) |
| `public/shop/d23d504442590d07c6ddd92c87b3dbf2.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/d23d504442590d07c6ddd92c87b3dbf2.jpg) |
| `public/shop/d5213474665c2607eae1ac8011d2ddae.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/d5213474665c2607eae1ac8011d2ddae.jpg) |
| `public/shop/3a930219d6f62c19a8fa1ea4a48630f7.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/3a930219d6f62c19a8fa1ea4a48630f7.jpg) |
| `public/shop/580b68cb2b11f49015a17724c5e8a128.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/580b68cb2b11f49015a17724c5e8a128.jpg) |
| `public/shop/c6feeca46e630c4485f7ad5091f9273a.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/c6feeca46e630c4485f7ad5091f9273a.jpg) |
| `public/shop/a606801ad4ae9b9463d5613d17a6d344.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/a606801ad4ae9b9463d5613d17a6d344.jpg) |
| `public/shop/d356449ede278c327d35f23de8ab7c3b.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/d356449ede278c327d35f23de8ab7c3b.jpg) |
| `public/shop/7dd33a9b2410d6c4956eadded478d36a.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/7dd33a9b2410d6c4956eadded478d36a.jpg) |
| `public/shop/4f263f7c76b0021028642eb102fceeff.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/4f263f7c76b0021028642eb102fceeff.jpg) |
| `public/shop/checkout-qr.jpg` | [原图片](https://i.imgs.ovh/2026/05/31/7c57463118e5e8a36f3386d7727691d8.jpg) |
