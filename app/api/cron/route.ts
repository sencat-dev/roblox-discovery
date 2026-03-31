import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const manualKeyword = searchParams.get('keyword');
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = manualKeyword || keywords[currentHour % keywords.length];

  const results: any = { success: true, hour: currentHour, keyword: selectedKeyword, new_discovered: 0, tracking_updated: 0 };

  try {
    // --- 1. 新規ゲームの開拓 (v2 Search APIを使用) ---
    // v2は非常に安定しており、通常のブラウザ検索と同じ結果を返します
    const searchUrl = `https://games.roblox.com/v2/games/search?keyword=${encodeURIComponent(selectedKeyword)}&maxRows=30`;
    
    const searchRes = await fetch(searchUrl, { 
      cache: 'no-store',
      headers: {
        // 重要：ブラウザからのアクセスを装うことで、0件回答を回避します
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const searchData = await searchRes.json();

    // v2 APIは結果が [data] ではなく [games] や直下の [data] に入ることがあるため柔軟に対応
    const games = searchData?.data || searchData?.games || [];

    if (games.length > 0) {
      const savedIds = [];
      for (const game of games) {
        const uId = (game.universeId || game.id)?.toString();
        if (!uId) continue;

        const { error } = await supabase.from('games').upsert({
          universe_id: uId,
          name: game.name || "Unknown",
          root_place_id: game.rootPlaceId || game.id,
          last_scanned_at: new Date().toISOString()
        });
        if (!error) savedIds.push(uId);
      }
      results.new_discovered = savedIds.length;
    } else {
      results.discovery_error = "No games found. Try checking the URL in a browser.";
      results.debug_raw = searchData; // 何が返ってきたか中身を確認
    }

    // --- 2. 既存の定点観測 (Tracking) ---
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
