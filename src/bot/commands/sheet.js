const { google } = require("googleapis");

async function getUserScoreFromSheet(smartupId) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.USTALARSHEET_ID,
      range: `ustalar!A:D`,
    });

    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      const rowSmartupId = r[1];
      const score = r[3];

      if (String(rowSmartupId) === String(smartupId)) {
        return Number(score || 0);
      }
    }

    return 0;
  } catch (err) {
    console.error("Sheet read error:", err.message);
    return 0;
  }
}

module.exports = { getUserScoreFromSheet };
