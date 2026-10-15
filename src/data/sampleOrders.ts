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
  { id: 'cat-valve', name: 'バルブ・配管機器', color: 'blue' },
  { id: 'cat-pump', name: 'ポンプ・機械装置', color: 'emerald' },
  { id: 'cat-pipe', name: '継手・フランジ', color: 'amber' },
  { id: 'cat-etc', name: '未分類 / その他', color: 'slate' }
];

// Clean initial items: simple, realistic 2 items only, matching user's exact fields (機器名, 数量, 口径, 材質, 納期, 変更理由)
export const INITIAL_ITEMS: EquipmentItem[] = [
  {
    id: 'eq-01',
    projectId: 'prj-main',
    tagNo: 'V-101',
    name: 'ステンレス製電動ボール弁',
    quantity: 4,
    unit: '台',
    diameter: '50A (2B)',
    material: 'SCS13A (SUS304相当)',
    deliveryDate: '2026-05-15',
    categoryId: 'cat-valve',
    deliveryLocation: '第1化学工場受入ヤード',
    notes: 'JIS 10K フランジ接続、AC100V開閉アクチュエータ付',
    history: [
      {
        id: 'hist-01',
        itemId: 'eq-01',
        timestamp: '2026-03-10 10:00',
        author: '設計担当',
        field: 'material',
        fieldLabel: '材質',
        oldValue: 'FC200(鋳鉄)',
        newValue: 'SCS13A (SUS304相当)',
        reason: '腐食性流体対応のため材質をステンレスに変更'
      }
    ],
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
    diameter: '80A × 50A',
    material: 'SUS304',
    deliveryDate: '2026-06-20',
    categoryId: 'cat-pump',
    deliveryLocation: '第2機械棟1F',
    notes: '全閉外扇屋内型モーター 7.5kW、共通ベース付',
    history: [],
    createdAt: '2026-03-02',
    updatedAt: '2026-03-02'
  }
];
