import React, { useState, useRef, useEffect } from 'react';
import { Bookmark, ChevronDown, Save, Copy, Trash2, X, ArrowLeftRight, FileInput } from 'lucide-react';
import clsx from 'clsx';
import { CompareDialog } from './CompareDialog';
import { ImportPresetDialog, type ImportPayload } from './ImportPresetDialog';
import { usePresets } from '../../hooks/usePresets';
import { useApp } from '../../context/AppContext';
import { DataService } from '../../services/DataService';

function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const FACTION_NAMES: Record<string, string> = { XIAN: '仙', FO: '佛', MO: '魔' };

interface NamingDialogState {
    mode: 'new' | 'saveAs';
}

export const PresetManager: React.FC = () => {
    const {
        userCharacter, classes, buffs, selectedDungeonId,
        activeBuffIds, buffValues,
        updateCharacterAttributes, updateCharacterClass, restoreBuffState
    } = useApp();
    const {
        presets,
        activePresetId,
        activePreset,
        isDirty,
        savePreset,
        saveAsPreset,
        importPreset,
        loadPreset,
        deletePreset
    } = usePresets();

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [namingDialog, setNamingDialog] = useState<NamingDialogState | null>(null);
    const [nameInput, setNameInput] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击网页任意其他地方时自动收回下拉菜单
    useEffect(() => {
        if (!dropdownOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [dropdownOpen]);

    // Step 12.1：打开方案对比弹窗（默认以当前激活方案为基准 A，列表里另一套为 B）
    const handleCompareClick = () => {
        if (presets.length < 2) return;
        setCompareOpen(true);
    };

    const buildBaseName = (): string => {
        const parts: string[] = [];
        const cls = classes.find(c => c.ClassID === userCharacter.ClassID);
        if (cls?.ClassName) parts.push(cls.ClassName);
        const factionName = FACTION_NAMES[userCharacter.Faction];
        if (factionName) parts.push(factionName);
        if (selectedDungeonId) {
            const dungeon = DataService.getInstance().getDungeons().find(d => d.DungeonID === selectedDungeonId);
            if (dungeon?.DungeonName) parts.push(dungeon.DungeonName);
        }
        const d = new Date();
        parts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        return parts.join(' ');
    };

    const openNamingDialog = (mode: 'new' | 'saveAs') => {
        setNameInput(buildBaseName());
        setNamingDialog({ mode });
        setDropdownOpen(false);
    };

    const confirmNaming = () => {
        const name = nameInput.trim();
        if (!name || !namingDialog) return;
        if (namingDialog.mode === 'new') {
            savePreset(name);
        } else {
            saveAsPreset(name);
        }
        setNamingDialog(null);
    };

    const handleSaveClick = () => {
        if (activePreset) {
            // 覆盖更新当前方案
            savePreset(activePreset.name);
        } else {
            // 未选中 -> 弹窗命名新建
            openNamingDialog('new');
        }
    };

    // Step 13：粘贴导入 —— 解析结果直接落成新方案并应用到当前页面
    const suggestImportName = (): string => {
        const cls = classes.find(c => c.ClassID === userCharacter.ClassID);
        const d = new Date();
        const md = (d.getMonth() + 1) + '-' + d.getDate();
        return (cls?.ClassName ?? '方案') + ' 导入 ' + md;
    };

    const handleImportConfirm = (payload: ImportPayload) => {
        const { name, parsed } = payload;
        const classId = parsed.classId ?? userCharacter.ClassID;
        const faction = parsed.faction ?? userCharacter.Faction;
        // 增益合并而非替换：粘贴只写了部分增益时，其余沿用当前勾选与数值
        const mergedActive = Array.from(new Set([...activeBuffIds, ...Object.keys(parsed.buffValues)]));
        const mergedValues = { ...buffValues, ...parsed.buffValues };

        updateCharacterClass(classId, faction);
        updateCharacterAttributes(parsed.attributes);
        restoreBuffState(mergedActive, mergedValues);
        importPreset(name, {
            classId,
            faction,
            attributes: parsed.attributes,
            activeBuffIds: mergedActive,
            buffValues: mergedValues
        });
        setImportOpen(false);
    };

    const handleDeleteClick = () => {
        if (activePreset) setConfirmDeleteId(activePreset.id);
    };

    const confirmDeleteTarget = confirmDeleteId ? presets.find(p => p.id === confirmDeleteId) ?? null : null;

    return (
        <div className={clsx('relative transition-all', dropdownOpen ? 'z-40' : 'z-10')}>
            {/* 标题（与职业/阵营选择对齐：均在卡片外） */}
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-purple-500 rounded-full"></span>
                属性方案
            </h2>

            <div className="glass-panel p-2.5 sm:p-3 relative">
                <div className="flex flex-col gap-2">
                    {/* 第一行：方案下拉切换（整行展开，名称完整展示） */}
                    <div ref={dropdownRef} className="relative w-full">
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(o => !o)}
                            title={activePreset?.name ?? '未保存'}
                            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950/60 text-slate-200 hover:border-slate-500 transition-colors text-sm"
                        >
                            <span className="flex items-center gap-2 min-w-0 flex-1">
                                <Bookmark className="w-4 h-4 text-cyan-400 shrink-0" />
                                <span className="truncate font-medium">{activePreset?.name ?? '未保存'}</span>
                                {isDirty && (
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                                        title="有未保存的修改"
                                    />
                                )}
                            </span>
                            <ChevronDown className={clsx('w-4 h-4 text-slate-400 shrink-0 transition-transform', dropdownOpen && 'rotate-180')} />
                        </button>

                        {dropdownOpen && (
                            <div
                                data-preset-menu
                                className="absolute left-0 right-0 z-50 mt-1.5 w-full max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/80 py-1 ring-1 ring-white/10 animate-in fade-in duration-100"
                            >
                                {presets.length === 0 && (
                                    <div className="px-3 py-2.5 text-xs text-slate-500">暂无保存的方案</div>
                                )}
                                {presets.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        title={p.name}
                                        onClick={() => {
                                            loadPreset(p.id);
                                            setDropdownOpen(false);
                                        }}
                                        className={clsx(
                                            'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800/80 transition-colors',
                                            p.id === activePresetId ? 'text-cyan-300 font-medium' : 'text-slate-300'
                                        )}
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <Bookmark className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{p.name}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 shrink-0">{formatTime(p.updatedAt)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 第二行：操作按钮平铺 */}
                    <div className="grid grid-cols-5 gap-1.5 pt-1.5 border-t border-slate-800/60">
                        <button
                            type="button"
                            onClick={handleCompareClick}
                            disabled={presets.length < 2}
                            title={presets.length < 2 ? '保存 2 套以上方案后可用' : '并排对比两套方案'}
                            className={clsx(
                                'w-full py-1.5 px-1 rounded-lg border flex items-center justify-center gap-1 text-xs font-medium transition-colors',
                                presets.length >= 2
                                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                                    : 'border-slate-800 text-slate-600 cursor-not-allowed'
                            )}
                        >
                            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                            <span>对比</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            className="w-full py-1.5 px-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 flex items-center justify-center gap-1 text-xs font-medium transition-colors"
                        >
                            <Save className="w-3.5 h-3.5 shrink-0" />
                            <span>保存</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setImportOpen(true)}
                            title="粘贴一段属性/增益数据，解析后存为方案"
                            className="w-full py-1.5 px-1 rounded-lg border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-1 text-xs font-medium transition-colors"
                        >
                            <FileInput className="w-3.5 h-3.5 shrink-0" />
                            <span>导入</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => openNamingDialog('saveAs')}
                            className="w-full py-1.5 px-1 rounded-lg border border-slate-700 bg-slate-950/70 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-1 text-xs font-medium transition-colors"
                        >
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                            <span>另存为</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            disabled={!activePreset}
                            className={clsx(
                                'w-full py-1.5 px-1 rounded-lg border flex items-center justify-center gap-1 text-xs font-medium transition-colors',
                                activePreset
                                    ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                    : 'border-slate-800 text-slate-600 cursor-not-allowed'
                            )}
                        >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>删除</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 命名弹窗（保存 / 另存为） */}
            {namingDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setNamingDialog(null)}
                    />
                    <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                                {namingDialog.mode === 'saveAs' ? (
                                    <Copy className="w-4 h-4 text-cyan-400" />
                                ) : (
                                    <Save className="w-4 h-4 text-cyan-400" />
                                )}
                                {namingDialog.mode === 'saveAs' ? '另存为方案' : '保存方案'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setNamingDialog(null)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onFocus={e => {
                                const len = e.target.value.length;
                                e.target.setSelectionRange(len, len);
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') confirmNaming();
                            }}
                            placeholder="输入方案名"
                            className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400 mb-2"
                        />
                        <p className="text-[11px] text-slate-500 mb-5">已自动填入 职业 阵营 副本 日期，可直接在末尾追加内容（如角色ID）。</p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setNamingDialog(null)}
                                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={confirmNaming}
                                disabled={!nameInput.trim()}
                                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 粘贴导入弹窗（Step 13） */}
            {importOpen && (
                <ImportPresetDialog
                    buffs={buffs}
                    classes={classes}
                    suggestName={suggestImportName()}
                    onClose={() => setImportOpen(false)}
                    onConfirm={handleImportConfirm}
                />
            )}

            {/* 方案对比弹窗（Step 12.1）：方案列表与 loadPreset 由本组件传入，避免两处各持一份 usePresets 状态导致方案名不同步 */}
            {compareOpen && (
                <CompareDialog
                    presets={presets}
                    activePresetId={activePresetId}
                    onClose={() => setCompareOpen(false)}
                />
            )}

            {/* 删除确认弹窗 */}
            {confirmDeleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setConfirmDeleteId(null)}
                    />
                    <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                                <Trash2 className="w-4 h-4 text-red-400" />
                                删除方案
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-400 mb-5">
                            确定删除方案「{confirmDeleteTarget.name}」吗？此操作不可恢复。
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    deletePreset(confirmDeleteTarget.id);
                                    setConfirmDeleteId(null);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-sm transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
