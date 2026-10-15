import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { OrderDatabaseTab } from './components/OrderDatabaseTab';
import { SpecDashboardTab } from './components/SpecDashboardTab';
import { TemplateAdminTab } from './components/TemplateAdminTab';
import { ProjectSummaryTab } from './components/ProjectSummaryTab';
import { ItemEditModal } from './components/ItemEditModal';
import { AuditTrailDrawer } from './components/AuditTrailDrawer';
import { PdfImportModal } from './components/PdfImportModal';
import { SharedSyncModal } from './components/SharedSyncModal';
import { EquipmentItem, Category, SpecTemplate, ProjectWorkspace, ChangeLog } from './types';
import { DEFAULT_TEMPLATES } from './data/defaultTemplates';
import { INITIAL_PROJECTS, INITIAL_CATEGORIES, INITIAL_ITEMS } from './data/sampleOrders';
import { parseEquipmentExcel } from './utils/excelTemplateParser';
import { 
  SyncConfig, 
  getSyncConfig, 
  saveSyncConfig, 
  saveFileHandle, 
  getSavedFileHandle, 
  removeSavedFileHandle, 
  readFromHandle, 
  writeToHandle, 
  fetchFromNetworkUrl,
  DatabasePayload
} from './utils/sharedSyncManager';
import { Bell, RefreshCw } from 'lucide-react';

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

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return projects[0]?.id || 'prj-main';
  });

  // 2. Categories state
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('specforge_categories_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved categories', e);
    }
    return INITIAL_CATEGORIES;
  });

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

  // 5. Shared Network Sync Configuration
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(getSyncConfig);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string>('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'database' | 'spec_studio' | 'templates' | 'projects'>('database');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [auditTargetItemId, setAuditTargetItemId] = useState<string | undefined>(undefined);
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // File Handle Ref
  const activeFileHandleRef = useRef<FileSystemFileHandle | null>(null);

  // Save to localStorage automatically (100% offline persistence)
  useEffect(() => {
    localStorage.setItem('specforge_projects_v2', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('specforge_categories_v2', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('specforge_items_v2', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('specforge_templates_v2', JSON.stringify(templates));
  }, [templates]);

  // Synchronize with shared network source (either file handle or URL)
  const performSync = useCallback(async (isAuto = false) => {
    if (syncConfig.mode === 'none') return;
    setIsSyncing(true);

    try {
      let payload: DatabasePayload | null = null;

      if (syncConfig.mode === 'file_handle') {
        let handle = activeFileHandleRef.current;
        if (!handle) {
          handle = await getSavedFileHandle();
          activeFileHandleRef.current = handle;
        }
        if (handle) {
          payload = await readFromHandle(handle);
        }
      } else if (syncConfig.mode === 'network_url' && syncConfig.networkUrl) {
        payload = await fetchFromNetworkUrl(syncConfig.networkUrl);
      }

      if (payload && payload.items) {
        // Compare with current items count and timestamp
        const currentCount = items.length;
        const newCount = payload.items.length;
        const hasDiff = currentCount !== newCount || JSON.stringify(items) !== JSON.stringify(payload.items);

        if (hasDiff) {
          setItems(payload.items);
          if (payload.categories) setCategories(payload.categories);
          if (payload.projects) setProjects(payload.projects);
          if (payload.templates) setTemplates(payload.templates);

          if (isAuto) {
            setSyncNotice(`共有フォルダ上の最新データと自動同期しました (${payload.lastUpdated || '他ユーザーによる更新'})`);
            setTimeout(() => setSyncNotice(''), 6000);
          }
        }

        const nowStr = new Date().toLocaleTimeString('ja-JP');
        setLastSyncTime(nowStr);
        setSyncConfig(prev => {
          const updated = { ...prev, lastSyncTime: nowStr };
          saveSyncConfig(updated);
          return updated;
        });
      }
    } catch (err: any) {
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [syncConfig, items]);

  // Try to load saved handle on startup
  useEffect(() => {
    getSavedFileHandle().then(handle => {
      if (handle) {
        activeFileHandleRef.current = handle;
        performSync(false);
      }
    });
  }, []);

  // 5-MINUTE AUTO-SYNC INTERVAL LOOP (Only runs while tab is active/visible)
  useEffect(() => {
    if (!syncConfig.autoSyncEnabled || syncConfig.mode === 'none') return;

    const intervalTime = syncConfig.autoSyncIntervalMs || 300000; // 5 minutes
    const timer = setInterval(() => {
      // Only execute while user is actively viewing the page!
      if (document.visibilityState === 'visible') {
        performSync(true);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [syncConfig.autoSyncEnabled, syncConfig.mode, syncConfig.autoSyncIntervalMs, performSync]);

  // Handle select shared local file via File System Access API
  const handleSelectSharedFile = async () => {
    if (!('showOpenFilePicker' in window)) {
      throw new Error('お使いのブラウザはFile System Access APIに対応していません。ChromeまたはEdgeをご利用ください。');
    }

    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'JSON Database',
          accept: { 'application/json': ['.json'] }
        }
      ],
      multiple: false
    });

    if (handle) {
      activeFileHandleRef.current = handle;
      await saveFileHandle(handle);
      const nextConfig: SyncConfig = {
        ...syncConfig,
        mode: 'file_handle',
        networkFileName: handle.name
      };
      setSyncConfig(nextConfig);
      saveSyncConfig(nextConfig);

      // Immediately read from it
      const payload = await readFromHandle(handle);
      if (payload && payload.items) {
        setItems(payload.items);
        if (payload.categories) setCategories(payload.categories);
        if (payload.projects) setProjects(payload.projects);
        if (payload.templates) setTemplates(payload.templates);
      } else {
        // If empty file, write initial database to it
        await writeToHandle(handle, {
          version: '2.0',
          lastUpdated: new Date().toISOString(),
          projects,
          categories,
          templates,
          items
        });
      }
      setLastSyncTime(new Date().toLocaleTimeString('ja-JP'));
    }
  };

  const handleUnlinkSharedFile = async () => {
    activeFileHandleRef.current = null;
    await removeSavedFileHandle();
    const nextConfig: SyncConfig = {
      ...syncConfig,
      mode: 'none',
      networkFileName: undefined
    };
    setSyncConfig(nextConfig);
    saveSyncConfig(nextConfig);
  };

  // Category handlers
  const handleAddCategory = (name: string) => {
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: name.trim()
    };
    setCategories(prev => [...prev, newCat]);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (categories.length <= 1) return;
    const fallbackId = categories.find(c => c.id !== categoryId)?.id || categories[0].id;
    setItems(prev => prev.map(it => it.categoryId === categoryId ? { ...it, categoryId: fallbackId } : it));
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  };

  const handleMoveItemToCategory = (itemId: string, targetCategoryId: string) => {
    setItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const oldCatName = categories.find(c => c.id === it.categoryId)?.name || '未分類';
        const newCatName = categories.find(c => c.id === targetCategoryId)?.name || '未分類';
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
    }));
  };

  // Item CRUD
  const handleAddNewItem = () => {
    const now = new Date().toISOString().slice(0, 10);
    const defaultCat = categories[0]?.id || 'cat-etc';
    const newItem: EquipmentItem = {
      id: `eq-${Date.now()}`,
      projectId: activeProjectId,
      tagNo: `EQ-${String(items.length + 1).padStart(2, '0')}`,
      name: '',
      quantity: 1,
      unit: '台',
      diameter: '50A',
      material: 'SUS304',
      deliveryDate: now,
      categoryId: defaultCat,
      deliveryLocation: '指定工場受入棟',
      notes: '',
      history: [
        {
          id: `hist-${Date.now()}`,
          itemId: `eq-${Date.now()}`,
          timestamp: new Date().toLocaleString('ja-JP', { hour12: false }),
          author: '設計担当',
          field: 'init',
          fieldLabel: '初期登録',
          oldValue: '-',
          newValue: '手動追加',
          reason: '機器手動新規起票'
        }
      ],
      createdAt: now,
      updatedAt: now
    };
    setEditingItem(newItem);
    setIsEditModalOpen(true);
  };

  const handleEditItem = (item: EquipmentItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveItem = (updatedItem: EquipmentItem) => {
    setItems(prev => {
      const exists = prev.some(i => i.id === updatedItem.id);
      let nextList: EquipmentItem[];
      if (exists) {
        nextList = prev.map(i => i.id === updatedItem.id ? updatedItem : i);
      } else {
        nextList = [updatedItem, ...prev];
      }

      // If linked to shared file handle, persist back to shared network file immediately
      if (syncConfig.mode === 'file_handle' && activeFileHandleRef.current) {
        writeToHandle(activeFileHandleRef.current, {
          version: '2.0',
          lastUpdated: new Date().toISOString(),
          projects,
          categories,
          templates,
          items: nextList
        }).catch(e => console.warn('Write back to shared file failed', e));
      }

      return nextList;
    });
  };

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('この機器データを削除してもよろしいですか？')) {
      setItems(prev => prev.filter(i => i.id !== itemId));
    }
  };

  // Excel file upload for equipment list
  const handleUploadExcelEquipment = async (file: File) => {
    try {
      const imported = await parseEquipmentExcel(file, activeProjectId, categories[0]?.id || 'cat-etc');
      if (imported.length > 0) {
        setItems(prev => [...imported, ...prev]);
        alert(`Excelファイル「${file.name}」から ${imported.length} 件の機器を読み込み、登録しました。`);
      } else {
        alert('機器データを検出できませんでした。列ヘッダーに「機器名」「数量」「口径」「材質」「納期」が含まれているか確認してください。');
      }
    } catch (err: any) {
      alert(`Excelの読み込みに失敗しました: ${err.message || '形式をご確認ください'}`);
    }
  };

  // PDF import callback
  const handleConfirmPdfImport = (newItems: EquipmentItem[]) => {
    setItems(prev => [...newItems, ...prev]);
  };

  const handleOpenAuditTrail = (itemId?: string) => {
    setAuditTargetItemId(itemId);
    setIsAuditTrailOpen(true);
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
        onProjectChange={setActiveProjectId}
        totalItemsCount={items.filter(i => i.projectId === activeProjectId).length}
        syncConfig={syncConfig}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        isSyncing={isSyncing}
      />

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
            categories={categories}
            activeProjectId={activeProjectId}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onOpenAuditTrail={handleOpenAuditTrail}
            onAddNewItem={handleAddNewItem}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onMoveItemToCategory={handleMoveItemToCategory}
            onUploadExcel={handleUploadExcelEquipment}
            onOpenPdfImport={() => setIsPdfImportOpen(true)}
          />
        )}

        {/* Tab 2: Specification Studio & Live Preview */}
        {activeTab === 'spec_studio' && (
          <SpecDashboardTab
            items={items}
            categories={categories}
            templates={templates}
            activeProjectId={activeProjectId}
          />
        )}

        {/* Tab 3: Template Administration */}
        {activeTab === 'templates' && (
          <TemplateAdminTab
            templates={templates}
            onUpdateTemplates={setTemplates}
          />
        )}

        {/* Tab 4: Project Summary */}
        {activeTab === 'projects' && (
          <ProjectSummaryTab
            projects={projects}
            activeProjectId={activeProjectId}
            items={items}
            categories={categories}
            onSelectProject={setActiveProjectId}
            onAddProject={(newPrj) => setProjects(prev => [...prev, newPrj])}
            onExportProjectBackup={handleExportProjectBackup}
            onImportProjectBackup={handleImportProjectBackup}
            onSwitchToDatabase={() => setActiveTab('database')}
          />
        )}

      </main>

      {/* Item Edit Modal */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          categories={categories}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
        />
      )}

      {/* Audit Trail Drawer */}
      <AuditTrailDrawer
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
        items={items.filter(i => i.projectId === activeProjectId)}
        selectedItemFilter={auditTargetItemId}
      />

      {/* PDF Import Modal (No AI) */}
      <PdfImportModal
        isOpen={isPdfImportOpen}
        onClose={() => setIsPdfImportOpen(false)}
        onConfirmImport={handleConfirmPdfImport}
        activeProjectId={activeProjectId}
        categories={categories}
      />

      {/* Shared Network Sync Configuration Modal */}
      <SharedSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncConfig={syncConfig}
        onUpdateConfig={(cfg) => {
          setSyncConfig(cfg);
          saveSyncConfig(cfg);
        }}
        onSelectLocalFile={handleSelectSharedFile}
        onUnlinkFile={handleUnlinkSharedFile}
        onTriggerManualSync={() => performSync(false)}
        lastSyncTime={lastSyncTime}
        isSyncing={isSyncing}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-2.5 px-6 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-400">
          <span>SpecForge · 機器仕様書作成システム (完全ローカル・オフライン動作 ＆ 社内共有同期対応)</span>
          <span>PDF読込 (No AI) · 5分間隔自動同期 · 機器名/口径/材質/数量/納期</span>
        </div>
      </footer>

    </div>
  );
}
