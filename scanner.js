const { createClient } = require('@supabase/supabase-js');

// 環境変数からSupabaseに接続
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];
  
  console.log(`Scanning for: ${selectedKeyword}`);

  try {
    // GitHubのIPから直接Robloxを叩く
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const result = await res.json();

    if (!result.data || result.data.length === 0) {
      console.log("No data found from Roblox API.");
      return;
    }

    // --- Discovery: 新規ゲームの保存 ---
    for (const game of result.data) {
      const uId = (game.universeId || game.id).toString();
      await supabase.from('games').upsert({
        universe_id: uId,
        name: game.name || "Unknown",
        root_place_id: game.rootPlaceId || game.id,
        last_scanned_at: new Date().toISOString()
      });
    }
    console.log(`Saved ${result.data.length} games.`);

    // --- Tracking: 既存ゲームの更新 ---
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

  } catch (err) {
    console.error("Error during scan:", err);
  }
}

run();
