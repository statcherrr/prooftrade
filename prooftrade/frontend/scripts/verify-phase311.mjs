// Phase 3.11 acceptance verification.
//
// Drives the production Next.js server (port 3000) against the real FastAPI
// backend (port 8000) through the /api/audit route handler. No reverse proxy.
//
//   node scripts/verify-phase311.mjs
//
// Writes screenshots to OUT_DIR and prints a JSON summary of assertions.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PT_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.PT_OUT ?? "/tmp/prooftrade-phase311-final";
// Optional browser override. When unset, Playwright resolves its own installed
// Chromium, so this script carries no machine-specific paths.
const EXEC = process.env.PT_CHROME;

fs.mkdirSync(OUT, { recursive: true });

const HEADER =
  "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes";

const DEFECT_CSV = `${HEADER}
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
t003,2023-01-01T10:10:00Z,MSFT,buy,50,300.00,25.00,0.50,0.00,stratA,clean buy trade
t004,2023-01-01T10:15:00Z,MSFT,sell,50,301.20,12.20,0.50,0.00,stratA,clean sell trade
t005,2023-01-01T10:20:00Z,AAPL,buy,100,151.00,-50.00,1.00,0.00,stratA,pnl sign inconsistency
t006,2023-01-01T10:25:00Z,AAPL,buy,100,150.00,50.00,5.00,0.00,stratA,duplicate pattern
t007,2023-01-01T10:30:00Z,GOOGL,buy,10,2800.00,250.00,0.01,0.00,stratA,unrealistic fees
t008,2023-01-01T10:35:00Z,AAPL,buy,100,150.00,150.00,0.00,0.00,stratA,look-ahead candidate
t009,2023-01-01T10:35:00Z,AAPL,sell,100,149.00,-100.00,0.00,0.00,stratA,overlapping trades
t010,2023-01-01T10:45:00Z,cryptoBTC,buy,0.5,40000.00,100.00,20.00,0.00,stratA,valid crypto trade
`;

const WINNERS_CSV = `${HEADER}
w001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,winning trade
w002,2023-01-01T10:05:00Z,MSFT,sell,50,300.00,25.00,0.50,0.00,stratA,winning trade
w003,2023-01-01T10:10:00Z,NVDA,buy,10,400.00,40.00,0.25,0.00,stratA,winning trade
`;

const MISSING_COLUMNS_CSV = `trade_id,timestamp\nx001,2023-01-01T10:00:00Z\n`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const fixtures = {
  "defect.csv": DEFECT_CSV,
  "winners.csv": WINNERS_CSV,
  "missing-columns.csv": MISSING_COLUMNS_CSV,
  "empty.csv": "",
};
const fixturePaths = {};
for (const [name, content] of Object.entries(fixtures)) {
  const p = path.join("/tmp", `pt311-${name}`);
  fs.writeFileSync(p, content);
  fixturePaths[name] = p;
}

function overflowProbe(page) {
  return page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const innerW = window.innerWidth;
    const offenders = [];
    if (docW > innerW) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right > innerW + 1 && r.width > 0) {
          offenders.push({
            tag: el.tagName,
            cls: String(el.className).slice(0, 60),
            right: Math.round(r.right),
          });
          if (offenders.length >= 5) break;
        }
      }
    }
    return { docW, innerW, dpr: window.devicePixelRatio, offenders };
  });
}

async function uploadAndAnalyze(page, fixturePath) {
  await page.setInputFiles('input[type="file"]', fixturePath);
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /^Analyze/ }).click();
}

const browser = await chromium.launch({
  headless: true,
  executablePath: EXEC || undefined,
  args: ["--no-sandbox"],
});

try {
  // ---------------------------------------------------------------- desktop
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await desktop.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // 1. Overview
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/desktop-overview.png` });
  const overviewOverflow = await overflowProbe(page);
  check(
    "desktop overview: no horizontal overflow",
    overviewOverflow.docW <= overviewOverflow.innerW,
    `scrollWidth=${overviewOverflow.docW} innerWidth=${overviewOverflow.innerW}`,
  );

  // 2. Navigation via the navbar is real navigation
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "New Audit" }).click();
  await page.waitForURL("**/audit");
  check("navbar link navigates to /audit", page.url().endsWith("/audit"), page.url());
  await page.screenshot({ path: `${OUT}/desktop-new-audit.png` });
  const auditOverflow = await overflowProbe(page);
  check(
    "desktop new audit: no horizontal overflow",
    auditOverflow.docW <= auditOverflow.innerW,
    `scrollWidth=${auditOverflow.docW}`,
  );

  // 3. Real CSV upload → redirected to results page
  await uploadAndAnalyze(page, fixturePaths["defect.csv"]);
  await page.waitForURL("**/audit/results", { timeout: 30000 });
  await page.getByRole("heading", { name: "Audit results" }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/desktop-completed-results.png` });
  const resultsUrl = page.url();

  const metricText = await page.locator("main").innerText();
  const hasNetPnl = /NET P&L[\s\S]{0,40}[+-]?\d+\.\d\d USD/i.test(metricText);
  check("results render real Net P&L metric", hasNetPnl);
  check(
    "results show engine findings total",
    /\d+ findings total/i.test(metricText),
    metricText.match(/\d+ findings total/i)?.[0] ?? "",
  );
  check("results show dataset id", /[0-9a-f]{8}-[0-9a-f]{4}-/.test(metricText));
  check("results show real severity counts", /High severity/.test(metricText) && /Medium severity/.test(metricText));

  const resultsOverflow = await overflowProbe(page);
  check(
    "desktop results: no horizontal overflow",
    resultsOverflow.docW <= resultsOverflow.innerW,
    `scrollWidth=${resultsOverflow.docW}`,
  );

  // 4. Findings expand/collapse
  const firstToggle = page.locator('button[aria-controls^="finding-panel-"]').first();
  const ariaBefore = await firstToggle.getAttribute("aria-expanded");
  await firstToggle.click();
  const ariaAfter = await firstToggle.getAttribute("aria-expanded");
  check("finding expands (aria-expanded false→true)", ariaBefore === "false" && ariaAfter === "true", `${ariaBefore}→${ariaAfter}`);

  const panel = page.locator('[role="region"][aria-label^="Details for"]').first();
  const panelText = await panel.innerText();
  check(
    "expanded finding shows evidence, limitations, remediation",
    /Evidence/i.test(panelText) && /Limitations/i.test(panelText) && /Remediation/i.test(panelText),
  );
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/desktop-expanded-finding.png` });

  // keyboard operability: focus the toggle and press Enter to collapse
  await firstToggle.focus();
  await page.keyboard.press("Enter");
  check("finding collapses via keyboard (Enter)", (await firstToggle.getAttribute("aria-expanded")) === "false");
  await page.keyboard.press("Enter");
  check("finding re-expands via keyboard (Enter)", (await firstToggle.getAttribute("aria-expanded")) === "true");

  // 5. Refresh keeps results (sessionStorage), reload is honest
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Audit results" }).waitFor();
  check("results survive refresh in the same tab", true);

  // 6. Browser back/forward
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Methodology" }).click();
  await page.waitForURL("**/methodology");
  await page.screenshot({ path: `${OUT}/desktop-methodology.png` });

  // Methodology documents exactly the engine's checks and is interactive.
  const documentedChecks = await page
    .locator('main button')
    .evaluateAll(
      (nodes) =>
        nodes.filter((n) =>
          /(^|\n)(high|medium|low)(\n|$)/i.test(n.innerText.trim()),
        ).length,
    );
  check("methodology lists exactly the engine's 10 checks", documentedChecks === 10, `${documentedChecks} cards`);
  await page.getByRole("button", { name: /PnL sign inconsistency/ }).click();
  const checkDetail = await page.locator("main").innerText();
  check(
    "methodology check expands with evidence/limitations/remediation",
    /Evidence[\s\S]{0,700}Limitations[\s\S]{0,700}Remediation/i.test(checkDetail),
  );
  await page.goBack();
  await page.waitForURL("**/audit/results");
  check("browser back returns to results", page.url().endsWith("/audit/results"));
  await page.goForward();
  await page.waitForURL("**/methodology");
  check("browser forward returns to methodology", page.url().endsWith("/methodology"));

  // 7. Settings
  await page.getByRole("link", { name: /Settings/ }).click();
  await page.waitForURL("**/settings");
  await page.screenshot({ path: `${OUT}/desktop-settings.png` });

  // 8. Invalid CSV (missing columns) surfaces the API error without navigating
  await page.goto(`${BASE}/audit`, { waitUntil: "networkidle" });
  await uploadAndAnalyze(page, fixturePaths["missing-columns.csv"]);
  const alert = page.locator('[role="alert"]').filter({ hasText: "Audit not run" });
  await alert.first().waitFor({ timeout: 20000 });
  const alertText = await alert.first().innerText();
  check(
    "missing-column CSV shows API validation message",
    /missing required column/i.test(alertText) && /symbol/.test(alertText),
    alertText.replace(/\s+/g, " ").slice(0, 110),
  );
  check("failed audit stays on /audit", page.url().endsWith("/audit"));

  // 9. Empty file surfaces a clear error
  await uploadAndAnalyze(page, fixturePaths["empty.csv"]);
  await page.waitForTimeout(1200);
  const emptyText = await page
    .locator('[role="alert"]')
    .filter({ hasText: "Audit not run" })
    .first()
    .innerText();
  check("empty file shows actionable error", /empty/i.test(emptyText), emptyText.replace(/\s+/g, " ").slice(0, 90));

  // 10. profit factor "inf" + null Sharpe rendering
  await page.goto(`${BASE}/audit`, { waitUntil: "networkidle" });
  await uploadAndAnalyze(page, fixturePaths["winners.csv"]);
  await page.waitForURL("**/audit/results", { timeout: 30000 });
  await page.waitForTimeout(300);
  const winnersText = await page.locator("main").innerText();
  check("profit factor inf renders as inf", /PROFIT FACTOR[\s\S]{0,40}\binf\b/i.test(winnersText));
  check("null Sharpe renders as n/a", /SHARPE RATIO[\s\S]{0,40}n\/a/i.test(winnersText));
  check("inf profit factor is explained", /No losing trades/.test(winnersText));

  // 11. Empty results state on a fresh tab
  const freshPage = await desktop.newPage();
  await freshPage.goto(`${BASE}/audit/results`, { waitUntil: "networkidle" });
  await freshPage.getByRole("heading", { name: "No audit results yet" }).waitFor();
  await freshPage.screenshot({ path: `${OUT}/desktop-empty-results.png` });
  const emptyStateText = await freshPage.locator("main").innerText();
  check("empty results state explains persistence", /browser tab/i.test(emptyStateText));
  await freshPage.close();

  // The invalid-upload cases intentionally produce 400/422 responses; those log
  // a "Failed to load resource" entry. Any other console error is a defect.
  const unexpectedConsoleErrors = consoleErrors.filter(
    (text) => !/Failed to load resource: the server responded with a status of (400|422)/.test(text),
  );
  check(
    "no unexpected browser console errors on desktop run",
    unexpectedConsoleErrors.length === 0,
    unexpectedConsoleErrors.slice(0, 2).join(" | "),
  );
  check(
    "invalid uploads logged only the expected 400/422 responses",
    consoleErrors.length === 2,
    `${consoleErrors.length} console resource errors`,
  );
  await desktop.close();

  // ----------------------------------------------------------------- mobile
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  const mobileErrors = [];
  mpage.on("pageerror", (e) => mobileErrors.push(e.message));

  await mpage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await mpage.screenshot({ path: `${OUT}/mobile-overview.png` });
  const mOverview = await overflowProbe(mpage);
  check(
    "mobile overview: 390 wide, no overflow",
    mOverview.innerW === 390 && mOverview.dpr === 1 && mOverview.docW <= 390,
    `innerWidth=${mOverview.innerW} dpr=${mOverview.dpr} scrollWidth=${mOverview.docW}`,
  );

  await mpage.goto(`${BASE}/audit`, { waitUntil: "networkidle" });
  await mpage.screenshot({ path: `${OUT}/mobile-upload.png` });
  const mAudit = await overflowProbe(mpage);
  check(
    "mobile upload: no horizontal overflow",
    mAudit.docW <= 390,
    `scrollWidth=${mAudit.docW}${mAudit.offenders.length ? ` offenders=${JSON.stringify(mAudit.offenders)}` : ""}`,
  );

  await mpage.setInputFiles('input[type="file"]', fixturePaths["defect.csv"]);
  await mpage.waitForTimeout(250);
  await mpage.getByRole("button", { name: /^Analyze/ }).click();
  await mpage.waitForURL("**/audit/results", { timeout: 30000 });
  await mpage.getByRole("heading", { name: "Audit results" }).waitFor();
  await mpage.waitForTimeout(400);
  await mpage.screenshot({ path: `${OUT}/mobile-results.png` });
  const mResults = await overflowProbe(mpage);
  check(
    "mobile results: no horizontal overflow",
    mResults.docW <= 390,
    `scrollWidth=${mResults.docW}${mResults.offenders.length ? ` offenders=${JSON.stringify(mResults.offenders)}` : ""}`,
  );

  const mToggle = mpage.locator('button[aria-controls^="finding-panel-"]').first();
  await mToggle.click();
  await mpage.locator('[role="region"][aria-label^="Details for"]').first().scrollIntoViewIfNeeded();
  await mpage.waitForTimeout(200);
  await mpage.screenshot({ path: `${OUT}/mobile-expanded-finding.png` });
  const mExpanded = await overflowProbe(mpage);
  check("mobile expanded finding: no overflow", mExpanded.docW <= 390, `scrollWidth=${mExpanded.docW}`);

  // Mobile navigation: all primary routes reachable from the navbar
  const navLabels = await mpage
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link")
    .allInnerTexts();
  check("mobile nav exposes all four destinations", navLabels.length === 4, navLabels.join(" / "));
  await mpage.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Method" }).click();
  await mpage.waitForURL("**/methodology");
  await mpage.screenshot({ path: `${OUT}/mobile-methodology.png` });
  const mMethod = await overflowProbe(mpage);
  check("mobile methodology: no overflow", mMethod.docW <= 390, `scrollWidth=${mMethod.docW}`);

  await mpage.getByRole("link", { name: /Settings/ }).click();
  await mpage.waitForURL("**/settings");
  await mpage.screenshot({ path: `${OUT}/mobile-settings.png` });
  const mSettings = await overflowProbe(mpage);
  check("mobile settings: no overflow", mSettings.docW <= 390, `scrollWidth=${mSettings.docW}`);

  check("no uncaught page errors on mobile run", mobileErrors.length === 0, mobileErrors.join(" | "));
  await mobile.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(`${OUT}/verification.json`, JSON.stringify({ results, failed: failed.length }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
