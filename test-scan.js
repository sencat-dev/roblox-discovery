// test-scan.js
async function test() {
    const url = "https://games.roblox.com/v1/games/list?model.keyword=Horror&model.maxRows=10";
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await res.json();
        console.log("Roblox API Response:", JSON.stringify(data).substring(0, 200));
        if (data.data && data.data.length > 0) {
            console.log("✅ 成功！GitHubからならデータが取れます！");
        } else {
            console.log("❌ 失敗：GitHubもブロックされているか、中身が空です。");
        }
    } catch (e) {
        console.error("エラー:", e.message);
    }
}
test();
