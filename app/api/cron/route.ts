import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. 検索ワードを時間で回す（より広範囲に集めるため）
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Easy", "Hard", "Mystery", "Fun"];
  const currentHour = new Date().getHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  try {
    // 2. Robloxの「発見（Discover）」APIを使用（これなら検索結果が取れる可能性が高い）
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=50`;
    const res = await fetch(searchUrl);
    const result = await res.json();

    if (!result.data || result.data.length === 0) {
      return NextResponse.json({ message: "No games found", keyword: selectedKeyword });
    }

    let newSaved = 0;
    for (const game of result.data) {
      const uId = (game.universeId || game.UniverseId).toString();
      const gameName = game.name || game.Name;
      const visitCount = game.placeVisits || game.Visits || 0;

      // 3. フィルタリング：デフォルト名 且つ 訪問数が少ないものは捨てる
      if (gameName.toLowerCase().includes("'s place") && visitCount < 10) continue;

      // 4. gamesテーブルに保存（既存なら更新、新規なら挿入）
      await supabase.from('games').upsert({
        universe_id: uId,
        name: gameName,
        root_place_id: game.rootPlaceId || game.RootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      // 5. snapshotsテーブルに「今の瞬間」を記録
      await supabase.from('game_snapshots').insert({
        universe_id: uId,
        player_count: game.playerCount || game.PlayerCount || 0,
        visit_count: visitCount,
        favorited_count: 0
      });

      newSaved++;
    }

    return NextResponse.json({ 
      success: true, 
      keyword: selectedKeyword,
      processed: result.data.length,
      saved_or_updated: newSaved 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
