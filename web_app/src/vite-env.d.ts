/// <reference types="vite/client" />

/** 构建期注入的站点版本号（来源：web_app/package.json 的 version，见 vite.config.ts 的 define） */
declare const __APP_VERSION__: string;
