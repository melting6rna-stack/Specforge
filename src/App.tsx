import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { OrderDatabaseTab } from './components/OrderDatabaseTab';
import { SpecDashboardTab } from './components/SpecDashboardTab';
import { TemplateAdminTab } from './components/TemplateAdminTab';
import { ProjectSummaryTab } from './components/ProjectSummaryTab';
import { ItemEditModal } from './components/ItemEditModal';
import { ItemCreateModal } from './components/ItemCreateModal';
import { ChangeHistoryModal } from './components/ChangeHistoryModal';
import { PwaInstallGuideModal } from './components/PwaInstallGuideModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { EquipmentItem, Category, SpecTemplate, ProjectWorkspace, ChangeLog } from './types';
import { DEFAULT_TEMPLATES } from './data/defaultTemplates';
import { INITIAL_PROJECTS, INITIAL_CATEGORIES, INITIAL_ITEMS } from './data/sampleOrders';
import { parseEquipmentExcel } from './utils/excelTemplateParser';
import { 
  DatabasePayload,
  saveFileHandleForProject,
  getSavedFileHandleForProject,
  removeSavedFileHandleForProject,
  readFromProjectHandle,
  writeToProjectHandle
} from './utils/sharedSyncManager';
import { Bell, AlertTriangle, RefreshCw, HardDrive, Save } from 'lucide-react';

export default function App() {
  // 1. Projects state
  const [projects, setProjects] = useState<ProjectWorkspace[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_projects_v2');
      if (saved) return JSON.parse(saved);
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
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved items', e);
    }
    return INITIAL_ITEMS;
  });

  // 4. Templates state
  const [templates, setTemplates] = useState<SpecTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_templates_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved templates', e);
    }
    return DEFAULT_TEMPLATES;
  });

  // Persist templates to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('specforge_templates_v2', JSON.stringify(templates));
    } catch (e) {
      console.warn('Failed to save templates to localStorage', e);
    }
  }, [templates]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string>('');

  // Unsaved changes tracking (for manual save & preventing data loss on page leave)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSavingJson, setIsSavingJson] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'database' | 'spec_studio' | 'templates' | 'projects'>('database');

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

  // Active Project's File Handle
  const activeFileHandleRef = useRef<FileSystemFileHandle | null>(null);

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];

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
  useEffect(() => {
    localStorage.setItem('specforge_projects_v2', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('specforge_categories_v3', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('specforge_items_v2', JSON.stringify(items));
  }, [items]);

  // Load active project file handle from IndexedDB when activeProjectId changes
  useEffect(() => {
    let isCancelled = false;

    async function loadProjectHandle() {
      if (!activeProjectId) return;
      const handle = await getSavedFileHandleForProject(activeProjectId);
      if (isCancelled) return;
      activeFileHandleRef.current = handle;

      if (handle) {
        try {
          const { payload } = await readFromProjectHandle(
            handle, 
            activeProjectId, 
            `cat-${activeProjectId}-etc`
          );
          if (isCancelled) return;

          // Merge loaded items for this project
          if (payload.items && payload.items.length > 0) {
            setItems(prev => {
              const otherItems = prev.filter(it => it.projectId !== activeProjectId);
              return [...otherItems, ...payload.items];
            });
          }

          // Scope categories strictly for this project
          if (payload.categories && payload.categories.length > 0) {
            const scopedCats = payload.categories.map(c => ({
              ...c,
              projectId: activeProjectId
            }));
            setCategories(prev => {
              const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== activeProjectId);
              return [...otherProjectsCats, ...scopedCats];
            });
          }

          // Mark project as healthy and record schemaType
          setProjects(prev => prev.map(p => {
            if (p.id === activeProjectId) {
              return {
                ...p,
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
          console.warn('Failed to read from linked JSON file for project', activeProjectId, err);
          setProjects(prev => prev.map(p => {
            if (p.id === activeProjectId) {
              return {
                ...p,
                isLinkError: true,
                linkErrorMessage: err.message || '紐づけ元のJSONファイルが見つかりません。'
              };
            }
            return p;
          }));
        }
      }
    }

    loadProjectHandle();

    return () => {
      isCancelled = true;
    };
  }, [activeProjectId]);

  // Helper to persist active project's items & categories to its linked JSON file handle
  const persistItemsToLinkedJson = useCallback(async (
    targetProjectId: string, 
    updatedItemsForProject: EquipmentItem[],
    customCategories?: Category[]
  ) => {
    let handle = activeFileHandleRef.current;
    if (!handle) {
      handle = await getSavedFileHandleForProject(targetProjectId);
      activeFileHandleRef.current = handle;
    }

    if (!handle) return;

    try {
      const prj = projects.find(p => p.id === targetProjectId) || currentProject;
      const targetCats = customCategories || categories.filter(c => c.projectId === targetProjectId);
      const catsToSave = targetCats.length > 0 ? targetCats : projectCategories;

      const payload: DatabasePayload = {
        version: prj?.schemaType === 'tokki-equipment' ? '1.1' : '2.0',
        lastUpdated: new Date().toISOString(),
        items: updatedItemsForProject,
        categories: catsToSave,
        templates,
        schemaType: prj?.schemaType,
        rawDocument: prj?.rawDocument
      };

      await writeToProjectHandle(handle, payload, prj?.schemaType, prj);

      const nowTime = new Date().toLocaleTimeString('ja-JP');
      setProjects(prev => prev.map(p => {
        if (p.id === targetProjectId) {
          return {
            ...p,
            isLinkError: false,
            linkErrorMessage: undefined,
            linkedJsonLastSync: nowTime
          };
        }
        return p;
      }));
    } catch (err: any) {
      console.warn('Failed writing back to linked JSON file:', err);
      setProjects(prev => prev.map(p => {
        if (p.id === targetProjectId) {
          return {
            ...p,
            isLinkError: true,
            linkErrorMessage: err.message || 'JSONファイルへの書き込みに失敗しました。ファイルが移動または削除された可能性があります。'
          };
        }
        return p;
      }));
    }
  }, [categories, currentProject, projectCategories, projects, templates]);

  // Synchronize active project from its linked JSON file
  const performSyncProject = useCallback(async (targetProjectId: string, isAuto = false) => {
    setIsSyncing(true);
    try {
      let handle = activeFileHandleRef.current;
      if (!handle) {
        handle = await getSavedFileHandleForProject(targetProjectId);
        activeFileHandleRef.current = handle;
      }

      if (!handle) {
        throw new Error('紐づけされたJSONファイルが存在しません。');
      }

      const { payload, fileName } = await readFromProjectHandle(
        handle, 
        targetProjectId, 
        `cat-${targetProjectId}-etc`
      );

      if (payload && payload.items) {
        setItems(prev => {
          const otherItems = prev.filter(it => it.projectId !== targetProjectId);
          return [...otherItems, ...payload.items];
        });

        if (payload.categories && payload.categories.length > 0) {
          const scopedCats = payload.categories.map(c => ({
            ...c,
            projectId: targetProjectId
          }));
          setCategories(prev => {
            const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
            return [...otherProjectsCats, ...scopedCats];
          });
        }

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setProjects(prev => prev.map(p => {
          if (p.id === targetProjectId) {
            return {
              ...p,
              linkedJsonFileName: fileName,
              linkedJsonLastSync: nowStr,
              schemaType: payload.schemaType || p.schemaType,
              rawDocument: payload.rawDocument || p.rawDocument,
              isLinkError: false,
              linkErrorMessage: undefined
            };
          }
          return p;
        }));

        if (isAuto) {
          setSyncNotice(`「${fileName}」の最新データと自動同期しました (${nowStr})`);
          setTimeout(() => setSyncNotice(''), 5000);
        }
      }
    } catch (err: any) {
      console.warn('Project sync failed:', err);
      setProjects(prev => prev.map(p => {
        if (p.id === targetProjectId) {
          return {
            ...p,
            isLinkError: true,
            linkErrorMessage: err.message || '紐づけ元のJSONファイルが見つかりません。'
          };
        }
        return p;
      }));
    } finally {
      setIsSyncing(false);
    }
  }, []);

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
        const { payload, fileName } = await readFromProjectHandle(
          handle, 
          targetProjectId, 
          `cat-${targetProjectId}-etc`
        );

        if (payload.items) {
          setItems(prev => {
            const otherItems = prev.filter(it => it.projectId !== targetProjectId);
            return [...otherItems, ...payload.items];
          });
        }

        if (payload.categories && payload.categories.length > 0) {
          const scopedCats = payload.categories.map(c => ({
            ...c,
            projectId: targetProjectId
          }));
          setCategories(prev => {
            const otherProjectsCats = prev.filter(c => c.projectId && c.projectId !== targetProjectId);
            return [...otherProjectsCats, ...scopedCats];
          });
        }

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setProjects(prev => prev.map(p => {
          if (p.id === targetProjectId) {
            return {
              ...p,
              linkedJsonFileName: fileName,
              linkedJsonLastSync: nowStr,
              schemaType: payload.schemaType || p.schemaType,
              rawDocument: payload.rawDocument || p.rawDocument,
              isLinkError: false,
              linkErrorMessage: undefined
            };
          }
          return p;
        }));

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

  // Manual save to linked JSON file
  const handleManualSaveJson = async () => {
    if (!activeProjectId) return;
    setIsSavingJson(true);
    try {
      const projectItems = items.filter(it => it.projectId === activeProjectId);
      const projectCats = categories.filter(c => c.projectId === activeProjectId);
      await persistItemsToLinkedJson(activeProjectId, projectItems, projectCats);
      setHasUnsavedChanges(false);
      setSyncNotice('紐づけ先JSONファイルに正常に保存しました。');
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err: any) {
      alert(`JSONファイルの保存に失敗しました: ${err.message || 'エラーが発生しました'}`);
    } finally {
      setIsSavingJson(false);
    }
  };

  // Reorder items in current project (drag & drop)
  const handleReorderItems = (reorderedProjectItems: EquipmentItem[]) => {
    setItems(prev => {
      const otherItems = prev.filter(it => it.projectId !== activeProjectId);
      const nextList = [...reorderedProjectItems, ...otherItems];
      return nextList;
    });
    setHasUnsavedChanges(true);
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
    const newCat: Category = {
      id: `cat-${activeProjectId}-${Date.now()}`,
      projectId: activeProjectId,
      name: trimmed
    };
    const nextCats = [...categories, newCat];
    setCategories(nextCats);
    setHasUnsavedChanges(true);

    // Save updated categories to linked JSON
    const projectItems = items.filter(it => it.projectId === activeProjectId);
    const updatedProjectCats = nextCats.filter(c => c.projectId === activeProjectId);
    persistItemsToLinkedJson(activeProjectId, projectItems, updatedProjectCats);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (projectCategories.length <= 1) return;
    const fallbackId = projectCategories.find(c => c.id !== categoryId)?.id || projectCategories[0].id;
    const nextItems = items.map(it => it.projectId === activeProjectId && it.categoryId === categoryId ? { ...it, categoryId: fallbackId } : it);
    const nextCats = categories.filter(c => c.id !== categoryId);
    setItems(nextItems);
    setCategories(nextCats);
    setHasUnsavedChanges(true);

    // Save updated categories and re-assigned items to linked JSON
    const projectItems = nextItems.filter(it => it.projectId === activeProjectId);
    const updatedProjectCats = nextCats.filter(c => c.projectId === activeProjectId);
    persistItemsToLinkedJson(activeProjectId, projectItems, updatedProjectCats);
  };

  const handleMoveItemToCategory = (itemId: string, targetCategoryId: string) => {
    setItems(prev => {
      const nextList = prev.map(it => {
        if (it.id === itemId) {
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

      // Write updated equipment list & category mappings to linked JSON
      const projectItems = nextList.filter(it => it.projectId === activeProjectId);
      persistItemsToLinkedJson(activeProjectId, projectItems);

      return nextList;
    });
    setHasUnsavedChanges(true);
  };

  // Batch update delivery dates across multiple items
  const handleBatchUpdateDeliveryDate = (itemIds: string[], newDeliveryDate: string) => {
    if (!itemIds.length) return;
    const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });
    
    setItems(prev => {
      const nextList = prev.map(it => {
        if (itemIds.includes(it.id)) {
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
            reason: `納入時期の一括更新 (${itemIds.length}件)`
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

      const projectItems = nextList.filter(it => it.projectId === activeProjectId);
      persistItemsToLinkedJson(activeProjectId, projectItems);
      return nextList;
    });

    setHasUnsavedChanges(true);
    setSyncNotice(`${itemIds.length}件の納入時期を「${newDeliveryDate}」へ一括変更しました。`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  // Batch move multiple items to target category
  const handleBatchMoveToCategory = (itemIds: string[], targetCategoryId: string) => {
    if (!itemIds.length) return;
    const targetCat = projectCategories.find(c => c.id === targetCategoryId);
    const targetCatName = targetCat?.name || '未分類';
    const nowStr = new Date().toLocaleString('ja-JP', { hour12: false });

    setItems(prev => {
      const nextList = prev.map(it => {
        if (itemIds.includes(it.id)) {
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
            reason: `一括カテゴリ分類変更 (${itemIds.length}件)`
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

      const projectItems = nextList.filter(it => it.projectId === activeProjectId);
      persistItemsToLinkedJson(activeProjectId, projectItems);
      return nextList;
    });

    setHasUnsavedChanges(true);
    setSyncNotice(`${itemIds.length}件の機器を「${targetCatName}」へ一括移動しました。`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  // Item CRUD
  const handleAddNewItem = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateItem = (newItem: EquipmentItem) => {
    setItems(prev => {
      const nextList = [newItem, ...prev];
      const projectItems = nextList.filter(it => it.projectId === activeProjectId);
      persistItemsToLinkedJson(activeProjectId, projectItems);
      return nextList;
    });
    setHasUnsavedChanges(true);
  };

  const handleEditItem = (item: EquipmentItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveItem = (updatedItem: EquipmentItem) => {
    setItems(prev => {
      const nextList = prev.map(i => i.id === updatedItem.id ? updatedItem : i);
      const projectItems = nextList.filter(it => it.projectId === activeProjectId);
      persistItemsToLinkedJson(activeProjectId, projectItems);
      return nextList;
    });
    setHasUnsavedChanges(true);
  };

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('この機器データを削除してもよろしいですか？（紐づけ先JSONファイルからも削除されます）')) {
      setItems(prev => {
        const nextList = prev.filter(i => i.id !== itemId);
        const projectItems = nextList.filter(it => it.projectId === activeProjectId);
        persistItemsToLinkedJson(activeProjectId, projectItems);
        return nextList;
      });
      setHasUnsavedChanges(true);
    }
  };

  // Excel file upload for equipment list
  const handleUploadExcelEquipment = async (file: File) => {
    try {
      const defaultCatId = projectCategories[0]?.id || `cat-${activeProjectId}-etc`;
      const currentPrj = projects.find(p => p.id === activeProjectId);
      const projectItems = items.filter(it => it.projectId === activeProjectId);
      const imported = await parseEquipmentExcel(
        file, 
        activeProjectId, 
        defaultCatId, 
        currentPrj?.code, 
        projectItems
      );
      if (imported.length > 0) {
        setItems(prev => {
          const nextList = [...imported, ...prev];
          const projectItems = nextList.filter(it => it.projectId === activeProjectId);
          persistItemsToLinkedJson(activeProjectId, projectItems);
          return nextList;
        });
        setHasUnsavedChanges(true);
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
          if (parsed.templates) setTemplates(parsed.templates);
          setItems(parsed.items);
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
        onTabChange={setActiveTab}
        projects={projects}
        activeProjectId={activeProjectId}
        onProjectChange={handleRequestProjectChange}
        totalItemsCount={items.filter(i => i.projectId === activeProjectId).length}
        isSyncing={isSyncing}
        onManualSync={() => performSyncProject(activeProjectId, false)}
        onRelinkFile={() => handleRelinkProjectFile(activeProjectId)}
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

      {/* Prominent Global File Link Error Alert Banner */}
      {currentProject?.isLinkError && (
        <div className="bg-red-600 text-white text-xs py-2.5 px-4 shadow-md flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-semibold">
                【ファイル消失・アクセスエラー】紐づけ元のJSONファイル「{currentProject.linkedJsonFileName}」が見つかりません。ファイルが移動または削除された可能性があります。
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
            items={items}
            categories={projectCategories}
            activeProjectId={activeProjectId}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onAddNewItem={handleAddNewItem}
            onOpenChangeLog={() => setIsHistoryModalOpen(true)}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onMoveItemToCategory={handleMoveItemToCategory}
            onBatchUpdateDeliveryDate={handleBatchUpdateDeliveryDate}
            onBatchMoveToCategory={handleBatchMoveToCategory}
            onReorderItems={handleReorderItems}
            hasUnsavedChanges={hasUnsavedChanges}
            onManualSaveJson={handleManualSaveJson}
            isSavingJson={isSavingJson}
            onUploadExcel={handleUploadExcelEquipment}
          />
        )}

        {/* Tab 2: Specification Studio & Live Preview */}
        {activeTab === 'spec_studio' && (
          <SpecDashboardTab
            items={items}
            categories={projectCategories}
            templates={templates}
            activeProjectId={activeProjectId}
            currentProject={currentProject}
            onOpenAdminMapping={() => setActiveTab('templates')}
            onUpdateTemplates={setTemplates}
          />
        )}

        {/* Tab 3: Template Administration */}
        {activeTab === 'templates' && (
          <TemplateAdminTab
            templates={templates}
            onUpdateTemplates={setTemplates}
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
            onSyncProjectFile={(pid) => performSyncProject(pid, false)}
            onExportProjectBackup={handleExportProjectBackup}
            onImportProjectBackup={handleImportProjectBackup}
            onSwitchToDatabase={() => setActiveTab('database')}
            isSyncing={isSyncing}
            onInstallPwa={handleInstallPwa}
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
