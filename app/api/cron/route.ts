import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  const results: any = { success: true, keyword: selectedKeyword, new_discovered: 0, tracking_updated: 0 };

  try {
    // 【最重要】検索API(search)ではなく、リストAPI(list)の「キーワードフィルタ」を使います。
    // これにより、ガードを潜り抜けられる可能性が上がります。
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    
    const searchRes = await fetch(searchUrl, { 
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    const searchData = await searchRes.json();

    // 取得できた場合の処理
    if (searchData?.data && searchData.data.length > 0) {
      for (const game of searchData.data) {
        const uId = (game.universeId || game.id)?.toString();
        if (!uId) continue;
        await supabase.from('games').upsert({
          universe_id: uId,
          name: game.name || "Unknown",
          root_place_id: game.rootPlaceId || game.id,
          last_scanned_at: new Date().toISOString()
        });
        results.new_discovered++;
      }
    } else {
      // 依然として0件なら、デバッグ情報を出す
      results.debug_raw = searchData;
    }

    // --- Tracking処理（ここは常に実行） ---
    const { data: oldGames } = await supabase.from('games').select('universe_id').order('last_scanned_at', { ascending: true }).limit(20);
    if (oldGames && oldGames.length > 0) {
      const ids = oldGames.map(g => g.universe_id).join(',');
      const detailRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`, { cache: 'no-store' });
      const detailData = await detailRes.json();
      if (detailData?.data) {
        for (const g of detailData.data) {
          await supabase.from('game_snapshots').insert({
            universe_id: g.universeId.toString(),
            player_count: g.playing || 0,
            visit_count: g.visits || 0,
            favorited_count: 0
          });
          await supabase.from('games').update({ last_scanned_at: new Date().toISOString() }).eq('universe_id', g.universeId.toString());
          results.tracking_updated++;
        }
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
