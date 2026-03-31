import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. 基本設定（1時間ごとにジャンルを切り替え）
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  const results = {
    success: true,
    hour: currentHour,
    keyword: selectedKeyword,
    new_discovered: 0,
    tracking_updated: 0,
    discovery_error: null as string | null
  };

  try {
    // --- 2. 新規ゲームの開拓 (Discovery) ---
    // ここでエラーが起きても、下のTrackingを止めないように try-catch を分けるか、ifで制御します
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    const searchRes = await fetch(searchUrl, { cache: 'no-store' });
    const searchData = await searchRes.json();

    if (searchData?.data && searchData.data.length > 0) {
      const savedIds = [];
      for (const game of searchData.data) {
        const uId = (game.universeId || game.UniverseId || game.id)?.toString();
        if (!uId) continue;

        const { error: upsertError } = await supabase.from('games').upsert({
          universe_id: uId,
          name: game.name || "Unknown",
          root_place_id: game.rootPlaceId || game.RootPlaceId,
          last_scanned_at: new Date().toISOString()
        });
        
        if (!upsertError) savedIds.push(uId);
      }
      results.new_discovered = savedIds.length;
    } else {
      results.discovery_error = "Roblox API returned 0 results for this keyword.";
    }

    // --- 3. 既存ゲームの定点観測 (Tracking) ---
    // Discoveryの結果に関わらず、DBにある古いデータから20件を更新する
    const { data: oldGames } = await supabase
      .from('games')
      .select('universe_id')
      .order('last_scanned_at', { ascending: true })
      .limit(20);

    if (oldGames && oldGames.length > 0) {
      const ids = oldGames.map(g => g.universe_id).join(',');
      const detailRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`, { cache: 'no-store' });
      const detailData = await detailRes.json();

      if (detailData?.data) {
        for (const g of detailData.data) {
          const uId = g.universeId.toString();

          // スナップショット（時系列データ）を保存
          await supabase.from('game_snapshots').insert({
            universe_id: uId,
            player_count: g.playing || 0,
            visit_count: g.visits || 0,
            favorited_count: 0
          });

          // 最終スキャン時刻を更新（これで「古い順」の列から外れる）
          await supabase.from('games').update({ 
            last_scanned_at: new Date().toISOString() 
          }).eq('universe_id', uId);

          results.tracking_updated++;
        }
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
