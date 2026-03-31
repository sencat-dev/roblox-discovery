import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const genres = ["Horror", "Obby", "Tycoon", "Simulator", "Social", "Mystery"];
  const currentHour = new Date().getHours();
  const selectedGenre = genres[currentHour % genres.length];

  try {
    // 【変更】より新しい検索APIエンドポイントを使用
    // keyword検索で「最新」や「人気」のゲームを30件取得する設定
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedGenre)}&model.maxRows=30`;
    
    // もし上記がダメな場合のための予備（別の検索エンドポイント）
    // const searchUrl = `https://discover.roblox.com/v1/search/games?keyword=${encodeURIComponent(selectedGenre)}&maxRows=30`;

    const res = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const searchData = await res.json();

    if (!searchData.data || searchData.data.length === 0) {
      // APIがダメな場合、手動でテスト用のリストを作ってDB保存が動くかだけ確認する
      return NextResponse.json({ 
        message: "API still returning empty", 
        genre: selectedGenre,
        hint: "Roblox API might be blocking direct fetch. Trying a different method next.",
        raw: searchData
      });
    }

    let savedCount = 0;
    for (const game of searchData.data) {
      const uId = game.universeId || game.UniverseId;
      const gameName = game.name || game.Name;
      const visitCount = game.placeVisits || game.PlaceVisits || 0;

      // デフォルト名除外フィルタ
      if (gameName.toLowerCase().includes("'s place") && visitCount < 10) continue;

      await supabase.from('games').upsert({
        universe_id: uId.toString(),
        name: gameName,
        root_place_id: game.rootPlaceId || game.RootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      await supabase.from('game_snapshots').insert({
        universe_id: uId.toString(),
        player_count: game.playerCount || game.PlayerCount || 0,
        visit_count: visitCount,
        favorited_count: 0
      });

      savedCount++;
    }

    return NextResponse.json({ success: true, genre: selectedGenre, saved: savedCount });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
