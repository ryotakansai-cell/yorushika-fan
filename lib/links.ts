// 公式リンク集。
//
// ここに載せるのは、公式サイト（yorushika.com）のメニューとフッターに
// 実際に載っているものだけ。記憶や検索結果から足すと、なりすましや
// 古いアカウントを載せてしまう危険があるため。
// 追加するときも、公式サイトから辿れることを確認してから書く。

export type OfficialLink = {
  label: string;
  url: string;
  description: string;
};

export type LinkGroup = {
  title: string;
  links: OfficialLink[];
};

export const OFFICIAL_LINKS: LinkGroup[] = [
  {
    title: "公式サイト",
    links: [
      {
        label: "ヨルシカ OFFICIAL SITE",
        url: "https://yorushika.com/",
        description: "ニュース・ライブ・作品情報の一次情報",
      },
      {
        label: "歌詞（LYRICS）",
        url: "https://yorushika.com/discography/artist/2/",
        description: "公式サイトに掲載されている歌詞",
      },
      {
        label: "ディスコグラフィー",
        url: "https://yorushika.com/discography",
        description: "全作品の詳細・収録曲",
      },
      {
        label: "バイオグラフィー",
        url: "https://yorushika.com/feature/biography",
        description: "ヨルシカの経歴",
      },
    ],
  },
  {
    title: "SNS・動画",
    links: [
      {
        label: "YouTube",
        url: "https://www.youtube.com/channel/UCRIgIJQWuBJ0Cv_VlU3USNA",
        description: "MV・ライブ映像",
      },
      {
        label: "X（n-buna staff）",
        url: "https://twitter.com/nbuna_staff",
        description: "公式サイトに掲載されているスタッフアカウント",
      },
      {
        label: "Instagram",
        url: "https://www.instagram.com/yorushika_official_/",
        description: "",
      },
      {
        label: "TikTok",
        url: "https://www.tiktok.com/@yorushika_official",
        description: "",
      },
    ],
  },
  {
    title: "グッズ・その他",
    links: [
      {
        label: "オフィシャルグッズ",
        url: "https://store.plusmember.jp/yorushika/",
        description: "公式オンラインストア",
      },
      {
        label: "公式アプリ",
        url: "https://yorushika.com/feature/application",
        description: "",
      },
      {
        label: "ファンレター",
        url: "https://yorushika.com/feature/fanletter",
        description: "ファンレターの送り方",
      },
    ],
  },
];
