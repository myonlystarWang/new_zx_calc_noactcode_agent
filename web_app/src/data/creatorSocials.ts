/**
 * 作者社交账号配置（AboutPage「做这个站的人」卡片）
 *
 * 填法：
 * - url：主页链接，点整块二维码卡即跳转。
 * - qrImage：二维码图，放 `web_app/public/social/` 下，填 '/social/xxx.png'。
 *        留空则用 url 现场生成（qrcode 动态引入，不进首屏包）。
 * - 两个字段都留空 = 该账号不渲染。
 */
export interface CreatorSocial {
    id: 'bilibili' | 'douyin';
    label: string;
    handle: string;
    url: string;
    qrImage?: string;
}

export const CREATOR_SOCIALS: CreatorSocial[] = [
    {
        id: 'bilibili',
        label: 'B站',
        handle: '一头小罗卜',
        url: 'https://b23.tv/DACBC5r',
        qrImage: '/social/bilibili.png',
    },
    {
        id: 'douyin',
        label: '抖音',
        // 不带「抖音号」前缀：320px 窄屏两列等分时会被截断，而上面一行已经是「抖音」
        handle: '1398631127',
        url: 'https://v.douyin.com/mr1LhZBwTjk',
        qrImage: '/social/douyin.png',
    },
];
