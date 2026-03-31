const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  
  let resultData = [];

  for (let i = 0; i < 3; i++) {
    const usedKeyword = keywords[(currentHour + i) % keywords.length];
    console.log(`Attempt ${i + 1}: Scanning for ${usedKeyword}...`);

    try {
      // 【変更点】APIサーバーではなく、WEB本体の検索エンドポイントを叩く
      const searchUrl = `https://www.roblox.com/catalog/browse/update?Keyword=${encodeURIComponent(usedKeyword)}&Category=9&MaxRows=30`;
      
      const res = await fetch(searchUrl, {
        headers: { 
          // ブラウザのふりを徹底する
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.roblox.com/discover'
        }
      });
      
      const text = await res.text();
      let result;
      try {
          result = JSON.parse(text);
      } catch(e) {
          console.log("HTMLが返ってきました（ブロック）。中身の冒頭:", text.substring(0, 100));
          continue;
      }

      if (result && result.length > 0) {
        resultData = result;
        console.log(`✅ Success! Found ${resultData.length} games.`);
        break;
      } else {
        console.log(`⚠️ No data. Response: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`❌ Error:`, e.message);
    }
  }

  if (resultData.length === 0) {
    console.log("全キーワードで全滅しました。");
    return;
  }

  // --- 保存処理 (取得データの形式に合わせて微調整) ---
  for (const game of resultData) {
    const uId = (game.UniverseId || game.universeId || game.id)?.toString();
    if(!uId) continue;
    await supabase.from('games').upsert({
      universe_id: uId,
      name: game.Name || game.name || "Unknown",
      root_place_id: game.RootPlaceId || game.rootPlaceId || game.id,
      last_scanned_at: new Date().toISOString()
    });
  }
  console.log("Supabaseへの保存が完了しました。");
}

run();
