import { SpecTemplate } from '../types';

export const DEFAULT_TEMPLATES: SpecTemplate[] = [
  {
    id: 'tpl-valve',
    code: 'TPL-VALVE-01',
    name: '配管・バルブ機器調達仕様書',
    description: '仕切弁、逆止弁、ボールバルブ、ストレーナー等の配管機器向け標準仕様書',
    targetCategoryName: 'バルブ・配管機器',
    columns: ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
    inspectionStandard: '1. 耐圧・漏れ検査: JIS B 2003 に準拠した耐圧検査成績書を提出すること。\n2. 材料検査: 主要耐圧部材のミルシート(鋼材検査証明書)を添付すること。\n3. 外観寸法検査: 接続フランジ面および面間寸法の検査成績書を提出のこと。',
    warrantyPeriod: '納入引渡完了日より1年間。正常使用下での初期漏れ・亀裂・動作不良は無償修理または交換とする。',
    deliveryTerms: '指定工場受入口車上渡し。開口部防塵キャップ装着、木枠またはダンボール個別梱包にて納入のこと。',
    notesTemplate: '・禁油処理が必要なラインについては事前に洗浄脱脂証明書を添付のこと。\n・銘板に機器番号(タグNo.)、口径、最高使用圧力を刻印のこと。',
    sourceType: 'preset',
    updatedAt: '2026-03-01'
  },
  {
    id: 'tpl-machine',
    code: 'TPL-MECH-02',
    name: 'ポンプ・機械装置製作仕様書',
    description: '渦巻ポンプ、定量ポンプ、撹拌機等の機械回転機器向け仕様書',
    targetCategoryName: 'ポンプ・機械装置',
    columns: ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
    inspectionStandard: '1. 性能試験: 揚程・流量・軸動力・効率の性能曲線試験成績書を提出のこと。\n2. 振動測定: 定格回転時において基準振動値以下であることを確認すること。\n3. 外観塗装: 指定防錆塗装(2回塗り)の膜厚測定値を報告のこと。',
    warrantyPeriod: '試運転検収完了日より1年間。',
    deliveryTerms: '指定プラント現場据付階への荷受。共通ベース付にて納入のこと。',
    notesTemplate: '・モーター仕様: 三相 200V 50/60Hz、全閉外扇屋外型 (IE3高効率)。\n・据付用基礎ボルトおよび取扱説明書(紙1部・電子版)を同封のこと。',
    sourceType: 'preset',
    updatedAt: '2026-03-01'
  },
  {
    id: 'tpl-general',
    code: 'TPL-GEN-03',
    name: '汎用機器・部材調達仕様書',
    description: '汎用機器、配管部材、ブラケット等の標準仕様書',
    targetCategoryName: '汎用機器',
    columns: ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
    inspectionStandard: '品名、口径、材質、数量の一致確認および輸送傷のなきことの全数受入外観検査を実施する。',
    warrantyPeriod: '納入日より6ヶ月間。',
    deliveryTerms: '指定工場倉庫渡し。納品書および出荷証明書を同梱のこと。',
    notesTemplate: '・納品書に必ず機器番号および注文番号を明記のこと。',
    sourceType: 'preset',
    updatedAt: '2026-03-01'
  }
];
