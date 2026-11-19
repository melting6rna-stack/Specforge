import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Header, AppTab } from './components/Header';
import { OrderDatabaseTab } from './components/OrderDatabaseTab';
import { SpecDashboardTab } from './components/SpecDashboardTab';
import { TemplateAdminTab } from './components/TemplateAdminTab';
import { ProjectSummaryTab } from './components/ProjectSummaryTab';
import { ItemEditModal } from './components/ItemEditModal';
import { ItemCreateModal } from './components/ItemCreateModal';
import { ChangeHistoryModal } from './components/ChangeHistoryModal';
import { PwaInstallGuideModal } from './components/PwaInstallGuideModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import {
  EquipmentItem,
  Category,
  SpecTemplate,
  ProjectWorkspace,
  ChangeLog,
  EquipmentClassification,
  SpecIssuanceRecord,
  SpecLedgerFile,
  TemplateFolderState,
} from './types';
import { placeItemWithResequence, resequenceProjectItems } from './utils/tagNumbering';
import { DEFAULT_TEMPLATES } from './data/defaultTemplates';
import { INITIAL_PROJECTS, INITIAL_CATEGORIES, INITIAL_ITEMS } from './data/sampleOrders';
import { parseEquipmentExcel } from './utils/excelTemplateParser';
import { normalizeSpecTemplate } from './utils/templateUtils';
import {
  saveTemplateFolderHandle,
  getSavedTemplateFolderHandle,
  removeSavedTemplateFolderHandle,
  saveCachedFolderTemplates,
  getCachedFolderTemplates,
  clearCachedFolderTemplates,
  scanDirectoryHandleForTemplates,
  loadTemplatesFromFileList,
  writeMappingToTemplateFolder,
  checkDirectoryHandlePermission,
} from './utils/templateFolderSync';
import { 
  DatabasePayload,
  PermissionRequiredError,
  FileMissingError,
  checkFileHandlePermission,
  requestFileHandlePermission,
  getFileHandleLastModified,
  saveFileHandleForProject,
  getSavedFileHandleForProject,
  removeSavedFileHandleForProject,
  readFromProjectHandle,
  writeToProjectHandle,
  normalizeEquipmentType
} from './utils/sharedSyncManager';
import {
  saveLedgerHandleForProject,
  getSavedLedgerHandleForProject,
  removeSavedLedgerHandleForProject,
  createEmptyLedgerPayload,
  normalizeLedgerJson,
  readLedgerFromHandle,
  writeLedgerToHandle,
} from './utils/ledgerSyncManager';
import {
  ConflictChoice,
  EquipmentConflict,
  LedgerConflict,
  mergeEquipmentDatabase,
  applyEquipmentConflictResolutions,
  mergeLedgerRecords,
  applyLedgerConflictResolutions,
} from './utils/mergeConflictUtils';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { Bell, AlertTriangle, RefreshCw, HardDrive, Save, Link2, GitMerge } from 'lucide-react';

function cloneSnapshot<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function hasMtimeChanged(diskMtime?: number | null, baseMtime?: number): boolean {
  if (!diskMtime || !baseMtime) return false;
  return Math.abs(diskMtime - baseMtime) > 50;
}

function sanitizeProjectsForStorage(list: ProjectWorkspace[]): ProjectWorkspace[] {
  return list.map(
    ({
      isLinkError,
      linkErrorMessage,
      needsLinkPermission,
      needsLedgerPermission,
      isLedgerLinkError,
      ledgerErrorMessage,
      ...rest
    }) => rest
  );
}

function ensureItemEquipmentTypes(list: EquipmentItem[]): EquipmentItem[] {
  return list.map(it => {
    const eqType = normalizeEquipmentType(it.equipmentType ?? it.rawTokki?.equipment_type ?? it.rawTokki?.equipmentType, 'PA');
    return {
      ...it,
      equipmentType: eqType,
      ...(it.rawTokki ? { rawTokki: { ...it.rawTokki, equipment_type: eqType } } : {})
    };
  });
}

export default function App() {
  // 1. Projects state (always clear transient runtime permission/error flags on load)
  const [projects, setProjects] = useState<ProjectWorkspace[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_projects_v2');
      if (saved) return sanitizeProjectsForStorage(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to parse saved projects', e);
    }
    return INITIAL_PROJECTS;
  });

  // Active Project ID: Persisted in localStorage so refreshing the page preserves the current active project!
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem('specforge_active_project_id');
      if (savedActive) {
        return savedActive;
      }
    } catch (e) {
      console.warn('Failed to parse active project id', e);
    }
    return projects[0]?.id || 'prj-main';
  });

  // Ensure activeProjectId is saved whenever it changes
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('specforge_active_project_id', activeProjectId);
    }
  }, [activeProjectId]);

  // 2. Categories state (each category is strictly scoped to a specific projectId)
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_categories_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved categories', e);
    }
    return INITIAL_CATEGORIES;
  });

  // Project-scoped categories: strictly returns ONLY the categories belonging to activeProjectId
  const projectCategories = useMemo(() => {
    const forCurrent = categories.filter(c => c.projectId === activeProjectId);
    if (forCurrent.length > 0) return forCurrent;

    // Default categories strictly created for this project workspace
    return [
      { id: `cat-${activeProjectId}-valve`, projectId: activeProjectId, name: 'バルブ・配管機器', color: 'blue' },
      { id: `cat-${activeProjectId}-pump`, projectId: activeProjectId, name: 'ポンプ・機械装置', color: 'emerald' },
      { id: `cat-${activeProjectId}-pipe`, projectId: activeProjectId, name: '継手・フランジ', color: 'amber' },
      { id: `cat-${activeProjectId}-etc`, projectId: activeProjectId, name: '未分類 / その他', color: 'slate' }
    ];
  }, [categories, activeProjectId]);

  // 3. Equipment Items state
  const [items, setItems] = useState<EquipmentItem[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_items_v2');
      if (saved) return ensureItemEquipmentTypes(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to parse saved items', e);
    }
    return ensureItemEquipmentTypes(INITIAL_ITEMS);
  });

  // 4. Templates state: keep local/preset templates in localStorage and folder templates in IndexedDB
  // so multiple Excel workbooks from an external folder never exceed localStorage's 5MB quota.
  const [localTemplates, setLocalTemplates] = useState<SpecTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_templates_v2');
      if (saved) {
        const parsed: SpecTemplate[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(t => t.sourceLocation !== 'folder')
            .map(normalizeSpecTemplate);
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved templates', e);
    }
    return DEFAULT_TEMPLATES.map(normalizeSpecTemplate);
  });

  const [folderTemplates, setFolderTemplates] = useState<SpecTemplate[]>([]);
  const [templateFolderState, setTemplateFolderState] = useState<TemplateFolderState | null>(null);
  const [isFolderTemplateSyncing, setIsFolderTemplateSyncing] = useState<boolean>(false);
  const templateFolderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const templates = useMemo(() => {
    const folderIds = new Set(folderTemplates.map(t => t.id));
    return [...folderTemplates, ...localTemplates.filter(t => !folderIds.has(t.id))];
  }, [folderTemplates, localTemplates]);

  // Persist only local/preset templates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'specforge_templates_v2',
        JSON.stringify(localTemplates.filter(t => t.sourceLocation !== 'folder'))
      );
    } catch (e) {
      console.warn('Failed to save templates to localStorage', e);
    }
  }, [localTemplates]);

  // Specification Issuance Ledger JSON state (strictly separate from Equipment DB!)
  const [specLedgers, setSpecLedgers] = useState<Record<string, SpecLedgerFile>>(() => {
    try {
      const saved = localStorage.getItem('specforge_ledgers_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved spec ledgers', e);
    }
    return {};
  });
  const [isLedgerSyncing, setIsLedgerSyncing] = useState<boolean>(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string>('');

  // Unsaved changes tracking (for manual save & preventing data loss on page leave)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSavingJson, setIsSavingJson] = useState<boolean>(false);

  // Tab State (Initial Creation & Revision are separate tabs)
  const [activeTab, setActiveTab] = useState<AppTab>('database');
  const [lastSpecTab, setLastSpecTab] = useState<'spec_initial' | 'spec_revision'>('spec_initial');
  const [adminInitialTemplateId, setAdminInitialTemplateId] = useState<string>('');

  const handleTabChange = useCallback((nextTab: AppTab) => {
    if (nextTab === 'spec_initial' || nextTab === 'spec_revision') {
      setLastSpecTab(nextTab);
    }
    setActiveTab(nextTab);
  }, []);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);

  // Unsaved changes confirmation modal state
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [unsavedModalReason, setUnsavedModalReason] = useState<'exit' | 'switch-project' | 'manual'>('manual');
  const [pendingNextProjectId, setPendingNextProjectId] = useState<string | null>(null);

  // PWA Install prompt state
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState(false);

  // Active Project's File Handles (Equipment DB & Issuance Ledger kept strictly separate)
  const activeFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const activeLedgerHandleRef = useRef<FileSystemFileHandle | null>(null);

  // Live state refs to avoid stale closures in async merge/persist handlers
  const itemsRef = useRef<EquipmentItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const categoriesRef = useRef<Category[]>(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const projectsRef = useRef<ProjectWorkspace[]>(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const specLedgersRef = useRef<Record<string, SpecLedgerFile>>(specLedgers);
  useEffect(() => {
    specLedgersRef.current = specLedgers;
  }, [specLedgers]);

  const templatesRef = useRef<SpecTemplate[]>(templates);
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  const hasUnsavedChangesRef = useRef<boolean>(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Concurrency & 3-way merge baseline snapshots per project
  const dbBaseStateRef = useRef<
    Record<string, { items: EquipmentItem[]; categories: Category[]; lastModified: number }>
  >({});
  const ledgerBaseStateRef = useRef<
    Record<string, { records: SpecIssuanceRecord[]; lastModified: number }>
  >({});
  const isBusySyncingOrWritingRef = useRef<boolean>(false);

  const setDbBaseSnapshot = useCallback(
    (projectId: string, projectItems: EquipmentItem[], projectCats: Category[], lastModified: number) => {
      dbBaseStateRef.current[projectId] = {
        items: cloneSnapshot(projectItems),
        categories: cloneSnapshot(projectCats),
        lastModified,
      };
    },
    []
  );

  const setLedgerBaseSnapshot = useCallback(
    (projectId: string, records: SpecIssuanceRecord[], lastModified: number) => {
      ledgerBaseStateRef.current[projectId] = {
        records: cloneSnapshot(records),
        lastModified,
      };
    },
    []
  );

  // Remote file update notifications & conflict resolution modal state
  const [remoteUpdates, setRemoteUpdates] = useState<
    Record<string, { dbUpdated?: boolean; ledgerUpdated?: boolean }>
  >({});

  const clearRemoteUpdateFlag = useCallback(
    (projectId: string, kind: 'db' | 'ledger') => {
      setRemoteUpdates(prev => {
        const cur = prev[projectId];
        if (!cur) return prev;
        if (kind === 'db' && !cur.dbUpdated) return prev;
        if (kind === 'ledger' && !cur.ledgerUpdated) return prev;
        return {
          ...prev,
          [projectId]: {
            ...cur,
            ...(kind === 'db' ? { dbUpdated: false } : { ledgerUpdated: false }),
          },
        };
      });
    },
    []
  );

  const [conflictModalState, setConflictModalState] = useState<{
    isOpen: boolean;
    type: 'equipment' | 'ledger';
    projectId: string;
    fileName?: string;
    autoMergedInfoText?: string;
    isResolving?: boolean;
    equipment?: {
      autoMergedItems: EquipmentItem[];
      autoMergedCategories: Category[];
      conflicts: EquipmentConflict[];
      diskLastModified: number;
      diskSchemaType?: 'tokki-equipment' | 'specforge-v2' | 'generic';
      diskRawDocument?: any;
      saveAfterResolve?: boolean;
    };
    ledger?: {
      autoMergedRecords: SpecIssuanceRecord[];
      conflicts: LedgerConflict[];
      diskLastModified: number;
      saveAfterResolve?: boolean;
      pendingResolve?: (res: { savedToDisk: boolean; needsPermission?: boolean }) => void;
    };
  }>({
    isOpen: false,
    type: 'equipment',
    projectId: '',
  });

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activeLedger = specLedgers[activeProjectId];
  const activeLedgerRecords = useMemo(() => activeLedger?.records || [], [activeLedger]);

  // Prevent data loss: Native browser confirmation modal on close / reload / navigate away
  useEffect(() => {
    let cancelTimer: any = null;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '未保存の変更があります。ページを離れますか？';

        // When user clicks [Cancel] on the browser prompt to remain on the page,
        // this timeout fires right after the dialog closes, popping up the in-app save modal!
        cancelTimer = setTimeout(() => {
          setUnsavedModalReason('exit');
          setIsUnsavedModalOpen(true);
        }, 200);

        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (cancelTimer) clearTimeout(cancelTimer);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredInstallPrompt(null);
          return;
        }
      } catch (e) {
        // Fallback to guide
      }
    }
    setIsPwaGuideOpen(true);
  };

  // Local storage persistence (Local-first & offline resilient)
  // Strip transient runtime flags so reload/new windows don't inherit stale error states
  useEffect(() => {
    localStorage.setItem('specforge_projects_v2', JSON.stringify(sanitizeProjectsForStorage(projects)));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('specforge_categories_v3', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('specforge_items_v2', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem('specforge_ledgers_v1', JSON.stringify(specLedgers));
    } catch (e) {
      console.warn('Failed to save spec ledgers to localStorage', e);
    }
  }, [specLedgers]);

  // Cross-window synchronization via storage events (keeps multiple open windows in sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        if (e.key === 'specforge_projects_v2') {
          const incoming = sanitizeProjectsForStorage(JSON.parse(e.newValue));
          setProjects(prev => incoming.map(inc => {
            const existing = prev.find(p => p.id === inc.id);
            return existing ? {
              ...inc,
              needsLinkPermission: existing.needsLinkPermission,
              isLinkError: existing.isLinkError,
              linkErrorMessage: existing.linkErrorMessage,
              needsLedgerPermission: existing.needsLedgerPermission,
              isLedgerLinkError: existing.isLedgerLinkError,
              ledgerErrorMessage: existing.ledgerErrorMessage,
            } : inc;
          }));
        } else if (e.key === 'specforge_items_v2') {
          setItems(ensureItemEquipmentTypes(JSON.parse(e.newValue)));
        } else if (e.key === 'specforge_categories_v3') {
          setCategories(JSON.parse(e.newValue));
        } else if (e.key === 'specforge_templates_v2') {
          const parsed: SpecTemplate[] = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setLocalTemplates(parsed.filter(t => t.sourceLocation !== 'folder').map(normalizeSpecTemplate));
          }
        } else if (e.key === 'specforge_ledgers_v1') {
          setSpecLedgers(JSON.parse(e.newValue));
        }
      } catch (err) {
        console.warn('Failed to sync storage event across windows', err);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load active project file handle from IndexedDB when activeProjectId changes
  useEffect(() => {
    let isCancelled = false;

    async function loadProjectHandle() {
      activeFileHandleRef.current = null;
      if (!activeProjectId) return;
      const handle = await getSavedFileHandleForProject(activeProjectId);
      if (isCancelled) return;
      activeFileHandleRef.current = handle;

      if (handle) {
        try {
          // Never requestPermission automatically without user gesture on mount/reload/new window
          const { payload, fileName, lastModified } = await readFromProjectHandle(
            handle, 
            activeProjectId, 
            `cat-${activeProjectId}-etc`,
            { allowPromptRequest: false }
          );
          if (isCancelled) return;

          let scopedCats = categoriesRef.current.filter(c => c.projectId === activeProjectId);
          // Scope categories strictly for this project
          if (payload.categories && payload.categories.length > 0) {
            scopedCats = payload.categories.map(c => ({
              ...c,
              projectId: activeProjectId
            }));
            setCategories(prev => {
              const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== activeProjectId);
              return [...otherProjectsCats, ...scopedCats];
            });
          }

          // Merge loaded items for this project
          if (payload.items && payload.items.length > 0) {
            setItems(prev => {
              const otherItems = prev.filter(it => it.projectId !== activeProjectId);
              return [...otherItems, ...payload.items];
            });
          }

          setDbBaseSnapshot(activeProjectId, payload.items || [], scopedCats, lastModified);
          clearRemoteUpdateFlag(activeProjectId, 'db');

          // Mark project as healthy and record schemaType
          setProjects(prev => prev.map(p => {
            if (p.id === activeProjectId) {
              return {
                ...p,
                linkedJsonFileName: fileName || p.linkedJsonFileName,
                needsLinkPermission: false,
                isLinkError: false,
                linkErrorMessage: undefined,
                schemaType: payload.schemaType || p.schemaType,
                rawDocument: payload.rawDocument || p.rawDocument,
                linkedJsonLastSync: new Date().toLocaleTimeString('ja-JP')
              };
            }
            return p;
          }));
          setHasUnsavedChanges(false);
        } catch (err: any) {
          if (isCancelled) return;
          if (err instanceof PermissionRequiredError) {
            // Link IS preserved in IndexedDB! Browser simply reset runtime permission to 'prompt' on reload/new window.
            setProjects(prev => prev.map(p => {
              if (p.id === activeProjectId) {
                return {
                  ...p,
                  linkedJsonFileName: handle.name || p.linkedJsonFileName,
                  needsLinkPermission: true,
                  isLinkError: false,
                  linkErrorMessage: undefined
                };
              }
              return p;
            }));
          } else {
            console.warn('Failed to read from linked JSON file for project', activeProjectId, err);
            setProjects(prev => prev.map(p => {
              if (p.id === activeProjectId) {
                return {
                  ...p,
                  needsLinkPermission: false,
                  isLinkError: true,
                  linkErrorMessage: err.message || '紐づけ元のJSONファイルが見つかりません。'
                };
              }
              return p;
            }));
          }
        }
      } else {
        // No handle in IndexedDB for this projectId
        setProjects(prev => prev.map(p => {
          if (p.id === activeProjectId && p.linkedJsonFileName) {
            return {
              ...p,
              needsLinkPermission: false,
              isLinkError: true,
              linkErrorMessage: `このブラウザ環境には「${p.linkedJsonFileName}」のファイル参照が保持されていません。「ファイルの再指定」からJSONファイルを選択してください。`
            };
          }
          return p;
        }));
      }
    }

    loadProjectHandle();

    return () => {
      isCancelled = true;
    };
  }, [activeProjectId, clearRemoteUpdateFlag, setDbBaseSnapshot]);

  // Load active project Specification Issuance Ledger handle from IndexedDB when activeProjectId changes
  useEffect(() => {
    let isCancelled = false;

    async function loadLedgerHandle() {
      activeLedgerHandleRef.current = null;
      if (!activeProjectId) return;
      const handle = await getSavedLedgerHandleForProject(activeProjectId);
      if (isCancelled) return;
      activeLedgerHandleRef.current = handle;

      if (handle) {
        try {
          const prj = projectsRef.current.find(p => p.id === activeProjectId);
          const { ledger, fileName, lastModified } = await readLedgerFromHandle(
            handle,
            activeProjectId,
            prj,
            { allowPromptRequest: false }
          );
          if (isCancelled) return;

          setSpecLedgers(prev => ({
            ...prev,
            [activeProjectId]: ledger,
          }));
          setLedgerBaseSnapshot(activeProjectId, ledger.records, lastModified);
          clearRemoteUpdateFlag(activeProjectId, 'ledger');

          setProjects(prev => prev.map(p => p.id === activeProjectId ? {
            ...p,
            linkedLedgerFileName: fileName || p.linkedLedgerFileName,
            linkedLedgerLastSync: new Date().toLocaleTimeString('ja-JP'),
            needsLedgerPermission: false,
            isLedgerLinkError: false,
            ledgerErrorMessage: undefined,
          } : p));
        } catch (err: any) {
          if (isCancelled) return;
          if (err instanceof PermissionRequiredError) {
            setProjects(prev => prev.map(p => p.id === activeProjectId ? {
              ...p,
              linkedLedgerFileName: handle.name || p.linkedLedgerFileName,
              needsLedgerPermission: true,
              isLedgerLinkError: false,
              ledgerErrorMessage: undefined,
            } : p));
          } else {
            console.warn('Failed to read from linked ledger JSON for project', activeProjectId, err);
            setProjects(prev => prev.map(p => p.id === activeProjectId ? {
              ...p,
              needsLedgerPermission: false,
              isLedgerLinkError: true,
              ledgerErrorMessage: err.message || '紐づけ元の発行台帳JSONファイルが見つかりません。',
            } : p));
          }
        }
      } else {
        setProjects(prev => prev.map(p => {
          if (p.id === activeProjectId && p.linkedLedgerFileName) {
            return {
              ...p,
              needsLedgerPermission: false,
              isLedgerLinkError: true,
              ledgerErrorMessage: `このブラウザ環境には発行台帳JSON「${p.linkedLedgerFileName}」の参照が保持されていません。「別台帳を指定」から再紐づけしてください。`,
            };
          }
          return p;
        }));
      }
    }

    loadLedgerHandle();

    return () => {
      isCancelled = true;
    };
  }, [activeProjectId, clearRemoteUpdateFlag, setLedgerBaseSnapshot]);

  // Load saved external Template Reference Folder handle + cache on mount
  useEffect(() => {
    let isCancelled = false;

    async function loadTemplateFolderOnMount() {
      const cached = await getCachedFolderTemplates();
      const handle = await getSavedTemplateFolderHandle();
      if (isCancelled) return;
      templateFolderHandleRef.current = handle;

      if (cached && cached.templates.length > 0) {
        setFolderTemplates(cached.templates.map(normalizeSpecTemplate));
      }

      if (handle) {
        try {
          const scanned = await scanDirectoryHandleForTemplates(handle, { allowPromptRequest: false });
          if (isCancelled) return;
          const nowStr = new Date().toLocaleTimeString('ja-JP');
          setFolderTemplates(scanned.templates);
          setTemplateFolderState({
            folderName: scanned.folderName,
            lastSyncAt: nowStr,
            needsPermission: false,
            isError: false,
            excelCount: scanned.stats.excelCount,
            mappingCount: scanned.stats.mappingCount,
            pairedCount: scanned.stats.pairedCount,
            mode: 'handle',
          });
          await saveCachedFolderTemplates({
            folderName: scanned.folderName,
            mode: 'handle',
            lastSyncAt: nowStr,
            stats: scanned.stats,
            templates: scanned.templates,
          });
        } catch (err: any) {
          if (isCancelled) return;
          if (err instanceof PermissionRequiredError) {
            setTemplateFolderState({
              folderName: handle.name || cached?.folderName || '参照元フォルダ',
              lastSyncAt: cached?.lastSyncAt,
              needsPermission: true,
              isError: false,
              excelCount: cached?.stats.excelCount ?? 0,
              mappingCount: cached?.stats.mappingCount ?? 0,
              pairedCount: cached?.stats.pairedCount ?? 0,
              mode: 'handle',
            });
          } else {
            setTemplateFolderState({
              folderName: handle.name || cached?.folderName || '参照元フォルダ',
              lastSyncAt: cached?.lastSyncAt,
              needsPermission: false,
              isError: true,
              errorMessage: err?.message || '参照元フォルダの読み込みに失敗しました。',
              excelCount: cached?.stats.excelCount ?? 0,
              mappingCount: cached?.stats.mappingCount ?? 0,
              pairedCount: cached?.stats.pairedCount ?? 0,
              mode: 'handle',
            });
          }
        }
      } else if (cached) {
        setTemplateFolderState({
          folderName: cached.folderName,
          lastSyncAt: cached.lastSyncAt,
          needsPermission: false,
          isError: false,
          excelCount: cached.stats.excelCount,
          mappingCount: cached.stats.mappingCount,
          pairedCount: cached.stats.pairedCount,
          mode: cached.mode,
        });
      }
    }

    loadTemplateFolderOnMount();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Silent check for external updates on shared JSON files (on window focus & periodic polling)
  const checkRemoteUpdates = useCallback(async () => {
    if (!activeProjectId || isBusySyncingOrWritingRef.current) return;

    let nextDbUpdated = false;
    let nextLedgerUpdated = false;

    const dbHandle = activeFileHandleRef.current;
    const dbBase = dbBaseStateRef.current[activeProjectId];
    if (dbHandle && dbBase?.lastModified) {
      const diskMtime = await getFileHandleLastModified(dbHandle);
      if (hasMtimeChanged(diskMtime, dbBase.lastModified)) {
        nextDbUpdated = true;
      }
    }

    const ledgerHandle = activeLedgerHandleRef.current;
    const ledgerBase = ledgerBaseStateRef.current[activeProjectId];
    if (ledgerHandle && ledgerBase?.lastModified) {
      const ledgerDiskMtime = await getFileHandleLastModified(ledgerHandle);
      if (hasMtimeChanged(ledgerDiskMtime, ledgerBase.lastModified)) {
        nextLedgerUpdated = true;
      }
    }

    setRemoteUpdates(prev => {
      const cur = prev[activeProjectId] || {};
      if (Boolean(cur.dbUpdated) === nextDbUpdated && Boolean(cur.ledgerUpdated) === nextLedgerUpdated) {
        return prev;
      }
      return {
        ...prev,
        [activeProjectId]: {
          dbUpdated: nextDbUpdated,
          ledgerUpdated: nextLedgerUpdated,
        },
      };
    });
  }, [activeProjectId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkRemoteUpdates();
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [checkRemoteUpdates]);

  // Re-check permission & remote changes silently when window regains focus
  useEffect(() => {
    const handleWindowFocus = async () => {
      if (!activeProjectId) return;
      const prj = projectsRef.current.find(p => p.id === activeProjectId);

      // Check Equipment DB JSON handle
      const handle = activeFileHandleRef.current;
      if (handle && prj?.needsLinkPermission) {
        const perm = await checkFileHandlePermission(handle, 'read');
        if (perm === 'granted') {
          try {
            const { payload, fileName, lastModified } = await readFromProjectHandle(
              handle,
              activeProjectId,
              `cat-${activeProjectId}-etc`,
              { allowPromptRequest: false }
            );
            if (!hasUnsavedChangesRef.current && payload.items && payload.items.length > 0) {
              setItems(prev => {
                const otherItems = prev.filter(it => it.projectId !== activeProjectId);
                return [...otherItems, ...payload.items];
              });
              const scopedCats = payload.categories?.length
                ? payload.categories.map(c => ({ ...c, projectId: activeProjectId }))
                : categoriesRef.current.filter(c => c.projectId === activeProjectId);
              setDbBaseSnapshot(activeProjectId, payload.items, scopedCats, lastModified);
            }
            setProjects(prev => prev.map(p => p.id === activeProjectId ? {
              ...p,
              linkedJsonFileName: fileName || p.linkedJsonFileName,
              needsLinkPermission: false,
              isLinkError: false,
              linkErrorMessage: undefined,
              linkedJsonLastSync: new Date().toLocaleTimeString('ja-JP')
            } : p));
          } catch {
            // ignore silent focus check errors
          }
        }
      }

      // Check Issuance Ledger JSON handle
      const ledgerHandle = activeLedgerHandleRef.current;
      if (ledgerHandle && prj?.needsLedgerPermission) {
        const perm = await checkFileHandlePermission(ledgerHandle, 'read');
        if (perm === 'granted') {
          try {
            const { ledger, fileName, lastModified } = await readLedgerFromHandle(
              ledgerHandle,
              activeProjectId,
              prj,
              { allowPromptRequest: false }
            );
            setSpecLedgers(prev => ({
              ...prev,
              [activeProjectId]: ledger,
            }));
            setLedgerBaseSnapshot(activeProjectId, ledger.records, lastModified);
            setProjects(prev => prev.map(p => p.id === activeProjectId ? {
              ...p,
              linkedLedgerFileName: fileName || p.linkedLedgerFileName,
              needsLedgerPermission: false,
              isLedgerLinkError: false,
              ledgerErrorMessage: undefined,
              linkedLedgerLastSync: new Date().toLocaleTimeString('ja-JP'),
            } : p));
          } catch {
            // ignore silent focus check errors
          }
        }
      }

      void checkRemoteUpdates();

      // Silently re-check template folder permission on focus
      const tplDirHandle = templateFolderHandleRef.current;
      if (tplDirHandle) {
        const perm = await checkDirectoryHandlePermission(tplDirHandle, 'read');
        if (perm === 'granted') {
          try {
            const scanned = await scanDirectoryHandleForTemplates(tplDirHandle, { allowPromptRequest: false });
            const nowStr = new Date().toLocaleTimeString('ja-JP');
            setFolderTemplates(scanned.templates);
            setTemplateFolderState({
              folderName: scanned.folderName,
              lastSyncAt: nowStr,
              needsPermission: false,
              isError: false,
              excelCount: scanned.stats.excelCount,
              mappingCount: scanned.stats.mappingCount,
              pairedCount: scanned.stats.pairedCount,
              mode: 'handle',
            });
          } catch {
            // ignore silent refresh error
          }
        }
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [activeProjectId, checkRemoteUpdates, setDbBaseSnapshot, setLedgerBaseSnapshot]);

  // Reference folder registration & sync handlers
  const handleSelectTemplateFolder = useCallback(async (): Promise<{
    selected: boolean;
    fallbackToInput?: boolean;
    errorMessage?: string;
  }> => {
    if (!('showDirectoryPicker' in window)) {
      return { selected: false, fallbackToInput: true };
    }
    try {
      setIsFolderTemplateSyncing(true);
      let dirHandle: FileSystemDirectoryHandle;
      try {
        dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { selected: false };
        }
        if (err?.name === 'SecurityError') {
          // Cross-origin iframe may block readwrite or showDirectoryPicker; fallback to input[webkitdirectory]
          return { selected: false, fallbackToInput: true };
        }
        // Fallback to read-only picker if readwrite failed for other reasons
        dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      }

      templateFolderHandleRef.current = dirHandle;
      await saveTemplateFolderHandle(dirHandle);

      const scanned = await scanDirectoryHandleForTemplates(dirHandle, { allowPromptRequest: true });
      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setFolderTemplates(scanned.templates);
      setTemplateFolderState({
        folderName: scanned.folderName,
        lastSyncAt: nowStr,
        needsPermission: false,
        isError: false,
        excelCount: scanned.stats.excelCount,
        mappingCount: scanned.stats.mappingCount,
        pairedCount: scanned.stats.pairedCount,
        mode: 'handle',
      });
      await saveCachedFolderTemplates({
        folderName: scanned.folderName,
        mode: 'handle',
        lastSyncAt: nowStr,
        stats: scanned.stats,
        templates: scanned.templates,
      });

      setSyncNotice(
        `参照元フォルダ「${scanned.folderName}」を登録しました（Excel ${scanned.stats.excelCount}件 / 自動ペアリング ${scanned.stats.pairedCount}件）。`
      );
      setTimeout(() => setSyncNotice(''), 5000);
      return { selected: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { selected: false };
      }
      if (err?.name === 'SecurityError' || err?.message?.toLowerCase().includes('cross origin')) {
        return { selected: false, fallbackToInput: true };
      }
      return {
        selected: false,
        errorMessage: err?.message || '参照元フォルダの登録に失敗しました。',
      };
    } finally {
      setIsFolderTemplateSyncing(false);
    }
  }, []);

  const handleImportTemplateFolderFiles = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;
    setIsFolderTemplateSyncing(true);
    try {
      templateFolderHandleRef.current = null;
      await removeSavedTemplateFolderHandle();

      const scanned = await loadTemplatesFromFileList(files);
      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setFolderTemplates(scanned.templates);
      setTemplateFolderState({
        folderName: scanned.folderName,
        lastSyncAt: nowStr,
        needsPermission: false,
        isError: false,
        excelCount: scanned.stats.excelCount,
        mappingCount: scanned.stats.mappingCount,
        pairedCount: scanned.stats.pairedCount,
        mode: 'upload_cache',
      });
      await saveCachedFolderTemplates({
        folderName: scanned.folderName,
        mode: 'upload_cache',
        lastSyncAt: nowStr,
        stats: scanned.stats,
        templates: scanned.templates,
      });

      setSyncNotice(
        `フォルダ「${scanned.folderName}」からテンプレートを取り込みました（Excel ${scanned.stats.excelCount}件 / 自動ペアリング ${scanned.stats.pairedCount}件）。`
      );
      setTimeout(() => setSyncNotice(''), 5000);
    } finally {
      setIsFolderTemplateSyncing(false);
    }
  }, []);

  const handleSyncTemplateFolder = useCallback(async () => {
    const handle = templateFolderHandleRef.current || (await getSavedTemplateFolderHandle());
    if (!handle) return;
    templateFolderHandleRef.current = handle;
    setIsFolderTemplateSyncing(true);
    try {
      const scanned = await scanDirectoryHandleForTemplates(handle, { allowPromptRequest: true });
      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setFolderTemplates(scanned.templates);
      setTemplateFolderState({
        folderName: scanned.folderName,
        lastSyncAt: nowStr,
        needsPermission: false,
        isError: false,
        excelCount: scanned.stats.excelCount,
        mappingCount: scanned.stats.mappingCount,
        pairedCount: scanned.stats.pairedCount,
        mode: 'handle',
      });
      await saveCachedFolderTemplates({
        folderName: scanned.folderName,
        mode: 'handle',
        lastSyncAt: nowStr,
        stats: scanned.stats,
        templates: scanned.templates,
      });
      setSyncNotice(
        `参照元フォルダ「${scanned.folderName}」を再読込しました（Excel ${scanned.stats.excelCount}件 / ペアリング ${scanned.stats.pairedCount}件）。`
      );
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err: any) {
      setTemplateFolderState(prev =>
        prev
          ? {
              ...prev,
              needsPermission: err instanceof PermissionRequiredError,
              isError: !(err instanceof PermissionRequiredError),
              errorMessage: err instanceof PermissionRequiredError ? undefined : err?.message,
            }
          : null
      );
    } finally {
      setIsFolderTemplateSyncing(false);
    }
  }, []);

  const handleClearTemplateFolder = useCallback(async () => {
    templateFolderHandleRef.current = null;
    await removeSavedTemplateFolderHandle();
    await clearCachedFolderTemplates();
    setFolderTemplates([]);
    setTemplateFolderState(null);
    setSyncNotice('参照元フォルダの登録を解除しました。');
    setTimeout(() => setSyncNotice(''), 4000);
  }, []);

  const handleSaveTemplateMappingToFolder = useCallback(
    async (tpl: SpecTemplate): Promise<{ writtenToFolder: boolean; fileName: string; message?: string }> => {
      const handle = templateFolderHandleRef.current || (await getSavedTemplateFolderHandle());
      if (!handle) {
        return {
          writtenToFolder: false,
          fileName: '',
          message: 'フォルダ書き込みハンドルが利用できないため、ブラウザ内キャッシュへ保存しました。',
        };
      }
      const { fileName } = await writeMappingToTemplateFolder(handle, tpl, { allowPromptRequest: true });
      setFolderTemplates(prev => {
        const next = prev.map(t =>
          t.id === tpl.id
            ? {
                ...tpl,
                mappingFileName: fileName,
                hasPairedMappingFile: true,
              }
            : t
        );
        if (templateFolderState) {
          void saveCachedFolderTemplates({
            folderName: templateFolderState.folderName,
            mode: templateFolderState.mode,
            lastSyncAt: new Date().toLocaleTimeString('ja-JP'),
            stats: {
              excelCount: templateFolderState.excelCount,
              mappingCount: templateFolderState.mappingCount,
              pairedCount: next.filter(x => x.hasPairedMappingFile).length,
            },
            templates: next,
          });
        }
        return next;
      });
      return { writtenToFolder: true, fileName };
    },
    [templateFolderState]
  );

  const handleUpdateAllTemplates = useCallback(
    (updated: SpecTemplate[]) => {
      const nextFolder = updated.filter(t => t.sourceLocation === 'folder').map(normalizeSpecTemplate);
      const nextLocal = updated.filter(t => t.sourceLocation !== 'folder').map(normalizeSpecTemplate);
      setFolderTemplates(nextFolder);
      setLocalTemplates(nextLocal);

      if (templateFolderState) {
        void saveCachedFolderTemplates({
          folderName: templateFolderState.folderName,
          mode: templateFolderState.mode,
          lastSyncAt: templateFolderState.lastSyncAt || new Date().toLocaleTimeString('ja-JP'),
          stats: {
            excelCount: templateFolderState.excelCount,
            mappingCount: templateFolderState.mappingCount,
            pairedCount: nextFolder.filter(x => x.hasPairedMappingFile).length,
          },
          templates: nextFolder,
        });
      }
    },
    [templateFolderState]
  );

  // Helper to persist active project's items & categories to its linked JSON file handle with 3-way merge protection
  const persistItemsToLinkedJson = useCallback(async (
    targetProjectId: string, 
    updatedItemsForProject: EquipmentItem[],
    customCategories?: Category[],
    options?: { allowPromptRequest?: boolean; throwOnError?: boolean }
  ): Promise<boolean> => {
    let handle = targetProjectId === activeProjectId ? activeFileHandleRef.current : null;
    if (!handle) {
      handle = await getSavedFileHandleForProject(targetProjectId);
      if (targetProjectId === activeProjectId) {
        activeFileHandleRef.current = handle;
      }
    }

    if (!handle) return false;

    isBusySyncingOrWritingRef.current = true;
    try {
      const prj = projectsRef.current.find(p => p.id === targetProjectId) || currentProject;
      const targetCats = customCategories || categoriesRef.current.filter(c => c.projectId === targetProjectId);
      const catsToSave = targetCats.length > 0 ? targetCats : projectCategories;

      const base = dbBaseStateRef.current[targetProjectId];
      const diskMtime = await getFileHandleLastModified(handle);

      let itemsToWrite = updatedItemsForProject;
      let catsToWrite = catsToSave;
      let effectiveSchemaType = prj?.schemaType;
      let effectiveRawDocument = prj?.rawDocument;
      let mergeNoticeMsg = '';

      // Conflict detection: check if another user updated the JSON on disk since our baseline
      if (base && hasMtimeChanged(diskMtime, base.lastModified)) {
        const latest = await readFromProjectHandle(
          handle,
          targetProjectId,
          `cat-${targetProjectId}-etc`,
          { allowPromptRequest: options?.allowPromptRequest ?? false }
        );

        if (hasMtimeChanged(latest.lastModified, base.lastModified)) {
          const diskCats = (latest.payload.categories || []).map(c => ({
            ...c,
            projectId: targetProjectId,
          }));
          const mergeRes = mergeEquipmentDatabase(
            base.items,
            latest.payload.items || [],
            updatedItemsForProject,
            base.categories,
            diskCats,
            catsToSave
          );

          effectiveSchemaType = latest.payload.schemaType || prj?.schemaType;
          effectiveRawDocument = latest.payload.rawDocument || prj?.rawDocument;

          const autoCount =
            mergeRes.autoMergedSummary.addedFromDisk +
            mergeRes.autoMergedSummary.updatedFromDisk +
            mergeRes.autoMergedSummary.deletedFromDisk;

          if (mergeRes.conflicts.length > 0) {
            const autoInfo =
              autoCount > 0
                ? `他ユーザーによる別機器/別項目の更新（${autoCount}件）は自動で統合済みです。競合した${mergeRes.conflicts.length}箇所のみ選択してください。`
                : `競合した${mergeRes.conflicts.length}箇所について採用する値を選択してください。`;

            setConflictModalState({
              isOpen: true,
              type: 'equipment',
              projectId: targetProjectId,
              fileName: latest.fileName,
              autoMergedInfoText: autoInfo,
              equipment: {
                autoMergedItems: mergeRes.mergedItems,
                autoMergedCategories: mergeRes.mergedCategories,
                conflicts: mergeRes.conflicts,
                diskLastModified: latest.lastModified,
                diskSchemaType: effectiveSchemaType,
                diskRawDocument: effectiveRawDocument,
                saveAfterResolve: true,
              },
            });
            return false;
          }

          // Zero conflicts -> auto-merge succeeded cleanly!
          itemsToWrite = mergeRes.mergedItems;
          catsToWrite = mergeRes.mergedCategories.length > 0 ? mergeRes.mergedCategories : catsToSave;

          setItems(prev => {
            const otherItems = prev.filter(it => it.projectId !== targetProjectId);
            const nextAll = [...otherItems, ...itemsToWrite];
            itemsRef.current = nextAll;
            return nextAll;
          });
          setCategories(prev => {
            const otherCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
            const nextCatsAll = [...otherCats, ...catsToWrite];
            categoriesRef.current = nextCatsAll;
            return nextCatsAll;
          });

          if (autoCount > 0) {
            mergeNoticeMsg = `他ユーザーの最新更新（${autoCount}件）と自動マージしてJSONへ保存しました。`;
          }
        }
      }

      const payload: DatabasePayload = {
        version: effectiveSchemaType === 'tokki-equipment' ? '1.1' : '2.0',
        lastUpdated: new Date().toISOString(),
        items: itemsToWrite,
        categories: catsToWrite,
        templates: templatesRef.current,
        schemaType: effectiveSchemaType,
        rawDocument: effectiveRawDocument,
      };

      const newLastModified = await writeToProjectHandle(handle, payload, effectiveSchemaType, prj, {
        allowPromptRequest: options?.allowPromptRequest ?? false
      });

      setDbBaseSnapshot(targetProjectId, itemsToWrite, catsToWrite, newLastModified);
      clearRemoteUpdateFlag(targetProjectId, 'db');

      const nowTime = new Date().toLocaleTimeString('ja-JP');
      setProjects(prev => prev.map(p => {
        if (p.id === targetProjectId) {
          return {
            ...p,
            schemaType: effectiveSchemaType || p.schemaType,
            rawDocument: effectiveRawDocument || p.rawDocument,
            needsLinkPermission: false,
            isLinkError: false,
            linkErrorMessage: undefined,
            linkedJsonLastSync: nowTime
          };
        }
        return p;
      }));

      if (mergeNoticeMsg) {
        setSyncNotice(mergeNoticeMsg);
        setTimeout(() => setSyncNotice(''), 6000);
      }
      return true;
    } catch (err: any) {
      if (err instanceof PermissionRequiredError) {
        // Keep link intact; mark as needing user permission click instead of showing File Not Found error
        setProjects(prev => prev.map(p => {
          if (p.id === targetProjectId) {
            return {
              ...p,
              needsLinkPermission: true,
              isLinkError: false,
              linkErrorMessage: undefined
            };
          }
          return p;
        }));
        if (options?.throwOnError) throw err;
        return false;
      }

      console.warn('Failed writing back to linked JSON file:', err);
      setProjects(prev => prev.map(p => {
        if (p.id === targetProjectId) {
          return {
            ...p,
            needsLinkPermission: false,
            isLinkError: true,
            linkErrorMessage: err.message || 'JSONファイルへの書き込みに失敗しました。ファイルが移動または削除された可能性があります。'
          };
        }
        return p;
      }));
      if (options?.throwOnError) throw err;
      return false;
    } finally {
      isBusySyncingOrWritingRef.current = false;
    }
  }, [activeProjectId, clearRemoteUpdateFlag, currentProject, projectCategories, setDbBaseSnapshot]);

  // Synchronize active project from its linked JSON file (user-triggered, 3-way merge aware if unsaved edits exist)
  const performSyncProject = useCallback(async (targetProjectId: string, isAuto = false) => {
    setIsSyncing(true);
    isBusySyncingOrWritingRef.current = true;
    try {
      // Access ref synchronously first to preserve user activation for requestPermission
      let handle = targetProjectId === activeProjectId ? activeFileHandleRef.current : null;
      if (!handle) {
        handle = await getSavedFileHandleForProject(targetProjectId);
        if (targetProjectId === activeProjectId) {
          activeFileHandleRef.current = handle;
        }
      }

      if (!handle) {
        throw new FileMissingError('このブラウザ環境には紐づけされたJSONファイルの参照が存在しません。ファイルを再指定してください。');
      }

      const { payload, fileName, lastModified } = await readFromProjectHandle(
        handle, 
        targetProjectId, 
        `cat-${targetProjectId}-etc`,
        { allowPromptRequest: !isAuto }
      );

      if (payload && payload.items) {
        const diskCats = (payload.categories || []).map(c => ({
          ...c,
          projectId: targetProjectId
        }));
        const base = dbBaseStateRef.current[targetProjectId];
        const localProjectItems = itemsRef.current.filter(it => it.projectId === targetProjectId);
        const localProjectCats = categoriesRef.current.filter(c => c.projectId === targetProjectId);

        // If user has unsaved local edits and we have a baseline, perform 3-way auto-merge instead of overwriting!
        if (hasUnsavedChangesRef.current && base) {
          const mergeRes = mergeEquipmentDatabase(
            base.items,
            payload.items,
            localProjectItems,
            base.categories,
            diskCats,
            localProjectCats
          );

          const autoCount =
            mergeRes.autoMergedSummary.addedFromDisk +
            mergeRes.autoMergedSummary.updatedFromDisk +
            mergeRes.autoMergedSummary.deletedFromDisk;

          if (mergeRes.conflicts.length > 0) {
            setConflictModalState({
              isOpen: true,
              type: 'equipment',
              projectId: targetProjectId,
              fileName,
              autoMergedInfoText:
                autoCount > 0
                  ? `他ユーザーの更新（${autoCount}件）は自動統合済みです。競合した${mergeRes.conflicts.length}箇所を選択して保存してください。`
                  : `編集中データと最新ファイルで${mergeRes.conflicts.length}箇所の競合が見つかりました。`,
              equipment: {
                autoMergedItems: mergeRes.mergedItems,
                autoMergedCategories: mergeRes.mergedCategories,
                conflicts: mergeRes.conflicts,
                diskLastModified: lastModified,
                diskSchemaType: payload.schemaType,
                diskRawDocument: payload.rawDocument,
                saveAfterResolve: true,
              },
            });
            return;
          }

          // Clean 3-way merge into active local workspace while advancing baseline to disk
          setItems(prev => {
            const otherItems = prev.filter(it => it.projectId !== targetProjectId);
            const nextAll = [...otherItems, ...mergeRes.mergedItems];
            itemsRef.current = nextAll;
            return nextAll;
          });
          if (mergeRes.mergedCategories.length > 0) {
            setCategories(prev => {
              const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
              const nextAllCats = [...otherProjectsCats, ...mergeRes.mergedCategories];
              categoriesRef.current = nextAllCats;
              return nextAllCats;
            });
          }
          setDbBaseSnapshot(targetProjectId, payload.items, diskCats, lastModified);
          clearRemoteUpdateFlag(targetProjectId, 'db');

          const nowStr = new Date().toLocaleTimeString('ja-JP');
          setProjects(prev => prev.map(p => p.id === targetProjectId ? {
            ...p,
            linkedJsonFileName: fileName,
            linkedJsonLastSync: nowStr,
            schemaType: payload.schemaType || p.schemaType,
            rawDocument: payload.rawDocument || p.rawDocument,
            needsLinkPermission: false,
            isLinkError: false,
            linkErrorMessage: undefined
          } : p));

          setSyncNotice(
            `「${fileName}」の最新データ（${autoCount}件）を安全に取り込み、あなたの編集中データと自動マージしました（必要に応じて「保存」してください）。`
          );
          setTimeout(() => setSyncNotice(''), 6000);
          return;
        }

        // No unsaved edits -> cleanly replace with disk data and update baseline
        setItems(prev => {
          const otherItems = prev.filter(it => it.projectId !== targetProjectId);
          return [...otherItems, ...payload.items];
        });

        let finalCats = localProjectCats;
        if (diskCats.length > 0) {
          finalCats = diskCats;
          setCategories(prev => {
            const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
            return [...otherProjectsCats, ...diskCats];
          });
        }

        setDbBaseSnapshot(targetProjectId, payload.items, finalCats, lastModified);
        clearRemoteUpdateFlag(targetProjectId, 'db');

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setProjects(prev => prev.map(p => {
          if (p.id === targetProjectId) {
            return {
              ...p,
              linkedJsonFileName: fileName,
              linkedJsonLastSync: nowStr,
              schemaType: payload.schemaType || p.schemaType,
              rawDocument: payload.rawDocument || p.rawDocument,
              needsLinkPermission: false,
              isLinkError: false,
              linkErrorMessage: undefined
            };
          }
          return p;
        }));
        setHasUnsavedChanges(false);

        setSyncNotice(
          isAuto
            ? `「${fileName}」の最新データと自動同期しました (${nowStr})`
            : `「${fileName}」から最新データを再同期しました (${nowStr})`
        );
        setTimeout(() => setSyncNotice(''), 5000);
      }
    } catch (err: any) {
      if (err instanceof PermissionRequiredError) {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          needsLinkPermission: true,
          isLinkError: false,
          linkErrorMessage: undefined
        } : p));
      } else {
        console.warn('Project sync failed:', err);
        setProjects(prev => prev.map(p => {
          if (p.id === targetProjectId) {
            return {
              ...p,
              needsLinkPermission: false,
              isLinkError: true,
              linkErrorMessage: err.message || '紐づけ元のJSONファイルが見つかりません。'
            };
          }
          return p;
        }));
      }
    } finally {
      isBusySyncingOrWritingRef.current = false;
      setIsSyncing(false);
    }
  }, [activeProjectId, clearRemoteUpdateFlag, setDbBaseSnapshot]);

  // 1-click reconnect using existing IndexedDB FileSystemFileHandle (no file picker needed!)
  const handleReconnectProjectFile = useCallback(async (targetProjectId: string) => {
    setIsSyncing(true);
    try {
      // Grab ref synchronously so requestPermission receives valid user activation!
      let handle = targetProjectId === activeProjectId ? activeFileHandleRef.current : null;
      if (!handle) {
        handle = await getSavedFileHandleForProject(targetProjectId);
        if (targetProjectId === activeProjectId) {
          activeFileHandleRef.current = handle;
        }
      }

      if (!handle) {
        setIsSyncing(false);
        await handleRelinkProjectFile(targetProjectId);
        return;
      }

      const perm = await requestFileHandlePermission(handle, 'readwrite').catch(async () => {
        return await requestFileHandlePermission(handle, 'read');
      });

      if (perm !== 'granted') {
        setSyncNotice('ファイルへのアクセスが許可されませんでした。ブラウザの許可ダイアログで「許可 / 編集」を選択してください。');
        setTimeout(() => setSyncNotice(''), 5000);
        return;
      }

      if (hasUnsavedChangesRef.current) {
        // Keep local edits and flush them via 3-way merge to the linked JSON file
        const projectItems = itemsRef.current.filter(it => it.projectId === targetProjectId);
        const projectCats = categoriesRef.current.filter(c => c.projectId === targetProjectId);
        const saved = await persistItemsToLinkedJson(targetProjectId, projectItems, projectCats, {
          allowPromptRequest: true,
          throwOnError: true
        });
        if (saved) {
          setHasUnsavedChanges(false);
          setSyncNotice(`「${handle.name}」と再接続し、未保存の編集データをJSONへ保存しました。`);
          setTimeout(() => setSyncNotice(''), 5000);
        }
      } else {
        // Sync latest from disk
        const { payload, fileName, lastModified } = await readFromProjectHandle(
          handle,
          targetProjectId,
          `cat-${targetProjectId}-etc`,
          { allowPromptRequest: false }
        );

        if (payload && payload.items) {
          setItems(prev => {
            const otherItems = prev.filter(it => it.projectId !== targetProjectId);
            return [...otherItems, ...payload.items];
          });
        }
        let scopedCats = categoriesRef.current.filter(c => c.projectId === targetProjectId);
        if (payload && payload.categories && payload.categories.length > 0) {
          scopedCats = payload.categories.map(c => ({
            ...c,
            projectId: targetProjectId
          }));
          setCategories(prev => {
            const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
            return [...otherProjectsCats, ...scopedCats];
          });
        }

        setDbBaseSnapshot(targetProjectId, payload.items || [], scopedCats, lastModified);
        clearRemoteUpdateFlag(targetProjectId, 'db');

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          linkedJsonFileName: fileName,
          linkedJsonLastSync: nowStr,
          schemaType: payload.schemaType || p.schemaType,
          rawDocument: payload.rawDocument || p.rawDocument,
          needsLinkPermission: false,
          isLinkError: false,
          linkErrorMessage: undefined
        } : p));

        setSyncNotice(`「${fileName}」との紐づけ・自動同期を再開しました (${nowStr})`);
        setTimeout(() => setSyncNotice(''), 5000);
      }
    } catch (err: any) {
      if (err instanceof FileMissingError || err.name === 'NotFoundError') {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          needsLinkPermission: false,
          isLinkError: true,
          linkErrorMessage: err.message || '紐づけ元のJSONファイルが見つかりません。'
        } : p));
      } else if (!(err instanceof PermissionRequiredError)) {
        alert(`再接続に失敗しました: ${err.message || 'エラーが発生しました'}`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [activeProjectId, clearRemoteUpdateFlag, persistItemsToLinkedJson, setDbBaseSnapshot]);

  // NOTE: Periodic auto-save has been removed per user instruction.
  // Changes are saved manually via the Save button or the exit confirmation modal.

  // Re-link or select JSON file for a project
  const handleRelinkProjectFile = async (targetProjectId: string) => {
    if (!('showOpenFilePicker' in window)) {
      alert('お使いのブラウザはFile System Access APIに対応していません。Google ChromeまたはMicrosoft Edgeをご利用ください。');
      return;
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'JSON Database File',
            accept: { 'application/json': ['.json'] }
          }
        ],
        multiple: false
      });

      if (handle) {
        await saveFileHandleForProject(targetProjectId, handle);
        if (targetProjectId === activeProjectId) {
          activeFileHandleRef.current = handle;
        }

        // Read and sync immediately
        const { payload, fileName, lastModified } = await readFromProjectHandle(
          handle, 
          targetProjectId, 
          `cat-${targetProjectId}-etc`,
          { allowPromptRequest: true }
        );

        if (payload.items) {
          setItems(prev => {
            const otherItems = prev.filter(it => it.projectId !== targetProjectId);
            return [...otherItems, ...payload.items];
          });
        }

        let scopedCats = categoriesRef.current.filter(c => c.projectId === targetProjectId);
        if (payload.categories && payload.categories.length > 0) {
          scopedCats = payload.categories.map(c => ({
            ...c,
            projectId: targetProjectId
          }));
          setCategories(prev => {
            const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
            return [...otherProjectsCats, ...scopedCats];
          });
        }

        setDbBaseSnapshot(targetProjectId, payload.items || [], scopedCats, lastModified);
        clearRemoteUpdateFlag(targetProjectId, 'db');

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setProjects(prev => prev.map(p => {
          if (p.id === targetProjectId) {
            return {
              ...p,
              linkedJsonFileName: fileName,
              linkedJsonLastSync: nowStr,
              schemaType: payload.schemaType || p.schemaType,
              rawDocument: payload.rawDocument || p.rawDocument,
              needsLinkPermission: false,
              isLinkError: false,
              linkErrorMessage: undefined
            };
          }
          return p;
        }));
        setHasUnsavedChanges(false);

        setSyncNotice(`「${fileName}」を案件データベースとして再紐づけしました。`);
        setTimeout(() => setSyncNotice(''), 6000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`ファイルの紐づけに失敗しました: ${err.message || '形式をご確認ください'}`);
      }
    }
  };

  // Add new project along with its file handle and items
  const handleAddProjectWithFile = async (
    newPrj: ProjectWorkspace,
    initialItems?: EquipmentItem[],
    handle?: FileSystemFileHandle
  ) => {
    setProjects(prev => [newPrj, ...prev]);

    if (initialItems && initialItems.length > 0) {
      setItems(prev => [...initialItems, ...prev]);
    }

    if (handle) {
      await saveFileHandleForProject(newPrj.id, handle);
      activeFileHandleRef.current = handle;
      const mtime = await getFileHandleLastModified(handle);
      if (mtime) {
        setDbBaseSnapshot(newPrj.id, initialItems || [], [], mtime);
      }
    }

    setActiveProjectId(newPrj.id);
    setActiveTab('database');

    setSyncNotice(`案件「${newPrj.name}」を作成し、JSONデータベース「${newPrj.linkedJsonFileName}」と紐づけました。`);
    setTimeout(() => setSyncNotice(''), 6000);
  };

  // Update project metadata
  const handleUpdateProject = (updated: ProjectWorkspace) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    setHasUnsavedChanges(true);
  };

  // ======================== Specification Issuance Ledger JSON Handlers ========================

  // Create a brand new empty Issuance Ledger JSON file for a project ("無から作成")
  const handleCreateNewLedgerFile = async (targetProjectId: string) => {
    const prj = projects.find(p => p.id === targetProjectId) || currentProject;
    const baseName = (prj?.orderNo || prj?.code || 'project').replace(/[\s/\\?%*:|"<>]/g, '_');
    const suggestedName = `${baseName}_spec_ledger.json`;

    const existingRecords = specLedgers[targetProjectId]?.records || [];
    const initialLedger: SpecLedgerFile = {
      ...createEmptyLedgerPayload(prj, targetProjectId),
      records: existingRecords,
    };

    if (!('showSaveFilePicker' in window)) {
      // Fallback download + in-memory initialization
      const blob = new Blob([JSON.stringify(initialLedger, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);

      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: initialLedger }));
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerFileName: suggestedName,
        linkedLedgerLastSync: new Date().toLocaleTimeString('ja-JP'),
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));
      setSyncNotice(`発行台帳JSON「${suggestedName}」を生成し、案件に紐づけました。`);
      setTimeout(() => setSyncNotice(''), 5000);
      return;
    }

    try {
      const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: '仕様書発行台帳 JSON File',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });

      setIsLedgerSyncing(true);
      const writtenMtime = await writeLedgerToHandle(handle, initialLedger, { allowPromptRequest: true });
      await saveLedgerHandleForProject(targetProjectId, handle);
      if (targetProjectId === activeProjectId) {
        activeLedgerHandleRef.current = handle;
      }

      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: initialLedger }));
      setLedgerBaseSnapshot(targetProjectId, initialLedger.records, writtenMtime);
      clearRemoteUpdateFlag(targetProjectId, 'ledger');
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerFileName: handle.name || suggestedName,
        linkedLedgerLastSync: nowStr,
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));

      setSyncNotice(`発行台帳JSON「${handle.name || suggestedName}」を新規作成して案件と紐づけました。`);
      setTimeout(() => setSyncNotice(''), 6000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`発行台帳JSONの作成に失敗しました: ${err.message || 'エラーが発生しました'}`);
      }
    } finally {
      setIsLedgerSyncing(false);
    }
  };

  // Link/Relink an existing Issuance Ledger JSON file
  const handleRelinkLedgerFile = async (targetProjectId: string) => {
    if (!('showOpenFilePicker' in window)) {
      alert('お使いのブラウザはFile System Access APIに対応していません。Google ChromeまたはMicrosoft Edgeをご利用ください。');
      return;
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: '仕様書発行台帳 JSON File',
            accept: { 'application/json': ['.json'] },
          },
        ],
        multiple: false,
      });

      if (!handle) return;
      setIsLedgerSyncing(true);

      await saveLedgerHandleForProject(targetProjectId, handle);
      if (targetProjectId === activeProjectId) {
        activeLedgerHandleRef.current = handle;
      }

      const prj = projectsRef.current.find(p => p.id === targetProjectId);
      const { ledger, fileName, lastModified } = await readLedgerFromHandle(handle, targetProjectId, prj, {
        allowPromptRequest: true,
      });

      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: ledger }));
      setLedgerBaseSnapshot(targetProjectId, ledger.records, lastModified);
      clearRemoteUpdateFlag(targetProjectId, 'ledger');
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerFileName: fileName,
        linkedLedgerLastSync: nowStr,
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));

      setSyncNotice(`発行台帳JSON「${fileName}」を案件と紐づけました（登録台帳 ${ledger.records.length} 件）。`);
      setTimeout(() => setSyncNotice(''), 6000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`発行台帳JSONの紐づけに失敗しました: ${err.message || '形式をご確認ください'}`);
      }
    } finally {
      setIsLedgerSyncing(false);
    }
  };

  // 1-click reconnect for Issuance Ledger JSON handle
  const handleReconnectLedgerFile = useCallback(async (targetProjectId: string) => {
    setIsLedgerSyncing(true);
    try {
      let handle = targetProjectId === activeProjectId ? activeLedgerHandleRef.current : null;
      if (!handle) {
        handle = await getSavedLedgerHandleForProject(targetProjectId);
        if (targetProjectId === activeProjectId) {
          activeLedgerHandleRef.current = handle;
        }
      }

      if (!handle) {
        setIsLedgerSyncing(false);
        await handleRelinkLedgerFile(targetProjectId);
        return;
      }

      const perm = await requestFileHandlePermission(handle, 'readwrite').catch(async () => {
        return await requestFileHandlePermission(handle, 'read');
      });

      if (perm !== 'granted') {
        setSyncNotice('発行台帳JSONへのアクセスが許可されませんでした。');
        setTimeout(() => setSyncNotice(''), 5000);
        return;
      }

      const prj = projectsRef.current.find(p => p.id === targetProjectId);
      const { ledger, fileName, lastModified } = await readLedgerFromHandle(handle, targetProjectId, prj, {
        allowPromptRequest: false,
      });

      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: ledger }));
      setLedgerBaseSnapshot(targetProjectId, ledger.records, lastModified);
      clearRemoteUpdateFlag(targetProjectId, 'ledger');
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerFileName: fileName,
        linkedLedgerLastSync: nowStr,
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));

      setSyncNotice(`発行台帳JSON「${fileName}」との連動を再開しました (${nowStr})`);
      setTimeout(() => setSyncNotice(''), 5000);
    } catch (err: any) {
      if (err instanceof FileMissingError || err.name === 'NotFoundError') {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          needsLedgerPermission: false,
          isLedgerLinkError: true,
          ledgerErrorMessage: err.message || '紐づけ元の発行台帳JSONファイルが見つかりません。',
        } : p));
      } else if (!(err instanceof PermissionRequiredError)) {
        alert(`発行台帳JSONの再接続に失敗しました: ${err.message || 'エラーが発生しました'}`);
      }
    } finally {
      setIsLedgerSyncing(false);
    }
  }, [activeProjectId, clearRemoteUpdateFlag, setLedgerBaseSnapshot]);

  // Manual re-sync of Issuance Ledger JSON from disk (3-way merge aware)
  const handleSyncLedgerFile = useCallback(async (targetProjectId: string) => {
    setIsLedgerSyncing(true);
    isBusySyncingOrWritingRef.current = true;
    try {
      let handle = targetProjectId === activeProjectId ? activeLedgerHandleRef.current : null;
      if (!handle) {
        handle = await getSavedLedgerHandleForProject(targetProjectId);
        if (targetProjectId === activeProjectId) {
          activeLedgerHandleRef.current = handle;
        }
      }
      if (!handle) {
        throw new FileMissingError('発行台帳JSONファイルの参照が存在しません。ファイルを指定してください。');
      }

      const prj = projectsRef.current.find(p => p.id === targetProjectId);
      const { ledger, fileName, lastModified } = await readLedgerFromHandle(handle, targetProjectId, prj, {
        allowPromptRequest: true,
      });

      const base = ledgerBaseStateRef.current[targetProjectId];
      const localRecords = specLedgersRef.current[targetProjectId]?.records || [];

      if (base && localRecords.length > 0) {
        const mergeRes = mergeLedgerRecords(base.records, ledger.records, localRecords);
        if (mergeRes.conflicts.length > 0) {
          setConflictModalState({
            isOpen: true,
            type: 'ledger',
            projectId: targetProjectId,
            fileName,
            autoMergedInfoText:
              mergeRes.autoMergedCount > 0
                ? `他ユーザーの更新（${mergeRes.autoMergedCount}件）は自動統合済みです。競合した${mergeRes.conflicts.length}箇所を選択してください。`
                : `同一仕様書・同一リビジョンに${mergeRes.conflicts.length}箇所の競合があります。`,
            ledger: {
              autoMergedRecords: mergeRes.mergedRecords,
              conflicts: mergeRes.conflicts,
              diskLastModified: lastModified,
              saveAfterResolve: true,
            },
          });
          return;
        }

        const mergedLedger: SpecLedgerFile = {
          ...ledger,
          records: mergeRes.mergedRecords,
        };
        setSpecLedgers(prev => ({ ...prev, [targetProjectId]: mergedLedger }));
        setLedgerBaseSnapshot(targetProjectId, ledger.records, lastModified);
        clearRemoteUpdateFlag(targetProjectId, 'ledger');

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          linkedLedgerFileName: fileName,
          linkedLedgerLastSync: nowStr,
          needsLedgerPermission: false,
          isLedgerLinkError: false,
          ledgerErrorMessage: undefined,
        } : p));

        setSyncNotice(
          mergeRes.autoMergedCount > 0
            ? `発行台帳JSON「${fileName}」の最新更新（${mergeRes.autoMergedCount}件）を自動マージしました (${nowStr})`
            : `発行台帳JSON「${fileName}」から最新台帳 (${mergedLedger.records.length}件) を同期しました (${nowStr})`
        );
        setTimeout(() => setSyncNotice(''), 5000);
        return;
      }

      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: ledger }));
      setLedgerBaseSnapshot(targetProjectId, ledger.records, lastModified);
      clearRemoteUpdateFlag(targetProjectId, 'ledger');
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerFileName: fileName,
        linkedLedgerLastSync: nowStr,
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));

      setSyncNotice(`発行台帳JSON「${fileName}」から最新台帳 (${ledger.records.length}件) を同期しました (${nowStr})`);
      setTimeout(() => setSyncNotice(''), 5000);
    } catch (err: any) {
      if (err instanceof PermissionRequiredError) {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          needsLedgerPermission: true,
          isLedgerLinkError: false,
          ledgerErrorMessage: undefined,
        } : p));
      } else {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          needsLedgerPermission: false,
          isLedgerLinkError: true,
          ledgerErrorMessage: err.message || '発行台帳JSONの読み込みに失敗しました。',
        } : p));
      }
    } finally {
      isBusySyncingOrWritingRef.current = false;
      setIsLedgerSyncing(false);
    }
  }, [activeProjectId, clearRemoteUpdateFlag, setLedgerBaseSnapshot]);

  // Export download copy of Issuance Ledger JSON
  const handleExportLedgerJson = (targetProjectId: string) => {
    const prj = projects.find(p => p.id === targetProjectId);
    const baseName = (prj?.orderNo || prj?.code || 'project').replace(/[\s/\\?%*:|"<>]/g, '_');
    const currentLedger = specLedgers[targetProjectId]
      ? normalizeLedgerJson(specLedgers[targetProjectId], targetProjectId, prj)
      : createEmptyLedgerPayload(prj, targetProjectId);

    const blob = new Blob([JSON.stringify(currentLedger, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_spec_ledger.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Confirm specification issuance: upsert snapshot record into SpecLedgerFile with 3-way merge protection
  const handleConfirmSpecIssuance = async (
    record: SpecIssuanceRecord
  ): Promise<{ savedToDisk: boolean; needsPermission?: boolean }> => {
    const targetProjectId = record.projectId || activeProjectId;
    const prj = projectsRef.current.find(p => p.id === targetProjectId) || currentProject;
    const baseLedger = specLedgersRef.current[targetProjectId]
      ? normalizeLedgerJson(specLedgersRef.current[targetProjectId], targetProjectId, prj)
      : createEmptyLedgerPayload(prj, targetProjectId);

    const remaining = baseLedger.records.filter(r => r.id !== record.id);
    const nextRecords = [record, ...remaining];
    const nextLedger: SpecLedgerFile = {
      ...baseLedger,
      projectOrderNo: prj?.orderNo || baseLedger.projectOrderNo,
      projectCode: prj?.code || baseLedger.projectCode,
      projectName: prj?.name || baseLedger.projectName,
      lastUpdated: new Date().toISOString(),
      records: nextRecords,
    };

    let handle = targetProjectId === activeProjectId ? activeLedgerHandleRef.current : null;
    if (!handle) {
      handle = await getSavedLedgerHandleForProject(targetProjectId);
      if (targetProjectId === activeProjectId) {
        activeLedgerHandleRef.current = handle;
      }
    }

    if (!handle) {
      setSpecLedgers(prev => ({
        ...prev,
        [targetProjectId]: nextLedger,
      }));
      return { savedToDisk: false };
    }

    isBusySyncingOrWritingRef.current = true;
    try {
      const ledgerBase = ledgerBaseStateRef.current[targetProjectId];
      const diskMtime = await getFileHandleLastModified(handle);

      let finalLedgerToWrite = nextLedger;
      let autoMergeNotice = '';

      if (ledgerBase && hasMtimeChanged(diskMtime, ledgerBase.lastModified)) {
        const latestDisk = await readLedgerFromHandle(handle, targetProjectId, prj, {
          allowPromptRequest: true,
        });

        if (hasMtimeChanged(latestDisk.lastModified, ledgerBase.lastModified)) {
          const mergeRes = mergeLedgerRecords(
            ledgerBase.records,
            latestDisk.ledger.records,
            nextRecords
          );

          if (mergeRes.conflicts.length > 0) {
            isBusySyncingOrWritingRef.current = false;
            return await new Promise<{ savedToDisk: boolean; needsPermission?: boolean }>((resolve) => {
              setConflictModalState({
                isOpen: true,
                type: 'ledger',
                projectId: targetProjectId,
                fileName: latestDisk.fileName,
                autoMergedInfoText:
                  mergeRes.autoMergedCount > 0
                    ? `他ユーザーによる別仕様書/別リビジョンの登録（${mergeRes.autoMergedCount}件）は自動統合済みです。競合した${mergeRes.conflicts.length}箇所のみ選択してください。`
                    : `同一仕様書・同一リビジョンに対して他ユーザーの更新と競合しています。`,
                ledger: {
                  autoMergedRecords: mergeRes.mergedRecords,
                  conflicts: mergeRes.conflicts,
                  diskLastModified: latestDisk.lastModified,
                  saveAfterResolve: true,
                  pendingResolve: resolve,
                },
              });
            });
          }

          finalLedgerToWrite = {
            ...nextLedger,
            records: mergeRes.mergedRecords,
          };
          if (mergeRes.autoMergedCount > 0) {
            autoMergeNotice = `他ユーザーの発行台帳更新（${mergeRes.autoMergedCount}件）と自動マージして保存しました。`;
          }
        }
      }

      const newMtime = await writeLedgerToHandle(handle, finalLedgerToWrite, { allowPromptRequest: true });
      setSpecLedgers(prev => ({
        ...prev,
        [targetProjectId]: finalLedgerToWrite,
      }));
      setLedgerBaseSnapshot(targetProjectId, finalLedgerToWrite.records, newMtime);
      clearRemoteUpdateFlag(targetProjectId, 'ledger');

      const nowStr = new Date().toLocaleTimeString('ja-JP');
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerFileName: handle?.name || p.linkedLedgerFileName,
        linkedLedgerLastSync: nowStr,
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));

      if (autoMergeNotice) {
        setSyncNotice(autoMergeNotice);
        setTimeout(() => setSyncNotice(''), 6000);
      }
      return { savedToDisk: true };
    } catch (err: any) {
      // Preserve in local browser memory if disk save failed
      setSpecLedgers(prev => ({
        ...prev,
        [targetProjectId]: nextLedger,
      }));
      if (err instanceof PermissionRequiredError) {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? {
          ...p,
          needsLedgerPermission: true,
          isLedgerLinkError: false,
          ledgerErrorMessage: undefined,
        } : p));
        return { savedToDisk: false, needsPermission: true };
      }
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        needsLedgerPermission: false,
        isLedgerLinkError: true,
        ledgerErrorMessage: err.message || '発行台帳JSONへの書き込みに失敗しました。',
      } : p));
      return { savedToDisk: false };
    } finally {
      isBusySyncingOrWritingRef.current = false;
    }
  };

  // Delete an issuance record from the active project's ledger (with 3-way merge check)
  const handleDeleteLedgerRecord = async (recordId: string) => {
    const targetProjectId = activeProjectId;
    const prj = projectsRef.current.find(p => p.id === targetProjectId) || currentProject;
    const baseLedger = specLedgersRef.current[targetProjectId];
    if (!baseLedger) return;

    const nextRecords = baseLedger.records.filter(r => r.id !== recordId);
    const nextLedger: SpecLedgerFile = {
      ...baseLedger,
      lastUpdated: new Date().toISOString(),
      records: nextRecords,
    };

    const handle = activeLedgerHandleRef.current || await getSavedLedgerHandleForProject(targetProjectId);
    if (!handle) {
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: nextLedger }));
      return;
    }

    isBusySyncingOrWritingRef.current = true;
    try {
      const ledgerBase = ledgerBaseStateRef.current[targetProjectId];
      const diskMtime = await getFileHandleLastModified(handle);
      let finalRecords = nextRecords;

      if (ledgerBase && hasMtimeChanged(diskMtime, ledgerBase.lastModified)) {
        const latestDisk = await readLedgerFromHandle(handle, targetProjectId, prj, {
          allowPromptRequest: true,
        });
        if (hasMtimeChanged(latestDisk.lastModified, ledgerBase.lastModified)) {
          const mergeRes = mergeLedgerRecords(ledgerBase.records, latestDisk.ledger.records, nextRecords);
          if (mergeRes.conflicts.length > 0) {
            isBusySyncingOrWritingRef.current = false;
            setConflictModalState({
              isOpen: true,
              type: 'ledger',
              projectId: targetProjectId,
              fileName: latestDisk.fileName,
              autoMergedInfoText: '削除操作と他ユーザーの台帳更新が競合しています。',
              ledger: {
                autoMergedRecords: mergeRes.mergedRecords,
                conflicts: mergeRes.conflicts,
                diskLastModified: latestDisk.lastModified,
                saveAfterResolve: true,
              },
            });
            return;
          }
          finalRecords = mergeRes.mergedRecords;
        }
      }

      const finalLedger: SpecLedgerFile = { ...nextLedger, records: finalRecords };
      const newMtime = await writeLedgerToHandle(handle, finalLedger, { allowPromptRequest: true });
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: finalLedger }));
      setLedgerBaseSnapshot(targetProjectId, finalRecords, newMtime);
      clearRemoteUpdateFlag(targetProjectId, 'ledger');
      setProjects(prev => prev.map(p => p.id === targetProjectId ? {
        ...p,
        linkedLedgerLastSync: new Date().toLocaleTimeString('ja-JP'),
        needsLedgerPermission: false,
        isLedgerLinkError: false,
        ledgerErrorMessage: undefined,
      } : p));
    } catch (err) {
      setSpecLedgers(prev => ({ ...prev, [targetProjectId]: nextLedger }));
      console.warn('Failed to persist deleted ledger record to disk', err);
    } finally {
      isBusySyncingOrWritingRef.current = false;
    }
  };

  // Resolve conflicts selected in ConflictResolutionModal
  const handleResolveConflictModal = async (resolutions: Record<string, ConflictChoice>) => {
    const targetProjectId = conflictModalState.projectId;
    if (!targetProjectId) return;

    setConflictModalState(prev => ({ ...prev, isResolving: true }));
    isBusySyncingOrWritingRef.current = true;

    try {
      if (conflictModalState.type === 'equipment' && conflictModalState.equipment) {
        const eq = conflictModalState.equipment;
        const resolvedProjectItems = applyEquipmentConflictResolutions(
          eq.autoMergedItems,
          eq.conflicts,
          resolutions
        );
        const targetCats =
          eq.autoMergedCategories.length > 0
            ? eq.autoMergedCategories
            : categoriesRef.current.filter(c => c.projectId === targetProjectId);

        setItems(prev => {
          const otherItems = prev.filter(it => it.projectId !== targetProjectId);
          const nextAll = [...otherItems, ...resolvedProjectItems];
          itemsRef.current = nextAll;
          return nextAll;
        });
        setCategories(prev => {
          const otherCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
          const nextCatsAll = [...otherCats, ...targetCats];
          categoriesRef.current = nextCatsAll;
          return nextCatsAll;
        });

        let handle = targetProjectId === activeProjectId ? activeFileHandleRef.current : null;
        if (!handle) handle = await getSavedFileHandleForProject(targetProjectId);

        if (handle) {
          const prj = projectsRef.current.find(p => p.id === targetProjectId) || currentProject;
          const effectiveSchemaType = eq.diskSchemaType || prj?.schemaType;
          const effectiveRawDocument = eq.diskRawDocument || prj?.rawDocument;
          const payload: DatabasePayload = {
            version: effectiveSchemaType === 'tokki-equipment' ? '1.1' : '2.0',
            lastUpdated: new Date().toISOString(),
            items: resolvedProjectItems,
            categories: targetCats,
            templates: templatesRef.current,
            schemaType: effectiveSchemaType,
            rawDocument: effectiveRawDocument,
          };

          const newMtime = await writeToProjectHandle(handle, payload, effectiveSchemaType, prj, {
            allowPromptRequest: true,
          });
          setDbBaseSnapshot(targetProjectId, resolvedProjectItems, targetCats, newMtime);
          clearRemoteUpdateFlag(targetProjectId, 'db');

          const nowStr = new Date().toLocaleTimeString('ja-JP');
          setProjects(prev => prev.map(p => p.id === targetProjectId ? {
            ...p,
            schemaType: effectiveSchemaType || p.schemaType,
            rawDocument: effectiveRawDocument || p.rawDocument,
            linkedJsonLastSync: nowStr,
            needsLinkPermission: false,
            isLinkError: false,
            linkErrorMessage: undefined,
          } : p));
        }

        setHasUnsavedChanges(false);
        setConflictModalState({ isOpen: false, type: 'equipment', projectId: '' });
        setSyncNotice('競合箇所を解決し、最新JSONファイルへ安全にマージ保存しました。');
        setTimeout(() => setSyncNotice(''), 6000);
      } else if (conflictModalState.type === 'ledger' && conflictModalState.ledger) {
        const ld = conflictModalState.ledger;
        const resolvedRecords = applyLedgerConflictResolutions(
          ld.autoMergedRecords,
          ld.conflicts,
          resolutions
        );
        const prj = projectsRef.current.find(p => p.id === targetProjectId) || currentProject;
        const baseLedger = specLedgersRef.current[targetProjectId]
          ? normalizeLedgerJson(specLedgersRef.current[targetProjectId], targetProjectId, prj)
          : createEmptyLedgerPayload(prj, targetProjectId);

        const resolvedLedger: SpecLedgerFile = {
          ...baseLedger,
          projectOrderNo: prj?.orderNo || baseLedger.projectOrderNo,
          projectCode: prj?.code || baseLedger.projectCode,
          projectName: prj?.name || baseLedger.projectName,
          lastUpdated: new Date().toISOString(),
          records: resolvedRecords,
        };

        let ledgerHandle = targetProjectId === activeProjectId ? activeLedgerHandleRef.current : null;
        if (!ledgerHandle) ledgerHandle = await getSavedLedgerHandleForProject(targetProjectId);

        if (ledgerHandle) {
          const newMtime = await writeLedgerToHandle(ledgerHandle, resolvedLedger, {
            allowPromptRequest: true,
          });
          setLedgerBaseSnapshot(targetProjectId, resolvedRecords, newMtime);
          clearRemoteUpdateFlag(targetProjectId, 'ledger');

          const nowStr = new Date().toLocaleTimeString('ja-JP');
          setProjects(prev => prev.map(p => p.id === targetProjectId ? {
            ...p,
            linkedLedgerLastSync: nowStr,
            needsLedgerPermission: false,
            isLedgerLinkError: false,
            ledgerErrorMessage: undefined,
          } : p));
        }

        setSpecLedgers(prev => ({
          ...prev,
          [targetProjectId]: resolvedLedger,
        }));
        ld.pendingResolve?.({ savedToDisk: Boolean(ledgerHandle) });
        setConflictModalState({ isOpen: false, type: 'ledger', projectId: '' });
        setSyncNotice('発行台帳JSONの競合を解決し、マージ保存しました。');
        setTimeout(() => setSyncNotice(''), 6000);
      }
    } catch (err: any) {
      alert(`マージ保存に失敗しました: ${err.message || 'エラーが発生しました'}`);
      setConflictModalState(prev => ({ ...prev, isResolving: false }));
    } finally {
      isBusySyncingOrWritingRef.current = false;
    }
  };

  const handleCancelConflictModal = () => {
    if (conflictModalState.type === 'ledger' && conflictModalState.ledger?.pendingResolve) {
      conflictModalState.ledger.pendingResolve({ savedToDisk: false });
    }
    setConflictModalState({ isOpen: false, type: 'equipment', projectId: '' });
  };

  // Delete project registration from UI state & browser storage only (NEVER touch or delete the JSON file on disk!)
  const handleDeleteProjectRegistration = async (projectId: string) => {
    const targetProject = projects.find(p => p.id === projectId);
    const projectName = targetProject ? targetProject.name : '対象案件';

    // 1. Remove from projects state & localStorage
    const remainingProjects = projects.filter(p => p.id !== projectId);
    
    // Ensure at least one project exists in the workspace
    let nextActiveId = '';
    if (remainingProjects.length > 0) {
      nextActiveId = activeProjectId === projectId ? remainingProjects[0].id : activeProjectId;
    } else {
      const fallbackProject: ProjectWorkspace = {
        id: `prj-${Date.now()}`,
        name: '新規案件',
        code: 'PRJ-001',
        orderNo: '',
        clientName: '未設定',
        clientNumber: '',
        description: '',
        createdAt: new Date().toISOString()
      };
      remainingProjects.push(fallbackProject);
      nextActiveId = fallbackProject.id;
    }

    setProjects(remainingProjects);
    localStorage.setItem('specforge_projects_v2', JSON.stringify(sanitizeProjectsForStorage(remainingProjects)));

    // 2. Remove in-memory items, categories, and ledger state associated with this project
    setItems(prev => prev.filter(it => it.projectId !== projectId));
    setCategories(prev => prev.filter(c => c.projectId !== projectId));
    setSpecLedgers(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });

    // 3. Remove handles from browser IndexedDB only (does NOT delete or touch the JSON files on the user's PC!)
    await removeSavedFileHandleForProject(projectId);
    await removeSavedLedgerHandleForProject(projectId);
    if (activeProjectId === projectId) {
      activeFileHandleRef.current = null;
      activeLedgerHandleRef.current = null;
    }

    setActiveProjectId(nextActiveId);
    setHasUnsavedChanges(false);

    setSyncNotice(`「${projectName}」の画面上登録を削除しました。（※PC上のJSONファイルは消去されず安全に保持されています）`);
    setTimeout(() => setSyncNotice(''), 7000);
  };

  // Manual save to linked JSON file
  const handleManualSaveJson = async () => {
    if (!activeProjectId) return;
    setIsSavingJson(true);
    try {
      const handle = activeFileHandleRef.current || await getSavedFileHandleForProject(activeProjectId);
      if (!handle) {
        if (currentProject?.linkedJsonFileName) {
          setIsSavingJson(false);
          await handleRelinkProjectFile(activeProjectId);
          return;
        }
        setHasUnsavedChanges(false);
        setSyncNotice('ブラウザ内に変更を保存しました。（外部JSONファイルと連動するには「案件サマリー・JSON」から紐づけしてください）');
        setTimeout(() => setSyncNotice(''), 5000);
        return;
      }
      activeFileHandleRef.current = handle;

      const projectItems = items.filter(it => it.projectId === activeProjectId);
      const projectCats = categories.filter(c => c.projectId === activeProjectId);
      const saved = await persistItemsToLinkedJson(activeProjectId, projectItems, projectCats, {
        allowPromptRequest: true,
        throwOnError: true
      });
      if (saved) {
        setHasUnsavedChanges(false);
        setSyncNotice('紐づけ先JSONファイルに正常に保存しました。');
        setTimeout(() => setSyncNotice(''), 4000);
      }
    } catch (err: any) {
      if (err instanceof PermissionRequiredError) {
        setSyncNotice('JSONファイルへの書き込み権限が許可されませんでした。再度保存ボタンを押して「編集を許可」してください。');
        setTimeout(() => setSyncNotice(''), 6000);
      } else {
        alert(`JSONファイルの保存に失敗しました: ${err.message || 'エラーが発生しました'}`);
      }
    } finally {
      setIsSavingJson(false);
    }
  };

  // Reorder items in current project (drag & drop)
  const handleReorderItems = (reorderedProjectItems: EquipmentItem[]) => {
    const targetProjectId = activeProjectId;
    const otherItems = itemsRef.current.filter(it => it.projectId !== targetProjectId);
    const resequenced = resequenceProjectItems(reorderedProjectItems);
    const nextList = [...resequenced, ...otherItems];
    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    void persistItemsToLinkedJson(targetProjectId, resequenced);
  };

  // Intercept project switch if unsaved changes exist
  const handleRequestProjectChange = (nextProjectId: string) => {
    if (nextProjectId === activeProjectId) return;
    if (hasUnsavedChanges) {
      setPendingNextProjectId(nextProjectId);
      setUnsavedModalReason('switch-project');
      setIsUnsavedModalOpen(true);
    } else {
      setActiveProjectId(nextProjectId);
    }
  };

  // Modal action handlers
  const handleSaveFromModal = async () => {
    await handleManualSaveJson();
    setIsUnsavedModalOpen(false);
    if (pendingNextProjectId) {
      setActiveProjectId(pendingNextProjectId);
      setPendingNextProjectId(null);
    }
  };

  const handleDiscardFromModal = () => {
    setHasUnsavedChanges(false);
    setIsUnsavedModalOpen(false);
    if (pendingNextProjectId) {
      setActiveProjectId(pendingNextProjectId);
      setPendingNextProjectId(null);
    }
  };

  // Category handlers (strictly scoped to the active project & persisted to JSON)
  const handleAddCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const targetProjectId = activeProjectId;
    const newCat: Category = {
      id: `cat-${targetProjectId}-${Date.now()}`,
      projectId: targetProjectId,
      name: trimmed
    };
    const nextCats = [...categoriesRef.current, newCat];
    categoriesRef.current = nextCats;
    setCategories(nextCats);
    setHasUnsavedChanges(true);

    // Save updated categories to linked JSON
    const projectItems = itemsRef.current.filter(it => it.projectId === targetProjectId);
    const updatedProjectCats = nextCats.filter(c => c.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems, updatedProjectCats);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (projectCategories.length <= 1) return;
    const targetProjectId = activeProjectId;
    const fallbackId = projectCategories.find(c => c.id !== categoryId)?.id || projectCategories[0].id;
    const nextItems = itemsRef.current.map(it => it.projectId === targetProjectId && it.categoryId === categoryId ? { ...it, categoryId: fallbackId } : it);
    const nextCats = categoriesRef.current.filter(c => c.id !== categoryId);
    itemsRef.current = nextItems;
    categoriesRef.current = nextCats;
    setItems(nextItems);
    setCategories(nextCats);
    setHasUnsavedChanges(true);

    // Save updated categories and re-assigned items to linked JSON
    const projectItems = nextItems.filter(it => it.projectId === targetProjectId);
    const updatedProjectCats = nextCats.filter(c => c.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems, updatedProjectCats);
  };

  const handleMoveItemToCategory = (itemId: string, targetCategoryId: string) => {
    const targetProjectId = activeProjectId;
    const nextList = itemsRef.current.map(it => {
      if (it.projectId === targetProjectId && it.id === itemId) {
        const oldCatName = projectCategories.find(c => c.id === it.categoryId)?.name || '未分類';
        const newCatName = projectCategories.find(c => c.id === targetCategoryId)?.name || '未分類';
        const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });
        const catLog: ChangeLog = {
          id: `hist-${Date.now()}`,
          itemId,
          timestamp: nowStr,
          author: '手動移動',
          field: 'category',
          fieldLabel: '所属カテゴリ',
          oldValue: oldCatName,
          newValue: newCatName,
          reason: 'ドラッグ＆ドロップによるカテゴリ分類変更'
        };
        return {
          ...it,
          categoryId: targetCategoryId,
          history: [catLog, ...(it.history || [])],
          updatedAt: nowStr.slice(0, 10)
        };
      }
      return it;
    });

    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    const projectItems = nextList.filter(it => it.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems);
  };

  // Batch update delivery dates across multiple items (strictly scoped to activeProjectId)
  const handleBatchUpdateDeliveryDate = (itemIds: string[], newDeliveryDate: string) => {
    if (!itemIds.length) return;
    const targetProjectId = activeProjectId;
    const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });
    const targetCount = itemsRef.current.filter(it => it.projectId === targetProjectId && itemIds.includes(it.id)).length;
    if (targetCount === 0) return;

    const nextList = itemsRef.current.map(it => {
      if (it.projectId === targetProjectId && itemIds.includes(it.id)) {
        const oldDate = it.deliveryDate || '-';
        const dateLog: ChangeLog = {
          id: `hist-deliv-${Date.now()}-${it.id.slice(-4)}`,
          itemId: it.id,
          timestamp: nowStr,
          author: '一括変更',
          field: 'deliveryDate',
          fieldLabel: '納入時期',
          oldValue: oldDate,
          newValue: newDeliveryDate,
          reason: `納入時期の一括更新 (${targetCount}件)`
        };
        return {
          ...it,
          deliveryDate: newDeliveryDate,
          history: [dateLog, ...(it.history || [])],
          updatedAt: nowStr.slice(0, 10)
        };
      }
      return it;
    });

    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    const projectItems = nextList.filter(it => it.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems);

    setSyncNotice(`${targetCount}件の納入時期を「${newDeliveryDate}」へ一括変更しました。`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  // Batch update equipment types across multiple items (strictly scoped to activeProjectId)
  const handleBatchUpdateEquipmentType = (itemIds: string[], newEquipmentType: string) => {
    if (!itemIds.length) return;
    const targetProjectId = activeProjectId;
    const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });
    const formattedType = normalizeEquipmentType(newEquipmentType, 'PA');
    const targetCount = itemsRef.current.filter(it => it.projectId === targetProjectId && itemIds.includes(it.id)).length;
    if (targetCount === 0) return;

    const nextList = itemsRef.current.map(it => {
      if (it.projectId === targetProjectId && itemIds.includes(it.id)) {
        const oldType = it.equipmentType || 'PA';
        const typeLog: ChangeLog = {
          id: `hist-type-${Date.now()}-${it.id.slice(-4)}`,
          itemId: it.id,
          timestamp: nowStr,
          author: '一括変更',
          field: 'equipmentType',
          fieldLabel: '機器種別',
          oldValue: oldType,
          newValue: formattedType,
          reason: `機器種別の一括更新 (${targetCount}件)`
        };
        return {
          ...it,
          equipmentType: formattedType,
          ...(it.rawTokki ? { rawTokki: { ...it.rawTokki, equipment_type: formattedType } } : {}),
          history: [typeLog, ...(it.history || [])],
          updatedAt: nowStr.slice(0, 10)
        };
      }
      return it;
    });

    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    const projectItems = nextList.filter(it => it.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems);

    setSyncNotice(`${targetCount}件の機器種別を「${formattedType}」へ一括変更しました。`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  // Batch move multiple items to target category (strictly scoped to activeProjectId)
  const handleBatchMoveToCategory = (itemIds: string[], targetCategoryId: string) => {
    if (!itemIds.length) return;
    const targetProjectId = activeProjectId;
    const targetCat = projectCategories.find(c => c.id === targetCategoryId);
    const targetCatName = targetCat?.name || '未分類';
    const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });
    const targetCount = itemsRef.current.filter(it => it.projectId === targetProjectId && itemIds.includes(it.id)).length;
    if (targetCount === 0) return;

    const nextList = itemsRef.current.map(it => {
      if (it.projectId === targetProjectId && itemIds.includes(it.id)) {
        const oldCatName = projectCategories.find(c => c.id === it.categoryId)?.name || '未分類';
        const catLog: ChangeLog = {
          id: `hist-cat-${Date.now()}-${it.id.slice(-4)}`,
          itemId: it.id,
          timestamp: nowStr,
          author: '一括移動',
          field: 'category',
          fieldLabel: '所属カテゴリ',
          oldValue: oldCatName,
          newValue: targetCatName,
          reason: `一括カテゴリ分類変更 (${targetCount}件)`
        };
        return {
          ...it,
          categoryId: targetCategoryId,
          history: [catLog, ...(it.history || [])],
          updatedAt: nowStr.slice(0, 10)
        };
      }
      return it;
    });

    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    const projectItems = nextList.filter(it => it.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems);

    setSyncNotice(`${targetCount}件の機器を「${targetCatName}」へ一括移動しました。`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  // Batch update issue status (済 / 未) across multiple items (strictly scoped to activeProjectId)
  const handleBatchUpdateIssueStatus = (itemIds: string[], isIssued: boolean) => {
    if (!itemIds.length) return;
    const targetProjectId = activeProjectId;
    const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });
    const statusText = isIssued ? '済' : '未';
    const targetCount = itemsRef.current.filter(it => it.projectId === targetProjectId && itemIds.includes(it.id)).length;
    if (targetCount === 0) return;

    const nextList = itemsRef.current.map(it => {
      if (it.projectId === targetProjectId && itemIds.includes(it.id)) {
        const oldStatus = it.isIssued ? '済' : '未';
        const issueLog: ChangeLog = {
          id: `hist-issue-${Date.now()}-${it.id.slice(-4)}`,
          itemId: it.id,
          timestamp: nowStr,
          author: '設計担当',
          field: 'isIssued',
          fieldLabel: '仕様書発行状態',
          oldValue: oldStatus,
          newValue: statusText,
          reason: `発行状態の更新 (${statusText})`
        };
        return {
          ...it,
          isIssued,
          history: [issueLog, ...(it.history || [])],
          updatedAt: nowStr.slice(0, 10)
        };
      }
      return it;
    });

    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    const projectItems = nextList.filter(it => it.projectId === targetProjectId);
    void persistItemsToLinkedJson(targetProjectId, projectItems);

    setSyncNotice(`${targetCount}件の発行状態を「${statusText}」へ更新しました。`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  const handleToggleSingleItemIssue = (item: EquipmentItem) => {
    handleBatchUpdateIssueStatus([item.id], !item.isIssued);
  };

  // Item CRUD
  const handleAddNewItem = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateItem = (
    newItem: EquipmentItem,
    targetClassification?: EquipmentClassification,
    targetSeq?: number
  ) => {
    const targetProjectId = activeProjectId;
    const currentProjectItems = itemsRef.current.filter(it => it.projectId === targetProjectId);
    const otherItems = itemsRef.current.filter(it => it.projectId !== targetProjectId);

    const cls = targetClassification || newItem.classification || '03';
    const seq = targetSeq || (currentProjectItems.filter(it => (it.classification || '03') === cls).length + 1);

    const resequencedProject = placeItemWithResequence(
      currentProjectItems,
      newItem,
      cls,
      seq
    );

    const nextList = [...resequencedProject, ...otherItems];
    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    void persistItemsToLinkedJson(targetProjectId, resequencedProject);
  };

  const handleEditItem = (item: EquipmentItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveItem = (
    updatedItem: EquipmentItem,
    targetClassification?: EquipmentClassification,
    targetSeq?: number,
    originalId?: string
  ) => {
    const targetProjectId = activeProjectId;
    const currentProjectItems = itemsRef.current.filter(it => it.projectId === targetProjectId);
    const otherItems = itemsRef.current.filter(it => it.projectId !== targetProjectId);

    const cls = targetClassification || updatedItem.classification || '03';
    const seq = targetSeq || 1;

    const eqType = normalizeEquipmentType(updatedItem.equipmentType, 'PA');
    const normalizedUpdatedItem: EquipmentItem = {
      ...updatedItem,
      equipmentType: eqType,
      ...(updatedItem.rawTokki ? { rawTokki: { ...updatedItem.rawTokki, equipment_type: eqType } } : {})
    };

    const resequencedProject = placeItemWithResequence(
      currentProjectItems,
      normalizedUpdatedItem,
      cls,
      seq,
      originalId
    );

    const nextList = [...resequencedProject, ...otherItems];
    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    void persistItemsToLinkedJson(targetProjectId, resequencedProject);
  };

  const handleDeleteItem = (itemId: string, skipConfirm: boolean = false) => {
    const targetProjectId = activeProjectId;
    const targetItem = itemsRef.current.find(it => it.projectId === targetProjectId && it.id === itemId);
    const itemName = targetItem ? `${targetItem.name} (${targetItem.tagNo || '-'})` : 'この機器';
    if (skipConfirm || window.confirm(`機器「${itemName}」を削除してもよろしいですか？`)) {
      const remainingProject = itemsRef.current.filter(it => it.projectId === targetProjectId && it.id !== itemId);
      const otherItems = itemsRef.current.filter(it => it.projectId !== targetProjectId);
      const resequencedProject = resequenceProjectItems(remainingProject);
      const nextList = [...resequencedProject, ...otherItems];
      itemsRef.current = nextList;
      setItems(nextList);
      setHasUnsavedChanges(true);
      void persistItemsToLinkedJson(targetProjectId, resequencedProject);

      if (editingItem && editingItem.id === itemId && editingItem.projectId === targetProjectId) {
        setIsEditModalOpen(false);
        setEditingItem(null);
      }
    }
  };

  const handleBatchDeleteItems = (itemIds: string[]) => {
    if (!itemIds.length) return;
    const targetProjectId = activeProjectId;
    const remainingProject = itemsRef.current.filter(it => it.projectId === targetProjectId && !itemIds.includes(it.id));
    const otherItems = itemsRef.current.filter(it => it.projectId !== targetProjectId);
    const resequencedProject = resequenceProjectItems(remainingProject);
    const nextList = [...resequencedProject, ...otherItems];
    itemsRef.current = nextList;
    setItems(nextList);
    setHasUnsavedChanges(true);
    void persistItemsToLinkedJson(targetProjectId, resequencedProject);

    if (editingItem && editingItem.projectId === targetProjectId && itemIds.includes(editingItem.id)) {
      setIsEditModalOpen(false);
      setEditingItem(null);
    }
  };

  // Excel file upload for equipment list
  const handleUploadExcelEquipment = async (file: File) => {
    try {
      const targetProjectId = activeProjectId;
      const defaultCatId = projectCategories[0]?.id || `cat-${targetProjectId}-etc`;
      const currentPrj = projectsRef.current.find(p => p.id === targetProjectId);
      const projectItems = itemsRef.current.filter(it => it.projectId === targetProjectId);
      const imported = await parseEquipmentExcel(
        file, 
        targetProjectId, 
        defaultCatId, 
        currentPrj?.code, 
        projectItems
      );
      if (imported.length > 0) {
        const nextList = [...imported, ...itemsRef.current];
        itemsRef.current = nextList;
        setItems(nextList);
        setHasUnsavedChanges(true);
        const updatedProjectItems = nextList.filter(it => it.projectId === targetProjectId);
        void persistItemsToLinkedJson(targetProjectId, updatedProjectItems);
        alert(`Excelファイル「${file.name}」から ${imported.length} 件の機器を読み込み、登録しました。紐づけ先JSONにも反映されました。`);
      } else {
        alert('機器データを検出できませんでした。列ヘッダーに「機器名」「数量」「口径」「材質」「納期」が含まれているか確認してください。');
      }
    } catch (err: any) {
      alert(`Excelの読み込みに失敗しました: ${err.message || '形式をご確認ください'}`);
    }
  };

  // Backup & Restore for portable Desktop app usage
  const handleExportProjectBackup = () => {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      projects,
      categories,
      templates,
      items
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SpecForge_Data_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProjectBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.items) {
          if (parsed.projects) setProjects(parsed.projects);
          if (parsed.categories) setCategories(parsed.categories);
          if (parsed.templates) handleUpdateAllTemplates(parsed.templates);
          setItems(ensureItemEquipmentTypes(parsed.items));
          alert('プロジェクトデータベースを正常に復元しました。');
        } else {
          alert('ファイルの形式が正しくありません。');
        }
      } catch (err) {
        alert('JSONファイルの解析に失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Streamlined Header */}
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        projects={projects}
        activeProjectId={activeProjectId}
        onProjectChange={handleRequestProjectChange}
        totalItemsCount={items.filter(i => i.projectId === activeProjectId).length}
        ledgerRecordsCount={activeLedgerRecords.length}
        isSyncing={isSyncing}
        onManualSync={() => performSyncProject(activeProjectId, false)}
        onRelinkFile={() => handleRelinkProjectFile(activeProjectId)}
        onReconnectFile={() => handleReconnectProjectFile(activeProjectId)}
        hasUnsavedChanges={hasUnsavedChanges}
        onManualSave={handleManualSaveJson}
        isSaving={isSavingJson}
        canInstallPwa={!!deferredInstallPrompt}
        onInstallPwa={handleInstallPwa}
      />

      {/* Prominent Global Unsaved Changes Alert Banner */}
      {hasUnsavedChanges && (
        <div className="bg-amber-500 text-slate-900 text-xs py-2 px-4 shadow-sm flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950 font-bold" />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-medium">
                <strong className="font-bold">【未保存の変更があります】</strong>
                現在の案件「{currentProject?.name}」の編集データがまだJSONファイルに保存されていません。
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setUnsavedModalReason('manual');
                    setIsUnsavedModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-white text-slate-900 font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  確認・破棄
                </button>
                <button
                  onClick={handleManualSaveJson}
                  disabled={isSavingJson}
                  className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded shadow-xs text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingJson ? 'animate-spin' : ''}`} />
                  <span>今すぐJSONファイルに保存</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calm Permission Resume Banner (Link IS preserved in IndexedDB across reload / new window!) */}
      {currentProject?.needsLinkPermission && !currentProject?.isLinkError && (
        <div className="bg-sky-700 text-white text-xs py-2 px-4 shadow-sm flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Link2 className="w-4 h-4 shrink-0 text-sky-200" />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-medium">
                <strong className="font-bold">【JSON紐づけ維持中】</strong>
                「{currentProject.linkedJsonFileName}」との紐づけは保持されています。ブラウザの更新・新規ウィンドウ起動後は1クリックで読み書き連動を再開できます。
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleReconnectProjectFile(activeProjectId)}
                  disabled={isSyncing}
                  className="px-3 py-1 bg-white hover:bg-sky-50 text-sky-800 font-bold rounded shadow-xs text-xs whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>ワンクリックで連動を再開（再選択不要）</span>
                </button>
                <button
                  onClick={() => handleRelinkProjectFile(activeProjectId)}
                  className="px-2.5 py-1 bg-sky-800 hover:bg-sky-900 text-sky-100 font-medium rounded text-xs whitespace-nowrap transition-colors cursor-pointer"
                >
                  別ファイルに変更
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prominent Global File Link Error Alert Banner (only when genuinely missing or no handle stored) */}
      {currentProject?.isLinkError && (
        <div className="bg-red-600 text-white text-xs py-2.5 px-4 shadow-md flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-semibold">
                【ファイル参照エラー】{currentProject.linkErrorMessage || `紐づけ元のJSONファイル「${currentProject.linkedJsonFileName}」が見つかりません。ファイルが移動または削除された可能性があります。`}
              </span>
              <button
                onClick={() => handleRelinkProjectFile(activeProjectId)}
                className="self-start sm:self-auto px-3 py-1 bg-white hover:bg-red-50 text-red-700 font-bold rounded shadow-xs text-xs whitespace-nowrap transition-colors cursor-pointer"
              >
                ファイルの再指定・再紐づけ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remote External Update Notification Banner (Multi-User Concurrent Edit Protection) */}
      {(remoteUpdates[activeProjectId]?.dbUpdated || remoteUpdates[activeProjectId]?.ledgerUpdated) && (
        <div className="bg-emerald-700 text-white text-xs py-2.5 px-4 shadow-sm flex items-center justify-between transition-all">
          <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
            <GitMerge className="w-4 h-4 shrink-0 text-emerald-200" />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-medium">
                <strong className="font-bold">【他のユーザーがファイルを更新しました】</strong>
                {remoteUpdates[activeProjectId]?.dbUpdated && remoteUpdates[activeProjectId]?.ledgerUpdated
                  ? ' 機器データベースJSONと発行台帳JSONの両方が外部で更新されています。現在の編集内容を消さずに3-way自動マージで最新データを取り込めます。'
                  : remoteUpdates[activeProjectId]?.dbUpdated
                    ? ` 「${currentProject?.linkedJsonFileName || '機器DB JSON'}」が更新されています。現在の編集内容を保ったまま安全に自動マージできます。`
                    : ` 「${currentProject?.linkedLedgerFileName || '発行台帳JSON'}」が更新されています。最新の仕様書履歴を取り込めます。`}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {remoteUpdates[activeProjectId]?.dbUpdated && (
                  <button
                    onClick={() => performSyncProject(activeProjectId, false)}
                    disabled={isSyncing}
                    className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-900 font-bold rounded shadow-xs text-xs whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>機器DBを安全に取り込む（自動マージ）</span>
                  </button>
                )}
                {remoteUpdates[activeProjectId]?.ledgerUpdated && (
                  <button
                    onClick={() => handleSyncLedgerFile(activeProjectId)}
                    disabled={isLedgerSyncing}
                    className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-900 font-bold rounded shadow-xs text-xs whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLedgerSyncing ? 'animate-spin' : ''}`} />
                    <span>発行台帳を取り込む（自動マージ）</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Sync Notification Banner */}
      {syncNotice && (
        <div className="bg-indigo-600 text-white text-xs py-2 px-4 shadow-xs flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice('')} className="text-white hover:text-indigo-200 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* Tab 1: Equipment Database */}
        {activeTab === 'database' && (
          <OrderDatabaseTab
            key={activeProjectId}
            items={items.filter(i => i.projectId === activeProjectId)}
            categories={projectCategories}
            activeProjectId={activeProjectId}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onBatchDeleteItems={handleBatchDeleteItems}
            onAddNewItem={handleAddNewItem}
            onOpenChangeLog={() => setIsHistoryModalOpen(true)}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onMoveItemToCategory={handleMoveItemToCategory}
            onBatchUpdateDeliveryDate={handleBatchUpdateDeliveryDate}
            onBatchUpdateEquipmentType={handleBatchUpdateEquipmentType}
            onBatchMoveToCategory={handleBatchMoveToCategory}
            onReorderItems={handleReorderItems}
            hasUnsavedChanges={hasUnsavedChanges}
            onManualSaveJson={handleManualSaveJson}
            isSavingJson={isSavingJson}
            onUploadExcel={handleUploadExcelEquipment}
          />
        )}

        {/* Tab 2A: Initial Specification Creation */}
        {activeTab === 'spec_initial' && (
          <SpecDashboardTab
            key={`spec_initial_${activeProjectId}`}
            mode="initial"
            items={items}
            categories={projectCategories}
            templates={templates}
            activeProjectId={activeProjectId}
            currentProject={currentProject}
            ledgerRecords={activeLedgerRecords}
            templateFolderState={templateFolderState}
            onReconnectTemplateFolder={handleSyncTemplateFolder}
            onConfirmIssuance={handleConfirmSpecIssuance}
            onCreateNewLedgerFile={handleCreateNewLedgerFile}
            onRelinkLedgerFile={handleRelinkLedgerFile}
            onReconnectLedgerFile={handleReconnectLedgerFile}
            onOpenAdminMapping={(tplId) => {
              setAdminInitialTemplateId(tplId);
              handleTabChange('templates');
            }}
            onUpdateTemplates={handleUpdateAllTemplates}
          />
        )}

        {/* Tab 2B: Specification Revision (Rev.1〜3) */}
        {activeTab === 'spec_revision' && (
          <SpecDashboardTab
            key={`spec_revision_${activeProjectId}`}
            mode="revision"
            items={items}
            categories={projectCategories}
            templates={templates}
            activeProjectId={activeProjectId}
            currentProject={currentProject}
            ledgerRecords={activeLedgerRecords}
            templateFolderState={templateFolderState}
            onReconnectTemplateFolder={handleSyncTemplateFolder}
            onConfirmIssuance={handleConfirmSpecIssuance}
            onDeleteLedgerRecord={handleDeleteLedgerRecord}
            onCreateNewLedgerFile={handleCreateNewLedgerFile}
            onRelinkLedgerFile={handleRelinkLedgerFile}
            onReconnectLedgerFile={handleReconnectLedgerFile}
            onOpenAdminMapping={(tplId) => {
              setAdminInitialTemplateId(tplId);
              handleTabChange('templates');
            }}
            onUpdateTemplates={handleUpdateAllTemplates}
          />
        )}

        {/* Tab 3: Settings & Template Management */}
        {activeTab === 'templates' && (
          <TemplateAdminTab
            templates={templates}
            onUpdateTemplates={handleUpdateAllTemplates}
            items={items}
            currentProject={currentProject}
            activeTemplateId={adminInitialTemplateId}
            onBackToDashboard={() => handleTabChange(lastSpecTab)}
            templateFolderState={templateFolderState}
            isFolderSyncing={isFolderTemplateSyncing}
            onSelectTemplateFolder={handleSelectTemplateFolder}
            onImportTemplateFolderFiles={handleImportTemplateFolderFiles}
            onSyncTemplateFolder={handleSyncTemplateFolder}
            onClearTemplateFolder={handleClearTemplateFolder}
            onSaveMappingToFolder={handleSaveTemplateMappingToFolder}
          />
        )}

        {/* Tab 4: Project Summary & JSON Management */}
        {activeTab === 'projects' && (
          <ProjectSummaryTab
            projects={projects}
            activeProjectId={activeProjectId}
            items={items}
            categories={projectCategories}
            onSelectProject={handleRequestProjectChange}
            onAddProjectWithFile={handleAddProjectWithFile}
            onUpdateProject={handleUpdateProject}
            onRelinkProjectFile={handleRelinkProjectFile}
            onReconnectProjectFile={handleReconnectProjectFile}
            onSyncProjectFile={(pid) => performSyncProject(pid, false)}
            onExportProjectBackup={handleExportProjectBackup}
            onImportProjectBackup={handleImportProjectBackup}
            onSwitchToDatabase={() => setActiveTab('database')}
            isSyncing={isSyncing}
            onInstallPwa={handleInstallPwa}
            onDeleteProject={handleDeleteProjectRegistration}
            ledgerRecordsCount={activeLedgerRecords.length}
            isLedgerSyncing={isLedgerSyncing}
            onCreateNewLedgerFile={handleCreateNewLedgerFile}
            onRelinkLedgerFile={handleRelinkLedgerFile}
            onReconnectLedgerFile={handleReconnectLedgerFile}
            onSyncLedgerFile={handleSyncLedgerFile}
            onExportLedgerJson={handleExportLedgerJson}
            onSwitchToRevisionTab={() => handleTabChange('spec_revision')}
          />
        )}

      </main>

      {/* Item Create Modal (Dedicated Distinct UI for Adding Equipment) */}
      <ItemCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateItem}
        categories={projectCategories}
        projectId={activeProjectId}
        existingCount={items.filter(i => i.projectId === activeProjectId).length}
        existingItems={items.filter(i => i.projectId === activeProjectId)}
      />

      {/* Item Edit Modal */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          categories={projectCategories}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
          existingItems={items.filter(i => i.projectId === activeProjectId)}
        />
      )}

      {/* Change History Log Modal (Accessible from above the category column) */}
      <ChangeHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        items={items.filter(i => i.projectId === activeProjectId)}
        categories={projectCategories}
      />

      {/* PWA Desktop Install Guide Modal */}
      <PwaInstallGuideModal
        isOpen={isPwaGuideOpen}
        onClose={() => setIsPwaGuideOpen(false)}
        onTriggerInstall={handleInstallPwa}
        canDirectInstall={!!deferredInstallPrompt}
      />

      {/* Unsaved Changes Save / Exit / Navigation Modal */}
      <UnsavedChangesModal
        isOpen={isUnsavedModalOpen}
        onClose={() => {
          setIsUnsavedModalOpen(false);
          setPendingNextProjectId(null);
        }}
        onSave={handleSaveFromModal}
        onDiscard={handleDiscardFromModal}
        projectName={currentProject?.name}
        projectCode={currentProject?.code}
        fileName={currentProject?.linkedJsonFileName}
        isSaving={isSavingJson}
        reason={unsavedModalReason}
        targetProjectName={projects.find(p => p.id === pendingNextProjectId)?.name}
      />

      {/* Concurrent Edit Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={conflictModalState.isOpen}
        conflictType={conflictModalState.type}
        fileName={conflictModalState.fileName}
        projectName={projects.find(p => p.id === conflictModalState.projectId)?.name || currentProject?.name}
        equipmentConflicts={conflictModalState.equipment?.conflicts}
        ledgerConflicts={conflictModalState.ledger?.conflicts}
        autoMergedInfoText={conflictModalState.autoMergedInfoText}
        isSaving={Boolean(conflictModalState.isResolving)}
        onCancel={handleCancelConflictModal}
        onResolve={handleResolveConflictModal}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-2.5 px-6 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-400">
          <span>SpecForge · 機器仕様書作成システム (案件別カテゴリ完全分離 ＆ 塗装仕様1項目化対応)</span>
          <span>特記仕様書スキーマ(v1.1) · JSON手動/離脱時保存 · Excel読込</span>
        </div>
      </footer>

    </div>
  );
}
