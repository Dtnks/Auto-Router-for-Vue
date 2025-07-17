const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
function activate(context) {
  // 注册命令
  let commandOfGetFileState = vscode.commands.registerCommand(
    "getFileState",
    (uri) => {
      // 文件路径
      const filePath = uri.path.substring(1);

      fs.stat(filePath, async (err, stats) => {
        if (err) {
          vscode.window.showErrorMessage(`获取文件时遇到错误了${err}!!!`);
        }

        if (stats.isDirectory()) {
          vscode.window.showWarningMessage(
            `选择的是文件夹，不是路由文件，请重新选择！！！`
          );
        }
        let forderArr = filePath.split("/");
        if (
          stats.isFile() &&
          forderArr.pop().includes("index") &&
          forderArr.pop().includes("router")
        ) {
          const userInput = await vscode.window.showInputBox({
            prompt:
              "请输入新增路由父路由的name,子路由和子路由组件路径中间用空格隔开或者同级增加路由使用/路由name开头,其他不变",
            placeHolder: "例如:home(或者是增加同级路由 /home) sub-home view/main/ubHome.vue",
            validateInput: (value) => {
              if (!value || value.trim() === "") {
                return "输入不能为空！";
              }
              return null; // 返回 null 表示验证通过
            },
          });
          const [parent, child, componentPath] = userInput.split(" ");

          createVueFileIfNotExists(forderArr.join("/") + "/" + componentPath);
          insertRouteConfig(filePath, parent, child, componentPath);
        } else {
          vscode.window.showWarningMessage(`请选择路由文件`);
        }
      });
    }
  );

  // 将命令放入其上下文对象中，使其生效
  context.subscriptions.push(commandOfGetFileState);
}

async function insertRouteConfig(routerPath, parent, child, componentPath) {
  const routerContent = fs.readFileSync(routerPath, "utf-8");

  // 提取 routes 数组部分
  const routesStartIndex = routerContent.indexOf("routes: [");
  if (routesStartIndex === -1) {
    throw new Error("无法解析路由文件，请确保 routes 数组存在");
  }

  const stack = [];
  let start = routesStartIndex + "routes: ".length;
  let end = start;
  for (; end < routerContent.length; end++) {
    const char = routerContent[end];
    if (char === "[") {
      stack.push(char);
    } else if (char === "]") {
      if (stack.length === 0) {
        break;
      }
      stack.pop();
      if (stack.length === 0) {
        break;
      }
    }
  }

  if (stack.length !== 0) {
    throw new Error("无法解析路由文件，routes 数组括号不匹配");
  }
  const routesArray = eval(`(${routerContent.slice(start, end+1)})`);

  const newRoute = {
    path: child,
    component: eval(`() => import('@/${componentPath}')`),
    name: child
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(""),
  };
  let flag
  if(parent.startsWith('/')){
    parent=parent.slice(1)
    flag=insertSiblingRouteByName(routesArray, parent, newRoute);
  }else{ 
    flag=insertNestedRouteByName(routesArray, parent, newRoute);
  }
  if(flag==null){
    vscode.window.showWarningMessage(`未找到名为 ${parent} 的路由，无法插入子路由`);
  }
  const updatedContent = routerContent.replace(
    /routes:\s*\[([\s\S]*)\]/,
    `routes: ${routesToString(routesArray)}`
  );
  // // 写回文件
  fs.writeFileSync(routerPath, updatedContent);
}
function routesToString(routes, indentLevel = 0) {
  const indent = "    ".repeat(indentLevel);
  const nextIndent = "    ".repeat(indentLevel + 1);

  // 递归生成每个路由对象的字符串
  const routeStrings = routes.map((route, index) => {
    const entries = [];

    // 遍历对象的每个属性
    Object.entries(route).forEach(([key, value], propIndex) => {
      let propString;

      // 处理 component 字段（保留函数语法）
      if (key === "component" && typeof value === "function") {
        propString = `  ${nextIndent}${key}: ${value.toString()}`;
      }
      // 处理 children 字段（递归处理）
      else if (key === "children" && Array.isArray(value)) {
        propString = `  ${nextIndent}${key}: ${routesToString(
          value,
          indentLevel + 1
        )}`;
      }
      // 处理普通字段（字符串、数字等）
      else {
        propString = `  ${nextIndent}${key}: ${
          typeof value === "string"
            ? JSON.stringify(value)
            : JSON.stringify(value)
        }`;
      }

      // 添加逗号（除最后一个属性外）
      if (propIndex < Object.entries(route).length - 1) {
        propString += ",";
      }

      entries.push(propString);
    });

    // 组合成对象字符串（添加逗号，除最后一个路由外）
    const routeStr = `${nextIndent}{\n${entries.join("\n")}\n${nextIndent}}`;
    if (index < routes.length - 1) {
      return routeStr + ",";
    }
    return routeStr;
  });

  // 组合成数组字符串
  return `[\n${routeStrings.join("\n")}\n${indent}]`;
}
function insertNestedRouteByName(routes, parentName, newRoute) {
  for (const route of routes) {
    if (route.name === parentName) {
      if (!route.children) route.children = [];
      route.children.push({
        ...newRoute,
      });
      return routes;
    }
    if (route.children) {
      insertNestedRouteByName(route.children, parentName, newRoute);
    }
  }
  return null;
}

function insertSiblingRouteByName(routes, siblingName, newRoute) {
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (route.name === siblingName) {
      // 在同级位置插入新路由
      routes.splice(i + 1, 0, { ...newRoute });
      return routes;
    }
    if (route.children) {
      const result = insertSiblingRouteByName(route.children, siblingName, newRoute);
      if (result) {
        return routes;
      }
    }
  }
  return null;
}

function deactivate() {}

async function createVueFileIfNotExists(filePath) {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      // 确保目录存在
      const dirName = path.dirname(filePath);
      fs.mkdirSync(dirName, { recursive: true });

      // 写入Vue单文件组件模板
      const templateContent = `<template>
  <!-- 组件模板 -->
</template>
 
<script>
export default {
  name: 'ComponentName',
  data() {
    return {};
  }
}
</script>
 
<style scoped>
/* 样式代码 */
</style>`;

      // 使用同步写入确保文件创建完成
      fs.writeFileSync(filePath, templateContent, { encoding: "utf-8" });
      console.log(`文件已创建: ${filePath}`);
    } else {
      console.log(`文件已存在: ${filePath}`);
    }
  } catch (error) {
    console.error("操作失败:", error);
    throw error;
  }
}
module.exports = {
  activate,
  deactivate,
};
