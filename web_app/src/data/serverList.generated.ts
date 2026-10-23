/* 自动生成，勿手改。重新生成：node scripts/build_server_list.mjs */
export interface RadarServer {
    /** 主显示名（合服后的大服名） */
    name: string;
    /** 探测用子域：<server>.link.zhuxian.com.cn:29000 */
    server: string;
    serverId: string;
    /** 全部显示名，[0] 为主名，其余为合服前子服名 */
    aliases: string[];
    /** 官方开服时间 ISO 字符串，无数据为 null */
    openAt: string | null;
    /** 开服是否在一年内（进入「新服推荐」） */
    isNew: boolean;
}

export interface RadarZone {
    zhanQu: string;
    servers: RadarServer[];
}

export const SERVER_ZONES: RadarZone[] = [
    {
        "zhanQu": "体验服",
        "servers": [
            {
                "name": "先知",
                "server": "xianzhi",
                "serverId": "10086",
                "aliases": [
                    "先知"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "炎天战区",
        "servers": [
            {
                "name": "瑶梦故城",
                "server": "yaomenggucheng",
                "serverId": "525",
                "aliases": [
                    "瑶梦故城",
                    "瑶梦故城（山海苍龙）",
                    "瑶梦故城（瑞龙惊涛）",
                    "瑶梦故城（三界凡尘）"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "沧海琼音",
                "server": "canghaiqiongyin",
                "serverId": "2060",
                "aliases": [
                    "沧海琼音"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "夜羽凰踪",
                "server": "yeyuhuangzong",
                "serverId": "2027",
                "aliases": [
                    "夜羽凰踪"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "幻月冰心",
                "server": "huanyuebingxin",
                "serverId": "531",
                "aliases": [
                    "幻月冰心"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "皓月长生",
                "server": "haoyuechangsheng",
                "serverId": "545",
                "aliases": [
                    "皓月长生",
                    "皓月长生（神剑临霜）",
                    "皓月长生（青霄剑鸣）"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "阳天战区",
        "servers": [
            {
                "name": "决胜风云",
                "server": "jueshengfengyun",
                "serverId": "2064",
                "aliases": [
                    "决胜风云"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "月舞江南（惊天月舞）",
                "server": "yuewujiangnan",
                "serverId": "2065",
                "aliases": [
                    "月舞江南（惊天月舞）",
                    "月舞江南（龙吟江南）"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "独霸天关",
                "server": "dubatianguan",
                "serverId": "554",
                "aliases": [
                    "独霸天关"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "朱天战区",
        "servers": [
            {
                "name": "万毒行疆",
                "server": "wanduxingjiang",
                "serverId": "583",
                "aliases": [
                    "万毒行疆",
                    "万毒行疆（万毒弥天）"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "瀚海潮歌（蚀骨问道）",
                "server": "hanhaichaoge",
                "serverId": "803",
                "aliases": [
                    "瀚海潮歌（蚀骨问道）",
                    "瀚海潮歌",
                    "瀚海潮歌（潮音碎镜）"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "掣马凌霄",
                "server": "chemalingxiao",
                "serverId": "514",
                "aliases": [
                    "掣马凌霄"
                ],
                "openAt": "2026-02-06T12:00:00+08:00",
                "isNew": true
            },
            {
                "name": "剑啸青锋",
                "server": "jianxiaoqingfeng",
                "serverId": "2088",
                "aliases": [
                    "剑啸青锋"
                ],
                "openAt": "2026-04-10T12:00:00+08:00",
                "isNew": true
            }
        ]
    },
    {
        "zhanQu": "幽天战区",
        "servers": [
            {
                "name": "云龙剑影",
                "server": "yunlongjianying",
                "serverId": "990",
                "aliases": [
                    "云龙剑影"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "龙战乾坤（龙战于野）",
                "server": "longzhanqiankun",
                "serverId": "947",
                "aliases": [
                    "龙战乾坤（龙战于野）",
                    "龙战乾坤（决战乾坤）"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "十载仙梦",
                "server": "shizaixianmeng",
                "serverId": "2051",
                "aliases": [
                    "十载仙梦"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "九天奇缘",
                "server": "jiutianqiyuan",
                "serverId": "2008",
                "aliases": [
                    "九天奇缘"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "万里河山",
                "server": "wanliheshan",
                "serverId": "968",
                "aliases": [
                    "万里河山"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "变天战区",
        "servers": [
            {
                "name": "星耀至尊",
                "server": "xingyaozhizun",
                "serverId": "581",
                "aliases": [
                    "星耀至尊",
                    "星耀至尊（横刀争霸）"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "剑尊鸿威",
                "server": "jianzunhongwei",
                "serverId": "822",
                "aliases": [
                    "剑尊鸿威"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "雷龙耀世",
                "server": "leilongyaoshi",
                "serverId": "513",
                "aliases": [
                    "雷龙耀世"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "烽火流年",
                "server": "fenghuoliunian",
                "serverId": "804",
                "aliases": [
                    "烽火流年"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "金龙碧海",
                "server": "jinlongbihai",
                "serverId": "541",
                "aliases": [
                    "金龙碧海"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "碧瑶(电信)",
                "server": "biyao",
                "serverId": "847",
                "aliases": [
                    "碧瑶(电信)"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "苍天战区",
        "servers": [
            {
                "name": "紫电荣光",
                "server": "zidianrongguang",
                "serverId": "527",
                "aliases": [
                    "紫电荣光"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "霜雪玉龙",
                "server": "shuangxueyulong",
                "serverId": "507",
                "aliases": [
                    "霜雪玉龙"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "承天问影",
                "server": "chengtianwenying",
                "serverId": "550",
                "aliases": [
                    "承天问影"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "幻月御风",
                "server": "huanyueyufeng",
                "serverId": "502",
                "aliases": [
                    "幻月御风"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "昊天战区",
        "servers": [
            {
                "name": "创世绮梦",
                "server": "chuangshiqimeng",
                "serverId": "517",
                "aliases": [
                    "创世绮梦"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "龙腾碧霄",
                "server": "longtengbixiao",
                "serverId": "519",
                "aliases": [
                    "龙腾碧霄"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "碧瑶(网通)",
                "server": "biyaowangtong",
                "serverId": "821",
                "aliases": [
                    "碧瑶(网通)"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "雪琪(网通)",
                "server": "xueqiwangtong",
                "serverId": "2079",
                "aliases": [
                    "雪琪(网通)"
                ],
                "openAt": null,
                "isNew": false
            }
        ]
    },
    {
        "zhanQu": "扶风战区",
        "servers": [
            {
                "name": "大竹峰",
                "server": "dazhufeng",
                "serverId": "819",
                "aliases": [
                    "大竹峰"
                ],
                "openAt": null,
                "isNew": false
            },
            {
                "name": "小竹峰",
                "server": "xiaozhufeng",
                "serverId": "546",
                "aliases": [
                    "小竹峰"
                ],
                "openAt": "2026-03-13T12:00:00+08:00",
                "isNew": true
            },
            {
                "name": "滴血洞",
                "server": "dixuedong",
                "serverId": "2089",
                "aliases": [
                    "滴血洞"
                ],
                "openAt": "2026-05-22T12:00:00+08:00",
                "isNew": true
            },
            {
                "name": "无情海",
                "server": "wuqinghai",
                "serverId": "596",
                "aliases": [
                    "无情海"
                ],
                "openAt": "2026-07-03T12:00:00+08:00",
                "isNew": true
            },
            {
                "name": "朝阳峰",
                "server": "chaoyangfeng",
                "serverId": "2033",
                "aliases": [
                    "朝阳峰"
                ],
                "openAt": "2026-08-07T12:00:00+08:00",
                "isNew": true
            },
            {
                "name": "流波山",
                "server": "liuboshan",
                "serverId": "578",
                "aliases": [
                    "流波山"
                ],
                "openAt": "2026-09-19T12:00:00+08:00",
                "isNew": true
            },
            {
                "name": "小池镇",
                "server": "xiaochizhen",
                "serverId": "823",
                "aliases": [
                    "小池镇"
                ],
                "openAt": "2026-10-23T12:00:00+08:00",
                "isNew": true
            }
        ]
    }
];

export const SERVER_TOTAL = 39;
export const NEW_SERVER_TOTAL = 8;
