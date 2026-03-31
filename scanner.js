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
      // エンドポイントを v2/games/search に変更し、余計な model. を排除
      const searchUrl = `https://games.roblox.com/v2/games/search?keyword=${encodeURIComponent(usedKeyword)}&maxRows=30`;
      
      const res = await fetch(searchUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      const result = await res.json();

      // v2 APIは直下の .data に配列が入ります
      if (result.data && result.data.length > 0) {
        resultData = result.data;
        console.log(`✅ Success with "${usedKeyword}"! Found ${resultData.length} games.`);
        break;
      } else {
        console.log(`⚠️ No data for "${usedKeyword}". Response was:`, JSON.stringify(result));
      }
    } catch (e) {
      console.log(`❌ Error:`, e.message);
    }
  }

  if (resultData.length === 0) return;

  // --- 保存処理 (ここは変更なし) ---
  for (const game of resultData) {
    const uId = (game.universeId || game.id).toString();
    await supabase.from('games').upsert({
      universe_id: uId,
      name: game.name || "Unknown",
      root_place_id: game.rootPlaceId || game.id,
      last_scanned_at: new Date().toISOString()
    });
  }

  // --- Tracking処理 (universeIds指定版) ---
  const { data: oldGames } = await supabase.from('games').select('universe_id').order('last_scanned_at', { ascending: true }).limit(20);
  if (oldGames && oldGames.length > 0) {
    const ids = oldGames.map(g => g.universe_id).join(',');
    const detailRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`);
    const detailData = await detailRes.json();
    if (detailData.data) {
      for (const g of detailData.data) {
        await supabase.from('game_snapshots').insert({
          universe_id: g.universeId.toString(),
          player_count: g.playing || 0,
          visit_count: g.visits || 0
        });
        await supabase.from('games').update({ last_scanned_at: new Date().toISOString() }).eq('universe_id', g.universeId.toString());
      }
      console.log(`Updated tracking for ${detailData.data.length} games.`);
    }
  }
}

run();
