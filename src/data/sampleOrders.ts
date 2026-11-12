import { EquipmentItem, ProjectWorkspace, Category } from '../types';

export const INITIAL_PROJECTS: ProjectWorkspace[] = [
  {
    id: 'prj-main',
    orderNo: '202500444',
    code: '20345-001',
    codePart1: '20345',
    codePart2: '001',
    name: '〇〇市水道工事 配水管敷設',
    clientName: '〇〇市水道局',
    clientNumber: '【MC】-【09821】',
    clientNumberPart1: 'MC',
    clientNumberPart2: '09821',
    location: '〇〇市中央通り 1工区',
    department: '水道工務部 配水課',
    description: '水道工事に伴うバルブ・配管機器およびポンプ設備の調達',
    createdAt: '2026-03-01'
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-valve', projectId: 'prj-main', name: 'バルブ・配管機器', color: 'blue' },
  { id: 'cat-pump', projectId: 'prj-main', name: 'ポンプ・機械装置', color: 'emerald' },
  { id: 'cat-pipe', projectId: 'prj-main', name: '継手・フランジ', color: 'amber' },
  { id: 'cat-etc', projectId: 'prj-main', name: '未分類 / その他', color: 'slate' }
];

export const INITIAL_ITEMS: EquipmentItem[] = [
  {
    id: 'eq-01',
    projectId: 'prj-main',
    tagNo: '03-001',
    classification: '03',
    name: 'ステンレス製電動ボール弁',
    quantity: 4,
    unit: '台',
    deliveryDate: '2026-05-15',
    isIssued: true,
    categoryId: 'cat-valve',
    deliveryLocation: '第1化学工場受入ヤード',
    notes: 'JIS 10K フランジ接続、AC100V開閉アクチュエータ付',
    specs: [
      { id: 'sp-1-1', name: '口径', value: '50', unit: 'A' },
      { id: 'sp-1-2', name: '材質', value: 'SCS13A', unit: '' },
      { id: 'sp-1-3', name: '耐圧', value: '10', unit: 'K' },
      { id: 'sp-1-4', name: '電圧', value: '100', unit: 'V' }
    ],
    materials: [
      { part: '弁箱・弁体', value: 'SCS13A', condition: 'JIS B2002', note: null },
      { part: '弁棒 (ステム)', value: 'SUS304', condition: null, note: null },
      { part: 'シート (座)', value: 'PTFE (フッ素樹脂)', condition: null, note: '耐熱150℃' }
    ],
    accessories: [
      { name: '予備Oリング・パッキン一式', quantity: 1, unit: '組', note: 'FKM (バイトン製)' },
      { name: '手動開閉用六角ハンドル', quantity: 1, unit: '本', note: null }
    ],
    equipmentType: 'VA',
    diameter: '50A',
    material: 'SCS13A',
    createdAt: '2026-03-01',
    updatedAt: '2026-03-10'
  },
  {
    id: 'eq-02',
    projectId: 'prj-main',
    tagNo: '04-001',
    classification: '04',
    equipmentType: 'PU',
    name: '高圧渦巻ポンプユニット',
    quantity: 2,
    unit: '基',
    deliveryDate: '2026-06-20',
    isIssued: false,
    categoryId: 'cat-pump',
    deliveryLocation: '第2機械棟1F',
    notes: '全閉外扇屋内型モーター、共通ベース付',
    specs: [
      { id: 'sp-2-1', name: '出力', value: '7.5', unit: 'kW' },
      { id: 'sp-2-2', name: '口径', value: '80×50', unit: 'A' },
      { id: 'sp-2-3', name: '流量', value: '45', unit: 'm³/h' },
      { id: 'sp-2-4', name: '全揚程', value: '30', unit: 'm' },
      { id: 'sp-2-5', name: '材質', value: 'SUS304', unit: '' }
    ],
    materials: [
      { part: 'ケーシング', value: 'FC200', condition: 'JIS G5501', note: '外面防錆プライマー塗布' },
      { part: '羽根車 (インペラ)', value: 'CAC406 (青銅)', condition: null, note: null },
      { part: '主軸', value: 'SUS403', condition: null, note: null }
    ],
    accessories: [
      { name: '共通ベースプレート', quantity: 1, unit: '台', note: 'SS400製 溶融亜鉛めっき' },
      { name: 'カップリング＆保護カバー', quantity: 1, unit: '式', note: null },
      { name: '基礎ボルト・ナット', quantity: 4, unit: '本', note: 'M16×250L' }
    ],
    diameter: '80A×50A',
    material: 'SUS304',
    createdAt: '2026-03-02',
    updatedAt: '2026-03-02'
  },
  {
    id: 'eq-03',
    projectId: 'prj-main',
    tagNo: '08-001',
    classification: '08',
    equipmentType: 'TK',
    name: '特注撹拌受槽タンク（設計込）',
    quantity: 1,
    unit: '基',
    deliveryDate: '2026-07-30',
    isIssued: false,
    categoryId: 'cat-etc',
    deliveryLocation: '第1化学工場受入ヤード',
    notes: '詳細設計・強度計算書・製作図面作成一式含む',
    specs: [
      { id: 'sp-3-1', name: '容量', value: '3.0', unit: 'm³' },
      { id: 'sp-3-2', name: '材質', value: 'SUS316L', unit: '' },
      { id: 'sp-3-3', name: '設計圧力', value: '0.2', unit: 'MPa' }
    ],
    materials: [
      { part: '胴板・鏡板', value: 'SUS316L', condition: '板厚 6.0mm', note: '内面#400バフ研磨' },
      { part: '撹拌軸・撹拌翼', value: 'SUS316L', condition: null, note: 'パドル翼 2段' },
      { part: '架台・支持脚', value: 'SUS304', condition: null, note: null }
    ],
    accessories: [
      { name: '点検マンホール用予備パッキン', quantity: 2, unit: '枚', note: 'PTFE包みガスケット' },
      { name: '液面計 (ガラス管式)', quantity: 1, unit: '式', note: '目盛付・バルブ付' }
    ],
    diameter: '1500φ×2000H',
    material: 'SUS316L',
    createdAt: '2026-03-05',
    updatedAt: '2026-03-05'
  }
];
