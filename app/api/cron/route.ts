import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  try {
    // --- 1階：新規開拓 (Discovery) ---
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.data) {
      for (const game of searchData.data) {
        const uId = (game.universeId || game.UniverseId).toString();
        // デフォルト名除外
        if (game.name?.toLowerCase().includes("'s place") && (game.placeVisits || 0) < 10) continue;

        await supabase.from('games').upsert({
          universe_id: uId,
          name: game.name,
          root_place_id: game.rootPlaceId || game.RootPlaceId,
          last_scanned_at: new Date().toISOString()
        });
      }
    }

    // --- 2階：定点観測 (Tracking) ---
    // DBから「スキャンが古い順」に上位20件を取得
    const { data: oldGames } = await supabase
      .from('games')
      .select('universe_id')
      .order('last_scanned_at', { ascending: true })
      .limit(20);

    if (oldGames && oldGames.length > 0) {
      const ids = oldGames.map(g => g.universe_id).join(',');
      const detailRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`);
      const detailData = await detailRes.json();

      if (detailData.data) {
        for (const game of detailData.data) {
          const uId = game.universeId.toString();
          
          // 最新数値をスナップショットに保存
          await supabase.from('game_snapshots').insert({
            universe_id: uId,
            player_count: game.playing || 0,
            visit_count: game.visits || 0,
            favorited_count: 0
          });

          // 最終スキャン時刻を更新（これで「古い順」の列から外れる）
          await supabase.from('games').update({ 
            last_scanned_at: new Date().toISOString() 
          }).eq('universe_id', uId);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      keyword: selectedKeyword,
      tracking_updated: oldGames?.length || 0 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
