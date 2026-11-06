import { EquipmentItem, ProjectWorkspace, Category } from '../types';

export const INITIAL_PROJECTS: ProjectWorkspace[] = [
  {
    id: 'prj-main',
    name: '第1期 プラント配管・機械調達案件',
    code: 'PRJ-2026-01',
    clientName: '〇〇化学工業株式会社',
    description: '工場配管更新に伴うバルブ・配管機器およびポンプ設備の調達',
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
    tagNo: 'V-101',
    name: 'ステンレス製電動ボール弁',
    quantity: 4,
    unit: '台',
    deliveryDate: '2026-05-15',
    categoryId: 'cat-valve',
    deliveryLocation: '第1化学工場受入ヤード',
    notes: 'JIS 10K フランジ接続、AC100V開閉アクチュエータ付',
    specs: [
      { id: 'sp-1-1', name: '口径', value: '50', unit: 'A' },
      { id: 'sp-1-2', name: '材質', value: 'SCS13A', unit: '' },
      { id: 'sp-1-3', name: '耐圧', value: '10', unit: 'K' },
      { id: 'sp-1-4', name: '電圧', value: '100', unit: 'V' }
    ],
    diameter: '50A',
    material: 'SCS13A',
    createdAt: '2026-03-01',
    updatedAt: '2026-03-10'
  },
  {
    id: 'eq-02',
    projectId: 'prj-main',
    tagNo: 'P-201',
    name: '高圧渦巻ポンプユニット',
    quantity: 2,
    unit: '基',
    deliveryDate: '2026-06-20',
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
    diameter: '80A×50A',
    material: 'SUS304',
    createdAt: '2026-03-02',
    updatedAt: '2026-03-02'
  }
];
