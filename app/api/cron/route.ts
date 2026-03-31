import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ジャンルリスト
  const genres = ["Horror", "Obby", "Tycoon", "Simulator", "Social", "Mystery"];
  const currentHour = new Date().getUTCHours();
  const selectedGenre = genres[currentHour % genres.length];

  try {
    // 【修正ポイント】より一般的な検索パラメータに変更
    // sortFilter: 1は「人気順」に近いですが、まずは確実にデータを取るために設定
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedGenre)}&model.maxRows=50`;
    
    const res = await fetch(searchUrl);
    const searchData = await res.json();

    // デバッグ用：APIが空だった場合に中身をそのまま確認する
    if (!searchData.data || searchData.data.length === 0) {
      return NextResponse.json({ 
        message: "No games found", 
        genre: selectedGenre,
        raw_response: searchData // APIから何が返ってきたかを表示
      });
    }

    let savedCount = 0;
    let skippedCount = 0;

    for (const game of searchData.data) {
      // APIによって universeId のキー名が違う場合があるのでケア
      const uId = game.universeId || game.UniverseId;
      if (!uId) continue;

      const universeId = uId.toString();
      const gameName = game.name || game.Name;
      const visitCount = game.placeVisits || game.PlaceVisits || 0;
      const playerCount = game.playerCount || game.PlayerCount || 0;

      // 【フィルタリング】デフォルト名の初期部屋を除外
      const isDefaultPlace = gameName.toLowerCase().includes("'s place");
      if (isDefaultPlace && visitCount < 10) {
        skippedCount++;
        continue; 
      }

      // 1. gamesテーブル
      await supabase.from('games').upsert({
        universe_id: universeId,
        name: gameName,
        root_place_id: game.rootPlaceId || game.RootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      // 2. game_snapshotsテーブル
      await supabase.from('game_snapshots').insert({
        universe_id: universeId,
        player_count: playerCount,
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
