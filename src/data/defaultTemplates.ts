import { SpecTemplate } from '../types';

export const DEFAULT_TEMPLATES: SpecTemplate[] = [
  {
    id: 'tpl-waterpipe',
    code: 'SPEC-PIPE-01',
    name: '配水管敷設工事 特記仕様書',
    description: '水道配水管敷設・給水管切替工事向け標準特記仕様書（耐圧試験・ミルシート・受渡条件等）',
    targetCategoryName: '配水管・土木配管',
    columns: ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
    inspectionStandard: 'JWWA規格および水道事業体基準に準拠。水圧試験成績書（1.75MPa保持）、ミルシートの提出を必須とする。',
    warrantyPeriod: '工事引渡完了日より2年間。',
    deliveryTerms: '工事現場受入口車上渡し。受入れ時に外観・寸法検査を実施する。',
    notesTemplate: '・道路占用許可条件および埋設保安基準を厳守すること。\n・埋設深さ、砂基礎厚、管表示テープの施工写真を提出のこと。',
    sourceType: 'preset',
    fields: [
      {
        id: 'f-title',
        label: '仕様書標題',
        cell: 'B2',
        type: 'text',
        group: 'basic',
        defaultValue: '【 配水管敷設工事 特記仕様書 】',
        description: '表題部分に印字されるタイトル'
      },
      {
        id: 'f-docno',
        label: '仕様書番号',
        cell: 'C4',
        type: 'text',
        group: 'basic',
        defaultValue: 'SPEC-PIPE-2026-001'
      },
      {
        id: 'f-date',
        label: '発行日',
        cell: 'G4',
        type: 'date',
        group: 'basic',
        defaultValue: new Date().toISOString().slice(0, 10)
      },
      {
        id: 'f-project-name',
        label: '工事名称 / 件名',
        cell: 'C5',
        type: 'text',
        group: 'basic',
        defaultValue: '令和8年度 配水本管更新工事（第1工区）'
      },
      {
        id: 'f-issuer',
        label: '発行元 / 設計担当',
        cell: 'G5',
        type: 'text',
        group: 'basic',
        defaultValue: '水道事業部 工事設計課'
      },
      // Checkboxes (適用要件)
      {
        id: 'f-chk-pressure',
        label: '水圧試験の実施・成績書提出',
        cell: 'C8',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (1.75MPa保持・自記圧記録提出)',
          uncheckedValue: '☐ 不要 (指定なし)',
          labelTrue: '要 (水圧試験成績書を提出)',
          labelFalse: '不要'
        },
        description: '耐圧水圧試験成績書の提出を義務付けるか'
      },
      {
        id: 'f-chk-mill',
        label: 'ミルシート（鋼材検査証明書）添付',
        cell: 'G8',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (納品時添付)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (ミルシート提出)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-witness',
        label: '公的立会検査の実施',
        cell: 'G10',
        type: 'checkbox',
        group: 'check',
        defaultValue: false,
        checkboxConfig: {
          checkedValue: '☑ 要 (監督員立会検査を実施)',
          uncheckedValue: '☐ 不要 (自主検査のみ)',
          labelTrue: '要 (監督員立会)',
          labelFalse: '不要 (自主検査)'
        }
      },
      {
        id: 'f-chk-degrease',
        label: '禁油脱脂処理・洗浄証明書',
        cell: 'G9',
        type: 'checkbox',
        group: 'check',
        defaultValue: false,
        checkboxConfig: {
          checkedValue: '☑ 要 (禁油脱脂洗浄証明書添付)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (脱脂証明書添付)',
          labelFalse: '不要'
        }
      },
      // Dropdown Selects
      {
        id: 'f-sel-coating',
        label: '外面塗装仕様',
        cell: 'C9',
        type: 'select',
        group: 'spec',
        options: [
          '水道用エポキシ樹脂粉体塗装 (内面) ＋ 防食外面塗装',
          'タールエポキシ樹脂塗料塗装 (2回塗り)',
          'ポリエチレンスリーブ被覆工法',
          '標準錆止め塗装 (下塗り1回・上塗り1回)',
          '無塗装 (ステンレス管・樹脂管)'
        ],
        defaultValue: '水道用エポキシ樹脂粉体塗装 (内面) ＋ 防食外面塗装',
        description: '管材・接合部の防食塗装種別'
      },
      {
        id: 'f-sel-delivery',
        label: '受渡・引渡条件',
        cell: 'C10',
        type: 'select',
        group: 'spec',
        options: [
          '指定工事現場荷受場所車上渡し',
          '水道局指定保管倉庫渡し',
          'メーカー元請工場渡し',
          '現場据付位置渡し（クレーン荷下ろし含む）'
        ],
        defaultValue: '指定工事現場荷受場所車上渡し',
        description: '資材の納入受渡方法'
      },
      // Notes
      {
        id: 'f-notes',
        label: '特記事項・指示事項 (指定セル E30 / B23代入)',
        cell: 'B23',
        type: 'textarea',
        group: 'notes',
        defaultValue: '1. 管内面への土砂・雨水等の浸入防止措置（養生キャップ）を施して搬入すること。\n2. 各管材の胴体部に規格名称、ロット番号、製造年月日が明瞭に刻印されていること。\n3. 接合用ゴム輪・ボルトナット類は正規規格品を一括納入すること。'
      }
    ],
    tableMapping: {
      startRow: 15,
      targetSheetName: '仕様書',
      tagNoCol: 'B',
      nameCol: 'C',
      diameterCol: 'D',
      materialCol: 'E',
      quantityCol: 'F',
      deliveryDateCol: 'G',
      notesCol: 'H'
    },
    updatedAt: '2026-11-06'
  },
  {
    id: 'tpl-valve',
    code: 'SPEC-VALVE-02',
    name: '配管・バルブ交換工事 仕様書',
    description: '仕切弁、バタフライ弁、減圧弁、逆止弁等の交換・更新工事向け仕様書',
    targetCategoryName: 'バルブ・配管機器',
    columns: ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
    inspectionStandard: 'JIS B 2003 弁の圧力検査通則に準拠。全数工場出荷検査記録を添付すること。',
    warrantyPeriod: '納入引渡完了日より1年間。',
    deliveryTerms: '指定プラント受入口車上渡し。',
    notesTemplate: '・面間寸法は既存バルブと完全互換であること。\n・開度指示器およびグランド部点検スペースを確保のこと。',
    sourceType: 'preset',
    fields: [
      {
        id: 'f-title',
        label: '仕様書標題',
        cell: 'B2',
        type: 'text',
        group: 'basic',
        defaultValue: '【 配管・バルブ交換工事 仕様書 】'
      },
      {
        id: 'f-docno',
        label: '仕様書番号',
        cell: 'C4',
        type: 'text',
        group: 'basic',
        defaultValue: 'SPEC-VALVE-2026-002'
      },
      {
        id: 'f-date',
        label: '発行日',
        cell: 'G4',
        type: 'date',
        group: 'basic',
        defaultValue: new Date().toISOString().slice(0, 10)
      },
      {
        id: 'f-project-name',
        label: '施設名称 / 件名',
        cell: 'C5',
        type: 'text',
        group: 'basic',
        defaultValue: '浄水場送水ポンプ室 バルブ更新工事'
      },
      {
        id: 'f-issuer',
        label: '発行元',
        cell: 'G5',
        type: 'text',
        group: 'basic',
        defaultValue: 'プラント施設課'
      },
      // Checkboxes
      {
        id: 'f-chk-pressure',
        label: '弁耐圧・弁座漏れ試験成績書',
        cell: 'C8',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (JIS B 2003 耐圧検査成績書添付)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (成績書添付)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-mill',
        label: '弁箱・弁体ミルシート提出',
        cell: 'G8',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (SCS/FCDミルシート提出)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (ミルシート提出)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-degrease',
        label: '禁油脱脂処理・証明書添付',
        cell: 'G9',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (酸素・高純度水ライン脱脂洗浄)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (禁油脱脂処理)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-witness',
        label: 'メーカー立会検査',
        cell: 'G10',
        type: 'checkbox',
        group: 'check',
        defaultValue: false,
        checkboxConfig: {
          checkedValue: '☑ 要 (立会検査実施)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (立会検査)',
          labelFalse: '不要'
        }
      },
      // Dropdown Selects
      {
        id: 'f-sel-coating',
        label: '弁箱外面塗装仕様',
        cell: 'C9',
        type: 'select',
        group: 'spec',
        options: [
          'エポキシ樹脂粉体塗装 (膜厚200μm以上)',
          '耐候性ウレタン樹脂塗装 (上塗り指定色)',
          '耐海水防食塗装',
          '標準メーカー標準塗装'
        ],
        defaultValue: 'エポキシ樹脂粉体塗装 (膜厚200μm以上)'
      },
      {
        id: 'f-sel-delivery',
        label: '納入引渡条件',
        cell: 'C10',
        type: 'select',
        group: 'spec',
        options: [
          '指定プラント荷受所車上渡し',
          '現地据付階渡し',
          '工場出荷渡し'
        ],
        defaultValue: '指定プラント荷受所車上渡し'
      },
      {
        id: 'f-notes',
        label: '特記事項・指示事項',
        cell: 'B23',
        type: 'textarea',
        group: 'notes',
        defaultValue: '・銘板にタグNo.、口径、圧力定格、流向矢印を刻印すること。\n・既設配管とのフランジボルト穴位置の一致を確認のこと。'
      }
    ],
    tableMapping: {
      startRow: 15,
      targetSheetName: '仕様書',
      tagNoCol: 'B',
      nameCol: 'C',
      diameterCol: 'D',
      materialCol: 'E',
      quantityCol: 'F',
      deliveryDateCol: 'G',
      notesCol: 'H'
    },
    updatedAt: '2026-11-06'
  },
  {
    id: 'tpl-pump',
    code: 'SPEC-PUMP-03',
    name: 'ポンプ・機械装置 製作特記仕様書',
    description: '渦巻ポンプ、高圧ポンプ、送風機、撹拌機等向け機械仕様書（性能曲線・振動・モーター仕様）',
    targetCategoryName: 'ポンプ・機械装置',
    columns: ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
    inspectionStandard: 'JIS B 8301 / 8302 に準拠。全揚程・流量・軸動力・ポンプ効率の性能試験成績書を提出すること。',
    warrantyPeriod: '試運転検収完了日より1年間。',
    deliveryTerms: '指定プラント基礎上据付位置車上渡し。共通ベース付にて納入のこと。',
    notesTemplate: '・モーター仕様: 三相 200V/400V 50/60Hz、全閉外扇屋外型（IE3プレミアム効率）。\n・基礎ボルトおよびカップリングカバーを付属のこと。',
    sourceType: 'preset',
    fields: [
      {
        id: 'f-title',
        label: '仕様書標題',
        cell: 'B2',
        type: 'text',
        group: 'basic',
        defaultValue: '【 ポンプ・機械装置 製作特記仕様書 】'
      },
      {
        id: 'f-docno',
        label: '仕様書番号',
        cell: 'C4',
        type: 'text',
        group: 'basic',
        defaultValue: 'SPEC-MECH-2026-003'
      },
      {
        id: 'f-date',
        label: '発行日',
        cell: 'G4',
        type: 'date',
        group: 'basic',
        defaultValue: new Date().toISOString().slice(0, 10)
      },
      {
        id: 'f-project-name',
        label: '工事名称 / 件名',
        cell: 'C5',
        type: 'text',
        group: 'basic',
        defaultValue: '新第2配水池 送水ポンプ増設工事'
      },
      {
        id: 'f-issuer',
        label: '発行元',
        cell: 'G5',
        type: 'text',
        group: 'basic',
        defaultValue: '技術統括部 機械設備設計課'
      },
      // Checkboxes
      {
        id: 'f-chk-pressure',
        label: '実流性能試験曲線・成績書提出',
        cell: 'C8',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (Q-H性能曲線および効率・軸動力成績書提出)',
          uncheckedValue: '☐ 不要 (型式成績書で可)',
          labelTrue: '要 (性能曲線成績書提出)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-mill',
        label: '主要部品ミルシート提出',
        cell: 'G8',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (ケーシング・羽根車・主軸ミルシート提出)',
          uncheckedValue: '☐ 不要',
          labelTrue: '要 (ミルシート提出)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-witness',
        label: '工場試運転立会検査',
        cell: 'G10',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (工場出荷前立会試験を実施)',
          uncheckedValue: '☐ 不要 (社内試験報告書のみ)',
          labelTrue: '要 (立会検査実施)',
          labelFalse: '不要'
        }
      },
      {
        id: 'f-chk-degrease',
        label: '基礎ボルト・ナット付属',
        cell: 'G9',
        type: 'checkbox',
        group: 'check',
        defaultValue: true,
        checkboxConfig: {
          checkedValue: '☑ 要 (JIS基礎ボルト・ナット一式付属)',
          uncheckedValue: '☐ 不要 (現地手配)',
          labelTrue: '要 (基礎ボルト付属)',
          labelFalse: '不要'
        }
      },
      // Selects
      {
        id: 'f-sel-coating',
        label: '機械外面塗装色・防錆仕様',
        cell: 'C9',
        type: 'select',
        group: 'spec',
        options: [
          'マンセル 2.5G 7/2 (上水指定ライトグリーン) 膜厚100μm',
          'マンセル 5Y 7/1 (淡黄グレー)',
          '耐塩害重防食ウレタン塗装 (膜厚150μm)',
          'メーカー標準機械色'
        ],
        defaultValue: 'マンセル 2.5G 7/2 (上水指定ライトグリーン) 膜厚100μm'
      },
      {
        id: 'f-sel-delivery',
        label: '据付受渡条件',
        cell: 'C10',
        type: 'select',
        group: 'spec',
        options: [
          'プラント現場機械基礎上車上渡し',
          '現場一次保管ヤード渡し',
          '据付調整立会・芯出し指導込み'
        ],
        defaultValue: 'プラント現場機械基礎上車上渡し'
      },
      {
        id: 'f-notes',
        label: '特記事項・保守指示事項',
        cell: 'B23',
        type: 'textarea',
        group: 'notes',
        defaultValue: '・モーターは三相200V 50/60Hz、IE3高効率トップランナー規格に適合すること。\n・取扱説明書（部品分解図、推奨潤滑油一覧含む）を製本3部および電子版PDFを納入のこと。'
      }
    ],
    tableMapping: {
      startRow: 15,
      targetSheetName: '仕様書',
      tagNoCol: 'B',
      nameCol: 'C',
      diameterCol: 'D',
      materialCol: 'E',
      quantityCol: 'F',
      deliveryDateCol: 'G',
      notesCol: 'H'
    },
    updatedAt: '2026-11-06'
  }
];
