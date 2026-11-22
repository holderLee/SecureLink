# 必读事项：

1. 项目增加了 `commitlint` 统一 commit message，所以必须全局安装 commitizen/cz-cli  https://github.com/commitizen/cz-cli， 或使用 `npm run commit` 进行提交代码，不然代码将无法通过校验。
2. commit message 中存在必填项，其中`scope`指的是修改范围，`ISSUES CLOSED` 指的是禅道编号，若无禅道任务，请让产品去新建，实在不行填写none。
3. `commitlint` 生效依赖于当前项目是否已经初始化 `git 环境`，因此如果发现 `commitlint` 不生效，只需初始化 `git环境` 后 `重新安装依赖` 即可。
4. 如存在无法提交，commitlint不生效，其余lint规则冲突等情况，请找相关人员协助，请不要直接进行强推操作。
5. 项目引入了`vue-use https://vueuse.org/`作为第三方工具集合，使用hook时请在上面查看是否有替代，或进行二次封装。
6. 项目要求node版本大于等于 **16**。

# 技术栈：

1. vue3 + typeScript + element-plus + vite + pinia。
2. 项目全部使用 script setup，请不要使用tsx，vue3并不适合。
3. 不要在vue3中使用vue2的语法。

# 开发打包：

```bash
# 克隆代码
git clone http://gt.superads.cn/common/frontend/vue3-ts-template
# 切换目录
cd vue3-ts-template
# 安装依赖
npm i
# 启动运行
npm run dev
# 打包
npm run build:test
npm run build:prod
```

# 提交代码：

```bash
# 全局安装 
npm i -g commitizen
# 暂存全部文件
git add .
# 提交commit
git cz
# 按照提示输入或选择提交message
# 推送代码
git push
```

# 目录结构：

```bash

├──.vscode                      #vscode 配置
├── dist                        #打包 dist
├── public                      #静态资源
├── src                         #主结构
│   ├── api                         #接口定义
│   ├── assets                      #静态资源
│   ├── components                  #公共组件
│   ├── constants                   #常量
│   ├── directive                   #自定义指令
│   │    └── Copy                       #复制指令
│   │    └── Lazy                       #图片懒加载指令
│   │    └── Permission                 #按钮&角色权限指令
│   ├── enums                       #枚举
│   ├── lang                        #中英文配置
│   ├── layout                      #页面主组件
│   ├── router                      #路由配置
│   ├── store                       #pinia
│   ├── styles                      #通用样式
│   ├── typings                     #类型声明
│   │    └── env                        #环境类型定义
│   │    └── global                     #全局类型定义
│   │    └── router                     #路由类型定义
│   │    └── xxx.d.ts                   #其他杂七杂八的类型定义
│   ├── utils                       #工具方法
│   ├── views                       #业务页面
│   ├── App.vue                     #入口组件
│   └── main.ts                     #入口文件
│   └── permission.ts               #权限
│   └── settings.ts                 #系统Layout配置
├── .env.development            #开发&测试环境变量
├── .env.production             #生产环境变量
├── .eslintignore               #eslint忽略列表
├── .eslintrc.cjs               #eslint配置
├── .gitignore                  #git提交忽略文件
├── .prettierrc.cjs             #prettier配置
├── .stylelintignore            #stylelint忽略列表
├── .stylelintrc.cjs            #stylelint配置
├── commitlint.config.js        #commitlint配置
├── index.html                  #静态html
├── package.json                #包管理&脚本
├── README.md                   #注意事项
├── tsconfig.json               #ts配置
├── vite.config.ts              #vite配置

```

# 关于 constants 与 enums：

```shell
constants 与 enums 是关联在一起的。
constants 用于定义常用的文本常量，其key对应相应的enums，如：

#enums
export enum MenuTypeEnum {
  CATALOG = "CATALOG",
  MENU = "MENU",
  BUTTON = "BUTTON",
}

#constants
import { MenuTypeEnum } from "../enums/menu";
export const menuTypeConstant = [
  {
    label: "目录",
    value: MenuTypeEnum.CATALOG,
  },
  {
    label: "菜单",
    value: MenuTypeEnum.MENU,
  },
  {
    label: "按钮",
    value: MenuTypeEnum.BUTTON,
  },
];

```

# 关于Vue3：

1. 请不要对reactive进行解构，这会破坏其响应式结构，这是因为vue3的响应式是通过proxy实现的。
2. 同样的，请不要对props进行解构，这也会破坏其响应式结构。
3. 个人建议尽量使用ref而非reactive，保持风格统一的同时，也能避免很多坑。
4. 请 一定 一定 一定 要写注释以及interface，尽量不使用any类型，不然我们何必使用typeScript。
