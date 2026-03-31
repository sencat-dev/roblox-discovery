import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. 時間によってジャンルを切り替える設定
  const genres = ["Horror", "Obby", "Tycoon", "Simulator", "Social", "Mystery"];
  const currentHour = new Date().getUTCHours(); // 世界標準時（0-23）
  const selectedGenre = genres[currentHour % genres.length];

  try {
    // 2. Roblox APIでキーワード検索（最新・50件取得）
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${selectedGenre}&model.maxRows=50`;
    const res = await fetch(searchUrl);
    const searchData = await res.json();

    if (!searchData.data || searchData.data.length === 0) {
      return NextResponse.json({ message: "No games found for this genre." });
    }

    let savedCount = 0;
    let skippedCount = 0;

    for (const game of searchData.data) {
      const universeId = game.universeId.toString();
      const gameName = game.name;
      const visitCount = game.placeVisits || 0;

      // 3. 【フィルタリング】デフォルト名の初期部屋を除外
      // 条件：名前が「's Place」で終わり、かつ訪問数が10回未満
      const isDefaultPlace = gameName.toLowerCase().includes("'s place");
      if (isDefaultPlace && visitCount < 10) {
        skippedCount++;
        continue; 
      }

      // 4. Supabaseに保存 (gamesテーブル)
      await supabase.from('games').upsert({
        universe_id: universeId,
        name: gameName,
        root_place_id: game.rootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      // 5. 今の数値を保存 (game_snapshotsテーブル)
      await supabase.from('game_snapshots').insert({
        universe_id: universeId,
        player_count: game.playerCount || 0,
        visit_count: visitCount,
        favorited_count: 0
      });

      savedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      genre: selectedGenre,
      saved: savedCount,
      skipped: skippedCount
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
