/**
 * L1 回归夹具 esbuild 入口（P0）
 * 聚合导出被测模块。esbuild 擦除 TS 类型后，DataService 的 private static instance
 * 即普通属性，harness 可在调用 matchLocalIntent 之前注入 mock 单例。
 * 详见 doc/AI对话全链路说明书与意图匹配维护指南.md 第七章。
 */
export { DataService, isValidEquip, isValidSkill } from '../web_app/src/services/DataService';
export { CopilotService } from '../web_app/src/services/CopilotService';
export { EQUIP_HUB_OPTIONS, EQUIP_HUB_GROUPS, EQUIP_HUB_COVERED_SLOTS } from '../web_app/src/services/equipHubOptions';
export { getEquipRefKey, YUNLING_SLOTS } from '../web_app/src/utils/equipStatKey';
