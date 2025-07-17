# Auto Router

## 功能描述

- 右键文件,如果是 Vue3 中的 router 下的 index.js/index.ts,则可以输入父路由的 name,子路由的 path 和子路由组件的路径,自动补全 index.js/index.ts,若子路由组件路径不存在,则自动创建文件,并填充默认模板
- 比如输入 Login sub-login views/login/SubLogin/index.vue,则会在 name 为 Login 的 children(若没有则新建 children)新增
  {
  path: 'sub-login',
  component: () => import('@/views/login/SubLogin/index.vue'),
  name: 'SubLogin',
  }

## 安装方法

1. 打开 VS Code
2. 进入扩展面板（Ctrl+Shift+X）
3. 搜索 "auto router" 并安装
