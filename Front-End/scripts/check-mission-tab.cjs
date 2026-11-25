// Run with: node scripts/check-mission-tab.cjs
// Native views are stubbed; route parsing, destination resolution and state
// reduction use the installed Expo Router implementation and actual app files.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const project = path.resolve(__dirname, "..");
const app = path.join(project, "app");
const expo = path.dirname(require.resolve("expo-router/package.json"));
const load = (file) => require(path.join(expo, "build", file));
const { getRoutes } = load("getRoutesCore");
const { getReactNavigationConfig } = load("getReactNavigationConfig");
const { getStateFromPath } = load("fork/getStateFromPath");
const { resolveHref } = load("link/href");
const { resolveNavigationDestination } = load("global-state/resolveNavigationDestination");
const { indexNavigationTree, reduceNavigationTree } = load("global-state/reduceNavigationTree");
const { createInitialState } = load("react-navigation/core/createInitialState");
const { createRouteKeyMinter, getChainFromRouteKey } = load("react-navigation/routers/stateKeys");
const { StackRouter } = load("react-navigation/routers/StackRouter");
const { TabRouter } = load("react-navigation/routers/TabRouter");

function routeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? routeFiles(file) : /\.[jt]sx?$/.test(file) ? [file] : [];
  });
}
const context = () => ({ default() {} });
context.keys = () => routeFiles(app).map((file) => `./${path.relative(app, file).replaceAll("\\", "/")}`);
const routeNode = getRoutes(context, { ignoreEntryPoints: true, importMode: "lazy" });
const linking = getReactNavigationConfig(routeNode, false);
const tabsNode = routeNode.children.find((node) => node.route === "(tabs)");
assert(tabsNode, "The tabs layout must exist");
const dashboard = tabsNode.children.find((node) => node.route === "missions");
assert(dashboard, "The trophy needs a dedicated missions route");
assert.equal(dashboard.type, "route");
assert.equal(dashboard.children.length, 0, "The trophy destination cannot own feature history");

const names = ["home", "ai-guide", "missions", "voucher", "account", "mission"];
let current;
let currentPath = "/home";
let registry;
let prevented = false;
let dispatches = 0;
let navigations = [];

function reduce(action) {
  const tree = indexNavigationTree(current);
  const result = reduceNavigationTree(action, registry, { tree, origin: tree.rootNode });
  assert.equal(result.handled, true, `Action ${action.type} should be handled`);
  current = result.nextState;
}
function navigate(href, type = "NAVIGATE") {
  href = resolveHref(href);
  navigations.push(href);
  const targetState = getStateFromPath(href, linking);
  assert(targetState, `The real route matcher must resolve ${href}`);
  reduce(resolveNavigationDestination({
    targetState,
    navigationState: current,
    routeNode,
    registry,
    action: { type, payload: {} },
  }));
}
function register(state, router) {
  const options = { routeNames: state.routeNames, routeGetIdList: {} };
  registry.set(state.key, {
    reduce: (slice, action) => router.getStateForAction(slice, action, options),
    getStateForRouteFocus: router.getStateForRouteFocus,
  });
}
function setup(focused, feature, withDashboard = true) {
  registry = new Map();
  dispatches = 0;
  navigations = [];
  current = { ...createInitialState({ routeNames: ["(tabs)"], parentChain: "" }), type: "stack" };
  const tabs = {
    ...createInitialState({ routeNames: names, parentChain: getChainFromRouteKey(current.routes[0].key) }),
    type: "tab",
  };
  const minter = createRouteKeyMinter(tabs);
  tabs.routes = names.filter((name) => withDashboard || name !== "missions").map((name) => ({
    key: minter.mint(name), name,
  }));
  tabs.routeKeySeq = minter.routeKeySeq;
  tabs.index = tabs.routes.findIndex((route) => route.name === focused);
  const mission = tabs.routes.find((route) => route.name === "mission");
  const missionNode = tabsNode.children.find((node) => node.route === "mission");
  const stackNames = missionNode.children.map((node) => node.route);
  const stack = {
    ...createInitialState({ routeNames: stackNames, initialRouteName: "index", parentChain: getChainFromRouteKey(mission.key) }),
    type: "stack",
  };
  const featureMinter = createRouteKeyMinter(stack);
  stack.routes.push({ key: featureMinter.mint(feature), name: feature, params: { from: "home", id: "recent-task" } });
  stack.routeKeySeq = featureMinter.routeKeySeq;
  stack.index = 1;
  mission.state = stack;
  mission.params = { screen: feature, from: "home" };
  current.routes[0].state = tabs;
  register(current, StackRouter({}));
  register(tabs, TabRouter({ backBehavior: "history" }));
  register(stack, StackRouter({}));
  return stack;
}

const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const react = { createElement: element };
const themeValue = new Proxy({}, { get: () => 0 });
const router = {
  navigate,
  push: (href) => navigate(href, "PUSH"),
  replace: (href) => navigate(href, "REPLACE"),
};
let premiumStatus = "inactive";
const stubs = {
  react,
  "react-native": {
    View: "View", Text: "Text", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator",
    StyleSheet: { create: (value) => value },
  },
  "expo-router": { router, Tabs: { Screen: "Screen" }, Redirect: "Redirect", usePathname: () => currentPath },
  "@expo/vector-icons": { Ionicons: "Icon" },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
  "@/context/AuthContext": { useAuth: () => ({ isAuthenticated: true, isLoading: false }) },
  "@/hooks/usePremiumAccess": { usePremiumAccess: () => ({ status: premiumStatus, retry() {} }) },
  "@/i18n/LocaleContext": { useLocale: () => ({ t: (key) => key }) },
  "@/utils/haptics": { haptics: { tap() {} } },
  "@/theme/colors": { colors: themeValue, radius: themeValue, shadow: {}, spacing: (value) => value, TAB_BAR_HEIGHT: 60 },
};

function loadComponent(file, extraSource = "") {
  const source = fs.readFileSync(path.join(project, file), "utf8");
  const compiled = ts.transpileModule(`${source}\n${extraSource}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const sandbox = {
    exports: {},
    require(name) { assert(name in stubs, `Unexpected native dependency ${name}`); return stubs[name]; },
  };
  vm.runInNewContext(compiled, sandbox, { filename: file });
  return sandbox.exports;
}

const { CustomTabBar: TestTabBar } = loadComponent("app/(tabs)/_layout.tsx", "export { CustomTabBar };");

function findElements(node, type) {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type));
  if (!node || typeof node !== "object") return [];
  return node.type === type ? [node] : findElements(node.props?.children, type);
}

const findPressables = (node) => findElements(node, "Pressable");
function pressTrophy() {
  const tabs = current.routes[0].state;
  // Match Expo's footer view state: routes carry only names/keys/params.
  const state = { index: tabs.index, routes: tabs.routes.map(({ key, name, params }) => ({ key, name, params })) };
  if (!state.routes.some((route) => route.name === "missions")) state.routes.push({ key: "missions", name: "missions" });
  const descriptors = Object.fromEntries(state.routes.map((route) => [route.key, {
    navigation: { getState: () => current.routes[0].state, dispatch(action) { dispatches++; reduce(action); } },
  }]));
  const bar = TestTabBar({ state, descriptors, emitter: { emit: () => ({ defaultPrevented: prevented }) } });
  const buttons = findPressables(bar);
  assert.equal(buttons.length, 5, "Feature stack must not become a sixth footer button");
  const trophy = buttons.find((button) => button.props.accessibilityLabel === "tabs.mission");
  assert(trophy, "The actual footer must expose the trophy button");
  trophy.props.onPress();
}

let checks = 0;
for (const feature of ["create", "itineraries", "completed", "events/index", "collection/index", "[id]"]) {
  for (const focused of names) {
    const originalFeature = setup(focused, feature);
    currentPath = focused === "mission" ? "/mission" : `/${focused}`;
    for (let repeat = 0; repeat < 4; repeat++) {
      pressTrophy();
      const tabs = current.routes[0].state;
      const selected = tabs.routes[tabs.index];
      assert.equal(selected.name, "missions", `Trophy from ${focused} after ${feature}`);
      assert.equal(selected.state, undefined, "The trophy tab must stay a leaf");
      assert.equal(tabs.routes.find((route) => route.name === "mission").state, originalFeature,
        "Opening the dashboard must not restore, mutate or delete feature history");
      assert.equal(dispatches, 0, "The trophy must not dispatch actions into another tab's stack");
      assert.equal(navigations.at(-1), "/(tabs)/missions");
      navigate("/(tabs)/home");
      currentPath = "/home";
    }
    checks++;
  }
}
setup("home", "completed", false);
currentPath = "/home";
pressTrophy();
assert.equal(current.routes[0].state.routes[current.routes[0].state.index].name, "missions");
checks++;
setup("home", "completed");
const beforePrevented = current;
prevented = true;
pressTrophy();
assert.equal(current, beforePrevented);
assert.equal(navigations.length, 0);
checks++;
console.log(`PASS: ${checks} mission-tab scenarios using actual footer, filesystem routes and Expo reducers.`);

for (const name of ["BackHeader", "Button", "Card", "ErrorBanner", "GradientHero",
  "PremiumMissionRow", "PremiumProvincePicker", "ScreenContainer"]) {
  stubs[`@/components/${name}`] = { [name]: name };
}
stubs["@/api/endpoints/premium"] = {};
stubs["@/api/http"] = {};
stubs["@/data/premiumPlans.json"] = require("../src/data/premiumPlans.json");
stubs["@/components/PremiumAccessGate"] = loadComponent("src/components/PremiumAccessGate.tsx");
const { PremiumMissionEntries } = loadComponent("src/components/PremiumEntry.tsx");
const { default: SpecialMissionsScreen } = loadComponent("app/(tabs)/mission/premium/special.tsx");

setup("missions", "itineraries");
for (const status of ["inactive", "loading", "unavailable"]) {
  premiumStatus = status;
  const entries = findPressables(PremiumMissionEntries());
  assert.equal(entries.length, 1, `Special missions must be visible when access is ${status}`);
  assert(entries[0].props.children.some(({ props }) => props.name === "lock-closed-outline"));
}
premiumStatus = "inactive";
findPressables(PremiumMissionEntries())[0].props.onPress();
assert.equal(navigations.at(-1), "/(tabs)/mission/premium/special");
const specialGate = SpecialMissionsScreen();
const locked = specialGate.type(specialGate.props);
assert.equal(locked.type, "Redirect");
router.replace(locked.props.href);
assert.equal(navigations.at(-1), "/(tabs)/mission/premium/plans?from=special");

premiumStatus = "unavailable";
setup("mission", "premium/special");
const unavailable = specialGate.type(specialGate.props);
const viewPlans = findElements(unavailable, "Button").find((button) => button.props.title === "premium.viewPlans");
assert(viewPlans, "A subscription error must still offer a way to view the plans");
viewPlans.props.onPress();
assert.equal(navigations.at(-1), "/(tabs)/mission/premium/plans?from=special");

premiumStatus = "active";
assert.equal(specialGate.type(specialGate.props), specialGate.props.children);
const entries = findPressables(PremiumMissionEntries());
assert.equal(entries.length, 2);
assert(entries[0].props.children.some(({ props }) => props.name === "chevron-forward"));
console.log("PASS: Province missions stay visible, route to Premium when locked and open with active access.");
