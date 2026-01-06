// smartup.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { google } = require("googleapis");
const { User, Purchase, Product, Category } = require("../db");
const logger = require("../utils/logger");

// ----------------- CONFIG -----------------
let botInstance = null;
let lastModifiedId = 2071848603;
const API_URL = process.env.SMARTUP_ORDER_EXPORT_URL;
const RETURN_API_URL = process.env.SMARTUP_RETURN_EXPORT_URL;
const USERNAME = process.env.SMARTUP_USERNAME;
const PASSWORD = process.env.SMARTUP_PASSWORD;

const KEYFILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const SHEET_ID = process.env.USTALARSHEET_ID;
const SHEET_TAB = process.env.USTALARSHEET_TAB || "ustalar";
const SHEET_RANGE = `${SHEET_TAB}!A:D`;

const LAST_SYNC_FILE = path.resolve(process.cwd(), ".smartup_last_sync.json");
const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
const USD_TO_UZS = 12500;
// ----------------- init -----------------
module.exports.init = (bot) => {
  botInstance = bot;
  logger.info("🤖 SmartUp: Bot ulandi");
};

// ----------------- helpers -----------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function parseSmartupDate(str) {
  if (!str) return null;

  // "18.12.2025 15:10:16"
  const [datePart, timePart] = str.split(" ");
  const [day, month, year] = datePart.split(".");
  const [hour, minute, second] = timePart.split(":");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}
function nowFormattedForSmartUp(date = new Date()) {
  // "YYYY-MM-DD HH:mm:ss"
  const pad = (n) => String(n).padStart(2, "0");
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}
function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}
function readLastSync() {
  try {
    if (!fs.existsSync(LAST_SYNC_FILE)) return null;
    const raw = fs.readFileSync(LAST_SYNC_FILE, "utf8");
    const obj = JSON.parse(raw);
    return obj.lastSync || null;
  } catch (e) {
    logger.warn("Could not read last sync file: " + e.message);
    return null;
  }
}
function writeLastSync(ts) {
  try {
    fs.writeFileSync(
      LAST_SYNC_FILE,
      JSON.stringify({ lastSync: ts }, null, 2),
      "utf8"
    );
  } catch (e) {
    logger.error("Could not write last sync file: " + e.message);
  }
}

// ----------------- Telegram queue (ALOHIDA) -----------------
const purchaseMessages = {}; // Xarid xabarlari
const returnMessages = {}; // Qaytarish xabarlari

function addPurchaseMessage(tgId, text) {
  if (!tgId) return;
  if (!purchaseMessages[tgId]) purchaseMessages[tgId] = "";
  purchaseMessages[tgId] += text + "\n";
}

function addReturnMessage(tgId, text) {
  if (!tgId) return;
  if (!returnMessages[tgId]) returnMessages[tgId] = "";
  returnMessages[tgId] += text + "\n";
}

function splitMessage(text, limit = 3500) {
  const parts = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + line + "\n").length > limit) {
      parts.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current.length) parts.push(current);
  return parts;
}

async function flushAllMessages() {
  if (!botInstance) return;

  // 1. Avval xarid xabarlarini yuboramiz
  logger.info(
    `Flushing ${Object.keys(purchaseMessages).length} purchase messages`
  );
  for (const tgId of Object.keys(purchaseMessages)) {
    const chunks = splitMessage(purchaseMessages[tgId]);
    for (const chunk of chunks) {
      try {
        await botInstance.api.sendMessage(tgId, chunk, { parse_mode: "HTML" });
        await sleep(200);
      } catch (e) {
        logger.error("Purchase Telegram send error: " + e.message);
      }
    }
  }

  // 2. Kichik kutish (xabarlar ajralib turishi uchun)
  await sleep(1000);

  // 3. Keyin qaytarish xabarlarini yuboramiz
  logger.info(`Flushing ${Object.keys(returnMessages).length} return messages`);
  for (const tgId of Object.keys(returnMessages)) {
    const chunks = splitMessage(returnMessages[tgId]);
    for (const chunk of chunks) {
      try {
        await botInstance.api.sendMessage(tgId, chunk, { parse_mode: "HTML" });
        await sleep(200);
      } catch (e) {
        logger.error("Return Telegram send error: " + e.message);
      }
    }
  }

  // Tozalash
  Object.keys(purchaseMessages).forEach((k) => delete purchaseMessages[k]);
  Object.keys(returnMessages).forEach((k) => delete returnMessages[k]);
}

function formatDateToSmartup(dateString) {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ----------------- Google Sheets helpers -----------------
function getSheets(scopes = ["https://www.googleapis.com/auth/spreadsheets"]) {
  if (!KEYFILE) throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set");
  const auth = new google.auth.GoogleAuth({ keyFile: KEYFILE, scopes });
  return google.sheets({ version: "v4", auth });
}

async function loadSheetUsers() {
  try {
    const sheets = getSheets([
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ]);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });
    const rows = res.data.values || [];
    const map = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const smartupId = r[1] ? String(r[1]) : null;
      if (!smartupId) continue;
      map.set(smartupId, {
        row: i + 1,
        smartupId,
        name: r[2] || "",
        score: Number(r[3] || 0),
        telegramId: r[0] || null,
      });
    }
    return { map, count: rows.length };
  } catch (err) {
    logger.error("loadSheetUsers error: " + err.message);
    return { map: new Map(), count: 0 };
  }
}

async function batchUpdateScores(updates) {
  if (!updates || updates.length === 0) return true;
  try {
    // dedupe by row (last write wins)
    const byRow = new Map();
    for (const u of updates) byRow.set(u.row, u.score);
    const valueRanges = [];
    for (const [row, score] of byRow.entries()) {
      valueRanges.push({
        range: `${SHEET_TAB}!D${row}`,
        values: [[String(score)]],
      });
    }
    if (DRY_RUN) {
      logger.info(
        "[DRY_RUN] batchUpdateScores would update rows:",
        valueRanges.length
      );
      return true;
    }
    const sheets = getSheets();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: valueRanges },
    });
    return true;
  } catch (err) {
    logger.error("batchUpdateScores error: " + err.message);
    return false;
  }
}

async function appendNewUsers(rows) {
  if (!rows || rows.length === 0) return true;
  try {
    // ensure format: ["", smartupId, fullName, score]
    const safeRows = rows.map((r) => [
      "",
      String(r[1]),
      String(r[2] || ""),
      String(r[3] || 0),
    ]);
    if (DRY_RUN) {
      logger.info("[DRY_RUN] appendNewUsers would append:", safeRows.length);
      return true;
    }
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:D`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: safeRows },
    });
    return true;
  } catch (err) {
    logger.error("appendNewUsers error: " + err.message);
    return false;
  }
}

async function fetchOrdersFiltered(lastCreatedOn) {
  try {
    const body = {
      filial_codes: [{ filial_code: "ventil" }],
    };

    if (lastCreatedOn) {
      body.begin_created_on = "16.12.2025";
      body.end_created_on = "";
    }

    const res = await axios.post(API_URL, body, {
      auth: { username: USERNAME, password: PASSWORD },
    });

    return res.data?.order || [];
  } catch (err) {
    logger.error("fetchOrdersFiltered error: " + err.message);
    if (err.response) logger.error(JSON.stringify(err.response.data, null, 2));
    return [];
  }
}

async function fetchReturnsFiltered(lastCreatedOn) {
  try {
    const body = {
      filial_codes: [{ filial_code: "ventil" }],
    };

    if (lastCreatedOn) {
      body.begin_return_date = "16.12.2025";
      body.end_return_date = "";
    }

    const res = await axios.post(RETURN_API_URL, body, {
      auth: { username: USERNAME, password: PASSWORD },
    });

    return res.data?.return || [];
  } catch (err) {
    logger.error("fetchReturnsFiltered error: " + err.message);
    if (err.response) logger.error(JSON.stringify(err.response.data, null, 2));
    return [];
  }
}
function cleanSmartupName(name) {
  if (!name) return "";

  // Brand nomlarini aniqlash
  const commonBrands = [
    "EPA",
    "HAYAL",
    "Mercury",
    "Climate House",
    "NERO",
    "TIM",
    "VERO",
    "IVAR",
    "PRO AQUA",
    "Ruterm",
    "GAPPO",
    "BlancoBloom",
    "Energy",
    "Creative",
    "UNICORN",
    "Ferra",
    "Nova",
    "Rosturplast",
    "IRONDAY",
    "PRODN",
    "Azal",
    "Orbek",
  ];

  const parts = name.split(/\s*\/\s*/);

  // Agar 3 yoki undan ko'p qism bo'lsa
  if (parts.length >= 3) {
    // Oxirgi qism "Узбекистан" bo'lishi kerak
    if (parts[parts.length - 1] === "Узбекистан") {
      // Oxirgi ikki qismni olib tashlash (brand va davlat)
      return parts
        .slice(0, parts.length - 2)
        .join("/")
        .trim();
    }
  }

  // Agar 2 qism bo'lsa
  if (parts.length === 2) {
    // Ikkinchi qism brand nomi bo'lishi mumkin
    const secondPart = parts[1];
    const isBrand = commonBrands.some(
      (brand) => secondPart.includes(brand) || brand.includes(secondPart)
    );

    if (isBrand || secondPart === "Узбекистан") {
      return parts[0].trim();
    }

    // Mahsulot nomidagi "/" bo'lishi mumkin
    return name.trim();
  }

  return name.trim();
}
// ----------------- MAIN SYNC -----------------
module.exports.processNewEvents = async () => {
  try {
    logger.info("🔄 SmartUp incremental sync boshlanmoqda...");

    // 1) determine last sync time
    const lastSync = readLastSync(); // may be null
    const beginModifiedOn = lastSync || ""; // if null -> empty (SmartUp returns full dataset) but we prefer initial full then incremental
    if (!lastSync)
      logger.info(
        "No last sync found — first run will import all available (consider setting initial lastSync)."
      );

    // 2) load sheet users (single read)
    const { map: usersMap } = await loadSheetUsers();
    logger.info(`Loaded ${usersMap.size} users from sheet.`);

    // 3) fetch orders and returns using filter
    const orders = await fetchOrdersFiltered(beginModifiedOn);
    const returnsData = await fetchReturnsFiltered(beginModifiedOn);

    logger.info(
      `Orders fetched: ${orders.length}, Returns fetched: ${returnsData.length}`
    );

    // Collect updates/appends
    const pendingUpdates = []; // {row, score}
    const pendingAppends = []; // ["", smartupId, fullName, score]
    let processed = 0;
    let returned = 0;

    // helper to queue changes
    function queueScoreChange(smartupId, fullName, delta) {
      smartupId = String(smartupId);
      // Round delta to 2 decimals
      const roundedDelta = roundToTwoDecimals(delta);

      // if exists in sheet
      if (usersMap.has(smartupId)) {
        const u = usersMap.get(smartupId);
        u.score = roundToTwoDecimals(u.score + roundedDelta);
        pendingUpdates.push({ row: u.row, score: u.score });
        return;
      }

      // else find or add to appends
      let row = pendingAppends.find((r) => String(r[1]) === smartupId);
      if (!row) {
        pendingAppends.push([
          "",
          smartupId,
          fullName || "",
          String(roundedDelta),
        ]);
      } else {
        const currentScore = Number(row[3]) || 0;
        row[3] = String(roundToTwoDecimals(currentScore + roundedDelta));
        // ensure name filled if available
        if (!row[2] && fullName) row[2] = fullName;
      }
    }

    // Order uchun total ($)
    function calculatePurchaseTotal(item) {
      return roundToTwoDecimals(Math.abs(Number(item.sold_amount || 0)));
    }

    // Return uchun total ($) — SOLD_AMOUNTDAN
    function calculateReturnTotal(item) {
      return roundToTwoDecimals(Math.abs(Number(item.sold_amount || 0)));
    }

    // Ball hisoblash
    function calculatePoints(totalUZS, percent) {
      if (!percent || percent <= 0) return 0;
      return roundToTwoDecimals((totalUZS * percent) / 100);
    }

    for (const order of orders) {
      const smartupUserId = String(order.person_id);
      const userRecord = await User.findOne({
        where: { smartup_id: smartupUserId },
      });

      if (!userRecord) {
        logger.warn(`Order: user not found for smartup_id=${smartupUserId}`);
        continue;
      }

      const fullName = order.person_name || userRecord.name || "";
      const items = order.order_products || [];

      for (const item of items) {
        const smartupItemId = String(item.product_unit_id);

        const exists = await Purchase.findOne({
          where: { smartup_item_id: smartupItemId },
        });
        if (exists) continue;

        const qty = Number(item.sold_quant || 0);
        if (qty <= 0) continue;

        const totalUZS = calculatePurchaseTotal(item);

        const product = await Product.findOne({
          where: { smartup_product_id: String(item.product_id) },
          include: [{ model: Category, as: "category" }],
        });

        if (!product || !product.category) {
          logger.warn(`Product not found for order item ${item.product_id}`);
          continue;
        }

        const percent = Number(product.category.percent || 0);
        const points = calculatePoints(totalUZS, percent);

        await Purchase.create({
          user_id: userRecord.id,
          product_id: product.id,
          smartup_deal_id: order.deal_id,
          smartup_product_id: item.product_id,
          smartup_item_id: smartupItemId,
          type: "purchase",
          quantity: qty,
          amount: totalUZS,
          points,
          date: parseSmartupDate(order.deal_time),
          note: order.delivery_number,
        });
        processed++;
        queueScoreChange(smartupUserId, fullName, points);

        addPurchaseMessage(
          userRecord.telegram_id,
          `🛍 <b>Xarid</b>\n📦 ${product.name}\n🔢 ${qty} ta\n💰 ${totalUZS} $\n➕ <b>${points}</b> ball`
        );
      }
    }

    for (const ret of returnsData) {
      const smartupUserId = String(ret.person_id);

      const userRecord = await User.findOne({
        where: { smartup_id: smartupUserId },
      });

      if (!userRecord) {
        logger.warn(`Return: user not found for smartup_id=${smartupUserId}`);
        continue;
      }

      const fullName = ret.person_name || userRecord.name || "";
      const items = ret.return_products || [];

      for (const item of items) {
        const cleanedName = cleanSmartupName(item.product_name);

        // 🔑 UNIQUE KEY
        const key = `ret_${ret.deal_id}_${item.product_unit_id}`;
        console.log(key, "keyyyyyyyyy");

        const qty = Number(item.return_quant || 0);
        if (qty <= 0) continue;

        const totalUZS = calculateReturnTotal(item);

        // 🔎 Product faqat NOM orqali
        const product = await Product.findOne({
          where: { name: cleanedName || "" },
          include: [{ model: Category, as: "category" }],
        });

        if (!product || !product.category) {
          logger.warn(
            `Return: product/category not found. name=${cleanedName}`
          );
          continue;
        }

        const percent = Number(product.category.percent || 0);
        const points = calculatePoints(totalUZS, percent);

        // 🔍 OLDIN BOR-YO‘QLIGINI TEKSHIRAMIZ
        const exists = await Purchase.findOne({
          where: { smartup_item_id: key },
        });
        if (!exists) {
          try {
            await Purchase.create({
              user_id: userRecord.id,
              product_id: product.id,
              smartup_deal_id: ret.deal_id,
              smartup_product_id: item.product_unit_id,
              smartup_item_id: key,
              type: "return",
              quantity: qty,
              amount: totalUZS,
              points,
              date: parseSmartupDate(ret.deal_time),
              note: ret.delivery_number,
            });
            queueScoreChange(smartupUserId, fullName, -points);
            returned++;
            addReturnMessage(
              userRecord.telegram_id,
              `♻️ <b>Qaytarish</b>\n📦 ${product.name}\n🔢 ${qty} ta\n💰 ${totalUZS} $\n➖ <b>${points}</b> ball`
            );
          } catch (e) {
            logger.error("RETURN CREATE ERROR:", e.message);
          }
        }

        // 📩 Telegram xabar (xohlasang faqat !exists qilsa ham bo‘ladi)
      }
    }

    const nameUpdates = [];
    try {
      const nameHints = new Map();
      for (const a of pendingAppends || []) {
        if (a[2]) nameHints.set(String(a[1]), a[2]);
      }
      for (const [smartupId, u] of usersMap.entries()) {
        if ((!u.name || u.name.trim() === "") && nameHints.has(smartupId)) {
          nameUpdates.push({ row: u.row, name: nameHints.get(smartupId) });
        }
      }
    } catch (e) {
      logger.warn("Name update collection error: " + e.message);
    }

    if (pendingAppends.length) {
      const toAppend = pendingAppends.map((r) => [
        "",
        String(r[1]),
        String(r[2] || ""),
        String(r[3] || 0),
      ]);
      const okAppend = await appendNewUsers(toAppend);
      if (!okAppend) logger.warn("appendNewUsers returned false");
      else {
        const reload = await loadSheetUsers();
        for (const [k, v] of reload.map.entries()) {
          usersMap.set(k, v);
        }
      }
    }

    if (pendingUpdates.length) {
      logger.info(
        `Batch updating ${pendingUpdates.length} score(s) on sheet...`
      );
      const ok = await batchUpdateScores(pendingUpdates);
      if (!ok) logger.warn("batchUpdateScores reported failure");
    }

    if (nameUpdates.length) {
      try {
        if (DRY_RUN) {
          logger.info("[DRY_RUN] nameUpdates:", nameUpdates);
        } else {
          const sheets = getSheets();
          const data = nameUpdates.map((n) => ({
            range: `${SHEET_TAB}!C${n.row}`,
            values: [[String(n.name)]],
          }));
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: { valueInputOption: "USER_ENTERED", data },
          });
        }
      } catch (e) {
        logger.warn("Name batch update failed: " + e.message);
      }
    }

    // 🔴 Yangilangan: flushAllMessages() chaqiramiz
    await flushAllMessages();

    // 4) Save new lastSync timestamp (now)
    const newSyncTs = nowFormattedForSmartUp(new Date());
    writeLastSync(newSyncTs);
    logger.info(
      `Sync finished. purchases=${processed}, returns=${returned}, newSync=${newSyncTs}`
    );

    return { processed, returns: returned, lastSync: newSyncTs };
  } catch (err) {
    logger.error(
      "SmartUp Sync ERROR: " + (err && err.message ? err.message : err)
    );
    return { processed: 0, returns: 0 };
  }
};
